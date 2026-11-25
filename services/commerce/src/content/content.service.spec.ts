import { describe, it, expect } from 'vitest';
import { ContentNotAllowedError, ContentService } from './content.service';
import { InMemoryContentStore } from './content.store';

const at = new Date('2026-03-01T08:00:00Z');

function setup() {
  const store = new InMemoryContentStore();
  return { store, service: new ContentService(store) };
}

describe('create', () => {
  it('creates a draft with a deterministic slug', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'recipe', title: 'How to cook goat curry' }, at);
    expect(item.status).toBe('draft');
    expect(item.slug).toBe('how-to-cook-goat-curry');
  });

  it('gives a colliding title a suffixed slug instead of failing', async () => {
    const { service } = setup();
    const first = await service.create({ kind: 'post', title: 'Lamb in Durban' }, at);
    const second = await service.create({ kind: 'post', title: 'Lamb in Durban' }, at);
    expect(first.slug).toBe('lamb-in-durban');
    expect(second.slug).toBe('lamb-in-durban-2');
  });

  it('links the products a guide is about', async () => {
    const { service } = setup();
    const item = await service.create(
      { kind: 'guide', title: 'Buying lamb', variantIds: ['v1', 'v2'] },
      at,
    );
    expect(item.variantIds).toEqual(['v1', 'v2']);
  });
});

describe('publish workflow', () => {
  it('an agent may move a draft to review', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'post', title: 'Draft' }, at);
    const reviewed = await service.publish(item.id, 'agent', at);
    expect(reviewed.status).toBe('review');
    expect(reviewed.publishedAt).toBeUndefined();
  });

  it('an agent may not publish from review', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'post', title: 'Draft' }, at);
    await service.publish(item.id, 'agent', at);
    await expect(service.publish(item.id, 'agent', at)).rejects.toThrow(ContentNotAllowedError);
  });

  it('a person publishes from review and stamps publishedAt', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'post', title: 'Draft' }, at);
    await service.publish(item.id, 'agent', at);
    const published = await service.publish(item.id, 'person', at);
    expect(published.status).toBe('published');
    expect(published.publishedAt).toBe(at.toISOString());
  });

  it('refuses to publish twice', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'post', title: 'Draft' }, at);
    await service.publish(item.id, 'person', at);
    await expect(service.publish(item.id, 'person', at)).rejects.toThrow('already published');
  });

  it('throws for an unknown id', async () => {
    const { service } = setup();
    await expect(service.publish('nope', 'person', at)).rejects.toThrow('no such content');
  });
});

describe('patch', () => {
  it('updates a draft and re-slugs when the title changes', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'post', title: 'Old title' }, at);
    const patched = await service.patch(item.id, { title: 'New title' }, at);
    expect(patched.slug).toBe('new-title');
  });

  it('keeps the slug when the title is unchanged', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'post', title: 'Same' }, at);
    const patched = await service.patch(item.id, { summary: 'x' }, at);
    expect(patched.slug).toBe(item.slug);
  });

  it('refuses to edit a published item in place', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'post', title: 'Live' }, at);
    await service.publish(item.id, 'person', at);
    await expect(service.patch(item.id, { title: 'Changed' }, at)).rejects.toThrow(
      'not edited in place',
    );
  });
});

describe('public reads', () => {
  async function withPublished() {
    const { service, store } = setup();
    const live = await service.create({ kind: 'recipe', title: 'Goat curry', taxonomy: ['goat'] }, at);
    await service.publish(live.id, 'person', at);
    const draft = await service.create({ kind: 'recipe', title: 'Secret draft' }, at);
    return { service, store, live, draft };
  }

  it('lists published items only', async () => {
    const { service, live, draft } = await withPublished();
    const list = await service.listPublished({});
    expect(list.map((i) => i.id)).toEqual([live.id]);
    expect(list.map((i) => i.id)).not.toContain(draft.id);
  });

  it('filters by kind', async () => {
    const { service } = await withPublished();
    expect(await service.listPublished({ kind: 'post' })).toEqual([]);
    expect((await service.listPublished({ kind: 'recipe' })).length).toBe(1);
  });

  it('filters by taxonomy', async () => {
    const { service } = await withPublished();
    expect((await service.listPublished({ taxonomy: ['goat'] })).length).toBe(1);
    expect((await service.listPublished({ taxonomy: ['beef'] })).length).toBe(0);
  });

  it('paginates', async () => {
    const { service } = setup();
    for (const title of ['One', 'Two', 'Three']) {
      const item = await service.create({ kind: 'post', title }, at);
      await service.publish(item.id, 'person', at);
    }
    const page = await service.listPublished({ limit: 2, offset: 1 });
    expect(page).toHaveLength(2);
  });

  it('returns one published item by slug, rendered and with SEO resolved', async () => {
    const { service } = await withPublished();
    const item = await service.getPublishedBySlug('goat-curry');
    expect(item.title).toBe('Goat curry');
    expect(item.seo.seoTitle).toBe('Goat curry');
  });

  it('renders the body to HTML', async () => {
    const { service } = setup();
    const item = await service.create(
      { kind: 'recipe', title: 'Curry', bodyMd: '# Curry\n\nBrown the **meat**.' },
      at,
    );
    await service.publish(item.id, 'person', at);
    const view = await service.getPublishedBySlug('curry');
    expect(view.html).toBe('<h1>Curry</h1>\n<p>Brown the <strong>meat</strong>.</p>');
  });

  it('404s a draft slug rather than confirming it exists', async () => {
    const { service } = await withPublished();
    await expect(service.getPublishedBySlug('secret-draft')).rejects.toThrow('no such content');
  });

  it('404s an unknown slug', async () => {
    const { service } = setup();
    await expect(service.getPublishedBySlug('nothing-here')).rejects.toThrow('no such content');
  });

  it('sanitises a published body', async () => {
    const { service } = setup();
    const item = await service.create(
      { kind: 'post', title: 'Evil', bodyMd: '<script>alert(1)</script>' },
      at,
    );
    await service.publish(item.id, 'person', at);
    const view = await service.getPublishedBySlug('evil');
    expect(view.html).not.toContain('<script>');
  });
});

