import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit-table';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // 1. Fungsi untuk mengambil ringkasan bulan ini
  async getMonthlySummary(userId: string) {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const transactions = await this.prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      let totalIncome = 0;
      let totalExpense = 0;

      transactions.forEach((trx) => {
        if (trx.type === 'INCOME') {
          totalIncome += trx.amount;
        } else if (trx.type === 'EXPENSE') {
          totalExpense += trx.amount;
        }
      });

      return {
        status: 'success',
        data: {
          totalIncome,
          totalExpense,
          netBalance: totalIncome - totalExpense,
          transactionCount: transactions.length,
        }
      };
    } catch (error) {
      throw new InternalServerErrorException('Gagal menghitung ringkasan bulanan');
    }
  }

  // 2. Fungsi untuk Ekspor Excel (KINI MENDUKUNG FILTER WAKTU)
// 2. Fungsi untuk Ekspor Excel
  async exportTransactionsToExcel(
    userId: string,
    query?: { range?: string; date?: string; month?: string; year?: string }
  ): Promise<Buffer> {
    try {
      const { range = 'monthly', date, month, year } = query || {};
      
      let startDate: Date;
      let endDate: Date;

      // 1. Tentukan Waktu Referensi
      const refDate = date ? new Date(date) : new Date();
      const queryYear = year ? parseInt(year) : refDate.getFullYear();
      const queryMonth = month ? parseInt(month) - 1 : refDate.getMonth();

      // 2. Kalkulasi Start dan End Date secara absolut (Tanpa memutasi objek refDate)
      if (range === 'daily') {
        startDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);
        endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
      } 
      else if (range === 'weekly') {
        // Ambil 7 hari ke belakang dari tanggal referensi
        endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
      } 
      else if (range === 'yearly') {
        startDate = new Date(queryYear, 0, 1, 0, 0, 0, 0);
        endDate = new Date(queryYear, 11, 31, 23, 59, 59, 999);
      } 
      else {
        // Default: Monthly
        startDate = new Date(queryYear, queryMonth, 1, 0, 0, 0, 0);
        endDate = new Date(queryYear, queryMonth + 1, 0, 23, 59, 59, 999);
      }

      // 3. Eksekusi Query (Ubah ke ISOString untuk menghindari konflik Timezone)
      const transactions = await this.prisma.transaction.findMany({
        where: { 
          userId,
          date: {
            gte: startDate.toISOString(), // <-- PERBAIKAN PENTING DI SINI
            lte: endDate.toISOString(),   // <-- PERBAIKAN PENTING DI SINI
          }
        },
        include: { category: true },
        orderBy: { date: 'desc' },
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Dowith.id');

      worksheet.columns = [
        { header: 'Tanggal', key: 'date', width: 15 },
        { header: 'Tipe', key: 'type', width: 15 },
        { header: 'Kategori', key: 'category', width: 25 },
        { header: 'Nominal (Rp)', key: 'amount', width: 20 },
        { header: 'Catatan', key: 'description', width: 40 },
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2962FF' },
      };

      transactions.forEach((trx) => {
        worksheet.addRow({
          date: new Date(trx.date).toLocaleDateString('id-ID'),
          type: trx.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
          category: trx.category?.name || 'Tanpa Kategori',
          amount: trx.amount,
          description: trx.description || '-',
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer as ArrayBuffer);

    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Gagal merakit file Excel');
    }
  }


  // 3. FUNGSI BARU: Ekspor PDF
  async exportTransactionsToPdf(
    userId: string,
    query?: { range?: string; date?: string; month?: string; year?: string }
  ): Promise<Buffer> {
    try {
      // 1. Logika Filter Waktu (Sama Persis dengan Excel)
      const { range = 'monthly', date, month, year } = query || {};
      let startDate: Date; let endDate: Date;
      const refDate = date ? new Date(date) : new Date();
      const queryYear = year ? parseInt(year) : refDate.getFullYear();
      const queryMonth = month ? parseInt(month) - 1 : refDate.getMonth();

      if (range === 'daily') {
        startDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);
        endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
      } else if (range === 'weekly') {
        endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
        startDate = new Date(endDate); startDate.setDate(startDate.getDate() - 6); startDate.setHours(0, 0, 0, 0);
      } else if (range === 'yearly') {
        startDate = new Date(queryYear, 0, 1, 0, 0, 0, 0);
        endDate = new Date(queryYear, 11, 31, 23, 59, 59, 999);
      } else {
        startDate = new Date(queryYear, queryMonth, 1, 0, 0, 0, 0);
        endDate = new Date(queryYear, queryMonth + 1, 0, 23, 59, 59, 999);
      }

      // Ambil data dari database
      const transactions = await this.prisma.transaction.findMany({
        where: { userId, date: { gte: startDate.toISOString(), lte: endDate.toISOString() } },
        include: { category: true },
        orderBy: { date: 'desc' },
      });

      // 2. Buat PDF (Dikembalikan sebagai Buffer menggunakan Promise)
      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers: any[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });
        doc.on('error', reject);

        // Header Dokumen
        doc.fontSize(20).text('Laporan Transaksi Dowith.id', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Periode: ${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`, { align: 'center' });
        doc.moveDown(2);

        // Siapkan Data Tabel
        const table = {
          title: "Rincian Transaksi",
          headers: ["Tanggal", "Tipe", "Kategori", "Nominal (Rp)", "Catatan"],
          rows: transactions.map(trx => [
            new Date(trx.date).toLocaleDateString('id-ID'),
            trx.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
            trx.category?.name || 'Tanpa Kategori',
            new Intl.NumberFormat('id-ID').format(trx.amount),
            trx.description || '-'
          ]),
        };

        // Gambar Tabel ke dalam PDF
        doc.table(table, {
          prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
          prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
            doc.font("Helvetica").fontSize(10);
          },
        });

        // Selesai menulis PDF
        doc.end();
      });

    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Gagal merakit file PDF');
    }
  }

}