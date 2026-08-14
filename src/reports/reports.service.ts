    import { Injectable, InternalServerErrorException } from '@nestjs/common';
    import { PrismaService } from '../prisma/prisma.service';

    @Injectable()
    export class ReportsService {
    constructor(private prisma: PrismaService) {}

    async getSummary(userId: string, month: number, year: number) {
        try {
        // 1. Buat rentang waktu (Awal bulan hingga akhir bulan)
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        // 2. Tarik semua transaksi di bulan tersebut
        const transactions = await this.prisma.transaction.findMany({
            where: {
            userId,
            date: {
                gte: startDate,
                lte: endDate,
            }
            },
            include: { category: true } // Sertakan relasi kategori untuk mendapatkan namanya
        });

        // 3. Inisialisasi variabel penampung
        let totalIncome = 0;
        let totalExpense = 0;
        const categoryBreakdown: Record<string, number> = {};

        // 4. Lakukan kalkulasi agresif
        transactions.forEach(trx => {
            if (trx.type === 'INCOME') {
            totalIncome += trx.amount;
            } else if (trx.type === 'EXPENSE') {
            totalExpense += trx.amount;
            
            // Akumulasi pengeluaran per kategori (Untuk Pie Chart)
            const catName = trx.category?.name || 'Lainnya';
            if (!categoryBreakdown[catName]) {
                categoryBreakdown[catName] = 0;
            }
            categoryBreakdown[catName] += trx.amount;
            }
        });

        // 5. Susun format JSON yang siap ditelan oleh Chart.js / Recharts di Frontend
        const expenseByCategory = Object.keys(categoryBreakdown).map(key => ({
            category: key,
            amount: categoryBreakdown[key]
        })).sort((a, b) => b.amount - a.amount); // Urutkan dari pengeluaran terbesar

        return {
            status: 'success',
            data: {
            period: { month, year },
            summary: {
                totalIncome,
                totalExpense,
                balance: totalIncome - totalExpense
            },
            expenseByCategory
            }
        };
        } catch (error) {
        console.error(error);
        throw new InternalServerErrorException('Gagal memuat laporan keuangan.');
        }
    }
    }