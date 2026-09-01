// 💡 Buat apa? Ini adalah "Pintu Belakang" yang sah. Endpoint ini sengaja dibuat agar tim developer bisa mengubah akun 
// testing mereka menjadi Platinum atau Free dalam 1 detik tanpa harus buka database manual.
//  Endpoint ini otomatis mati jika aplikasi di-deploy ke server production.



import { Controller, Put, Body, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanType } from '@prisma/client';

@Controller('dev')
export class DevController {
  constructor(private prisma: PrismaService) {}

  @Put('override-plan')
  @UseGuards(JwtAuthGuard)
  async overridePlan(@Req() req: any, @Body('plan') plan: PlanType) {
        // Keamanan super ketat: Hanya jalan jika di Localhost/Development!
        if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Endpoint ini tidak tersedia di production.');
    }

    const userId = req.user?.id || req.user?.userId;
    return this.prisma.user.update({
      where: { id: userId },
      data: { plan },
    });
  }
}   