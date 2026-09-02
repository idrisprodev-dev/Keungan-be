import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { CloudinaryProvider } from './cloudinary.provider';
import { ProfileController } from './profile.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CloudinaryProvider, CloudinaryService],
  controllers: [ProfileController],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
