import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const D = require('../js/difficulty.js');

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const in01 = x => Number.isFinite(x) && x >= 0 && x <= 1;

// ---------- базовое API ----------

test('create: стартовое состояние', () => {
  const st = D.create();
  assert.equal(st.global, 0.25);
  assert.deepEqual(st.skills, {});
  assert.deepEqual(st.history, []);
  assert.equal(D.effective(st, 'add'), 0.25, 'новый навык стартует на общем уровне');
});

test('update: 8 быстрых верных за миссию поднимают с 0.25 до 0.6–0.75', () => {
  const st = D.create();
  const sk = ['count', 'add', 'sub', 'fuel', 'story', 'compare', 'missing', 'order'];
  for (const k of sk) D.update(st, k, 2, 4);
  assert.ok(st.global >= 0.6 && st.global <= 0.75, `global=${st.global}`);
  assert.ok(D.effective(st, 'count') > D.effective(st, 'newskill'), 'решённый навык выше нетронутого');
  assert.equal(D.effective(st, 'newskill'), st.global, 'нетронутый навык = global');
});

test('update: 8 обычных верных (не быстрых) поднимают меньше, но заметно', () => {
  const st = D.create();
  for (let i = 0; i < 8; i++) D.update(st, 's' + i, 2, 9);
  assert.ok(st.global >= 0.5 && st.global <= 0.65, `global=${st.global}`);
});

test('update: две уверенные миссии подряд → ~0.9 (0.85–0.97)', () => {
  const st = D.create();
  for (let i = 0; i < 16; i++) D.update(st, 's' + (i % 8), 2, i < 4 ? 4 : 8);
  assert.ok(st.global >= 0.85 && st.global <= 0.97, `global=${st.global}`);
});

test('update: два провала подряд — минус ~0.2', () => {
  const st = D.setGlobal(D.create(), 0.5);
  D.update(st, 'add', 0, 20);
  D.update(st, 'sub', 0, 20);
  assert.ok(Math.abs(st.global - 0.3) < 0.03, `global=${st.global}`);
  assert.ok(D.effective(st, 'sub') < D.effective(st, 'count'), 'проваленный навык ниже нетронутого');
});

test('update: со второй попытки — чуть вниз', () => {
  const st = D.setGlobal(D.create(), 0.5);
  D.update(st, 'add', 1, 10);
  assert.ok(st.global < 0.5 && st.global > 0.46, `global=${st.global}`);
});

test('update: ~60% с первой, остальное 60/40 со второй/провал — держится на месте', () => {
  // «чередование верно/неверно»: точка равновесия модели — около 57–60% верных с первой попытки
  // (остальные 40% делятся 60/40 на «со второй» и «провал»). На этой смеси global не уезжает.
  const st = D.setGlobal(D.create(), 0.5);
  const seq = [2, 1, 2, 2, 0, 2, 1, 2, 2, 0, 2, 1, 2, 2, 0, 2, 1, 2, 2, 0, 2, 1, 2, 1, 2]; // 15/6/4 = 60/24/16
  for (let i = 0; i < 50; i++) D.update(st, 's' + (i % 8), seq[i % seq.length], 7);
  assert.ok(Math.abs(st.global - 0.5) < 0.08, `global=${st.global}`);
});

test('update: ровно 50% с первой — медленно ползёт вниз, но не обваливается', () => {
  // Строгое 50/30/20 — чуть ниже равновесия: за 40 ответов минус не больше 0.2.
  const st = D.setGlobal(D.create(), 0.5);
  const seq = [2, 1, 2, 0, 2, 1, 2, 1, 2, 0];
  for (let i = 0; i < 40; i++) D.update(st, 's' + (i % 8), seq[i % seq.length], 7);
  assert.ok(st.global < 0.5 && st.global > 0.3, `global=${st.global}`);
});

test('update: не выходит за [0,1] и смещения ограничены', () => {
  const st = D.create();
  for (let i = 0; i < 60; i++) D.update(st, 'add', 2, 3);
  assert.equal(st.global, 1);
  assert.equal(D.effective(st, 'add'), 1);
  for (let i = 0; i < 60; i++) D.update(st, 'add', 0, 30);
  assert.equal(st.global, 0);
  assert.equal(D.effective(st, 'add'), 0);
  assert.ok(Math.abs(st.skills.add) <= D.MAX_OFFSET);
});

test('update: history хранит не больше 30 записей', () => {
  const st = D.create();
  for (let i = 0; i < 50; i++) D.update(st, 'add', 2, 5);
  assert.equal(st.history.length, 30);
  assert.deepEqual(Object.keys(st.history[0]).sort(), ['d', 'seconds', 'skill', 'stars']);
});

