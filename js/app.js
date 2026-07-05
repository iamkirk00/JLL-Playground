// app.js — paper stage, chat orchestration, editors, sheet UI.
import { SketchPenguin, PENGUIN_CONFIGS, EMOTES } from './sketch-penguin.js';
import { buildSystemPrompt, callClaude, testKey, parseEmote, scriptedReply, scriptedBanter } from './brain.js';
import { loadCharacters, saveCharacters, resetCharacters, loadSettings, saveSettings, DEFAULT_CHARACTERS } from '../data/personas.js';
import { generateSheet, renderSingle, downloadCanvas } from './sheet.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let characters = loadCharacters();
let settings = loadSettings();

// ============================================================ paper stage
const stageWrap = $('#stage-wrap');
const penguins = {
  npc: new SketchPenguin(PENGUIN_CONFIGS.npc, $('#mount-npc')),
  cap: new SketchPenguin(PENGUIN_CONFIGS.cap, $('#mount-cap')),
};
// entrance: waddle in from the wings
penguins.npc.x = -18;
penguins.cap.x = 118;
penguins.npc.walkTo(30);
penguins.cap.walkTo(70);
let greeted = false;

const mounts = { npc: $('#mount-npc'), cap: $('#mount-cap') };
const shadows = { npc: $('#shadow-npc'), cap: $('#shadow-cap') };

// speech bubbles pinned above heads
const bubbles = { npc: $('#bubble-npc'), cap: $('#bubble-cap') };
function placeBubbles() {
  const wrapRect = stageWrap.getBoundingClientRect();
  for (const id of ['npc', 'cap']) {
    const el = bubbles[id];
    if (el.classList.contains('hidden')) continue;
    const r = mounts[id].getBoundingClientRect();
    el.style.left = `${r.left + r.width / 2 - wrapRect.left}px`;
    el.style.top = `${r.top - wrapRect.top + r.height * 0.02}px`;
  }
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;
  for (const id of ['npc', 'cap']) {
    const p = penguins[id];
    p.update(dt, t);
    mounts[id].style.left = `${p.x}%`;
    shadows[id].style.left = `${p.x}%`;
  }
  if (!greeted && !penguins.cap.walk && !penguins.npc.walk) {
    greeted = true;
    penguins.cap.play('wave', 2.4);
    speak('cap', "Hey! Welcome to the Rookery. Ask us anything — or just say hi.", 5200);
    setTimeout(() => { penguins.npc.play('shrug', 2); speak('npc', "I was told there would be fish.", 4200); }, 2600);
  }
  placeBubbles();
}
requestAnimationFrame(loop);

// ============================================================ speaking
const bubbleTimers = {};
function speak(charId, text, holdMs = null) {
  const el = bubbles[charId];
  const p = penguins[charId];
  clearTimeout(bubbleTimers[charId]);
  clearInterval(bubbleTimers[charId + '_tw']);
  el.classList.remove('hidden');
  el.textContent = '';
  p.setTalking(true);

  let i = 0;
  const tw = setInterval(() => {
    i += 2;
    el.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(tw);
      p.setTalking(false);
      const hold = holdMs ?? Math.max(2600, text.length * 45);
      bubbleTimers[charId] = setTimeout(() => el.classList.add('hidden'), hold);
    }
  }, 24);
  bubbleTimers[charId + '_tw'] = tw;
}

function performEmote(charId, emote) {
  const p = penguins[charId];
  const e = EMOTES[emote];
  if (!e) return;
  if (e.anim) p.play(e.anim, 2.2);
  else if (e.expr) p.setExpression(e.expr, 3);
}

// ============================================================ chat
const chatLog = $('#chat-log');
const chatHistory = { npc: [], cap: [] }; // per-character API transcripts
let who = 'cap';
let busy = false;

