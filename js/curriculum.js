/* Учебная программа. Чистые функции, без DOM — тестируется в node.

   Идея (вместо «общего уровня сложности», который угадывающий ребёнок разгонял за пару миссий):
   1. ШЕСТЬ СТУПЕНЕЙ = шесть званий. На каждой ступени есть ЯДРО (core) — навыки, которые надо освоить,
      и ДОПОЛНЕНИЕ (extra) — навыки для разнообразия, логики и памяти, они не задерживают переход.
   2. МАСТЕРСТВО навыка считается только по ответам С ПЕРВОЙ ПОПЫТКИ (угадывание со второй попытки
      после подсказки не считается). Навык освоен: не меньше 3 ответов на ступени и ≥ 75 % из последних 6 — с первой.
   3. ПЕРЕХОД на следующую ступень — когда освоено всё ядро. Экспресс-переход: 10 последних ответов ядра подряд
      с первой попытки (по ≥ 3 разным навыкам) — ребёнку явно легко, не держим.
   4. СЛОЖНОСТЬ ВНУТРИ ступени: у каждого навыка на ступени диапазон d = [lo, hi] (см. генераторы в tasks.js).
      Текущее d = lo + (hi − lo) · мастерство. Новая ступень всегда начинается с лёгкого края.
   5. МИССИЯ строится по слотам: разминка (освоенное) → ядро (4 слота: новое/трудное, посередине одно
      дополнение) → повтор ошибки → лёгкий финиш. Разминка в начале и успех в конце — чтобы заход был тёплым, а память о миссии хорошей.
   6. ПОВТОР ОШИБОК: навык, где была ошибка, попадает в очередь review и вернётся в одной из ближайших миссий
      (интервальное повторение). Ответ с первой попытки убирает его из очереди.
   7. Если ядро идёт тяжело (< 40 % с первой из последних 8), миссия становится мягче: больше разминки, меньше ядра.

   state = {
     stage: 1..6,
     skills: { [skill]: { seen, intro, hist: [1|0 …], last, mastered } },
         hist — ответы «с первой» на ТЕКУЩЕЙ ступени (сбрасывается при переходе);
         mastered — «липкий» флаг освоения на ступени: ставится при ≥ 3 ответах и ≥ 70 % с первой,
         снимается, только если доля падает до 50 % и ниже. Иначе 5–6 навыков ядра никогда не окажутся
         освоенными одновременно из-за случайных промахов.
     coreLog: [1|0 …],                                               последние ответы по ядру текущей ступени
     review: [skill …],                                             очередь повторов
     days: { 'YYYY-MM-DD': число заданий },                          календарь для серии дней
     log: [{ t, skill, o, s, stage } …],                            последние ответы для родителя
     promotions: [{ t, to }]
   }
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Curriculum = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HIST = 8;            // сколько последних ответов хранить на навык
  const MASTERY_WINDOW = 6;  // по скольким последним считать мастерство
  const MASTERY_MIN = 3;     // минимум ответов на ступени, чтобы навык мог считаться освоенным
  const MASTERY_RATE = 0.7;  // доля «с первой», чтобы навык стал освоенным
  const UNMASTER_RATE = 0.5; // освоенный навык теряет флаг, если доля падает до этого и ниже (при ≥ 4 ответах)
  const EXPRESS_N = 10;      // экспресс-переход: столько подряд с первой по ядру
  const EXPRESS_SKILLS = 3;  // …и не меньше стольких разных навыков среди них
  const STRUGGLE_N = 8;      // по скольким последним ответам ядра судим, что трудно
  const STRUGGLE_RATE = 0.4;
  const REVIEW_MAX = 6;
  const CORE_LOG = 12;
  const LOG_MAX = 60;

  const R = (lo, hi) => [lo, hi];
  const S = (skill, d) => ({ skill, d });
  const STAGES = [
    { level: 1, name: 'Кадет', emoji: '🧑‍🚀', title: 'Числа до 10',
      about: 'Счёт предметов до 10, «сколько» с одного взгляда, где больше, который по счёту, память на 3 предмета.',
      core: [S('count', R(0, 0.3)), S('flash', R(0, 0.25)), S('compare', R(0, 0.3)), S('ordinal', R(0, 0.25)), S('memory', R(0, 0.25))],
      extra: [S('shapes', R(0, 0.3)), S('pattern', R(0, 0.3)), S('size', R(0, 0.4)), S('same', R(0, 0.4))] },
    { level: 2, name: 'Пилот', emoji: '🛩️', title: 'Плюс и минус до 5',
      about: 'Сложение и вычитание до 5 с предметами, соседи числа и пропущенное число до 10, числа по порядку.',
      core: [S('add', R(0, 0.2)), S('sub', R(0, 0.2)), S('neighbors', R(0, 0.3)), S('missing', R(0, 0.25)), S('order', R(0, 0.25))],
      extra: [S('pattern', R(0.4, 0.6)), S('corners', R(0, 0.3)), S('flash', R(0.3, 0.5)), S('memory', R(0.3, 0.5)), S('shapes', R(0.4, 0.6)), S('count', R(0.3, 0.5)), S('same', R(0.5, 0.8))] },
    { level: 3, name: 'Штурман', emoji: '🧭', title: 'Плюс и минус до 10',
      about: 'Примеры до 10 с опорой на предметы, состав числа (долей до 5 и 10), удвоение, задачи-истории, число между. Появляются часы: целые часы.',
      core: [S('add', R(0.25, 0.45)), S('sub', R(0.25, 0.45)), S('fuel', R(0, 0.6)), S('double', R(0, 0.4)), S('story', R(0, 0.35)), S('between', R(0, 0.35))],
      extra: [S('half', R(0, 0.4)), S('diff', R(0, 0.4)), S('listen', R(0, 0.4)), S('numline', R(0, 0.4)), S('simon', R(0, 0.3)), S('clock', R(0, 0.4)), S('ordinal', R(0.3, 0.5)), S('compare', R(0.4, 0.6)), S('neighbors', R(0.35, 0.55))] },
    { level: 4, name: 'Капитан', emoji: '🚀', title: 'Числа до 20, счёт в уме',
      about: 'Примеры до 10 без предметов (считаем в уме), десяток и единицы, соседи и пропущенные числа до 20, числовая прямая до 20. Появляются монетки.',
      core: [S('add', R(0.5, 0.7)), S('sub', R(0.5, 0.7)), S('tens', R(0, 0.45)), S('neighbors', R(0.6, 0.75)), S('numline', R(0.5, 0.75)), S('missing', R(0.3, 0.55))],
      extra: [S('money', R(0, 0.4)), S('order', R(0.3, 0.55)), S('pattern', R(0.7, 1)), S('memory', R(0.6, 0.8)), S('simon', R(0.4, 0.6)), S('flash', R(0.6, 1)), S('clock', R(0.3, 0.45)), S('chain', R(0, 0.45)), S('count', R(0.5, 0.75)), S('story', R(0.4, 0.6))] },
    { level: 5, name: 'Командир', emoji: '🛸', title: 'Через десяток',
      about: 'Сложение и вычитание через десяток (8 + 5, 13 − 5), три слагаемых, задачи «на больше/меньше», знаки сравнения до 20, счёт назад. Часы: половина часа. Монетки по 5 и 10.',
      core: [S('add', R(0.75, 1)), S('sub', R(0.75, 1)), S('chain', R(0.5, 1)), S('story', R(0.7, 1)), S('compare', R(0.65, 1)), S('missing', R(0.6, 0.85))],
      extra: [S('clock', R(0.5, 0.75)), S('money', R(0.4, 0.7)), S('diff', R(0.5, 1)), S('half', R(0.5, 1)), S('between', R(0.4, 0.7)), S('tens', R(0.5, 1)), S('simon', R(0.6, 0.9)), S('neighbors', R(0.8, 1)), S('order', R(0.6, 1))] },
    { level: 6, name: 'Адмирал галактики', emoji: '🌌', title: 'Всё вместе',
      about: 'Все темы на максимуме: числа до 20, часы с четвертями, монетки до 20, узоры и память на 6 предметов.',
      core: [S('add', R(0.8, 1)), S('sub', R(0.8, 1)), S('story', R(0.8, 1)), S('missing', R(0.8, 1)), S('clock', R(0.75, 1)), S('money', R(0.7, 1))],
      extra: ['count', 'flash', 'fuel', 'double', 'half', 'diff', 'chain', 'tens', 'compare', 'order', 'neighbors', 'numline', 'between', 'ordinal', 'listen', 'shapes', 'same', 'pattern', 'size', 'corners', 'memory', 'simon'].map(k => S(k, R(0.7, 1))) },
  ];

  // ---------- вспомогательное ----------
  let rng = Math.random;
  function setRandom(fn) { rng = fn; }
  function pickWeighted(items, weightFn) {
    const ws = items.map(weightFn);
    const total = ws.reduce((a, b) => a + b, 0);
    if (!total) return items[Math.floor(rng() * items.length)];
    let r = rng() * total;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
  function dayKey(date) {
    const dt = date instanceof Date ? date : new Date(date == null ? Date.now() : date);
    const m = String(dt.getMonth() + 1).padStart(2, '0'), d = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${m}-${d}`;
  }
  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d + n));
  }
  const clampStage = s => Math.max(1, Math.min(STAGES.length, Math.round(Number(s)) || 1));

  // ---------- состояние ----------
  function create() {
    return { stage: 1, skills: {}, coreLog: [], review: [], days: {}, log: [], promotions: [] };
  }
  function normalize(st) {
    if (!st || typeof st !== 'object') st = create();
    st.stage = clampStage(st.stage);
    if (!st.skills || typeof st.skills !== 'object') st.skills = {};
    for (const k in st.skills) {
      const s = st.skills[k] || {};
      st.skills[k] = { seen: Number(s.seen) || 0, intro: !!s.intro, hist: Array.isArray(s.hist) ? s.hist.map(x => (x ? 1 : 0)).slice(-HIST) : [], last: Number(s.last) || 0, mastered: !!s.mastered };
    }
    if (!Array.isArray(st.coreLog)) st.coreLog = [];
    if (!Array.isArray(st.review)) st.review = [];
    if (!st.days || typeof st.days !== 'object') st.days = {};
    if (!Array.isArray(st.log)) st.log = [];
    if (!Array.isArray(st.promotions)) st.promotions = [];
    return st;
  }
  function stageOf(st) { return STAGES[clampStage(st.stage) - 1]; }
  function skillState(st, k) { return st.skills[k] || (st.skills[k] = { seen: 0, intro: false, hist: [], last: 0, mastered: false }); }

  // Диапазон d навыка: на текущей ступени, иначе — последняя предыдущая ступень, где он был (освоенный → верхний край).
  function skillRange(st, skill) {
    const cur = stageOf(st);
    const here = cur.core.find(x => x.skill === skill) || cur.extra.find(x => x.skill === skill);
    if (here) return { d: here.d, core: !!cur.core.find(x => x.skill === skill), stage: cur.level };
    for (let i = cur.level - 2; i >= 0; i--) {
      const s = STAGES[i];
      const f = s.core.find(x => x.skill === skill) || s.extra.find(x => x.skill === skill);
      if (f) return { d: [f.d[1], f.d[1]], core: false, stage: s.level, earlier: true };
    }
    return null;
  }

  // Мастерство 0..1: доля «с первой» среди последних MASTERY_WINDOW ответов на ступени (0, если ответов нет).
  function mastery(st, skill) {
    const s = st.skills[skill];
    if (!s || !s.hist.length) return 0;
    const h = s.hist.slice(-MASTERY_WINDOW);
    return h.reduce((a, b) => a + b, 0) / h.length;
  }
  function attempts(st, skill) { const s = st.skills[skill]; return s ? s.hist.length : 0; }
  function isMastered(st, skill) { const s = st.skills[skill]; return !!(s && s.mastered); }
  // пересчитать липкий флаг после ответа
  function refreshMastered(st, skill) {
    const s = skillState(st, skill);
    const n = attempts(st, skill), m = mastery(st, skill);
    if (!s.mastered && n >= MASTERY_MIN && m >= MASTERY_RATE) s.mastered = true;
    else if (s.mastered && n >= 4 && m <= UNMASTER_RATE) s.mastered = false;
    return s.mastered;
  }

  // d для генерации задания навыка сейчас
  function skillD(st, skill) {
    const r = skillRange(st, skill);
    if (!r) return 0;
    const [lo, hi] = r.d;
    if (r.earlier) return hi;
    const m = mastery(st, skill);
    return Math.round((lo + (hi - lo) * m) * 100) / 100;
  }

  function struggling(st) {
    const l = st.coreLog;
    if (l.length < STRUGGLE_N) return false;
    const h = l.slice(-STRUGGLE_N);
    return h.reduce((a, b) => a + b, 0) / h.length < STRUGGLE_RATE;
  }

  // Прогресс ступени: средний «балл освоения» по ядру (0..1). Балл навыка = мастерство × заполненность минимума.
  function stageProgress(st) {
    const cur = stageOf(st);
    const scores = cur.core.map(x => isMastered(st, x.skill) ? 1 : Math.min(1, attempts(st, x.skill) / MASTERY_MIN) * Math.min(1, mastery(st, x.skill) / MASTERY_RATE));
    const done = cur.core.filter(x => isMastered(st, x.skill)).length;
    return { done, total: cur.core.length, pct: scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length) };
  }
  function rank(st) {
    const s = stageOf(st);
    const p = stageProgress(st);
    return { level: s.level, name: s.name, emoji: s.emoji, title: s.title, progress: Math.round(p.pct * 100) / 100, last: s.level === STAGES.length };
  }

  // ---------- план миссии ----------
  // enabled — массив включённых родителем навыков. Возвращает [{ skill, d, slot, lesson }].
  // now — «сейчас» для весов давности (по умолчанию Date.now(); в тестах передаётся симулированное время).
  function planMission(st, enabled, n, now) {
    st = normalize(st);
    n = n || 8;
    now = now == null ? Date.now() : now;
    const cur = stageOf(st);
    const en = new Set(enabled && enabled.length ? enabled : Object.keys(allSkills()));
    const ok = k => en.has(k);
    const core = cur.core.map(x => x.skill).filter(ok);
    const extra = cur.extra.map(x => x.skill).filter(ok);
    // освоенное: навыки прошлых ступеней + освоенные здесь
    const earlier = new Set();
    for (let i = 0; i < cur.level - 1; i++) for (const x of STAGES[i].core.concat(STAGES[i].extra)) if (ok(x.skill)) earlier.add(x.skill);
    const warmPool = [...new Set([...earlier, ...core.filter(k => isMastered(st, k)), ...extra.filter(k => isMastered(st, k))])];
    const hard = struggling(st);

    const plan = [];
    const used = {};
    const canUse = k => k && (used[k] || 0) < 2 && (!plan.length || plan[plan.length - 1].skill !== k);
    const push = (k, slot) => {
      if (!k) return false;
      used[k] = (used[k] || 0) + 1;
      plan.push({ skill: k, d: skillD(st, k), slot, lesson: !skillState(st, k).intro });
      return true;
    };
    const recency = k => { const s = st.skills[k]; return s ? s.last : 0; };
    // выбрать из пула: реже виденные — чаще
    const pickFresh = (pool) => {
      const c = pool.filter(canUse);
      if (!c.length) return null;
      return pickWeighted(c, k => 1 + Math.min(5, Math.max(0, now - recency(k)) / 864e5));
    };
    // ядро: сначала те, что ещё не встречались (нужен урок), потом слабые
    const pickCore = () => {
      const c = core.filter(canUse);
      if (!c.length) return null;
      const unseen = c.filter(k => !skillState(st, k).intro);
      if (unseen.length) return unseen[Math.floor(rng() * unseen.length)];
      const open = c.filter(k => !isMastered(st, k));
      return pickWeighted(open.length ? open : c, k => 0.3 + (1 - mastery(st, k)) + (attempts(st, k) < MASTERY_MIN ? 0.5 : 0));
    };
    const pickReview = () => {
      for (const k of st.review) if (ok(k) && canUse(k) && skillRange(st, k)) return k;
      return null;
    };

    // слоты: обычно 1 разминка → 4 ядра (с дополнением посередине) → повтор → лёгкий финиш;
    // когда трудно — 3 разминки и только 2 ядра
    const slots = hard
      ? ['warm', 'warm', 'core', 'extra', 'core', 'warm', 'review', 'finish']
      : ['warm', 'core', 'core', 'extra', 'core', 'core', 'review', 'finish'];
    while (slots.length < n) slots.splice(slots.length - 1, 0, 'core');
    while (slots.length > n) slots.splice(slots.indexOf('extra'), 1);

    for (const slot of slots) {
      if (plan.length >= n) break;
      let k = null;
      if (slot === 'warm') k = pickFresh(warmPool) || pickCore() || pickFresh(extra);
      else if (slot === 'core') k = pickCore() || pickFresh(extra) || pickFresh(warmPool);
      else if (slot === 'extra') k = pickFresh(extra) || pickCore() || pickFresh(warmPool);
      else if (slot === 'review') k = pickReview() || pickCore() || pickFresh(extra) || pickFresh(warmPool);
      else if (slot === 'finish') k = pickFresh(warmPool) || pickFresh(extra) || pickCore();
      if (!k) { // всё исчерпано — берём что угодно из включённых на ступени
        const any = [...new Set([...core, ...extra, ...warmPool])].filter(x => x !== (plan.length ? plan[plan.length - 1].skill : null));
        k = any.length ? any[Math.floor(rng() * any.length)] : (core[0] || extra[0] || warmPool[0]);
        if (k) { used[k] = (used[k] || 0) + 1; plan.push({ skill: k, d: skillD(st, k), slot, lesson: !skillState(st, k).intro }); }
        continue;
      }
      push(k, slot);
    }
    // финиш — заведомо лёгкий: нижний край диапазона
    const fin = plan[plan.length - 1];
    if (fin) { const r = skillRange(st, fin.skill); if (r && !r.earlier) fin.d = r.d[0]; }
    // урок показываем один раз за миссию на навык
    const taught = new Set();
    for (const p of plan) { if (p.lesson) { if (taught.has(p.skill)) p.lesson = false; else taught.add(p.skill); } }
    return plan;
  }

  function markIntro(st, skill) { skillState(st, skill).intro = true; return st; }

  // ---------- учёт ответа ----------
  // o: 2 — с первой попытки, 1 — после режима «вместе», 0 — не решил. seconds — время до ответа.
  // Возвращает { promoted: stage | null, mastered: bool (навык только что освоен) }
  function record(st, skill, o, seconds, now) {
    st = normalize(st);
    now = now == null ? Date.now() : now;
    const s = skillState(st, skill);
    const wasMastered = isMastered(st, skill);
    const first = o >= 2 ? 1 : 0;
    s.seen++; s.last = now; s.intro = true;
    s.hist.push(first); if (s.hist.length > HIST) s.hist.splice(0, s.hist.length - HIST);
    refreshMastered(st, skill);
    const cur = stageOf(st);
    const inCore = !!cur.core.find(x => x.skill === skill);
    if (inCore) { st.coreLog.push(first); if (st.coreLog.length > CORE_LOG) st.coreLog.splice(0, st.coreLog.length - CORE_LOG); }
    // очередь повторов
    const ri = st.review.indexOf(skill);
    if (o < 2) { if (ri >= 0) st.review.splice(ri, 1); st.review.push(skill); if (st.review.length > REVIEW_MAX) st.review.shift(); }
    else if (ri >= 0) st.review.splice(ri, 1);
    // календарь
    const dk = dayKey(now);
    st.days[dk] = (st.days[dk] || 0) + 1;
    // журнал
    st.log.push({ t: now, skill, o, s: seconds == null ? null : Math.round(Number(seconds) * 10) / 10, stage: cur.level });
    if (st.log.length > LOG_MAX) st.log.splice(0, st.log.length - LOG_MAX);

    const promoted = checkPromotion(st, now);
    return { promoted, mastered: !wasMastered && !promoted && isMastered(st, skill) };
  }

  function checkPromotion(st, now) {
    const cur = stageOf(st);
    if (cur.level >= STAGES.length) return null;
    const allCore = cur.core.every(x => isMastered(st, x.skill));
    let express = false;
    if (st.coreLog.length >= EXPRESS_N) {
      const last = st.coreLog.slice(-EXPRESS_N);
      if (last.every(x => x === 1)) {
        const recent = st.log.filter(l => l.stage === cur.level && cur.core.find(x => x.skill === l.skill)).slice(-EXPRESS_N);
        express = new Set(recent.map(l => l.skill)).size >= EXPRESS_SKILLS;
      }
    }
    if (!allCore && !express) return null;
    return promote(st, cur.level + 1, now);
  }

  function promote(st, to, now) {
    st.stage = clampStage(to);
    for (const k in st.skills) { st.skills[k].hist = []; st.skills[k].mastered = false; }
    st.coreLog = [];
    st.promotions.push({ t: now == null ? Date.now() : now, to: st.stage });
    return st.stage;
  }

  // Ручная установка родителем
  function setStage(st, level) {
    st = normalize(st);
    const to = clampStage(level);
    if (to === st.stage) return st;
    st.stage = to;
    for (const k in st.skills) { st.skills[k].hist = []; st.skills[k].mastered = false; }
    st.coreLog = [];
    return st;
  }

  // ---------- серия дней ----------
  // { streak, playedToday, last7: [{ key, played, today }] }
  function streak(st, now) {
    st = normalize(st);
    const today = dayKey(now == null ? Date.now() : now);
    const played = k => (st.days[k] || 0) > 0;
    let n = 0, k = played(today) ? today : addDays(today, -1);
    while (played(k) && n < 3650) { n++; k = addDays(k, -1); }
    const last7 = [];
    for (let i = 6; i >= 0; i--) { const key = addDays(today, -i); last7.push({ key, played: played(key), today: key === today }); }
    return { streak: n, playedToday: played(today), last7 };
  }

  // ---------- миграция со старой модели (общий уровень 0..1 + смещения) ----------
  // Карта планет сбрасывается в app.js; здесь — только учебная программа. Старую статистику не доверяем
  // (угадывание), поэтому стартуем с 1-й или 2-й ступени: 2-я, если ребёнок уже сыграл много миссий.
  function migrate(oldState) {
    const st = create();
    const missions = oldState && Array.isArray(oldState.history) ? oldState.history.length : 0;
    st.stage = missions >= 5 ? 2 : 1;
    return st;
  }

  function allSkills() {
    const out = {};
    for (const s of STAGES) for (const x of s.core.concat(s.extra)) out[x.skill] = true;
    return out;
  }
  // На какой ступени навык впервые появляется (для родительской панели)
  function firstStage(skill) {
    for (const s of STAGES) if (s.core.concat(s.extra).find(x => x.skill === skill)) return s.level;
    return null;
  }

  return { STAGES, create, normalize, planMission, markIntro, record, setStage, promote, rank, stageProgress,
    mastery, attempts, isMastered, skillD, skillRange, struggling, streak, dayKey, migrate, allSkills, firstStage, setRandom,
    PARAMS: { HIST, MASTERY_WINDOW, MASTERY_MIN, MASTERY_RATE, UNMASTER_RATE, EXPRESS_N, EXPRESS_SKILLS, STRUGGLE_N, STRUGGLE_RATE, REVIEW_MAX } };
});
