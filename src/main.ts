import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // MEMBUKA BLOKADE CORS SECARA SPESIFIK
  app.enableCors({
    origin: 'http://localhost:3001', // Mengizinkan akses HANYA dari Dasbor Next.js Anda
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(3000);
}
bootstrap();
