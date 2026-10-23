export type UserRole = 'user' | 'admin';
export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerifiedAt: string | null;
  createdAt: string;
};
export type Subscription = {
  userId: string;
  status: 'pending_payment_method' | 'trialing' | 'active' | 'past_due' | 'canceled';
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
};
export type UserConfiguration = {
  userId: string;
  entry: string;
  lunch: string;
  returnFromLunch: string;
  exit: string;
  workDays: string[];
};
export const TRIAL_DAYS = 7;

export function validatePassword(password: string, confirmation: string): void {
  if (password.length < 6 || password.length > 128) throw new Error('Use uma senha entre 6 e 128 caracteres.');
  if (password !== confirmation) throw new Error('As senhas precisam ser iguais.');
}

export function validateRegistration(input: { name: string; email: string; password: string; confirmation: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2 || name.length > 100) throw new Error('Informe seu nome, entre 2 e 100 caracteres.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  validatePassword(input.password, input.confirmation);
  return { name, email };
}

export function canUsePlatform(user: User, subscription: Subscription | null, now = new Date()): boolean {
  if (!user.emailVerifiedAt) return false;
  if (user.role === 'admin') return true;
  if (!subscription || subscription.userId !== user.id) return false;
  const until = subscription.status === 'trialing' ? subscription.trialEndsAt
    : subscription.status === 'active' ? subscription.currentPeriodEndsAt : null;
  return Boolean(until && Date.parse(until) > now.getTime());
}
