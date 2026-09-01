import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller'; // <-- 1. Pastikan diimpor
import { PrismaModule } from '../prisma/prisma.module'; // (opsional, tergantung setupmu)

@Module({
  imports: [PrismaModule], // Pastikan PrismaModule masuk jika service butuh Prisma
  controllers: [WhatsappController], // <-- 2. WAJIB DIDAFTARKAN DI SINI
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}