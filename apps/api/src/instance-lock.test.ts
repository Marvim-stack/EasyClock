import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { acquireInstanceLock } from './instance-lock';

test('aceita arquivo antigo, bloqueia concorrência e permite reinício', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'easyclock-lock-')), 'instance.lock');
  writeFileSync(path, '');
  const release = await acquireInstanceLock(path, () => assert.fail('Trava perdida.'));
  try { await assert.rejects(acquireInstanceLock(path, () => {}), /Outra instância/); }
  finally { await release(); }
  const second = await acquireInstanceLock(path, () => assert.fail('Trava perdida.'));
  await second();
});

test('libera automaticamente a trava após SIGKILL do processo principal', { timeout: 15000 }, async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'easyclock-crash-')), 'instance.lock');
  const modulePath = resolve(__dirname, 'instance-lock.ts');
  const child = spawn(process.execPath, ['--import', 'tsx', '-e',
    `require(${JSON.stringify(modulePath)}).acquireInstanceLock(${JSON.stringify(path)},()=>process.exit(1)).then(()=>console.log('ready'))`], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await Promise.race([
      once(child.stdout, 'data'),
      once(child, 'exit').then(() => { throw new Error('Processo de teste encerrou antes de obter a trava.'); }),
    ]);
    const exit = once(child, 'exit');
    child.kill('SIGKILL');
    await exit;
    let release: (() => Promise<void>) | undefined;
    for (let i = 0; i < 50 && !release; i++) {
      try { release = await acquireInstanceLock(path, () => assert.fail('Trava perdida.')); }
      catch { await new Promise(resolve => setTimeout(resolve, 20)); }
    }
    assert.ok(release, 'A trava deveria ser liberada após encerramento abrupto.');
    await release();
  } finally { child.kill('SIGKILL'); }
});
