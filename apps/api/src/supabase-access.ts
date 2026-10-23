import { HttpException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import { createClient, type AuthError, type SupabaseClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Subscription, User } from './accounts';

export const unavailable = () => new ServiceUnavailableException('Este serviço ainda não está disponível. Tente novamente em breve.');
export function appUrl(): string {
  try {
    const url = new URL(process.env.APP_URL || 'http://localhost:3000');
    if (!['http:', 'https:'].includes(url.protocol)) throw unavailable();
    return url.origin;
  } catch { throw unavailable(); }
}

function configuration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw unavailable();
  try {
    if (new URL(url).protocol !== 'https:') throw unavailable();
  } catch { throw unavailable(); }
  return { url, key };
}
const network = { fetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) };

export function authError(error: AuthError | null, fallback: string): void {
  if (!error) return;
  if (error.status === 429) throw new HttpException('Muitas tentativas. Aguarde um pouco e tente novamente.', 429);
  if (!error.status || error.status >= 500) throw unavailable();
  const messages: Record<string, string> = {
    invalid_credentials: 'E-mail ou senha incorretos.',
    email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
    otp_expired: 'Este link expirou ou já foi utilizado. Solicite outro.',
    same_password: 'Escolha uma senha diferente da atual.',
    weak_password: 'Use uma senha com pelo menos 6 caracteres.',
  };
  throw new HttpException(messages[error.code || ''] || fallback, 400);
}

export class SupabaseAccess {
  readonly client: SupabaseClient;
  constructor(req: IncomingMessage, res: ServerResponse) {
    const { url, key } = configuration();
    this.client = createServerClient(url, key, {
      global: network,
      cookieOptions: { httpOnly: true, secure: new URL(appUrl()).protocol === 'https:', sameSite: 'lax', path: '/api', maxAge: 60 * 60 * 24 * 30 },
      cookies: {
        getAll: () => parseCookieHeader(req.headers.cookie || '').map(({ name, value }) => ({ name, value: value || '' })),
        setAll: cookies => {
          const previous = res.getHeader('Set-Cookie');
          const updated = cookies.flatMap(({ name, value, options }) => [
            serializeCookieHeader(name, '', { ...options, path: '/api/access', maxAge: 0 }),
            serializeCookieHeader(name, value, { ...options, maxAge: value ? Math.min(options.maxAge ?? 2592000, 2592000) : 0 }),
          ]);
          res.setHeader('Set-Cookie', [...(Array.isArray(previous) ? previous : previous ? [String(previous)] : []), ...updated]);
        },
      },
    });
  }

  // Fluxos de e-mail não substituem a sessão de outra conta já aberta no navegador.
  emailClient() {
    const { url, key } = configuration();
    return createClient(url, key, { global: network, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }

  async user(): Promise<User> {
    const { data, error } = await this.client.auth.getUser();
    if (error && (!error.status || error.status >= 500) && error.name !== 'AuthSessionMissingError') throw unavailable();
    if (error || !data.user) throw new UnauthorizedException('Entre na sua conta para continuar.');
    const identity = data.user;
    const profile = await this.client.from('account_profiles').select('name,role').eq('id', identity.id).single();
    if (profile.error || !profile.data || !['user', 'admin'].includes(profile.data.role)) throw unavailable();
    return { id: identity.id, email: identity.email || '', name: profile.data.name, role: profile.data.role, emailVerifiedAt: identity.email_confirmed_at || null, createdAt: identity.created_at };
  }

  async subscription(user: User): Promise<Subscription | null> {
    const { data, error } = await this.client.from('account_subscriptions').select('status,trial_started_at,trial_ends_at,current_period_ends_at,cancel_at_period_end').eq('user_id', user.id).maybeSingle();
    if (error) throw unavailable();
    return data ? { userId: user.id, status: data.status, trialStartedAt: data.trial_started_at, trialEndsAt: data.trial_ends_at, currentPeriodEndsAt: data.current_period_ends_at, cancelAtPeriodEnd: data.cancel_at_period_end } : null;
  }

}
