import type { PolicyDocument } from './versioning';

/**
 * The legal and consumer-information documents shown to shoppers (T-060).
 *
 * These are **drafts**, written to be complete and internally consistent so that
 * a person can review them, fill in the marked company inputs, and approve them.
 * They are not legal advice. Every bracketed `[…]` is an input only the company
 * can supply (registration numbers, addresses, contact details, retention
 * periods it has actually adopted), and every page carries a note to that effect
 * so nobody mistakes a draft for an approved policy.
 *
 * The facts here are taken from the repository, not invented:
 *
 * - VAT at 15%, prices exclude VAT until display (`AGENTS.md`, `docs/00-overview.md`)
 * - the weekly cut-off model and the rule that perishables cannot be cancelled
 *   after cut-off (`docs/04-cutoff-engine.md`, `services/commerce/src/cycles/cutoff.ts`)
 * - pay-by-bank discount, escrow from R10,000 (`apps/storefront/lib/payments.ts`)
 * - audit and personal-data access logging that is append-only
 *   (`db/migrations/0001_extensions_audit.sql`)
 * - the rules named in `docs/07-compliance.md` (CPA, POPIA, R146, Meat Safety Act)
 *
 * Versioning is what makes the drafts safe to publish: the first version is v1,
 * and the company's edits become v2 with a change note, visible in the history.
 */

const DRAFT_NOTE =
  'This is a working draft prepared for review. Items in square brackets need company input before it is final.';

