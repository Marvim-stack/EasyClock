export const kinds = ['entrada', 'saida_almoco', 'retorno_almoco', 'saida', 'inicio_extra', 'fim_extra'] as const;
export type Kind = typeof kinds[number];
export type Slot = { time: string; kind: Kind; date?: string };
export type Settings = { group: string; user: string; password: string; dryRun: boolean; days: string[]; excludedDates: string[]; slots: Slot[] };
export const defaultSlots: Slot[] = [
  { time: '09:00', kind: 'entrada' }, { time: '12:00', kind: 'saida_almoco' },
  { time: '13:00', kind: 'retorno_almoco' }, { time: '18:20', kind: 'saida' },
];
const validDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
export function validateSettings(input: unknown, previous: Settings): Settings {
  if (!input || typeof input !== 'object') throw new Error('Configurações inválidas.');
  const b = input as Record<string, any>;
  if (typeof b.group !== 'string' || !b.group.trim() || b.group.length > 200 || typeof b.user !== 'string' || !b.user.trim() || b.user.length > 200)
    throw new Error('Informe grupo e usuário (até 200 caracteres).');
  if (typeof b.password !== 'string' || b.password.length > 500 || !(b.password || previous.password)) throw new Error('Informe a senha.');
  if (typeof b.dryRun !== 'boolean') throw new Error('Modo de execução inválido.');
  if (!Array.isArray(b.days) || b.days.length < 1 || b.days.length > 7 || b.days.some((d: unknown) => !['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(String(d))))
    throw new Error('Escolha pelo menos um dia da semana.');
  if (!Array.isArray(b.excludedDates) || b.excludedDates.length > 500 || b.excludedDates.some((d: unknown) => typeof d !== 'string')) throw new Error('Datas excluídas inválidas.');
  const excludedDates = b.excludedDates.map((d: string) => d.trim()).filter(Boolean);
  if (excludedDates.some((d: string) => !validDate(d))) throw new Error('Datas excluídas inválidas.');
  if (!Array.isArray(b.slots) || !b.slots.length || b.slots.length > 32) throw new Error('Configure entre 1 e 32 horários.');
  const slots: Slot[] = b.slots.map((s: any) => {
    if (!s || typeof s.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) || !kinds.includes(s.kind)
      || (s.date && !validDate(s.date))) throw new Error('Horário, tipo ou data inválidos.');
    return { time: s.time, kind: s.kind, ...(s.date ? { date: s.date } : {}) };
  });
  // Rejeita sobreposição entre horários recorrentes e extras em uma data.
  if (slots.some((s, i) => slots.some((t, j) => i !== j && s.time === t.time && (!s.date || !t.date || s.date === t.date))))
    throw new Error('Existem horários sobrepostos. Use minutos distintos.');
  return { group: b.group.trim(), user: b.user.trim(), password: b.password || previous.password,
    dryRun: b.dryRun, days: [...new Set<string>(b.days)], excludedDates: [...new Set<string>(excludedDates)], slots };
}
