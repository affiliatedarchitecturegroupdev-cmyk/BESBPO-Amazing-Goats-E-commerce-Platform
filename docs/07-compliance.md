# Compliance notes (summary, not legal advice)
Confirm with an attorney, the relevant departments and certifying bodies before launch.

| Area | Rule set | Platform impact |
|---|---|---|
| Meat | Meat Safety Act 40 of 2000 | Slaughter only at approved abattoirs; abattoir certificates on file |
| Poultry | Poultry regulations (R153 of 2006) | Registered poultry abattoirs only |
| Meat classification | R55 of 2015 | Class carried on trade documents |
| Raw processed meat | R2410 of 2022 and processed-meat rules | Co-packer compliance for boerewors, patties |
| Eggs | APS Act egg regulations (R345 of 2020) | Sorted, graded, marked, compliant pack station |
| Dairy | APS Act dairy regulations (R1510 of 2019 and amendments); milk and dairy regulations (R1555 of 1997) | Approved dairies only; do not repack |
| Produce | APS Act (vegetables R364 of 2013; fruit R631 of 2018) | Graded, packed, marked by supplier |
| Food premises | R638 of 2018 | Certificate of Acceptability, cold chain |
| Labels and advertising | R146 of 2010 and amendments | Applies to packs, website, social, ads; no therapeutic claims |
| Consumers | Consumer Protection Act 68 of 2008 | Returns, pricing, misleading claims |
| Personal data | POPIA | Consent, access logging, opt-in marketing |
| Credit | National Credit Act, FIC Act | Turnover declaration, penalty-interest caution |
| Animals | Animal Diseases Act, Stock Theft Act | Movement papers, proof of ownership |

Catalogue rows carry `product_compliance` (rule set, class or grade, packer, pack-station number, certificate expiry). Indigenous farm eggs stay on hold until a compliant pack station is arranged.

## Label generator

`services/commerce/src/compliance/label.ts` renders the R146 label for a pack as a pure function. Every label carries the same mandatory fields, and a rule set adds the ones it needs:

| Field | Required by |
|---|---|
| Product name, net weight, responsible party, country of origin, batch number, date marking, storage instructions | every label (R146) |
| Ingredient list | `processed_meat_copacker` |
| Class or grade | `meat_abattoir`, `poultry_abattoir`, `egg_pack_station` |
| Pack-station number | `egg_pack_station` |

`buildLabel` always renders the mandatory blocks; an unfilled one reads `[required: …]` rather than disappearing, so a preview never hides a gap, and `missing` lists what is outstanding. `GET /commerce/compliance/labels/:sku` previews a variant (product name, pack and net weight from the catalogue; rule set, class/grade, packer and pack station from `product_compliance`), and `GET /commerce/compliance/labels/incomplete` returns every variant with a static gap — the class/grade and pack-station fields a rule set still needs. Batch and date marking are per-pack and filled at packing time, so they are not part of the gap report.

A label is valid only when `missing` is empty. A lapsed `certificate_expiry` is reported separately as `certificateExpired`. The generator summarises the regulation; confirm the final wording with an attorney.

