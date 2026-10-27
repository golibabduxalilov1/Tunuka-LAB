import './env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useBodyParser('json', { limit: '2mb' });
  // Sayt odatda Next.js orqali (/api proksi) ishlaydi; to'g'ridan-to'g'ri so'rovlar uchun CORS
  app.enableCors({ origin: process.env.WEB_ORIGIN ? process.env.WEB_ORIGIN.split(',') : true });
  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  console.log(`TunukaLab API: http://localhost:${port}/api`);
}
bootstrap();
