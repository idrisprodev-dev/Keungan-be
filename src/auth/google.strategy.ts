    import { PassportStrategy } from '@nestjs/passport';
    import { Strategy, VerifyCallback } from 'passport-google-oauth20';
    import { Injectable } from '@nestjs/common';

    @Injectable()
    export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor() {
super({
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
      // Meminta akses email, profil, DAN izin mutlak untuk mengedit Google Sheets
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/spreadsheets'],
    });    }
    
    async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
        const { name, emails, photos } = profile;
        const user = {
        email: emails[0].value,
        name: `${name.givenName} ${name.familyName || ''}`.trim(),
        image: photos[0].value,
        accessToken, // Token Google (Kelak dipakai untuk interaksi ke Spreadsheet)
        };
        done(null, user);
    }
    }