import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SheetsService {
  constructor(private readonly prisma: PrismaService) {}

  private getAuthClient(accessToken: string) {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ access_token: accessToken });
    return auth;
  }

  // 1. Ambil daftar koneksi Sheet milik User
  async findAllConnections(userId: string) {
    return this.prisma.sheetConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });
  }

  private async initNewSpreadsheet(sheets: ReturnType<typeof google.sheets>, userId: string, sheetTitle: string, isPrimary: boolean): Promise<string> {
    const response = await sheets.spreadsheets.create({
      requestBody: { properties: { title: sheetTitle } },
    });

    const spreadsheetId = response.data?.spreadsheetId;
    if (!spreadsheetId) throw new InternalServerErrorException('Gagal membuat spreadsheet baru');

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A1:G1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[ 'Timestamp', 'Item', 'Category', 'Amount', 'Payment Method', 'Date', 'Source' ]] },
    });

    await this.prisma.sheetConnection.create({
      data: { userId, spreadsheetId, name: sheetTitle, isPrimary }
    });

    return spreadsheetId;
  }

  // 2. Buat Sheet Baru (Dibatasi Maks 3)
async createSpreadsheet(userId: string, title: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.googleAccessToken) {
        throw new UnauthorizedException('Token Google tidak ditemukan. Silakan login ulang.');
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: user.googleAccessToken });

      const sheets = google.sheets({ version: 'v4', auth });

      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: title || 'Pengeluaran ohDuit',
          },
          sheets: [
            {
              properties: { title: 'Transactions' }
            }
          ]
        }
      });

      const spreadsheetId = response.data.spreadsheetId;

      // PERBAIKAN 2: Validasi mutlak. Jika Google gagal memberi ID, hentikan proses.
      // Ini membuat TypeScript 100% yakin bahwa di bawah baris ini, spreadsheetId adalah sebuah STRING.
      if (!spreadsheetId) {
        throw new InternalServerErrorException('Google tidak mengembalikan ID Spreadsheet yang valid.');
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId, // Bebas error 2769
        range: 'Transactions!A1:E1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Catatan']],
        },
      });

      const newSheet = await this.prisma.sheetConnection.create({
        data: {
          userId,
          spreadsheetId: spreadsheetId, // Bebas error 2322
          name: title || 'Pengeluaran ohDuit',
          isPrimary: true, 
        }
      });

      return { status: 'success', data: newSheet };
      
    } catch (error: any) {
      console.error('[Google Sheets Error]:', error.message);
      throw new InternalServerErrorException(`Gagal membuat Google Sheet: ${error.message}`);
    }
  }
    
  // 3. Sinkronisasi (Menerima targetSpreadsheetId Google yang spesifik)
  async syncTransaction(userId: string, targetSpreadsheetId: string, transaction: any, category: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.googleAccessToken) return;

    const auth = this.getAuthClient(user.googleAccessToken);
    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const formattedDate = new Date(transaction.createdAt).toLocaleString('id-ID');
      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSpreadsheetId,
        range: 'Sheet1!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            formattedDate, transaction.description || category.name, category.name, 
            transaction.amount, transaction.paymentMethod || 'Cash', 
            new Date(transaction.createdAt).toISOString().slice(0, 10), transaction.source || 'Manual'
          ]],
        },
      });
    } catch (error: any) {
      console.error('Galat syncTransaction:', error.message);
    }
  }
}