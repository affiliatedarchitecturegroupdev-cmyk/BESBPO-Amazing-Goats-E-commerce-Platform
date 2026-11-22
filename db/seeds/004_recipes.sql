-- Recipe seed (T-072). Three recipes that answer the questions this catalogue
-- creates: what to do with a potjie neck pack, how to braai rib chops without
-- drying them, and how to get a bone-in shoulder to fall off the bone.
--
-- Published, not drafts: `/recipes` is a public route in the sitemap, and an
-- empty list on a fresh database would make it a page with nothing to index.
-- Product links are resolved by SKU, so this seed does not depend on the
-- generated UUIDs in `catalog.variants`.
--
-- Every quantity below is a cooking instruction, not a catalogue quantity, which
-- is why they are free text in `ingredients` (see migration 0024).

BEGIN;

INSERT INTO catalog.content
  (id, kind, slug, title, summary, body_md, status, published_at, taxonomy,
   seo_title, seo_description)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'recipe',
    'lamb-potjie',
    'Lamb potjie',
    'A three-hour potjie over coals: lamb neck, root vegetables and a slow build. The dish a Sunday is for.',
    E'A potjie is not a stew that happens quickly. The neck needs time and low heat, and the layers go in the order they cook.\n\n## The pot\n\nA number 3 cast-iron pot feeds four generously. Season it before the first use and never wash it with soap.\n\n## The coals\n\nYou want a bed of coals, not flames. If the pot is too hot to hold a hand against for two seconds, it is too hot.',
    'published',
    now() - interval '3 days',
    ARRAY['lamb', 'potjie', 'winter'],
    'Lamb potjie recipe',
    'How to build a lamb neck potjie over coals, layer by layer, in about three hours.'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'recipe',
    'braai-rib-chops',
    'Braai rib chops',
    'Twenty minutes, a hot fire and salt. Rib chops are the cut that rewards doing very little.',
    E'Rib chops are thin and fatty, which means they cook fast and forgive nothing. High heat, short time, rest before serving.\n\n## The fire\n\nBuild the fire 40 minutes before you cook. You want grey coals and no flame. Hold your hand at grill height: two seconds is right for chops.\n\n## The salt\n\nSalt 30 minutes ahead, not at the fire. Salt drawn in early stays in the meat; salt added late sits on the surface and burns.',
    'published',
    now() - interval '2 days',
    ARRAY['lamb', 'braai', 'chops'],
    'Braai rib chops recipe',
    'A hot-fire method for lamb rib chops: 20 minutes, coarse salt, and a rest before serving.'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'recipe',
    'slow-roast-lamb-shoulder',
    'Slow-roast lamb shoulder',
    'Bone-in shoulder, four hours at 150C, uncovered at the end. The cut that falls apart under a fork.',
    E'Shoulder is the most forgiving cut on the animal, provided you give it time. Four hours at 150C and it will pull away from the bone without a knife.\n\n## Why bone-in\n\nThe bone conducts heat into the middle of the joint and keeps it moist. A boned and rolled shoulder cooks faster but dries out sooner.\n\n## The finish\n\nThe last 20 minutes uncovered at 200C is what gives the crust. Do not skip it, and do not walk away from it.',
    'published',
    now() - interval '1 day',
    ARRAY['lamb', 'roast', 'sunday'],
    'Slow-roast lamb shoulder recipe',
    'Bone-in lamb shoulder roasted low for four hours, then finished hot for a crust. Serves six.'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.content_recipes
  (content_id, servings, prep_minutes, cook_minutes, ingredients, steps)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    4, 30, 180,
    '[
      {"quantity": "1 kg", "item": "lamb neck", "note": "cut into 4 cm pieces"},
      {"quantity": "2 tbsp", "item": "sunflower oil"},
      {"quantity": "2", "item": "onions", "note": "roughly chopped"},
      {"quantity": "4", "item": "garlic cloves", "note": "bruised"},
      {"quantity": "4", "item": "carrots", "note": "cut into thick rounds"},
      {"quantity": "500 g", "item": "baby potatoes", "note": "halved"},
      {"quantity": "2 tbsp", "item": "tomato paste"},
      {"quantity": "500 ml", "item": "beef stock"},
      {"quantity": "2", "item": "bay leaves"},
      {"quantity": "to taste", "item": "salt and black pepper"}
    ]'::jsonb,
    '[
      {"text": "Heat the oil in the pot over a bed of coals until it shimmers."},
      {"text": "Brown the neck in batches, giving each piece room. Crowding the pot steams the meat instead of browning it."},
      {"text": "Set the meat aside. Soften the onions in the same pot, then add the garlic and cook for a minute more."},
      {"text": "Stir in the tomato paste and cook it out until it darkens, about two minutes."},
      {"text": "Return the meat, add the stock and bay leaves, and bring to a bare simmer."},
      {"text": "Put the lid on and leave it for two hours. Add coals in small batches to keep the pot at a gentle simmer."},
      {"text": "Add the carrots and potatoes and cook for another 45 minutes, until the meat pulls from the bone."},
      {"text": "Season, rest for ten minutes off the heat, and serve with rice or samp."}
    ]'::jsonb
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    4, 10, 20,
    '[
      {"quantity": "800 g", "item": "lamb rib chops", "note": "about 8 chops"},
      {"quantity": "2 tsp", "item": "coarse salt"},
      {"quantity": "1 tsp", "item": "coarse black pepper"},
      {"quantity": "1", "item": "lemon", "note": "cut into wedges, to serve"}
    ]'::jsonb,
    '[
      {"text": "Salt the chops on both sides 30 minutes before cooking and leave them out of the fridge."},
      {"text": "Build a hot fire and wait for the flames to die down to grey coals."},
      {"text": "Grill the chops four minutes a side. Do not press them down; that squeezes out the fat that keeps them juicy."},
      {"text": "Stand the chops on their fat edge for a minute to render, then take them off."},
      {"text": "Rest for five minutes under foil, season with pepper, and serve with lemon wedges."}
    ]'::jsonb
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    6, 20, 240,
    '[
      {"quantity": "1", "item": "bone-in lamb shoulder", "note": "about 2 kg"},
      {"quantity": "2 tbsp", "item": "olive oil"},
      {"quantity": "6", "item": "garlic cloves", "note": "sliced"},
      {"quantity": "4 sprigs", "item": "rosemary"},
      {"quantity": "2", "item": "onions", "note": "thickly sliced"},
      {"quantity": "250 ml", "item": "white wine"},
      {"quantity": "2 tsp", "item": "coarse salt"}
    ]'::jsonb,
    '[
      {"text": "Heat the oven to 150C."},
      {"text": "Make small cuts all over the shoulder and push in the garlic slices and rosemary leaves."},
      {"text": "Rub the joint with oil and salt and set it on a bed of sliced onion in a roasting tray."},
      {"text": "Pour the wine into the tray, cover tightly with foil, and roast for three and a half hours."},
      {"text": "Remove the foil, raise the oven to 200C, and roast for 20 minutes to crisp the surface."},
      {"text": "Rest for 20 minutes before pulling the meat apart with two forks."}
    ]'::jsonb
  )
ON CONFLICT (content_id) DO NOTHING;

-- The products each recipe is about. A SKU that is not in this database is
-- skipped rather than failing the seed, so a partial catalogue import still
-- yields usable recipes.
INSERT INTO catalog.content_products (content_id, variant_id)
SELECT r.content_id, v.id
FROM (VALUES
  ('11111111-1111-4111-8111-111111111111'::uuid, 'AG-LB-010'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'AG-LB-008'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'AG-LB-006')
) AS r(content_id, sku)
JOIN catalog.variants v ON v.sku = r.sku
ON CONFLICT DO NOTHING;

COMMIT;