function addMsg(kind, text, name = null) {
  const div = document.createElement('div');
  div.className = `msg ${kind}`;
  if (name) {
    const n = document.createElement('span');
    n.className = 'msg-name';
    n.textContent = name;
    div.appendChild(n);
  }
  div.appendChild(document.createTextNode(text));
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

function hasKey() { return !!(settings.apiKey && settings.apiKey.trim()); }
function model() { return settings.model || 'claude-sonnet-5'; }

function refreshBrainStatus(state = null, msg = null) {
  const el = $('#brain-status');
  if (state === 'error') {
    el.className = 'error';
    el.textContent = msg || 'API error — fell back to scripted mode';
    return;
  }
  if (hasKey()) { el.className = 'online'; el.textContent = `live AI mode — ${model()}`; }
  else { el.className = 'offline'; el.textContent = 'scripted mode — add an API key in Settings for live AI'; }
}
refreshBrainStatus();

async function charRespond(charId, userText) {
  const char = characters[charId];
  const other = characters[charId === 'cap' ? 'npc' : 'cap'];
  chatHistory[charId].push({ role: 'user', content: userText });
  if (chatHistory[charId].length > 24) chatHistory[charId].splice(0, chatHistory[charId].length - 24);

  let raw;
  if (hasKey()) {
    try {
      raw = await callClaude({
        apiKey: settings.apiKey,
        model: model(),
        system: buildSystemPrompt(char, other, 'user'),
        messages: chatHistory[charId],
      });
      refreshBrainStatus();
    } catch (err) {
      console.warn(err);
      refreshBrainStatus('error', `API error (${err.message.slice(0, 60)}…) — scripted fallback`);
      raw = scriptedReply(charId, userText);
    }
  } else {
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 600));
    raw = scriptedReply(charId, userText);
  }
  chatHistory[charId].push({ role: 'assistant', content: raw });

  const { emote, text } = parseEmote(raw);
  if (emote) performEmote(charId, emote);
  addMsg(charId, text, char.name);
  speak(charId, text);
  return text;
}

$('#chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text || busy) return;
  input.value = '';
  busy = true;
  $('#chat-send').disabled = true;
  addMsg('user', text, 'You');

  try {
    if (who === 'both') {
      const typing1 = addMsg('cap typing', '…');
      const capText = await charRespond('cap', text);
      typing1.remove();
      await new Promise((r) => setTimeout(r, 900));
      const typing2 = addMsg('npc typing', '…');
      await charRespond('npc', `${text}\n\n(${characters.cap.name} just replied: "${capText}" — react to the user and to that.)`);
      typing2.remove();
    } else {
      const typing = addMsg(`${who} typing`, '…');
      await charRespond(who, text);
      typing.remove();
    }
  } finally {
    busy = false;
    $('#chat-send').disabled = false;
    input.focus();
  }
});

$$('#who-picker .who').forEach((btn) => btn.addEventListener('click', () => {
  $$('#who-picker .who').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  who = btn.dataset.who;
}));

// ---- duo banter
$('#btn-banter').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  $('#btn-banter').disabled = true;
  addMsg('sys', '— NPC & CAP start riffing —');

  try {
    if (hasKey()) {
      const transcript = [];
      let speaker = Math.random() < 0.6 ? 'cap' : 'npc';
      for (let turn = 0; turn < 5; turn++) {
        const char = characters[speaker];
        const other = characters[speaker === 'cap' ? 'npc' : 'cap'];
        const messages = transcript.length
          ? transcript.map((tr) => ({ role: tr.speaker === speaker ? 'assistant' : 'user', content: tr.raw }))
          : [{ role: 'user', content: '(Kick off a short, fun exchange with your best friend. Pick any topic from your life.)' }];
        let raw;
        try {
          raw = await callClaude({
            apiKey: settings.apiKey, model: model(),
            system: buildSystemPrompt(char, other, 'banter'),
            messages,
          });
        } catch (err) {
          refreshBrainStatus('error', 'API error mid-banter — switched to script');
          break;
        }
        transcript.push({ speaker, raw });
        const { emote, text } = parseEmote(raw);
        if (emote) performEmote(speaker, emote);
        addMsg(speaker, text, char.name);
        speak(speaker, text);
        await new Promise((r) => setTimeout(r, Math.max(2200, text.length * 42)));
        speaker = speaker === 'cap' ? 'npc' : 'cap';
      }
      if (transcript.length) { busy = false; $('#btn-banter').disabled = false; return; }
    }
    // scripted banter
    for (const [speaker, raw] of scriptedBanter()) {
      const { emote, text } = parseEmote(raw);
      if (emote) performEmote(speaker, emote);
      addMsg(speaker, text, characters[speaker].name);
      speak(speaker, text);
      await new Promise((r) => setTimeout(r, Math.max(2400, text.length * 45)));
    }
  } finally {
    busy = false;
    $('#btn-banter').disabled = false;
  }
});

