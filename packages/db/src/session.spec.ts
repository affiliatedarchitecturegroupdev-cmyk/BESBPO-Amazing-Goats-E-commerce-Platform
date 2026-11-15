import { describe, it, expect } from 'vitest';
import { sessionSettings, sessionStatement } from './session';

describe('sessionSettings', () => {
  it('sets every RLS setting, defaulting to empty and staff off', () => {
    expect(sessionSettings({})).toEqual([
      ['app.org_id', ''],
      ['app.user_id', ''],
      ['app.staff', 'off'],
    ]);
  });

  it('marks staff on only for a staff session', () => {
    expect(sessionSettings({ staff: true })).toContainEqual(['app.staff', 'on']);
    expect(sessionSettings({ staff: false })).toContainEqual(['app.staff', 'off']);
  });

  it('carries the org and user ids through', () => {
    const settings = sessionSettings({ orgId: 'org-1', userId: 'user-1' });
    expect(settings).toContainEqual(['app.org_id', 'org-1']);
    expect(settings).toContainEqual(['app.user_id', 'user-1']);
  });
});

describe('sessionStatement', () => {
  it('parameterises every value, so a setting cannot be injected', () => {
    const { text, values } = sessionStatement({ orgId: "o'); DROP TABLE sales.orders; --" });
    expect(text).not.toContain('DROP TABLE');
    expect(text).toContain('set_config($1, $2, true)');
    expect(text).toContain('set_config($5, $6, true)');
    expect(values).toContain("o'); DROP TABLE sales.orders; --");
  });

  it('makes the settings transaction-local', () => {
    expect(sessionStatement({}).text).toContain(', true)');
  });
});
