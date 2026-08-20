import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SheetsService {
  constructor(private readonly prisma: PrismaService,
    @InjectQueue('google-sheets-sync') private sheetsQueue: Queue,
  ) {}

  private getAuthClient(token: { access_token?: string | null, refresh_token?: string | null }) {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials(token);
    return auth;
  }

async appendTransactionRow(
  refreshToken: string, 
  spreadsheetId: string, 
  transactionData: any[] // <-- Pastikan parameternya disetel sebagai any[]
) {
  try {
    const auth = this.getAuthClient({ refresh_token: refreshToken });
    const sheets = google.sheets({ version: 'v4', auth });
    const values = [transactionData];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Transactions!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
    console.log(`Berhasil sync transaksi ke Sheet ID: ${spreadsheetId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gagal sync ke Google Sheets:', errorMessage);
    throw new InternalServerErrorException(`Gagal menulis ke Google Sheets: ${errorMessage}`);
  }
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
    
  async queueSyncTransaction(userId: string, transactionData: any) {
    await this.sheetsQueue.add(
      'sync-single-transaction',
      { userId, transaction: transactionData },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    );
    return { status: 'queued' };
  }

  // Metode ini tampaknya tidak lagi digunakan oleh SheetsProcessor, namun ini perbaikannya:
  async syncTransactionFromJob(userId: string, targetSpreadsheetId: string, transaction: any, category: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { googleRefreshToken: true } });
    if (!user?.googleRefreshToken) {
      console.error(`Sinkronisasi dibatalkan: Refresh token untuk user ${userId} tidak ditemukan.`);
      return;
    }

    const auth = this.getAuthClient({ refresh_token: user.googleRefreshToken });
    const sheets = google.sheets({ version: 'v4', auth });

    // Menggunakan range 'Transactions' sesuai dengan sheet yang dibuat di createSpreadsheet
    const range = 'Transactions!A:E';
    const values = [[
      new Date(transaction.date).toLocaleDateString('id-ID'), transaction.type, category.name, transaction.amount, transaction.description
    ]];

    await sheets.spreadsheets.values.append({ spreadsheetId: targetSpreadsheetId, range, valueInputOption: 'USER_ENTERED', requestBody: { values } });
  }
  
  async findPrimaryConnection(userId: string) {
    return this.prisma.sheetConnection.findFirst({
      where: { userId, isPrimary: true },
    });
  }
}