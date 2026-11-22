import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { ContentService } from './content.service';
import type { ContentView, CreateContentInput, RecipeSummary, RecipeView } from './content.service';
import type { ContentKind, PublishActor } from './content.rules';
import type { ContentItem } from './content.store';

/** Splits `?taxonomy=lamb,winter` into a list, ignoring empty parts. */
function taxonomyFrom(raw?: string | string[]): string[] {
  const value = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  return value.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
}

@Controller('commerce/content')
export class ContentController {
  constructor(private readonly service: ContentService) {}

  /** Public list. Published only, whatever `status` a caller passes. */
  @Get()
  list(
    @Query('kind') kind?: ContentKind,
    @Query('taxonomy') taxonomy?: string | string[],
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ContentView[]> {
    return this.service.listPublished({
      kind,
      taxonomy: taxonomyFrom(taxonomy),
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /**
   * The recipe list and detail. Declared *before* `:slug` because Express matches
   * routes in declaration order: with `:slug` first, `/commerce/content/recipes`
   * would be read as a content item whose slug is "recipes" and 404.
   */
  @Get('recipes')
  listRecipes(
    @Query('taxonomy') taxonomy?: string | string[],
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<RecipeSummary[]> {
    return this.service.listPublishedRecipes({
      taxonomy: taxonomyFrom(taxonomy),
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('recipes/:slug')
  getRecipe(@Param('slug') slug: string): Promise<RecipeView> {
    return this.service.getPublishedRecipe(slug);
  }

  /** One published item by slug; a draft is a 404, not a 403. */
  @Get(':slug')
  get(@Param('slug') slug: string): Promise<ContentView> {
    return this.service.getPublishedBySlug(slug);
  }

  @Post()
  @RequirePermissions('content:write')
  create(@Body() body: CreateContentInput, @Req() req: unknown): Promise<ContentItem> {
    const author = userFromRequest(req)?.id;
    return this.service.create({ ...body, authorUserId: author });
  }

  @Patch(':id')
  @RequirePermissions('content:write')
  patch(@Param('id') id: string, @Body() body: Partial<CreateContentInput>): Promise<ContentItem> {
    return this.service.patch(id, body);
  }

  /**
   * The publish workflow. `actor` is `person` for a staff session and `agent`
   * for automation; only a person may move `review -> published` (ADR 0013 s1).
   * It is read from the body rather than inferred so the caller states which it
   * is, and an agent cannot silently become a person.
   */
  @Post(':id/publish')
  @RequirePermissions('content:publish')
  publish(
    @Param('id') id: string,
    @Body() body: { actor?: PublishActor },
  ): Promise<ContentItem> {
    return this.service.publish(id, body?.actor === 'agent' ? 'agent' : 'person');
  }
}
