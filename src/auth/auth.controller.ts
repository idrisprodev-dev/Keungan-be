import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private prisma: PrismaService) {}

  @Public() // <-- KUNCI PENYELESAIAN ERROR 401 ADA DI SINI
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  @Public() // <-- WAJIB DIPASANG JUGA DI SINI
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res) {
    const googleUser = req.user;

    const fullName = googleUser.name || '';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || fullName;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // Set trial 30 hari untuk user baru (otomatis dibuat saat pertama kali login)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    // 1. Cari atau buat User di Database (Upsert)
    const user = await this.prisma.user.upsert({
      where: { email: googleUser.email },
      update: {
        name: googleUser.name,
        picture: googleUser.picture,
        googleAccessToken: googleUser.accessToken,
        // Update refresh token HANYA jika Google memberikannya (biasanya saat login pertama kali)
        ...(googleUser.refreshToken && { googleRefreshToken: googleUser.refreshToken }),
      },
      create: {
        email: googleUser.email,
        name: googleUser.name,
        firstName,
        lastName,
        picture: googleUser.picture,
        googleAccessToken: googleUser.accessToken,
        googleRefreshToken: googleUser.refreshToken,
        plan: 'FREE',
        trialEndsAt,
      },
    });

    // 2. Buat JWT internal untuk Frontend kita
    const internalToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role  },
      process.env.JWT_SECRET || 'rahasia-ohduit',
      { expiresIn: '7d' }
    );

    // 3. Arahkan ke halaman auth/callback yang kita buat di Frontend pada STEP 14
    res.redirect(`http://localhost:3001/auth/callback?token=${internalToken}`);
  }
}