test('set/setGlobal/map', () => {
  const st = D.setGlobal(D.create(), 0.5);
  D.set(st, 'sub', 0.2);
  assert.equal(D.effective(st, 'sub'), 0.2, 'set даёт ровно d');
  assert.equal(D.effective(st, 'add'), 0.5, 'set не трогает другие навыки');
  D.setGlobal(st, 0.7);
  assert.equal(D.effective(st, 'add'), 0.7);
  assert.equal(D.effective(st, 'sub'), 0.4, 'setGlobal сдвигает все навыки вместе, смещение сохраняется');
  assert.deepEqual(D.map(st, ['add', 'sub', 'count']), { add: 0.7, sub: 0.4, count: 0.7 });
  assert.deepEqual(D.map(st), { sub: 0.4 }, 'map без списка — по известным навыкам');
  D.set(st, 'add', 2); assert.equal(D.effective(st, 'add'), 1);
  D.set(st, 'add', -1); assert.equal(D.effective(st, 'add'), 0.2, 'смещение ограничено MAX_OFFSET');
});

test('normalize: чинит мусор из localStorage', () => {
  const st = D.normalize({ global: 'abc', skills: { add: 'x', sub: 9 }, history: null });
  assert.equal(st.global, 0.25);
  assert.equal(st.skills.add, 0);
  assert.equal(st.skills.sub, D.MAX_OFFSET);
  assert.deepEqual(st.history, []);
  assert.equal(D.normalize(null).global, 0.25);
  assert.equal(D.effective(undefined, 'add'), 0.25);
  const st2 = D.update(null, 'add', 2, 3);
  assert.ok(st2.global > 0.25);
});

test('rank: границы', () => {
  const r = g => D.rank({ global: g });
  assert.equal(r(0).level, 1); assert.equal(r(0).name, 'Кадет'); assert.equal(r(0).progress, 0); assert.equal(r(0).next, 0.2);
  assert.equal(r(0.1).progress, 0.5);
  assert.equal(r(0.1999).level, 1);
  assert.equal(r(0.2).level, 2); assert.equal(r(0.2).name, 'Пилот'); assert.equal(r(0.2).progress, 0);
  assert.equal(r(0.4).level, 3); assert.equal(r(0.4).name, 'Штурман');
  assert.equal(r(0.55).level, 4); assert.equal(r(0.55).name, 'Капитан');
  assert.equal(r(0.7).level, 5); assert.equal(r(0.7).name, 'Командир'); assert.equal(r(0.7).next, 0.85);
  assert.equal(r(0.85).level, 6); assert.equal(r(0.85).name, 'Адмирал галактики'); assert.equal(r(0.85).next, null);
  assert.equal(r(1).level, 6); assert.equal(r(1).progress, 1); assert.equal(r(1).next, null);
  assert.equal(r(0.925).progress, 0.5);
  assert.ok(r(0.5).emoji);
  assert.equal(D.rank(D.create()).level, 2, 'старт 0.25 — Пилот');
  assert.equal(D.rank(null).level, 2);
});

test('migrate: старый { skill: d } → state', () => {
  const st = D.migrate({ add: 0.5, sub: 0.3, count: 0.7 });
  assert.equal(st.global, 0.5, 'global = среднее');
  assert.equal(D.effective(st, 'add'), 0.5);
  assert.equal(D.effective(st, 'sub'), 0.3);
  assert.equal(D.effective(st, 'count'), 0.7);
  assert.equal(D.effective(st, 'clock'), 0.5, 'неизвестный навык = среднее');
  assert.deepEqual(st.history, []);
  assert.deepEqual(D.migrate(null), D.create());
  assert.deepEqual(D.migrate({}), D.create());
  const st2 = D.migrate({ add: 'junk', sub: 0.6 });
  assert.equal(st2.global, 0.6);
  assert.equal(D.effective(st2, 'add'), 0.6);
});

// ---------- симуляция ребёнка ----------

const SKILLS = ['count', 'add', 'sub', 'fuel', 'story', 'compare', 'missing', 'order', 'neighbors', 'numline',
  'shapes', 'pattern', 'clock', 'money', 's15', 's16', 's17', 's18', 's19', 's20', 's21', 's22', 's23', 's24'];
const W = SKILLS.map(s => (s === 'sub' ? 2 : 1));
const WT = W.reduce((a, b) => a + b, 0);
const sigmoid = x => 1 / (1 + Math.exp(-x));

function pickSkill(rng, prev) {
  for (;;) {
    let r = rng() * WT;
    for (let i = 0; i < SKILLS.length; i++) {
      r -= W[i];
      if (r <= 0) { if (SKILLS[i] !== prev) return SKILLS[i]; break; }
    }
  }
}

