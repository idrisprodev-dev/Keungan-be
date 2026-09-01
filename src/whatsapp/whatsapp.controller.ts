import { Controller, Get, Post, Req, Res, Query, HttpStatus, UseGuards, UnauthorizedException } from '@nestjs/common';
import * as express from 'express';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('whatsapp')
export class WhatsappController {

  constructor(private readonly whatsappService: WhatsappService) {}
  private readonly VERIFY_TOKEN = 'dowith_wa_secret_2026'; 

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: express.Response,
  ) {
    if (mode && token) {
      if (mode === 'subscribe' && token === this.VERIFY_TOKEN) {
        console.log('✅ WEBHOOK WHATSAPP TERVERIFIKASI OLEH META');
        return res.status(HttpStatus.OK).send(challenge);
      } else {
        return res.sendStatus(HttpStatus.FORBIDDEN);
      }
    }
    return res.sendStatus(HttpStatus.BAD_REQUEST);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req) {
    // Menggunakan fallback untuk mencegah id bernilai undefined
    const userId = req.user?.id || req.user?.sub || req.user?.userId;
    
    if (!userId) {
      throw new UnauthorizedException('User ID tidak ditemukan dalam token');
    }

    return this.whatsappService.getUserProfile(userId);
  }

  @Post('webhook')
  handleIncomingMessage(
    @Req() req: express.Request, 
    @Res() res: express.Response 
  ) {
    const body = req.body;
    
    if (body.object) {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const phoneNumber = body.entry[0].changes[0].value.contacts[0].wa_id;
        const messageText = body.entry[0].changes[0].value.messages[0].text.body;
        
        console.log(`📩 Pesan WA Masuk! | Dari: ${phoneNumber} | Teks: "${messageText}"`);
      }
      
      return res.sendStatus(HttpStatus.OK);
    } else {
      return res.sendStatus(HttpStatus.NOT_FOUND);
    }
  }

  @Post('generate-link')
  @UseGuards(JwtAuthGuard)
  async generateLink(@Req() req) {
    // Menggunakan fallback untuk mencegah id bernilai undefined
    const userId = req.user?.id || req.user?.sub || req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('User ID tidak ditemukan dalam token');
    }

    return this.whatsappService.generateLinkingToken(userId);
  }
}