// ---- direct animation buttons
$$('.anim-btn').forEach((btn) => btn.addEventListener('click', () => {
  const anim = btn.dataset.anim;
  const targets = who === 'both' ? ['cap', 'npc'] : [who];
  for (const id of targets) {
    if (anim === 'waddle') {
      const base = id === 'npc' ? 30 : 70;
      penguins[id].walkTo(base + (Math.random() * 24 - 12));
    } else {
      penguins[id].play(anim, 2.6);
      const e = EMOTES[anim];
      if (e && e.expr) penguins[id].setExpression(e.expr, 2.6);
    }
  }
}));

// ============================================================ tabs
$$('#tabs .tab').forEach((btn) => btn.addEventListener('click', () => {
  $$('#tabs .tab').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  $$('.view').forEach((v) => v.classList.remove('active'));
  $(`#view-${btn.dataset.tab}`).classList.add('active');
}));

// ============================================================ character editors
function renderEditors() {
  const wrap = $('#char-editors');
  wrap.innerHTML = '';
  for (const id of ['cap', 'npc']) {
    const c = characters[id];
    const card = document.createElement('div');
    card.className = 'char-card';
    card.innerHTML = `
      <h3><span class="char-chip" style="background:${c.color}"></span>${c.name}</h3>
      <p class="tagline-note">Fields below are this character's mind. Replace the sample memories with your own — real moments make the companion real.</p>
      <label class="field"><span>Name</span><input type="text" data-f="name" value=""></label>
      <label class="field"><span>Tagline</span><input type="text" data-f="tagline" value=""></label>
      <label class="field"><span>Personality</span><textarea rows="6" data-f="personality"></textarea></label>
      <label class="field"><span>Backstory</span><textarea rows="8" data-f="backstory"></textarea></label>
      <div class="memories-head"><span>Key memories</span><button type="button" class="mem-add">+ Add memory</button></div>
      <div class="mem-list"></div>
      <div class="char-save-row"><button type="button" class="char-save">Save ${c.name}</button><span class="save-flash">Saved ✓</span></div>
    `;
    card.querySelector('[data-f="name"]').value = c.name;
    card.querySelector('[data-f="tagline"]').value = c.tagline;
    card.querySelector('[data-f="personality"]').value = c.personality;
    card.querySelector('[data-f="backstory"]').value = c.backstory;

    const memList = card.querySelector('.mem-list');
    const addMemory = (m = { title: '', text: '' }) => {
      const div = document.createElement('div');
      div.className = 'memory';
      div.innerHTML = `<button type="button" class="mem-del">remove</button>
        <input type="text" placeholder="Memory title" value="">
        <textarea placeholder="What happened, and why it matters…"></textarea>`;
      div.querySelector('input').value = m.title;
      div.querySelector('textarea').value = m.text;
      div.querySelector('.mem-del').addEventListener('click', () => div.remove());
      memList.appendChild(div);
    };
    (c.memories || []).forEach(addMemory);
    card.querySelector('.mem-add').addEventListener('click', () => addMemory());

    card.querySelector('.char-save').addEventListener('click', () => {
      characters[id] = {
        ...c,
        name: card.querySelector('[data-f="name"]').value.trim() || c.name,
        tagline: card.querySelector('[data-f="tagline"]').value.trim(),
        personality: card.querySelector('[data-f="personality"]').value,
        backstory: card.querySelector('[data-f="backstory"]').value,
        memories: [...memList.querySelectorAll('.memory')].map((mDiv) => ({
          title: mDiv.querySelector('input').value.trim(),
          text: mDiv.querySelector('textarea').value.trim(),
        })).filter((m) => m.title || m.text),
      };
      saveCharacters(characters);
      chatHistory[id] = []; // new mind, fresh transcript
      const flash = card.querySelector('.save-flash');
      flash.classList.add('show');
      setTimeout(() => flash.classList.remove('show'), 1800);
    });
    wrap.appendChild(card);
  }
}
renderEditors();

