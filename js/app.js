/* Космо-математика: логика приложения */
(function () {
  'use strict';
  const T = window.Tasks;
  const $ = (id) => document.getElementById(id);
  const TASKS_PER_MISSION = 8;
  const MAX_STARS = TASKS_PER_MISSION * 2;
  const STORAGE_KEY = 'cosmomath.v1';

  const PLANETS = [
    { name: 'Луна', e: '🌙', story: 'Лунатики сбились со счёта: сколько у них кратеров? Поможешь посчитать?' },
    { name: 'Марс', e: '🔴', story: 'Марсианские роботы сломали калькулятор. Считаем за них!' },
    { name: 'Венера', e: '🟡', story: 'На Венере жарко, а звёзды всё равно надо считать. Вперёд!' },
    { name: 'Меркурий', e: '⚪', story: 'Меркурий самый быстрый. Успеешь решить всё до заката?' },
    { name: 'Юпитер', e: '🟠', story: 'У Юпитера много лун. Кто-то их перепутал, наведём порядок!' },
    { name: 'Сатурн', e: '🪐', story: 'Кольца Сатурна из тысяч камешков. Нам хватит и двадцати.' },
    { name: 'Уран', e: '🔵', story: 'Уран лежит на боку. Задания тоже слегка перевёрнутые!' },
    { name: 'Нептун', e: '🟣', story: 'На Нептуне дуют ветра. Держи числа крепче!' },
    { name: 'Плутон', e: '⚫', story: 'Маленький Плутон обиделся, что его не считают. Посчитаем всё!' },
    { name: 'Комета', e: '☄️', story: 'Прыгаем на хвост кометы. Считать придётся на лету!' },
    { name: 'Звезда', e: '⭐', story: 'Мы у самой звезды! Она светит тем, кто хорошо считает.' },
    { name: 'Галактика', e: '🌌', story: 'Край галактики. Дальше летали только самые умные космонавты.' },
  ];
  const TINTS = ['#2b2f6b', '#6b2b2b', '#6b5a2b', '#4a4a4a', '#6b4a2b', '#5a4a7a', '#2b5a6b', '#3b2b7a', '#2b2b3b', '#2b5a5a', '#6b6b2b', '#4a2b6b'];
  function setTint(i) { document.body.style.setProperty('--tint', TINTS[i % TINTS.length]); }
  const EXTRA_PLANET_EMOJI = ['🌍', '🌞', '🌠', '🛸', '🌗', '💫', '🌑', '🌕'];
  const EXTRA_STORIES = [
    'Неизвестная планета! Разведаем её вместе.', 'Здесь ещё никто не считал. Будем первыми!',
    'Сигнал с этой планеты просит помощи. Летим!', 'Планета-загадка. Разгадаем её числа!',
  ];
  const STICKERS = ['👽', '🛸', '🤖', '🧑‍🚀', '🐉', '🦄', '🦖', '🐙', '🐬', '🦋', '🐢', '🦊',
    '🐼', '🦁', '🐸', '🦉', '🐨', '🦕', '🐳', '🦜', '🐯', '🦩', '🐧', '🦔', '🐲', '🦚', '🐝', '🦋', '🐞', '🌈'];
  const PRAISE = ['Молодец!', 'Точно!', 'Супер!', 'Отлично!', 'Верно!', 'Так держать!', 'Ура!', 'Космически!', 'Ты звезда!', 'Полный вперёд!'];
  const SCENES = {
    porthole: '🔭 Иллюминатор', docking: '🛰️ Стыковка', flyaway: '🛸 Улетели', fuel: '⛽ Заправка', story: '📖 История',
    planets: '🪐 Две планеты', scales: '⚖️ Космо-весы', radar: '📡 Радар', countdown: '🚀 Обратный отсчёт',
    numline: '🛬 Посадка', repair: '🔧 Ремонт', runway: '💡 Взлётная полоса', clock: '⏰ Космо-часы', shop: '🛒 Космо-магазин',
    mirror: '🪞 Зеркальная планета', share: '🍬 Поровну', tens: '📦 Десяток', secret: '🔮 Загадка', hangar: '🏗️ Ангар', radio: '📻 Рация',
  };

  // ---------- состояние ----------
  function defaultState() {
    const skills = {};
    for (const k of Object.keys(T.SKILLS)) skills[k] = true;
    return {
      stars: 0, planets: [], stickers: [],
      dl: Difficulty.create(),
      stats: {}, history: [], lastFlight: null,
      settings: { voice: true, sound: true, adaptive: true, skills },
    };
  }
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const d = defaultState(), s = JSON.parse(raw);
      const st = { ...d, ...s,
        settings: { ...d.settings, ...(s.settings || {}), skills: { ...d.settings.skills, ...((s.settings || {}).skills || {}) } } };
      // миграция со старых форматов: levels 1..3 → diff 0..1 → Difficulty state
      let old = s.diff;
      if (s.levels && !old) { old = {}; for (const k in s.levels) old[k] = Math.min(1, (s.levels[k] - 1) / 2 + 0.1); }
      st.dl = s.dl ? Difficulty.normalize(s.dl) : old ? Difficulty.migrate(old) : Difficulty.create();
      delete st.levels; delete st.streak; delete st.failStreak; delete st.diff;
      return st;
    } catch (e) { return defaultState(); }
  }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (e) { /* приватный режим */ } }

  function planetInfo(i) {
    if (i < PLANETS.length) return PLANETS[i];
    const k = i - PLANETS.length;
    return { name: `Планета ${i + 1}`, e: EXTRA_PLANET_EMOJI[k % EXTRA_PLANET_EMOJI.length], story: EXTRA_STORIES[k % EXTRA_STORIES.length] };
  }
  function currentPlanet() {
    let i = 0;
    while (S.planets[i] && S.planets[i].rating > 0) i++;
    return i;
  }
  function enabledSkills() {
    const en = Object.keys(T.SKILLS).filter(k => S.settings.skills[k]);
    return en.length ? en : ['count', 'add', 'sub'];
  }

  // ---------- звук ----------
  let actx = null;
  function audio() {
    if (!S.settings.sound) return null;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  function tone(freq, dur, type, gain, when) {
    const c = audio(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    const t0 = c.currentTime + (when || 0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const SFX = {
    tap() { tone(880, 0.06, 'square', 0.06); },
    good() { tone(523, 0.12, 'sine', 0.2); tone(659, 0.12, 'sine', 0.2, 0.1); tone(784, 0.2, 'sine', 0.2, 0.2); },
    bad() { tone(180, 0.25, 'sawtooth', 0.12); },
    turbo() { [440, 554, 659, 880, 1108].forEach((f, i) => tone(f, 0.1, 'square', 0.08, i * 0.06)); },
    launch() { const c = audio(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(120, c.currentTime); o.frequency.exponentialRampToValueAtTime(900, c.currentTime + 1.1);
      g.gain.setValueAtTime(0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.2);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 1.25); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.22, i * 0.15)); tone(1047, 0.6, 'triangle', 0.22, 0.6); },
    sticker() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'sine', 0.2, i * 0.08)); },
  };

  // ---------- речь (js/speech.js) ----------
  Speech.init({ lang: 'ru-RU', rate: 0.92, pitch: 1.05 });
  Speech.setEnabled(S.settings.voice);
  Speech.onSpeaking(on => { const f = $('face'); if (f) f.classList.toggle('talking', on); const g = document.querySelector('#intro .face'); if (g) g.classList.toggle('talking', on); });
  // speak(text) — в хвост очереди; speak(text, 'now') — прервать всё; speak(text, 'low') — только если очередь пуста
  function speak(text, mode) {
    if (!text) return;
    if (mode === 'now') Speech.say(text, { interrupt: true });
    else if (mode === 'low') Speech.say(text, { priority: 'low' });
    else Speech.say(text);
  }

  // ---------- экраны ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }
  function face(emoji, ms) {
    const f = $('face'); f.textContent = emoji; f.classList.remove('pop'); void f.offsetWidth; f.classList.add('pop');
    if (ms) setTimeout(() => { if (f.textContent === emoji) f.textContent = M && M.combo >= 3 ? '😎' : '👽'; }, ms);
  }

  // ---------- главный экран ----------
  function renderHome() {
    $('home-stars').textContent = `⭐ ${S.stars}`;
    const r = Difficulty.rank(S.dl);
    $('rank').innerHTML = `<span class="rank-e">${r.emoji}</span><span class="rank-n">${r.name}</span><span class="rank-bar"><i style="width:${Math.round(r.progress * 100)}%"></i></span>`;
    setTint(currentPlanet());
    const cur = currentPlanet();
    const total = Math.max(PLANETS.length, cur + 3);
    const map = $('map');
    map.innerHTML = '';
    const flight = S.lastFlight; S.lastFlight = null;
    for (let i = 0; i < total; i++) {
      const p = planetInfo(i), st = S.planets[i];
      const el = document.createElement('div');
      const locked = i > cur;
      el.className = 'planet' + (locked ? ' locked' : '') + (i === cur ? ' current' : '');
      el.style.setProperty('--i', i);
      const rating = st ? st.rating : 0;
      el.innerHTML = `<span class="pe">${p.e}</span><span class="pname">${p.name}</span>` +
        `<span class="pstars">${'⭐'.repeat(rating)}${'<span style="opacity:.25">⭐</span>'.repeat(3 - rating)}</span>` +
        (i === cur ? `<span class="rocket" ${flight ? 'style="visibility:hidden"' : ''}>🚀</span>` : '');
      el.addEventListener('click', () => {
        if (locked) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); SFX.bad(); speak('Сначала открой предыдущую планету.', 'low'); return; }
        SFX.tap(); startMission(i);
      });
      map.appendChild(el);
    }
    const curEl = map.children[cur];
    if (curEl) setTimeout(() => curEl.scrollIntoView({ block: 'nearest' }), 50);
    if (flight && flight.to !== flight.from && map.children[flight.from] && map.children[flight.to]) {
      setTimeout(() => flyRocket(map.children[flight.from], map.children[flight.to]), 350);
    }
  }
  function flyRocket(fromEl, toEl) {
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const r = document.createElement('div');
    r.className = 'fly-rocket'; r.textContent = '🚀';
    document.body.appendChild(r);
    const x0 = a.right - 26, y0 = a.top - 10, x1 = b.right - 26, y1 = b.top - 10;
    const ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI + 45;
    r.style.transform = `translate(${x0}px, ${y0}px) rotate(${ang}deg)`;
    SFX.launch();
    const anim = r.animate([
      { transform: `translate(${x0}px, ${y0}px) rotate(${ang}deg) scale(1)` },
      { transform: `translate(${(x0 + x1) / 2}px, ${(y0 + y1) / 2 - 40}px) rotate(${ang}deg) scale(1.4)` },
      { transform: `translate(${x1}px, ${y1}px) rotate(-20deg) scale(1)` },
    ], { duration: 1300, easing: 'ease-in-out' });
    anim.onfinish = () => { r.remove(); const rk = toEl.querySelector('.rocket'); if (rk) rk.style.visibility = ''; };
  }

  // ---------- миссия ----------
  let M = null;
  function startMission(planetIdx) {
    const tasks = T.buildMission(enabledSkills(), Difficulty.map(S.dl, enabledSkills()), TASKS_PER_MISSION);
    M = { planet: planetIdx, tasks, idx: 0, stars: 0, bonus: 0, results: [], attempts: 0, picked: [], busy: false, combo: 0, t0: 0 };
    const p = planetInfo(planetIdx);
    $('intro-planet').textContent = p.e;
    $('intro-title').textContent = p.name;
    $('intro-story').textContent = p.story;
    setTint(planetIdx);
    show('intro');
    speak(`Летим на планету ${p.name}! ${p.story}`, 'now');
  }
  function beginTasks() {
    launchOverlay(() => { show('game'); $('face').textContent = '👽'; renderTask(); });
  }
  function launchOverlay(done) {
    const o = $('launch'); o.hidden = false; o.classList.remove('go'); void o.offsetWidth; o.classList.add('go');
    setTimeout(() => { o.hidden = true; done(); }, 1000);
  }

  function renderProgress() {
    const p = $('progress');
    p.innerHTML = '';
    for (let i = 0; i < M.tasks.length; i++) {
      const dot = document.createElement('i');
      const r = M.results[i];
      if (r === 2) dot.className = 'done'; else if (r === 1) dot.className = 'half';
      if (i === M.idx) dot.classList.add('cur');
      p.appendChild(dot);
    }
    $('game-stars').textContent = `⭐ ${M.stars}`;
    const c = $('combo');
    c.hidden = M.combo < 3; c.textContent = `🔥 Турбо ×${M.combo}`;
  }

  function renderTask() {
    const t = M.tasks[M.idx];
    M.attempts = 0; M.picked = []; M.busy = false; M.t0 = Date.now();
    renderProgress();
    $('prompt').textContent = t.prompt;
    $('scene').textContent = SCENES[t.scene] || '';
    $('feedback').textContent = ''; $('feedback').className = 'feedback';
    const hint = $('hint'); hint.hidden = true; hint.textContent = '';
    const stage = $('stage'); stage.innerHTML = ''; stage.style.display = '';
    const opts = $('options'); opts.innerHTML = ''; opts.className = 'options'; opts.style.gridTemplateColumns = '';
    renderStage(t, stage);
    renderOptions(t, opts);
    const ear = $('btn-ear'); if (ear) ear.addEventListener('click', () => { SFX.tap(); speak(t.say, 'now'); });
    stage.querySelectorAll('.obj, .coin, .sh, .cell, .tank i, .singles i').forEach((o, i) => o.style.setProperty('--i', i));
    [stage, opts].forEach(el => { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); });
    const noStage = stage.style.display === 'none';
    opts.classList.toggle('tall', noStage);
    document.querySelector('.task').classList.toggle('collapsed', noStage);
    speak(t.say, 'now');
  }

  // --- визуальная часть задания ---
  function objsHTML(g, extra) {
    const n = g.n, crossed = extra && extra.crossed ? g.crossed || 0 : 0, numbered = extra && extra.numbered;
    const extraN = extra && extra.extra ? g.extra || 0 : 0;
    let h = `<div class="objs${n + extraN > 5 ? ' rows5' : ''}">`;
    for (let i = 0; i < n; i++) {
      const cr = i >= n - crossed;
      h += `<span class="obj${cr ? ' crossed' : ''}">${g.emoji}${numbered ? `<span class="num">${i + 1}</span>` : ''}</span>`;
    }
    for (let i = 0; i < extraN; i++) h += `<span class="obj extra">${g.emoji}</span>`;
    return h + '</div>';
  }
  function groupsHTML(groups, extra) {
    return '<div class="groups">' + groups.map(g =>
      (g.label ? `<div class="glabel"><b>${g.label}</b>${objsHTML(g, extra)}</div>` : objsHTML(g, extra))
    ).join('<span class="plus">+</span>') + '</div>';
  }
  function renderStage(t, stage) {
    const d = t.display;
    switch (d.type) {
      case 'objects':
        stage.innerHTML = `<div class="porthole">${groupsHTML(d.groups)}</div>`; break;
      case 'expr':
        stage.innerHTML = `<div class="expr">${d.text.replace('?', '<span class="q">?</span>')}</div>` +
          `<div class="expr-objs" ${d.showObjects ? '' : 'hidden'}>${groupsHTML(d.groups, { crossed: true })}</div>`;
        break;
      case 'story':
        stage.innerHTML = `<div class="expr-objs" ${d.showObjects ? '' : 'hidden'}>${groupsHTML(d.groups, { crossed: true, extra: true })}</div>` +
          `<div class="story-nums" ${d.showObjects ? 'hidden' : ''}>${d.groups.map(g => `<div class="story-num"><b>${g.label}</b><span>${g.n}${g.extra ? ' + ' + g.extra : ''}${g.crossed ? ' − ' + g.crossed : ''}</span><i>${g.emoji}</i></div>`).join('')}</div>`;
        break;
      case 'fuel': {
        let cells = '';
        for (let i = 1; i <= d.target; i++) cells += `<i class="${i <= d.have ? 'full' : 'empty'}" data-i="${i}"></i>`;
        stage.innerHTML = `<div class="fuel"><div class="tank ${d.target > 10 ? 'wide' : ''}">${cells}</div>` +
          `<div class="fuel-text">Залито <b>${d.have}</b> из <b>${d.target}</b></div><div class="rocket-big">🚀</div></div>`;
        break; }
      case 'pair-objects':
        stage.style.display = 'none'; break;
      case 'compare-numbers':
        stage.innerHTML = `<div class="cmp"><span class="n">${d.a}</span><span class="sign">?</span><span class="n">${d.b}</span></div>` +
          `<div class="cmp-dots" id="cmp-dots" hidden><div class="dots">${'<i></i>'.repeat(d.a)}</div><div class="dots">${'<i></i>'.repeat(d.b)}</div></div>`;
        break;
      case 'sequence':
        stage.innerHTML = '<div class="radar"><div class="seq">' + d.seq.map((v, i) =>
          `<div class="cell${i === d.idx ? ' gap' : ''}" data-i="${i}">${i === d.idx ? '?' : v}</div>`).join('') + '</div></div>';
        break;
      case 'neighbors':
        stage.innerHTML = `<div class="seq big"><div class="cell">${d.after ? d.n : '?'}</div><div class="cell gap">${d.after ? '?' : d.n}</div></div>`.replace(
          d.after ? '<div class="cell gap">?</div>' : '<div class="cell">?</div>', d.after ? '<div class="cell gap">?</div>' : '<div class="cell gap">?</div>') +
          `<div class="seq small" id="nb-line" hidden>${[-2, -1, 0, 1, 2].map(k => { const v = d.n + k; return v < 0 ? '' : `<div class="cell${v === (d.after ? d.n + 1 : d.n - 1) ? ' gap' : ''}">${v === (d.after ? d.n + 1 : d.n - 1) ? '?' : v}</div>`; }).join('')}</div>`;
        break;
      case 'numline':
        stage.innerHTML = numlineSVG(d.max, d.n, d.labelEvery); break;
      case 'sequence-emoji':
        stage.innerHTML = '<div class="runway"><div class="seq">' + d.seq.map((v, i) =>
          `<div class="cell emoji" data-g="${Math.floor(i / d.unitLen) % 2}">${v}</div>`).join('') + '<div class="cell gap">?</div></div></div>';
        break;
      case 'shapes':
        stage.innerHTML = '<div class="shapes-grid">' + d.items.map(it =>
          `<div class="sh" data-t="${it.shape === d.target ? 1 : 0}">${shapeSVG(it.shape, it.color)}</div>`).join('') + '</div>';
        break;
      case 'clock':
        stage.innerHTML = clockSVG(d.h, d.m) + `<div class="digital" id="digital" hidden>${d.h}:${String(d.m).padStart(2, '0')}</div>`;
        break;
      case 'coins':
        stage.innerHTML = `<div class="shop-item"><span>${d.item.e}</span><small>${d.item.name}</small></div>` +
          '<div class="coins">' + d.coins.map(c => `<div class="coin c${c}">${c}</div>`).join('') + '</div>' +
          `<div class="coin-sum" id="coin-sum" hidden>${d.coins.join(' + ')} = ?</div>`;
        break;
      case 'share': {
        let objs = '';
        for (let i = 0; i < d.n; i++) objs += `<span class="obj share-obj" data-p="${i % 2}">${d.emoji}</span>`;
        stage.innerHTML = `<div class="share"><div class="objs${d.n > 5 ? ' rows5' : ''}">${objs}</div>` +
          `<div class="share-rockets"><div class="srocket r0">🚀<b id="share-a"></b></div><div class="srocket r1">🚀<b id="share-b"></b></div></div></div>`;
        break; }
      case 'diff': {
        const [g1, g2] = d.groups;
        const row = (g, extraFrom) => `<div class="diff-row"><b>${g.label}</b><div class="objs">${Array.from({ length: g.n }, (_, i) =>
          `<span class="obj${extraFrom != null && i >= extraFrom ? ' diff-extra' : ''}">${g.emoji}</span>`).join('')}</div></div>`;
        stage.innerHTML = `<div class="diff">${row(g1, g2.n)}${row(g2)}</div>`;
        break; }
      case 'tens': {
        let singles = '';
        for (let i = 1; i <= d.x; i++) singles += `<i data-n="${10 + i}"></i>`;
        stage.innerHTML = `<div class="tens"><div class="ten-box">${'<i></i>'.repeat(10)}<b>10</b></div><span class="plus">+</span><div class="singles">${singles}</div></div>` +
          `<div class="tens-text">${d.mode === 'sum' ? `10 + ${d.x}` : `${10 + d.x} = 10 + ?`}</div>`;
        break; }
      case 'between':
        stage.innerHTML = `<div class="between"><span class="n">${d.lo}</span><span class="lt">&lt;</span><span class="q">?</span><span class="lt">&lt;</span><span class="n">${d.hi}</span></div>` +
          `<div id="between-line" hidden>${numlineSVG(d.max, null, 1, { lo: d.lo, hi: d.hi })}</div>`;
        break;
      case 'listen':
        stage.innerHTML = `<button class="ear" id="btn-ear" aria-label="Повторить число">🔊</button><div class="listen-word" id="listen-word" ${Speech.isEnabled() && Speech.available() ? 'hidden' : ''}>${d.word}</div>`;
        break;
      case 'corners':
        stage.innerHTML = `<div class="corner-shape">${shapeSVG(d.shape, d.color, true)}</div>`;
        break;
      default:
        stage.style.display = 'none';
    }
  }

  const POLY = {
    triangle: [[50, 8], [94, 90], [6, 90]],
    square: [[10, 10], [90, 10], [90, 90], [10, 90]],
    diamond: [[50, 5], [92, 50], [50, 95], [8, 50]],
    pentagon: [[50, 5], [95, 38], [78, 92], [22, 92], [5, 38]],
    hexagon: [[28, 8], [72, 8], [95, 50], [72, 92], [28, 92], [5, 50]],
    star: [[50, 5], [61, 38], [96, 38], [68, 58], [79, 92], [50, 71], [21, 92], [32, 58], [4, 38], [39, 38]],
  };
  function shapeSVG(id, color, withDots) {
    const p = {
      circle: '<circle cx="50" cy="50" r="42"/>',
      heart: '<path d="M50 90 L14 52 A20 20 0 0 1 50 26 A20 20 0 0 1 86 52 Z"/>',
    }[id] || `<polygon points="${POLY[id].map(q => q.join(',')).join(' ')}"/>`;
    const dots = withDots && POLY[id] && id !== 'star' ? POLY[id].map(([x, y], i) =>
      `<g class="corner-dot" hidden><circle cx="${x}" cy="${y}" r="7" fill="#ff5c8a" stroke="#fff" stroke-width="2"/><text x="${x}" y="${y}" font-size="8" font-weight="900" fill="#fff" text-anchor="middle" dominant-baseline="central">${i + 1}</text></g>`).join('') : '';
    return `<svg viewBox="-8 -8 116 116" fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="3">${p}${dots}</svg>`;
  }
  function clockSVG(h, m) {
    let ticks = '';
    for (let i = 1; i <= 12; i++) {
      const a = (i * 30 - 90) * Math.PI / 180;
      ticks += `<text x="${50 + 38 * Math.cos(a)}" y="${50 + 38 * Math.sin(a)}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="800" fill="#fff">${i}</text>`;
    }
    const ha = ((h % 12) * 30 + m * 0.5 - 90) * Math.PI / 180;
    const ma = (m * 6 - 90) * Math.PI / 180;
    return `<svg class="clock" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="48" fill="#2a3468" stroke="#ffd23f" stroke-width="3"/>${ticks}
      <line x1="50" y1="50" x2="${50 + 22 * Math.cos(ha)}" y2="${50 + 22 * Math.sin(ha)}" stroke="#ffd23f" stroke-width="6" stroke-linecap="round"/>
      <line x1="50" y1="50" x2="${50 + 32 * Math.cos(ma)}" y2="${50 + 32 * Math.sin(ma)}" stroke="#4cc9f0" stroke-width="4" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="3.5" fill="#fff"/></svg>`;
  }
  function numlineSVG(max, n, every, range) {
    const W = 340, pad = 18, step = (W - 2 * pad) / max;
    let s = `<svg class="numline" viewBox="0 0 ${W} 122">`;
    if (range) s += `<rect x="${pad + range.lo * step}" y="40" width="${(range.hi - range.lo) * step}" height="50" rx="8" fill="rgba(255,210,63,.18)" stroke="#ffd23f" stroke-dasharray="4 3"/>`;
    s += `<line x1="${pad}" y1="70" x2="${W - pad}" y2="70" stroke="#a9b1d6" stroke-width="3"/>`;
    for (let i = 0; i <= max; i++) {
      const x = pad + i * step, big = i % 5 === 0;
      s += `<line x1="${x}" y1="${big ? 58 : 63}" x2="${x}" y2="${big ? 82 : 77}" stroke="#fff" stroke-width="${big ? 3 : 2}"/>`;
      const show = i === 0 || i === max || i % every === 0;
      const y = max > 10 && i % 2 ? 114 : 98;
      s += `<text class="nl-label${show ? '' : ' hid'}" x="${x}" y="${y}" text-anchor="middle" font-size="${max > 10 ? 12 : 14}" font-weight="800" fill="#ffd23f">${i}</text>`;
    }
    if (n != null) {
      const rx = pad + n * step;
      s += `<text x="${rx}" y="48" text-anchor="middle" font-size="30">🚀</text><polygon points="${rx - 6},52 ${rx + 6},52 ${rx},62" fill="#ff5c8a"/>`;
    }
    return s + '</svg>';
  }

  // --- кнопки-варианты ---
  function renderOptions(t, box) {
    const d = t.display;
    if (d.type === 'pair-objects') {
      box.classList.add('cols2');
      d.groups.forEach((g, i) => {
        const b = document.createElement('button');
        b.className = 'opt pair-btn'; b.dataset.value = String(i);
        b.innerHTML = `<span class="mini-planet">${i ? '🟣' : '🟠'}</span>` + objsHTML(g) + `<span class="cnt" hidden>${g.n}</span>`;
        b.addEventListener('click', () => onChoice(t, b, i));
        box.appendChild(b);
      });
      return;
    }
    if (t.options.length === 4) box.classList.add('cols2');
    if (t.options[0].row) { box.className = 'options row'; box.style.gridTemplateColumns = `repeat(${t.options.length}, minmax(0, 1fr))`; }
    if (t.options[0].bar) box.className = 'options bars';
    t.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt';
      if (o.bar) {
        b.classList.add('bar');
        b.innerHTML = `<span class="bar-body" style="width:${o.bar}%"><span class="bar-tail">🔥</span><span class="bar-nose">🚀</span></span><span class="bar-len" hidden>${o.bar}</span>`;
      } else if (o.row) { b.classList.add('emoji', 'rowitem'); b.innerHTML = `<span>${o.label}</span><span class="ord-num" hidden>${i + 1}</span>`; }
      else if (o.shape) {
        b.classList.add('shape');
        const s = T.SHAPES.find(x => x.id === o.shape);
        b.innerHTML = shapeSVG(o.shape, o.color) + `<span class="lbl" hidden>${s.name}</span>`;
      } else if (o.emoji) { b.classList.add('emoji'); b.textContent = o.label; }
      else if (o.word) { b.classList.add('asteroid', 'signbtn'); b.innerHTML = `<span>${o.label}</span><small>${o.word}</small>`; }
      else { b.classList.add('asteroid'); b.textContent = o.label; }
      b.dataset.value = String(o.value); b.dataset.i = String(i);
      if (t.kind === 'order') b.addEventListener('click', () => onOrderTap(t, b, o.value));
      else b.addEventListener('click', () => onChoice(t, b, o.value));
      box.appendChild(b);
    });
  }

  // --- обработка ответа ---
  function onChoice(t, btn, value) {
    if (M.busy) return;
    if (value === t.answer) return correct(t, btn);
    wrong(t, btn);
  }
  function correct(t, btn) {
    M.busy = true;
    btn.classList.add('right', 'pop');
    const stars = M.attempts === 0 ? 2 : 1;
    flyStars(btn, stars);
    celebrateScene(t);
    finishTask(t, stars);
  }
  function flyStars(fromEl, n) {
    const a = fromEl.getBoundingClientRect(), b = $('game-stars').getBoundingClientRect();
    for (let i = 0; i < n * 2; i++) {
      const st = document.createElement('div'); st.className = 'fly-star'; st.textContent = '⭐';
      document.body.appendChild(st);
      const x0 = a.left + a.width / 2 + (Math.random() - 0.5) * 60, y0 = a.top + a.height / 2;
      const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
      st.animate([
        { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 1 },
        { transform: `translate(${(x0 + x1) / 2 + (Math.random() - 0.5) * 120}px, ${(y0 + y1) / 2}px) scale(1.4)`, opacity: 1, offset: .5 },
        { transform: `translate(${x1}px, ${y1}px) scale(.4)`, opacity: .2 },
      ], { duration: 700 + i * 90, easing: 'cubic-bezier(.3,.7,.4,1)' }).onfinish = () => st.remove();
    }
    setTimeout(() => { const g = $('game-stars'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); }, 600);
  }
  function celebrateScene(t) {
    const stage = $('stage');
    const sc = t.scene, d = t.display;
    if (sc === 'flyaway' || (d.type === 'story' && d.groups.some(g => g.crossed))) {
      const box = stage.querySelector('.expr-objs'); if (box) box.hidden = false;
      stage.querySelectorAll('.obj.crossed').forEach((o, i) => {
        o.classList.remove('crossed'); o.classList.add('flyoff'); o.style.setProperty('--i', i);
      });
    } else if (d.type === 'fuel') {
      stage.querySelectorAll('.tank i.empty').forEach((c, i) => setTimeout(() => { c.classList.add('full'); c.textContent = ''; }, 80 * i));
      const r = stage.querySelector('.rocket-big'); if (r) r.classList.add('liftoff');
    } else if (d.type === 'share') {
      stage.querySelectorAll('.share-obj').forEach((o, i) => { o.classList.add('to-r' + (i % 2)); o.style.setProperty('--i', i); });
    } else {
      stage.querySelectorAll('.obj, .coin, .sh, .cell').forEach((o, i) => { o.classList.add('bounce'); o.style.setProperty('--i', i); });
    }
  }
  function wrong(t, btn) {
    M.attempts++;
    btn.classList.add('wrong', 'shake');
    SFX.bad();
    face('🤔', 1500);
    if (M.attempts === 1) {
      showHint(t);
      fb('Попробуй ещё раз', 'bad');
      speak(t.hint.say);
    } else {
      M.busy = true;
      fb(`Ответ: ${t.explain}`, 'bad');
      revealAnswer(t);
      speak(`Правильный ответ: ${t.explainSay || t.explain}. Ничего, в следующий раз получится!`);
      finishTask(t, 0, 4200);
    }
  }
  function revealAnswer(t) {
    document.querySelectorAll('#options .opt').forEach(b => {
      if (b.dataset.value === String(t.answer)) b.classList.add('right', 'pop');
      else b.classList.add('wrong');
    });
  }
  function fb(text, cls) {
    const f = $('feedback'); f.textContent = text; f.className = 'feedback pop ' + cls;
  }

  function onOrderTap(t, btn, value) {
    if (M.busy || btn.classList.contains('picked')) return;
    const expected = t.answer[M.picked.length];
    if (value === expected) {
      SFX.tap();
      M.picked.push(value);
      btn.classList.add('picked');
      btn.innerHTML = `<span class="ord">${M.picked.length}</span>${btn.textContent}`;
      document.querySelectorAll('#options .opt.next-hint').forEach(b => b.classList.remove('next-hint'));
      if (M.picked.length === t.answer.length) {
        M.busy = true;
        finishTask(t, M.attempts === 0 ? 2 : 1);
      } else if (M.attempts > 0) hintNextOrder(t);
    } else {
      M.attempts++;
      btn.classList.add('shake'); setTimeout(() => btn.classList.remove('shake'), 400);
      SFX.bad(); face('🤔', 1500);
      if (M.attempts === 1) { showHint(t); fb('Не то число', 'bad'); speak(t.hint.say); hintNextOrder(t); }
      else if (M.attempts >= 3) {
        M.busy = true;
        fb(`Порядок: ${t.explain}`, 'bad');
        document.querySelectorAll('#options .opt').forEach(b => {
          const k = t.answer.indexOf(Number(b.dataset.value));
          b.classList.add('picked'); b.innerHTML = `<span class="ord">${k + 1}</span>${b.dataset.value}`;
        });
        speak(`Правильный порядок: ${t.answer.join(', ')}`);
        finishTask(t, 0, 3600);
      } else { fb('Не то число', 'bad'); hintNextOrder(t); }
    }
  }
  function hintNextOrder(t) {
    const expected = t.answer[M.picked.length];
    document.querySelectorAll('#options .opt').forEach(b => {
      b.classList.toggle('next-hint', b.dataset.value === String(expected) && !b.classList.contains('picked'));
    });
  }

  // --- подсказки ---
  function showHint(t) {
    const h = $('hint');
    h.hidden = false; h.textContent = t.hint.say;
    const stage = $('stage');
    switch (t.hint.type) {
      case 'number-objects':
        stage.innerHTML = `<div class="porthole">${groupsHTML(t.display.groups, { numbered: true })}</div>`; break;
      case 'show-objects': {
        const box = stage.querySelector('.expr-objs'); if (box) box.hidden = false;
        break; }
      case 'fuel-count':
        stage.querySelectorAll('.tank i.empty').forEach(c => { c.textContent = c.dataset.i; }); break;
      case 'pair-counts':
        document.querySelectorAll('#options .cnt').forEach(c => c.hidden = false); break;
      case 'compare-objects': {
        const dd = $('cmp-dots'); if (dd) dd.hidden = false; break; }
      case 'seq-neighbors':
        stage.querySelectorAll(`.cell[data-i="${t.display.idx - 1}"], .cell[data-i="${t.display.idx + 1}"]`).forEach(c => c.classList.add('neigh')); break;
      case 'neighbors-line': {
        const l = $('nb-line'); if (l) l.hidden = false; break; }
      case 'numline-labels':
        stage.querySelectorAll('.nl-label.hid').forEach(x => x.classList.remove('hid')); break;
      case 'pattern-groups':
        stage.querySelectorAll('.cell[data-g]').forEach(c => c.classList.add('g' + c.dataset.g)); break;
      case 'shape-names':
        document.querySelectorAll('#options .lbl').forEach(l => l.hidden = false); break;
      case 'shape-highlight': {
        let n = 0;
        stage.querySelectorAll('.sh').forEach(s => {
          if (s.dataset.t === '1') s.insertAdjacentHTML('beforeend', `<span class="num">${++n}</span>`);
          else s.classList.add('dim');
        });
        break; }
      case 'clock-digits': {
        const d = $('digital'); if (d) d.hidden = false; break; }
      case 'coins-sum': {
        const c = $('coin-sum'); if (c) c.hidden = false; break; }
      case 'order-next': hintNextOrder(t); break;
      case 'share-pairs':
        stage.querySelectorAll('.share-obj').forEach(o => o.classList.add('p' + o.dataset.p));
        stage.querySelectorAll('.srocket').forEach((r, i) => r.classList.add('r' + i + '-on')); break;
      case 'diff-highlight':
        stage.querySelectorAll('.diff-extra').forEach(o => o.classList.add('on')); break;
      case 'tens-count':
        stage.querySelectorAll('.singles i').forEach(i => { i.textContent = i.dataset.n; }); break;
      case 'between-line': {
        const l = $('between-line'); if (l) l.hidden = false; break; }
      case 'listen-word': {
        const w = $('listen-word'); if (w) w.hidden = false; break; }
      case 'ordinal-numbers': {
        const fromRight = /справа/.test(t.prompt);
        const btns = [...document.querySelectorAll('#options .opt')];
        btns.forEach((b, i) => { const n = b.querySelector('.ord-num'); if (n) { n.hidden = false; n.textContent = fromRight ? btns.length - i : i + 1; } });
        break; }
      case 'size-numbers': {
        const bodies = [...document.querySelectorAll('#options .opt.bar .bar-body')];
        const lens = bodies.map(b => b.offsetWidth);
        bodies.forEach((b, i) => { b.classList.toggle('longest', lens[i] === Math.max(...lens)); b.classList.toggle('shortest', lens[i] === Math.min(...lens)); });
        break; }
      case 'corners-dots':
        stage.querySelectorAll('.corner-dot').forEach(g => g.removeAttribute('hidden')); break;
    }
  }

  // --- завершение задания ---
  function finishTask(t, stars, delay) {
    const seconds = (Date.now() - M.t0) / 1000;
    M.results[M.idx] = stars;
    M.stars += stars;
    if (stars === 2) M.combo++; else M.combo = 0;
    let msg = '';
    if (stars > 0) {
      const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
      if (M.combo >= 3) { SFX.turbo(); face('😎'); msg = `🔥 Турбо ×${M.combo}! ${praise}`; }
      else { SFX.good(); face('🤩', 1200); msg = (stars === 2 ? '⭐⭐ ' : '⭐ ') + praise; }
      if (M.combo === 4 || M.combo === 8) { M.bonus++; S.stars++; msg += ' +1 бонус'; }
      fb(msg, 'ok');
      Speech.clearPending();
      speak(M.combo === 3 ? 'Турбо! Три подряд!' : M.combo === 6 ? 'Шесть подряд! Ты просто ракета!' : praise, 'low');
    }
    recordStat(t.skill, stars, seconds);
    renderProgress();
    setTimeout(() => {
      M.idx++;
      if (M.idx < M.tasks.length) renderTask(); else finishMission();
    }, delay || (stars > 0 ? 1100 : 2000));
  }

  function recordStat(skill, stars, seconds) {
    const st = S.stats[skill] || (S.stats[skill] = { asked: 0, first: 0, second: 0, fail: 0 });
    st.asked++;
    if (stars === 2) st.first++; else if (stars === 1) st.second++; else st.fail++;
    if (S.settings.adaptive) {
      const before = Difficulty.rank(S.dl).level;
      Difficulty.update(S.dl, skill, stars, seconds);
      // общий уровень изменился — оставшиеся задания миссии перегенерируем под новую сложность
      for (let i = M.idx + 1; i < M.tasks.length; i++) M.tasks[i] = T.generate(M.tasks[i].skill, Difficulty.effective(S.dl, M.tasks[i].skill));
      const r = Difficulty.rank(S.dl);
      if (r.level > before) M.rankUp = r;
    }
    save();
  }

  function finishMission() {
    const rating = M.stars >= 14 ? 3 : M.stars >= 10 ? 2 : M.stars >= 6 ? 1 : 0;
    const prev = S.planets[M.planet] || { stars: 0, rating: 0 };
    const firstClear = prev.rating === 0 && rating > 0;
    const before = currentPlanet();
    S.planets[M.planet] = { stars: Math.max(prev.stars, M.stars), rating: Math.max(prev.rating, rating) };
    S.stars += M.stars;
    let sticker = null;
    if (firstClear && S.stickers.length < STICKERS.length) { sticker = S.stickers.length; S.stickers.push(sticker); }
    const after = currentPlanet();
    if (after !== before) S.lastFlight = { from: before, to: after };
    const skillsSummary = {};
    M.tasks.forEach((t, i) => { const k = skillsSummary[t.skill] || (skillsSummary[t.skill] = [0, 0]); k[0] += M.results[i]; k[1] += 2; });
    S.history.unshift({ d: Date.now(), planet: M.planet, stars: M.stars, skills: skillsSummary });
    S.history = S.history.slice(0, 20);
    save();

    const p = planetInfo(M.planet);
    $('result-planet').textContent = p.e;
    $('result-title').textContent = rating > 0 ? `${p.name}: открыто!` : `${p.name}: почти!`;
    $('result-stars').innerHTML = '⭐'.repeat(rating) + '<span class="dim">' + '⭐'.repeat(3 - rating) + '</span>' +
      `<div style="font-size:20px;color:var(--muted)">${M.stars} из ${MAX_STARS} звёзд${M.bonus ? ` + ${M.bonus} бонус` : ''}</div>`;
    const se = $('sticker-earned'); se.hidden = sticker === null;
    const ru = $('rank-up'); ru.hidden = !M.rankUp;
    if (M.rankUp) ru.innerHTML = `<div class="sticker-label">Новое звание!</div><div class="rank-big">${M.rankUp.emoji}</div><div class="rank-name">${M.rankUp.name}</div>`;
    if (sticker !== null) $('sticker-big').textContent = STICKERS[sticker];
    $('btn-next').textContent = rating > 0 ? 'Дальше 🚀' : 'Ещё раз 🚀';
    show('result');
    if (rating > 0) { SFX.fanfare(); confetti(); } else SFX.good();
    setTimeout(() => speak(rating > 0
      ? `Планета ${p.name} открыта! ${rating === 3 ? 'Три звезды, идеально!' : ''} ${sticker !== null ? 'Ты получил новую наклейку!' : ''} ${M.rankUp ? 'И новое звание: ' + M.rankUp.name + '!' : ''}`
      : 'Почти получилось. Зум верит в тебя, давай ещё раз!', 'now'), 400);
    if (sticker !== null) setTimeout(SFX.sticker, 900);
  }

  function confetti() {
    const box = $('confetti'); box.innerHTML = '';
    const colors = ['#ffd23f', '#4cc9f0', '#3ddc97', '#ff5c8a', '#b388ff', '#ff8c42'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
      c.style.animationDelay = Math.random() * 0.8 + 's';
      box.appendChild(c);
    }
    setTimeout(() => { box.innerHTML = ''; }, 4000);
  }

  // ---------- альбом ----------
  function renderAlbum() {
    const g = $('album-grid'); g.innerHTML = '';
    STICKERS.forEach((e, i) => {
      const el = document.createElement('div');
      const has = S.stickers.includes(i);
      el.className = 'st' + (has ? '' : ' empty');
      el.textContent = has ? e : '❔';
      g.appendChild(el);
    });
  }

  // ---------- родительский раздел ----------
  let gateAnswer = 0;
  function openGate() {
    const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
    gateAnswer = a * b;
    $('gate-q').textContent = `${a} × ${b} = ?`;
    $('gate-input').value = '';
    $('gate').hidden = false;
    setTimeout(() => $('gate-input').focus(), 50);
  }
  function renderParent() {
    const body = $('parent-body');
    const skillsHTML = Object.keys(T.SKILLS).map(k => {
      const st = S.stats[k] || { asked: 0, first: 0, second: 0, fail: 0 };
      const acc = st.asked ? Math.round((st.first + st.second * 0.5) / st.asked * 100) : 0;
      return `<div class="stat-row"><span>${T.SKILLS[k].name}</span><span>${st.asked}</span>` +
        `<span class="bar"><i style="width:${acc}%"></i></span><span>${acc}%</span></div>`;
    }).join('');
    const levelsHTML = Object.keys(T.SKILLS).map(k => {
      const pct = Math.round(Difficulty.effective(S.dl, k) * 100);
      return `<div class="toggle"><label><input type="checkbox" data-skill="${k}" ${S.settings.skills[k] ? 'checked' : ''}> ${T.SKILLS[k].name}</label>` +
        `<div class="lvl"><span class="bar diff"><i style="width:${pct}%"></i></span><span class="pct" data-pct="${k}">${pct}%</span>` +
        `<div class="lvl-btns" data-skill="${k}"><button data-d="0.15">Л</button><button data-d="0.5">С</button><button data-d="0.85">Т</button></div></div></div>`;
    }).join('');
    const hist = S.history.slice(0, 10).map(h => {
      const d = new Date(h.d);
      const weak = Object.entries(h.skills).filter(([, v]) => v[0] < v[1] / 2).map(([k]) => T.SKILLS[k].name);
      return `<div>${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} — ${planetInfo(h.planet).name}: ${h.stars}/${MAX_STARS}${weak.length ? ' · слабо: ' + weak.join(', ') : ''}</div>`;
    }).join('') || '<div>Пока нет сыгранных миссий.</div>';

    body.innerHTML = `
      <div class="card"><h3>Статистика по навыкам</h3>
        <div class="stat-row head"><span>Навык</span><span>Заданий</span><span>Точность</span><span></span></div>${skillsHTML}
        <div class="note">Точность: ответ с первой попытки = 100%, со второй = 50%.</div>
      </div>
      <div class="card"><h3>Последние миссии</h3><div class="history">${hist}</div></div>
      <div class="card"><h3>Общий уровень</h3>
        <div class="note">Звание: ${Difficulty.rank(S.dl).emoji} ${Difficulty.rank(S.dl).name}. Общая сложность ${Math.round(S.dl.global * 100)}%. Она растёт после каждого верного ответа и падает после ошибок; темы ниже — отклонения от неё.</div>
        <div class="lvl-btns" id="global-btns"><button data-d="0.15">Легко</button><button data-d="0.4">Средне</button><button data-d="0.65">Трудно</button><button data-d="0.9">Очень</button></div>
      </div>
      <div class="card"><h3>Темы и сложность</h3>
        <div class="note">Галочка включает тему. Полоска — текущая сложность 0–100%, она сама растёт после верных ответов и падает после ошибок. Кнопки: Л — легко, С — средне, Т — трудно.</div>${levelsHTML}
      </div>
      <div class="card"><h3>Настройки</h3>
        <div class="toggle"><label><input type="checkbox" id="set-adaptive" ${S.settings.adaptive ? 'checked' : ''}> Автоподбор сложности</label></div>
        <div class="toggle"><label><input type="checkbox" id="set-voice" ${S.settings.voice ? 'checked' : ''}> Озвучка заданий</label></div>
        <div class="toggle"><label><input type="checkbox" id="set-sound" ${S.settings.sound ? 'checked' : ''}> Звуки</label></div>
        <div class="note">Голос: ${Speech.voiceName() || (Speech.available() ? 'русский голос не найден, установи его в настройках Android (Синтез речи)' : 'браузер не поддерживает')}</div>
        <button class="big-btn small-btn" id="btn-voice-test">🔊 Проверить голос</button>
        <pre class="diag" id="voice-diag"></pre>
      </div>
      <div class="card"><h3>Опасная зона</h3>
        <button class="big-btn small-btn danger" id="btn-reset">Сбросить весь прогресс</button>
      </div>`;

    body.querySelectorAll('input[data-skill]').forEach(cb => cb.addEventListener('change', () => {
      S.settings.skills[cb.dataset.skill] = cb.checked; save();
    }));
    body.querySelectorAll('.lvl-btns').forEach(g => g.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const k = g.dataset.skill; Difficulty.set(S.dl, k, Number(b.dataset.d)); save();
      const pct = Math.round(Difficulty.effective(S.dl, k) * 100);
      body.querySelector(`.pct[data-pct="${k}"]`).textContent = pct + '%';
      g.parentElement.querySelector('.bar.diff i').style.width = pct + '%';
    })));
    $('global-btns').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { Difficulty.setGlobal(S.dl, Number(b.dataset.d)); save(); renderParent(); }));
    const showDiag = () => {
      const st = Speech.status();
      $('voice-diag').textContent = Object.entries(st).map(([k, v]) => `${k}: ${v}`).join('\n');
    };
    showDiag();
    $('btn-voice-test').addEventListener('click', () => {
      Speech.setEnabled(true);
      Speech.say('Привет! Я Зум. Если ты меня слышишь, озвучка работает.', { interrupt: true });
      setTimeout(showDiag, 300); setTimeout(showDiag, 1500); setTimeout(showDiag, 4000);
    });
    $('set-adaptive').addEventListener('change', e => { S.settings.adaptive = e.target.checked; save(); });
    $('set-voice').addEventListener('change', e => { S.settings.voice = e.target.checked; Speech.setEnabled(S.settings.voice); save(); });
    $('set-sound').addEventListener('change', e => { S.settings.sound = e.target.checked; save(); });
    $('btn-reset').addEventListener('click', () => {
      if (confirm('Точно сбросить звёзды, планеты, наклейки и статистику?')) { S = defaultState(); Speech.setEnabled(S.settings.voice); save(); renderParent(); }
    });
  }

  // ---------- события ----------
  $('btn-start').addEventListener('click', () => { audio(); SFX.tap(); startMission(currentPlanet()); });
  $('btn-go').addEventListener('click', () => { Speech.stop(); SFX.launch(); beginTasks(); });
  $('btn-intro-back').addEventListener('click', () => { Speech.stop(); M = null; renderHome(); show('home'); });
  $('btn-quit').addEventListener('click', () => { Speech.stop(); M = null; renderHome(); show('home'); });
  $('btn-speak').addEventListener('click', () => { if (M) speak(M.tasks[M.idx].say, 'now'); });
  $('btn-next').addEventListener('click', () => { SFX.tap(); startMission(currentPlanet()); });
  $('btn-home').addEventListener('click', () => { renderHome(); show('home'); });
  $('btn-album').addEventListener('click', () => { SFX.tap(); renderAlbum(); show('album'); });
  $('btn-album-back').addEventListener('click', () => { renderHome(); show('home'); });
  $('btn-parent-back').addEventListener('click', () => { renderHome(); show('home'); });
  $('gate-cancel').addEventListener('click', () => { $('gate').hidden = true; });
  $('gate-ok').addEventListener('click', () => {
    if (Number($('gate-input').value) === gateAnswer) { $('gate').hidden = true; renderParent(); show('parent'); }
    else { $('gate-input').value = ''; $('gate-input').classList.add('shake'); setTimeout(() => $('gate-input').classList.remove('shake'), 400); }
  });
  $('gate-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('gate-ok').click(); });

  (function () {
    const g = $('btn-gear'); let timer = null;
    const start = (e) => { e.preventDefault(); clearTimeout(timer); timer = setTimeout(() => { timer = null; openGate(); }, 1200); };
    const stop = () => { if (timer) { clearTimeout(timer); timer = null; speak('Удерживай кнопку подольше. Это для родителей.', 'low'); } };
    g.addEventListener('pointerdown', start);
    g.addEventListener('pointerup', stop); g.addEventListener('pointerleave', stop); g.addEventListener('pointercancel', stop);
    g.addEventListener('contextmenu', e => e.preventDefault());
  })();

  document.addEventListener('pointerdown', () => audio(), { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) Speech.stop(); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  setInterval(() => {
    if (!$('home').classList.contains('active') || document.hidden) return;
    const c = document.createElement('div'); c.className = 'comet'; c.textContent = '☄️';
    c.style.top = 10 + Math.random() * 40 + '%'; document.body.appendChild(c);
    setTimeout(() => c.remove(), 2600);
  }, 7000);
  renderHome();
  show('home');
  window.__cosmo = { get state() { return S; }, get mission() { return M; }, startMission, beginTasks, T };
})();
