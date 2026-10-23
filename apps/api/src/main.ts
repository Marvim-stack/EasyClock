import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AccessController, AccessRequestGuard } from './access.controller';
import { ClockController, ClockGuard } from './clock.controller';
import { Clocks } from './clocks';

const root = resolve(__dirname, '../../..');
config({ path: resolve(root, '.env') });

@Module({
  imports: [ServeStaticModule.forRoot({ rootPath: resolve(root, 'apps/web/dist'), exclude: ['/api/{*path}'] })],
  controllers: [ClockController, AccessController], providers: [Clocks, ClockGuard, AccessRequestGuard],
})
class App {}
async function main() {
  const app = await NestFactory.create(App);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), '127.0.0.1');
}
void main();
