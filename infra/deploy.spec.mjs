// Deployment contract (T-036).
//
// The infra manifests are the only description of what runs in production, and
// nothing else in the repo fails when they drift from the code. This test keeps
// them honest: the Northflank template and the Koyeb compose file both parse,
// every service node names a Dockerfile that exists, each declared port matches
// the `PORT` default the service binds (or the Dockerfile `EXPOSE`), each HTTP
// health path is one the app actually serves, and no secret is checked in.
//
// It reads files only. It does not contact Northflank or Koyeb.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { describe, it, expect } from 'vitest';

const root = process.cwd();
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const readYaml = (p) => parseYaml(readFileSync(join(root, p), 'utf8'));
const exists = (p) => existsSync(join(root, p));

// Collect every node in a Northflank template, at any depth. A node is any
// object with a `kind`; steps nest under `spec.spec.steps`, so walk every value.
function nodesOf(template) {
  const found = [];
  const walk = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(walk);
    if (typeof value.kind === 'string') found.push(value);
    for (const child of Object.values(value)) walk(child);
  };
  walk(template);
  return found;
}

// The port each service binds. Nest services default `process.env.PORT ?? N`.
const NEST_PORT = (dir) => {
  const main = readFileSync(join(root, dir, 'src', 'main.ts'), 'utf8');
  const m = main.match(/process\.env\.PORT\s*\?\?\s*(\d+)/);
  expect(m, `${dir}/src/main.ts has no PORT default`).not.toBeNull();
  return Number(m[1]);
};

const northflank = readJson('infra/northflank/project.json');
const koyeb = readYaml('infra/koyeb/koyeb-compose.yaml');

