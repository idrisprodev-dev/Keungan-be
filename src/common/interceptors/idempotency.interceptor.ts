import { 
  CallHandler, 
  ExecutionContext, 
  Injectable, 
  NestInterceptor, 
  ConflictException, 
  Inject 
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
// Tambahkan kata 'type' setelah kata import
import type { Cache } from 'cache-manager';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  // Inject CacheManager agar kita bisa melakukan operasi Get/Set ke Redis
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    // 1. Mengambil object HTTP request yang dikirim oleh frontend
    const request = context.switchToHttp().getRequest();
    
    // 2. Mencari header 'x-idempotency-key' (Frontend wajib mengirimkan ini saat nge-hit API POST)
    const idempotencyKey = request.headers['x-idempotency-key'];

    // 3. Jika frontend tidak mengirim key, biarkan request lewat tanpa filter (misal untuk request GET biasa)
    if (!idempotencyKey) {
      return next.handle(); 
    }

    // 4. Mengecek ke memori Redis: Apakah key ini sudah pernah dipakai sebelumnya?
    const isProcessed = await this.cacheManager.get(idempotencyKey);
    
    // 5. Jika key ditemukan di Redis, artinya request ini duplikat (user nge-spam klik). Langsung tolak!
    if (isProcessed) {
      throw new ConflictException('Request ini sudah diproses. Dilarang duplikasi.');
    }

    // 6. Jika key belum ada, simpan key ini ke Redis agar request berikutnya dengan key yang sama akan ditolak.
    // Angka 86400000 adalah lama waktu key disimpan dalam hitungan milidetik (24 Jam).
    await this.cacheManager.set(idempotencyKey, true, 86400000);

    // 7. Lanjutkan request ke Controller agar data disimpan ke database
    return next.handle().pipe(
      tap({
        error: async () => {
          // 8. FAIL-SAFE: Jika terjadi error saat menyimpan ke database (misal validasi DTO gagal),
          // Hapus key dari Redis. Mengapa? Agar user bisa mengulang request-nya kembali setelah memperbaiki error.
          await this.cacheManager.del(idempotencyKey);
        },
      }),
    );
  }
}