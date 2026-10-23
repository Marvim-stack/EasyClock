import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Settings, validateSettings, defaultSlots } from './settings';
import { due } from './schedule';
const settings: Settings = { group: 'grupo', user: 'usuario', password: 'segredo', dryRun: true, days: ['Mon','Fri'], excludedDates: [], slots: defaultSlots };
test('preserva senha vazia, normaliza folgas e mantém extras com data', () => {
  const next = validateSettings({...settings, password: '', excludedDates: ['', ' 2026-12-25 '], slots: [...defaultSlots, {time:'19:30',kind:'inicio_extra',date:'2026-10-23'}]},settings);
  assert.equal(next.password, 'segredo');
  assert.deepEqual(next.excludedDates,['2026-12-25']);
  assert.equal(next.slots.at(-1)?.date,'2026-10-23');
});
test('rejeita minutos inválidos, sobreposições e datas inexistentes', () => {
  for (const slots of [
    [{time:'25:00',kind:'entrada'}],
    [{time:'09:00',kind:'entrada'},{time:'09:00',kind:'inicio_extra',date:'2026-10-23'}],
    [{time:'19:00',kind:'inicio_extra',date:'2026-02-30'}],
    [{time:'19:00',kind:'inventado'}],
  ]) assert.throws(()=>validateSettings({...settings,slots},settings));
  assert.throws(()=>validateSettings({...settings,days:[]},settings));
});
test('aceita o mesmo horário em datas distintas e horários personalizados no agendador', () => {
  assert.equal(validateSettings({...settings,slots:[{time:'19:00',kind:'inicio_extra',date:'2026-10-23'},{time:'19:00',kind:'inicio_extra',date:'2026-10-24'}]},settings).slots.length,2);
  assert.equal(due(new Date('2026-10-23T22:30:00Z'),settings.days,[],['19:30']),'2026-10-23/19:30');
  assert.equal(due(new Date('2026-10-23T12:00:00Z'),settings.days,[],['19:30']),undefined);
});
