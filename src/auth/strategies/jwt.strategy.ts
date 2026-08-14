import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      // Mengambil token otomatis dari header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Harus persis sama dengan secret yang kita pakai saat membuat token
      secretOrKey: process.env.JWT_SECRET || 'rahasia-ohduit', 
    });
  }

  // Fungsi ini otomatis berjalan jika token valid
  async validate(payload: any) {
    // Apapun yang di-return di sini akan masuk secara ajaib ke dalam "req.user"
    return { userId: payload.userId, email: payload.email, role: payload.role };
  }
}