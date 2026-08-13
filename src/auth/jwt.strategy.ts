    import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

    @Injectable()
    export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
        // Membaca token dari header 'Authorization: Bearer <token>'
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        // Menggunakan kunci rahasia yang sama persis dengan yang di .env
        secretOrKey: process.env.JWT_SECRET as string, 
        });
    }

    // Fungsi ini otomatis berjalan jika token valid
    async validate(payload: any) {
        // Mengekstrak ID User (sub) yang kita masukkan saat login Google sebelumnya
        return { userId: payload.sub, email: payload.email };
    }
    }