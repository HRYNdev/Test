import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../js/tasks.js');

// детерминированный ГСЧ
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const skills = Object.keys(T.SKILLS);

for (const skill of skills) {
  for (const level of [1, 2, 3]) {
    test(`${skill} L${level}: 300 заданий корректны`, () => {
      T.setRandom(mulberry32(skill.length * 100 + level));
      for (let i = 0; i < 300; i++) {
        const t = T.generate(skill, level);
        assert.equal(t.skill, skill);
        assert.ok(t.prompt && t.say, 'есть текст');
        assert.ok(Array.isArray(t.options) && t.options.length >= 2, 'есть варианты');
        if (t.kind === 'choice') {
          const vals = t.options.map(o => o.value);
          assert.ok(vals.includes(t.answer), `ответ ${t.answer} есть среди вариантов ${vals}`);
          assert.equal(new Set(vals).size, vals.length, 'варианты уникальны');
        } else if (t.kind === 'order') {
          const vals = t.options.map(o => o.value).sort((a, b) => a - b);
          const ans = t.answer.slice().sort((a, b) => a - b);
          assert.deepEqual(vals, ans, 'варианты = ответ');
        } else assert.fail('kind');
        // числовые ответы не отрицательные
        if (typeof t.answer === 'number') assert.ok(t.answer >= 0);
      }
    });
  }
}

test('sub: уменьшаемое в пределах уровня, разность ≥ 0', () => {
  T.setRandom(mulberry32(7));
  for (let i = 0; i < 500; i++) {
    const t = T.generate('sub', 2);
    const [a, b] = t.display.text.split(/\s[−]\s/).map(s => parseInt(s));
    assert.ok(a <= 10 && b >= 1 && a - b === t.answer, t.display.text);
  }
});

test('add L3: сумма ≤ 20', () => {
  T.setRandom(mulberry32(8));
  for (let i = 0; i < 500; i++) {
    const t = T.generate('add', 3);
    assert.ok(t.answer <= 20 && t.answer >= 5);
  }
});

test('money: монеты суммируются в ответ', () => {
  T.setRandom(mulberry32(9));
  for (let i = 0; i < 300; i++) {
    const t = T.generate('money', 3);
    assert.equal(t.display.coins.reduce((s, c) => s + c, 0), t.answer);
  }
});

test('pattern: ответ = следующий элемент узора', () => {
  T.setRandom(mulberry32(10));
  for (let i = 0; i < 300; i++) {
    const t = T.generate('pattern', 3);
    const { seq, unitLen } = t.display;
    assert.equal(t.answer, seq[seq.length % unitLen]);
  }
});

test('buildMission: 8 заданий, без повторов подряд, только включённые', () => {
  T.setRandom(mulberry32(11));
  for (let i = 0; i < 100; i++) {
    const en = ['sub', 'add', 'clock'];
    const m = T.buildMission(en, { sub: 2, add: 1, clock: 1 }, 8);
    assert.equal(m.length, 8);
    for (let j = 0; j < 8; j++) {
      assert.ok(en.includes(m[j].skill));
      if (j) assert.notEqual(m[j].skill, m[j - 1].skill);
    }
  }
  const one = T.buildMission(['sub'], {}, 8);
  assert.ok(one.every(t => t.skill === 'sub'));
});

test('plural', () => {
  const f = { one: 'ракета', few: 'ракеты', many: 'ракет' };
  assert.equal(T.plural(1, f), 'ракета');
  assert.equal(T.plural(3, f), 'ракеты');
  assert.equal(T.plural(11, f), 'ракет');
  assert.equal(T.plural(20, f), 'ракет');
});
