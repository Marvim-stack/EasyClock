import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { testConnection } from './browser';
import { defaultSlots, Settings } from './settings';

const settings: Settings = { group: 'grupo', user: 'usuario', password: 'senha', dryRun: true, days: ['Mon'], excludedDates: [], slots: defaultSlots, variation: false, minWorkMinutes: 480 };
test('conectar exige credenciais antes de abrir o navegador', async () => {
  await assert.rejects(testConnection({ ...settings, password: '' }), /Informe grupo, usuário e senha/);
});
test('conectar identifica biblioteca ausente e orienta a instalação sem expor logs internos', async () => {
  const launch = mock.method(chromium, 'launch', async () => {
    throw new Error('browserType.launch: Target closed\nchrome: error while loading shared libraries: libasound.so.2: cannot open shared object file');
  });
  try {
    await assert.rejects(testConnection(settings), error => {
      assert.match((error as Error).message, /sudo npx playwright install-deps chromium/);
      assert.doesNotMatch((error as Error).message, /browserType|Target closed/);
      return true;
    });
  } finally { launch.mock.restore(); }
});
test('conectar identifica Chromium não instalado', async () => {
  const launch = mock.method(chromium, 'launch', async () => { throw new Error("Executable doesn't exist at /caminho/interno/chrome"); });
  try { await assert.rejects(testConnection(settings), /npx playwright install chromium/); }
  finally { launch.mock.restore(); }
});
test('conectar só confirma acesso após encontrar a área autenticada e nunca registra ponto', async () => {
  let authenticated = true;
  let closed = 0;
  const clicked: string[] = [];
  const page = {
    setDefaultTimeout() {}, async goto() {}, async waitForLoadState() {},
    getByRole() { return { async isVisible() { return false; } }; },
    locator(selector: string) { return {
      async fill() {}, async click() { clicked.push(selector); },
      async waitFor() { if (selector === '#btnConsultar' && !authenticated) throw new Error('Login recusado'); },
    }; },
  };
  const launch = mock.method(chromium, 'launch', async () => ({ async newPage() { return page; }, async close() { closed++; } }) as any);
  try {
    await testConnection(settings);
    assert.deepEqual(clicked, ['#btnLogin']);
    assert.equal(closed, 1);
    authenticated = false;
    await assert.rejects(testConnection(settings), /login não foi confirmado/);
    assert.equal(closed, 2);
  } finally { launch.mock.restore(); }
});
