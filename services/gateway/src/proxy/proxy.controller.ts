import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import { ProxyService } from './proxy.service';

/**
 * The reverse proxy. It is registered last, after every controller the gateway
 * serves itself (`/health`, `/gateway/auth`, `/gateway/bff`, `/gateway/rate-limit`),
 * so a path the gateway owns always wins and only the service prefixes
 * (`/commerce`, `/accounts`, ...) reach here. A path no service owns answers a
 * plain 404 rather than being forwarded anywhere.
 */
@Controller()
export class ProxyController {
  constructor(@Inject(ProxyService) private readonly proxy: ProxyService) {}

  @All('*')
  async any(@Req() req: any, @Res() res: any): Promise<void> {
    const reply = await this.proxy.forward({
      method: req.method,
      originalUrl: req.originalUrl ?? req.url,
      headers: req.headers,
      // The parsed body when the JSON parser produced one, else the raw bytes
      // Nest kept (`rawBody: true`), so a body is never dropped on the floor.
      body: req.body ?? req.rawBody,
    });

    if (!reply) {
      res.status(404).json({ statusCode: 404, message: 'Not Found' });
      return;
    }

    for (const [name, value] of Object.entries(reply.headers)) res.setHeader(name, value);
    if (reply.body === undefined) {
      res.status(reply.status).end();
    } else if (typeof reply.body === 'string') {
      res.status(reply.status).send(reply.body);
    } else {
      res.status(reply.status).json(reply.body);
    }
  }
}
