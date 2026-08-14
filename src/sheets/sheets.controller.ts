import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SheetsService } from './sheets.service';
import { AuthGuard } from '@nestjs/passport'; // Sesuaikan jika Anda menggunakan custom JwtAuthGuard

@UseGuards(AuthGuard('jwt')) // Amankan rute ini agar hanya user login yang bisa akses
@Controller('sheets')
export class SheetsController {
  constructor(private readonly sheetsService: SheetsService) {}

  @Post()
  async createSpreadsheet(@Body('title') title: string, @Req() req: any) {
    // Ambil ID User dari token JWT yang sudah di-decode oleh Guard
    const userId = req.user.userId || req.user.sub;
    
    // Teruskan ke service Anda yang bertugas mengeksekusi Google Sheets API asli
    // Pastikan fungsi createSpreadsheet ada di dalam file sheets.service.ts Anda
    return await this.sheetsService.createSpreadsheet(userId, title);
  }
}