const potjie = {
  servings: 4,
  prepMinutes: 30,
  cookMinutes: 180,
  ingredients: [{ quantity: '1 kg', item: 'lamb neck' }],
  steps: [{ text: 'Brown the meat.' }, { text: 'Simmer for three hours.' }],
};

/** A recipe created and published, plus the service that holds it. */
async function withPublishedRecipe() {
  const { service, store } = setup();
  const item = await service.create(
    {
      kind: 'recipe',
      title: 'Lamb potjie',
      summary: 'A three-hour potjie.',
      bodyMd: '## The pot\n\nCast iron.',
      taxonomy: ['lamb', 'winter'],
      variantIds: ['variant-1'],
      recipe: potjie,
    },
    at,
  );
  await service.publish(item.id, 'person', at);
  return { service, store, item };
}

describe('recipe reads', () => {
  it('lists a published recipe with a readable time label', async () => {
    const { service } = await withPublishedRecipe();
    const list = await service.listPublishedRecipes();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      slug: 'lamb-potjie',
      title: 'Lamb potjie',
      servings: 4,
      timeLabel: '3 hr 30 min',
    });
  });

  it('does not list a draft recipe', async () => {
    const { service } = setup();
    await service.create({ kind: 'recipe', title: 'Draft potjie', recipe: potjie }, at);
    expect(await service.listPublishedRecipes()).toEqual([]);
  });

  it('does not list a published recipe that has no cookable detail', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'recipe', title: 'Empty recipe' }, at);
    await service.publish(item.id, 'person', at);
    expect(await service.listPublishedRecipes()).toEqual([]);
  });

  it('does not list a published post as a recipe', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'post', title: 'A blog post' }, at);
    await service.publish(item.id, 'person', at);
    expect(await service.listPublishedRecipes()).toEqual([]);
  });

  it('narrows the list by taxonomy', async () => {
    const { service } = await withPublishedRecipe();
    expect(await service.listPublishedRecipes({ taxonomy: ['winter'] })).toHaveLength(1);
    expect(await service.listPublishedRecipes({ taxonomy: ['summer'] })).toEqual([]);
  });

  it('returns the full recipe by slug, with its products', async () => {
    const { service } = await withPublishedRecipe();
    const recipe = await service.getPublishedRecipe('lamb-potjie');
    expect(recipe.ingredients).toEqual([{ quantity: '1 kg', item: 'lamb neck' }]);
    expect(recipe.steps).toHaveLength(2);
    expect(recipe.variantIds).toEqual(['variant-1']);
    expect(recipe.seo.seoTitle).toBeTruthy();
    expect(recipe.html).toContain('Cast iron.');
  });

  it('404s an unknown recipe slug', async () => {
    const { service } = setup();
    await expect(service.getPublishedRecipe('nothing-here')).rejects.toThrow('no such recipe');
  });

  it('404s a draft recipe rather than confirming it exists', async () => {
    const { service } = setup();
    await service.create({ kind: 'recipe', title: 'Secret potjie', recipe: potjie }, at);
    await expect(service.getPublishedRecipe('secret-potjie')).rejects.toThrow('no such recipe');
  });

  it('404s a published recipe with no detail instead of rendering an empty shell', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'recipe', title: 'Half written' }, at);
    await service.publish(item.id, 'person', at);
    await expect(service.getPublishedRecipe('half-written')).rejects.toThrow('no such recipe');
  });

  it('404s a published post read through the recipe route', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'post', title: 'Just a post' }, at);
    await service.publish(item.id, 'person', at);
    await expect(service.getPublishedRecipe('just-a-post')).rejects.toThrow('no such recipe');
  });

  it('replaces the detail when a draft is patched', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'recipe', title: 'Potjie', recipe: potjie }, at);
    await service.patch(
      item.id,
      { recipe: { ...potjie, servings: 8, steps: [{ text: 'Feed a crowd.' }] } },
      at,
    );
    await service.publish(item.id, 'person', at);
    const recipe = await service.getPublishedRecipe('potjie');
    expect(recipe.servings).toBe(8);
    expect(recipe.steps).toEqual([{ text: 'Feed a crowd.' }]);
  });

  it('does not leak the recipe detail onto the content row', async () => {
    const { service } = setup();
    const item = await service.create({ kind: 'recipe', title: 'Potjie', recipe: potjie }, at);
    const patched = await service.patch(item.id, { recipe: potjie }, at);
    expect(patched).not.toHaveProperty('recipe');
  });

  it('serves a recipe through the generic content read as well', async () => {
    const { service } = await withPublishedRecipe();
    const view = await service.getPublishedBySlug('lamb-potjie');
    expect(view.kind).toBe('recipe');
    expect(view.variantIds).toEqual(['variant-1']);
  });
});
