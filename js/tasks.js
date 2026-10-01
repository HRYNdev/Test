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
    double:    { name: 'Удвоение',        weight: 0.9, topic: 'arith' },
    half:      { name: 'Поровну',         weight: 0.9, topic: 'arith' },
    diff:      { name: 'На сколько больше', weight: 1, topic: 'arith' },
    chain:     { name: 'Три числа',       weight: 0.8, topic: 'arith' },
    tens:      { name: 'Десяток',         weight: 1,   topic: 'arith' },
    between:   { name: 'Загадка числа',   weight: 0.9, topic: 'order' },
    ordinal:   { name: 'Который по счёту', weight: 0.9, topic: 'order' },
    listen:    { name: 'Послушай число',  weight: 0.9, topic: 'order' },
    size:      { name: 'Длиннее-короче',  weight: 0.8, topic: 'logic' },
    corners:   { name: 'Углы фигур',      weight: 0.8, topic: 'logic' },
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
  const CORNER_SHAPES = [
    { id: 'triangle', name: 'треугольник', corners: 3 }, { id: 'square', name: 'квадрат', corners: 4 },
    { id: 'diamond', name: 'ромб', corners: 4 }, { id: 'pentagon', name: 'пятиугольник', corners: 5 },
    { id: 'hexagon', name: 'шестиугольник', corners: 6 }, { id: 'circle', name: 'круг', corners: 0 },
  ];
  const NUM_WORDS = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять',
    'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать', 'двадцать'];
  const ORDINALS_F = ['', 'первую', 'вторую', 'третью', 'четвёртую', 'пятую', 'шестую', 'седьмую', 'восьмую'];
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


  // Удвоение: a + a
  function genDouble(d) {
    const a = rint(1, lerp(4, 10, d));
    const obj = pick(OBJECTS);
    return {
      skill: 'double', kind: 'choice', scene: 'mirror',
      prompt: `${a} + ${a} = ?`,
      say: `Зеркальная планета всё удваивает! Было ${a} ${plural(a, obj)}, и в зеркале ещё столько же. Сколько всего? ${a} плюс ${a}.`,
      display: { type: 'expr', text: `${a} + ${a} = ?`, groups: [{ emoji: obj.e, n: a }, { emoji: obj.e, n: a }], showObjects: d < 0.45 },
      options: numberOptions(a * 2, optCount(d), 0, 22),
      answer: a * 2,
      hint: { type: 'show-objects', say: `Посчитай все ${obj.many}: слева ${a} и справа ${a}.` },
      explain: `${a} + ${a} = ${a * 2}`,
    };
  }

  // Поровну на две ракеты: n / 2
  function genHalf(d) {
    const n = 2 * rint(1, lerp(3, 10, d));
    const obj = pick(OBJECTS.filter(o => o.e !== '🚀'));
    return {
      skill: 'half', kind: 'choice', scene: 'share',
      prompt: `${n} ${plural(n, obj)} на две ракеты. По сколько?`,
      say: `${n} ${plural(n, obj)} надо разделить поровну на две ракеты. По сколько в каждой?`,
      display: { type: 'share', n, emoji: obj.e },
      options: numberOptions(n / 2, optCount(d), 1, n),
      answer: n / 2,
      hint: { type: 'share-pairs', say: 'Раздавай по одному: одну в первую ракету, одну во вторую. И так до конца.' },
      explain: `${n} = ${n / 2} + ${n / 2}`,
    };
  }

  // На сколько больше
  function genDiff(d) {
    const max = lerp(5, 10, d);
    const b = rint(1, max - 1), a = rint(b + 1, Math.min(max, b + lerp(2, 5, d)));
    const obj = pick(OBJECTS);
    const h1 = pick(HEROES), h2 = pick(HEROES.filter(h => h !== h1));
    return {
      skill: 'diff', kind: 'choice', scene: 'scales',
      prompt: `На сколько больше?`,
      say: `У ${h1.g} ${a} ${plural(a, obj)}, у ${h2.g} ${b}. На сколько у ${h1.g} больше?`,
      display: { type: 'diff', groups: [{ emoji: obj.e, n: a, label: h1.n }, { emoji: obj.e, n: b, label: h2.n }] },
      options: numberOptions(a - b, optCount(d), 1, Math.max(3, a - b + 3)),
      answer: a - b,
      hint: { type: 'diff-highlight', say: `Поставь их парами. Те, кому пары не хватило, и есть ответ.` },
      explain: `${a} − ${b} = ${a - b}`,
    };
  }

  // Три слагаемых
  function genChain(d) {
    const max = lerp(6, 20, d);
    const a = rint(1, Math.max(1, Math.floor(max / 3))), b = rint(1, Math.max(1, Math.floor(max / 3))), c = rint(1, Math.max(1, max - a - b));
    const obj = pick(OBJECTS);
    const answer = a + b + c;
    return {
      skill: 'chain', kind: 'choice', scene: 'docking',
      prompt: `${a} + ${b} + ${c} = ?`,
      say: `Три модуля стыкуются! ${a} плюс ${b} плюс ${c}. Сколько всего?`,
      display: { type: 'expr', text: `${a} + ${b} + ${c} = ?`, groups: [{ emoji: obj.e, n: a }, { emoji: obj.e, n: b }, { emoji: obj.e, n: c }], showObjects: d < 0.4 },
      options: numberOptions(answer, optCount(d), 1, max + 2),
      answer,
      hint: { type: 'show-objects', say: `Сначала ${a} плюс ${b} — это ${a + b}. Теперь прибавь ${c}.` },
      explain: `${a} + ${b} + ${c} = ${answer}`,
    };
  }

  // Десяток и единицы
  function genTens(d) {
    const x = rint(1, 9);
    const mode = d < 0.5 ? 'sum' : 'split';
    const n = 10 + x;
    return mode === 'sum' ? {
      skill: 'tens', kind: 'choice', scene: 'tens',
      prompt: `10 + ${x} = ?`,
      say: `Целый десяток — это один большой контейнер, в нём ровно десять. И ещё ${x} ${plural(x, { one: 'штука', few: 'штуки', many: 'штук' })} рядом. Десять плюс ${x}, сколько получится?`,
      display: { type: 'tens', x, mode },
      options: numberOptions(n, optCount(d), 10, 20),
      answer: n,
      hint: { type: 'tens-count', say: `Десять уже есть. Считай дальше: одиннадцать, двенадцать…` },
      explain: `10 + ${x} = ${n}`,
    } : {
      skill: 'tens', kind: 'choice', scene: 'tens',
      prompt: `${n} = 10 + ?`,
      say: `Число ${n}. Это десяток и ещё сколько?`,
      display: { type: 'tens', x, mode },
      options: numberOptions(x, optCount(d), 1, 9),
      answer: x,
      hint: { type: 'tens-count', say: `Убери десяток. Сколько осталось рядом с контейнером?` },
      explain: `${n} = 10 + ${x}`,
    };
  }

  // Загаданное число между
  function genBetween(d) {
    const max = lerp(8, 20, d);
    const gap = d < 0.4 ? 1 : rint(1, 2);
    const lo = rint(0, max - gap - 1), hi = lo + gap + 1;
    const answer = gap === 1 ? lo + 1 : rint(lo + 1, hi - 1);
    const set = new Set([answer]);
    const pool = shuffle([lo, hi, lo - 1, hi + 1, lo - 2, hi + 2].filter(v => v >= 0 && v <= 22 && v !== answer));
    for (const v of pool) { if (set.size >= optCount(d)) break; set.add(v); }
    return {
      skill: 'between', kind: 'choice', scene: 'secret',
      prompt: `Больше ${lo}, но меньше ${hi}`,
      say: `Я загадал число. Оно больше, чем ${lo}, но меньше, чем ${hi}. Какое это число?`,
      display: { type: 'between', lo, hi, max: Math.max(hi + 1, 10) },
      options: shuffle([...set]).map(v => ({ label: String(v), value: v })),
      answer,
      hint: { type: 'between-line', say: `Смотри на прямую: число стоит между ${lo} и ${hi}.` },
      explain: `${lo} < ${answer} < ${hi}`,
    };
  }

  // Который по счёту: нажми третью ракету
  function genOrdinal(d) {
    const k = lerp(3, 7, d);
    const idx = rint(1, k);
    const fromRight = d > 0.6 && rng() < 0.4;
    const answer = fromRight ? k - idx : idx - 1;
    return {
      skill: 'ordinal', kind: 'choice', scene: 'hangar',
      prompt: `Нажми ${ORDINALS_F[idx]} ракету ${fromRight ? 'справа' : 'слева'}`,
      say: `В ангаре стоят ракеты. Нажми ${ORDINALS_F[idx]} ракету ${fromRight ? 'справа' : 'слева'}.`,
      display: { type: 'none' },
      options: Array.from({ length: k }, (_, i) => ({ label: '🚀', value: i, emoji: true, row: true })),
      answer,
      hint: { type: 'ordinal-numbers', say: `Считай ${fromRight ? 'справа' : 'слева'}: первая, вторая, третья…` },
      explain: `${ORDINALS_F[idx].replace('ую', 'ая').replace('ью', 'ья')} ${fromRight ? 'справа' : 'слева'}`,
    };
  }

  // Послушай число
  function genListen(d) {
    const max = lerp(9, 20, d);
    const n = rint(1, max);
    return {
      skill: 'listen', kind: 'choice', scene: 'radio',
      prompt: `🔊 Какое число я сказал?`,
      say: `Слушай внимательно! Число… ${NUM_WORDS[n]}. Найди число ${NUM_WORDS[n]}.`,
      display: { type: 'listen', n, word: NUM_WORDS[n] },
      options: numberOptions(n, 4, Math.max(0, n - 4), Math.min(20, n + 4)),
      answer: n,
      hint: { type: 'listen-word', say: `Повторяю: ${NUM_WORDS[n]}. Прочитай подсказку.` },
      explain: `${n} — ${NUM_WORDS[n]}`,
    };
  }

  // Самая длинная / короткая ракета
  function genSize(d) {
    const k = d < 0.5 ? 3 : 4;
    const lens = shuffle([40, 60, 80, 100].slice(0, k).map(v => v - rint(0, 8)));
    const longest = rng() < 0.6 || d < 0.3;
    const target = longest ? Math.max(...lens) : Math.min(...lens);
    return {
      skill: 'size', kind: 'choice', scene: 'hangar',
      prompt: longest ? 'Нажми самую длинную ракету' : 'Нажми самую короткую ракету',
      say: longest ? 'Какая ракета самая длинная? Нажми на неё.' : 'Какая ракета самая короткая? Нажми на неё.',
      display: { type: 'none' },
      options: lens.map((v, i) => ({ label: String(v), value: i, bar: v })),
      answer: lens.indexOf(target),
      hint: { type: 'size-numbers', say: longest ? 'Сравни хвосты ракет: чей дальше всех?' : 'Ищи ракету, которая заканчивается раньше всех.' },
      explain: longest ? 'самая длинная' : 'самая короткая',
    };
  }

  // Сколько углов у фигуры
  function genCorners(d) {
    const pool = d < 0.4 ? CORNER_SHAPES.filter(s => s.corners <= 4) : CORNER_SHAPES;
    const sh = pick(pool);
    const opts = new Set([sh.corners]);
    for (const c of shuffle([0, 3, 4, 5, 6])) { if (opts.size >= 3) break; opts.add(c); }
    return {
      skill: 'corners', kind: 'choice', scene: 'repair',
      prompt: 'Сколько углов у детали?',
      say: `Это ${sh.name}. Сколько у него углов? ${sh.corners === 0 ? 'Подумай, есть ли углы у круга.' : 'Считай уголки по кругу.'}`,
      display: { type: 'corners', shape: sh.id, color: pick(COLORS).id },
      options: shuffle([...opts]).map(v => ({ label: String(v), value: v })),
      answer: sh.corners,
      hint: { type: 'corners-dots', say: sh.corners === 0 ? 'У круга нет углов, он гладкий.' : 'Я отметил уголки точками. Посчитай точки.' },
      explain: sh.corners === 0 ? 'у круга нет углов' : `${sh.corners}`,
    };
  }

  const GEN = { count: genCount, add: genAdd, sub: genSub, fuel: genFuel, story: genStory, compare: genCompare,
    missing: genMissing, order: genOrder, neighbors: genNeighbors, numline: genNumline, shapes: genShapes,
    pattern: genPattern, clock: genClock, money: genMoney, double: genDouble, half: genHalf, diff: genDiff,
    chain: genChain, tens: genTens, between: genBetween, ordinal: genOrdinal, listen: genListen, size: genSize, corners: genCorners };

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

  return { SKILLS, TOPICS, SHAPES, CORNER_SHAPES, COLORS, OBJECTS, HEROES, SHOP, NUM_WORDS, generate, buildMission, nextDifficulty, setRandom, plural, timeName };
});
