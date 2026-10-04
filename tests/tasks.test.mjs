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
        } else if (t.kind === 'sequence') {
          const vals = t.options.map(o => o.value);
          assert.ok(t.answer.every(v => vals.includes(v)), 'все шаги — среди кнопок');
        } else assert.fail('kind');
        assert.ok(t.guide && t.guide.mode && t.guide.say, 'есть режим «вместе»');
        if (t.guide.mode === 'count' || t.guide.mode === 'sum' || t.guide.mode === 'share') assert.ok(t.guide.targets && t.guide.doneSay, 'count: цели и фраза-итог');
        if (t.guide.mode === 'walk') assert.ok(t.guide.targets && typeof t.guide.upto === 'number' && t.guide.doneSay, 'walk: цели и предел');
        assert.ok(t.sayShort, 'есть короткий повтор');
        assert.ok(T.LESSONS[skill], 'есть урок');
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
    const n = parseInt(t.prompt.match(/\d+/)[0]);
    assert.equal(Math.abs(t.answer - n), 1);
    assert.equal(/после/.test(t.prompt), t.answer > n);
    assert.ok(t.answer >= 0 && t.answer <= 20);
  }
});

test('numline: число внутри прямой', () => {
  T.setRandom(mulberry32(15));
  for (let i = 0; i < 300; i++) {
    const t = T.generate('numline', i / 300);
    assert.ok(t.answer > 0 && t.answer < t.display.max);
  }
});

test('flash: две кости складываются в ответ', () => {
  T.setRandom(mulberry32(21));
  for (let i = 0; i < 300; i++) {
    const t = T.generate('flash', 0.9);
    assert.equal(t.display.pattern, 'dice2');
    assert.equal(t.display.dice2[0] + t.display.dice2[1], t.answer);
    assert.ok(t.display.dice2.every(x => x >= 1 && x <= 6));
  }
});

test('memory: пропавший предмет был в ряду, отвлекающие — не были', () => {
  T.setRandom(mulberry32(22));
  for (let i = 0; i < 300; i++) {
    const t = T.generate('memory', i / 300);
    assert.equal(t.display.items[t.display.hideIdx], t.answer);
    for (const o of t.options) if (o.value !== t.answer) assert.ok(!t.display.items.includes(o.value));
  }
});

test('between/neighbors: дорожка содержит ответ в пропуске', () => {
  T.setRandom(mulberry32(23));
  for (let i = 0; i < 300; i++) {
    for (const k of ['between', 'neighbors', 'missing']) {
      const t = T.generate(k, i / 300);
      assert.equal(t.display.seq[t.display.idx], t.answer);
      assert.ok(t.guide.upto < t.display.seq.length);
    }
  }
});

test('same: ровно один вариант совпадает с образцом', () => {
  T.setRandom(mulberry32(24));
  for (let i = 0; i < 300; i++) {
    const t = T.generate('same', i / 300);
    const same = t.options.filter(o => o.shape === t.display.shape && o.color === t.display.color);
    assert.equal(same.length, 1); assert.equal(same[0].value, t.answer);
  }
});

test('clock: целые часы при низкой сложности, подписи словами', () => {
  T.setRandom(mulberry32(25));
  for (let i = 0; i < 200; i++) {
    const t = T.generate('clock', 0.2);
    assert.equal(t.display.m, 0);
    assert.ok(/час/.test(t.options.find(o => o.value === t.answer).label));
  }
});

test('речь: нет пустых формулировок, нет «после девять» (падежи)', () => {
  T.setRandom(mulberry32(26));
  for (const k of skills) for (let i = 0; i < 100; i++) {
    const t = T.generate(k, i / 100);
    assert.ok(t.say.length > 8 && t.say.length < 220, `${k}: длина речи ${t.say.length}`);
    assert.ok(!/после (ноль|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять)\b/.test(t.say), t.say);
    assert.ok(!/между (ноль|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять)\b/.test(t.say), t.say);
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

test('plural', () => {
  const f = { one: 'ракета', few: 'ракеты', many: 'ракет' };
  assert.equal(T.plural(1, f), 'ракета');
  assert.equal(T.plural(3, f), 'ракеты');
  assert.equal(T.plural(11, f), 'ракет');
  assert.equal(T.plural(20, f), 'ракет');
});
