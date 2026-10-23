import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { localTime } from './schedule';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';

test('API valida conexão, preserva sorteio e mantém agendamento ligado/desligado após reinícios', { timeout: 20000 }, async () => {
  const data = await mkdtemp(join(tmpdir(), 'easyclock-api-'));
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>(resolve => socket.close(() => resolve()));
  let child: ChildProcess | undefined;
  const request = (path: string, body?: unknown) => fetch(`http://127.0.0.1:${port}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'x-easyclock': 'local', 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function start() {
    child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
      cwd: resolve(__dirname, '..'), env: { ...process.env, EASYCLOCK_DATA_DIR: data, PORT: String(port), EASYMOB_GROUP: '', EASYMOB_USER: '', EASYMOB_PASSWORD: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    child.stdout!.on('data', chunk => { log += chunk; });
    child.stderr!.on('data', chunk => { log += chunk; });
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null) throw new Error(log);
      try { if ((await request('status')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`API não iniciou: ${log}`);
  }
  async function stop() {
    if (child && child.exitCode === null) { const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; }
  }
  try {
    await start();
    assert.equal((await request('access/session')).status, 503);
    assert.equal((await request('access/login', { email: 'pessoa@example.test', password: 'SenhaDeTeste123' })).status, 503);
    assert.equal((await request('access/admin/users')).status, 503);
    assert.equal((await request('access/billing/checkout', {})).status, 503);
    const settings = await (await request('settings')).json();
    assert.equal('password' in settings, false);
    const { hasPassword, ...input } = settings;
    const enabledVariation = await request('variation', { enabled: true });
    assert.equal(enabledVariation.status, 201);
    assert.equal((await enabledVariation.json()).variation, true);
    assert.equal((await (await request('settings')).json()).group, settings.group);
    for (const payload of [{}, { enabled: 'true' }])
      assert.equal((await request('variation', payload)).status, 400);
    assert.equal((await (await request('variation', { enabled: false })).json()).variation, false);
    const saved = await request('settings', { ...input, password: '', variation: true });
    assert.equal(saved.status, 201);
    const status = await (await request('status')).json();
    assert.equal(status.todaySlots.length, 4);
    assert.equal(status.enabled, false);
    const connection = await request('connect', {});
    assert.equal(connection.status, 400);
    assert.match((await connection.json()).message, /Informe grupo, usuário e senha/);
    assert.equal((await (await request('history')).json()).total, 0);
    assert.equal((await (await request('status')).json()).connectedAt, null);
    assert.equal((await request('toggle', {})).status, 400);
    await stop();
    await start();
    assert.deepEqual((await (await request('status')).json()).todaySlots, status.todaySlots);
    assert.equal((await (await request('settings')).json()).variation, true);
    await stop();
    await writeFile(join(data, 'settings.json'), JSON.stringify({ ...input, slots: [...input.slots, { time: '20:00', kind: 'inicio_extra' }] }));
    const verifiedAt = new Date().toISOString();
    await writeFile(join(data, 'state.json'), JSON.stringify({ enabled: true, connectedAt: verifiedAt, history: [{ key: 'anterior', at: new Date().toISOString(), status: 'confirmado', message: 'Preservado' }] }));
    await start();
    const migrated = await (await request('status')).json();
    assert.equal(migrated.slots.length, 4);
    assert.equal(migrated.enabled, false);
    assert.equal(migrated.connectedAt, verifiedAt);
    assert.equal((await (await request('history')).json()).total, 1);
    // Exclui o dia atual para testar ativação sem abrir o portal nem executar pontos.
    const configured = { ...input, group: 'grupo-teste', user: 'usuario-teste', password: 'senha-teste', excludedDates: [localTime().date] };
    assert.equal((await request('settings', configured)).status, 201);
    assert.equal((await (await request('status')).json()).connectedAt, null);
    assert.equal((await (await request('toggle', {})).json()).enabled, true);
    assert.equal(JSON.parse(await readFile(join(data, 'state.json'), 'utf8')).enabled, true);
    await stop();
    await start();
    assert.equal((await (await request('status')).json()).enabled, true);
    assert.equal((await request('settings', { ...configured, password: '' })).status, 201);
    assert.equal((await (await request('status')).json()).enabled, true);
    assert.equal((await (await request('toggle', {})).json()).enabled, false);
    await stop();
    await start();
    assert.equal((await (await request('status')).json()).enabled, false);
  } finally { await stop(); await rm(data, { recursive: true, force: true }); }
});
