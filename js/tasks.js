/* Генераторы заданий. Чистые функции, без DOM — тестируются в node.
   Каждое задание: { skill, kind, prompt, say, display, options, answer, hint }
   kind: 'choice' (нажать один вариант) | 'order' (нажать варианты по порядку)
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tasks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SKILLS = {
    count:   { name: 'Счёт',          weight: 1,   topic: 'arith' },
    add:     { name: 'Сложение',      weight: 1.5, topic: 'arith' },
    sub:     { name: 'Вычитание',     weight: 2,   topic: 'arith' },
    compare: { name: 'Сравнение',     weight: 1,   topic: 'order' },
    missing: { name: 'Пропуск числа', weight: 1,   topic: 'order' },
    order:   { name: 'По порядку',    weight: 1,   topic: 'order' },
    shapes:  { name: 'Фигуры',        weight: 1,   topic: 'logic' },
    pattern: { name: 'Узоры',         weight: 1,   topic: 'logic' },
    clock:   { name: 'Часы',          weight: 0.8, topic: 'life' },
    money:   { name: 'Монетки',       weight: 0.8, topic: 'life' },
  };
  const TOPICS = {
    arith: 'Счёт и примеры',
    order: 'Сравнение и порядок',
    logic: 'Фигуры и логика',
    life:  'Часы и деньги',
  };

  const OBJECTS = [
    { e: '⭐', one: 'звёздочка', few: 'звёздочки', many: 'звёздочек', q: 'Сколько звёздочек?' },
    { e: '🪐', one: 'планета',   few: 'планеты',   many: 'планет',    q: 'Сколько планет?' },
    { e: '🚀', one: 'ракета',    few: 'ракеты',    many: 'ракет',     q: 'Сколько ракет?' },
    { e: '👽', one: 'инопланетянин', few: 'инопланетянина', many: 'инопланетян', q: 'Сколько инопланетян?' },
    { e: '🛸', one: 'тарелка',   few: 'тарелки',   many: 'тарелок',   q: 'Сколько летающих тарелок?' },
    { e: '☄️', one: 'комета',    few: 'кометы',    many: 'комет',     q: 'Сколько комет?' },
    { e: '🌙', one: 'луна',      few: 'луны',      many: 'лун',       q: 'Сколько лун?' },
    { e: '🤖', one: 'робот',     few: 'робота',    many: 'роботов',   q: 'Сколько роботов?' },
  ];

  const SHAPES = [
    { id: 'circle',   name: 'круг',        acc: 'круг' },
    { id: 'square',   name: 'квадрат',     acc: 'квадрат' },
    { id: 'triangle', name: 'треугольник', acc: 'треугольник' },
    { id: 'star',     name: 'звезда',      acc: 'звезду' },
    { id: 'heart',    name: 'сердечко',    acc: 'сердечко' },
    { id: 'diamond',  name: 'ромб',        acc: 'ромб' },
  ];
  const COLORS = [
    { id: '#ff5c8a', name: 'розовый' },
    { id: '#ffd23f', name: 'жёлтый' },
    { id: '#3ddc97', name: 'зелёный' },
    { id: '#4cc9f0', name: 'голубой' },
    { id: '#b388ff', name: 'фиолетовый' },
    { id: '#ff8c42', name: 'оранжевый' },
  ];

  // ---------- утилиты ----------
  let rng = Math.random;
  function setRandom(fn) { rng = fn; }
  function rint(a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function plural(n, f) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return f.one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return f.few;
    return f.many;
  }
  // варианты ответа: правильный + отвлекающие рядом, в диапазоне [lo, hi]
  function numberOptions(answer, count, lo, hi) {
    const set = new Set([answer]);
    let guard = 0;
    while (set.size < count && guard++ < 200) {
      const spread = Math.max(2, Math.ceil(count / 2) + 1);
      const c = answer + rint(-spread, spread);
      if (c >= lo && c <= hi && c !== answer) set.add(c);
    }
    // если диапазон узкий — добираем чем есть
    for (let c = lo; set.size < count && c <= hi; c++) set.add(c);
    return shuffle([...set]).map(v => ({ label: String(v), value: v }));
  }

  // ---------- генераторы ----------
  function genCount(level) {
    const max = level === 1 ? 5 : level === 2 ? 10 : 20;
    const min = level === 1 ? 1 : level === 2 ? 4 : 9;
    const n = rint(min, max);
    const obj = pick(OBJECTS);
    return {
      skill: 'count', kind: 'choice',
      prompt: obj.q, say: obj.q,
      display: { type: 'objects', groups: [{ emoji: obj.e, n }] },
      options: numberOptions(n, 3, Math.max(0, min - 2), max + 1),
      answer: n,
      hint: { type: 'number-objects', say: 'Считай по порядку: раз, два, три…' },
      explain: `${n} ${plural(n, obj)}`,
    };
  }

  function genAdd(level) {
    const maxSum = level === 1 ? 5 : level === 2 ? 10 : 20;
    let a, b;
    if (level === 3) {
      // одно слагаемое до 10, сумма может переходить через 10
      a = rint(3, 10); b = rint(2, Math.min(10, maxSum - a));
    } else {
      a = rint(1, maxSum - 1); b = rint(1, maxSum - a);
    }
    const obj = pick(OBJECTS);
    const answer = a + b;
    return {
      skill: 'add', kind: 'choice',
      prompt: `${a} + ${b} = ?`, say: `Сколько будет ${a} плюс ${b}?`,
      display: {
        type: 'expr', text: `${a} + ${b} = ?`,
        groups: [{ emoji: obj.e, n: a }, { emoji: obj.e, n: b }],
        showObjects: level === 1,
      },
      options: numberOptions(answer, level === 1 ? 3 : 4, 0, maxSum + 2),
      answer,
      hint: { type: 'show-objects', say: `Вот ${a} и ещё ${b}. Посчитай все вместе.` },
      explain: `${a} + ${b} = ${answer}`,
    };
  }

  function genSub(level) {
    const max = level === 1 ? 5 : level === 2 ? 10 : 20;
    let a, b;
    if (level === 3) {
      a = rint(11, max); b = rint(2, 10);
    } else {
      a = rint(2, max); b = rint(1, a - (level === 1 ? 0 : 0));
    }
    const obj = pick(OBJECTS);
    const answer = a - b;
    return {
      skill: 'sub', kind: 'choice',
      prompt: `${a} − ${b} = ?`, say: `Сколько будет ${a} минус ${b}?`,
      display: {
        type: 'expr', text: `${a} − ${b} = ?`,
        groups: [{ emoji: obj.e, n: a, crossed: b }],
        showObjects: level === 1,
      },
      options: numberOptions(answer, level === 1 ? 3 : 4, 0, max),
      answer,
      hint: { type: 'show-objects', say: `Было ${a}. Убираем ${b}. Сколько осталось?` },
      explain: `${a} − ${b} = ${answer}`,
    };
  }

  function genCompare(level) {
    if (level === 1) {
      const obj = pick(OBJECTS);
      let a = rint(1, 6), b = rint(1, 6);
      while (a === b) b = rint(1, 6);
      const more = rng() < 0.5;
      const answer = more ? (a > b ? 0 : 1) : (a < b ? 0 : 1);
      return {
        skill: 'compare', kind: 'choice',
        prompt: more ? 'Где больше?' : 'Где меньше?',
        say: more ? `Где ${obj.many} больше? Нажми на ту кучку.` : `Где ${obj.many} меньше? Нажми на ту кучку.`,
        display: { type: 'pair-objects', groups: [{ emoji: obj.e, n: a }, { emoji: obj.e, n: b }] },
        options: [{ label: 'left', value: 0, big: true }, { label: 'right', value: 1, big: true }],
        answer,
        hint: { type: 'pair-counts', say: `Слева ${a}, справа ${b}.` },
        explain: `${Math.max(a, b)} больше, чем ${Math.min(a, b)}`,
      };
    }
    const max = level === 2 ? 10 : 20;
    let a = rint(0, max), b = rint(0, max);
    if (rng() < 0.2) b = a; // иногда равно
    const answer = a > b ? '>' : a < b ? '<' : '=';
    return {
      skill: 'compare', kind: 'choice',
      prompt: 'Какой знак?', say: `Какое число больше: ${a} или ${b}? Выбери знак.`,
      display: { type: 'compare-numbers', a, b },
      options: [{ label: '>', value: '>' }, { label: '=', value: '=' }, { label: '<', value: '<' }],
      answer,
      hint: { type: 'compare-objects', say: 'Клювик открыт к большему числу. Посмотри, где кружков больше.' },
      explain: `${a} ${answer} ${b}`,
    };
  }

  function genMissing(level) {
    let start, step, len = 5;
    if (level === 1) { start = rint(1, 6); step = 1; }
    else if (level === 2) { start = rint(1, 16); step = 1; }
    else {
      if (rng() < 0.5) { start = rint(6, 20); step = -1; }
      else { start = rint(1, 12); step = 2; }
    }
    const seq = Array.from({ length: len }, (_, i) => start + i * step);
    const idx = rint(1, len - 2);
    const answer = seq[idx];
    const lo = Math.max(0, Math.min(...seq) - 2), hi = Math.max(...seq) + 2;
    return {
      skill: 'missing', kind: 'choice',
      prompt: 'Какое число пропущено?', say: 'Какое число пропущено?',
      display: { type: 'sequence', seq, idx },
      options: numberOptions(answer, 3, lo, hi),
      answer,
      hint: { type: 'seq-neighbors', say: `После ${seq[idx - 1]} и перед ${seq[idx + 1]}. Какое число между ними?` },
      explain: seq.join(', '),
    };
  }

  function genOrder(level) {
    const n = level === 1 ? 3 : level === 2 ? 4 : 5;
    const max = level === 1 ? 10 : 20;
    const set = new Set();
    while (set.size < n) set.add(rint(1, max));
    const nums = [...set].sort((a, b) => a - b);
    const desc = level === 3 && rng() < 0.4;
    const answer = desc ? nums.slice().reverse() : nums;
    return {
      skill: 'order', kind: 'order',
      prompt: desc ? 'Нажимай от большего к меньшему' : 'Нажимай от меньшего к большему',
      say: desc ? 'Нажимай числа по порядку: от самого большого к самому маленькому.' : 'Нажимай числа по порядку: от самого маленького к самому большому.',
      display: { type: 'none' },
      options: shuffle(nums).map(v => ({ label: String(v), value: v })),
      answer,
      hint: { type: 'order-next', say: desc ? 'Найди самое большое число из оставшихся.' : 'Найди самое маленькое число из оставшихся.' },
      explain: answer.join(' → '),
    };
  }

  function genShapes(level) {
    if (level === 1) {
      const target = pick(SHAPES);
      const others = shuffle(SHAPES.filter(s => s.id !== target.id)).slice(0, 3);
      const opts = shuffle([target, ...others]).map(s => ({
        label: s.id, value: s.id, shape: s.id, color: pick(COLORS).id,
      }));
      return {
        skill: 'shapes', kind: 'choice',
        prompt: `Найди ${target.acc}`, say: `Найди ${target.acc}.`,
        display: { type: 'none' },
        options: opts, answer: target.id,
        hint: { type: 'shape-names', say: `Подписи помогут. Нужен ${target.name}.` },
        explain: `Это ${target.name}`,
      };
    }
    if (level === 2) {
      // лишняя фигура: 3 одинаковые + 1 другая (по форме или по цвету)
      const byColor = rng() < 0.4;
      const base = pick(SHAPES), baseColor = pick(COLORS);
      let odd;
      if (byColor) odd = { shape: base.id, color: pick(COLORS.filter(c => c.id !== baseColor.id)).id };
      else odd = { shape: pick(SHAPES.filter(s => s.id !== base.id)).id, color: baseColor.id };
      const items = [0, 1, 2].map(() => ({ shape: base.id, color: baseColor.id }));
      const oddIdx = rint(0, 3);
      items.splice(oddIdx, 0, odd);
      return {
        skill: 'shapes', kind: 'choice',
        prompt: 'Что лишнее?', say: 'Одна фигура не такая, как остальные. Найди её.',
        display: { type: 'none' },
        options: items.map((it, i) => ({ label: String(i), value: i, shape: it.shape, color: it.color })),
        answer: oddIdx,
        hint: { type: 'shape-names', say: byColor ? 'Посмотри на цвет.' : 'Посмотри на форму.' },
        explain: byColor ? 'Отличается цвет' : 'Отличается форма',
      };
    }
    // level 3: сколько треугольников (или другой фигуры) среди разных
    const target = pick(SHAPES);
    const n = rint(2, 6);
    const total = rint(n + 2, 9);
    const items = [];
    for (let i = 0; i < n; i++) items.push({ shape: target.id, color: pick(COLORS).id });
    for (let i = n; i < total; i++) items.push({ shape: pick(SHAPES.filter(s => s.id !== target.id)).id, color: pick(COLORS).id });
    return {
      skill: 'shapes', kind: 'choice',
      prompt: `Сколько тут: ${target.name}?`, say: `Посчитай, сколько здесь фигур «${target.name}».`,
      display: { type: 'shapes', items: shuffle(items), target: target.id },
      options: numberOptions(n, 3, 1, total),
      answer: n,
      hint: { type: 'shape-highlight', say: `Считай только ${target.acc}. Остальные не считаем.` },
      explain: `${n}`,
    };
  }

  function genPattern(level) {
    const pool = shuffle(['🚀', '⭐', '🪐', '👽', '🛸', '🌙', '☄️', '🤖']);
    let unit;
    if (level === 1) unit = [pool[0], pool[1]];
    else if (level === 2) unit = [pool[0], pool[1], pool[2]];
    else unit = rng() < 0.5 ? [pool[0], pool[0], pool[1]] : [pool[0], pool[1], pool[1]];
    const reps = level === 1 ? 3 : 2;
    const seq = [];
    for (let r = 0; r < reps; r++) seq.push(...unit);
    const answer = unit[seq.length % unit.length];
    const distinct = [...new Set(unit)];
    const distractors = pool.filter(e => !distinct.includes(e)).slice(0, 3 - distinct.length);
    const opts = shuffle([...distinct, ...distractors]).map(e => ({ label: e, value: e, emoji: true }));
    return {
      skill: 'pattern', kind: 'choice',
      prompt: 'Что дальше?', say: 'Посмотри на узор. Что должно быть дальше?',
      display: { type: 'sequence-emoji', seq, unitLen: unit.length },
      options: opts, answer,
      hint: { type: 'pattern-groups', say: 'Узор повторяется. Смотри, как он начинается.' },
      explain: unit.join(' ') + ' …',
    };
  }

  function timeName(h, m) {
    const hours = h === 1 ? 'час' : h >= 2 && h <= 4 ? 'часа' : 'часов';
    if (m === 0) return `${h} ${hours}`;
    return `${h} ${hours} ${m} минут`;
  }
  function genClock(level) {
    const h = rint(1, 12);
    const m = level === 1 ? 0 : (level === 2 ? pick([0, 30]) : pick([0, 15, 30, 45]));
    const answer = `${h}:${String(m).padStart(2, '0')}`;
    const set = new Set([answer]);
    let guard = 0;
    while (set.size < 3 && guard++ < 50) {
      const hh = rint(1, 12);
      const mm = level === 1 ? 0 : (level === 2 ? pick([0, 30]) : pick([0, 15, 30, 45]));
      set.add(`${hh}:${String(mm).padStart(2, '0')}`);
    }
    const opts = shuffle([...set]).map(v => ({ label: v, value: v }));
    return {
      skill: 'clock', kind: 'choice',
      prompt: 'Который час?', say: 'Посмотри на часы. Который час?',
      display: { type: 'clock', h, m },
      options: opts, answer,
      hint: { type: 'clock-digits', say: m === 0 ? 'Короткая стрелка показывает часы. Длинная на двенадцати — значит ровно.' : 'Короткая стрелка — часы, длинная — минуты.' },
      explain: timeName(h, m),
    };
  }

  function genMoney(level) {
    const coins = [];
    let target;
    if (level === 1) { target = rint(2, 5); }
    else if (level === 2) { target = rint(4, 10); }
    else { target = rint(8, 20); }
    const denoms = level === 1 ? [1, 2] : level === 2 ? [1, 2, 5] : [1, 2, 5, 10];
    let rest = target, guard = 0;
    while (rest > 0 && guard++ < 50) {
      const ok = denoms.filter(d => d <= rest);
      const d = pick(ok);
      coins.push(d); rest -= d;
    }
    const answer = coins.reduce((s, c) => s + c, 0);
    return {
      skill: 'money', kind: 'choice',
      prompt: 'Сколько рублей?', say: 'Посчитай монетки. Сколько всего рублей?',
      display: { type: 'coins', coins: shuffle(coins) },
      options: numberOptions(answer, 3, 1, level === 1 ? 6 : level === 2 ? 12 : 22),
      answer,
      hint: { type: 'coins-sum', say: 'Складывай монетки по одной. Число на монетке — сколько она стоит.' },
      explain: coins.join(' + ') + ' = ' + answer,
    };
  }

  const GEN = { count: genCount, add: genAdd, sub: genSub, compare: genCompare, missing: genMissing,
    order: genOrder, shapes: genShapes, pattern: genPattern, clock: genClock, money: genMoney };

  function generate(skill, level) {
    const lv = Math.min(3, Math.max(1, level | 0 || 1));
    const t = GEN[skill](lv);
    t.level = lv;
    return t;
  }

  // Собрать миссию: n заданий из включённых навыков, с весами, без повторов подряд
  function buildMission(enabledSkills, levels, n) {
    const skills = enabledSkills.filter(s => GEN[s]);
    if (!skills.length) throw new Error('no skills enabled');
    const tasks = [];
    let prev = null;
    for (let i = 0; i < n; i++) {
      const cand = skills.length > 1 ? skills.filter(s => s !== prev) : skills;
      const total = cand.reduce((s, k) => s + SKILLS[k].weight, 0);
      let r = rng() * total, chosen = cand[cand.length - 1];
      for (const k of cand) { r -= SKILLS[k].weight; if (r <= 0) { chosen = k; break; } }
      tasks.push(generate(chosen, levels[chosen] || 1));
      prev = chosen;
    }
    return tasks;
  }

  return { SKILLS, TOPICS, SHAPES, COLORS, OBJECTS, generate, buildMission, setRandom, plural, timeName };
});
