import { Controller, Post, Delete, Get, Body, Req, UseGuards, Headers } from '@nestjs/common';
import { WebPushService } from './web-push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller(['push', 'notifications'])
@UseGuards(JwtAuthGuard)
export class WebPushController {
  constructor(private readonly webPushService: WebPushService) {}

  private extractUserId(req: any): string {
    return req.user?.id || req.user?.userId || req.user?.sub;
  }

  // Public key web push bersifat publik (bukan data sensitif).
  // Dibutuhkan frontend SEBELUM ada token/jwt untuk membuat subscription.
  @Public()
  @Get('public-key')
  getPublicKey() {
    return this.webPushService.getPublicKey();
  }

  @Post('subscribe')
  async subscribe(
    @Req() req: any,
    @Body() body: any,
    @Headers('user-agent') userAgent?: string,
  ) {
    const userId = this.extractUserId(req);
    const subscription = body?.subscription ?? body;
    return this.webPushService.subscribe(userId, subscription, userAgent);
  }

  @Delete('unsubscribe')
  async unsubscribe(@Req() req: any, @Body('endpoint') endpoint: string) {
    const userId = this.extractUserId(req);
    if (!endpoint) return { status: 'error', message: 'endpoint wajib diisi' };
    return this.webPushService.unsubscribe(userId, endpoint);
  }
}