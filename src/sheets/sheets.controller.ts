import { Controller, Post, Get, Body, Req, UnauthorizedException } from '@nestjs/common';
import { SheetsService } from './sheets.service';

@Controller('sheets')
export class SheetsController {
  constructor(private readonly sheetsService: SheetsService) {}

  @Get()
  async getConnections(@Req() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.sheetsService.findAllConnections(userId);
  }

 @Post()
  async createSheet(@Req() req: any, @Body() body: { title: string }) {
    const userId = req.user?.userId || req.user?.sub;
  if (!userId) {
      throw new UnauthorizedException('Sesi tidak valid. Token gagal dibaca.');
    }    
    return this.sheetsService.createSpreadsheet(userId, body.title);
  }
}