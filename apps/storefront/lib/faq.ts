/**
 * The FAQ (T-077), grouped by the five things a shopper actually asks about.
 *
 * Every answer here restates something the platform already commits to in a
 * policy document (`@ag/policy`): the returns window, the cut-off, the cold
 * chain, the halaal position. That matters twice over — a shopper who reads the
 * FAQ and the policy must not get two answers, and the assistant and `FAQPage`
 * markup both draw from this file, so an invented answer would be quoted back
 * with authority it has not earned.
 *
 * Where a policy carries a placeholder (`[10] days`), the FAQ says the same
 * thing in plain words and links to the policy, rather than quietly promoting a
 * draft number into a published promise.
 */

export interface FaqEntry {
  question: string;
  answer: string;
  /** The page that carries the full, binding version of this answer. */
  href?: string;
}

export interface FaqGroup {
  /** Stable id, used as the anchor and as a React key. */
  id: string;
  title: string;
  entries: FaqEntry[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'delivery',
    title: 'Delivery',
    entries: [
      {
        question: 'Where do you deliver?',
        answer:
          'Across KwaZulu-Natal, on fixed weekly route days rather than on demand. Each area is served on its own day, so the delivery day for your address is decided by your zone.',
        href: '/delivery',
      },
      {
        question: 'When does my order close for this week’s delivery?',
        answer:
          'Orders close at the cut-off shown on the delivery page. Until the cut-off you may change or cancel your order free of charge; after it, the animals have been bought and slaughtered for your order, so it can no longer be cancelled that way.',
        href: '/delivery',
      },
      {
        question: 'How is chilled and frozen meat kept cold in transit?',
        answer:
          'Chilled and frozen goods travel in insulated, branded boxes, packed to hold temperature for the route. Cold-chain goods are kept separate from ambient goods, and the pack carries the storage instruction and a use-by date.',
        href: '/delivery',
      },
      {
        question: 'Do you deliver to my area, and what will it cost?',
        answer:
          'Use the area checker on the delivery page: enter your suburb and it tells you whether your zone is served, on which day, and what the delivery fee is before you reach checkout.',
        href: '/delivery',
      },
    ],
  },
  {
    id: 'payment',
    title: 'Payment',
    entries: [
      {
        question: 'What payment methods do you accept?',
        answer:
          'Card, instant bank transfer and a trade account for approved business buyers. Prices are shown excluding VAT in the catalogue and the VAT is shown at checkout, so the amount you pay is never a surprise.',
        href: '/terms',
      },
      {
        question: 'Why do prices exclude VAT?',
        answer:
          'The catalogue quotes prices excluding VAT because most of our buyers are trade buyers who reclaim it. The VAT is added and shown as its own line at checkout, before you pay.',
        href: '/terms',
      },
      {
        question: 'Can I open a trade account?',
        answer:
          'Yes. Trade buyers apply through the trade page, and an approved account is given terms and a credit limit. Applications are assessed on the credit policy, and a first order may need to be paid up front while the account is set up.',
        href: '/trade',
      },
    ],
  },
  {
    id: 'returns',
    title: 'Returns and refunds',
    entries: [
      {
        question: 'Something is wrong with my order. What do I do?',
        answer:
          'Tell us within 24 hours of delivery. Photograph the item if you can and keep it until we have answered. We will replace it on the next route or refund it in full — your choice. This covers food that is spoiled, damaged, short-weighted or not what you ordered, and it does not matter whether the fault was ours or a supplier’s.',
        href: '/returns',
      },
      {
        question: 'Can I return chilled meat because I changed my mind?',
        answer:
          'No. Chilled meat, dairy, produce and eggs are perishable and were bought and slaughtered for your order, so they cannot be returned for a change of mind. That is what the cut-off is for: you may cancel free of charge until it passes. A non-perishable item — biltong, ambient goods, a gift — may be returned unused, in its packaging, within the returns window.',
        href: '/returns',
      },
      {
        question: 'How and when is a refund paid?',
        answer:
          'A refund goes back to the method you paid with. A card refund appears on your statement within the period your bank takes to post it; where you paid by bank transfer we ask for the account to refund to. If the whole order was faulty we refund the delivery fee too; if only part was, we refund the item and keep the fee, because the delivery still happened.',
        href: '/returns',
      },
      {
        question: 'What if you cancel my order?',
        answer:
          'If we cancel — stock short, route full, payment failed — we refund everything you paid, including the delivery fee.',
        href: '/returns',
      },
    ],
  },
  {
    id: 'halaal',
    title: 'Halaal',
    entries: [
      {
        question: 'Is your meat halaal?',
        answer:
          'Halaal availability is shown per item in the catalogue rather than claimed for the whole range, because it depends on the abattoir and the batch. An item that is not marked halaal available should be treated as not halaal. If you need a halaal item for a specific date, ask us before you order.',
        href: '/contact',
      },
    ],
  },
  {
    id: 'storage',
    title: 'Storage',
    entries: [
      {
        question: 'How should I store my order when it arrives?',
        answer:
          'Chilled goods should go straight into a fridge at 0 to 4°C, or into a freezer if you will not use them within the use-by date on the pack. Frozen goods should stay frozen. The pack carries the use-by date; the cold chain is only as good as the last step, so unpack promptly.',
        href: '/delivery',
      },
      {
        question: 'How long will the meat keep?',
        answer:
          'The use-by date on the pack is the answer for that batch — it is set from the slaughter and packing date, not from delivery. Freezing on arrival extends it, but do not re-freeze meat that has already been thawed.',
      },
    ],
  },
];

/**
 * Every entry as a flat list, which is the shape `faqJsonLd` and the assistant
 * both want. Groups keep the page readable; the markup does not need them.
 */
export function faqEntries(groups: FaqGroup[] = FAQ_GROUPS): { question: string; answer: string }[] {
  return groups.flatMap((g) => g.entries.map(({ question, answer }) => ({ question, answer })));
}

/** A group by id, for an anchor link. */
export function faqGroup(id: string, groups: FaqGroup[] = FAQ_GROUPS): FaqGroup | undefined {
  return groups.find((g) => g.id === id);
}
