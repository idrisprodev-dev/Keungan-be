        import { Injectable, InternalServerErrorException } from '@nestjs/common';
        import { google } from 'googleapis';
        import { PrismaService } from '../prisma/prisma.service';

        @Injectable()
        export class SheetsService {
        constructor(private readonly prisma: PrismaService) {}

        // Utilitas untuk merakit jembatan otorisasi Google
        private getAuthClient(accessToken: string) {
            const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            );
            auth.setCredentials({ access_token: accessToken });
            return auth;
        }

        async syncTransaction(userId: string, transaction: any, category: any) {
            // 1. Validasi Identitas dan Akses Mutlak
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user || !user.googleAccessToken) {
            console.warn(`Sinkronisasi dibatalkan: User ${userId} tidak memiliki Token Google`);
            return; 
            }

            const auth = this.getAuthClient(user.googleAccessToken);
            const sheets = google.sheets({ version: 'v4', auth });
            let targetSpreadsheetId = user.spreadsheetId;

            try {
        // 2. Pembuatan Lembar Kerja Otomatis (Jika belum ada)
        if (!targetSpreadsheetId) {
            const newSheetResponse = await sheets.spreadsheets.create({
            requestBody: {
                properties: { title: `ohDuit.id - Laporan Keuangan (${user.name})` },
            },
            });

            const spreadsheetId = newSheetResponse.data?.spreadsheetId;
            if (!spreadsheetId) {
            throw new InternalServerErrorException('Gagal membuat spreadsheet baru di Google Sheets');
            }

            targetSpreadsheetId = spreadsheetId;

            await this.prisma.user.update({
            where: { id: userId },
            data: { spreadsheetId: targetSpreadsheetId },
            });

            // CETAK HEADER: Tambahkan 'as string' di sini
            await sheets.spreadsheets.values.append({
            spreadsheetId: targetSpreadsheetId as string, 
            range: 'Sheet1!A1:E1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['Tanggal', 'Kategori', 'Tipe', 'Deskripsi', 'Nominal (Rp)']],
            },
            });
        }

        // 3. Penyuntikan Data Transaksi Presisi
        const formattedDate = new Date(transaction.createdAt).toLocaleString('id-ID');
        const rowData = [
            formattedDate,
            category.name,
            category.type,
            transaction.description || '-',
            transaction.amount,
        ];

        // INJEKSI DATA: Tambahkan 'as string' di sini juga
        await sheets.spreadsheets.values.append({
            spreadsheetId: targetSpreadsheetId as string,
            range: 'Sheet1!A:E',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowData] },
        });

        console.log('Tembus: Data berhasil dicetak ke Google Sheets!');
        } catch (error: any) {
        console.error('Galat Eksekusi Google Sheets API:', error.message);
        throw new InternalServerErrorException('Gagal menyinkronkan data ke Google Sheets');
        }
        }
        }