import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Mengizinkan FE (Port 3001) untuk mengakses BE
  app.enableCors({
    origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // BE berjalan di port 3000 sesuai sistem Anda
  await app.listen(3000);
  console.log(`Backend Server berlari di: http://localhost:3000`);
}
bootstrap();