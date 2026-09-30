import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../js/tasks.js');

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
  for (const d of [0, 0.2, 0.5, 0.8, 1]) {
    test(`${skill} d=${d}: 200 заданий корректны`, () => {
      T.setRandom(mulberry32(skill.length * 100 + d * 10));
      for (let i = 0; i < 200; i++) {
        const t = T.generate(skill, d);
        assert.equal(t.skill, skill);
        assert.ok(t.prompt && t.say && t.scene, 'есть текст и сцена');
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
        if (typeof t.answer === 'number') assert.ok(t.answer >= 0 && t.answer <= 25, `ответ в диапазоне: ${t.answer}`);
      }
    });
  }
}

test('sub: при низкой сложности числа ≤ 10, разность ≥ 0', () => {
  T.setRandom(mulberry32(7));
  for (let i = 0; i < 500; i++) {
    const t = T.generate('sub', 0.3);
    const [a, b] = t.display.text.split(/\s−\s/).map(s => parseInt(s));
    assert.ok(a <= 10 && b >= 1 && a - b === t.answer, t.display.text);
  }
});

test('add: сумма растёт со сложностью и не выше 20', () => {
  T.setRandom(mulberry32(8));
  let lo = 0, hi = 0;
  for (let i = 0; i < 500; i++) {
    lo = Math.max(lo, T.generate('add', 0).answer);
    hi = Math.max(hi, T.generate('add', 1).answer);
  }
  assert.ok(lo <= 5, `d=0 max ${lo}`);
  assert.ok(hi <= 20 && hi > 10, `d=1 max ${hi}`);
});

test('fuel: have + answer = target', () => {
  T.setRandom(mulberry32(12));
  for (let i = 0; i < 300; i++) {
    const t = T.generate('fuel', i / 300);
    assert.equal(t.display.have + t.answer, t.display.target);
  }
});

test('story: ответ соответствует картинке', () => {
  T.setRandom(mulberry32(13));
  for (let i = 0; i < 500; i++) {
    const t = T.generate('story', i / 500);
    const g = t.display.groups;
    const last = g[g.length - 1];
    const shown = last.n + (last.extra || 0) - (last.crossed || 0);
    const total = g.length === 2 && !last.extra && !last.crossed ? g[0].n + g[1].n : shown;
    assert.equal(t.answer, total, t.prompt);
  }
});

test('neighbors: ответ — сосед числа', () => {
  T.setRandom(mulberry32(14));
  for (let i = 0; i < 300; i++) {
    const t = T.generate('neighbors', i / 300);
    assert.equal(t.answer, t.display.after ? t.display.n + 1 : t.display.n - 1);
    assert.ok(t.answer >= 0);
  }
});

test('numline: число внутри прямой', () => {
  T.setRandom(mulberry32(15));
  for (let i = 0; i < 300; i++) {
    const t = T.generate('numline', i / 300);
    assert.ok(t.answer > 0 && t.answer < t.display.max);
  }
});

test('money: монеты суммируются в ответ', () => {
  T.setRandom(mulberry32(9));
  for (let i = 0; i < 300; i++) {
    const t = T.generate('money', 1);
    assert.equal(t.display.coins.reduce((s, c) => s + c, 0), t.answer);
  }
});

test('pattern: ответ = следующий элемент узора', () => {
  T.setRandom(mulberry32(10));
  for (let i = 0; i < 300; i++) {
    const t = T.generate('pattern', 1);
    const { seq, unitLen } = t.display;
    assert.equal(t.answer, seq[seq.length % unitLen]);
  }
});

test('buildMission: 8 заданий, без повторов подряд, только включённые', () => {
  T.setRandom(mulberry32(11));
  for (let i = 0; i < 100; i++) {
    const en = ['sub', 'add', 'clock'];
    const m = T.buildMission(en, { sub: 0.5, add: 0.2 }, 8);
    assert.equal(m.length, 8);
    for (let j = 0; j < 8; j++) {
      assert.ok(en.includes(m[j].skill));
      if (j) assert.notEqual(m[j].skill, m[j - 1].skill);
    }
  }
  const one = T.buildMission(['sub'], {}, 8);
  assert.ok(one.every(t => t.skill === 'sub' && t.difficulty === 0.3));
});

test('nextDifficulty: растёт при успехе, падает при провале, в пределах 0..1', () => {
  assert.ok(T.nextDifficulty(0.5, 2, 3) > T.nextDifficulty(0.5, 2, 20));
  assert.ok(T.nextDifficulty(0.5, 2, 20) > 0.5);
  assert.ok(T.nextDifficulty(0.5, 1) < 0.5);
  assert.ok(T.nextDifficulty(0.5, 0) < T.nextDifficulty(0.5, 1));
  assert.equal(T.nextDifficulty(1, 2, 1), 1);
  assert.equal(T.nextDifficulty(0, 0), 0);
});

test('plural', () => {
  const f = { one: 'ракета', few: 'ракеты', many: 'ракет' };
  assert.equal(T.plural(1, f), 'ракета');
  assert.equal(T.plural(3, f), 'ракеты');
  assert.equal(T.plural(11, f), 'ракет');
  assert.equal(T.plural(20, f), 'ракет');
});
