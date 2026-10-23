import { randomInt } from 'node:crypto';
import type { Slot } from './settings';

export const slots = ['09:00', '12:00', '13:00', '18:20'];
export function localTime(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday: parts.weekday };
}
export function due(now: Date, days: string[], excluded: string[], times = slots) {
  const local = localTime(now);
  return days.includes(local.weekday) && !excluded.includes(local.date) && times.includes(local.time)
    ? `${local.date}/${local.time}` : undefined;
}


export function variedSlots(slots: Slot[], minimum: number, pick = randomInt): Slot[] {
  const base = slots.map(s => Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3)));
  const plans: number[][] = [];
  // Enumera as 11 opções por horário para sortear somente planos válidos, sem tentativas ilimitadas.
  for (let n = 0; n < 11 ** 4; n++) {
    const times = base.map((time, i) => time + Math.floor(n / 11 ** i) % 11);
    if (times[3] >= 1440 || times.some((time, i) => i > 0 && time <= times[i - 1])) continue;
    if (times[1] - times[0] + times[3] - times[2] >= minimum) plans.push(times);
  }
  if (!plans.length) throw new Error('A jornada mínima não cabe na variação de até 10 minutos. Ajuste os quatro horários ou a jornada.');
  return plans[pick(plans.length)].map((time, i) => ({
    kind: slots[i].kind, time: `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`,
  }));
}
