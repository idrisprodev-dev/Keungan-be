import { Controller, Get, Patch, Delete, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private extractUserId(req: any): string {
    return req.user?.id || req.user?.userId || req.user?.sub;
  }

  @Get()
  async findAll(@Req() req: any, @Query('limit') limit?: string) {
    const userId = this.extractUserId(req);
    return this.notificationsService.findAll(userId, limit ? parseInt(limit, 10) : 30);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = this.extractUserId(req);
    return this.notificationsService.getUnreadCount(userId);
  }

  @Get('prefs')
  async getPrefs(@Req() req: any) {
    const userId = this.extractUserId(req);
    return this.notificationsService.getNotificationPrefs(userId);
  }

  @Patch('read-all')
  async markAllRead(@Req() req: any) {
    const userId = this.extractUserId(req);
    return this.notificationsService.markAllRead(userId);
  }

  @Patch('prefs')
  async updatePrefs(@Req() req: any, @Body() body: any) {
    const userId = this.extractUserId(req);
    return this.notificationsService.updateNotificationPrefs(userId, body);
  }

  @Patch(':id/read')
  async markRead(@Req() req: any, @Param('id') id: string) {
    const userId = this.extractUserId(req);
    return this.notificationsService.markRead(userId, id);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const userId = this.extractUserId(req);
    return this.notificationsService.remove(userId, id);
  }

  // Endpoint khusus untuk test/dev supaya bisa isi notifikasi manual
  @Post('dev-create')
  async devCreate(@Req() req: any, @Body() body: { title: string; message: string; type?: any }) {
    const userId = this.extractUserId(req);
    return this.notificationsService.create({
      userId,
      type: body.type || 'SYSTEM',
      title: body.title,
      message: body.message,
    });
  }
}