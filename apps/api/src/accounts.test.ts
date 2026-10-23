import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canUsePlatform, validateRegistration, validatePassword, User, Subscription } from './accounts';

const now = new Date('2026-10-23T12:00:00Z');
const user: User = { id: 'user-1', email: 'usuario@example.test', name: 'Usuário', role: 'user', emailVerifiedAt: now.toISOString(), createdAt: now.toISOString() };
const subscription: Subscription = { userId: user.id, status: 'trialing', trialStartedAt: now.toISOString(), trialEndsAt: '2026-10-30T12:00:00Z', currentPeriodEndsAt: null, cancelAtPeriodEnd: false };

test('cadastro normaliza perfil sem devolver senha ou permitir escolha de papel', () => {
  const result = validateRegistration({ name: ' Pessoa Teste ', email: ' USUARIO@EXAMPLE.TEST ', password: 'SenhaFicticia123', confirmation: 'SenhaFicticia123' });
  assert.deepEqual(result, { name: 'Pessoa Teste', email: 'usuario@example.test' });
});
test('cadastro rejeita dados inválidos e senhas divergentes', () => {
  const valid = { name: 'Teste', email: 'teste@example.test', password: 'SenhaFicticia123', confirmation: 'SenhaFicticia123' };
  for (const patch of [{ name: '' }, { email: 'email-invalido' }, { email: 'x'.repeat(250) + '@example.test' }, { password: 'curta', confirmation: 'curta' }, { confirmation: 'SenhaDiferente123' }])
    assert.throws(() => validateRegistration({ ...valid, ...patch }));
  assert.throws(() => validatePassword('a'.repeat(129), 'a'.repeat(129)));
});
test('aceita senha de seis caracteres e rejeita cinco', () => {
  assert.doesNotThrow(() => validatePassword('abc123', 'abc123'));
  assert.throws(() => validatePassword('abc12', 'abc12'), /entre 6 e 128/);
  assert.deepEqual(validateRegistration({ name: 'Pessoa', email: 'pessoa@example.test', password: 'abc123', confirmation: 'abc123' }), { name: 'Pessoa', email: 'pessoa@example.test' });
});
test('acesso exige e-mail confirmado e assinatura do próprio usuário', () => {
  assert.equal(canUsePlatform(user, subscription, now), true);
  assert.equal(canUsePlatform({ ...user, emailVerifiedAt: null }, subscription, now), false);
  assert.equal(canUsePlatform(user, { ...subscription, userId: 'outro' }, now), false);
  assert.equal(canUsePlatform(user, null, now), false);
});
test('teste vence após sete dias, inclusive no instante exato de vencimento', () => {
  assert.equal(canUsePlatform(user, subscription, new Date('2026-10-30T11:59:59.999Z')), true);
  assert.equal(canUsePlatform(user, subscription, new Date(subscription.trialEndsAt!)), false);
  assert.equal(canUsePlatform(user, { ...subscription, trialEndsAt: 'inválido' }, now), false);
});
test('assinatura ativa respeita vencimento; inadimplência e cancelamento bloqueiam', () => {
  assert.equal(canUsePlatform(user, { ...subscription, status: 'active', currentPeriodEndsAt: '2026-11-23T12:00:00Z', cancelAtPeriodEnd: true }, now), true);
  for (const status of ['pending_payment_method', 'past_due', 'canceled'] as const)
    assert.equal(canUsePlatform(user, { ...subscription, status }, now), false);
  assert.equal(canUsePlatform(user, { ...subscription, status: 'active', currentPeriodEndsAt: now.toISOString() }, now), false);
});
test('admin tem acesso sem assinatura, mas também exige e-mail verificado', () => {
  assert.equal(canUsePlatform({ ...user, role: 'admin' }, null, now), true);
  assert.equal(canUsePlatform({ ...user, role: 'admin', emailVerifiedAt: null }, null, now), false);
});
