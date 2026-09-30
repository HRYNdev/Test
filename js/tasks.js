/* Генераторы заданий. Чистые функции, без DOM — тестируются в node.
   generate(skill, d) — d: сложность 0..1 (непрерывная).
   Каждое задание: { skill, kind, scene, prompt, say, display, options, answer, hint, explain }
   kind: 'choice' (нажать один вариант) | 'order' (нажать варианты по порядку)
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tasks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SKILLS = {
    count:     { name: 'Счёт',            weight: 1,   topic: 'arith' },
    add:       { name: 'Сложение',        weight: 1.3, topic: 'arith' },
    sub:       { name: 'Вычитание',       weight: 1.8, topic: 'arith' },
    fuel:      { name: 'Долей топлива',   weight: 1.2, topic: 'arith' },
    story:     { name: 'Задачи-истории',  weight: 1.2, topic: 'arith' },
    compare:   { name: 'Сравнение',       weight: 1,   topic: 'order' },
    missing:   { name: 'Радар',           weight: 1,   topic: 'order' },
    order:     { name: 'Стыковка',        weight: 1,   topic: 'order' },
    neighbors: { name: 'Соседи числа',    weight: 0.9, topic: 'order' },
    numline:   { name: 'Числовая прямая', weight: 0.9, topic: 'order' },
    shapes:    { name: 'Ремонт ракеты',   weight: 1,   topic: 'logic' },
    pattern:   { name: 'Огни полосы',     weight: 1,   topic: 'logic' },
    clock:     { name: 'Космо-часы',      weight: 0.8, topic: 'life' },
    money:     { name: 'Космо-магазин',   weight: 0.8, topic: 'life' },
  };
  const TOPICS = {
    arith: 'Счёт и примеры',
    order: 'Сравнение и порядок',
    logic: 'Фигуры и логика',
    life:  'Часы и деньги',
  };

  const OBJECTS = [
    { e: '⭐', one: 'звёздочка', few: 'звёздочки', many: 'звёздочек', q: 'Сколько звёздочек светит?' },
    { e: '🪐', one: 'планета',   few: 'планеты',   many: 'планет',    q: 'Сколько планет на радаре?' },
    { e: '🚀', one: 'ракета',    few: 'ракеты',    many: 'ракет',     q: 'Сколько ракет на старте?' },
    { e: '👽', one: 'инопланетянин', few: 'инопланетянина', many: 'инопланетян', q: 'Сколько инопланетян прилетело?' },
    { e: '🛸', one: 'тарелка',   few: 'тарелки',   many: 'тарелок',   q: 'Сколько летающих тарелок?' },
    { e: '☄️', one: 'комета',    few: 'кометы',    many: 'комет',     q: 'Сколько комет пролетает?' },
    { e: '🌙', one: 'луна',      few: 'луны',      many: 'лун',       q: 'Сколько лун у планеты?' },
    { e: '🤖', one: 'робот',     few: 'робота',    many: 'роботов',   q: 'Сколько роботов на базе?' },
    { e: '💎', one: 'кристалл',  few: 'кристалла', many: 'кристаллов', q: 'Сколько кристаллов нашли?' },
    { e: '🧑‍🚀', one: 'космонавт', few: 'космонавта', many: 'космонавтов', q: 'Сколько космонавтов в отряде?' },
  ];
  const HEROES = [{ n: 'Зум', g: 'Зума', v: 'подарил' }, { n: 'Бип', g: 'Бипа', v: 'подарил' }, { n: 'Ника', g: 'Ники', v: 'подарила' }, { n: 'Тим', g: 'Тима', v: 'подарил' }, { n: 'Кроха', g: 'Крохи', v: 'подарила' }];

  const SHAPES = [
    { id: 'circle',   name: 'круг',        acc: 'круг',        part: 'круглый иллюминатор' },
    { id: 'square',   name: 'квадрат',     acc: 'квадрат',     part: 'квадратный люк' },
    { id: 'triangle', name: 'треугольник', acc: 'треугольник', part: 'треугольное крыло' },
    { id: 'star',     name: 'звезда',      acc: 'звезду',      part: 'звёздный фонарик' },
    { id: 'heart',    name: 'сердечко',    acc: 'сердечко',    part: 'сердечко-датчик' },
    { id: 'diamond',  name: 'ромб',        acc: 'ромб',        part: 'ромбик-антенна' },
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
  function clamp01(d) { return Math.max(0, Math.min(1, Number(d) || 0)); }
  function lerp(a, b, d) { return Math.round(a + (b - a) * d); }
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
    for (let c = lo; set.size < count && c <= hi; c++) set.add(c);
    return shuffle([...set]).map(v => ({ label: String(v), value: v }));
  }
  const optCount = d => (d < 0.45 ? 3 : 4);

  // ---------- генераторы (d = 0..1) ----------
  function genCount(d) {
    const min = lerp(1, 9, d), max = lerp(5, 20, d);
    const n = rint(min, max);
    const obj = pick(OBJECTS);
    return {
      skill: 'count', kind: 'choice', scene: 'porthole',
      prompt: obj.q, say: obj.q,
      display: { type: 'objects', groups: [{ emoji: obj.e, n }] },
      options: numberOptions(n, optCount(d), Math.max(0, min - 2), max + 1),
      answer: n,
      hint: { type: 'number-objects', say: 'Считай по порядку и показывай пальцем: раз, два, три…' },
      explain: `${n} ${plural(n, obj)}`,
    };
  }

  function genAdd(d) {
    const maxSum = lerp(5, 20, d);
    let a, b;
    if (maxSum > 10 && rng() < 0.6) { a = rint(3, 10); b = rint(2, Math.min(10, maxSum - a)); }
    else { a = rint(1, Math.min(9, maxSum - 1)); b = rint(1, Math.min(9, maxSum - a)); }
    const obj = pick(OBJECTS);
    const answer = a + b;
    return {
      skill: 'add', kind: 'choice', scene: 'docking',
      prompt: `${a} + ${b} = ?`,
      say: `Стыковка! В одном модуле ${a} ${plural(a, obj)}, в другом ${b}. Сколько будет вместе? ${a} плюс ${b}.`,
      display: { type: 'expr', text: `${a} + ${b} = ?`, groups: [{ emoji: obj.e, n: a }, { emoji: obj.e, n: b }], showObjects: d < 0.35 },
      options: numberOptions(answer, optCount(d), 0, maxSum + 2),
      answer,
      hint: { type: 'show-objects', say: `Вот ${a} и ещё ${b}. Посчитай все вместе.` },
      explain: `${a} + ${b} = ${answer}`,
    };
  }

  function genSub(d) {
    const max = lerp(5, 20, d);
    let a, b;
    if (max > 10 && rng() < 0.6) { a = rint(11, max); b = rint(2, 10); }
    else { a = rint(2, Math.min(10, max)); b = rint(1, a); }
    const obj = pick(OBJECTS);
    const answer = a - b;
    return {
      skill: 'sub', kind: 'choice', scene: 'flyaway',
      prompt: `${a} − ${b} = ?`,
      say: `На планете было ${a} ${plural(a, obj)}. ${b} улетели. Сколько осталось? ${a} минус ${b}.`,
      display: { type: 'expr', text: `${a} − ${b} = ?`, groups: [{ emoji: obj.e, n: a, crossed: b }], showObjects: d < 0.4 },
      options: numberOptions(answer, optCount(d), 0, max),
      answer,
      hint: { type: 'show-objects', say: `Было ${a}. Зачёркиваем ${b}. Считай, сколько не зачёркнуто.` },
      explain: `${a} − ${b} = ${answer}`,
    };
  }

  // Сколько не хватает: a + ? = target (шкала топлива)
  function genFuel(d) {
    const target = d < 0.3 ? 5 : d < 0.7 ? 10 : (rng() < 0.5 ? 10 : 20);
    const have = rint(1, target - 1);
    const answer = target - have;
    return {
      skill: 'fuel', kind: 'choice', scene: 'fuel',
      prompt: `${have} + ? = ${target}`,
      say: `Заправка! Баку нужно ${target} ${plural(target, { one: 'литр', few: 'литра', many: 'литров' })}. Залито ${have}. Сколько ещё долить?`,
      display: { type: 'fuel', target, have },
      options: numberOptions(answer, optCount(d), 1, target),
      answer,
      hint: { type: 'fuel-count', say: `Считай пустые клеточки от ${have + 1} до ${target}.` },
      explain: `${have} + ${answer} = ${target}`,
    };
  }

  // Задачи-истории с персонажами
  function genStory(d) {
    const max = lerp(5, 20, d);
    const obj = pick(OBJECTS.filter(o => o.e !== '🧑‍🚀'));
    const h1 = pick(HEROES), h2 = pick(HEROES.filter(h => h !== h1));
    const H1 = h1.g, H2 = h2.g;
    const kind = pick(['add', 'sub', 'more', 'less']);
    let a, b, answer, text, groups;
    if (kind === 'add') {
      a = rint(1, Math.max(1, max - 2)); b = rint(1, Math.max(1, max - a));
      answer = a + b;
      text = `У ${H1} ${a} ${plural(a, obj)}, у ${H2} ${b}. Сколько у них вместе?`;
      groups = [{ emoji: obj.e, n: a, label: h1.n }, { emoji: obj.e, n: b, label: h2.n }];
    } else if (kind === 'sub') {
      a = rint(2, max); b = rint(1, a);
      answer = a - b;
      text = `У ${H1} было ${a} ${plural(a, obj)}. ${b} ${h1.n} ${h1.v} другу. Сколько осталось?`;
      groups = [{ emoji: obj.e, n: a, crossed: b, label: h1.n }];
    } else if (kind === 'more') {
      a = rint(1, Math.max(1, max - 3)); b = rint(1, Math.min(5, max - a));
      answer = a + b;
      text = `У ${H1} ${a} ${plural(a, obj)}, а у ${H2} на ${b} больше. Сколько у ${H2}?`;
      groups = [{ emoji: obj.e, n: a, label: h1.n }, { emoji: obj.e, n: a, extra: b, label: h2.n }];
    } else {
      b = rint(1, 5); a = rint(b + 1, Math.max(b + 1, max));
      answer = a - b;
      text = `У ${H1} ${a} ${plural(a, obj)}, а у ${H2} на ${b} меньше. Сколько у ${H2}?`;
      groups = [{ emoji: obj.e, n: a, label: h1.n }, { emoji: obj.e, n: a, crossed: b, label: h2.n }];
    }
    return {
      skill: 'story', kind: 'choice', scene: 'story',
      prompt: text, say: text,
      display: { type: 'story', groups, showObjects: d < 0.5 },
      options: numberOptions(answer, optCount(d), 0, max + 5),
      answer,
      hint: { type: 'show-objects', say: 'Смотри на картинку и считай.' },
      explain: `${answer}`,
    };
  }

  function genCompare(d) {
    if (d < 0.35) {
      const obj = pick(OBJECTS);
      let a = rint(1, 6), b = rint(1, 6);
      while (a === b) b = rint(1, 6);
      const more = rng() < 0.5;
      const answer = more ? (a > b ? 0 : 1) : (a < b ? 0 : 1);
      return {
        skill: 'compare', kind: 'choice', scene: 'planets',
        prompt: more ? 'На какой планете больше?' : 'На какой планете меньше?',
        say: more ? `На какой планете ${obj.many} больше? Нажми на неё.` : `На какой планете ${obj.many} меньше? Нажми на неё.`,
        display: { type: 'pair-objects', groups: [{ emoji: obj.e, n: a }, { emoji: obj.e, n: b }] },
        options: [{ label: 'left', value: 0 }, { label: 'right', value: 1 }],
        answer,
        hint: { type: 'pair-counts', say: `Слева ${a}, справа ${b}.` },
        explain: `${Math.max(a, b)} больше, чем ${Math.min(a, b)}`,
      };
    }
    const max = lerp(10, 20, d);
    let a = rint(0, max), b = rint(0, max);
    if (rng() < 0.2) b = a;
    const answer = a > b ? '>' : a < b ? '<' : '=';
    return {
      skill: 'compare', kind: 'choice', scene: 'scales',
      prompt: 'Какой знак?', say: `Космические весы. Какое число больше: ${a} или ${b}? Выбери знак.`,
      display: { type: 'compare-numbers', a, b },
      options: [{ label: '>', value: '>' }, { label: '=', value: '=' }, { label: '<', value: '<' }],
      answer,
      hint: { type: 'compare-objects', say: 'Клювик открыт к большему числу. Смотри, где кружков больше.' },
      explain: `${a} ${answer} ${b}`,
    };
  }

  function genMissing(d) {
    let start, step, len = 5;
    if (d < 0.35) { start = rint(1, 6); step = 1; }
    else if (d < 0.7) { start = rint(1, 16); step = 1; }
    else if (rng() < 0.5) { start = rint(6, 20); step = -1; }
    else { start = rint(1, 12); step = 2; }
    const seq = Array.from({ length: len }, (_, i) => start + i * step);
    const idx = rint(1, len - 2);
    const answer = seq[idx];
    const lo = Math.max(0, Math.min(...seq) - 2), hi = Math.max(...seq) + 2;
    return {
      skill: 'missing', kind: 'choice', scene: 'radar',
      prompt: 'Какой сигнал пропал?', say: 'Радар потерял один сигнал. Какое число пропущено?',
      display: { type: 'sequence', seq, idx },
      options: numberOptions(answer, optCount(d), lo, hi),
      answer,
      hint: { type: 'seq-neighbors', say: `После ${seq[idx - 1]} и перед ${seq[idx + 1]}. Какое число между ними?` },
      explain: seq.join(', '),
    };
  }

  function genOrder(d) {
    const n = 3 + Math.round(d * 2);
    const max = lerp(10, 20, d);
    const set = new Set();
    while (set.size < n) set.add(rint(1, max));
    const nums = [...set].sort((a, b) => a - b);
    const desc = d > 0.55 && rng() < 0.45;
    const answer = desc ? nums.slice().reverse() : nums;
    return {
      skill: 'order', kind: 'order', scene: desc ? 'countdown' : 'docking',
      prompt: desc ? 'Обратный отсчёт: от большего к меньшему' : 'Стыкуй модули: от меньшего к большему',
      say: desc ? 'Обратный отсчёт перед стартом! Нажимай числа от самого большого к самому маленькому.' : 'Стыкуем модули по порядку: от самого маленького числа к самому большому.',
      display: { type: 'none' },
      options: shuffle(nums).map(v => ({ label: String(v), value: v })),
      answer,
      hint: { type: 'order-next', say: desc ? 'Найди самое большое число из оставшихся.' : 'Найди самое маленькое число из оставшихся.' },
      explain: answer.join(' → '),
    };
  }

  function genNeighbors(d) {
    const max = lerp(9, 20, d);
    const n = rint(1, max);
    const after = d < 0.5 ? true : rng() < 0.5;
    if (!after && n === 1) return genNeighbors(d);
    const answer = after ? n + 1 : n - 1;
    return {
      skill: 'neighbors', kind: 'choice', scene: 'radar',
      prompt: after ? `Какое число после ${n}?` : `Какое число перед ${n}?`,
      say: after ? `Ракета летит по числам. Какое число идёт сразу после ${n}?` : `Какое число идёт прямо перед ${n}?`,
      display: { type: 'neighbors', n, after },
      options: numberOptions(answer, optCount(d), Math.max(0, n - 3), n + 3),
      answer,
      hint: { type: 'neighbors-line', say: after ? `Считай дальше: ${n}, а потом…` : `Считай назад: ${n}, а перед ним…` },
      explain: after ? `${n}, ${answer}` : `${answer}, ${n}`,
    };
  }

  function genNumline(d) {
    const max = d < 0.4 ? 10 : 20;
    const n = rint(1, max - 1);
    const labelEvery = d < 0.3 ? 1 : d < 0.7 ? 5 : 10;
    return {
      skill: 'numline', kind: 'choice', scene: 'numline',
      prompt: 'На каком числе ракета?', say: 'Ракета приземлилась на числовую прямую. На каком числе она стоит?',
      display: { type: 'numline', max, n, labelEvery },
      options: numberOptions(n, optCount(d), 0, max),
      answer: n,
      hint: { type: 'numline-labels', say: 'Считай деления от нуля.' },
      explain: `${n}`,
    };
  }

  function genShapes(d) {
    if (d < 0.35) {
      const target = pick(SHAPES);
      const others = shuffle(SHAPES.filter(s => s.id !== target.id)).slice(0, 3);
      const opts = shuffle([target, ...others]).map(s => ({ label: s.id, value: s.id, shape: s.id, color: pick(COLORS).id }));
      return {
        skill: 'shapes', kind: 'choice', scene: 'repair',
        prompt: `Нужна деталь: ${target.name}`, say: `Ремонт ракеты! Нужен ${target.part}. Найди ${target.acc}.`,
        display: { type: 'none' },
        options: opts, answer: target.id,
        hint: { type: 'shape-names', say: `Подписи помогут. Нужен ${target.name}.` },
        explain: `Это ${target.name}`,
      };
    }
    if (d < 0.7) {
      const byColor = rng() < 0.4;
      const base = pick(SHAPES), baseColor = pick(COLORS);
      const odd = byColor ? { shape: base.id, color: pick(COLORS.filter(c => c.id !== baseColor.id)).id }
        : { shape: pick(SHAPES.filter(s => s.id !== base.id)).id, color: baseColor.id };
      const items = [0, 1, 2].map(() => ({ shape: base.id, color: baseColor.id }));
      const oddIdx = rint(0, 3);
      items.splice(oddIdx, 0, odd);
      return {
        skill: 'shapes', kind: 'choice', scene: 'repair',
        prompt: 'Какая деталь лишняя?', say: 'Одна деталь не подходит к остальным. Найди её.',
        display: { type: 'none' },
        options: items.map((it, i) => ({ label: String(i), value: i, shape: it.shape, color: it.color })),
        answer: oddIdx,
        hint: { type: 'shape-names', say: byColor ? 'Посмотри на цвет.' : 'Посмотри на форму.' },
        explain: byColor ? 'Отличается цвет' : 'Отличается форма',
      };
    }
    const target = pick(SHAPES);
    const n = rint(2, 6);
    const total = rint(n + 2, 9);
    const items = [];
    for (let i = 0; i < n; i++) items.push({ shape: target.id, color: pick(COLORS).id });
    for (let i = n; i < total; i++) items.push({ shape: pick(SHAPES.filter(s => s.id !== target.id)).id, color: pick(COLORS).id });
    return {
      skill: 'shapes', kind: 'choice', scene: 'repair',
      prompt: `Сколько деталей: ${target.name}?`, say: `В ящике с деталями посчитай, сколько фигур «${target.name}».`,
      display: { type: 'shapes', items: shuffle(items), target: target.id },
      options: numberOptions(n, 3, 1, total),
      answer: n,
      hint: { type: 'shape-highlight', say: `Считай только ${target.acc}. Остальные не считаем.` },
      explain: `${n}`,
    };
  }

  function genPattern(d) {
    const pool = shuffle(['🚀', '⭐', '🪐', '👽', '🛸', '🌙', '☄️', '🤖', '💎']);
    let unit;
    if (d < 0.35) unit = [pool[0], pool[1]];
    else if (d < 0.7) unit = [pool[0], pool[1], pool[2]];
    else unit = rng() < 0.5 ? [pool[0], pool[0], pool[1]] : [pool[0], pool[1], pool[1]];
    const reps = d < 0.35 ? 3 : 2;
    const seq = [];
    for (let r = 0; r < reps; r++) seq.push(...unit);
    const answer = unit[seq.length % unit.length];
    const distinct = [...new Set(unit)];
    const distractors = pool.filter(e => !distinct.includes(e)).slice(0, 3 - distinct.length);
    const opts = shuffle([...distinct, ...distractors]).map(e => ({ label: e, value: e, emoji: true }));
    return {
      skill: 'pattern', kind: 'choice', scene: 'runway',
      prompt: 'Какой огонёк дальше?', say: 'Огни взлётной полосы мигают по порядку. Какой огонёк должен быть дальше?',
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
  function genClock(d) {
    const h = rint(1, 12);
    const m = d < 0.4 ? 0 : d < 0.75 ? pick([0, 30]) : pick([0, 15, 30, 45]);
    const answer = `${h}:${String(m).padStart(2, '0')}`;
    const set = new Set([answer]);
    let guard = 0;
    while (set.size < 3 && guard++ < 50) {
      const hh = rint(1, 12);
      const mm = d < 0.4 ? 0 : d < 0.75 ? pick([0, 30]) : pick([0, 15, 30, 45]);
      set.add(`${hh}:${String(mm).padStart(2, '0')}`);
    }
    return {
      skill: 'clock', kind: 'choice', scene: 'clock',
      prompt: 'Когда старт ракеты?', say: 'Посмотри на космические часы. Который час?',
      display: { type: 'clock', h, m },
      options: shuffle([...set]).map(v => ({ label: v, value: v })), answer,
      hint: { type: 'clock-digits', say: m === 0 ? 'Короткая стрелка показывает часы. Длинная на двенадцати — значит ровно.' : 'Короткая стрелка — часы, длинная — минуты.' },
      explain: timeName(h, m),
    };
  }

  const SHOP = [
    { e: '🍭', name: 'космо-леденец' }, { e: '🧃', name: 'звёздный сок' }, { e: '🔭', name: 'телескоп' },
    { e: '🧸', name: 'мишка-астронавт' }, { e: '🎈', name: 'шарик-планета' }, { e: '🍪', name: 'лунная печенька' },
  ];
  function genMoney(d) {
    const target = d < 0.3 ? rint(2, 5) : d < 0.7 ? rint(4, 10) : rint(8, 20);
    const denoms = d < 0.3 ? [1, 2] : d < 0.7 ? [1, 2, 5] : [1, 2, 5, 10];
    const coins = [];
    let rest = target, guard = 0;
    while (rest > 0 && guard++ < 50) { const dd = pick(denoms.filter(x => x <= rest)); coins.push(dd); rest -= dd; }
    const answer = coins.reduce((s, c) => s + c, 0);
    const item = pick(SHOP);
    return {
      skill: 'money', kind: 'choice', scene: 'shop',
      prompt: 'Сколько монет в кошельке?', say: `Космо-магазин! Хочешь купить ${item.name}. Посчитай, сколько всего монет в кошельке.`,
      display: { type: 'coins', coins: shuffle(coins), item },
      options: numberOptions(answer, optCount(d), 1, d < 0.3 ? 6 : d < 0.7 ? 12 : 22),
      answer,
      hint: { type: 'coins-sum', say: 'Складывай монетки по одной. Число на монетке — сколько она стоит.' },
      explain: coins.join(' + ') + ' = ' + answer,
    };
  }

  const GEN = { count: genCount, add: genAdd, sub: genSub, fuel: genFuel, story: genStory, compare: genCompare,
    missing: genMissing, order: genOrder, neighbors: genNeighbors, numline: genNumline, shapes: genShapes,
    pattern: genPattern, clock: genClock, money: genMoney };

  function generate(skill, d) {
    const dd = clamp01(d);
    const t = GEN[skill](dd);
    t.difficulty = dd;
    return t;
  }

  // Собрать миссию: n заданий из включённых навыков, с весами, без повторов подряд
  function buildMission(enabledSkills, diffs, n) {
    const skills = enabledSkills.filter(s => GEN[s]);
    if (!skills.length) throw new Error('no skills enabled');
    const tasks = [];
    let prev = null;
    for (let i = 0; i < n; i++) {
      const cand = skills.length > 1 ? skills.filter(s => s !== prev) : skills;
      const total = cand.reduce((s, k) => s + SKILLS[k].weight, 0);
      let r = rng() * total, chosen = cand[cand.length - 1];
      for (const k of cand) { r -= SKILLS[k].weight; if (r <= 0) { chosen = k; break; } }
      tasks.push(generate(chosen, diffs[chosen] == null ? 0.3 : diffs[chosen]));
      prev = chosen;
    }
    return tasks;
  }

  // Динамика сложности: новое значение после ответа.
  // stars: 2 (с первой), 1 (со второй), 0 (не решил); seconds: время до верного ответа.
  function nextDifficulty(d, stars, seconds) {
    d = clamp01(d);
    if (stars === 2) return clamp01(d + (seconds != null && seconds < 6 ? 0.10 : 0.07));
    if (stars === 1) return clamp01(d - 0.02);
    return clamp01(d - 0.10);
  }

  return { SKILLS, TOPICS, SHAPES, COLORS, OBJECTS, HEROES, SHOP, generate, buildMission, nextDifficulty, setRandom, plural, timeName };
});