// Ребёнок со способностью a (по sub — a−0.2). Возвращает лог заданий и финальный state.
function simulate(a, seed, missions = 10, perMission = 8) {
  const rng = mulberry32(seed);
  const st = D.create();
  const log = [];
  let prev = null;
  for (let m = 0; m < missions; m++) {
    for (let i = 0; i < perMission; i++) {
      const skill = pickSkill(rng, prev); prev = skill;
      const ability = skill === 'sub' ? a - 0.2 : a;
      const d = D.effective(st, skill);
      assert.ok(in01(d), `effective в [0,1]: ${d}`);
      const p1 = Math.max(0, Math.min(1, sigmoid((ability - d) * 8) + (rng() - 0.5) * 0.1));
      let stars;
      if (rng() < p1) stars = 2; else if (rng() < 0.6) stars = 1; else stars = 0;
      const seconds = Math.max(1, 3 + d * 8 + (rng() - 0.5) * 2);
      D.update(st, skill, stars, seconds);
      assert.ok(in01(st.global), `global в [0,1]: ${st.global}`);
      assert.ok(Math.abs(st.skills[skill]) <= D.MAX_OFFSET, 'смещение в пределах');
      log.push({ m, skill, d, stars, g: st.global });
    }
  }
  return { st, log };
}

const N_SIMS = 200;
const ABILITIES = [0.2, 0.5, 0.8];
const RUNS = {};
for (const a of ABILITIES) RUNS[a] = Array.from({ length: N_SIMS }, (_, s) => simulate(a, Math.round(a * 1000) + s));

for (const a of ABILITIES) {
  const runs = RUNS[a];
  const last3 = r => r.log.filter(x => x.m >= 7);

  test(`sim a=${a}: средняя effective-сложность в последних 3 миссиях = a ± 0.15`, () => {
    const d = mean(runs.map(r => mean(last3(r).map(x => x.d))));
    assert.ok(Math.abs(d - a) <= 0.15, `mean d=${d.toFixed(3)} при a=${a}`);
  });

  test(`sim a=${a}: доля провалов в последних 3 миссиях ≤ 35%`, () => {
    const f = mean(runs.map(r => { const l = last3(r); return l.filter(x => x.stars === 0).length / l.length; }));
    assert.ok(f <= 0.35, `fails=${(f * 100).toFixed(1)}%`);
  });

  test(`sim a=${a}: sub (слабость) в среднем ниже остальных навыков`, () => {
    const sub = [], oth = [];
    for (const r of runs) for (const x of r.log) if (x.m >= 5) (x.skill === 'sub' ? sub : oth).push(x.d);
    assert.ok(mean(sub) < mean(oth) - 0.02, `sub=${mean(sub).toFixed(3)} other=${mean(oth).toFixed(3)}`);
  });

  test(`sim a=${a}: всё в [0,1], значения — числа`, () => {
    for (const r of runs) {
      assert.ok(in01(r.st.global));
      for (const k in r.st.skills) assert.ok(in01(D.effective(r.st, k)));
      for (const x of r.log) assert.ok(in01(x.d) && in01(x.g));
    }
  });
}

test('sim a=0.2: слабый ребёнок не улетает выше 0.45', () => {
  const g = mean(RUNS[0.2].map(r => mean(r.log.filter(x => x.m >= 7).map(x => x.g))));
  assert.ok(g <= 0.45, `global=${g.toFixed(3)}`);
  const maxG = Math.max(...RUNS[0.2].map(r => Math.max(...r.log.map(x => x.g))));
  assert.ok(maxG <= 0.7, `пик global у слабого ${maxG.toFixed(3)}`);
});

test('sim a=0.9: уверенный ребёнок за первую миссию поднимает global минимум на +0.3', () => {
  const runs = Array.from({ length: N_SIMS }, (_, s) => simulate(0.9, 900 + s, 1));
  const gain = runs.map(r => r.st.global - 0.25);
  assert.ok(mean(gain) >= 0.3, `средний прирост ${mean(gain).toFixed(3)}`);
  const sorted = [...gain].sort((x, y) => x - y);
  assert.ok(sorted[Math.floor(N_SIMS * 0.1)] >= 0.2, `10-й процентиль прироста ${sorted[Math.floor(N_SIMS * 0.1)].toFixed(3)}`);
});

test('sim: таблица (информативно)', () => {
  const rows = [];
  for (const a of [...ABILITIES, 0.9]) {
    const runs = RUNS[a] || Array.from({ length: N_SIMS }, (_, s) => simulate(0.9, 900 + s));
    const l3 = runs.map(r => r.log.filter(x => x.m >= 7));
    rows.push({ a, meanD: mean(l3.map(l => mean(l.map(x => x.d)))).toFixed(3),
      global: mean(runs.map(r => r.st.global)).toFixed(3),
      fails: (mean(l3.map(l => l.filter(x => x.stars === 0).length / l.length)) * 100).toFixed(1) + '%',
      retry: (mean(l3.map(l => l.filter(x => x.stars === 1).length / l.length)) * 100).toFixed(1) + '%',
      m1gain: mean(runs.map(r => r.log[7].g - 0.25)).toFixed(3) });
  }
  console.table(rows);
});
