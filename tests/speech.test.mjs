import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// ---------- мок Web Speech API ----------
class FakeUtterance {
  constructor(text) {
    this.text = text; this.lang = ''; this.rate = 1; this.pitch = 1; this.voice = null;
    this.onstart = null; this.onend = null; this.onerror = null;
  }
  start() { this.onstart && this.onstart({ type: 'start' }); }
  end() { this.onend && this.onend({ type: 'end' }); }
  error(err) { this.onerror && this.onerror({ type: 'error', error: err || 'synthesis-failed' }); }
}

function installMock(voices) {
  const synth = {
    spoken: [],
    cancelCalls: 0,
    paused: false,
    speaking: false,
    pending: false,
    listeners: {},
    voices: voices || [
      { name: 'Microsoft David', lang: 'en-US' },
      { name: 'Milena', lang: 'ru-RU' },
      { name: 'Google русский', lang: 'ru-RU' },
    ],
    speak(u) { this.spoken.push(u); this.speaking = true; },
    cancel() { this.cancelCalls++; this.speaking = false; },
    resume() { this.paused = false; },
    getVoices() { return this.voices; },
    addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
    fire(ev) { (this.listeners[ev] || []).forEach(fn => fn()); },
  };
  globalThis.speechSynthesis = synth;
  globalThis.SpeechSynthesisUtterance = FakeUtterance;
  globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance };
  return synth;
}
function removeMock() {
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.window;
}

const SpeechModule = require('../js/speech.js');
// Каждый тест — свежий экземпляр очереди.
function fresh(opts) {
  const S = SpeechModule.create();
  S.init(Object.assign({ lang: 'ru-RU', rate: 0.92, pitch: 1.05 }, opts || {}));
  return S;
}

// ---------- тесты ----------

test('в node без speechSynthesis: available() false, say() no-op', () => {
  removeMock();
  const S = SpeechModule.create();
  S.init();
  assert.equal(S.available(), false);
  assert.equal(S.say('Привет'), false);
  assert.equal(S.voiceName(), null);
  assert.doesNotThrow(() => S.stop());
  assert.doesNotThrow(() => S.setEnabled(false));
  assert.doesNotThrow(() => S.onSpeaking(() => {}));
});

test('(5) выбирается русский голос, предпочтение Google', () => {
  const synth = installMock();
  const S = fresh();
  assert.equal(S.available(), true);
  assert.equal(S.voiceName(), 'Google русский');
  // voiceschanged переизбирает голос
  synth.voices = [{ name: 'Microsoft David', lang: 'en-US' }, { name: 'Milena', lang: 'ru-RU' }];
  synth.fire('voiceschanged');
  assert.equal(S.voiceName(), 'Milena');
  // нет русских → null
  synth.voices = [{ name: 'Microsoft David', lang: 'en-US' }];
  synth.fire('voiceschanged');
  assert.equal(S.voiceName(), null);
  removeMock();
});

test('utterance получает lang/rate/pitch/voice из init', () => {
  const synth = installMock();
  const S = fresh({ rate: 0.8, pitch: 1.2 });
  S.say('Привет.');
  const u = synth.spoken[0];
  assert.equal(u.lang, 'ru-RU');
  assert.equal(u.rate, 0.8);
  assert.equal(u.pitch, 1.2);
  assert.equal(u.voice.name, 'Google русский');
  removeMock();
});

test('(1) две say() подряд — вторая стартует только после onend первой', () => {
  const synth = installMock();
  const S = fresh();
  S.say('Первая фраза.');
  S.say('Вторая фраза.');
  assert.equal(synth.spoken.length, 1, 'говорится только первая');
  assert.equal(synth.spoken[0].text, 'Первая фраза.');
  assert.equal(synth.cancelCalls, 0, 'cancel не вызывался — ничего не обрываем');
  synth.spoken[0].start();
  assert.equal(synth.spoken.length, 1, 'onstart не запускает следующую');
  synth.spoken[0].end();
  assert.equal(synth.spoken.length, 2, 'после onend стартовала вторая');
  assert.equal(synth.spoken[1].text, 'Вторая фраза.');
  removeMock();
});

