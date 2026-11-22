import { Body, Controller, Get, Ip, Param, Post, Query, Res } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { NewsletterService } from './newsletter.service';
import type { SubscribeResult, TickResult } from './newsletter.service';
import type { Subscriber } from './subscriber';
import { escapeHtml } from '../templates/html';

/** A plain page, because these routes are reached from an email client and
 * must work with no session, no JavaScript and no login. */
function page(title: string, message: string): string {
  // Both arguments are fixed strings chosen here, but they are escaped anyway:
  // this helper must stay safe if a caller ever passes a value from a request.
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return [
    '<!doctype html>',
    '<html lang="en-ZA"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${safeTitle} — Amazing Goats</title></head>`,
    '<body style="margin:0;padding:48px 24px;background:#f6f4ef;' +
      'font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1f2421">',
    '<div style="max-width:520px;margin:0 auto;background:#fff;padding:32px;border-radius:8px">',
    `<h1 style="font-size:1.25rem;margin:0 0 16px">${safeTitle}</h1>`,
    `<p style="margin:0;line-height:1.6">${safeMessage}</p>`,
    '<p style="margin:24px 0 0"><a href="/" style="color:#2f5d3a">Back to the shop</a></p>',
    '</div></body></html>',
  ].join('\n');
}

@Controller('notifications')
export class NewsletterController {
  constructor(private readonly service: NewsletterService) {}

  /**
   * Public by design: anyone may ask to subscribe. The answer is always 202 and
   * always the same, so the endpoint cannot be used to discover whether an
   * address is already on the list.
   */
  @Post('subscribe')
  async subscribe(@Body() body: { email?: string; source?: string }, @Ip() ip: string): Promise<SubscribeResult> {
    return this.service.subscribe({ email: body.email ?? '', source: body.source, ip });
  }

  /** The confirmation click. Public: the token is the credential. */
  @Get('subscribe/confirm')
  async confirm(@Query('token') token: string, @Res() res: { type(t: string): void; send(b: string): void }) {
    const subscriber = await this.service.confirmToken(token ?? '');
    res.type('text/html');
    res.send(
      subscriber
        ? page('You are subscribed', 'Thank you — your subscription is confirmed. Look out for our next letter.')
        : page('Link not valid', 'This confirmation link is not valid or has expired. You can subscribe again from the shop.'),
    );
  }

  /**
   * Unsubscribe. Public and sessionless: requiring a login to stop marketing
   * would trap anyone who cannot sign in, and the link in the email is the
   * credential. Idempotent, so a second click still reports success.
   */
  @Get('unsubscribe')
  async unsubscribe(@Query('token') token: string, @Res() res: { type(t: string): void; send(b: string): void }) {
    const subscriber = await this.service.unsubscribeToken(token ?? '');
    res.type('text/html');
    res.send(
      subscriber
        ? page('You are unsubscribed', 'You have been removed from the newsletter. You will not receive further marketing email.')
        : page('Link not valid', 'This unsubscribe link is not valid. If you are still receiving email, reply to it and we will remove you.'),
    );
  }

  /** Staff view of the list. Confirmed subscribers only, so a pending address
   * is not exposed before its owner has proved it. */
  @Get('subscribers')
  @RequirePermissions('support:manage')
  list(): Promise<Subscriber[]> {
    return this.service.list();
  }

  /** One paced tick. Called by a scheduler, not a person; `support:manage` so
   * it cannot be triggered anonymously to burn a send budget. */
  @Post('campaigns/:id/tick')
  @RequirePermissions('support:manage')
  tick(@Param('id') id: string, @Query('batch') batch?: string): Promise<TickResult> {
    const size = batch ? Number(batch) : undefined;
    return this.service.tick(id, Number.isFinite(size) ? size : undefined);
  }
}
