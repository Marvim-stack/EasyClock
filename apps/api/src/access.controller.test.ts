import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpException, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AccessController, AccessRequestGuard } from './access.controller';
import { accountDatabase } from './account-database';

const controller = new AccessController();
const req = { headers: {} } as IncomingMessage;
const res = {} as ServerResponse;
const status = (expected: number) => (error: unknown) => error instanceof HttpException && error.getStatus() === expected;

process.env.SUPABASE_URL = '';
process.env.SUPABASE_PUBLISHABLE_KEY = '';

test('sem configuração, nenhuma operação simula conta ou sessão', async () => {
  await assert.rejects(() => controller.login({ email: 'pessoa@example.test', password: 'abc123' }, req, res), status(503));
  await assert.rejects(() => controller.register({ name: 'Pessoa', email: 'pessoa@example.test', password: 'abc123', confirmation: 'abc123', role: 'admin' }, req, res), status(503));
  for (const work of [() => controller.session(req, res), () => controller.subscription(req, res), () => controller.users(req, res), () => controller.logout(req, res)]) await assert.rejects(work, status(503));
  assert.throws(() => controller.checkout(), status(503));
});

test('mínimo de seis caracteres, confirmação e tokens são validados antes do provedor', async () => {
  await assert.rejects(() => controller.login(null, req, res), status(400));
  await assert.rejects(() => controller.login({ email: 'invalido', password: 'segredo' }, req, res), status(400));
  await assert.rejects(() => controller.register({ name: 'Pessoa', email: 'pessoa@example.test', password: 'abc12', confirmation: 'abc12' }, req, res), status(400));
  await assert.rejects(() => controller.register({ name: 'Pessoa', email: 'pessoa@example.test', password: 'abc123', confirmation: 'outra-senha' }, req, res), error => {
    assert.ok(status(400)(error));
    assert.doesNotMatch((error as Error).message, /abc123|outra-senha/);
    return true;
  });
  await assert.rejects(() => controller.confirmEmail({ token: '' }, req, res), status(400));
  await assert.rejects(() => controller.confirmEmail({ token: 'token' }, req, res), status(503));
  await assert.rejects(() => controller.resetPassword({ token: 'token', password: 'abc12', confirmation: 'abc12' }, req, res), status(400));
  await assert.rejects(() => controller.resetPassword({ token: 'token', password: 'abc123', confirmation: 'abc123' }, req, res), status(503));
  await assert.rejects(() => controller.forgotPassword({ email: 'pessoa@example.test' }, req, res), status(503));
  await assert.rejects(() => controller.resendEmail({ email: 'pessoa@example.test' }, req, res), status(503));
});

@Module({ controllers: [AccessController], providers: [AccessRequestGuard] })
class TestApp {}

