import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Keamanan Header Dasar
  app.use(helmet());

  // 2. Buka Gerbang CORS khusus untuk Frontend di Port 3001
  app.enableCors({
    origin: ['http://localhost:3001'], 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 3. Eksekusi DTO Global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 4. Konfigurasi Swagger
  const config = new DocumentBuilder()
    .setTitle('API Keuangan Pro')
    .setDescription('Dokumentasi lengkap API Manajemen Keuangan, Smart Rules, dan Sinkronisasi Sheets')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 5. Jalankan Backend secara spesifik di Port 3000
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Backend berjalan di: http://localhost:${port}`);
  console.log(`Dokumentasi API tersedia di: http://localhost:${port}/api/docs`);
}
bootstrap();