test('onerror предыдущей тоже продвигает очередь', () => {
  const synth = installMock();
  const S = fresh();
  S.say('Раз.');
  S.say('Два.');
  synth.spoken[0].error('synthesis-failed');
  assert.equal(synth.spoken.length, 2);
  assert.equal(synth.spoken[1].text, 'Два.');
  removeMock();
});

test('(2) say с interrupt: cancel вызван, очередь очищена, новая фраза стартует после паузы', async () => {
  const synth = installMock();
  const S = fresh();
  S.say('Старая фраза.');
  S.say('Ещё одна старая.');
  synth.spoken[0].start();
  S.say('Новое задание!', { interrupt: true });
  assert.equal(synth.cancelCalls, 1, 'cancel вызван');
  assert.equal(synth.spoken.length, 1, 'новая фраза не произнесена сразу после cancel (пауза)');
  assert.equal(S.pending(), 1, 'в очереди только новая фраза');
  // устаревший onend от обрезанной фразы ничего не ломает
  synth.spoken[0].end();
  assert.equal(synth.spoken.length, 1);
  await sleep(50);
  assert.equal(synth.spoken.length, 1, 'через 50 мс всё ещё ждём');
  await sleep(120);
  assert.equal(synth.spoken.length, 2, 'после ~120 мс новая фраза стартовала');
  assert.equal(synth.spoken[1].text, 'Новое задание!');
  // старые фразы из очереди не всплыли
  synth.spoken[1].end();
  assert.equal(synth.spoken.length, 2);
  assert.equal(S.pending(), 0);
  removeMock();
});

test('(2b) interrupt во время паузы: вторая interrupt-фраза побеждает, старая не стартует', async () => {
  const synth = installMock();
  const S = fresh();
  S.say('А.');
  S.say('Б.', { interrupt: true });
  S.say('В.', { interrupt: true });
  await sleep(200);
  assert.equal(synth.spoken.length, 2);
  assert.equal(synth.spoken[1].text, 'В.');
  removeMock();
});

test('(3) priority low отбрасывается при непустой очереди, но говорится при пустой', () => {
  const synth = installMock();
  const S = fresh();
  S.say('Задание.');            // текущая
  S.say('Ещё что-то.');         // ожидает в очереди
  assert.equal(S.say('Молодец!', { priority: 'low' }), false, 'отброшена');
  assert.equal(S.pending(), 2);
  synth.spoken[0].end();
  synth.spoken[1].end();
  assert.equal(S.pending(), 0);
  assert.equal(S.say('Молодец!', { priority: 'low' }), true, 'при пустой очереди говорится');
  assert.equal(synth.spoken[2].text, 'Молодец!');
  // low при говорящей текущей, но пустой очереди — ставится в хвост
  S.say('Ура!', { priority: 'low' });
  assert.equal(S.pending(), 2);
  removeMock();
});

test('(4) длинный текст из 3 предложений даёт 3 utterance по очереди', () => {
  const synth = installMock();
  const S = fresh();
  S.say('Летим на планету Марс! Там красные пустыни и высокие горы. Готов к старту?');
  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.spoken[0].text, 'Летим на планету Марс!');
  synth.spoken[0].end();
  assert.equal(synth.spoken[1].text, 'Там красные пустыни и высокие горы.');
  synth.spoken[1].end();
  assert.equal(synth.spoken[2].text, 'Готов к старту?');
  synth.spoken[2].end();
  assert.equal(synth.spoken.length, 3);
  assert.equal(S.pending(), 0);
  removeMock();
});