/** `privacy` — the POPIA privacy notice. */
export const PRIVACY: PolicyDocument = {
  slug: 'privacy',
  title: 'Privacy notice',
  summary: 'What personal information we collect, why, how long we keep it, and your rights under POPIA.',
  versions: [
    {
      version: 1,
      effectiveFrom: '2026-11-14',
      changeNote: 'First published version.',
      approvedBy: 'Pending legal review',
      sections: [
        {
          heading: 'Who we are',
          paragraphs: [
            'Amazing Goats (Ezimbuzini) is a specialised agricultural division of Besbpo Group. We sell meat, eggs, dairy and produce, and we deliver it on a weekly cycle.',
            'For the purposes of the Protection of Personal Information Act 4 of 2013 (POPIA), we are the responsible party for the personal information described here.',
            `Registered name: [company registered name]. Registration number: [registration number]. Information officer: [name], [email], [phone]. ${DRAFT_NOTE}`,
          ],
        },
        {
          heading: 'What we collect',
          paragraphs: ['We collect only what we need to sell you food and deliver it.'],
          bullets: [
            'To create an order: your name, mobile number, email address and delivery address.',
            'To take payment: the payment method and the reference the payment provider returns. We do not store your full card number; the provider handles it.',
            'To deliver: the delivery address, the slot you chose and, on the day, proof of delivery such as a signature or a photograph.',
            'To run a trade account: your business details, VAT number, a turnover declaration and the documents you upload for an application.',
            'To keep the site working: technical information such as your IP address and the pages you requested.',
            'If you contact us: the contents of your message, so we can answer it.',
          ],
        },
        {
          heading: 'Why we use it, and our lawful basis',
          paragraphs: [
            'POPIA requires a lawful basis for each purpose. Ours are:',
          ],
          bullets: [
            'To perform our contract with you — taking, packing and delivering your order, and handling a return. Without this information we cannot sell you food.',
            'To comply with a legal obligation — tax records, food-safety and traceability records, and the retention the law requires.',
            'With your consent — marketing by email or WhatsApp. You opt in, and you can opt out at any time. An order you place is not marketing.',
            'For our legitimate interest — preventing fraud, keeping the site secure, and understanding which pages fail. We weigh this against your rights and keep the data to the minimum.',
          ],
        },
        {
          heading: 'Who we share it with',
          paragraphs: [
            'We share personal information only where it is needed to fulfil your order or where the law requires it.',
          ],
          bullets: [
            'Delivery partners and drivers, who receive the name, address and contact number for a delivery.',
            'Payment providers, who process the payment.',
            'Our abattoirs, farms and co-packers, where a traceability record needs it.',
            'Our hosting and analytics providers. Analytics runs in the European Union, so some technical data is processed outside South Africa (see below).',
            'A regulator or a court, where the law compels us.',
          ],
        },
        {
          heading: 'Sending information outside South Africa',
          paragraphs: [
            'POPIA section 72 allows a transfer outside South Africa only if the recipient is subject to a law, binding agreement or corporate rule that gives comparable protection, or if you consent.',
            'Our core platform runs in South Africa. Analytics runs in the European Union, which has comparable data-protection law. Where a transfer needs your consent, we ask for it, and you may refuse.',
          ],
        },
        {
          heading: 'How long we keep it',
          paragraphs: [
            'We keep personal information only as long as we need it, and then delete or de-identify it.',
          ],
          bullets: [
            'Order and invoice records: [7 years], because tax law requires it.',
            'Food traceability records: [as long as the food-safety rules require].',
            'Trade applications that are declined: [12 months], then deleted.',
            'Marketing consent: until you withdraw it, plus a short record of the withdrawal.',
            'Site logs: [90 days].',
          ],
        },
        {
          heading: 'Your rights',
          paragraphs: [
            'Under POPIA you have the right to be told whether we hold your personal information, and to ask for a copy of it. You may ask us to correct or delete information that is wrong, out of date or that we no longer have a reason to keep. You may object to processing based on our legitimate interest, and you may withdraw marketing consent at any time.',
            'To exercise a right, email our information officer at [email]. We answer within 30 days. We may ask you to prove who you are first, so that we do not hand your information to someone else.',
            'If you are unhappy with our answer, you may complain to the Information Regulator of South Africa at [Information Regulator contact details].',
          ],
        },
        {
          heading: 'How we keep it safe',
          paragraphs: [
            'Access to personal information is limited to the staff and partners who need it for their work, and every access to personal information is recorded in an append-only audit log that cannot be edited or deleted. We use encryption in transit, and we do not put a secret or a payment credential in a page that reaches your browser.',
            'If a security compromise affects your personal information, we notify you and the Information Regulator as POPIA requires.',
          ],
        },
        {
          heading: 'Cookies',
          paragraphs: [
            'We use a small number of cookies. The cookie notice explains each one; the short version is that we use a session cookie to keep you signed in and, where you agree, analytics cookies.',
          ],
        },
      ],
    },
  ],
};

