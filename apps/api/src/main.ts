import 'reflect-metadata';
import { config } from 'dotenv';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { Controller, Get, Post, Module, Injectable, Inject, ConflictException, OnModuleInit, OnModuleDestroy, CanActivate, ExecutionContext, UseGuards, Body, Query, BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { due, localTime } from './schedule';
import { register, fetchPunches } from './browser';
import { defaultSlots, Settings, Slot, validateSettings } from './settings';

const root = resolve(__dirname, '../../..');
config({ path: resolve(root, '.env') });
const data = resolve(process.env.EASYCLOCK_DATA_DIR || resolve(root, 'data'));
mkdirSync(data, { recursive: true });
const stateFile = resolve(data, 'state.json');
type Entry = { key: string; at: string; status: string; message: string; kind?: string };
type State = { enabled: boolean; history: Entry[] };

@Injectable()
class Clock implements OnModuleInit, OnModuleDestroy {
  private state: State = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { enabled: false, history: [] };
  private timer?: NodeJS.Timeout;
  private busy = false;
  private lock = resolve(data, 'instance.lock');
  private ownsLock = false;
  private settingsFile = resolve(data, 'settings.json');
  private settings: Settings = existsSync(this.settingsFile) ? JSON.parse(readFileSync(this.settingsFile, 'utf8')) : {
    group: process.env.EASYMOB_GROUP || '', user: process.env.EASYMOB_USER || '', password: process.env.EASYMOB_PASSWORD || '',
    dryRun: process.env.DRY_RUN !== 'false', days: (process.env.WORK_DAYS || 'Mon,Tue,Wed,Thu,Fri').split(',').map(s => s.trim()),
    excludedDates: (process.env.EXCLUDED_DATES || '').split(',').map(s => s.trim()).filter(Boolean), slots: defaultSlots,
  };
  private punchesFile = resolve(data, 'punches.json');
  private punches: { fetchedAt: string | null; rows: string[][] } = existsSync(this.punchesFile)
    ? JSON.parse(readFileSync(this.punchesFile, 'utf8')) : { fetchedAt: null, rows: [] };
  getSettings() {
    const { password, ...safe } = this.settings;
    return { ...safe, hasPassword: Boolean(password) };
  }
  updateSettings(input: unknown) {
    if (this.busy) throw new ConflictException('Aguarde a execução terminar.');
    let next: Settings;
    try { next = validateSettings(input, this.settings); }
    catch (e) { throw new BadRequestException((e as Error).message); }
    writeFileSync(`${this.settingsFile}.tmp`, JSON.stringify(next, null, 2), { mode: 0o600 });
    renameSync(`${this.settingsFile}.tmp`, this.settingsFile);
    // Trocar de conta pausa o agendamento e remove o cache da conta anterior.
    if (next.user !== this.settings.user || next.group !== this.settings.group) {
      this.state.enabled = false;
      this.punches = { fetchedAt: null, rows: [] };
      writeFileSync(this.punchesFile, JSON.stringify(this.punches), { mode: 0o600 });
      this.save();
    }
    this.settings = next;
    return this.getSettings();
  }
  getHistory(page = '1') {
    const n = Math.max(1, Math.floor(Number(page)) || 1);
    const entries = [...this.state.history].reverse();
    return { entries: entries.slice((n - 1) * 25, n * 25), total: entries.length, page: n };
  }
  getPunches() { return this.punches; }
  async syncPunches() {
    if (this.busy) throw new ConflictException('Aguarde a execução terminar.');
    if (!process.env.EASYMOB_PUNCHES_SELECTOR) throw new BadRequestException('A consulta precisa do seletor EASYMOB_PUNCHES_SELECTOR da tabela do portal.');
    this.busy = true;
    try {
      const rows = await fetchPunches({ ...this.settings });
      const next = { fetchedAt: new Date().toISOString(), rows };
      writeFileSync(`${this.punchesFile}.tmp`, JSON.stringify(next, null, 2), { mode: 0o600 });
      renameSync(`${this.punchesFile}.tmp`, this.punchesFile);
      this.punches = next;
      return this.punches;
    } catch { throw new BadRequestException('Não foi possível consultar o portal. Confira acesso, URL e seletor da tabela. O cache anterior foi preservado.'); }
    finally { this.busy = false; }
  }
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
    return { enabled: this.state.enabled, dryRun: this.settings.dryRun, busy: this.busy,
      slots: this.settings.slots, days: this.settings.days, excludedDates: this.settings.excludedDates, timezone: 'America/Sao_Paulo' };
  }
  toggle() { this.state.enabled = !this.state.enabled; this.save(); return this.status(); }
  private async tick() {
    if (!this.state.enabled || this.busy) return;
    const now = new Date();
    const date = localTime(now).date;
    const active = this.settings.slots.filter(s => !s.date || s.date === date);
    const key = due(now, this.settings.days, this.settings.excludedDates, active.map(s => s.time));
    const slot = active.find(s => s.time === localTime(now).time);
    if (key && slot && !this.state.history.some(e => e.key === key)) await this.run(key, this.settings.dryRun, slot);
  }
  async test() {
    if (this.busy) throw new ConflictException('Uma execução está em andamento.');
    return this.run(`teste/${Date.now()}`, true, this.settings.slots[0]);
  }
  private async run(key: string, dryRun: boolean, slot: Slot) {
    this.busy = true;
    const entry: Entry = { key, at: new Date().toISOString(), status: 'iniciando', message: 'Preparando navegador.', kind: slot.kind };
    try {
      this.state.history.push(entry);
      this.save();
      entry.message = await register({ ...this.settings }, dryRun, slot.kind, () => {
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
    return req.headers['x-easyclock'] === 'local';
  }
}
@UseGuards(LocalGuard)
@Controller('api')
class Api {
  constructor(@Inject(Clock) private readonly clock: Clock) {}
  @Get('status') status() { return this.clock.status(); }
  @Post('toggle') toggle() { return this.clock.toggle(); }
  @Post('test') test() { return this.clock.test(); }
  @Get('settings') settings() { return this.clock.getSettings(); }
  @Post('settings') update(@Body() input: unknown) { return this.clock.updateSettings(input); }
  @Get('history') history(@Query('page') page: string) { return this.clock.getHistory(page); }
  @Get('punches') punches() { return this.clock.getPunches(); }
  @Post('punches/sync') sync() { return this.clock.syncPunches(); }
}
@Module({ imports: [ServeStaticModule.forRoot({ rootPath: resolve(root, 'apps/web/dist'), exclude: ['/api/{*path}'] })], controllers: [Api], providers: [Clock, LocalGuard] })
class App {}
async function main() {
  const app = await NestFactory.create(App);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), '127.0.0.1');
}
void main();
