/* Генераторы заданий. Чистые функции, без DOM — тестируются в node.
   generate(skill, d) — d: сложность 0..1 (непрерывная), задаётся учебной программой (js/curriculum.js).

   Каждое задание:
   {
     skill, kind, scene,
     prompt      — короткий текст в пузыре Зума (ребёнок читает простые слова),
     say         — что Зум говорит. Правила: сначала что делать, одно предложение = одна мысль,
                   конкретные предметы, без украшений перед инструкцией,
     sayShort    — одна фраза для автоповтора, если ребёнок долго не отвечает,
     display     — что рисуем (см. renderStage в app.js),
     options     — варианты, answer — правильный,
     hint        — визуальная подсказка после ошибки { type, say } (see showHint),
     guide       — режим «вместе» после первой ошибки: варианты прячутся, ребёнок делает руками
                   { mode: 'count' | 'walk' | 'share' | 'sum' | 'replay' | 'show', say, doneSay, targets, ... },
     explain / explainSay — разбор, если не получилось и со второй попытки.
   }
   kind: 'choice' (нажать один вариант) | 'order' (нажать варианты по порядку) | 'sequence' (повторить показанную
   последовательность нажатий, варианты могут повторяться).
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tasks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SKILLS = {
    count:     { name: 'Счёт предметов',   topic: 'arith' },
    flash:     { name: 'Сколько? (быстро)', topic: 'arith' },
    add:       { name: 'Сложение',         topic: 'arith' },
    sub:       { name: 'Вычитание',        topic: 'arith' },
    fuel:      { name: 'Долей до 10',      topic: 'arith' },
    story:     { name: 'Задачи-истории',   topic: 'arith' },
    double:    { name: 'Удвоение',         topic: 'arith' },
    half:      { name: 'Поровну',          topic: 'arith' },
    diff:      { name: 'На сколько больше', topic: 'arith' },
    chain:     { name: 'Три числа',        topic: 'arith' },
    tens:      { name: 'Десяток',          topic: 'arith' },
    compare:   { name: 'Больше-меньше',    topic: 'order' },
    missing:   { name: 'Пропущенное число', topic: 'order' },
    order:     { name: 'По порядку',       topic: 'order' },
    neighbors: { name: 'Соседи числа',     topic: 'order' },
    numline:   { name: 'Числовая прямая',  topic: 'order' },
    between:   { name: 'Число между',      topic: 'order' },
    ordinal:   { name: 'Который по счёту', topic: 'order' },
    listen:    { name: 'Послушай число',   topic: 'order' },
    shapes:    { name: 'Фигуры',           topic: 'logic' },
    same:      { name: 'Найди такую же',   topic: 'logic' },
    pattern:   { name: 'Узор',             topic: 'logic' },
    size:      { name: 'Длиннее-короче',   topic: 'logic' },
    corners:   { name: 'Углы фигур',       topic: 'logic' },
    memory:    { name: 'Что пропало',      topic: 'memory' },
    simon:     { name: 'Повтори огни',     topic: 'memory' },
    clock:     { name: 'Часы',             topic: 'life' },
    money:     { name: 'Монетки',          topic: 'life' },
  };
  const TOPICS = {
    arith: 'Счёт и примеры',
    order: 'Сравнение и порядок',
    logic: 'Фигуры и логика',
    memory: 'Память и внимание',
    life:  'Часы и деньги',
  };

  // Уроки: Зум объясняет, когда навык встречается впервые. Коротко, одно правило.
  const LESSONS = {
    count:     'Чтобы посчитать, трогай каждый предмет по одному разу и говори: раз, два, три. Последнее число — это сколько всего.',
    flash:     'Сейчас точки покажутся на секунду и спрячутся. Постарайся понять, сколько их, не считая по одной. Как на кубике!',
    add:       'Плюс — это когда добавляем. Было немного, стало больше. Посчитай все предметы вместе.',
    sub:       'Минус — это когда забираем. Зачёркнутые улетели. Считай только те, что остались.',
    fuel:      'Бак — это десять клеточек. Сколько клеточек пустых, столько и надо долить.',
    story:     'Это история с числами. Слушай внимательно: кто сколько получил, кто сколько отдал. Потом считай.',
    double:    'Зеркало повторяет всё. Было пять — и в зеркале ещё пять. Удвоить — значит взять два раза.',
    half:      'Поровну — это когда у всех одинаково. Раздавай по одному: сначала в одну ракету, потом в другую.',
    diff:      'На сколько больше? Поставь предметы парами. У кого пары нет — те и лишние.',
    chain:     'Три числа складываем по порядку. Сначала первые два, потом добавь третье.',
    tens:      'Десять — это целый контейнер. Одиннадцать — это десять и один. Двенадцать — десять и два.',
    compare:   'Где больше? Там, где предметов много. Знак больше — как клювик: он открыт к большому числу.',
    missing:   'Числа идут по порядку: один, два, три. Одно число спряталось. Считай по порядку и найди его.',
    order:     'Расставим числа по порядку: сначала самое маленькое, потом побольше, потом ещё больше.',
    neighbors: 'У каждого числа есть соседи. Перед числом пять стоит четыре. После пяти стоит шесть. Смотри на дорожку с числами.',
    numline:   'Это дорожка с числами. Каждая чёрточка — следующее число. Считай чёрточки от нуля до ракеты.',
    between:   'Я загадываю число. Оно стоит на дорожке между двумя числами. Найди его на дорожке.',
    ordinal:   'Будем считать ракеты по порядку: первая, вторая, третья. Считай с той стороны, которую я назову.',
    listen:    'Я скажу число словом. Ты найди его среди цифр. Если забыл — нажми на рацию, я повторю.',
    shapes:    'Фигуры: круг — гладкий, без углов. У треугольника три угла. У квадрата четыре одинаковых стороны.',
    same:      'Смотри на деталь-образец: какая у неё форма и какой цвет. Найди точно такую же.',
    pattern:   'Узор повторяется: ракета, звезда, ракета, звезда. Скажи узор вслух — и поймёшь, что дальше.',
    size:      'Все ракеты стартуют слева. Чей нос улетел дальше — та длиннее.',
    corners:   'Угол — это где две стороны встречаются острым уголком. Трогай каждый уголок и считай.',
    memory:    'Игра на память. Запомни предметы. Потом один пропадёт, а ты скажешь, какой.',
    simon:     'Огни мигают по очереди. Запомни порядок и повтори его: нажимай кнопки точно так же.',
    clock:     'Короткая стрелка показывает часы. Когда длинная стрелка смотрит на двенадцать, значит ровно. Короткая на три — три часа.',
    money:     'На монетке написано число. Это сколько она стоит. Чтобы узнать, сколько всего денег, сложи числа на монетках.',
  };

  const OBJECTS = [
    { e: '⭐', g: 'f', one: 'звёздочка', few: 'звёздочки', many: 'звёздочек', each: 'каждую звёздочку', q: 'Сколько звёздочек?' },
    { e: '🪐', g: 'f', one: 'планета',   few: 'планеты',   many: 'планет',    each: 'каждую планету',   q: 'Сколько планет?' },
    { e: '🚀', g: 'f', one: 'ракета',    few: 'ракеты',    many: 'ракет',     each: 'каждую ракету',    q: 'Сколько ракет?' },
    { e: '👽', g: 'm', one: 'инопланетянин', few: 'инопланетянина', many: 'инопланетян', each: 'каждого инопланетянина', q: 'Сколько инопланетян?' },
    { e: '🛸', g: 'f', one: 'тарелка',   few: 'тарелки',   many: 'тарелок',   each: 'каждую тарелку',   q: 'Сколько тарелок?' },
    { e: '☄️', g: 'f', one: 'комета',    few: 'кометы',    many: 'комет',     each: 'каждую комету',    q: 'Сколько комет?' },
    { e: '🌙', g: 'f', one: 'луна',      few: 'луны',      many: 'лун',       each: 'каждую луну',      q: 'Сколько лун?' },
    { e: '🤖', g: 'm', one: 'робот',     few: 'робота',    many: 'роботов',   each: 'каждого робота',   q: 'Сколько роботов?' },
    { e: '💎', g: 'm', one: 'кристалл',  few: 'кристалла', many: 'кристаллов', each: 'каждый кристалл', q: 'Сколько кристаллов?' },
    { e: '🧑‍🚀', g: 'm', one: 'космонавт', few: 'космонавта', many: 'космонавтов', each: 'каждого космонавта', q: 'Сколько космонавтов?' },
  ];
  const EMOJI_NAME = {};
  for (const o of OBJECTS) EMOJI_NAME[o.e] = o.one;
  const HEROES = [{ n: 'Зум', g: 'Зума', v: 'подарил' }, { n: 'Бип', g: 'Бипа', v: 'подарил' }, { n: 'Ника', g: 'Ники', v: 'подарила' }, { n: 'Тим', g: 'Тима', v: 'подарил' }, { n: 'Кроха', g: 'Крохи', v: 'подарила' }];

  const SHAPES = [
    { id: 'circle',   name: 'круг',        acc: 'круг',        pl: 'круги',        gen: 'кругов',        part: 'круглый иллюминатор' },
    { id: 'square',   name: 'квадрат',     acc: 'квадрат',     pl: 'квадраты',     gen: 'квадратов',     part: 'квадратный люк' },
    { id: 'triangle', name: 'треугольник', acc: 'треугольник', pl: 'треугольники', gen: 'треугольников', part: 'треугольное крыло' },
    { id: 'star',     name: 'звезда',      acc: 'звезду',      pl: 'звёзды',       gen: 'звёзд',         part: 'звёздный фонарик' },
    { id: 'heart',    name: 'сердечко',    acc: 'сердечко',    pl: 'сердечки',     gen: 'сердечек',      part: 'сердечко-датчик' },
    { id: 'diamond',  name: 'ромб',        acc: 'ромб',        pl: 'ромбы',        gen: 'ромбов',        part: 'ромбик-антенна' },
  ];
  const CORNER_SHAPES = [
    { id: 'triangle', name: 'треугольник', corners: 3 }, { id: 'square', name: 'квадрат', corners: 4 },
    { id: 'diamond', name: 'ромб', corners: 4 }, { id: 'pentagon', name: 'пятиугольник', corners: 5 },
    { id: 'hexagon', name: 'шестиугольник', corners: 6 }, { id: 'circle', name: 'круг', corners: 0 },
  ];
  const NUM_WORDS = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять',
    'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать', 'двадцать'];
  // падежи числительных для речи: после пяти (род.), перед пятью / между пятью и семью (твор.)
  const NUM_GEN = ['нуля', 'одного', 'двух', 'трёх', 'четырёх', 'пяти', 'шести', 'семи', 'восьми', 'девяти', 'десяти',
    'одиннадцати', 'двенадцати', 'тринадцати', 'четырнадцати', 'пятнадцати', 'шестнадцати', 'семнадцати', 'восемнадцати', 'девятнадцати', 'двадцати'];
  const NUM_INS = ['нулём', 'одним', 'двумя', 'тремя', 'четырьмя', 'пятью', 'шестью', 'семью', 'восемью', 'девятью', 'десятью',
    'одиннадцатью', 'двенадцатью', 'тринадцатью', 'четырнадцатью', 'пятнадцатью', 'шестнадцатью', 'семнадцатью', 'восемнадцатью', 'девятнадцатью', 'двадцатью'];
  const ORDINALS_F = ['', 'первую', 'вторую', 'третью', 'четвёртую', 'пятую', 'шестую', 'седьмую', 'восьмую'];
  const ORDINALS_F_NOM = ['', 'первая', 'вторая', 'третья', 'четвёртая', 'пятая', 'шестая', 'седьмая', 'восьмая'];
  const COLORS = [
    { id: '#ff5c8a', name: 'розовый',    nameF: 'розовая' },
    { id: '#ffd23f', name: 'жёлтый',     nameF: 'жёлтая' },
    { id: '#3ddc97', name: 'зелёный',    nameF: 'зелёная' },
    { id: '#4cc9f0', name: 'голубой',    nameF: 'голубая' },
    { id: '#b388ff', name: 'фиолетовый', nameF: 'фиолетовая' },
    { id: '#ff8c42', name: 'оранжевый',  nameF: 'оранжевая' },
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
  const W = n => NUM_WORDS[n] != null ? NUM_WORDS[n] : String(n);
  const WG = n => NUM_GEN[n] != null ? NUM_GEN[n] : String(n);
  const WI = n => NUM_INS[n] != null ? NUM_INS[n] : String(n);
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
    for (let c = hi + 1; set.size < count && c <= hi + 10; c++) set.add(c);
    return shuffle([...set]).map(v => ({ label: String(v), value: v }));
  }
  const optCount = d => (d < 0.45 ? 3 : 4);
  const countGuide = (targets, say, n, extra) => Object.assign({
    mode: 'count', targets, say, doneSay: `Всего ${n}. Нажми ${n}.`,
  }, extra || {});

  // ---------- генераторы (d = 0..1) ----------
  function genCount(d) {
    const [min, max] = d < 0.25 ? [1, 5] : d < 0.5 ? [3, 10] : d < 0.75 ? [5, 15] : [8, 20];
    const n = rint(min, max);
    const obj = pick(OBJECTS);
    return {
      skill: 'count', kind: 'choice', scene: 'porthole',
      prompt: obj.q, say: `${obj.q} Посчитай и нажми число.`, sayShort: obj.q,
      display: { type: 'objects', groups: [{ emoji: obj.e, n }] },
      options: numberOptions(n, optCount(d), Math.max(1, min - 2), max + 1),
      answer: n,
      hint: { type: 'none', say: '' },
      guide: countGuide('.obj', `Давай вместе. Нажимай на ${obj.each} по одному разу и считай со мной.`, n),
      explain: `${n} ${plural(n, obj)}`,
    };
  }

  // Субитизация: показать на мгновение и спрятать
  function genFlash(d) {
    let pattern, n, showMs;
    if (d < 0.3) { pattern = 'dice'; n = rint(1, 5); showMs = 1600; }
    else if (d < 0.6) { pattern = 'ten'; n = rint(2, 10); showMs = 1800; }
    else { pattern = 'dice2'; n = rint(2, 12); showMs = 1800; }
    const dice2 = pattern === 'dice2' ? (() => { const a = rint(Math.max(1, n - 6), Math.min(6, n - 1)); return [a, n - a]; })() : null;
    return {
      skill: 'flash', kind: 'choice', scene: 'flash',
      prompt: 'Сколько точек ты увидел?',
      say: pattern === 'dice2' ? 'Смотри внимательно! Два кубика. Сколько точек на двух кубиках вместе?' : 'Смотри внимательно! Точки сейчас спрячутся. Сколько точек?',
      sayShort: 'Сколько было точек?',
      display: { type: 'flash', pattern, n, dice2, showMs },
      options: numberOptions(n, optCount(d), Math.max(1, n - 3), pattern === 'dice' ? 6 : n + 3),
      answer: n,
      hint: { type: 'flash-reveal', say: '' },
      guide: countGuide('.flash .dot', 'Ничего, я покажу снова. Нажимай на каждую точку и считай.', n, { reveal: true }),
      explain: `${n}`,
    };
  }

  function genAdd(d) {
    let a, b, maxSum;
    if (d < 0.25) { maxSum = 5; a = rint(1, 4); b = rint(1, maxSum - a); }
    else if (d < 0.5) { maxSum = 10; a = rint(1, 8); b = rint(1, Math.min(9, maxSum - a)); }
    else if (d < 0.75) { maxSum = 10; a = rint(2, 8); b = rint(1, Math.min(8, maxSum - a)); }
    else { maxSum = 20; a = rint(5, 10); b = rint(Math.max(1, 11 - a), 9); }
    const obj = pick(OBJECTS);
    const answer = a + b;
    const show = d < 0.5;
    const big = Math.max(a, b), small = Math.min(a, b);
    return {
      skill: 'add', kind: 'choice', scene: 'docking',
      prompt: `${a} + ${b} = ?`,
      say: `${a} плюс ${b}. Здесь ${a} ${plural(a, obj)} и ещё ${b}. Сколько всего ${obj.many}?`,
      sayShort: `${a} плюс ${b}. Сколько всего?`,
      display: { type: 'expr', text: `${a} + ${b} = ?`, groups: [{ emoji: obj.e, n: a }, { emoji: obj.e, n: b }], showObjects: show },
      options: numberOptions(answer, optCount(d), 0, maxSum + 2),
      answer,
      hint: { type: 'show-objects', say: '' },
      guide: countGuide('.expr-objs .obj', show
        ? `Давай вместе. Нажимай на ${obj.each} и считай: и слева, и справа.`
        : `Смотри, я показал ${obj.many}. Нажимай на ${obj.each} и считай все вместе.`, answer, { reveal: true }),
      strategySay: big >= 4 && small <= 3 ? `Подсказка: начни с ${big} и досчитай ${small}: ${big}, ${W(big + 1)}${small > 1 ? ', ' + W(big + 2) : ''}…` : '',
      explain: `${a} + ${b} = ${answer}`, explainSay: `${a} плюс ${b} равно ${answer}`,
    };
  }

  function genSub(d) {
    let a, b;
    if (d < 0.25) { a = rint(2, 5); b = rint(1, a - 1); }
    else if (d < 0.5) { a = rint(3, 10); b = rint(1, a - 1); }
    else if (d < 0.75) { a = rint(4, 10); b = rint(1, a - 1); }
    else { a = rint(11, 20); b = rint(2, Math.min(10, a - 1)); }
    const obj = pick(OBJECTS);
    const answer = a - b;
    const show = d < 0.5;
    return {
      skill: 'sub', kind: 'choice', scene: 'flyaway',
      prompt: `${a} − ${b} = ?`,
      say: `${a} минус ${b}. Было ${a} ${plural(a, obj)}. ${b === 1 ? (obj.g === 'f' ? 'Одна улетела' : 'Один улетел') : `${b} улетели`}. Сколько осталось?`,
      sayShort: `${a} минус ${b}. Сколько осталось?`,
      explainSay: `${a} минус ${b} равно ${answer}`,
      display: { type: 'expr', text: `${a} − ${b} = ?`, groups: [{ emoji: obj.e, n: a, crossed: b }], showObjects: show },
      options: numberOptions(answer, optCount(d), 0, a),
      answer,
      hint: { type: 'show-objects', say: '' },
      guide: countGuide('.expr-objs .obj:not(.crossed)', `Зачёркнутые улетели, их не считаем. Нажимай только на те, что остались.`, answer,
        { reveal: true, doneSay: `Осталось ${answer}. Нажми ${answer}.`, wrongTargets: '.expr-objs .obj.crossed', wrongSay: 'Эта улетела. Считай только оставшиеся.' }),
      explain: `${a} − ${b} = ${answer}`,
    };
  }

  // Сколько не хватает: a + ? = target (шкала топлива)
  function genFuel(d) {
    const target = d < 0.4 ? 5 : d < 0.8 ? 10 : (rng() < 0.6 ? 10 : 20);
    const have = rint(1, target - 1);
    const answer = target - have;
    return {
      skill: 'fuel', kind: 'choice', scene: 'fuel',
      prompt: `${have} + ? = ${target}`,
      say: `Заправка. В баке ${target} ${plural(target, { one: 'клеточка', few: 'клеточки', many: 'клеточек' })}. Залито ${have}. Сколько клеточек пустых?`,
      sayShort: `Сколько пустых клеточек?`,
      display: { type: 'fuel', target, have },
      options: numberOptions(answer, optCount(d), 1, target),
      answer,
      hint: { type: 'none', say: '' },
      guide: countGuide('.tank i.empty', 'Давай вместе. Нажимай на каждую пустую клеточку и считай.', answer,
        { doneSay: `Пустых ${answer}. Значит долить ${answer}. Нажми ${answer}.` }),
      explain: `${have} + ${answer} = ${target}`, explainSay: `${have} плюс ${answer} равно ${target}`,
    };
  }

  // Задачи-истории с персонажами
  function genStory(d) {
    const max = d < 0.4 ? 8 : d < 0.7 ? 10 : 15;
    const show = d < 0.7;
    const obj = pick(OBJECTS.filter(o => o.e !== '🧑‍🚀'));
    const h1 = pick(HEROES), h2 = pick(HEROES.filter(h => h !== h1));
    const H1 = h1.g, H2 = h2.g;
    const kind = d < 0.7 ? pick(['add', 'sub']) : pick(['add', 'sub', 'more', 'less']);
    let a, b, answer, text, groups, q, ex, guide;
    if (kind === 'add') {
      a = rint(1, Math.max(1, max - 2)); b = rint(1, Math.max(1, max - a));
      answer = a + b;
      text = `У ${H1} ${a} ${plural(a, obj)}. У ${H2} ${b}. Сколько ${obj.many} у них вместе?`; q = 'Сколько вместе?'; ex = `${a} + ${b} = ${answer}`;
      groups = [{ emoji: obj.e, n: a, label: h1.n }, { emoji: obj.e, n: b, label: h2.n }];
      guide = countGuide('.expr-objs .obj', `Считаем всё вместе: и у ${H1}, и у ${H2}. Нажимай на ${obj.each}.`, answer, { reveal: true });
    } else if (kind === 'sub') {
      a = rint(2, max); b = rint(1, a - 1);
      answer = a - b;
      text = `У ${H1} было ${a} ${plural(a, obj)}. ${h1.n} ${h1.v} другу ${b}. Сколько осталось?`; q = 'Сколько осталось?'; ex = `${a} − ${b} = ${answer}`;
      groups = [{ emoji: obj.e, n: a, crossed: b, label: h1.n }];
      guide = countGuide('.expr-objs .obj:not(.crossed)', `Зачёркнутые ${h1.n} ${h1.v}. Нажимай на те, что остались.`, answer, { reveal: true, doneSay: `Осталось ${answer}. Нажми ${answer}.` });
    } else if (kind === 'more') {
      a = rint(1, Math.max(1, max - 3)); b = rint(1, Math.min(5, max - a));
      answer = a + b;
      text = `У ${H1} ${a} ${plural(a, obj)}. У ${H2} столько же и ещё ${b}. Сколько у ${H2}?`; q = `Сколько у ${H2}?`; ex = `${a} + ${b} = ${answer}`;
      groups = [{ emoji: obj.e, n: a, label: h1.n }, { emoji: obj.e, n: a, extra: b, label: h2.n }];
      guide = countGuide('.glabel:last-child .obj', `Считаем только у ${H2}. Нажимай на ${obj.each} в правой кучке.`, answer, { reveal: true });
    } else {
      b = rint(1, 5); a = rint(b + 1, Math.max(b + 1, max));
      answer = a - b;
      text = `У ${H1} ${a} ${plural(a, obj)}. У ${H2} на ${b} меньше. Сколько у ${H2}?`; q = `Сколько у ${H2}?`; ex = `${a} − ${b} = ${answer}`;
      groups = [{ emoji: obj.e, n: a, label: h1.n }, { emoji: obj.e, n: a, crossed: b, label: h2.n }];
      guide = countGuide('.glabel:last-child .obj:not(.crossed)', `У ${H2} столько же, но ${b} зачеркнули. Нажимай на незачёркнутые в правой кучке.`, answer, { reveal: true });
    }
    return {
      skill: 'story', kind: 'choice', scene: 'story',
      prompt: q, say: text, sayShort: q,
      display: { type: 'story', groups, showObjects: show },
      options: numberOptions(answer, optCount(d), 0, Math.min(20, max + 5)),
      answer,
      hint: { type: 'show-objects', say: '' },
      guide,
      explain: ex, explainSay: ex.replace('+', 'плюс').replace('−', 'минус').replace('=', 'равно'),
    };
  }

  function genCompare(d) {
    if (d < 0.35) {
      const obj = pick(OBJECTS);
      let a = rint(1, 6), b = rint(1, 6);
      while (a === b) b = rint(1, 6);
      const more = d < 0.15 || rng() < 0.6;
      const answer = more ? (a > b ? 0 : 1) : (a < b ? 0 : 1);
      return {
        skill: 'compare', kind: 'choice', scene: 'planets',
        prompt: more ? `Где больше ${obj.many}?` : `Где меньше ${obj.many}?`,
        say: more ? `Две планеты. На какой планете ${obj.many} больше? Нажми на неё.` : `Две планеты. На какой планете ${obj.many} меньше? Нажми на неё.`,
        sayShort: more ? `Где ${obj.many} больше?` : `Где ${obj.many} меньше?`,
        display: { type: 'pair-objects', groups: [{ emoji: obj.e, n: a }, { emoji: obj.e, n: b }] },
        options: [{ label: 'left', value: 0 }, { label: 'right', value: 1 }],
        answer,
        hint: { type: 'pair-counts', say: '' },
        guide: { mode: 'count', targets: '#options .obj', perGroup: true, say: 'Посчитаем на каждой планете. Нажимай на предметы сначала на одной планете, потом на другой.',
          doneSay: `${Math.max(a, b)} больше, чем ${Math.min(a, b)}. Где ${more ? 'больше' : 'меньше'}? Нажми на планету.` },
        explain: more ? `${Math.max(a, b)} больше, чем ${Math.min(a, b)}` : `${Math.min(a, b)} меньше, чем ${Math.max(a, b)}`,
      };
    }
    const max = d < 0.65 ? 10 : 20;
    let a = rint(1, max), b = rint(1, max);
    if (rng() < 0.2) b = a;
    const answer = a > b ? '>' : a < b ? '<' : '=';
    const words = d < 0.8;
    return {
      skill: 'compare', kind: 'choice', scene: 'scales',
      prompt: 'Какой знак?',
      say: a === b ? `${a} и ${b}. Числа одинаковые. Какой знак говорит «равно»?` : `${a} и ${b}. Какое число больше? Клювик знака открыт к большому числу. Выбери знак.`,
      sayShort: `${a} и ${b}. Какой знак?`,
      display: { type: 'compare-numbers', a, b },
      options: [{ label: '>', value: '>', word: words ? 'больше' : '' }, { label: '=', value: '=', word: words ? 'равно' : '' }, { label: '<', value: '<', word: words ? 'меньше' : '' }],
      answer,
      hint: { type: 'compare-objects', say: '' },
      guide: { mode: 'count', targets: '.cmp-dots .dots i', perGroup: true, reveal: true,
        say: 'Я нарисовал кружки. Посчитай кружки слева, потом справа. Нажимай на них.',
        doneSay: a === b ? `${a} и ${b}. Поровну. Нажми знак «равно».` : `${a} и ${b}. ${Math.max(a, b)} больше. Клювик смотрит на ${Math.max(a, b)}. Нажми знак.` },
      explain: `${a} ${answer} ${b}`, explainSay: a === b ? `${a} равно ${b}` : a > b ? `${a} больше, чем ${b}` : `${a} меньше, чем ${b}`,
    };
  }

  function genMissing(d) {
    let start, step, len = 5;
    if (d < 0.3) { start = rint(1, 6); step = 1; }
    else if (d < 0.6) { start = rint(1, 16); step = 1; }
    else if (d < 0.8) { start = rint(6, 20); step = -1; }
    else { start = rng() < 0.5 ? rint(1, 12) : rint(6, 20); step = start > 12 ? -1 : 2; }
    const seq = Array.from({ length: len }, (_, i) => start + i * step);
    const idx = rint(1, len - 2);
    const answer = seq[idx];
    const lo = Math.max(0, Math.min(...seq) - 2), hi = Math.max(...seq) + 2;
    const how = step === 2 ? 'Числа прыгают через одно.' : step === -1 ? 'Числа идут назад, от большого к маленькому.' : '';
    return {
      skill: 'missing', kind: 'choice', scene: 'radar',
      prompt: 'Какое число спряталось?',
      say: `${how} Одно число спряталось. Считай по порядку: ${seq.slice(0, idx).map(W).join(', ')}… Какое число дальше?`.trim(),
      sayShort: 'Какое число спряталось?',
      display: { type: 'sequence', seq, idx },
      options: numberOptions(answer, optCount(d), lo, hi),
      answer,
      hint: { type: 'seq-neighbors', say: '' },
      guide: { mode: 'walk', targets: '.seq .cell', upto: idx, say: `Давай вместе. Нажимай на числа по порядку, начиная с ${WG(seq[0])}.`,
        doneSay: step === 2 ? `После ${WG(seq[idx - 1])} прыгаем ещё на два. Какое число?` : step === -1 ? `После ${WG(seq[idx - 1])} на один меньше. Какое число?` : `${W(seq[idx - 1])}, а дальше? Какое число?` },
      explain: seq.join(', '),
    };
  }

  function genOrder(d) {
    const n = d < 0.3 ? 3 : d < 0.6 ? 4 : 5;
    const max = d < 0.3 ? 10 : 20;
    const set = new Set();
    while (set.size < n) set.add(rint(1, max));
    const nums = [...set].sort((a, b) => a - b);
    const desc = d > 0.6 && rng() < 0.45;
    const answer = desc ? nums.slice().reverse() : nums;
    return {
      skill: 'order', kind: 'order', scene: desc ? 'countdown' : 'docking',
      prompt: desc ? 'От большого к маленькому' : 'От маленького к большому',
      say: desc ? 'Обратный отсчёт! Нажимай числа по порядку: сначала самое большое, потом меньше, потом ещё меньше.' : 'Нажимай числа по порядку: сначала самое маленькое, потом побольше, потом ещё больше.',
      sayShort: desc ? 'Сначала самое большое число.' : 'Сначала самое маленькое число.',
      display: { type: 'none' },
      options: shuffle(nums).map(v => ({ label: String(v), value: v })),
      answer,
      hint: { type: 'order-next', say: '' },
      guide: { mode: 'show', say: desc ? 'Ищи самое большое из оставшихся. Я подсвечу его.' : 'Ищи самое маленькое из оставшихся. Я подсвечу его.' },
      explain: answer.join(' → '),
    };
  }

  function genNeighbors(d) {
    const max = d < 0.6 ? 10 : 20;
    const after = d < 0.35 ? true : rng() < 0.5;
    let n = rint(1, max - 1);
    if (!after) n = rint(2, max);
    const answer = after ? n + 1 : n - 1;
    const from = Math.max(0, Math.min(n, answer) - 2), to = Math.min(20, Math.max(n, answer) + 2);
    const cells = []; for (let v = from; v <= to; v++) cells.push(v);
    const gapIdx = cells.indexOf(answer);
    const showLine = d < 0.8;
    return {
      skill: 'neighbors', kind: 'choice', scene: 'radar',
      prompt: after ? `Какое число после ${n}?` : `Какое число перед ${n}?`,
      say: after
        ? `Считаем по порядку: ${cells.slice(0, cells.indexOf(n) + 1).map(W).join(', ')}… Какое число идёт после ${WG(n)}?`
        : `Какое число стоит перед ${WI(n)}? Считай назад: ${W(n)}, а перед ним…`,
      sayShort: after ? `Какое число после ${WG(n)}?` : `Какое число перед ${WI(n)}?`,
      display: { type: 'sequence', seq: cells, idx: gapIdx, hideLine: !showLine, focus: cells.indexOf(n) },
      options: numberOptions(answer, optCount(d), Math.max(0, n - 3), n + 3),
      answer,
      hint: { type: 'seq-neighbors', say: '' },
      guide: after
        ? { mode: 'walk', targets: '.seq .cell', upto: gapIdx, reveal: true, say: `Вот дорожка с числами. Нажимай по порядку, начиная с ${WG(cells[0])}.`, doneSay: `${W(n)}, а дальше? Какое число?` }
        : { mode: 'walk', targets: '.seq .cell', upto: cells.length - 1 - gapIdx, reverse: true, reveal: true, say: `Вот дорожка с числами. Идём назад: нажимай с ${WG(cells[cells.length - 1])} в обратную сторону.`, doneSay: `${W(n)}, а перед ним? Какое число?` },
      explain: after ? `${n}, ${answer}` : `${answer}, ${n}`, explainSay: after ? `после ${n} идёт ${answer}` : `перед ${n} идёт ${answer}`,
    };
  }

  function genNumline(d) {
    const max = d < 0.5 ? 10 : 20;
    const n = rint(1, max - 1);
    const labelEvery = d < 0.3 ? 1 : d < 0.8 ? 5 : 10;
    return {
      skill: 'numline', kind: 'choice', scene: 'numline',
      prompt: 'На каком числе ракета?',
      say: 'Ракета села на дорожку с числами. Считай чёрточки от нуля до ракеты. На каком числе ракета?',
      sayShort: 'На каком числе стоит ракета?',
      display: { type: 'numline', max, n, labelEvery },
      options: numberOptions(n, optCount(d), 0, max),
      answer: n,
      hint: { type: 'numline-labels', say: '' },
      guide: { mode: 'show', say: `Я подписал все числа. Найди чёрточку под ракетой и прочитай число под ней.` },
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
        prompt: `Найди: ${target.name}`, say: `Ремонт ракеты. Нужна деталь: ${target.part}. Найди ${target.acc} и нажми.`, sayShort: `Где ${target.name}?`,
        display: { type: 'none' },
        options: opts, answer: target.id,
        hint: { type: 'shape-names', say: '' },
        guide: { mode: 'show', say: `Я подписал фигуры. Ищи слово «${target.name}». ${target.id === 'circle' ? 'Круг гладкий, без углов.' : target.id === 'triangle' ? 'У треугольника три угла.' : target.id === 'square' ? 'У квадрата четыре угла и все стороны одинаковые.' : ''}` },
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
        prompt: 'Какая деталь лишняя?', say: 'Три детали одинаковые, а одна другая. Найди лишнюю и нажми.', sayShort: 'Какая деталь не такая, как остальные?',
        display: { type: 'none' },
        options: items.map((it, i) => ({ label: String(i), value: i, shape: it.shape, color: it.color })),
        answer: oddIdx,
        hint: { type: 'shape-names', say: '' },
        guide: { mode: 'show', say: byColor ? 'Форма у всех одинаковая. Смотри на цвет: какой цвет только у одной детали?' : 'Цвет у всех одинаковый. Смотри на форму: какая форма только у одной детали?' },
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
      prompt: `Сколько ${target.gen}?`, say: `В ящике много деталей. Посчитай только ${target.pl}. Другие не считай. Сколько ${target.gen}?`, sayShort: `Сколько ${target.gen}?`,
      display: { type: 'shapes', items: shuffle(items), target: target.id },
      options: numberOptions(n, 3, 1, total),
      answer: n,
      hint: { type: 'shape-highlight', say: '' },
      guide: countGuide('.sh[data-t="1"]', `Нажимай только на ${target.pl} и считай.`, n, { wrongTargets: '.sh[data-t="0"]', wrongSay: `Это не ${target.name}. Ищи ${target.pl}.` }),
      explain: `${n}`,
    };
  }

  // Найди такую же деталь (внимание к двум признакам)
  function genSame(d) {
    const shape = pick(SHAPES), color = pick(COLORS);
    const k = d < 0.5 ? 3 : 4;
    const distractors = [];
    distractors.push({ shape: shape.id, color: pick(COLORS.filter(c => c.id !== color.id)).id });           // тот же цвет? нет: та же форма, другой цвет
    distractors.push({ shape: pick(SHAPES.filter(s => s.id !== shape.id)).id, color: color.id });           // другая форма, тот же цвет
    if (k === 4) distractors.push({ shape: pick(SHAPES.filter(s => s.id !== shape.id)).id, color: pick(COLORS.filter(c => c.id !== color.id)).id });
    const opts = shuffle([{ shape: shape.id, color: color.id, ok: true }, ...distractors]).map((o, i) => ({ label: String(i), value: i, shape: o.shape, color: o.color, ok: !!o.ok }));
    const answer = opts.findIndex(o => o.ok);
    const colorName = shape.id === 'star' || shape.id === 'heart' ? color.nameF : color.name;
    return {
      skill: 'same', kind: 'choice', scene: 'repair',
      prompt: 'Найди такую же деталь',
      say: `Смотри на образец. Найди точно такую же деталь: такую же форму и такой же цвет.`, sayShort: 'Какая деталь точно такая же, как образец?',
      display: { type: 'sample', shape: shape.id, color: color.id },
      options: opts, answer,
      hint: { type: 'shape-names', say: '' },
      guide: { mode: 'show', say: `Образец: ${colorName} ${shape.name}. Ищи и форму, и цвет сразу.` },
      explain: `${colorName} ${shape.name}`,
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
    const names = seq.map(e => EMOJI_NAME[e]);
    return {
      skill: 'pattern', kind: 'choice', scene: 'runway',
      prompt: 'Что дальше?',
      say: `Огни мигают по узору: ${names.join(', ')}… Что мигнёт дальше?`,
      sayShort: 'Какой огонёк дальше?',
      display: { type: 'sequence-emoji', seq, unitLen: unit.length, names },
      options: opts, answer,
      hint: { type: 'pattern-groups', say: '' },
      guide: { mode: 'walk', targets: '.seq .cell:not(.gap)', upto: seq.length, say: 'Давай вместе. Нажимай на огоньки по порядку и называй их.', doneSay: `Узор повторяется. ${names.slice(-unit.length).join(', ')}, а дальше?` },
      explain: unit.map(e => EMOJI_NAME[e]).join(', ') + ' …', explainSay: 'дальше ' + EMOJI_NAME[answer],
    };
  }

  function timeName(h, m) {
    const hours = h === 1 ? 'час' : h >= 2 && h <= 4 ? 'часа' : 'часов';
    if (m === 0) return `${h} ${hours}`;
    return `${h} ${hours} ${m} минут`;
  }
  function genClock(d) {
    const h = rint(1, 12);
    const m = d < 0.5 ? 0 : d < 0.8 ? pick([0, 30]) : pick([0, 15, 30, 45]);
    const whole = d < 0.5;
    const key = (hh, mm) => whole ? `${hh}` : `${hh}:${String(mm).padStart(2, '0')}`;
    const label = (hh, mm) => whole ? timeName(hh, 0) : `${hh}:${String(mm).padStart(2, '0')}`;
    const answer = key(h, m);
    const set = new Map([[answer, label(h, m)]]);
    let guard = 0;
    while (set.size < 3 && guard++ < 50) {
      const hh = whole ? (rng() < 0.5 ? Math.max(1, Math.min(12, h + pick([-1, 1, 2, -2]))) : rint(1, 12)) : rint(1, 12);
      const mm = whole ? 0 : d < 0.8 ? pick([0, 30]) : pick([0, 15, 30, 45]);
      set.set(key(hh, mm), label(hh, mm));
    }
    return {
      skill: 'clock', kind: 'choice', scene: 'clock',
      prompt: 'Который час?',
      say: whole ? 'Смотри на короткую стрелку. На какое число она показывает? Столько и часов.' : m === 30 ? 'Длинная стрелка на шести — это половина, тридцать минут. Короткая показывает часы. Который час?' : 'Короткая стрелка показывает часы, длинная — минуты. Который час?',
      sayShort: 'Который час?',
      display: { type: 'clock', h, m },
      options: shuffle([...set.entries()]).map(([v, l]) => ({ label: l, value: v, small: !whole })), answer,
      hint: { type: 'clock-digits', say: '' },
      guide: { mode: 'show', say: whole ? `Короткая стрелка смотрит на ${W(h)}. Значит ${timeName(h, 0)}. Найди эту кнопку.` : m === 0 ? `Длинная на двенадцати — ровно. Короткая на ${W(h)}. ${timeName(h, 0)}, я написал время цифрами.` : m === 30 ? `Длинная на шести — тридцать минут. Короткая между ${W(h)} и ${W(h % 12 + 1)}, значит часов ${W(h)}. Смотри на цифры.` : 'Я написал время цифрами под часами. Найди такое же.' },
      explain: timeName(h, m), explainSay: timeName(h, m),
    };
  }

  const SHOP = [
    { e: '🍭', name: 'космо-леденец', acc: 'космо-леденец' }, { e: '🧃', name: 'звёздный сок', acc: 'звёздный сок' }, { e: '🔭', name: 'телескоп', acc: 'телескоп' },
    { e: '🧸', name: 'мишка-астронавт', acc: 'мишку-астронавта' }, { e: '🎈', name: 'шарик-планета', acc: 'шарик-планету' }, { e: '🍪', name: 'лунная печенька', acc: 'лунную печеньку' },
  ];
  function genMoney(d) {
    const target = d < 0.3 ? rint(2, 5) : d < 0.7 ? rint(4, 10) : rint(8, 20);
    const denoms = d < 0.3 ? [1, 2] : d < 0.7 ? [1, 2, 5] : [1, 2, 5, 10];
    const coins = [];
    let rest = target, guard = 0;
    while (rest > 0 && guard++ < 50) { const dd = pick(denoms.filter(x => x <= rest)); coins.push(dd); rest -= dd; }
    const answer = coins.reduce((s, c) => s + c, 0);
    const item = pick(SHOP);
    const sorted = coins.slice().sort((a, b) => b - a);
    return {
      skill: 'money', kind: 'choice', scene: 'shop',
      prompt: 'Сколько всего денег?',
      say: `Монетки: ${sorted.map(W).join(', ')}. Сложи числа на монетках. Сколько всего денег?`,
      sayShort: 'Сколько денег на всех монетках?',
      display: { type: 'coins', coins: sorted, item },
      options: numberOptions(answer, optCount(d), 1, d < 0.3 ? 6 : d < 0.7 ? 12 : 20),
      answer,
      hint: { type: 'coins-sum', say: '' },
      guide: { mode: 'sum', targets: '.coin', say: 'Давай вместе. Нажимай на монетки по одной, а я буду складывать.', doneSay: `Всего ${answer}. Нажми ${answer}.` },
      explain: coins.length > 1 ? sorted.join(' + ') + ' = ' + answer : `${answer}`, explainSay: `${answer}`,
    };
  }

  // Удвоение: a + a
  function genDouble(d) {
    const a = d < 0.5 ? rint(1, 5) : rint(3, 10);
    const obj = pick(OBJECTS);
    return {
      skill: 'double', kind: 'choice', scene: 'mirror',
      prompt: `${a} + ${a} = ?`,
      say: `Зеркальная планета. Здесь ${a} ${plural(a, obj)}, и в зеркале ещё ${a}. ${a} плюс ${a}. Сколько всего?`,
      sayShort: `${a} плюс ${a}. Сколько?`,
      display: { type: 'expr', text: `${a} + ${a} = ?`, groups: [{ emoji: obj.e, n: a }, { emoji: obj.e, n: a }], showObjects: d < 0.5 },
      options: numberOptions(a * 2, optCount(d), 0, 20),
      answer: a * 2,
      hint: { type: 'show-objects', say: '' },
      guide: countGuide('.expr-objs .obj', `Нажимай на ${obj.each}: сначала слева, потом в зеркале.`, a * 2, { reveal: true }),
      explainSay: `${a} плюс ${a} равно ${a * 2}`,
      explain: `${a} + ${a} = ${a * 2}`,
    };
  }

  // Поровну на две ракеты: n / 2
  function genHalf(d) {
    const n = 2 * (d < 0.5 ? rint(1, 5) : rint(3, 10));
    const obj = pick(OBJECTS.filter(o => o.e !== '🚀'));
    return {
      skill: 'half', kind: 'choice', scene: 'share',
      prompt: `${n} на две ракеты. По сколько?`,
      say: `${n} ${plural(n, obj)}. Разделим поровну на две ракеты. По сколько ${obj.many} в каждой ракете?`,
      sayShort: `По сколько в каждой ракете?`,
      display: { type: 'share', n, emoji: obj.e },
      options: numberOptions(n / 2, optCount(d), 1, n + 2),
      answer: n / 2,
      hint: { type: 'none', say: '' },
      guide: { mode: 'share', targets: '.share-obj', say: 'Раздаём по одному. Нажимай на предметы: один улетит в первую ракету, следующий во вторую.', doneSay: `В каждой ракете по ${n / 2}. Нажми ${n / 2}.` },
      explain: `${n} = ${n / 2} + ${n / 2}`, explainSay: `по ${n / 2} в каждой`,
    };
  }

  // На сколько больше
  function genDiff(d) {
    const max = d < 0.5 ? 7 : 10;
    const b = rint(1, max - 1), a = rint(b + 1, Math.min(max, b + (d < 0.5 ? 3 : 5)));
    const obj = pick(OBJECTS);
    const h1 = pick(HEROES), h2 = pick(HEROES.filter(h => h !== h1));
    return {
      skill: 'diff', kind: 'choice', scene: 'scales',
      prompt: `На сколько у ${h1.g} больше?`,
      say: `У ${h1.g} ${a} ${plural(a, obj)}. У ${h2.g} ${b}. Я поставил их парами. На сколько у ${h1.g} больше?`,
      sayShort: `На сколько у ${h1.g} больше?`,
      display: { type: 'diff', groups: [{ emoji: obj.e, n: a, label: h1.n }, { emoji: obj.e, n: b, label: h2.n }] },
      options: numberOptions(a - b, optCount(d), 1, Math.max(3, a - b + 3)),
      answer: a - b,
      hint: { type: 'diff-highlight', say: '' },
      guide: countGuide('.diff-extra', `Смотри: у этих нет пары, я их подсветил. Нажимай на них и считай.`, a - b, { reveal: true, doneSay: `Без пары ${a - b}. Значит на ${a - b} больше. Нажми ${a - b}.` }),
      explain: `${a} − ${b} = ${a - b}`, explainSay: `на ${a - b}`,
    };
  }

  // Три слагаемых
  function genChain(d) {
    const max = d < 0.5 ? 10 : 20;
    const a = rint(1, Math.max(1, Math.floor(max / 3))), b = rint(1, Math.max(1, Math.floor(max / 3))), c = rint(1, Math.max(1, Math.min(9, max - a - b)));
    const obj = pick(OBJECTS);
    const answer = a + b + c;
    return {
      skill: 'chain', kind: 'choice', scene: 'docking',
      prompt: `${a} + ${b} + ${c} = ?`,
      say: `Три кучки. ${a} плюс ${b} плюс ${c}. Сколько всего?`,
      sayShort: `${a} плюс ${b} плюс ${c}. Сколько?`,
      display: { type: 'expr', text: `${a} + ${b} + ${c} = ?`, groups: [{ emoji: obj.e, n: a }, { emoji: obj.e, n: b }, { emoji: obj.e, n: c }], showObjects: d < 0.5 },
      options: numberOptions(answer, optCount(d), 1, max + 2),
      answer,
      hint: { type: 'show-objects', say: '' },
      guide: countGuide('.expr-objs .obj', `Нажимай на ${obj.each} во всех трёх кучках и считай подряд.`, answer, { reveal: true }),
      strategySay: `Сначала ${a} плюс ${b} — это ${a + b}. Потом ещё ${c}.`,
      explain: `${a} + ${b} + ${c} = ${answer}`, explainSay: `${a} плюс ${b} плюс ${c} равно ${answer}`,
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
      say: `В контейнере ровно десять. Рядом ещё ${x}. Десять плюс ${x}. Сколько всего?`,
      sayShort: `Десять плюс ${x}. Сколько?`,
      display: { type: 'tens', x, mode },
      options: numberOptions(n, optCount(d), 10, 20),
      answer: n,
      hint: { type: 'tens-count', say: '' },
      guide: countGuide('.singles i', 'Десять уже в контейнере. Нажимай на те, что рядом, и считай дальше: одиннадцать, двенадцать…', n, { start: 10 }),
      explain: `10 + ${x} = ${n}`, explainSay: `десять плюс ${x} равно ${n}`,
    } : {
      skill: 'tens', kind: 'choice', scene: 'tens',
      prompt: `${n} = 10 + ?`,
      say: `Число ${n}. Это десять и ещё сколько?`,
      sayShort: `${n} — это десять и сколько?`,
      display: { type: 'tens', x, mode },
      options: numberOptions(x, optCount(d), 1, 9),
      answer: x,
      hint: { type: 'tens-count', say: '' },
      guide: countGuide('.singles i', 'Десять в контейнере не считаем. Нажимай на те, что рядом с контейнером.', x, { doneSay: `Рядом ${x}. ${n} — это десять и ${x}. Нажми ${x}.` }),
      explain: `${n} = 10 + ${x}`, explainSay: `${n} это десять и ${x}`,
    };
  }

  // Загаданное число между: показываем дорожку из ячеек
  function genBetween(d) {
    const max = d < 0.4 ? 10 : 20;
    const lo = rint(d < 0.4 ? 0 : 3, max - 2), hi = lo + 2;
    const answer = lo + 1;
    const set = new Set([answer]);
    const pool = shuffle([lo, hi, lo - 1, hi + 1, lo - 2, hi + 2].filter(v => v >= 0 && v <= 20 && v !== answer));
    for (const v of pool) { if (set.size >= optCount(d)) break; set.add(v); }
    const from = Math.max(0, lo - 2), to = Math.min(20, hi + 2);
    const cells = []; for (let v = from; v <= to; v++) cells.push(v);
    const gapIdx = cells.indexOf(answer);
    return {
      skill: 'between', kind: 'choice', scene: 'secret',
      prompt: `Между ${lo} и ${hi}`,
      say: `Я загадал число. Оно стоит на дорожке между ${WI(lo)} и ${WI(hi)}. Какое число спряталось между ними?`,
      sayShort: `Какое число между ${WI(lo)} и ${WI(hi)}?`,
      display: { type: 'sequence', seq: cells, idx: gapIdx, hideLine: d >= 0.7, focus: cells.indexOf(lo), focus2: cells.indexOf(hi) },
      options: shuffle([...set]).map(v => ({ label: String(v), value: v })),
      answer,
      hint: { type: 'seq-neighbors', say: '' },
      guide: { mode: 'walk', targets: '.seq .cell', upto: gapIdx, reveal: true, say: `Вот дорожка. Нажимай числа по порядку с ${WG(cells[0])} до ${WG(lo)}.`, doneSay: `${W(lo)}, а дальше? Это и есть загаданное число.` },
      explain: `${lo} < ${answer} < ${hi}`, explainSay: `${answer}: между ${WI(lo)} и ${WI(hi)}`,
    };
  }

  // Который по счёту: нажми третью ракету
  function genOrdinal(d) {
    const k = d < 0.3 ? 4 : d < 0.6 ? 5 : rint(6, 7);
    const idx = rint(1, Math.min(k, d < 0.3 ? 4 : k));
    const fromRight = d >= 0.6 && rng() < 0.4;
    const answer = fromRight ? k - idx : idx - 1;
    const side = fromRight ? 'справа' : 'слева';
    return {
      skill: 'ordinal', kind: 'choice', scene: 'hangar',
      prompt: `Нажми ${ORDINALS_F[idx]} ракету ${side}`,
      say: `Ракеты стоят в ряд. Считай ${side}: первая, вторая… Нажми ${ORDINALS_F[idx]} ракету ${side}.`,
      sayShort: `Нажми ${ORDINALS_F[idx]} ракету ${side}.`,
      display: { type: 'none' },
      options: Array.from({ length: k }, (_, i) => ({ label: '🚀', value: i, emoji: true, row: true })),
      answer,
      hint: { type: 'ordinal-numbers', say: '' },
      guide: { mode: 'walk', targets: '#options .opt', upto: fromRight ? k - 1 - answer : answer, reverse: fromRight, ordinal: true, say: `Считаем вместе ${side}. Нажимай на ракеты по очереди: первая, вторая…`, doneSay: `А следующая — ${ORDINALS_F_NOM[idx]}. Нажми её.` },
      explain: `${ORDINALS_F_NOM[idx]} ${side}`, explainSay: `${ORDINALS_F_NOM[idx]} ${side}, я её подсветил`,
    };
  }

  // Послушай число
  function genListen(d) {
    const max = d < 0.5 ? 10 : 20;
    const n = rint(d < 0.5 ? 1 : 5, max);
    return {
      skill: 'listen', kind: 'choice', scene: 'radio',
      prompt: '🔊 Какое число я сказал?',
      say: `Слушай. Число… ${NUM_WORDS[n]}. Найди число ${NUM_WORDS[n]}.`,
      sayShort: `Число ${NUM_WORDS[n]}. Найди его.`,
      display: { type: 'listen', n, word: NUM_WORDS[n] },
      options: numberOptions(n, 4, Math.max(0, n - 4), Math.min(20, n + 4)),
      answer: n,
      hint: { type: 'listen-word', say: '' },
      guide: { mode: 'show', say: `Повторяю медленно: ${NUM_WORDS[n]}. Я написал это слово. ${n > 10 ? `${NUM_WORDS[n]} — это десять и ${NUM_WORDS[n - 10]}.` : ''}` },
      explain: `${n} — ${NUM_WORDS[n]}`,
    };
  }

  // Самая длинная / короткая ракета
  function genSize(d) {
    const k = d < 0.5 ? 3 : 4;
    const lens = shuffle([40, 60, 80, 100].slice(0, k).map(v => v - rint(0, 8)));
    const longest = d < 0.3 || rng() < 0.6;
    const target = longest ? Math.max(...lens) : Math.min(...lens);
    return {
      skill: 'size', kind: 'choice', scene: 'hangar',
      prompt: longest ? 'Какая ракета самая длинная?' : 'Какая ракета самая короткая?',
      say: longest ? 'Все ракеты стартуют слева. Какая ракета самая длинная? Нажми на неё.' : 'Все ракеты стартуют слева. Какая ракета самая короткая? Нажми на неё.',
      sayShort: longest ? 'Где самая длинная ракета?' : 'Где самая короткая ракета?',
      display: { type: 'none' },
      options: lens.map((v, i) => ({ label: String(v), value: i, bar: v })),
      answer: lens.indexOf(target),
      hint: { type: 'size-numbers', say: '' },
      guide: { mode: 'show', say: longest ? 'Чей нос улетел дальше всех вправо? Я обвёл её зелёным.' : 'Чей нос ближе всех к старту? Я обвёл её жёлтым.' },
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
      say: `Это ${sh.name}. Сколько у него углов? ${sh.corners === 0 ? 'Подумай: есть ли углы у круга?' : 'Считай уголки по кругу.'}`,
      sayShort: 'Сколько углов?',
      display: { type: 'corners', shape: sh.id, color: pick(COLORS).id },
      options: shuffle([...opts]).map(v => ({ label: String(v), value: v })),
      answer: sh.corners,
      hint: { type: 'corners-dots', say: '' },
      guide: sh.corners === 0
        ? { mode: 'show', say: 'Круг гладкий, у него нет ни одного угла. Ноль углов.' }
        : countGuide('.corner-dot', 'Я отметил уголки точками. Нажимай на каждую точку и считай.', sh.corners, { reveal: true, doneSay: `${sh.corners} ${plural(sh.corners, { one: 'угол', few: 'угла', many: 'углов' })}. Нажми ${sh.corners}.` }),
      explain: sh.corners === 0 ? 'у круга нет углов' : `${sh.corners}`,
    };
  }

  // Память: что пропало
  function genMemory(d) {
    const k = d < 0.3 ? 3 : d < 0.6 ? 4 : d < 0.85 ? 5 : 6;
    const pool = shuffle(['🚀', '⭐', '🪐', '👽', '🛸', '🌙', '☄️', '🤖', '💎', '🧑‍🚀']);
    const items = pool.slice(0, k);
    const hideIdx = rint(0, k - 1);
    const missing = items[hideIdx];
    const distractors = pool.slice(k, k + 2);
    const opts = shuffle([missing, ...distractors]).map(e => ({ label: e, value: e, emoji: true }));
    return {
      skill: 'memory', kind: 'choice', scene: 'memory',
      prompt: 'Что пропало?',
      say: `Запомни предметы: ${items.map(e => EMOJI_NAME[e]).join(', ')}. Сейчас один пропадёт.`,
      sayShort: 'Какой предмет пропал?',
      afterHideSay: 'Что пропало? Нажми на него.',
      display: { type: 'memory', items, hideIdx, showMs: d < 0.3 ? 3500 : d < 0.6 ? 3500 : 4000 },
      options: opts, answer: missing,
      hint: { type: 'none', say: '' },
      guide: { mode: 'replay', say: 'Я покажу ещё раз. Смотри внимательно и запоминай.', doneSay: 'Что пропало?' },
      explain: `пропал ${EMOJI_NAME[missing]}`, explainSay: `пропал ${EMOJI_NAME[missing]}`,
    };
  }

  // Память: повтори последовательность огней
  function genSimon(d) {
    const len = d < 0.4 ? 3 : d < 0.7 ? 4 : 5;
    const pads = ['🔴', '🟡', '🟢', '🔵'];
    const seq = [];
    for (let i = 0; i < len; i++) { let v = rint(0, 3); if (i && v === seq[i - 1] && rng() < 0.7) v = (v + 1) % 4; seq.push(v); }
    const names = ['красный', 'жёлтый', 'зелёный', 'синий'];
    return {
      skill: 'simon', kind: 'sequence', scene: 'runway',
      prompt: 'Повтори огни',
      say: 'Смотри, как мигают огни. Запомни порядок.',
      sayShort: 'Повтори огни в том же порядке.',
      afterShowSay: 'Теперь ты. Нажимай в том же порядке.',
      display: { type: 'simon', pads, seq, stepMs: d < 0.4 ? 700 : 600 },
      options: pads.map((p, i) => ({ label: p, value: i, emoji: true, pad: i })),
      answer: seq,
      hint: { type: 'none', say: '' },
      guide: { mode: 'replay', say: 'Покажу ещё раз, медленнее. Говори цвета вслух: это помогает запомнить.', doneSay: 'Теперь повтори.' },
      explain: seq.map(i => names[i]).join(', '), explainSay: seq.map(i => names[i]).join(', '),
    };
  }

  const GEN = { count: genCount, flash: genFlash, add: genAdd, sub: genSub, fuel: genFuel, story: genStory, compare: genCompare,
    missing: genMissing, order: genOrder, neighbors: genNeighbors, numline: genNumline, shapes: genShapes, same: genSame,
    pattern: genPattern, clock: genClock, money: genMoney, double: genDouble, half: genHalf, diff: genDiff,
    chain: genChain, tens: genTens, between: genBetween, ordinal: genOrdinal, listen: genListen, size: genSize, corners: genCorners,
    memory: genMemory, simon: genSimon };

  function generate(skill, d) {
    if (!GEN[skill]) throw new Error('unknown skill ' + skill);
    const dd = clamp01(d);
    const t = GEN[skill](dd);
    t.difficulty = dd;
    if (!t.sayShort) t.sayShort = t.prompt;
    return t;
  }

  return { SKILLS, TOPICS, LESSONS, SHAPES, CORNER_SHAPES, COLORS, OBJECTS, HEROES, SHOP, NUM_WORDS, EMOJI_NAME,
    generate, setRandom, plural, timeName, numberOptions };
});
