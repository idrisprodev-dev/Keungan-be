    import { Controller, Post, UseInterceptors, UploadedFile, Req, UseGuards, BadRequestException } from '@nestjs/common';
    import { FileInterceptor } from '@nestjs/platform-express';
    import { CloudinaryService } from './cloudinary.service';
    import type { UploadedFile as CloudinaryUploadedFile } from './cloudinary.service';
    import { PrismaService } from '../prisma/prisma.service';
    import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

    @Controller('profile')
    export class ProfileController {
    constructor(
        private readonly cloudinaryService: CloudinaryService,
        private readonly prisma: PrismaService 
    ) {}

    @Post('avatar')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file'))
    async uploadAvatar(@UploadedFile() file: CloudinaryUploadedFile, @Req() req: any) {
        if (!file) {
        throw new BadRequestException('File tidak ditemukan');
        }

        const result = await this.cloudinaryService.uploadImage(file);

        const userId = req.user?.id || req.user?.userId;
        if (!userId) {
        throw new BadRequestException('User tidak terautentikasi');
        }

        await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: result.secure_url },
        });

        return { message: 'Sukses', avatarUrl: result.secure_url };
    }
    }