test('splitText: очень длинное предложение режется по запятым, многоточие внутри фразы не рвёт', () => {
  const S = SpeechModule.create();
  const long = Array.from({ length: 12 }, (_, i) => `слово номер ${i} и ещё немного текста`).join(', ') + '.';
  const parts = S.splitText(long);
  assert.ok(parts.length > 1);
  assert.ok(parts.every(p => p.length <= 160));
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), long);
  assert.deepEqual(S.splitText('А потом… домой? Да.'), ['А потом… домой?', 'Да.']);
  assert.deepEqual(S.splitText('   '), []);
  assert.deepEqual(S.splitText(null), []);
});

test('(6) страховочный таймер продвигает очередь, если onend не пришёл', () => {
  const synth = installMock();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const S = fresh();
    const text = 'Фраза без onend.'; // 16 символов → 16*90+2000 = 3440 мс
    S.say(text);
    S.say('Следующая.');
    assert.equal(synth.spoken.length, 1);
    mock.timers.tick(text.length * 90 + 2000 - 1);
    assert.equal(synth.spoken.length, 1, 'до истечения таймера ждём');
    mock.timers.tick(1);
    assert.equal(synth.spoken.length, 2, 'таймер сработал — говорим следующую');
    assert.equal(synth.spoken[1].text, 'Следующая.');
    // запоздалый onend первой не трогает вторую
    synth.spoken[0].end();
    assert.equal(synth.spoken.length, 2);
    assert.equal(S.pending(), 1);
  } finally {
    mock.timers.reset();
    removeMock();
  }
});

test('(7) setEnabled(false) → speak не вызывается; включение обратно работает', () => {
  const synth = installMock();
  const S = fresh();
  const calls = [];
  S.onSpeaking(f => calls.push(f));
  S.setEnabled(false);
  assert.equal(S.isEnabled(), false);
  assert.equal(S.say('Привет.'), false);
  assert.equal(synth.spoken.length, 0);
  assert.deepEqual(calls, []);
  S.setEnabled(true);
  assert.equal(S.say('Привет.'), true);
  assert.equal(synth.spoken.length, 1);
  // выключение во время речи — останавливает и чистит очередь
  S.say('Ещё.');
  const before = synth.cancelCalls;
  S.setEnabled(false);
  assert.equal(synth.cancelCalls, before + 1, 'cancel вызван при выключении');
  assert.equal(S.pending(), 0);
  removeMock();
});

test('(8) onSpeaking: true при старте, false когда очередь опустела', () => {
  const synth = installMock();
  const S = fresh();
  const calls = [];
  S.onSpeaking(f => calls.push(f));
  S.onSpeaking(() => { throw new Error('плохой колбэк'); }); // не должен ломать очередь
  S.say('Раз. Два.');
  assert.deepEqual(calls, [], 'до onstart ничего');
  synth.spoken[0].start();
  assert.deepEqual(calls, [true]);
  synth.spoken[0].end();
  assert.deepEqual(calls, [true], 'между кусками false не приходит');
  synth.spoken[1].start();
  assert.deepEqual(calls, [true]);
  synth.spoken[1].end();
  assert.deepEqual(calls, [true, false]);
  // stop() во время речи → false
  S.say('Три.');
  synth.spoken[2].start();
  S.stop();
  assert.deepEqual(calls, [true, false, true, false]);
  removeMock();
});

test('отписка от onSpeaking', () => {
  const synth = installMock();
  const S = fresh();
  const calls = [];
  const off = S.onSpeaking(f => calls.push(f));
  off();
  S.say('Раз.');
  synth.spoken[0].start();
  synth.spoken[0].end();
  assert.deepEqual(calls, []);
  removeMock();
});

test('исключения speechSynthesis не вылетают наружу', () => {
  const synth = installMock();
  synth.speak = () => { throw new Error('boom'); };
  synth.cancel = () => { throw new Error('boom'); };
  const S = fresh();
  assert.doesNotThrow(() => S.say('Раз. Два.'));
  assert.doesNotThrow(() => S.stop());
  assert.equal(S.pending(), 0);
  removeMock();
});
