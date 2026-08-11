import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Menandai modul ini agar tersedia di seluruh sistem tanpa perlu diimpor berulang kali
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Wajib diekspor
})
export class PrismaModule {}