    import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
    import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
    import * as qrcode from 'qrcode-terminal';
    import pino from 'pino';
    import { Boom } from '@hapi/boom';
    import { PrismaService } from '../prisma/prisma.service';

    @Injectable()
    export class WhatsappService implements OnModuleInit {
    private readonly logger = new Logger(WhatsappService.name);
    private sock: any;

    constructor(private prisma: PrismaService) {}

    async onModuleInit() {
        await this.connectToWhatsApp();
    }

    private async connectToWhatsApp() {
        try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        this.sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
        });

        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
            this.logger.log('📌 Scan QR code di bawah ini menggunakan WhatsApp HP kamu:');
            qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
            this.logger.log('✅ BOT WHATSAPP BERHASIL TERHUBUNG!');
            }

            if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            this.logger.warn(`⚠️ Koneksi terputus (status: ${statusCode}), mencoba menghubungkan ulang...`);
            
            if (shouldReconnect) {
                this.connectToWhatsApp();
            }
            }
        });

        this.sock.ev.on('creds.update', saveCreds);

        // --- LOGIKA UTAMA: MENANGKAP PESAN & CEK DATABASE ---
        this.sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            
            if (!msg.message || !msg.key.remoteJid) return;

            const senderID = msg.key.remoteJid;

            const content = msg.message;
            const messageText = 
            content.conversation || 
            content.extendedTextMessage?.text ||
            content.deviceSentMessage?.message?.conversation ||
            content.deviceSentMessage?.message?.extendedTextMessage?.text;

            if (!messageText) return;

            if (senderID.includes('@newsletter') || senderID === 'status@broadcast') {
            return; 
            }

            if (!messageText.toLowerCase().startsWith('dowith')) {
            return; 
            }

            const realJid = msg.key.remoteJidAlt || senderID;
            const phone = realJid.split('@')[0];

            this.logger.log(`📩 Pesan diproses dari Nomor Asli: ${phone} | Pesan: ${messageText}`);

            const user = await this.prisma.user.findUnique({
            where: { whatsappNumber: phone },
            });

            if (!user) {
            await this.sock.sendMessage(senderID, {
                text: `❌ Halo! Nomor WA kamu (${phone}) belum terhubung ke akun Dowith.id.`,
            });
            return;
            }

            const textLower = messageText.toLowerCase().trim();

            // ========================================================
            // 🌟 FITUR 1: CEK STATUS BOT (PING)
            // ========================================================
            if (textLower === 'dowith ping') {
            await this.sock.sendMessage(senderID, { 
                text: `Pong! Halo ${user.name}, bot Dowith.id aktif dan akunmu sudah terverifikasi 🚀` 
            });
            return;
            }

            // ========================================================
            // 🌟 FITUR 2: CEK SALDO / LAPORAN BULAN INI
            // ========================================================
            if (textLower === 'dowith saldo' || textLower === 'dowith laporan') {
            try {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

                const transactions = await this.prisma.transaction.findMany({
                where: {
                    userId: user.id,
                    date: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                    }
                }
                });

                let totalIncome = 0;
                let totalExpense = 0;

                transactions.forEach((t) => {
                if (t.type === 'INCOME') totalIncome += t.amount;
                if (t.type === 'EXPENSE') totalExpense += t.amount;
                });

                const balance = totalIncome - totalExpense;
                const monthName = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

                const reportText = 
                `📊 *Laporan Keuangan Bulan Ini*\n\n` +
                `Halo ${user.name}, ini ringkasan keuanganmu untuk periode *${monthName}*:\n\n` +
                `🟢 Pemasukan: Rp ${totalIncome.toLocaleString('id-ID')}\n` +
                `🔴 Pengeluaran: Rp ${totalExpense.toLocaleString('id-ID')}\n` +
                `====================\n` +
                `💰 *Sisa Saldo:* Rp ${balance.toLocaleString('id-ID')}\n\n` +
                `_Tetap semangat atur keuanganmu bersama Dowith.id!_ 🚀`;

                await this.sock.sendMessage(senderID, { text: reportText });
                return; 
            } catch (error) {
                this.logger.error('❌ Gagal menarik laporan keuangan:', error);
                await this.sock.sendMessage(senderID, { text: '❌ Terjadi kesalahan saat menarik data laporanmu.'});
                return;
            }
            }

            // ========================================================
            // 🌟 FITUR 3: PEMBATALAN TRANSAKSI TERAKHIR (UNDO)
            // ========================================================
            if (textLower === 'dowith undo' || textLower === 'dowith batal') {
            try {
                const lastTransaction = await this.prisma.transaction.findFirst({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                });

                if (!lastTransaction) {
                await this.sock.sendMessage(senderID, {
                    text: `❌ ${user.name}, kamu belum memiliki riwayat transaksi untuk dibatalkan.`,
                });
                return;
                }

                await this.prisma.transaction.delete({
                where: { id: lastTransaction.id },
                });

                const typeLabel = lastTransaction.type === 'INCOME' ? '🟢 Masuk' : '🔴 Keluar';

                await this.sock.sendMessage(senderID, {
                text: `🗑️ *Transaksi Terakhir Berhasil Dihapus (Undo)*\n\n📝 Item: ${lastTransaction.description}\n💰 Nominal: Rp ${lastTransaction.amount.toLocaleString('id-ID')}\n🔄 Tipe: ${typeLabel}`,
                });
                return;
            } catch (error) {
                this.logger.error('❌ Gagal melakukan undo transaksi:', error);
                await this.sock.sendMessage(senderID, {
                text: '❌ Terjadi kesalahan saat mencoba membatalkan transaksi terakhir.',
                });
                return;
            }
            }

            // ========================================================
            // 🌟 FITUR 4: PENCATATAN TRANSAKSI + BUDGET ALERT
            // ========================================================
            const commandText = messageText.substring(6).trim(); 
            const match = commandText.match(/^(.*?)\s+([\d\.,]+)\s*(k|rb|ribu|jt|juta|m|miliar)?$/i);

            if (!match) {
            await this.sock.sendMessage(senderID, {
                text: `❌ Format salah, ${user.name}!\n\nGunakan format:\n*dowith [nama catatan] [nominal]*\n\nContoh:\n- dowith makan 25k\n- dowith gaji 1,5jt\n\nPerintah lain:\n- *dowith saldo*\n- *dowith undo*`
            });
            return;
            }

            const description = match[1].trim(); 
            let rawNumStr = match[2];
            const suffix = match[3]?.toLowerCase(); 

            if (suffix) {
            rawNumStr = rawNumStr.replace(/\./g, '').replace(',', '.');
            } else {
            rawNumStr = rawNumStr.replace(/\./g, '').replace(',', '.');
            }

            let amount = parseFloat(rawNumStr);

            if (suffix === 'k' || suffix === 'rb' || suffix === 'ribu') {
            amount = amount * 1000;
            } else if (suffix === 'jt' || suffix === 'juta') {
            amount = amount * 1000000;
            } else if (suffix === 'm' || suffix === 'miliar') {
            amount = amount * 1000000000; 
            }

            try {
            const descLower = description.toLowerCase();
            
            let transactionType: 'EXPENSE' | 'INCOME' = 'EXPENSE';
            let matchedCategoryId: string | null = null;
            let categoryNameDisplay = 'Tanpa Kategori';

            // 1. Cek Smart Rules
            const userRules = await this.prisma.smartRule.findMany({
                where: { userId: user.id },
                include: { category: true },
            });

            const matchedRule = userRules.find((rule) => 
                descLower.includes(rule.keyword.toLowerCase())
            );

            if (matchedRule && matchedRule.category) {
                matchedCategoryId = matchedRule.categoryId;
                categoryNameDisplay = matchedRule.category.name;
                transactionType = matchedRule.category.type; 
            } else {
                if (descLower.includes('gaji') || descLower.includes('bonus') || descLower.includes('masuk') || descLower.includes('profit')) {
                transactionType = 'INCOME';
                }
            }

            // 2. Simpan Transaksi ke Database
            await this.prisma.transaction.create({
                data: {
                description: description,
                amount: amount, 
                userId: user.id,
                type: transactionType, 
                date: new Date(),        
                source: 'WA_BOT',      
                categoryId: matchedCategoryId, 
                },
            });

            // ========================================================
            // 🧠 CEK BUDGET ALERT (Jika ini Pengeluaran & ada Kategori)
            // ========================================================
            let budgetWarning = '';
            if (transactionType === 'EXPENSE' && matchedCategoryId) {
                const now = new Date();
                const currentMonth = now.getMonth() + 1;
                const currentYear = now.getFullYear();

                // Cek apakah user punya setting budget untuk kategori ini di bulan ini
                const budgetSetting = await this.prisma.budget.findFirst({
                where: {
                    userId: user.id,
                    categoryId: matchedCategoryId,
                    month: currentMonth,
                    year: currentYear,
                },
                });

                if (budgetSetting) {
                // Hitung total pengeluaran kategori ini sepanjang bulan ini
                const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
                const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

                const categoryTransactions = await this.prisma.transaction.findMany({
                    where: {
                    userId: user.id,
                    categoryId: matchedCategoryId,
                    type: 'EXPENSE',
                    date: { gte: startOfMonth, lte: endOfMonth },
                    },
                });

                const totalCategoryExpense = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);

                // Cek apakah sudah overbudget atau mendekati limit (>= 80%)
                if (totalCategoryExpense > budgetSetting.amount) {
                    budgetWarning = `\n\n⚠️ *Peringatan Budget!*\nPengeluaran kategori *${categoryNameDisplay}* sudah melewati batas (Limit: Rp ${budgetSetting.amount.toLocaleString('id-ID')})!`;
                } else {
                    const percentage = (totalCategoryExpense / budgetSetting.amount) * 100;
                    if (percentage >= 80) {
                    budgetWarning = `\n\n⚠️ *Perhatian:* Pengeluaran kategori *${categoryNameDisplay}* sudah mencapai ${percentage.toFixed(0)}% dari budget bulanan.`;
                    }
                }
                }
            }

            const typeEmoji = transactionType === 'INCOME' ? '🟢 Masuk' : '🔴 Keluar';

            // 3. Kirim Struk Balasan ke WhatsApp (Beserta Peringatan Budget jika ada)
            await this.sock.sendMessage(senderID, {
                text: `✅ *Catatan Berhasil Disimpan!*\n\n📝 Item: ${description}\n💰 Nominal: Rp ${amount.toLocaleString('id-ID')}\n🔄 Tipe: ${typeEmoji}\n📂 Kategori: ${categoryNameDisplay}\n📍 Sumber: WhatsApp Bot${budgetWarning}`
            });
            
            } catch (error) {
            this.logger.error('❌ Gagal menyimpan transaksi:', error);
            await this.sock.sendMessage(senderID, { 
                text: '❌ Maaf, terjadi kesalahan pada server saat menyimpan datamu.' 
            });
            }
        });
        } catch (error) {
        this.logger.error('❌ Gagal menginisialisasi koneksi WhatsApp:', error);
        }
    }
    async generateLinkingToken(userId: string) {
    // 1. Buat kode unik acak, contoh: DOWITH-7829
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const token = `DOWITH-${randomCode}`;
    
    // 2. Set masa aktif token 10 menit ke depan
    const expiresAt = new Date(new Date().getTime() + 10 * 60000);

    // 3. Simpan ke database user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        waLinkingToken: token,
        waTokenExpiresAt: expiresAt,
      },
    });

    // 4. Nomor WhatsApp Bot kamu (ganti dengan nomor bot aslimu, format: 628...)
    const botPhoneNumber = '6281234567890'; 
    const message = encodeURIComponent(`Halo Bot, saya ingin menghubungkan akun Dowith.id saya. Kode verifikasi saya adalah: ${token}`);
    
    const whatsappLink = `https://wa.me/${botPhoneNumber}?text=${message}`;

    return {
      status: 'success',
      message: 'Token berhasil dibuat',
      data: {
        token,
        expiresAt,
        whatsappLink, // Link ini yang akan dibuka saat user klik tombol di frontend
      },
    };
  }

  async getUserProfile(userId: string) {
  return this.prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, whatsappNumber: true },
  });
}
    }