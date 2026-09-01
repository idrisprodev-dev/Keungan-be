import { Controller, Get, UseGuards, Req, Res, Query } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  async getSummary(@Req() req) {
    const userId = req.user.id; 
    return this.reportsService.getMonthlySummary(userId);
  }

  @Get('export/excel')
  async exportExcel(@Req() req, @Query() query: any, @Res() res: Response) {
    const userId = req.user.id;
    const buffer = await this.reportsService.exportTransactionsToExcel(userId, query);

    const fileName = `Dowith_Excel_${new Date().getTime()}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(buffer);
  }

  @Get('export/pdf')
  async exportPdf(@Req() req, @Query() query: any, @Res() res: Response) {
    const userId = req.user.id;
    const buffer = await this.reportsService.exportTransactionsToPdf(userId, query);

    const fileName = `Dowith_PDF_${new Date().getTime()}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(buffer);
  }
}