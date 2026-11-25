/**
 * The gateway stub the accessibility and performance audit runs against (T-080).
 *
 * The audit needs real pages, not error shells: a contrast violation only shows
 * up on a rendered product card, and LCP on an empty grid measures nothing. So
 * this serves the fixture catalogue and the seeded content in the shapes
 * `@ag/api-client` expects.
 *
 * It is a test tool, not a product: it holds no secrets, writes nothing, and is
 * only ever pointed at by a storefront started with GATEWAY_URL=this.
 */
import http from 'node:http';

const catalogue = [
  { id: 'v-full-lamb-box', sku: 'AG-LM-001', productId: 'p-lamb', name: 'Full lamb box', pack: 'About 17 kg', unit: 'box', fulfilment: 'pre_order_cycle', temperature: 'chilled', channel: 'both', phase: 1, lineCode: 'AG-LM', lineName: 'Lamb', categorySlug: 'lamb', halaalAvailable: true, active: true, priceCents: 189900 },
  { id: 'v-lamb-loin-chops', sku: 'AG-LM-002', productId: 'p-lamb', name: 'Lamb loin chops', pack: '400 g', unit: 'pack', fulfilment: 'pre_order_cycle', temperature: 'chilled', channel: 'both', phase: 1, lineCode: 'AG-LM', lineName: 'Lamb', categorySlug: 'lamb', halaalAvailable: true, active: true, priceCents: 12900 },
  { id: 'v-braai-box', sku: 'AG-BX-001', productId: 'p-box', name: 'Braai box', pack: '6 kg', unit: 'box', fulfilment: 'pre_order_cycle', temperature: 'frozen', channel: 'both', phase: 1, lineCode: 'AG-BX', lineName: 'Boxes', categorySlug: 'boxes', halaalAvailable: true, active: true, priceCents: 74900 },
  { id: 'v-eggs-tray', sku: 'AG-EG-001', productId: 'p-eggs', name: 'Eggs tray', pack: '30 eggs', unit: 'tray', fulfilment: 'in_stock', temperature: 'ambient', channel: 'both', phase: 1, lineCode: 'AG-EG', lineName: 'Eggs', categorySlug: 'eggs', halaalAvailable: false, active: true, priceCents: 8500 },
  { id: 'v-boer-wether', sku: 'AG-LG-005', productId: 'p-live', name: 'Boer wether', pack: 'Slaughter weight', unit: 'each', fulfilment: 'reservation', temperature: 'live', channel: 'both', phase: 1, lineCode: 'AG-LG', lineName: 'Live goats', categorySlug: 'live-animals', halaalAvailable: false, active: true, priceCents: 320000 },
];

const recipe = {
  slug: 'potjie',
  title: 'Lamb potjie',
  summary: 'A slow Sunday potjie for eight.',
  taxonomy: ['lamb', 'winter'],
  heroImageUrl: '/media/potjie.jpg',
  prepMinutes: 20,
  cookMinutes: 180,
  servings: 8,
  steps: ['Brown the lamb.', 'Add the vegetables.', 'Simmer for three hours.'],
  ingredients: [{ name: 'Lamb neck', quantity: '1.5 kg' }],
  products: [{ sku: 'AG-LM-002', name: 'Lamb loin chops', pack: '400 g' }],
};

const zoneTable = {
  zones: [
    { code: 'dbn-north', name: 'Durban North', days: ['Tuesday'], feeCents: 4500, minOrderCents: 25000 },
    { code: 'dbn-south', name: 'Durban South', days: ['Thursday'], feeCents: 4500, minOrderCents: 25000 },
  ],
  cutoffDay: 'Sunday',
  cutoffTime: '12:00',
};

const content = [
  { id: 'c1', slug: 'potjie', kind: 'recipe', title: 'Lamb potjie', summary: 'A slow Sunday potjie for eight.', taxonomy: ['lamb', 'winter'], heroImageUrl: '/media/potjie.jpg' },
  { id: 'c2', slug: 'braai-guide', kind: 'post', title: 'The braai guide', summary: 'How to braai lamb without drying it out.', taxonomy: ['lamb'], heroImageUrl: '/media/braai.jpg' },
];

const routes = {
  '/commerce/catalog': () => catalogue,
  '/commerce/catalog/search': () => ({ didYouMean: null, items: catalogue.slice(0, 2) }),
  '/commerce/cycles/current': () => ({ cutoffAt: '2026-11-20T12:00:00Z', orderOpen: true }),
  '/logistics/zones/table': () => zoneTable,
  '/logistics/zones/check': () => ({ served: true, zone: zoneTable.zones[0], feeCents: 4500 }),
  '/ads/decisioning/serve': () => [
    { creativeId: 'cr-a1', campaignId: 'c-1042', slot: 'A1', sponsored: true, label: 'Sponsored', headline: 'Braai season', assetUrl: '/ads/a1.svg' },
  ],
  '/commerce/content': () => content,
  '/commerce/content/recipes': () => [recipe],
  '/commerce/content/recipes/potjie': () => recipe,
};

const server = http.createServer((req, res) => {
  const path = req.url.split('?')[0];
  const send = (code, body) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };

  if (routes[path]) return send(200, routes[path]());

  // A single item by SKU, and a single content entry by slug.
  const sku = path.match(/^\/commerce\/catalog\/(.+)$/);
  if (sku) {
    const item = catalogue.find((c) => c.sku === decodeURIComponent(sku[1]) || c.id === decodeURIComponent(sku[1]));
    return item ? send(200, item) : send(404, { message: 'no such item' });
  }
  const entry = path.match(/^\/commerce\/content\/([^/]+)$/);
  if (entry) {
    const found = content.find((c) => c.slug === decodeURIComponent(entry[1]));
    return found ? send(200, found) : send(404, { message: 'no such entry' });
  }

  send(404, { message: 'not found' });
});

const port = Number(process.env.STUB_PORT ?? 4602);
server.listen(port, () => console.log(`audit stub on ${port}`));
