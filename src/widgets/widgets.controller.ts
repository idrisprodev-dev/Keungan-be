import { Controller, Get, Put, Body, Req } from '@nestjs/common';
import { WidgetsService } from './widgets.service';

@Controller('widgets')
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get()
  async getPreferences(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.widgetsService.getPreferences(userId);
  }

  @Put()
  async updatePreferences(@Body() body: any, @Req() req: any) {
    const userId = req.user?.userId || req.user?.sub || body.userId;
    if (!userId) throw new Error('Unauthorized');
    
    // Mengekstrak array widget dari payload
    const widgets = body.widgets || body;
    if (!Array.isArray(widgets)) {
      throw new Error('Format data tidak valid. Payload harus berupa Array.');
    }

    return this.widgetsService.updatePreferences(userId, widgets);
  }
}