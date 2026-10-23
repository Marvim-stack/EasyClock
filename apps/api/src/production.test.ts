import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionEnvironment } from './production';
const valid = { NODE_ENV: 'production', APP_URL: 'https://easyclock.pro', SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test', DATABASE_URL: 'postgresql://test', EASYCLOCK_CREDENTIALS_KEY: Buffer.alloc(32).toString('base64') };
test('produção não inicia sem autenticação ou conexão com banco configuradas', () => {
  for (const key of Object.keys(valid).filter(k => k !== 'NODE_ENV')) {
    assert.throws(() => validateProductionEnvironment({ ...valid, [key]: '' }), new RegExp(key));
  }
});
test('produção exige HTTPS e uma chave de criptografia válida', () => {
  assert.throws(() => validateProductionEnvironment({ ...valid, APP_URL: 'http://localhost:3000' }), /HTTPS/);
  assert.throws(() => validateProductionEnvironment({ ...valid, EASYCLOCK_CREDENTIALS_KEY: 'short' }), /32 bytes/);
  assert.doesNotThrow(() => validateProductionEnvironment(valid));
});
test('desenvolvimento continua permitindo modo local', () => {
  assert.doesNotThrow(() => validateProductionEnvironment({}));
});