describe('Northflank template (infra/northflank/project.json)', () => {
  it('is a v1.2 template with a workflow root', () => {
    expect(northflank.apiVersion).toBe('v1.2');
    expect(northflank.spec?.kind).toBe('Workflow');
    expect(Array.isArray(northflank.spec?.spec?.steps)).toBe(true);
  });

  it('targets the Johannesburg region', () => {
    const project = nodesOf(northflank).find((n) => n.kind === 'Project');
    expect(project, 'no Project node').toBeTruthy();
    expect(project.spec.region).toBe('africa-south');
  });

  it('provisions Postgres and Redis addons', () => {
    const types = nodesOf(northflank)
      .filter((n) => n.kind === 'Addon')
      .map((n) => n.spec.type);
    expect(types).toContain('postgresql');
    expect(types).toContain('redis');
  });

  it('links addon connection strings to DATABASE_URL and REDIS_URL', () => {
    const group = nodesOf(northflank).find((n) => n.kind === 'SecretGroup');
    expect(group, 'no SecretGroup node').toBeTruthy();
    const aliases = group.spec.addonDependencies.flatMap((d) => d.keys.flatMap((k) => k.aliases));
    expect(aliases).toContain('DATABASE_URL');
    expect(aliases).toContain('REDIS_URL');
  });

  it('every service builds a Dockerfile that exists, on the right port and path', () => {
    const services = nodesOf(northflank).filter((n) => n.kind === 'CombinedService');
    expect(services.length).toBeGreaterThan(0);

    for (const node of services) {
      const name = node.spec.name;
      const dockerfile = node.spec.buildSettings?.dockerfile?.dockerFilePath;
      expect(dockerfile, `${name} has no dockerfile`).toBeTruthy();

      // dockerFilePath is absolute inside the repo, e.g. /services/gateway/Dockerfile.
      const rel = dockerfile.replace(/^\//, '');
      expect(exists(rel), `${name}: ${rel} does not exist`).toBe(true);

      const declared = node.spec.ports?.[0]?.internalPort;
      const dir = rel.replace(/\/Dockerfile$/, '');
      const expected = dir.startsWith('services/') ? NEST_PORT(dir) : 3000; // apps run Next.js on 3000
      expect(declared, `${name} port`).toBe(expected);

      const check = node.spec.healthChecks?.[0];
      expect(check.protocol, `${name} health protocol`).toBe('HTTP');
      expect(check.port, `${name} health port`).toBe(expected);

      // Every deployable serves a dedicated GET /health (T-034). Nest services
      // use a controller; Next.js apps use a route handler.
      expect(check.path, `${name} health path`).toBe('/health');
      if (dir.startsWith('services/')) {
        expect(
          exists(join(dir, 'src', 'health', 'health.controller.ts')),
          `${name} has no health controller`,
        ).toBe(true);
      } else {
        expect(exists(join(dir, 'app', 'health', 'route.ts')), `${name} has no health route`).toBe(
          true,
        );
      }
    }
  });

  it('checks in no plaintext secrets', () => {
    const group = nodesOf(northflank).find((n) => n.kind === 'SecretGroup');
    for (const [key, value] of Object.entries(group.spec.secrets.variables)) {
      // Anything that looks like a credential must come from a template argument.
      if (/(TOKEN|SECRET|KEY|PASSWORD|API|CREDENTIAL)/i.test(key)) {
        expect(String(value), `${key} is not a template argument`).toMatch(
          /^\$\{args\.[A-Z0-9_]+\}$/,
        );
      }
    }
  });
});

// The remaining front ends (T-067). Each one has a Dockerfile and a /health
// route, so the failure this guards is a deployable that exists in the repo and
// never reaches production — invisible until someone tries to sign in.
describe('Northflank: the remaining front ends (T-067)', () => {
  const FRONT_ENDS = [
    'trade-portal',
    'admin',
    'driver-pwa',
    'advertiser-portal',
    'partner-portal',
  ];

  const services = nodesOf(northflank).filter((n) => n.kind === 'CombinedService');
  const byName = (name) => services.find((n) => n.spec.name === name);

  it('has a node per front end, alongside the storefront', () => {
    for (const name of FRONT_ENDS) {
      expect(byName(name), `${name} has no CombinedService node`).toBeTruthy();
    }
  });

  it('every front end deploys its own Dockerfile on port 3000 with /health', () => {
    for (const name of FRONT_ENDS) {
      const node = byName(name);
      expect(node.spec.buildSettings?.dockerfile?.dockerFilePath).toBe(`/apps/${name}/Dockerfile`);
      expect(node.spec.ports?.[0]?.internalPort, `${name} port`).toBe(3000);
      const check = node.spec.healthChecks?.[0];
      expect(check?.path, `${name} health path`).toBe('/health');
      expect(check?.port, `${name} health port`).toBe(3000);
    }
  });

  it('serves the public apps on a public port and the admin on a private one', () => {
    for (const name of ['trade-portal', 'driver-pwa', 'advertiser-portal', 'partner-portal']) {
      expect(byName(name).spec.ports?.[0]?.public, `${name} must be public`).toBe(true);
    }
    // The admin portal holds every permission; it is reached over the private
    // route, not the public one (docs/02-access-control.md).
    expect(byName('admin').spec.ports?.[0]?.public).toBe(false);
  });

  it('configures the staff IP allow-list the admin middleware enforces', () => {
    const args = northflank.arguments ?? {};
    expect(args, 'ADMIN_IP_ALLOWLIST must be a template argument').toHaveProperty(
      'ADMIN_IP_ALLOWLIST',
    );

    const group = nodesOf(northflank).find((n) => n.kind === 'SecretGroup');
    expect(group.spec.secrets.variables.ADMIN_IP_ALLOWLIST).toBe('${args.ADMIN_IP_ALLOWLIST}');

    // The value must be a real allow-list, not an empty string: an empty list
    // makes `isIpAllowed` allow everyone, so the deployed portal would be open.
    const middleware = readFileSync(join(root, 'apps/admin/middleware.ts'), 'utf8');
    expect(middleware, 'admin middleware must read ADMIN_IP_ALLOWLIST').toContain(
      'process.env.ADMIN_IP_ALLOWLIST',
    );
    // The rule lives in `@ag/rbac` so the gateway enforces the same one; the
    // middleware must import it rather than carry a second copy.
    expect(exists('packages/rbac/src/ip-allowlist.ts'), 'allow-list rule is missing').toBe(true);
    expect(middleware, 'admin middleware must import the shared rule').toContain('@ag/rbac');
    expect(
      exists('apps/admin/lib/ip-allowlist.ts'),
      'a second copy of the rule would drift from the gateway',
    ).toBe(false);
  });

  it('the driver PWA is installable over HTTPS', () => {
    const node = byName('driver-pwa');
    // Public + HTTPS is what the service worker needs to register at all.
    expect(node.spec.ports?.[0]).toMatchObject({ protocol: 'HTTP', public: true });

    // The manifest the app advertises must be checked in, or the install prompt
    // never appears and the offline app is just a web page.
    const layout = readFileSync(join(root, 'apps/driver-pwa/app/layout.tsx'), 'utf8');
    const href = layout.match(/manifest:\s*'([^']+)'/)?.[1];
    expect(href, 'driver-pwa does not declare a manifest').toBeTruthy();
    expect(exists(join('apps/driver-pwa/public', href.replace(/^\//, ''))), `${href} is missing`).toBe(
      true,
    );
  });
});

describe('Koyeb compose (infra/koyeb/koyeb-compose.yaml)', () => {
  it('names an app and at least one service', () => {
    expect(koyeb.app?.name).toBeTruthy();
    expect(Array.isArray(koyeb.services)).toBe(true);
    expect(koyeb.services.length).toBeGreaterThan(0);
  });

  it('every service builds an existing Dockerfile in a real region', () => {
    const regions = ['fra', 'was', 'sin', 'tyo', 'par', 'sfo', 'aws-us-east-1'];
    for (const entry of koyeb.services) {
      const def = entry.definition;
      const name = def.name;
      expect(def.regions?.length, `${name} has no region`).toBeGreaterThan(0);
      for (const region of def.regions) expect(regions).toContain(region);

      const workdir = def.git?.workdir;
      const dockerfile = def.git?.docker?.dockerfile;
      expect(workdir, `${name} has no workdir`).toBeTruthy();
      expect(dockerfile, `${name} has no dockerfile`).toBeTruthy();
      expect(
        exists(join(workdir, dockerfile)),
        `${name}: ${workdir}/${dockerfile} does not exist`,
      ).toBe(true);

      // Python services expose /health on 8000.
      const check = def.health_checks?.[0]?.http;
      expect(check?.path, `${name} health path`).toBe('/health');
      expect(check?.port, `${name} health port`).toBe(8000);
    }
  });

  it('references secrets by name, never by value', () => {
    for (const entry of koyeb.services) {
      for (const env of entry.definition.env ?? []) {
        expect(
          env.value,
          `${entry.definition.name}: ${env.key} has a plaintext value`,
        ).toBeUndefined();
        expect(env.secret, `${entry.definition.name}: ${env.key} has no secret`).toBeTruthy();
      }
    }
  });
});

// Staging and previews on Koyeb (T-067, docs/14-deployment.md). It lives in its
// own compose file because the non-core file is all-Python on :8000 while
// staging runs the Node front door on :3000; the assertion above would reject
// it, and weakening that assertion to fit both would lose the check for each.
describe('Koyeb staging compose (infra/koyeb/koyeb-staging.yaml)', () => {
  const staging = readYaml('infra/koyeb/koyeb-staging.yaml');

  it('is a separate app from the non-core one', () => {
    expect(staging.app?.name).toBeTruthy();
    expect(staging.app.name).not.toBe(koyeb.app?.name);
    expect(staging.services?.length).toBeGreaterThan(0);
  });

  it('runs the front door and the storefront on port 3000 with /health', () => {
    const names = staging.services.map((s) => s.definition.name);
    expect(names).toContain('staging-gateway');
    expect(names).toContain('staging-storefront');

    for (const entry of staging.services) {
      const def = entry.definition;
      expect(def.ports?.[0]?.port, `${def.name} port`).toBe(3000);
      const check = def.health_checks?.[0]?.http;
      expect(check?.path, `${def.name} health path`).toBe('/health');
      expect(check?.port, `${def.name} health port`).toBe(3000);

      const workdir = def.git?.workdir;
      const dockerfile = def.git?.docker?.dockerfile;
      expect(exists(join(workdir, dockerfile)), `${def.name} Dockerfile is missing`).toBe(true);
    }
  });

  it('scales to zero when idle, so staging does not bill like production', () => {
    for (const entry of staging.services) {
      const scaling = entry.definition.scalings?.[0];
      expect(scaling?.min, `${entry.definition.name} should scale to zero`).toBe(0);
    }
  });

  it('uses staging secrets, never the production ones', () => {
    const secrets = staging.services.flatMap((s) => (s.definition.env ?? []).map((e) => e.secret));
    expect(secrets.length).toBeGreaterThan(0);
    for (const secret of secrets) {
      expect(secret, `${secret} looks like a production secret`).toMatch(/^ag-staging-/);
      expect(secret).not.toBe('ag-analytics-db-url');
    }
    for (const entry of staging.services) {
      for (const env of entry.definition.env ?? []) {
        expect(env.value, `${entry.definition.name}: ${env.key} has a plaintext value`).toBeUndefined();
      }
    }
  });
});

// Observability wiring (T-034). Platform alerts and application alerts both
// reach one webhook, so the manifest must name the same environment variables
// the stock service reads and reference every secret by template argument.
describe('Observability manifest (infra/observability/notification-integration.json)', () => {
  const obs = readJson('infra/observability/notification-integration.json');

  it('wires a Northflank and a Koyeb notification integration to one webhook', () => {
    for (const provider of ['northflank', 'koyeb']) {
      const integrations = obs[provider].notificationIntegrations;
      expect(integrations.length, `${provider} integrations`).toBeGreaterThan(0);
      for (const integration of integrations) {
        expect(integration.type).toBe('RAW_WEBHOOK');
        expect(integration.webhook).toBe('${args.ALERT_WEBHOOK_URL}');
      }
    }
  });

  it('watches the events an operator must see', () => {
    const events = obs.northflank.notificationIntegrations[0].events;
    for (const name of [
      'trigger:service:deployment:status-update',
      'trigger:build:failure',
      'trigger:job-run:failure',
      'trigger:addon-backup:failure',
    ]) {
      expect(events[name], name).toBe(true);
    }
  });

  it('checks in no plaintext secret', () => {
    const text = readFileSync(
      join(root, 'infra/observability/notification-integration.json'),
      'utf8',
    );
    const json = JSON.parse(text);
    const walk = (value) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          if (
            /(SECRET|TOKEN|KEY|PASSWORD|CREDENTIAL|URL)/i.test(key) &&
            typeof child === 'string' &&
            child.length > 0
          ) {
            expect(child, `${key} is not a template argument`).toMatch(/^\$\{args\.[A-Z0-9_]+\}$/);
          }
          walk(child);
        }
      }
    };
    walk(json);
  });

  it('names the environment variables the application reads', () => {
    expect(obs.application.alertWebhookEnv).toEqual(['ALERT_WEBHOOK_URL', 'ALERT_WEBHOOK_SECRET']);
    expect(obs.application.healthPath).toBe('/health');
  });
});
