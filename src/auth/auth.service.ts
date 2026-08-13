    import { Injectable } from '@nestjs/common';
    import { JwtService } from '@nestjs/jwt';
    import { PrismaService } from '../prisma/prisma.service';

    @Injectable()
    export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) {}

    async validateOAuthLogin(userPayload: any) {
        // Upsert: Jika user sudah ada, perbarui token Google-nya. 
        // Jika belum ada, buat user baru beserta tokennya.
        const user = await this.prisma.user.upsert({
        where: { email: userPayload.email },
        update: {
            googleAccessToken: userPayload.accessToken, // Simpan kunci baru setiap login
        },
        create: {
            email: userPayload.email,
            name: userPayload.name,
            image: userPayload.image,
            googleAccessToken: userPayload.accessToken,
            spreadsheetId: null,
            // googleAccessToken tidak kita panggil di sini demi keamanan absolut
        },
        });

        // Terbitkan JWT (Tiket Kunci Masuk) untuk Frontend
        const payload = { sub: user.id, email: user.email };
        const jwt = this.jwtService.sign(payload, { 
        secret: process.env.JWT_SECRET, 
        expiresIn: '7d' 
        });

        return { jwt, user };
    }

    async getUserProfile(userId: string) {
        try {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
            id: true,
            name: true,
            email: true,
            image: true,
            spreadsheetId: true,
            plan: true,
            createdAt: true,
            },
        });

        if (!user) {
            return { status: 'error', message: 'User tidak ditemukan' };
        }

        return { status: 'success', data: user };
        } catch (error) {
        return { status: 'error', message: 'Gagal mengambil data profil user' };
        }
    }
    }