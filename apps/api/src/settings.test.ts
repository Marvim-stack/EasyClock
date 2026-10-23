import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Settings, validateSettings, defaultSlots, fixedSlots } from './settings';
const settings: Settings = { group: 'grupo', user: 'usuario', password: 'segredo', dryRun: true, days: ['Mon','Fri'], excludedDates: [], slots: defaultSlots, variation: false, minWorkMinutes: 480 };
test('salva quatro horários, mantém senha e normaliza folgas', () => {
  const next = validateSettings({ ...settings, password: '', excludedDates: ['', ' 2026-12-25 '] }, settings);
  assert.equal(next.password, 'segredo');
  assert.deepEqual(next.excludedDates, ['2026-12-25']);
  assert.deepEqual(next.slots, defaultSlots);
});
test('permite configurar horários antes de informar credenciais', () => {
  const empty = { ...settings, group: '', user: '', password: '' };
  assert.equal(validateSettings(empty, empty).slots.length, 4);
  assert.throws(() => validateSettings({ ...settings, user: 'outra-conta', password: '' }, settings), /senha ao trocar/);
});
test('rejeita extras, datas, tipos trocados, horários fora de ordem e minutos inválidos', () => {
  for (const slots of [
    defaultSlots.slice(0, 3),
    [...defaultSlots, { time: '19:00', kind: 'inicio_extra' }],
    defaultSlots.map((s, i) => i === 0 ? { ...s, time: '25:00' } : s),
    defaultSlots.map((s, i) => i === 0 ? { ...s, date: '2026-10-23' } : s),
    defaultSlots.map((s, i) => i === 0 ? { ...s, time: '12:00' } : s),
    [...defaultSlots].reverse(),
  ]) assert.throws(() => validateSettings({ ...settings, slots }, settings));
  assert.throws(() => validateSettings({ ...settings, days: [] }, settings));
  assert.throws(() => validateSettings({ ...settings, excludedDates: ['2026-02-30'] }, settings));
});
test('migra configurações antigas mantendo os horários recorrentes e os quatro tipos fixos', () => {
  const slots = fixedSlots([{ time: '08:30', kind: 'entrada' }, { time: '20:00', kind: 'inicio_extra', date: '2026-10-23' }, { time: '15:00', kind: 'saida', date: '2026-10-23' }]);
  assert.deepEqual(slots, [{ ...defaultSlots[0], time: '08:30' }, ...defaultSlots.slice(1)]);
});
test('rejeita jornada impossível, inválida e opção de variação inválida', () => {
  assert.throws(() => validateSettings({ ...settings, variation: true, minWorkMinutes: 600 }, settings), /não cabe/);
  for (const minWorkMinutes of [0, NaN, 480.5, 1440])
    assert.throws(() => validateSettings({ ...settings, minWorkMinutes }, settings));
  assert.throws(() => validateSettings({ ...settings, variation: 'sim' }, settings));
  assert.equal(validateSettings({ ...settings, variation: true }, settings).variation, true);
});
