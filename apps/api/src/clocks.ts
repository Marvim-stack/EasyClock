import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Clock } from './clock';
import { accountDatabase } from './account-database';
import { acquireInstanceLock } from './instance-lock';

export const hasAccounts = () => Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_PUBLISHABLE_KEY);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class Clocks implements OnModuleInit, OnModuleDestroy {
  private readonly root = resolve(process.env.EASYCLOCK_DATA_DIR || resolve(__dirname, '../../../data'));
  private readonly accounts = resolve(this.root, 'accounts');
  private readonly clocks = new Map<string, Clock>();
  private releaseLock?: () => Promise<void>;

  async onModuleInit() {
    mkdirSync(this.accounts, { recursive: true, mode: 0o700 });
    this.releaseLock = await acquireInstanceLock(resolve(this.root, 'instance.lock'), () => {
      console.error('A trava de instância foi perdida. Encerrando para impedir disparos concorrentes.');
      process.exit(1);
    });
    if (hasAccounts()) {
      for (const entry of readdirSync(this.accounts, { withFileTypes: true }))
        if (entry.isDirectory() && uuid.test(entry.name)) this.forUser(entry.name);
    } else this.local();
  }
  forUser(userId: string): Clock {
    if (!uuid.test(userId)) throw new Error('Identidade de usuário inválida.');
    let clock = this.clocks.get(userId);
    if (!clock) {
      clock = new Clock(resolve(this.accounts, userId), () => accountDatabase.canAutomate(userId));
      this.clocks.set(userId, clock);
      clock.start();
    }
    return clock;
  }
  local(): Clock {
    let clock = this.clocks.get('local');
    if (!clock) { clock = new Clock(this.root); this.clocks.set('local', clock); clock.start(); }
    return clock;
  }
  async onModuleDestroy() {
    for (const clock of this.clocks.values()) clock.stop();
    await this.releaseLock?.();
    await accountDatabase.close();
  }
}
