import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../js/curriculum.js');
const T = require('../js/tasks.js');

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const ALL = Object.keys(T.SKILLS);
const DAY = 864e5;

// Симуляция ребёнка: ability(skill, d, stage) → вероятность ответа с первой попытки.
// Если не с первой: с вероятностью 0.7 решает в режиме «вместе» (1 звезда), иначе 0.
function simulate(ability, missions, seed) {
  const r = mulberry32(seed || 1); C.setRandom(r); T.setRandom(r);
  const st = C.create(); let now = Date.parse('2026-10-01T18:00:00');
  const stages = [];
  for (let m = 0; m < missions; m++) {
    const plan = C.planMission(st, ALL, 8, now);
    assert.equal(plan.length, 8);
    for (const p of plan) {
      const t = T.generate(p.skill, p.d);
      assert.equal(t.skill, p.skill);
      const pr = ability(p.skill, p.d, st.stage); const x = r();
      const o = x < pr ? 2 : (x < pr + (1 - pr) * 0.7 ? 1 : 0);
      C.record(st, p.skill, o, 5, now);
    }
    stages.push(st.stage); now += DAY;
  }
  return { st, stages };
}

test('STAGES: все навыки программы существуют в генераторах, у каждой ступени есть ядро', () => {
  for (const s of C.STAGES) {
    assert.ok(s.core.length >= 4, `${s.name}: ядро`);
    for (const x of s.core.concat(s.extra)) {
      assert.ok(T.SKILLS[x.skill], `${s.name}: навык ${x.skill} есть в tasks.js`);
      assert.ok(x.d[0] >= 0 && x.d[1] <= 1 && x.d[0] <= x.d[1], `${s.name}/${x.skill}: диапазон d`);
    }
  }
  for (const k of ALL) assert.ok(C.firstStage(k), `навык ${k} встречается хотя бы на одной ступени`);
});

test('planMission: 8 слотов, без повторов подряд, не больше двух одного навыка, финиш лёгкий', () => {
  C.setRandom(mulberry32(5));
  for (let i = 0; i < 200; i++) {
    const st = C.create(); st.stage = 1 + (i % 6);
    const plan = C.planMission(st, ALL, 8);
    assert.equal(plan.length, 8);
    const cnt = {};
    for (let j = 0; j < plan.length; j++) {
      cnt[plan[j].skill] = (cnt[plan[j].skill] || 0) + 1;
      if (j) assert.notEqual(plan[j].skill, plan[j - 1].skill, 'подряд');
      assert.ok(plan[j].d >= 0 && plan[j].d <= 1);
    }
    for (const k in cnt) assert.ok(cnt[k] <= 2, `${k} ×${cnt[k]}`);
    assert.equal(plan[7].slot, 'finish');
    const fin = C.skillRange(st, plan[7].skill);
    assert.equal(plan[7].d, fin.earlier ? fin.d[1] : fin.d[0], 'финиш на нижнем краю диапазона');
  }
});

test('planMission: уважает включённые навыки, урок помечается один раз на навык', () => {
  C.setRandom(mulberry32(6));
  const st = C.create();
  const plan = C.planMission(st, ['count', 'flash', 'shapes'], 8);
  assert.ok(plan.every(p => ['count', 'flash', 'shapes'].includes(p.skill)));
  const lessons = plan.filter(p => p.lesson).map(p => p.skill);
  assert.equal(new Set(lessons).size, lessons.length, 'урок один раз');
  assert.ok(lessons.length >= 1);
  C.markIntro(st, 'count');
  assert.ok(C.planMission(st, ['count'], 8).every(p => !p.lesson));
});

test('planMission: на новой ступени ядро начинается с нижнего края диапазона', () => {
  const st = C.create(); st.stage = 3;
  const plan = C.planMission(st, ALL, 8);
  for (const p of plan.filter(p => p.slot === 'core')) {
    const r = C.skillRange(st, p.skill);
    assert.equal(p.d, r.d[0]);
  }
});

test('record: мастерство только по первой попытке; флаг липкий', () => {
  const st = C.create();
  for (let i = 0; i < 3; i++) C.record(st, 'count', 1, 5, 0);
  assert.equal(C.mastery(st, 'count'), 0, 'режим «вместе» не считается');
  assert.equal(C.isMastered(st, 'count'), false);
  for (let i = 0; i < 3; i++) C.record(st, 'count', 2, 5, 0);
  assert.equal(C.isMastered(st, 'count'), false, '3 из последних 6 = 50 % — ещё не освоен');
  for (let i = 0; i < 2; i++) C.record(st, 'count', 2, 5, 0);
  assert.equal(C.isMastered(st, 'count'), true, '5 из последних 6 — освоен');
});

test('record: освоение после 3 верных подряд, снятие флага при провалах', () => {
  const st = C.create();
  const res = [0, 0, 0].map(() => C.record(st, 'count', 2, 5, 0));
  assert.equal(C.isMastered(st, 'count'), true);
  assert.equal(res[2].mastered, true, 'событие «навык освоен»');
  C.record(st, 'count', 0, 5, 0);
  assert.equal(C.isMastered(st, 'count'), true, 'одна ошибка не снимает флаг');
  C.record(st, 'count', 0, 5, 0); C.record(st, 'count', 0, 5, 0);
  assert.equal(C.isMastered(st, 'count'), false, 'три ошибки подряд — снимает');
});

