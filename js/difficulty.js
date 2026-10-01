/* Модель сложности. Чистые функции, без DOM и зависимостей — тестируется в node.

   Идея: один ОБЩИЙ уровень (global) + небольшие СМЕЩЕНИЯ по навыкам (skills[k]).
   Сложность задания навыка k: effective = clamp01(global + skills[k]).
   Общий уровень двигается на каждом ответе (любого навыка), поэтому растёт быстро
   даже если навыков два десятка. Смещение навыка хранит «этот навык даётся
   легче/труднее среднего» и двигается большим шагом, но только когда навык встречается.
   Новый навык (skills[k] нет) стартует ровно на общем уровне.

   Почему смещения, а не абсолютные значения: при 24 навыках и 8 заданиях в миссии
   каждый навык встречается раз в 2–3 миссии. Если хранить абсолютное d на навык,
   оно «отстаёт» от общего уровня (навык, который ребёнок решил, остаётся на 0.35,
   пока нетронутые уже на 0.6). Смещение же едет вместе с global автоматически.

   state = { global: 0.25, skills: { [skill]: offset }, history: [ {skill, stars, seconds, d} ] }
   offset ∈ [-MAX_OFFSET, MAX_OFFSET]; абсолютные значения — через map()/effective().
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Difficulty = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const START = 0.25;         // стартовый общий уровень
  const MAX_OFFSET = 0.5;     // предел смещения навыка от общего уровня
  const HISTORY = 30;         // сколько последних ответов хранить
  const FAST_SECONDS = 6;     // верно быстрее этого — «быстрый» ответ

  // Шаги общего уровня (global). Шаги «вверх» умножаются на (1 − HEADROOM·global):
  // вблизи потолка расти труднее, чтобы две уверенные миссии давали ~0.9, а не 1.0.
  const G = { fast: 0.075, ok: 0.055, retry: -0.02, fail: -0.10 };
  const HEADROOM = 0.6;
  // Шаги смещения навыка. Плюс к шагу global, т.е. абсолютная сложность навыка
  // двигается на G + S. Перед шагом смещение чуть «забывается» (OFFSET_DECAY),
  // чтобы старая слабость/сила не висела вечно.
  const S = { fast: 0.05, ok: 0.04, retry: -0.03, fail: -0.10 };
  const OFFSET_DECAY = 0.1;
  // Если навык уже известен как слабый (offset < 0), провал на нём меньше бьёт по global;
  // если известен как сильный (offset > 0), успех на нём меньше поднимает global.
  // Коэффициент = clamp(1 − SHIELD·|offset|, SHIELD_MIN, 1).
  const SHIELD = 2;
  const SHIELD_MIN = 0.4;

  const RANKS = [
    { level: 1, name: 'Кадет',              emoji: '🧑‍🚀', from: 0,    to: 0.2 },
    { level: 2, name: 'Пилот',              emoji: '🛩️', from: 0.2,  to: 0.4 },
    { level: 3, name: 'Штурман',            emoji: '🧭', from: 0.4,  to: 0.55 },
    { level: 4, name: 'Капитан',            emoji: '🚀', from: 0.55, to: 0.7 },
    { level: 5, name: 'Командир',           emoji: '🛸', from: 0.7,  to: 0.85 },
    { level: 6, name: 'Адмирал галактики',  emoji: '🌌', from: 0.85, to: 1 },
  ];

  function num(x, dflt) { const n = Number(x); return Number.isFinite(n) ? n : dflt; }
  function clamp01(d) { return Math.max(0, Math.min(1, num(d, 0))); }
  function clampOff(o) { return Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, num(o, 0))); }
  function round(x) { return Math.round(x * 1e4) / 1e4; }

  function create() {
    return { global: START, skills: {}, history: [] };
  }

  // Привести что угодно к валидному state (чинит битый localStorage).
  function normalize(state) {
    if (!state || typeof state !== 'object') state = create();
    state.global = clamp01(num(state.global, START));
    if (!state.skills || typeof state.skills !== 'object') state.skills = {};
    for (const k in state.skills) state.skills[k] = clampOff(state.skills[k]);
    if (!Array.isArray(state.history)) state.history = [];
    return state;
  }

  function offset(state, skill) {
    const o = state && state.skills ? state.skills[skill] : undefined;
    return o == null ? 0 : clampOff(o);
  }

  // Сложность для генерации следующего задания навыка.
  function effective(state, skill) {
    const g = clamp01(state && state.global != null ? state.global : START);
    return round(clamp01(g + offset(state, skill)));
  }

  // {skill: d} для buildMission / панели родителя.
  function map(state, skills) {
    const out = {};
    const list = skills || Object.keys((state && state.skills) || {});
    for (const k of list) out[k] = effective(state, k);
    return out;
  }

  function starsKey(stars, seconds) {
    if (stars >= 2) return (seconds != null && num(seconds, Infinity) < FAST_SECONDS) ? 'fast' : 'ok';
    if (stars === 1) return 'retry';
    return 'fail';
  }

  // Обновить после ответа. stars: 2 (с первой), 1 (со второй), 0 (не решил); seconds — время до ответа.
  function update(state, skill, stars, seconds) {
    state = normalize(state);
    const key = starsKey(stars, seconds);
    const d = effective(state, skill);
    const off = offset(state, skill);

    // --- общий уровень ---
    let gStep = G[key];
    if (gStep > 0) {
      gStep *= 1 - HEADROOM * state.global;                        // ближе к потолку — медленнее
      if (off > 0) gStep *= Math.max(SHIELD_MIN, 1 - SHIELD * off); // успех на сильном навыке — меньше инфо
    } else if (off < 0) {
      gStep *= Math.max(SHIELD_MIN, 1 + SHIELD * off);             // провал на слабом навыке — меньше бьёт
    }
    state.global = round(clamp01(state.global + gStep));

    // --- смещение навыка ---
    state.skills[skill] = round(clampOff(off * (1 - OFFSET_DECAY) + S[key]));

    state.history.push({ skill, stars: stars >= 2 ? 2 : stars === 1 ? 1 : 0, seconds: seconds == null ? null : round(num(seconds, 0)), d });
    if (state.history.length > HISTORY) state.history.splice(0, state.history.length - HISTORY);
    return state;
  }

  // Ручная установка родителем: после вызова effective(state, skill) === d.
  // Другие навыки и global не трогаем — родитель правит один навык.
  function set(state, skill, d) {
    state = normalize(state);
    state.skills[skill] = round(clampOff(clamp01(d) - state.global));
    return state;
  }

  // Общий уровень: все навыки сдвигаются вместе (смещения сохраняются).
  function setGlobal(state, d) {
    state = normalize(state);
    state.global = round(clamp01(d));
    return state;
  }

  function rank(state) {
    const g = clamp01(state && state.global != null ? state.global : START);
    let r = RANKS[RANKS.length - 1];
    for (const x of RANKS) if (g >= x.from && g < x.to) { r = x; break; }
    const last = r === RANKS[RANKS.length - 1];
    const progress = clamp01((g - r.from) / (r.to - r.from));
    return { level: r.level, name: r.name, emoji: r.emoji, next: last ? null : r.to, progress: round(progress), from: r.from, to: r.to };
  }

  // Старый формат { skill: d } (ключ diff в localStorage) → state.
  // global = среднее по навыкам; смещения = отклонение от среднего (effective даёт прежние d).
  function migrate(oldDiff) {
    const st = create();
    if (!oldDiff || typeof oldDiff !== 'object') return st;
    const keys = Object.keys(oldDiff).filter(k => Number.isFinite(Number(oldDiff[k])));
    if (!keys.length) return st;
    const mean = keys.reduce((s, k) => s + clamp01(oldDiff[k]), 0) / keys.length;
    st.global = round(clamp01(mean));
    for (const k of keys) st.skills[k] = round(clampOff(clamp01(oldDiff[k]) - st.global));
    return st;
  }

  return { create, normalize, effective, map, update, set, setGlobal, rank, migrate, RANKS,
    START, MAX_OFFSET, FAST_SECONDS, STEPS: { global: G, skill: S, headroom: HEADROOM, decay: OFFSET_DECAY, shield: SHIELD } };
});
