import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionEnvironment } from './production-env';

test('publicação exige autenticação, banco, chave e HTTPS; modo local continua funcionando', () => {
  validateProductionEnvironment({});
  const env = { NODE_ENV: 'production', APP_URL: 'https://easyclock-test.duckdns.org', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test-key', DATABASE_URL: 'postgresql://postgres@pooler/postgres', EASYCLOCK_CREDENTIALS_KEY: Buffer.alloc(32, 7).toString('base64') };
  validateProductionEnvironment(env);
  for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'DATABASE_URL', 'EASYCLOCK_CREDENTIALS_KEY'])
    assert.throws(() => validateProductionEnvironment({ ...env, [key]: '' }), /Configure o ambiente/);
  for (const value of ['http://easyclock-test.duckdns.org', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://easyclock-test.duckdns.org/', 'https://easyclock-test.duckdns.org/path', 'https://user:password@easyclock-test.duckdns.org', 'invalido'])
    assert.throws(() => validateProductionEnvironment({ ...env, APP_URL: value }), /APP_URL/);
  assert.throws(() => validateProductionEnvironment({ ...env, EASYCLOCK_CREDENTIALS_KEY: 'invalida' }), /32 bytes/);
});
