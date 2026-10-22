export const slots = ['09:00', '12:00', '13:00', '18:20'];
export function localTime(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday: parts.weekday };
}
export function due(now: Date, days: string[], excluded: string[]) {
  const local = localTime(now);
  return days.includes(local.weekday) && !excluded.includes(local.date) && slots.includes(local.time)
    ? `${local.date}/${local.time}` : undefined;
}
