---
id: T-076
title: Commerce: allergen and nutrition data model and display
phase: 6
agent: backend
gate: gate:legal
files: ["services/commerce/src/**", "db/migrations/**", "apps/storefront/**"]
---
## Goal
Allergen disclosure is a legal requirement for pre-packed food, not a nice-to-have, and
the platform has none. `product_compliance` already carries the rule set, class/grade,
packer and pack-station number for the R146 label (`docs/07-compliance.md`), but an
allergen list is not part of it, and no page shows one.

This is the one card in phase 6 that is compliance rather than competition. It should
not slip.

## Acceptance
- [ ] Migration adds `catalog.product_allergens (variant_id, allergen, presence in contains|may_contain, source)` with the 14 declared allergens as an enum or a checked list
- [ ] Migration adds `catalog.product_nutrition (variant_id, per 100g: energy_kj, protein_g, fat_g, saturated_fat_g, carbohydrate_g, sugar_g, sodium_mg)` — nullable, because a supplier may not declare it
- [ ] `GET /commerce/catalog/variants/:id/allergens` and `/nutrition`
- [ ] The label generator (`services/commerce/src/compliance/label.ts`) includes allergens when the rule set requires them, and `missing` lists an undeclared allergen set rather than assuming none
- [ ] Product page shows a clear allergen block: "Contains: …", "May contain: …", and an explicit "Not declared by supplier" state that is visibly different from "none"
- [ ] Nutrition table rendered when declared; omitted entirely (not shown as zeros) when not
- [ ] `GET /commerce/compliance/allergens/incomplete` lists variants with no allergen record, as a staff work queue
- [ ] Tests added and passing: label inclusion, missing-vs-none distinction, incomplete report

## Notes
Gate is `gate:legal`: the wording and the completeness expectation must be confirmed
by a person against R146 of 2010 and the relevant product regulations. Do not ship
allergen copy without that approval.

The distinction between "declared none" and "not declared" is the whole point. Rendering
both as an empty list would be a false statement about a food product.
