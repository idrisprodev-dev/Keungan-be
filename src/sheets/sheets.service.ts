import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SheetsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Auth Client ────────────────────────────────────────────────────────────

  private getAuthClient(accessToken: string) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    auth.setCredentials({ access_token: accessToken });
    return auth;
  }

  // ─── Private Helper ─────────────────────────────────────────────────────────
  //     Dipakai bersama oleh createSpreadsheet() dan syncTransaction()
  //     agar tidak ada duplikasi logika

  private async initNewSpreadsheet(
    sheets: ReturnType<typeof google.sheets>,
    userId: string,
    sheetTitle: string,
  ): Promise<string> {
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: sheetTitle },
      },
    });

    const spreadsheetId = response.data?.spreadsheetId;
    if (!spreadsheetId) {
      throw new InternalServerErrorException(
        'Gagal membuat spreadsheet baru di Google Sheets',
      );
    }

    // Cetak baris header
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A1:G1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[ 'Timestamp', 'Item', 'Category', 'Amount', 'Payment Method', 'Date', 'Source' ]],
      },
    });

    // Simpan ke database (Tabel SheetConnection Baru)
    await this.prisma.sheetConnection.create({
      data: {
        userId: userId,
        spreadsheetId: spreadsheetId,
        name: sheetTitle,
        isPrimary: true, // Karena ini sheet default/pertama
      }
    });

    return spreadsheetId;
  }

  // ─── Public: Dipanggil Controller (POST /sheets) ────────────────────────────

  async createSpreadsheet(userId: string, title?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    if (!user.googleAccessToken) {
      throw new InternalServerErrorException(
        'User belum menghubungkan akun Google',
      );
    }

    const auth = this.getAuthClient(user.googleAccessToken);
    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const sheetTitle = title || `Buku Besar - ${user.name}`;
      
      const spreadsheetId = await this.initNewSpreadsheet(
        sheets,
        userId,
        sheetTitle,
      );

      return {
        message: 'Spreadsheet berhasil dibuat',
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      };
    } catch (error: any) {
      console.error('Galat createSpreadsheet:', error.message);
      throw new InternalServerErrorException(
        'Gagal membuat spreadsheet di Google Sheets',
      );
    }
  }

  // ─── Public: Dipanggil Internal saat Transaksi Baru ─────────────────────────

  async syncTransaction(userId: string, transaction: any, category: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.googleAccessToken) {
      console.warn(
        `Sinkronisasi dibatalkan: User ${userId} tidak memiliki Token Google`,
      );
      return;
    }

    const auth = this.getAuthClient(user.googleAccessToken);
    const sheets = google.sheets({ version: 'v4', auth });

    try {
      // 1. Cari koneksi Sheet utama pengguna dari database
      let sheetConn = await this.prisma.sheetConnection.findFirst({
        where: { userId: userId, isPrimary: true },
      });

      let targetSpreadsheetId = sheetConn?.spreadsheetId;

      // 2. Buat spreadsheet otomatis jika ternyata terhapus/belum punya
      if (!targetSpreadsheetId) {
        targetSpreadsheetId = await this.initNewSpreadsheet(
          sheets,
          userId,
          `ohDuit.id - Laporan Keuangan (${user.name})`,
        );
      }

      // 3. Injeksi baris transaksi
      const formattedDate = new Date(transaction.createdAt).toLocaleString('id-ID');

      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSpreadsheetId,
        range: 'Sheet1!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              formattedDate, 
              transaction.description || category.name, // Item
              category.name, // Category
              transaction.amount, // Amount
              transaction.paymentMethod || 'Cash', // Payment Method
              new Date(transaction.createdAt).toISOString().slice(0, 10), // Date
              transaction.source || 'Manual', // Source
            ],
          ],
        },
      });

      console.log('Tembus: Data berhasil dicetak ke Google Sheets!');
    } catch (error: any) {
      console.error('Galat syncTransaction:', error.message);
      throw new InternalServerErrorException(
        'Gagal menyinkronkan data ke Google Sheets',
      );
    }
  }
}