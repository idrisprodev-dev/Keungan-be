    import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
    import { AuthGuard } from '@nestjs/passport';
    import { AuthService } from './auth.service';

    @Controller('auth')
    export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // Rute 1: Mengarahkan user ke halaman login Google
    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth(@Req() req) {
        // Proses ini ditangani otomatis oleh Passport
    }

    // Rute 2: Menangkap data dari Google setelah user berhasil login
    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthRedirect(@Req() req, @Res() res) {
        // Panggil logika penerbitan JWT
        const { jwt, user } = await this.authService.validateOAuthLogin(req.user);
        
        // Alihkan kembali ke frontend (Next.js) dengan membawa JWT di URL
        // Di produksi, kita akan meletakkan ini di dalam HttpOnly Cookie, 
        // namun untuk fase transisi ke frontend, menyisipkan di URL sangat efisien.
        res.redirect(`http://localhost:3001/auth-success?token=${jwt}`);
    }
    // Rute 3: Mengambil data profil user yang sedang login
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req) {
    return this.authService.getUserProfile(req.user.userId);
  }
    }