/** `terms` — the terms of sale, including the CPA rights. */
export const TERMS: PolicyDocument = {
  slug: 'terms',
  title: 'Terms of sale',
  summary: 'How ordering, pricing, cut-off, delivery, cancellation and returns work.',
  versions: [
    {
      version: 1,
      effectiveFrom: '2026-11-14',
      changeNote: 'First published version.',
      approvedBy: 'Pending legal review',
      sections: [
        {
          heading: 'These terms',
          paragraphs: [
            'These terms apply when you buy from Amazing Goats (Ezimbuzini). They sit alongside your rights under the Consumer Protection Act 68 of 2008 (CPA), which apply in full and which nothing here takes away.',
            `Company: [registered name], registration number [registration number], [physical address]. ${DRAFT_NOTE}`,
          ],
        },
        {
          heading: 'Prices and VAT',
          paragraphs: [
            'Prices on product pages exclude VAT unless the page says otherwise. VAT at 15% is added at checkout, and the total you pay, including VAT and delivery, is shown before you pay.',
            'We may change prices, but a change never applies to an order you have already placed and paid for.',
            'If a price is shown wrongly and the error is obvious — for example a R1,000 box listed at R10 — we may cancel the order and refund you in full rather than hold you to it.',
          ],
        },
        {
          heading: 'How ordering works: the weekly cut-off',
          paragraphs: [
            'We sell chilled meat, eggs, dairy and produce on a weekly cycle, because we buy and slaughter to order. Each product shows its cut-off.',
          ],
          bullets: [
            'Chilled meat and boxes: public orders close Sunday at 17:00. Slaughter is on Monday, and delivery runs Wednesday to Friday.',
            'Eggs, dairy and produce: orders close 48 hours before your route day.',
            'Ambient goods: orders close at 15:00 on the next working day.',
            'Live animals: by arrangement, with 48 hours notice.',
          ],
        },
        {
          heading: 'Changing or cancelling an order',
          paragraphs: [
            'You may change or cancel an order free of charge until its cut-off. After the cut-off we have already bought and slaughtered to your order, so a perishable item cannot be cancelled. This is the one place the weekly model limits your usual right to cancel, and we say so before you pay.',
            'A non-perishable item that has not been dispatched may still be cancelled after cut-off; contact us and we will confirm.',
            'If we cancel your order — because stock is short, a route is full or a payment fails — we refund you in full within [10] business days.',
          ],
        },
        {
          heading: 'Delivery',
          paragraphs: [
            'Delivery fees depend on your zone and are shown at checkout. Route days differ by area, and a slot is a window, not an exact time.',
            'Someone must be available to receive chilled goods. If nobody is there, we may not be able to leave perishable items, and a re-delivery fee may apply.',
            'Risk passes to you on delivery. Ownership passes when we have received payment in full.',
          ],
        },
        {
          heading: 'Returns and refunds',
          paragraphs: [
            'Food is perishable, so the returns policy is narrower than for other goods — but your CPA rights are not affected. The returns policy sets out exactly what you may return and how. In short:',
          ],
          bullets: [
            'If the food is spoiled, damaged or not what you ordered, tell us within 24 hours of delivery and we will replace it or refund it in full.',
            'If the order is simply not what you wanted, a non-perishable item may be returned unused within [10] days of delivery.',
            'Refunds go back to the method you paid with.',
          ],
        },
        {
          heading: 'Your right to cancel under the CPA',
          paragraphs: [
            'The CPA gives you a right to cancel a fixed-term agreement and, in some cases, a cooling-off right. Because our sales are one-off purchases of food rather than fixed-term agreements, the general cancellation rules in these terms are what apply, together with the perishable-goods limit above.',
            'Nothing in these terms limits a right you have under the CPA, the Foodstuffs, Cosmetics and Disinfectants Act, or the Agricultural Product Standards Act.',
          ],
        },
        {
          heading: 'Trade accounts',
          paragraphs: [
            'A trade account is a separate agreement. Trade orders may be placed on account within an approved credit limit, with payment terms set when the account is approved. Interest may be charged on an overdue account, at the rate the National Credit Act allows, and we will warn you before charging it.',
            'We may suspend a trade account for non-payment.',
          ],
        },
        {
          heading: 'Our responsibility',
          paragraphs: [
            'We are responsible for loss you suffer that is a foreseeable result of our breaking these terms or failing to use reasonable care. We are not responsible for loss that was not foreseeable, or for a business loss such as lost profit on a trade account, except where the law says otherwise.',
            'We do not exclude liability for death or personal injury caused by our negligence, for fraud, or for anything else the CPA or another law does not allow us to exclude.',
          ],
        },
        {
          heading: 'Complaints and governing law',
          paragraphs: [
            'If something goes wrong, contact us first at [email] or [phone]; most problems are fixed the same day.',
            'These terms are governed by South African law, and the Consumer Goods and Services Ombud is available if we cannot resolve a complaint. The National Consumer Commission also accepts complaints.',
          ],
        },
      ],
    },
  ],
};

