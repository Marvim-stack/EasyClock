import { test } from 'node:test';
import assert from 'node:assert/strict';
import { due, localTime, variedSlots } from './schedule';
import { defaultSlots } from './settings';
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
test('usa o fuso de São Paulo nos quatro horários', () => {
  for (const [utc, slot] of [['12:00', '09:00'], ['15:00', '12:00'], ['16:00', '13:00'], ['21:20', '18:20']]) {
    assert.equal(due(new Date(`2026-10-22T${utc}:00Z`), days, []), `2026-10-22/${slot}`);
  }
});
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
test('variação preserva os quatro tipos, atraso máximo, ordem e jornada mínima', () => {
  const base = defaultSlots.map((s, i) => i === 3 ? { ...s, time: '18:00' } : s);
  const samples = new Set<string>();
  for (let n = 0; n < 100; n++) {
    const result = variedSlots(base, 480, max => n % max);
    assert.deepEqual(result.map(s => s.kind), base.map(s => s.kind));
    const times = result.map(s => minutes(s.time));
    times.forEach((time, i) => {
      const delay = time - minutes(base[i].time);
      assert.ok(delay >= 0 && delay <= 10);
      if (i) assert.ok(time > times[i - 1]);
    });
    assert.ok(times[1] - times[0] + times[3] - times[2] >= 480);
    samples.add(JSON.stringify(result));
  }
  assert.equal(samples.size, 100);
});
test('variação respeita fim do dia e rejeita jornada que não cabe na margem', () => {
  const late = defaultSlots.map((s, i) => i === 3 ? { ...s, time: '23:59' } : s);
  assert.equal(variedSlots(late, 480, max => max - 1)[3].time, '23:59');
  assert.throws(() => variedSlots(defaultSlots, 600), /não cabe/);
});
test('não dispara fora do minuto, em finais de semana ou datas excluídas', () => {
  assert.equal(due(new Date('2026-10-22T12:01:00Z'), days, []), undefined);
  assert.equal(due(new Date('2026-10-24T12:00:00Z'), days, []), undefined);
  assert.equal(due(new Date('2026-10-22T12:00:00Z'), days, ['2026-10-22']), undefined);
  assert.equal(localTime(new Date('2026-10-23T01:00:00Z')).date, '2026-10-22');
});