test('HTTP: autenticação, cookies, renovação, isolamento, e-mail, CSRF e erros do Supabase', { timeout: 15000 }, async t => {
  const provider = 'https://test-project.supabase.co';
  const idA = '11111111-1111-4111-8111-111111111111';
  const idB = '22222222-2222-4222-8222-222222222222';
  const identity = (id = idA) => ({ id, email: id === idA ? 'pessoa@example.test' : 'outra@example.test', aud: 'authenticated', role: 'authenticated', created_at: '2026-01-01T00:00:00Z', email_confirmed_at: '2026-01-01T00:01:00Z', user_metadata: { name: 'Pessoa', role: 'admin' }, app_metadata: {} });
  const session = (id = idA) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: id, exp: expires, iat: expires - 3600, aud: 'authenticated', role: 'authenticated' })).toString('base64url'), 'signature'].join('.');
    return { access_token: jwt, refresh_token: `refresh-${id}`, expires_in: 3600, expires_at: expires, token_type: 'bearer', user: identity(id) };
  };
  const calls: { url: URL; method: string; body: Record<string, any>; authorization: string | null }[] = [];
  let trial = false;
  let brokenProfile = false;
  let providerDown = false;
  let autoConfirm = false;
  let admin = false;
  const realFetch = globalThis.fetch;
  const saved = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY, APP_URL: process.env.APP_URL };
  Object.assign(process.env, { SUPABASE_URL: provider, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', APP_URL: 'https://easyclock.test' });
  t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin !== provider) return realFetch(input, init);
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const method = init?.method || 'GET';
    const authorization = headers.get('authorization');
    calls.push({ url, method, body, authorization });
    const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' } });
    if (providerDown) return reply({ msg: 'segredo-interno-do-provedor' }, 500);
    if (url.pathname.endsWith('/token')) {
      if (body.password === 'errada') return reply({ code: 'invalid_credentials', msg: 'invalid' }, 400);
      if (body.password === 'limite') return reply({ code: 'over_request_rate_limit', msg: 'limit' }, 429);
      const id = body.email === 'outra@example.test' || body.refresh_token === `refresh-${idB}` ? idB : idA;
      return reply(session(id));
    }
    if (url.pathname.endsWith('/signup')) return reply(autoConfirm ? session() : identity());
    if (url.pathname.endsWith('/verify')) {
      if (body.token_hash === 'expirado') return reply({ code: 'otp_expired', msg: 'expired' }, 403);
      return reply(session());
    }
    if (url.pathname.endsWith('/recover') || url.pathname.endsWith('/resend') || url.pathname.endsWith('/logout')) return reply({});
    if (url.pathname.endsWith('/user')) {
      const token = authorization?.slice(7).split('.')[1];
      assert.ok(token);
      const id = JSON.parse(Buffer.from(token, 'base64url').toString()).sub;
      return reply(identity(id));
    }
    if (url.pathname.endsWith('/account_profiles')) return brokenProfile ? reply({ code: 'PGRST116', message: 'internal' }, 406) : reply({ name: 'Pessoa', role: admin ? 'admin' : 'user' });
    if (url.pathname.endsWith('/account_subscriptions')) return reply(trial ? { status: 'trialing', trial_started_at: new Date().toISOString(), trial_ends_at: new Date(Date.now() + 86400000).toISOString(), current_period_ends_at: null, cancel_at_period_end: false } : null);
    if (url.pathname.endsWith('/account_settings')) return reply({ entry: '09:00:00', lunch: '12:00:00', return_from_lunch: '13:00:00', exit: '18:00:00', work_days: ['Mon'] });
    throw new Error(`Chamada inesperada: ${method} ${url.pathname}`);
  });
  t.mock.method(accountDatabase, 'users', async () => [{ ...identity(), name: 'Pessoa', role: 'user' }]);
  const app = await NestFactory.create(TestApp, { logger: false });
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const request = (path: string, body?: unknown, cookie?: string, extra: Record<string, string> = {}) => realFetch(`${base}/api/access/${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', 'x-easyclock-request': '1', ...(cookie ? { cookie } : {}), ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const cookies = (response: Response) => response.headers.getSetCookie().filter(value => !/Max-Age=0/i.test(value)).map(value => value.split(';')[0]).join('; ');
    assert.equal((await request('session')).status, 401);
    assert.equal((await request('login', { email: 'pessoa@example.test', password: 'abc123' }, undefined, { 'x-easyclock-request': '' })).status, 403);
    assert.equal((await request('login', { email: 'pessoa@example.test', password: 'abc123' }, undefined, { origin: 'https://outra-origem.test' })).status, 403);
    assert.equal(calls.length, 0);
    const registration = await request('register', { name: ' Pessoa ', email: ' PESSOA@example.test ', password: 'abc123', confirmation: 'abc123', role: 'admin' });
    assert.equal(registration.status, 201);
    assert.equal(registration.headers.get('set-cookie'), null);
    assert.deepEqual(await registration.json(), { email: 'pessoa@example.test' });
    assert.deepEqual(calls.find(call => call.url.pathname.endsWith('/signup'))?.body.data, { name: 'Pessoa' });
    autoConfirm = true;
    const withoutConfirmation = await request('register', { name: 'Pessoa', email: 'pessoa@example.test', password: 'abc123', confirmation: 'abc123' });
    assert.equal(withoutConfirmation.status, 503);
    assert.equal(withoutConfirmation.headers.get('set-cookie'), null);
    autoConfirm = false;
    assert.equal((await request('login', { email: 'pessoa@example.test', password: 'errada' })).status, 400);
    assert.equal((await request('login', { email: 'pessoa@example.test', password: 'limite' })).status, 429);
    const login = await request('login', { email: 'pessoa@example.test', password: 'abc123' }, undefined, { origin: 'https://easyclock.test' });
    assert.equal(login.status, 201);
    const result = await login.json();
    assert.equal(result.user.role, 'user');
    assert.equal(result.user.id, idA);
    assert.doesNotMatch(JSON.stringify(result), /access_token|refresh_token/);
    assert.match(login.headers.get('cache-control')!, /no-store/);
    const cookieA = cookies(login);
    assert.ok(cookieA);
    for (const cookie of login.headers.getSetCookie().filter(value => !/Max-Age=0/i.test(value))) {
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /Secure/i);
      assert.match(cookie, /SameSite=Lax/i);
      assert.match(cookie, /Path=\/api;/i);
    }
    assert.equal((await (await request('session', undefined, cookieA)).json()).user.id, idA);
    const otherLogin = await request('login', { email: 'outra@example.test', password: 'abc123' });
    const cookieB = cookies(otherLogin);
    assert.equal((await (await request('session', undefined, cookieB)).json()).user.id, idB);
    assert.equal((await (await request('session', undefined, cookieA)).json()).user.id, idA);
    assert.deepEqual(await (await request('subscription', undefined, cookieA)).json(), { subscription: null });
    assert.equal((await request('admin/users', undefined, cookieA)).status, 403);
    admin = true;
    assert.equal((await (await request('session', undefined, cookieA)).json()).user.role, 'admin');
    assert.equal((await request('admin/users', undefined, cookieA)).status, 200);
    admin = false;
    trial = true;
    for (const call of calls.filter(call => call.url.pathname.startsWith('/rest/v1/'))) {
      const encoded = call.authorization!.slice(7).split('.')[1];
      const id = JSON.parse(Buffer.from(encoded, 'base64url').toString()).sub;
      assert.equal(call.url.searchParams.get(call.url.pathname.endsWith('/account_profiles') ? 'id' : 'user_id'), `eq.${id}`);
    }
    // Um JWT vencido precisa ser renovado pelo provedor antes de restaurar a conta.
    const [name, encoded] = cookieA.split('; ')[0].split('=');
    const stale = JSON.parse(Buffer.from(decodeURIComponent(encoded).slice(7), 'base64url').toString());
    stale.expires_at = Math.floor(Date.now() / 1000) - 60;
    const jwt = stale.access_token.split('.');
    jwt[1] = Buffer.from(JSON.stringify({ sub: idA, exp: stale.expires_at })).toString('base64url');
    stale.access_token = jwt.join('.');
    const staleCookie = `${name}=base64-${Buffer.from(JSON.stringify(stale)).toString('base64url')}`;
    const refreshed = await request('session', undefined, staleCookie);
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.headers.get('set-cookie'));
    assert.ok(calls.some(call => call.url.searchParams.get('grant_type') === 'refresh_token'));
    assert.equal((await request('email/confirm', { token: 'expirado' })).status, 400);
    const confirmation = await request('email/confirm', { token: 'valido' }, cookieA);
    assert.equal(confirmation.status, 204);
    assert.equal(confirmation.headers.get('set-cookie'), null);
    assert.ok(calls.some(call => call.body.token_hash === 'valido' && call.body.type === 'email'));
    assert.equal((await request('email/resend', { email: 'pessoa@example.test' })).status, 204);
    assert.equal((await request('password/forgot', { email: 'pessoa@example.test' })).status, 204);
    const count = calls.length;
    assert.equal((await request('password/reset', { token: 'valido', password: 'abc123', confirmation: 'outra' })).status, 400);
    assert.equal(calls.length, count);
    assert.equal((await request('password/reset', { token: 'valido', password: 'abc123', confirmation: 'abc123' })).status, 204);
    assert.ok(calls.some(call => call.body.type === 'recovery'));
    assert.ok(calls.some(call => call.method === 'PUT' && call.url.pathname.endsWith('/user') && call.body.password === 'abc123'));
    brokenProfile = true;
    assert.equal((await request('session', undefined, cookieA)).status, 503);
    brokenProfile = false;
    providerDown = true;
    const outage = await request('login', { email: 'pessoa@example.test', password: 'abc123' });
    assert.equal(outage.status, 503);
    assert.doesNotMatch(await outage.text(), /segredo-interno/);
    providerDown = false;
    const logout = await request('logout', {}, cookieA);
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie')!, /Max-Age=0/);
    assert.equal((await request('session')).status, 401);
  } finally {
    await app.close();
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});