/** `cookies` — the cookie notice. */
export const COOKIES: PolicyDocument = {
  slug: 'cookies',
  title: 'Cookie notice',
  summary: 'The cookies we set, what each one does, and how to refuse the optional ones.',
  versions: [
    {
      version: 1,
      effectiveFrom: '2026-11-14',
      changeNote: 'First published version.',
      approvedBy: 'Pending legal review',
      sections: [
        {
          heading: 'What a cookie is',
          paragraphs: [
            'A cookie is a small file a site stores in your browser. Some are essential — without them the site cannot keep you signed in or remember your cart. Others are optional.',
          ],
        },
        {
          heading: 'The cookies we set',
          paragraphs: ['This is the complete list. If we add one, this page changes and the change is recorded in the history.'],
          bullets: [
            'ag_session — essential. Keeps you signed in. It is httpOnly, so page scripts cannot read it, and it expires when your session ends.',
            'ag_cart — essential. Remembers what is in your cart between pages.',
            'ag_consent — essential. Remembers which optional cookies you allowed, so we do not ask on every page.',
            'Analytics — optional. [Name the analytics product and what it records.] We only set these if you agree.',
          ],
        },
        {
          heading: 'Refusing optional cookies',
          paragraphs: [
            'You can refuse the optional cookies and still use the whole site. [Describe where the choice is offered.] You can also delete cookies in your browser settings and block them for this site, though blocking the essential ones will stop sign-in and the cart from working.',
          ],
        },
        {
          heading: 'Third parties',
          paragraphs: [
            'Our payment providers may set their own cookies during checkout, on their own pages, under their own notices. We do not control those.',
          ],
        },
      ],
    },
  ],
};

/** `returns` — the returns and refunds policy. */
export const RETURNS: PolicyDocument = {
  slug: 'returns',
  title: 'Returns and refunds',
  summary: 'What to do if something is wrong, and how a refund works.',
  versions: [
    {
      version: 1,
      effectiveFrom: '2026-11-14',
      changeNote: 'First published version.',
      approvedBy: 'Pending legal review',
      sections: [
        {
          heading: 'If something is wrong',
          paragraphs: [
            'Tell us within 24 hours of delivery. Photograph the item if you can, and keep it until we have answered. We will replace it on the next route or refund it in full — your choice.',
            'This covers food that is spoiled, damaged, short-weighted or not what you ordered. It does not matter whether the fault is ours or our supplier’s; it is ours to fix.',
          ],
        },
        {
          heading: 'Changing your mind',
          paragraphs: [
            'Chilled meat, dairy, produce and eggs are perishable, so they cannot be returned because you changed your mind — we bought and slaughtered them for your order. This is why the cut-off exists: you may cancel free of charge until then.',
            'A non-perishable item — biltong, ambient goods, a gift — may be returned unused, in its packaging, within [10] days of delivery.',
          ],
        },
        {
          heading: 'How a refund is paid',
          paragraphs: [
            'A refund goes back to the method you paid with. A card refund appears on your statement within [10] business days; the exact timing is your bank’s. Where you paid by bank transfer, we ask for the account to refund to.',
            'A refund above [amount] needs a second approver inside our company before it is paid. That is an internal control, and it does not delay your right to the refund.',
          ],
        },
        {
          heading: 'Delivery fees',
          paragraphs: [
            'If the whole order is faulty, we refund the delivery fee too. If only part of it is, we refund the item and keep the fee, because the delivery still happened.',
          ],
        },
        {
          heading: 'If we cancel',
          paragraphs: [
            'If we cancel an order — stock short, route full, payment failed — we refund everything you paid, including the delivery fee, within [10] business days.',
          ],
        },
        {
          heading: 'Your other rights',
          paragraphs: [
            'This policy sits alongside the Consumer Protection Act 68 of 2008, which gives you rights that nothing here reduces. The terms of sale explain how they apply.',
          ],
        },
      ],
    },
  ],
};

