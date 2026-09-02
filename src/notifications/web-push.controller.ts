import { Controller, Post, Delete, Get, Body, Req, UseGuards, Headers } from '@nestjs/common';
import { WebPushService } from './web-push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class WebPushController {
  constructor(private readonly webPushService: WebPushService) {}

  private extractUserId(req: any): string {
    return req.user?.id || req.user?.userId || req.user?.sub;
  }

  @Get('public-key')
  getPublicKey() {
    return this.webPushService.getPublicKey();
  }

  @Post('subscribe')
  async subscribe(
    @Req() req: any,
    @Body() body: { subscription: { endpoint: string; keys: { p256dh: string; auth: string } } },
    @Headers('user-agent') userAgent?: string,
  ) {
    const userId = this.extractUserId(req);
    return this.webPushService.subscribe(userId, body.subscription, userAgent);
  }

  @Delete('unsubscribe')
  async unsubscribe(@Req() req: any, @Body('endpoint') endpoint: string) {
    const userId = this.extractUserId(req);
    if (!endpoint) return { status: 'error', message: 'endpoint wajib diisi' };
    return this.webPushService.unsubscribe(userId, endpoint);
  }
}