/* Самопроверка интерфейса в Chromium (Playwright). Не входит в CI: запускается руками,
   когда меняется вёрстка или сценарий задания.

   node tools/ui-check.mjs [--url http://127.0.0.1:8765/] [--size 360x560] [--shots] [--skill count] [--d 0.5]

   Для каждого навыка × сложности (0 / 0.5 / 1) на мобильном вьюпорте проверяет:
   - кнопки вариантов, сцена, вопрос и подсказка видны (внутри экрана, не обрезаны overflow);
   - озвученный текст совпадает с заданием (мок speechSynthesis записывает фразы);
   - после первой ошибки режим «вместе» работает: все цели видны и попадают под палец,
     после прохода варианты снова активны, правильный ответ принимается;
   - лёгкие сценарии: верный ответ с первой попытки, урок перед заданием.
   Выход: список проблем; код возврата 1, если проблемы есть. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium } = pw;

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const URL = opt('url', 'http://127.0.0.1:8765/');
const [VW, VH] = opt('size', '360x560').split('x').map(Number);
const SHOTS = args.includes('--shots');
const ONLY_SKILL = opt('skill', null);
const ONLY_D = opt('d', null);
const SHOT_DIR = opt('shots-dir', '/tmp/claude-0/ui-shots');
if (SHOTS) fs.mkdirSync(SHOT_DIR, { recursive: true });

const problems = [];
const note = (ctx, msg) => { problems.push(`${ctx}: ${msg}`); };

// Мок Web Speech API: фразы начинаются через 30 мс, длятся 20 мс на символ; всё пишется в window.__spoken
const SPEECH_MOCK = `
(() => {
  const spoken = []; window.__spoken = spoken;
  let cur = null;
  class U { constructor(t) { this.text = t; this.lang = ''; this.rate = 1; this.pitch = 1; this.voice = null; } }
  const synth = {
    speaking: false, pending: false, paused: false,
    getVoices() { return [{ name: 'Google русский', lang: 'ru-RU' }]; },
    addEventListener() {}, resume() {},
    speak(u) {
      spoken.push({ text: u.text, t: Date.now() });
      cur = u; synth.speaking = true;
      setTimeout(() => { if (cur === u && u.onstart) u.onstart({}); }, 30);
      setTimeout(() => { if (cur === u) { synth.speaking = false; cur = null; u.onend && u.onend({}); } }, 30 + u.text.length * 20);
    },
    cancel() { const u = cur; cur = null; synth.speaking = false; if (u) setTimeout(() => u.onerror && u.onerror({ error: 'interrupted' }), 0); },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = U;
  window.__errors = [];
  window.addEventListener('error', e => window.__errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', e => window.__errors.push('rejection: ' + String(e.reason)));
})();`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' });
const page = await context.newPage();
await page.addInitScript(SPEECH_MOCK);
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
await page.goto(URL, { waitUntil: 'load' });
await page.clock.install();
await page.evaluate(() => { window.__cosmo.state.settings.name = ''; window.__cosmo.save(); });

const SKILLS = await page.evaluate(() => Object.keys(window.__cosmo.T.SKILLS));
const DS = ONLY_D != null ? [Number(ONLY_D)] : [0, 0.5, 1];

// ---------- помощники в странице ----------
async function run(ms) { await page.clock.runFor(ms); }
// Дождаться конца конечных CSS-анимаций (slide-in, pop-in, transition) — они идут в реальном времени, не по page.clock
async function settle() {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => {
    const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
    return a.playState === 'running' && t.iterations !== Infinity;
  }).map(a => a.finished.catch(() => {}))));
  await page.waitForTimeout(260); // transition opacity .2s + кадр
}
async function flush() { await run(50); await settle(); }
const lastSpoken = () => page.evaluate(() => { const s = window.__spoken; return s.length ? s[s.length - 1].text : ''; });
const spokenSince = (n) => page.evaluate(n => window.__spoken.slice(n).map(x => x.text), n);
const spokenCount = () => page.evaluate(() => window.__spoken.length);
const mission = () => page.evaluate(() => { const M = window.__cosmo.mission; return M ? { idx: M.idx, busy: M.busy, guided: M.guided, attempts: M.attempts, picked: M.picked, stars: M.stars, results: M.results } : null; });

// Поставить задание и показать экран игры
async function mountTask(skill, d, lesson) {
  return page.evaluate(([skill, d, lesson]) => {
    const C = window.__cosmo;
    C.startMission(0);
    const t = Object.assign(C.T.generate(skill, d), { slot: 'core', lesson: !!lesson });
    C.mission.tasks[0] = t;
    C.show('game');
    C.renderTask();
    return { prompt: t.prompt, say: t.say, sayShort: t.sayShort, kind: t.kind, answer: t.answer, display: t.display, guide: t.guide, afterHideSay: t.afterHideSay, afterShowSay: t.afterShowSay, options: t.options, skill: t.skill, hint: t.hint };
  }, [skill, d, lesson]);
}

// Геометрия: все ли важные элементы внутри экрана и не обрезаны
async function layoutCheck(ctx) {
  const r = await page.evaluate(() => {
    const H = innerHeight, W = innerWidth;
    const out = [];
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const inView = (el, name, pad) => {
      const r = el.getBoundingClientRect();
      if (r.bottom > H + (pad || 0) + 0.5) out.push(`${name} выходит за низ экрана на ${Math.round(r.bottom - H)}px`);
      if (r.top < -0.5) out.push(`${name} выше экрана`);
      if (r.right > W + 0.5) out.push(`${name} выходит за правый край на ${Math.round(r.right - W)}px`);
      if (r.left < -0.5) out.push(`${name} левее экрана`);
    };
    const opts = [...document.querySelectorAll('#options .opt')].filter(vis);
    const optsBox = document.getElementById('options');
    if (!optsBox.hidden && !opts.length) out.push('нет видимых кнопок ответа');
    opts.forEach((b, i) => {
      inView(b, `кнопка ${i + 1}`);
      const r = b.getBoundingClientRect();
      if (r.height < 44) out.push(`кнопка ${i + 1} слишком низкая: ${Math.round(r.height)}px`);
      if (r.width < 40) out.push(`кнопка ${i + 1} слишком узкая: ${Math.round(r.width)}px`);
      // содержимое кнопки не должно вылезать наружу
      for (const ch of b.querySelectorAll('.objs, .obj, span')) {
        const c = ch.getBoundingClientRect();
        if (c.width && (c.right > r.right + 2 || c.left < r.left - 2 || c.bottom > r.bottom + 2 || c.top < r.top - 2)) { out.push(`содержимое кнопки ${i + 1} вылезает за её край`); break; }
      }
    });
    const stage = document.getElementById('stage');
    if (stage.style.display !== 'none') {
      inView(stage, 'сцена');
      // допуск 10px: бейджи-счётчики в режиме «вместе» выступают за предмет на 5–8px и попадают в scrollHeight, но лежат в padding сцены
      if (stage.scrollHeight > stage.clientHeight + 10) out.push(`сцена обрезана по высоте: содержимое ${stage.scrollHeight}px, место ${stage.clientHeight}px`);
      if (stage.scrollWidth > stage.clientWidth + 10) out.push(`сцена обрезана по ширине: содержимое ${stage.scrollWidth}px, место ${stage.clientWidth}px`);
      const sr = stage.getBoundingClientRect();
      for (const el of stage.querySelectorAll('.obj, .coin, .cell, .sh, .tank i, .die, .tenframe, svg, .story-num, .srocket, .ear')) {
        if (!vis(el)) continue;
        const c = el.getBoundingClientRect();
        if (c.bottom > sr.bottom + 1 || c.top < sr.top - 1 || c.right > sr.right + 1 || c.left < sr.left - 1) { out.push(`элемент сцены ${el.className || el.tagName} обрезан сценой`); break; }
      }
    }
    const prompt = document.getElementById('prompt');
    inView(prompt, 'вопрос');
    if (!prompt.textContent.trim()) out.push('пустой вопрос');
    const fb = document.getElementById('feedback'); inView(fb, 'строка отклика');
    const lesson = document.getElementById('lesson'); if (!lesson.hidden) inView(lesson, 'кнопка «Понятно»');
    const guide = document.getElementById('guide'); if (!guide.hidden) inView(guide, 'панель «вместе»');
    const screen = document.getElementById('game');
    if (screen.scrollHeight > screen.clientHeight + 2) out.push(`экран игры не влезает: ${screen.scrollHeight}px при ${screen.clientHeight}px`);
    return out;
  });
  for (const m of r) note(ctx, m);
  return r.length === 0;
}

// Попадает ли палец в элемент (центр элемента → elementFromPoint внутри него)
async function tappable(handle) {
  return handle.evaluate(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return { ok: false, why: `размер ${Math.round(r.width)}×${Math.round(r.height)}` };
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { ok: false, why: 'вне экрана' };
    const hit = document.elementFromPoint(x, y);
    if (!hit) return { ok: false, why: 'ничего под пальцем' };
    if (hit === el || el.contains(hit)) return { ok: true, w: r.width, h: r.height };
    return { ok: false, why: `перекрыт: ${hit.tagName.toLowerCase()}.${(hit.getAttribute('class') || '').split(' ')[0]}` };
  });
}
async function tap(handle) { await handle.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))); }

async function shot(name) { if (SHOTS) await page.screenshot({ path: path.join(SHOT_DIR, name.replace(/[^\w.-]+/g, '_') + '.png') }); }

// Дождаться, когда задание готово к ответу (варианты показаны, не busy)
async function waitReady(t) {
  const d = t.display;
  if (d.type === 'flash') await run(4000 + d.showMs + 300);
  else if (d.type === 'memory') await run(Math.max(d.showMs, 600 + t.say.length * 70 + 800) + 600);
  else if (d.type === 'simon') await run(4000 + d.seq.length * d.stepMs + 600);
  else await run(200);
  await settle(); // кнопки, показанные по таймеру, доигрывают анимацию появления
}

function wrongOption(t) {
  if (t.kind === 'choice') {
    const i = t.options.findIndex(o => o.value !== t.answer);
    return i;
  }
  if (t.kind === 'order') { const i = t.options.findIndex(o => o.value !== t.answer[0]); return i; }
  if (t.kind === 'sequence') { const i = t.options.findIndex(o => o.value !== t.answer[0]); return i; }
  return -1;
}
async function optByIndex(i) { return page.locator('#options .opt').nth(i).elementHandle(); }
async function optByValue(v) { return page.locator(`#options .opt[data-value="${String(v)}"]`).first().elementHandle(); }

// ---------- сценарии ----------
async function scenarioCorrect(skill, d) {
  const ctx = `${skill} d=${d} верный ответ`;
  const n0 = await spokenCount();
  const t = await mountTask(skill, d, false);
  await flush();
  await layoutCheck(ctx + ' (экран)');
  await shot(`${skill}_${d}_task`);
  // озвучка: сразу после показа — t.say
  const spoken = await spokenSince(n0);
  const expectedFirst = t.say;
  if (!spoken.includes(expectedFirst)) note(ctx, `озвучено «${spoken[spoken.length - 1] || ''}», а в задании «${expectedFirst}»`);
  await waitReady(t);
  if ((t.display.type === 'memory' || t.display.type === 'flash') && !(await spokenSince(n0)).includes(t.afterHideSay)) note(ctx, 'после скрытия не озвучен вопрос');
  if (t.display.type === 'simon' && !(await spokenSince(n0)).includes(t.afterShowSay)) note(ctx, 'после показа огней не озвучено «твой ход»');
  await layoutCheck(ctx + ' (готово к ответу)');
  const st = await mission();
  if (st.busy) note(ctx, 'задание заблокировано (busy) когда уже надо отвечать');
  // проверка, что все варианты можно нажать
  const opts = await page.locator('#options .opt').elementHandles();
  for (let i = 0; i < opts.length; i++) {
    const r = await tappable(opts[i]);
    if (!r.ok) note(ctx, `вариант ${i + 1} не нажимается: ${r.why}`);
  }
  if (t.kind === 'choice') {
    await tap(await optByValue(t.answer));
  } else if (t.kind === 'order') {
    for (const v of t.answer) { await tap(await optByValue(v)); await run(50); }
  } else {
    for (const v of t.answer) { await tap(await optByValue(v)); await run(50); }
  }
  await flush();
  const st2 = await mission();
  if (!st2 || st2.results[0] !== 2) note(ctx, `верный ответ не засчитан на 2 звезды: ${JSON.stringify(st2 && st2.results)}`);
  await run(4000);
  const st3 = await mission();
  if (!st3 || st3.idx !== 1) note(ctx, `после верного ответа не перешли к следующему заданию (idx=${st3 && st3.idx})`);
}

async function scenarioGuide(skill, d) {
  const ctx = `${skill} d=${d} режим «вместе»`;
  const t = await mountTask(skill, d, false);
  await flush();
  await waitReady(t);
  const wi = wrongOption(t);
  if (wi < 0) { note(ctx, 'не нашёл неверный вариант'); return; }
  const n0 = await spokenCount();
  await tap(await optByIndex(wi));
  await flush();
  const g = t.guide;
  let st = await mission();
  if (t.kind === 'order') {
    if (st.attempts !== 1) note(ctx, 'ошибка не засчитана');
    const hinted = await page.locator('#options .opt.next-hint').count();
    if (hinted !== 1) note(ctx, `после ошибки не подсвечено следующее число (next-hint: ${hinted})`);
    if (!(await spokenSince(n0)).includes(g.say)) note(ctx, `озвучено «${await lastSpoken()}», ожидалось «${g.say}»`);
    for (const v of t.answer) { await tap(await optByValue(v)); await run(50); }
    st = await mission();
    if (st.results[0] !== 1) note(ctx, `после подсказки порядок не засчитан на 1 звезду: ${JSON.stringify(st.results)}`);
    return;
  }
  // choice / sequence → startGuide
  const spokenNow = await spokenSince(n0);
  if (!spokenNow.some(s => s.endsWith(g.say))) note(ctx, `после ошибки озвучено «${spokenNow.join(' | ')}», ожидалось «…${g.say}»`);
  await layoutCheck(ctx + ' (панель)');
  await shot(`${skill}_${d}_guide`);
  const guideVisible = await page.evaluate(() => !document.getElementById('guide').hidden);
  if (!guideVisible) note(ctx, 'панель «вместе» не показана');
  const mode = g.mode;
  if (mode === 'count' || mode === 'sum' || mode === 'share') {
    const targets = await page.evaluate(sel => {
      const q = '#game ' + sel.split(',').map(s => s.trim()).join(', #game ');
      return [...document.querySelectorAll(q)].length;
    }, g.targets);
    let expected = null;
    if (mode === 'count') expected = (typeof t.answer === 'number' && !g.perGroup) ? t.answer - (g.start || 0) : null;
    if (mode === 'sum') expected = t.display.coins.length;
    if (mode === 'share') expected = t.display.n;
    if (!targets) note(ctx, `нет целей для тапов (${g.targets})`);
    else if (expected != null && targets !== expected) note(ctx, `целей ${targets}, а ожидалось ${expected} (${g.targets})`);
    const handles = await page.locator('#game ' + g.targets.split(',').map(s => s.trim()).join(', #game ')).elementHandles();
    let bad = 0, minSize = 1e9;
    for (const h of handles) {
      const r = await tappable(h);
      if (!r.ok) { bad++; if (bad <= 2) note(ctx, `цель не нажимается: ${r.why}`); }
      else minSize = Math.min(minSize, r.w, r.h);
    }
    if (handles.length && minSize < 22) note(ctx, `цели слишком мелкие для пальца: ${Math.round(minSize)}px`);
    // проходим
    for (const h of handles) { await tap(h); await run(120); }
    await flush();
    st = await mission();
    if (st.guided === true) note(ctx, `после всех тапов режим не завершён (guided=${st.guided}, целей ${handles.length})`);
    await run(600);
    if (!(await spokenSince(n0)).includes(g.doneSay)) note(ctx, `итоговая фраза не озвучена: ожидалось «${g.doneSay}», озвучено «${await lastSpoken()}»`);
    const guideText = await page.evaluate(() => document.getElementById('guide-text').textContent);
    if (guideText !== g.doneSay) note(ctx, `в панели «${guideText}», а озвучено «${g.doneSay}»`);
    await shot(`${skill}_${d}_guide_done`);
  } else if (mode === 'walk') {
    const sel = '#game ' + g.targets.split(',').map(s => s.trim()).join(', #game ');
    let handles = await page.locator(sel).elementHandles();
    if (g.reverse) handles = handles.slice().reverse();
    const pathH = handles.slice(0, g.upto);
    let minSize = 1e9;
    for (const h of pathH) {
      const r = await tappable(h);
      if (!r.ok) note(ctx, `ячейка дорожки не нажимается: ${r.why}`);
      else minSize = Math.min(minSize, r.w, r.h);
      await tap(h); await run(120);
    }
    if (pathH.length && minSize < 30) note(ctx, `ячейки мелкие: ${Math.round(minSize)}px`);
    await flush();
    st = await mission();
    if (st.guided === true) note(ctx, `после прохода дорожки режим не завершён (guided=${st.guided}, шагов ${pathH.length})`);
    await run(600);
    if (!(await spokenSince(n0)).includes(g.doneSay)) note(ctx, `итоговая фраза не озвучена: ожидалось «${g.doneSay}»`);
  } else if (mode === 'replay') {
    // показ ещё раз: ждём
    await run(12000);
  } else if (mode === 'show') {
    // ничего делать не надо
  }
  // когда можно нажимать ответ?
  let waited = 0;
  while (waited < 20000) {
    st = await mission();
    const blocked = await page.evaluate(() => document.getElementById('options').classList.contains('guided'));
    if (!st.guided && !blocked && !st.busy) break;
    await run(250); waited += 250;
  }
  st = await mission();
  if (st.guided || st.busy) { note(ctx, `варианты так и не вернулись (guided=${st.guided}, busy=${st.busy}) за ${waited} мс`); return; }
  if (waited > 3000) note(ctx, `варианты вернулись только через ${waited} мс после конца режима`);
  await settle();
  // кнопки видны и доступны
  const opts = await page.locator('#options .opt').elementHandles();
  for (let i = 0; i < opts.length; i++) {
    const isWrong = await opts[i].evaluate(b => b.classList.contains('wrong'));
    if (isWrong) continue;
    const op = await opts[i].evaluate(b => getComputedStyle(b).opacity);
    if (Number(op) < 0.5) note(ctx, `вариант ${i + 1} после режима остался тусклым (opacity ${op})`);
    const r = await tappable(opts[i]);
    if (!r.ok) note(ctx, `вариант ${i + 1} после режима не нажимается: ${r.why}`);
  }
  await layoutCheck(ctx + ' (после)');
  if (t.kind === 'choice') await tap(await optByValue(t.answer));
  else for (const v of t.answer) { await tap(await optByValue(v)); await run(60); }
  await flush();
  st = await mission();
  if (st.results[0] !== 1) note(ctx, `ответ после режима не засчитан на 1 звезду: ${JSON.stringify(st.results)} guided=${st.guided} busy=${st.busy}`);
  await run(4000);
  st = await mission();
  if (!st || st.idx !== 1) note(ctx, `после ответа не перешли дальше (idx=${st && st.idx})`);
}

async function scenarioLesson(skill) {
  const ctx = `${skill} урок`;
  const n0 = await spokenCount();
  const t = await mountTask(skill, 0, true);
  await flush();
  const lessonShown = await page.evaluate(() => !document.getElementById('lesson').hidden && document.getElementById('options').hidden);
  if (!lessonShown) note(ctx, 'урок не показан / варианты не спрятаны');
  const lessonText = await page.evaluate(k => window.__cosmo.T.LESSONS[k], skill);
  if (!(await spokenSince(n0)).some(s => s.endsWith(lessonText))) note(ctx, `урок не озвучен: «${await lastSpoken()}»`);
  const pt = await page.evaluate(() => document.getElementById('prompt').textContent);
  if (pt !== lessonText) note(ctx, 'текст урока в пузыре не совпадает с озвученным');
  await layoutCheck(ctx);
  await shot(`${skill}_lesson`);
  await page.locator('#btn-lesson-ok').evaluate(b => b.click());
  await flush();
  const after = await page.evaluate(() => ({ lesson: document.getElementById('lesson').hidden, prompt: document.getElementById('prompt').textContent }));
  if (!after.lesson) note(ctx, 'после «Понятно» урок не скрылся');
  if (after.prompt !== t.prompt) note(ctx, `после урока в пузыре «${after.prompt}», а задание «${t.prompt}»`);
  if (!(await spokenSince(n0)).includes(t.say)) note(ctx, `после урока не озвучено задание: «${await lastSpoken()}»`);
  await waitReady(t);
  const st = await mission();
  if (st.busy) note(ctx, 'после урока задание заблокировано');
}

// ---------- прогон ----------
const skills = ONLY_SKILL ? [ONLY_SKILL] : SKILLS;
let scenarios = 0;
for (const skill of skills) {
  for (const d of DS) {
    try { await scenarioCorrect(skill, d); scenarios++; } catch (e) { note(`${skill} d=${d} верный`, 'исключение: ' + e.message.split('\n')[0]); }
    try { await scenarioGuide(skill, d); scenarios++; } catch (e) { note(`${skill} d=${d} вместе`, 'исключение: ' + e.message.split('\n')[0]); }
  }
  try { await scenarioLesson(skill); scenarios++; } catch (e) { note(`${skill} урок`, 'исключение: ' + e.message.split('\n')[0]); }
  const errs = await page.evaluate(() => window.__errors.splice(0));
  for (const e of errs) note(skill, 'ошибка JS: ' + e);
}

// ---------- экраны вне задания ----------
async function screenCheck(id, ctx) {
  const r = await page.evaluate(id => {
    const out = [];
    const H = innerHeight, W = innerWidth;
    const s = document.getElementById(id);
    if (!s.classList.contains('active')) out.push('экран не активен');
    for (const b of s.querySelectorAll('button')) {
      const cs = getComputedStyle(b); if (cs.display === 'none' || b.hidden) continue;
      b.scrollIntoView({ block: 'nearest' });
      const r = b.getBoundingClientRect();
      if (!r.width) continue;
      if (r.bottom > H + .5 || r.top < -.5 || r.right > W + .5 || r.left < -.5) out.push(`кнопка «${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 20)}» вне экрана`);
    }
    return out;
  }, id);
  for (const m of r) note(ctx, m);
}
await page.evaluate(() => { window.__cosmo.renderHome(); window.__cosmo.show('home'); });
await flush(); await screenCheck('home', 'главный экран'); await shot('home');
await page.evaluate(() => window.__cosmo.startMission(0)); await flush(); await screenCheck('intro', 'интро планеты'); await shot('intro');
await page.evaluate(() => { const C = window.__cosmo; C.mission.stars = 13; C.mission.results = [2, 2, 2, 2, 1, 2, 1, 1]; C.mission.idx = 8; });
// результат миссии: вызываем через finishTask → проще смоделировать renderTask последнего и ответить; вместо этого прямой показ
await page.evaluate(() => { window.__cosmo.show('result'); });
await flush(); await screenCheck('result', 'результат'); await shot('result');
await page.evaluate(() => { window.__cosmo.renderParent(); window.__cosmo.show('parent'); });
await flush(); await screenCheck('parent', 'родительский раздел'); await shot('parent');

await browser.close();
console.log(`Сценариев: ${scenarios}, вьюпорт ${VW}×${VH}`);
if (problems.length) {
  console.log(`Проблем: ${problems.length}`);
  for (const p of problems) console.log(' - ' + p);
  process.exit(1);
} else console.log('Проблем не найдено');
