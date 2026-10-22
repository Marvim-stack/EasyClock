import { test } from 'node:test';
import assert from 'node:assert/strict';
import { due, localTime } from './schedule';
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
test('usa o fuso de São Paulo nos quatro horários', () => {
  for (const [utc, slot] of [['12:00', '09:00'], ['15:00', '12:00'], ['16:00', '13:00'], ['21:20', '18:20']]) {
    assert.equal(due(new Date(`2026-10-22T${utc}:00Z`), days, []), `2026-10-22/${slot}`);
  }
});
test('não dispara fora do minuto, em finais de semana ou datas excluídas', () => {
  assert.equal(due(new Date('2026-10-22T12:01:00Z'), days, []), undefined);
  assert.equal(due(new Date('2026-10-24T12:00:00Z'), days, []), undefined);
  assert.equal(due(new Date('2026-10-22T12:00:00Z'), days, ['2026-10-22']), undefined);
  assert.equal(localTime(new Date('2026-10-23T01:00:00Z')).date, '2026-10-22');
});