/** `contact` — contact details and trading hours. */
export const CONTACT: PolicyDocument = {
  slug: 'contact',
  title: 'Contact us',
  summary: 'How to reach Amazing Goats, and when we answer.',
  versions: [
    {
      version: 1,
      effectiveFrom: '2026-11-14',
      changeNote: 'First published version.',
      approvedBy: 'Pending legal review',
      sections: [
        {
          heading: 'Reach us',
          paragraphs: [`${DRAFT_NOTE}`],
          bullets: [
            'Orders and delivery: [phone] · [email]',
            'Trade accounts: [phone] · [email]',
            'Privacy and personal information: [information officer email]',
            'Complaints: [email]',
          ],
        },
        {
          heading: 'Where we are',
          paragraphs: [
            'Physical address: [street address, suburb, city, postal code].',
            'Our farm and packing facility are not a shop; visits are by appointment. Live goats and indigenous chickens are sold on the farm by arrangement.',
          ],
        },
        {
          heading: 'Trading hours',
          paragraphs: ['Times are South African standard time.'],
          bullets: [
            'Orders: online all day. The cut-off is what matters, not the hour you order.',
            'Phone and WhatsApp: Monday to Friday, 08:00 to 17:00; Saturday, 08:00 to 13:00.',
            'Deliveries: Wednesday to Friday, 06:00 to 18:00, by route.',
            'Public holidays: no deliveries; the cycle shifts and the new date is shown on your order.',
          ],
        },
        {
          heading: 'The company',
          paragraphs: [
            'Amazing Goats (Ezimbuzini) is a specialised agricultural division of Besbpo Group. [Link to the corporate site.]',
          ],
        },
      ],
    },
  ],
};

/** `about` — who we are and how the model works. */
export const ABOUT: PolicyDocument = {
  slug: 'about',
  title: 'About Amazing Goats',
  summary: 'A farm-direct model: we buy to order, slaughter to order, and deliver on a weekly cycle.',
  versions: [
    {
      version: 1,
      effectiveFrom: '2026-11-14',
      changeNote: 'First published version.',
      approvedBy: 'Pending legal review',
      sections: [
        {
          heading: 'Who we are',
          paragraphs: [
            'Amazing Goats (Ezimbuzini) is a specialised agricultural division of Besbpo Group. We sell lamb, chicken, eggs, beef, offal, sausages, biltong, dairy and produce, and we work with partner farms, abattoirs and co-packers rather than pretending to be all of them.',
            'Lamb is our flagship. Live goats and indigenous chickens are sold on the farm.',
          ],
        },
        {
          heading: 'Why we work to a weekly cycle',
          paragraphs: [
            'Most food sites sell stock they already hold. We buy and slaughter to order, on a weekly cycle, because it is the only honest way to sell chilled meat that is genuinely fresh. That is why orders close on a cut-off and delivery runs on fixed route days.',
            'It also means less waste and a fairer price for the farm, because nothing is killed for a shelf.',
          ],
        },
        {
          heading: 'How we keep it safe',
          paragraphs: [
            'We slaughter only at approved abattoirs, and we buy eggs only from a compliant pack station. Every batch carries a traceability record, cold-chain readings are logged on the route, and a label carries the fields the labelling rules require.',
            'If a batch has a problem, we can trace it to the farm and the delivery, and recall it. The recall process is real, not a paragraph on a page.',
          ],
        },
        {
          heading: 'For business',
          paragraphs: [
            'Bakeries, caterers, butchers, restaurants and retailers buy on a trade account, with trade prices, standing orders and credit terms. Apply through the trade portal.',
          ],
        },
        {
          heading: 'The group',
          paragraphs: [
            'Amazing Goats is part of Besbpo Group. [Link to the corporate site for the group’s other work.]',
          ],
        },
      ],
    },
  ],
};

/** Every policy, in the order the footer lists them. */
export const POLICIES: PolicyDocument[] = [ABOUT, TERMS, RETURNS, PRIVACY, COOKIES, CONTACT];

/** Lookup by slug. */
export function policyBySlug(slug: string): PolicyDocument | undefined {
  return POLICIES.find((p) => p.slug === slug);
}
