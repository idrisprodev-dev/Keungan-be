    import { Controller, Get, Query, Req, UnauthorizedException } from '@nestjs/common';
    import { ReportsService } from './reports.service';

    @Controller('reports')
    export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    @Get('summary')
    async getSummary(
        @Req() req: any,
        @Query('month') month?: string,
        @Query('year') year?: string
    ) {
        const userId = req.user?.userId || req.user?.sub;
        if (!userId) throw new UnauthorizedException('Otorisasi ditolak.');

        // Jika FE tidak mengirim parameter, gunakan bulan dan tahun saat ini (Waktu Server)
        const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const currentYear = year ? parseInt(year) : new Date().getFullYear();

        return this.reportsService.getSummary(userId, currentMonth, currentYear);
    }
    }