$('#btn-export-chars').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(characters, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rookery-characters.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

$('#file-import-chars').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    for (const id of ['cap', 'npc']) if (data[id]) characters[id] = { ...DEFAULT_CHARACTERS[id], ...data[id] };
    saveCharacters(characters);
    renderEditors();
  } catch { alert('Could not read that file — expected the JSON exported from this page.'); }
  e.target.value = '';
});

$('#btn-reset-chars').addEventListener('click', () => {
  if (!confirm('Reset both characters to the default personas? Your edits will be lost.')) return;
  characters = resetCharacters();
  renderEditors();
});

// ============================================================ character sheet
let sheetChar = 'cap';
let sheetCellMap = [];
$$('#sheet-char-pick .seg-btn').forEach((btn) => btn.addEventListener('click', () => {
  $$('#sheet-char-pick .seg-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  sheetChar = btn.dataset.char;
}));

$('#btn-gen-sheet').addEventListener('click', async () => {
  const btn = $('#btn-gen-sheet');
  btn.disabled = true;
  try {
    const { canvas: sheet, cellMap } = await generateSheet(sheetChar, characters[sheetChar]);
    sheetCellMap = cellMap;
    const preview = $('#sheet-preview');
    preview.width = sheet.width;
    preview.height = sheet.height;
    preview.getContext('2d').drawImage(sheet, 0, 0);
    preview.classList.add('ready');
    $('#btn-dl-sheet').disabled = false;
  } finally {
    btn.disabled = false;
  }
});

$('#btn-dl-sheet').addEventListener('click', () => {
  downloadCanvas($('#sheet-preview'), `${characters[sheetChar].name.toLowerCase()}-character-sheet.png`);
});

$('#sheet-preview').addEventListener('click', async (e) => {
  const preview = $('#sheet-preview');
  const r = preview.getBoundingClientRect();
  const x = (e.clientX - r.left) * (preview.width / r.width);
  const y = (e.clientY - r.top) * (preview.height / r.height);
  const cell = sheetCellMap.find((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
  if (!cell) return;
  const single = await renderSingle(cell.charId, cell.opts, 1024);
  downloadCanvas(single, `${characters[cell.charId].name.toLowerCase()}-${cell.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
});

// ============================================================ settings
$('#set-apikey').value = settings.apiKey || '';
$('#set-model').value = settings.model || 'claude-sonnet-5';

$('#btn-save-settings').addEventListener('click', () => {
  settings.apiKey = $('#set-apikey').value.trim();
  settings.model = $('#set-model').value;
  saveSettings(settings);
  refreshBrainStatus();
  const res = $('#test-result');
  res.className = 'ok';
  res.textContent = 'Saved.';
  setTimeout(() => (res.textContent = ''), 2000);
});

$('#btn-test-key').addEventListener('click', async () => {
  const res = $('#test-result');
  const key = $('#set-apikey').value.trim();
  if (!key) { res.className = 'bad'; res.textContent = 'Enter a key first.'; return; }
  res.className = '';
  res.textContent = 'Testing…';
  try {
    await testKey(key, $('#set-model').value);
    res.className = 'ok';
    res.textContent = '✓ Connected — the penguins are thinking with Claude.';
  } catch (err) {
    res.className = 'bad';
    res.textContent = `✗ ${err.message.slice(0, 120)}`;
  }
});
