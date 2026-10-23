import { variedSlots } from './schedule';

export const kinds = ['entrada', 'saida_almoco', 'retorno_almoco', 'saida'] as const;
export type Kind = typeof kinds[number];
export type Slot = { time: string; kind: Kind };
export type Settings = { group: string; user: string; password: string; dryRun: boolean; days: string[]; excludedDates: string[]; slots: Slot[]; variation: boolean; minWorkMinutes: number };
export const defaultSlots: Slot[] = [
  { time: '09:00', kind: 'entrada' }, { time: '12:00', kind: 'saida_almoco' },
  { time: '13:00', kind: 'retorno_almoco' }, { time: '18:20', kind: 'saida' },
];
export function fixedSlots(saved: { time: string; kind: string; date?: string }[]): Slot[] {
  return defaultSlots.map(slot => ({ ...slot, time: saved.find(s => s.kind === slot.kind && !s.date)?.time || slot.time }));
}
const validDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
export function validateSettings(input: unknown, previous: Settings): Settings {
  if (!input || typeof input !== 'object') throw new Error('Configurações inválidas.');
  const b = input as Record<string, any>;
  if (typeof b.group !== 'string' || b.group.length > 200 || typeof b.user !== 'string' || b.user.length > 200)
    throw new Error('Informe grupo e usuário (até 200 caracteres).');
  if (typeof b.password !== 'string' || b.password.length > 500) throw new Error('Senha inválida.');
  if ((b.group.trim() !== previous.group || b.user.trim() !== previous.user) && !b.password)
    throw new Error('Informe a senha ao trocar de conta.');
  if (typeof b.dryRun !== 'boolean') throw new Error('Modo de execução inválido.');
  if (typeof b.variation !== 'boolean' || !Number.isInteger(b.minWorkMinutes) || b.minWorkMinutes < 15 || b.minWorkMinutes > 1425)
    throw new Error('Informe uma jornada mínima válida, entre 15 minutos e 23h45.');
  if (!Array.isArray(b.days) || b.days.length < 1 || b.days.length > 7 || b.days.some((d: unknown) => !['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(String(d))))
    throw new Error('Escolha pelo menos um dia da semana.');
  if (!Array.isArray(b.excludedDates) || b.excludedDates.length > 500 || b.excludedDates.some((d: unknown) => typeof d !== 'string')) throw new Error('Datas excluídas inválidas.');
  const excludedDates = b.excludedDates.map((d: string) => d.trim()).filter(Boolean);
  if (excludedDates.some((d: string) => !validDate(d))) throw new Error('Datas excluídas inválidas.');
  if (!Array.isArray(b.slots) || b.slots.length !== 4) throw new Error('Configure os quatro horários fixos.');
  const slots: Slot[] = b.slots.map((s: any, i: number) => {
    if (!s || typeof s.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) || s.kind !== kinds[i]
      || s.date !== undefined) throw new Error('Use entrada, almoço, volta do almoço e saída, sem data específica.');
    return { time: s.time, kind: s.kind };
  });
  if (slots.some((s, i) => i > 0 && s.time <= slots[i - 1].time))
    throw new Error('Os quatro horários precisam estar em ordem: entrada, almoço, volta e saída.');
  if (b.variation) variedSlots(slots, b.minWorkMinutes, () => 0);
  return { group: b.group.trim(), user: b.user.trim(), password: b.password || previous.password,
    dryRun: b.dryRun, days: [...new Set<string>(b.days)], excludedDates: [...new Set<string>(excludedDates)], slots,
    variation: b.variation, minWorkMinutes: b.minWorkMinutes };
}
