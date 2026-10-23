import type { User, Subscription, UserConfiguration } from '../../../api/src/accounts';

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/access/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof result?.message === 'string' ? result.message : 'Não foi possível concluir a solicitação. Tente novamente.');
  return result as T;
}

export const access = {
  session: () => request<{ user: User }>('session'),
  login: (email: string, password: string) => request<{ user: User }>('login', { email, password }),
  register: (input: { name: string; email: string; password: string; confirmation: string }) => request<{ email: string }>('register', input),
  confirmEmail: (token: string) => request<void>('email/confirm', { token }),
  resendEmail: (email: string) => request<void>('email/resend', { email }),
  forgotPassword: (email: string) => request<void>('password/forgot', { email }),
  resetPassword: (password: string, confirmation: string, token: string) => request<void>('password/reset', { password, confirmation, token }),
  logout: () => request<void>('logout', {}),
  subscription: () => request<{ subscription: Subscription | null }>('subscription'),
  settings: () => request<{ settings: UserConfiguration | null }>('settings'),
  users: () => request<{ users: User[] }>('admin/users'),
  checkout: () => request<{ url: string }>('billing/checkout', {}),
  billingPortal: () => request<{ url: string }>('billing/portal', {}),
};