test('record: очередь повторов — ошибка добавляет, успех убирает, не длиннее лимита', () => {
  const st = C.create();
  C.record(st, 'add', 0, 5, 0);
  C.record(st, 'sub', 1, 5, 0);
  assert.deepEqual(st.review, ['add', 'sub']);
  C.record(st, 'add', 2, 5, 0);
  assert.deepEqual(st.review, ['sub']);
  for (const k of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) C.record(st, k, 0, 5, 0);
  assert.ok(st.review.length <= C.PARAMS.REVIEW_MAX);
});

test('переход: все навыки ядра освоены → следующая ступень, история навыков обнуляется', () => {
  const st = C.create();
  let promoted = null;
  for (const x of C.STAGES[0].core) for (let i = 0; i < 3; i++) { const r = C.record(st, x.skill, 2, 5, 0); if (r.promoted) promoted = r.promoted; }
  assert.equal(st.stage, 2);
  assert.equal(promoted, 2);
  assert.equal(C.attempts(st, 'count'), 0, 'история на новой ступени пустая');
  assert.equal(C.isMastered(st, 'count'), false);
  assert.equal(st.promotions.length, 1);
});

test('экспресс-переход: 10 подряд с первой по ≥3 навыкам ядра', () => {
  const st = C.create();
  const core = C.STAGES[0].core.map(x => x.skill);
  for (let i = 0; i < 9; i++) C.record(st, core[i % 3], 2, 3, 0);
  assert.equal(st.stage, 1);
  C.record(st, core[0], 2, 3, 0);
  assert.equal(st.stage, 2);
});

test('экспресс-переход не срабатывает по одному навыку', () => {
  const st = C.create();
  for (let i = 0; i < 12; i++) C.record(st, 'count', 2, 3, 0);
  assert.equal(st.stage, 1);
});

test('угадывающий ребёнок (33 % с первой) не поднимается со ступени 1 за 14 миссий', () => {
  for (const seed of [1, 2, 3, 4]) {
    const { stages } = simulate(() => 0.33, 14, seed);
    assert.ok(stages.every(s => s === 1), `seed ${seed}: ${stages.join(' ')}`);
  }
});

test('уверенный ребёнок (95 %) проходит ступень за 2–5 миссий', () => {
  for (const seed of [1, 2, 3, 4]) {
    const { stages } = simulate(() => 0.95, 14, seed);
    assert.ok(stages[4] >= 2, `seed ${seed}: после 5 миссий ступень ${stages[4]}`);
    assert.ok(stages[13] >= 4, `seed ${seed}: после 14 миссий ступень ${stages[13]}`);
  }
});

test('ребёнок, которому трудно на ступени (35 % с первой), остаётся на ней, а миссия становится мягче', () => {
  const { st, stages } = simulate((k, d, s) => (s === 1 ? 0.95 : 0.35), 12, 2);
  assert.ok(stages.includes(2) && !stages.includes(3), stages.join(' '));
  assert.equal(C.struggling(st), true);
  C.setRandom(mulberry32(9));
  const plan = C.planMission(st, ALL, 8);
  assert.ok(plan.filter(p => p.slot === 'warm').length >= 3, 'больше разминки');
});

test('skillD: внутри ступени растёт с мастерством и не выходит за диапазон', () => {
  const st = C.create(); st.stage = 3;
  const r = C.skillRange(st, 'add');
  assert.equal(C.skillD(st, 'add'), r.d[0]);
  for (let i = 0; i < 6; i++) C.record(st, 'add', 2, 5, 0);
  assert.ok(st.stage === 3, 'одного навыка для перехода мало');
  assert.equal(C.skillD(st, 'add'), r.d[1]);
  const prev = C.skillRange(st, 'count');
  assert.ok(prev.earlier, 'навык прошлой ступени');
  assert.equal(C.skillD(st, 'count'), prev.d[1]);
});

test('streak: серия дней считается до сегодня или вчера', () => {
  const st = C.create();
  const d = k => Date.parse(`2026-10-${k}T18:00:00`);
  C.record(st, 'count', 2, 5, d('01')); C.record(st, 'count', 2, 5, d('02')); C.record(st, 'count', 2, 5, d('03'));
  assert.equal(C.streak(st, d('03')).streak, 3);
  assert.equal(C.streak(st, d('03')).playedToday, true);
  assert.equal(C.streak(st, d('04')).streak, 3, 'сегодня ещё не играл — серия жива');
  assert.equal(C.streak(st, d('05')).streak, 0, 'пропустил день — серия обнулилась');
  assert.equal(C.streak(st, d('04')).last7.length, 7);
  assert.equal(C.streak(st, d('04')).last7[6].today, true);
});

test('setStage / normalize / migrate', () => {
  const st = C.create();
  C.record(st, 'count', 2, 5, 0);
  C.setStage(st, 4);
  assert.equal(st.stage, 4);
  assert.equal(C.attempts(st, 'count'), 0);
  assert.equal(C.setStage(st, 99).stage, 6);
  assert.equal(C.setStage(st, -1).stage, 1);
  const n = C.normalize({ stage: '3', skills: { add: { hist: [1, 0, 'x'] } }, days: null });
  assert.equal(n.stage, 3); assert.deepEqual(n.skills.add.hist, [1, 0, 1]); assert.deepEqual(n.days, {});
  assert.equal(C.migrate({ history: new Array(9) }).stage, 2);
  assert.equal(C.migrate({ history: [] }).stage, 1);
  assert.equal(C.migrate(null).stage, 1);
});
