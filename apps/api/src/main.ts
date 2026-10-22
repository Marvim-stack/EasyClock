import 'reflect-metadata';
import { config } from 'dotenv';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { Controller, Get, Post, Module, Injectable, Inject, ConflictException, OnModuleInit, OnModuleDestroy, CanActivate, ExecutionContext, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { due, slots } from './schedule';
import { register } from './browser';

const root = resolve(__dirname, '../../..');
config({ path: resolve(root, '.env') });
const data = resolve(root, 'data');
mkdirSync(data, { recursive: true });
const stateFile = resolve(data, 'state.json');
type Entry = { key: string; at: string; status: string; message: string };
type State = { enabled: boolean; history: Entry[] };

@Injectable()
class Clock implements OnModuleInit, OnModuleDestroy {
  private state: State = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { enabled: false, history: [] };
  private timer?: NodeJS.Timeout;
  private busy = false;
  private lock = resolve(data, 'instance.lock');
  private ownsLock = false;
  readonly dryRun = process.env.DRY_RUN !== 'false';
  readonly days = (process.env.WORK_DAYS || 'Mon,Tue,Wed,Thu,Fri').split(',').map(s => s.trim());
  readonly excluded = (process.env.EXCLUDED_DATES || '').split(',').map(s => s.trim());
  onModuleInit() {
    try { closeSync(openSync(this.lock, 'wx')); this.ownsLock = true; }
    catch { throw new Error('Outra instância ou lock antigo em data/instance.lock. Consulte o README.'); }
    this.timer = setInterval(() => { void this.tick().catch(() => console.error('Falha ao executar o agendador; consulte data/state.json.')); }, 5000);
  }
  onModuleDestroy() {
    clearInterval(this.timer);
    if (this.ownsLock) unlinkSync(this.lock);
  }
  private save() {
    writeFileSync(`${stateFile}.tmp`, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    renameSync(`${stateFile}.tmp`, stateFile);
  }
  status() {
    return { enabled: this.state.enabled, dryRun: this.dryRun, busy: this.busy, slots, days: this.days,
      excludedDates: this.excluded.filter(Boolean), timezone: 'America/Sao_Paulo', history: this.state.history.slice(-100).reverse() };
  }
  toggle() { this.state.enabled = !this.state.enabled; this.save(); return this.status(); }
  private async tick() {
    if (!this.state.enabled || this.busy) return;
    const key = due(new Date(), this.days, this.excluded);
    if (key && !this.state.history.some(e => e.key === key)) await this.run(key, this.dryRun);
  }
  async test() {
    if (this.busy) throw new ConflictException('Uma execução está em andamento.');
    return this.run(`teste/${Date.now()}`, true);
  }
  private async run(key: string, dryRun: boolean) {
    this.busy = true;
    const entry: Entry = { key, at: new Date().toISOString(), status: 'iniciando', message: 'Preparando navegador.' };
    try {
      this.state.history.push(entry);
      this.save();
      entry.message = await register(dryRun, () => {
        entry.status = 'enviado'; entry.message = 'Clique iniciado; aguardando confirmação.'; this.save();
      });
      entry.status = dryRun ? 'simulado' : 'confirmado';
    } catch {
      const uncertain = entry.status === 'enviado';
      entry.status = uncertain ? 'incerto' : 'erro';
      entry.message = uncertain ? 'Clique iniciado sem confirmação. Confira no EasyMOB; não haverá nova tentativa automática.'
        : 'Falha antes do clique. Confira credenciais, seletores, navegador e conexão. Não haverá nova tentativa neste horário.';
    } finally {
      this.busy = false;
      this.save();
    }
    return this.status();
  }
}

@Injectable()
class LocalGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    return req.method === 'GET' || req.headers['x-easyclock'] === 'local';
  }
}
@UseGuards(LocalGuard)
@Controller('api')
class Api {
  constructor(@Inject(Clock) private readonly clock: Clock) {}
  @Get('status') status() { return this.clock.status(); }
  @Post('toggle') toggle() { return this.clock.toggle(); }
  @Post('test') test() { return this.clock.test(); }
}
@Module({ imports: [ServeStaticModule.forRoot({ rootPath: resolve(root, 'apps/web/dist'), exclude: ['/api/{*path}'] })], controllers: [Api], providers: [Clock, LocalGuard] })
class App {}
async function main() {
  const app = await NestFactory.create(App);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), '127.0.0.1');
}
void main();
