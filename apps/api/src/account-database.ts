import { ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import type { User } from './accounts';
import { unavailable } from './supabase-access';

class AccountDatabase {
  private pool?: Pool;
  private async query(text: string, values: unknown[] = []) {
    if (!process.env.DATABASE_URL) throw unavailable();
    this.pool ??= new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true, ca: readFileSync(resolve(__dirname, '../certs/supabase-root.crt'), 'utf8') },
      max: 3, connectionTimeoutMillis: 10000, statement_timeout: 10000, idleTimeoutMillis: 10000,
    }).on('error', () => console.error('Conexão ociosa com o banco encerrada; novas consultas tentarão reconectar.'));
    try { return await this.pool.query(text, values); }
    catch { throw unavailable(); }
  }
  async canAutomate(userId: string): Promise<boolean> {
    const result = await this.query(`select exists (
      select 1 from public.account_profiles p join auth.users u on u.id = p.id
      left join public.account_subscriptions s on s.user_id = p.id
      where p.id = $1 and u.email_confirmed_at is not null and (p.role = 'admin'
        or (s.status = 'trialing' and s.trial_ends_at > now())
        or (s.status = 'active' and s.current_period_ends_at > now()))
    ) as allowed`, [userId]);
    return result.rows[0].allowed;
  }
  async users(actor: User): Promise<User[]> {
    if (actor.role !== 'admin' || !actor.emailVerifiedAt) throw new ForbiddenException('Acesso restrito à administração.');
    const result = await this.query(`select p.id, u.email, p.name, p.role,
      u.email_confirmed_at as "emailVerifiedAt", p.created_at as "createdAt"
      from public.account_profiles p join auth.users u on u.id = p.id
      where exists (select 1 from public.account_profiles a join auth.users au on au.id = a.id
        where a.id = $1 and a.role = 'admin' and au.email_confirmed_at is not null)
      order by p.created_at desc`, [actor.id]);
    return result.rows;
  }
  async close() { await this.pool?.end(); this.pool = undefined; }
}
export const accountDatabase = new AccountDatabase();
