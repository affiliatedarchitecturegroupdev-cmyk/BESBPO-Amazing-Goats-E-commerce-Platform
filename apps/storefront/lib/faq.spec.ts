import { describe, expect, it } from 'vitest';
import { FAQ_GROUPS, faqEntries, faqGroup } from './faq';

describe('FAQ_GROUPS', () => {
  it('covers the five groups the card asks for', () => {
    expect(FAQ_GROUPS.map((g) => g.id)).toEqual([
      'delivery',
      'payment',
      'returns',
      'halaal',
      'storage',
    ]);
  });

  it('has a unique id and title per group, so an anchor is unambiguous', () => {
    const ids = FAQ_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of FAQ_GROUPS) expect(g.title.trim().length).toBeGreaterThan(0);
  });

  it('gives every entry a question and a real answer', () => {
    for (const group of FAQ_GROUPS) {
      expect(group.entries.length).toBeGreaterThan(0);
      for (const e of group.entries) {
        expect(e.question.trim().length).toBeGreaterThan(0);
        // A one-word answer is not an answer; the FAQPage markup would be
        // rejected as low quality.
        expect(e.answer.trim().length).toBeGreaterThan(40);
      }
    }
  });

  it('does not repeat a question, which would be two answers to one query', () => {
    const questions = faqEntries().map((e) => e.question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it('links each answer to a page that exists', () => {
    const known = new Set([
      '/delivery',
      '/terms',
      '/returns',
      '/contact',
      '/trade',
      '/faq',
    ]);
    for (const group of FAQ_GROUPS) {
      for (const e of group.entries) {
        if (e.href) expect(known.has(e.href)).toBe(true);
      }
    }
  });

  it('answers the delivery cut-off question with the cut-off, not a made-up time', () => {
    const entry = faqEntries().find((e) => e.question.includes('close'));
    expect(entry?.answer).toContain('cut-off');
    // The weekly cycle decides the time; a hard-coded hour would go stale.
    expect(entry?.answer).not.toMatch(/\b\d{1,2}(am|pm|:\d\d)\b/i);
  });

  it('does not promote a policy placeholder into a published promise', () => {
    // The returns policy carries draft numbers as `[10] days`; the FAQ must not
    // silently turn those into a commitment.
    for (const e of faqEntries()) {
      expect(e.answer).not.toMatch(/\[\d+\]/);
    }
  });
});

describe('faqEntries', () => {
  it('flattens every group into the shape faqJsonLd wants', () => {
    const total = FAQ_GROUPS.reduce((n, g) => n + g.entries.length, 0);
    const flat = faqEntries();
    expect(flat).toHaveLength(total);
    for (const e of flat) expect(Object.keys(e).sort()).toEqual(['answer', 'question']);
  });

  it('accepts an explicit group list, so a test can use a fixture', () => {
    expect(
      faqEntries([{ id: 'x', title: 'X', entries: [{ question: 'q', answer: 'a' }] }]),
    ).toEqual([{ question: 'q', answer: 'a' }]);
  });
});

describe('faqGroup', () => {
  it('finds a group by anchor id', () => {
    expect(faqGroup('returns')?.title).toBe('Returns and refunds');
  });

  it('returns undefined for an unknown id rather than throwing', () => {
    expect(faqGroup('nope')).toBeUndefined();
  });
});
