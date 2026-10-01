/* Озвучка: очередь фраз поверх Web Speech API (speechSynthesis).
   Самостоятельный модуль без зависимостей от app.js; экспортируется и в node (там available() → false).

   Зачем: в Android Chrome прямой cancel()+speak() обрывает предыдущую фразу, иногда «глотает» новую,
   а длинные utterance (>~15 с) обрываются. Здесь: FIFO-очередь, одна utterance за раз, деление
   длинного текста на куски, повтор speak(), если синтезатор не начал говорить, страховочный таймер
   на случай, если onend не пришёл. Короткие фразы (≤180 символов) — одной utterance, cancel()+speak()
   без задержки: именно так работало на телефоне до появления очереди.

   API (объект Speech):
     init({ lang, rate, pitch })      — выбрать русский голос, подписаться на voiceschanged
     say(text, { interrupt, priority }) — поставить фразу в очередь
         interrupt: true   — остановить текущую, очистить очередь, затем говорить (новое задание)
         priority: 'low'   — отбросить, если в очереди уже есть ожидающие фразы (короткая похвала)
         по умолчанию      — добавить в хвост очереди и произнести после текущей
     stop()                            — остановить всё, очистить очередь
     setEnabled(bool) / isEnabled()
     onSpeaking(fn)                    — fn(true) при старте реальной речи, fn(false) когда очередь опустела;
                                         возвращает функцию отписки
     voiceName()                       — имя выбранного голоса или null
     available()                       — есть ли speechSynthesis
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Speech = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WATCHDOG_PER_CHAR_MS = 90; // страховочный таймер: длина текста * 90 мс + 2000 мс
  const WATCHDOG_BASE_MS = 2000;
  const MAX_UTTER_CHARS = 180;     // короткие фразы говорим одной utterance; длиннее — режем по предложениям
  const MAX_CHUNK_CHARS = 160;     // предложения длиннее режем ещё и по запятым
  const RETRY_AFTER_MS = 900;      // если синтезатор не начал говорить — повторить speak() один раз

  function globalObj() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof window !== 'undefined') return window;
    if (typeof self !== 'undefined') return self;
    return {};
  }

  // Ищем synth лениво при каждом обращении: в тестах мок ставится после require,
  // а в браузере объект может появиться/исчезнуть.
  function getSynth() {
    try {
      const g = globalObj();
      if (g.speechSynthesis) return g.speechSynthesis;
      if (g.window && g.window.speechSynthesis) return g.window.speechSynthesis;
    } catch (e) { /* ignore */ }
    return null;
  }

  function getUtteranceCtor() {
    try {
      const g = globalObj();
      if (typeof g.SpeechSynthesisUtterance === 'function') return g.SpeechSynthesisUtterance;
      if (g.window && typeof g.window.SpeechSynthesisUtterance === 'function') return g.window.SpeechSynthesisUtterance;
    } catch (e) { /* ignore */ }
    return null;
  }

  // Делим текст на предложения; слишком длинные предложения — ещё по запятым/точкам с запятой.
  function splitText(text) {
    const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!s) return [];
    // граница предложения: знак конца + пробел + не строчная буква (чтобы «потом… домой» не рвать)
    const sentences = s.split(/(?<=[.!?…])\s+(?![a-zа-яё])/).map(x => x.trim()).filter(Boolean);
    if (s.length <= MAX_UTTER_CHARS) return [s];
    const pieces = [];
    for (const sent of sentences) {
      if (sent.length <= MAX_CHUNK_CHARS) { pieces.push(sent); continue; }
      let buf = '';
      for (const part of sent.split(/(?<=[,;:])\s+/)) {
        if (buf && (buf + ' ' + part).length > MAX_CHUNK_CHARS) { pieces.push(buf); buf = part; }
        else buf = buf ? buf + ' ' + part : part;
      }
      if (buf) pieces.push(buf);
    }
    // склеиваем предложения в куски до MAX_UTTER_CHARS — меньше переходов между utterance
    const out = [];
    let acc = '';
    for (const pc of pieces) {
      if (acc && (acc + ' ' + pc).length > MAX_UTTER_CHARS) { out.push(acc); acc = pc; }
      else acc = acc ? acc + ' ' + pc : pc;
    }
    if (acc) out.push(acc);
    return out;
  }

  function create() {
    const cfg = { lang: 'ru-RU', rate: 0.92, pitch: 1.05 };
    let voice = null;
    let enabled = true;
    let queue = [];          // ожидающие куски текста
    let current = null;      // utterance, которая сейчас говорится
    let watchdog = null;     // страховочный таймер текущей utterance
    let retryTimer = null;   // проверка, что синтезатор реально начал говорить
    let speaking = false;    // что мы сообщили слушателям onSpeaking
    const listeners = [];
    const keep = [];         // ссылки на utterance: Chrome теряет onend, если объект собрал GC
    const diag = { lastText: '', lastEvent: '', lastError: '', spoken: 0, retries: 0 };

    function available() { return !!getSynth(); }

    function setSpeaking(flag) {
      flag = !!flag;
      if (flag === speaking) return;
      speaking = flag;
      for (const fn of listeners.slice()) {
        try { fn(flag); } catch (e) { /* колбэк не должен ломать очередь */ }
      }
    }

    function pickVoice() {
      const synth = getSynth();
      if (!synth) { voice = null; return null; }
      let vs = [];
      try { vs = synth.getVoices() || []; } catch (e) { vs = []; }
      const isRu = v => v && /^ru/i.test(v.lang || '');
      voice = vs.find(v => isRu(v) && /google|yandex|premium|enhanced/i.test(v.name || ''))
        || vs.find(isRu) || null;
      return voice;
    }

    function init(opts) {
      if (opts && typeof opts === 'object') {
        if (opts.lang) cfg.lang = String(opts.lang);
        if (typeof opts.rate === 'number') cfg.rate = opts.rate;
        if (typeof opts.pitch === 'number') cfg.pitch = opts.pitch;
      }
      const synth = getSynth();
      if (!synth) return api;
      pickVoice();
      try {
        if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', pickVoice);
        else synth.onvoiceschanged = pickVoice;
      } catch (e) {
        try { synth.onvoiceschanged = pickVoice; } catch (e2) { /* ignore */ }
      }
      return api;
    }

    function clearWatchdog() {
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    }
    function clearRetry() {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    }

    // Завершение utterance (onend / onerror / страховочный таймер). Чужие/устаревшие — игнорируем.
    function finish(u) {
      if (!current || (u && u !== current)) return;
      clearWatchdog();
      clearRetry();
      current = null;
      scheduleNext();
    }

    function makeUtter(Utter, text, started) {
      const u = new Utter(text);
      u.lang = cfg.lang;
      u.rate = cfg.rate;
      u.pitch = cfg.pitch;
      if (voice) u.voice = voice;
      u.onstart = () => { if (u === current) { started.v = true; diag.lastEvent = 'start'; diag.spoken++; setSpeaking(true); } };
      u.onend = () => { if (u === current) diag.lastEvent = 'end'; finish(u); };
      u.onerror = (e) => { if (u === current) { diag.lastEvent = 'error'; diag.lastError = (e && e.error) || 'error'; } finish(u); };
      keep.push(u); if (keep.length > 8) keep.shift();
      return u;
    }

    function startNext() {
      if (current) return;
      if (!queue.length) { setSpeaking(false); return; }
      const synth = getSynth();
      const Utter = getUtteranceCtor();
      if (!synth || !Utter) { queue = []; setSpeaking(false); return; }

      const text = queue.shift();
      const started = { v: false };
      let u;
      try { u = makeUtter(Utter, text, started); } catch (e) { diag.lastError = 'ctor'; scheduleNext(); return; }
      current = u;
      diag.lastText = text; diag.lastEvent = 'speak';
      clearWatchdog();
      watchdog = setTimeout(() => finish(u), text.length * WATCHDOG_PER_CHAR_MS + WATCHDOG_BASE_MS);
      try {
        if (synth.paused && typeof synth.resume === 'function') synth.resume();
        synth.speak(u);
      } catch (e) { diag.lastError = 'speak:' + (e && e.message); finish(u); return; }
      // Android Chrome иногда «глотает» speak() сразу после cancel(): если речь не началась — повторяем один раз
      clearRetry();
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (u !== current || started.v) return;
        // onstart не пришёл: Android может держать speaking=true на «проглоченной» фразе — всё равно повторяем
        diag.retries++; diag.lastEvent = 'retry';
        let u2;
        try { synth.cancel(); u2 = makeUtter(Utter, text, started); } catch (e) { finish(u); return; }
        current = u2;
        clearWatchdog();
        watchdog = setTimeout(() => finish(u2), text.length * WATCHDOG_PER_CHAR_MS + WATCHDOG_BASE_MS);
        try { synth.speak(u2); } catch (e) { diag.lastError = 'speak2:' + (e && e.message); finish(u2); return; }
        // если и повтор не стартовал — не держим очередь, идём дальше
        retryTimer = setTimeout(() => { retryTimer = null; if (u2 === current && !started.v) { diag.lastEvent = 'skip'; try { synth.cancel(); } catch (e) { /* ignore */ } finish(u2); } }, RETRY_AFTER_MS * 2);
      }, RETRY_AFTER_MS);
    }

    function scheduleNext() {
      if (current) return;
      if (!queue.length) { setSpeaking(false); return; }
      startNext();
    }

    function clearPending() { queue = []; }

    function stop() {
      clearRetry();
      clearWatchdog();
      queue = [];
      current = null;
      const synth = getSynth();
      if (synth) { try { synth.cancel(); } catch (e) { /* ignore */ } }
      setSpeaking(false);
    }

    function status() {
      const synth = getSynth();
      let vs = [];
      try { vs = synth ? (synth.getVoices() || []) : []; } catch (e) { vs = []; }
      const st = { available: !!synth, enabled, voice: voiceName(), ruVoices: vs.filter(v => /^ru/i.test(v.lang || '')).length,
        allVoices: vs.length, queue: queue.length, current: !!current, ...diag };
      try { st.synthSpeaking = !!synth.speaking; st.synthPending = !!synth.pending; st.synthPaused = !!synth.paused; } catch (e) { /* ignore */ }
      return st;
    }

    function say(text, opts) {
      opts = opts || {};
      if (!enabled || !available()) return false;
      const chunks = splitText(text);
      if (!chunks.length) return false;
      if (opts.interrupt) {
        stop();
      } else if (opts.priority === 'low' && queue.length) {
        return false; // уже есть ожидающие фразы — похвалу пропускаем
      }
      queue.push.apply(queue, chunks);
      scheduleNext();
      return true;
    }

    function setEnabled(flag) {
      enabled = !!flag;
      if (!enabled) stop();
    }
    function isEnabled() { return enabled; }

    function onSpeaking(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }

    function voiceName() { return voice ? (voice.name || null) : null; }

    const api = {
      init, say, stop, clearPending, setEnabled, isEnabled, onSpeaking, voiceName, available, status,
      isSpeaking: () => speaking,
      pending: () => queue.length + (current ? 1 : 0),
      splitText,
      create,
    };
    return api;
  }

  return create();
});
