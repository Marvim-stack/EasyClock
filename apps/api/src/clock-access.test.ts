import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Module, UnauthorizedException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { chromium } from 'playwright';
import { ClockController, ClockGuard } from './clock.controller';
import { Clocks } from './clocks';
import { Clock } from './clock';
import { SupabaseAccess } from './supabase-access';
import { accountDatabase } from './account-database';
import { localTime } from './schedule';
import type { User } from './accounts';

@Module({ controllers: [ClockController], providers: [Clocks, ClockGuard] })
class TestApp {}

test('painel por conta: leitura e conexão gratuitas, credenciais isoladas e criptografadas, automação protegida e persistência', { timeout: 15000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'easyclock-accounts-'));
  const keys = ['EASYCLOCK_DATA_DIR', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'EASYCLOCK_CREDENTIALS_KEY', 'EASYMOB_GROUP', 'EASYMOB_USER', 'EASYMOB_PASSWORD'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { EASYCLOCK_DATA_DIR: root, SUPABASE_URL: 'https://test-project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', EASYCLOCK_CREDENTIALS_KEY: Buffer.alloc(32, 7).toString('base64'), EASYMOB_GROUP: 'legacy-private', EASYMOB_USER: 'legacy-private', EASYMOB_PASSWORD: 'legacy-private' });
  const admin: User = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.test', name: 'Admin', role: 'admin', emailVerifiedAt: '2026-01-01', createdAt: '2026-01-01' };
  const free: User = { ...admin, id: '22222222-2222-4222-8222-222222222222', email: 'free@example.test', role: 'user' };
  let actor: User | null = admin;
  let paid = false;
  const clicked: string[] = [];
  t.mock.method(SupabaseAccess.prototype, 'user', async () => { if (!actor) throw new UnauthorizedException(); return actor; });
  t.mock.method(accountDatabase, 'canAutomate', async (id: string) => id === admin.id || paid);
  t.mock.method(chromium, 'launch', async () => ({
    async newPage() { return {
      setDefaultTimeout() {}, async goto() {}, async waitForLoadState() {},
      getByRole() { return { async isVisible() { return false; } }; },
      locator(selector: string) { return { async fill() {}, async click() { clicked.push(selector); }, async waitFor() {} }; },
    }; }, async close() {},
  }) as any);
  let app = await NestFactory.create(TestApp, { logger: false });
  try {
    await app.listen(0, '127.0.0.1');
    let base = await app.getUrl();
    const request = (path: string, body?: unknown) => fetch(`${base}/api/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', 'x-easyclock-request': '1', 'x-easyclock': 'local' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const initial = await (await request('settings')).json();
    assert.equal(initial.group, '');
    assert.equal(initial.hasPassword, false);
    assert.equal((await (await request('status')).json()).automationAllowed, true);
    const credentialsA = { ...initial, group: 'grupo-A', user: 'usuario-A', password: 'segredo-A', excludedDates: [localTime().date] };
    assert.equal((await request('settings', credentialsA)).status, 201);
    const encrypted = await readFile(join(root, 'accounts', admin.id, 'settings.enc'), 'utf8');
    assert.doesNotMatch(encrypted, /segredo-A|usuario-A|grupo-A/);
    assert.equal((await request('toggle', {})).status, 201);
    actor = free;
    const ownSettings = await (await request('settings')).json();
    assert.equal(ownSettings.group, '');
    assert.equal((await (await request('status')).json()).automationAllowed, false);
    assert.equal((await request('history')).status, 200);
    assert.equal((await request('punches')).status, 200);
    const credentialsB = { ...ownSettings, group: 'grupo-B', user: 'usuario-B', password: 'segredo-B', excludedDates: [localTime().date] };
    assert.equal((await request('settings', credentialsB)).status, 201);
    assert.equal((await request('toggle', {})).status, 403);
    assert.equal((await request('connect', {})).status, 201);
    const connected = await (await request('status')).json();
    assert.ok(connected.connectedAt);
    assert.equal(connected.enabled, false);
    assert.deepEqual(clicked, ['#btnLogin']);
    assert.equal((await (await request('history')).json()).total, 0);
    paid = true;
    assert.equal((await request('toggle', {})).status, 201);
    paid = false;
    assert.equal((await (await request('status')).json()).enabled, false);
    actor = null;
    assert.equal((await request('settings')).status, 401);
    actor = admin;
    assert.equal((await (await request('settings')).json()).user, 'usuario-A');
    assert.equal((await (await request('status')).json()).connectedAt, null);
    await app.close();
    app = await NestFactory.create(TestApp, { logger: false });
    await app.listen(0, '127.0.0.1'); base = await app.getUrl();
    assert.equal((await (await request('settings')).json()).user, 'usuario-A');
    assert.equal((await (await request('status')).json()).enabled, true);
    actor = free;
    assert.ok((await (await request('status')).json()).connectedAt);
    assert.equal((await (await request('settings')).json()).user, 'usuario-B');
  } finally {
    await app.close();
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : process.env[key] = value;
    await rm(root, { recursive: true, force: true });
  }
});

test('agendador bloqueia uma conta cujo acesso venceu, mesmo sem painel aberto', async t => {
  const root = await mkdtemp(join(tmpdir(), 'easyclock-expired-'));
  const previous = process.env.EASYCLOCK_CREDENTIALS_KEY;
  process.env.EASYCLOCK_CREDENTIALS_KEY = Buffer.alloc(32, 8).toString('base64');
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-23T12:00:00Z') });
  let allowed = true;
  const clock = new Clock(root, async () => allowed);
  try {
    const settings = clock.getSettings();
    clock.updateSettings({ ...settings, password: 'segredo', group: 'grupo', user: 'usuario' });
    await clock.toggle();
    allowed = false;
    await (clock as any).tick();
    assert.equal(clock.status().enabled, false);
    assert.equal(clock.getHistory().total, 0);
  } finally {
    clock.stop();
    previous === undefined ? delete process.env.EASYCLOCK_CREDENTIALS_KEY : process.env.EASYCLOCK_CREDENTIALS_KEY = previous;
    await rm(root, { recursive: true, force: true });
  }
});
