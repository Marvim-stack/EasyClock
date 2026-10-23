import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import { AccessController } from './access.controller';

const controller = new AccessController();
const unavailable = (error: unknown) => error instanceof HttpException && error.getStatus() === 503;
const invalid = (error: unknown) => error instanceof HttpException && error.getStatus() === 400;

test('login e cadastro não criam sessão ou usuário sem integração', () => {
  assert.throws(() => controller.login({ email: 'pessoa@example.test', password: 'SenhaDeTeste123' }), unavailable);
  assert.throws(() => controller.register({ name: 'Pessoa', email: 'pessoa@example.test', password: 'SenhaDeTeste123', confirmation: 'SenhaDeTeste123', role: 'admin' }), unavailable);
});
test('formulários validam a entrada sem expor senhas em erros', () => {
  assert.throws(() => controller.login({ email: 'invalido', password: 'segredo' }), invalid);
  assert.throws(() => controller.register({ name: 'Pessoa', email: 'pessoa@example.test', password: 'SenhaDeTeste123', confirmation: 'OutraSenhaDeTeste123' }), error => {
    assert.ok(invalid(error));
    assert.doesNotMatch((error as Error).message, /SenhaDeTeste123|OutraSenha/);
    return true;
  });
  assert.throws(() => controller.login(null), invalid);
});
test('cadastro e redefinição aplicam o mínimo de seis caracteres no backend', () => {
  assert.throws(() => controller.register({ name: 'Pessoa', email: 'pessoa@example.test', password: 'abc123', confirmation: 'abc123' }), unavailable);
  assert.throws(() => controller.register({ name: 'Pessoa', email: 'pessoa@example.test', password: 'abc12', confirmation: 'abc12' }), invalid);
  assert.throws(() => controller.resetPassword({ token: 'token-de-teste', password: 'abc123', confirmation: 'abc123' }), unavailable);
  assert.throws(() => controller.resetPassword({ token: 'token-de-teste', password: 'abc12', confirmation: 'abc12' }), invalid);
});
test('confirmação e redefinição exigem token e nunca fingem sucesso', () => {
  assert.throws(() => controller.confirmEmail({ token: '' }), invalid);
  assert.throws(() => controller.confirmEmail({ token: 'token-de-teste' }), unavailable);
  assert.throws(() => controller.resetPassword({ token: '', password: 'SenhaDeTeste123', confirmation: 'SenhaDeTeste123' }), invalid);
  assert.throws(() => controller.resetPassword({ token: 'token-de-teste', password: 'SenhaDeTeste123', confirmation: 'SenhaDeTeste123' }), unavailable);
  assert.throws(() => controller.forgotPassword({ email: 'pessoa@example.test' }), unavailable);
  assert.throws(() => controller.resendEmail({ email: 'pessoa@example.test' }), unavailable);
});
test('dados protegidos e cobrança ficam indisponíveis sem sessão e provedores reais', () => {
  for (const work of [() => controller.session(), () => controller.settings(), () => controller.users(), () => controller.subscription(), () => controller.checkout(), () => controller.billingPortal(), () => controller.logout()])
    assert.throws(work, unavailable);
});
