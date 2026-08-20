import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  async getSummary(@Req() req) {
    // Ambil ID user dari token JWT yang sedang aktif
    const userId = req.user.id; 
    return this.reportsService.getMonthlySummary(userId);
  }
}