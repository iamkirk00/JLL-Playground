// voice.js — outbound speech for the penguins.
// Two engines: free device voices (Web Speech API, shaped per character with
// pitch/rate) and Groq TTS (PlayAI voices, reuses the user's Groq key).

export const GROQ_TTS_VOICES = [
  'Arista-PlayAI', 'Atlas-PlayAI', 'Basil-PlayAI', 'Briggs-PlayAI', 'Calum-PlayAI',
  'Celeste-PlayAI', 'Cheyenne-PlayAI', 'Chip-PlayAI', 'Cillian-PlayAI', 'Deedee-PlayAI',
  'Fritz-PlayAI', 'Gail-PlayAI', 'Indigo-PlayAI', 'Mamaw-PlayAI', 'Mason-PlayAI',
  'Mikail-PlayAI', 'Mitch-PlayAI', 'Quinn-PlayAI', 'Thunder-PlayAI',
];

// Character delivery: CAP the warm excited storyteller, NPC deep and unhurried.
const PROFILES = {
  cap: { pitch: 1.18, rate: 1.06, style: 'bright' },
  npc: { pitch: 0.62, rate: 0.85, style: 'deep' },
};

let deviceVoices = [];
function refreshVoices() {
  try { deviceVoices = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch { deviceVoices = []; }
}
if ('speechSynthesis' in window) {
  refreshVoices();
  speechSynthesis.onvoiceschanged = refreshVoices;
}

export function listDeviceVoices() {
  refreshVoices();
  return deviceVoices;
}

function autoVoice(style) {
  const en = deviceVoices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
  if (!en.length) return null;
  const prefer = style === 'deep'
    ? /(daniel|george|alex|fred|david|james|guy|male)/i
    : /(samantha|karen|victoria|zira|jenny|ava|allison|aria|female)/i;
  return en.find((v) => prefer.test(v.name)) || en[0];
}

let currentAudio = null;
export function stopSpeaking() {
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch {}
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
}

// cfg: { engine: 'device'|'groq', deviceVoiceName, groqKey, groqVoice }
export async function speakText(charId, text, cfg, { onstart, onend } = {}) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) { onend?.(); return; }

  if (cfg.engine === 'groq' && cfg.groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.groqKey}` },
        body: JSON.stringify({
          model: 'playai-tts',
          voice: cfg.groqVoice || (charId === 'npc' ? 'Atlas-PlayAI' : 'Celeste-PlayAI'),
          input: clean.slice(0, 950),
          response_format: 'wav',
        }),
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      stopSpeaking();
      const audio = new Audio(url);
      currentAudio = audio;
      audio.onplay = () => onstart?.();
      const done = () => {
        onend?.();
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
      };
      audio.onended = done;
      audio.onerror = done;
      await audio.play();
      return;
    } catch (e) {
      console.warn('Groq TTS failed — falling back to device voice', e);
    }
  }

  if (!('speechSynthesis' in window)) { onend?.(); return; }
  refreshVoices();
  const p = PROFILES[charId];
  const u = new SpeechSynthesisUtterance(clean);
  const explicit = cfg.deviceVoiceName && cfg.deviceVoiceName !== 'auto';
  const v = explicit
    ? deviceVoices.find((x) => x.name === cfg.deviceVoiceName)
    : autoVoice(p.style);
  if (v) { u.voice = v; u.lang = v.lang; } // matching lang makes Chrome honor the voice
  // Full character shaping in auto mode; soften it when the user picked a voice
  // so their chosen voice's own character comes through.
  const soften = explicit ? 0.45 : 1;
  u.pitch = 1 + (p.pitch - 1) * soften;
  u.rate = 1 + (p.rate - 1) * soften;
  u.onstart = () => onstart?.();
  u.onend = () => onend?.();
  u.onerror = () => onend?.();
  stopSpeaking();
  // speak() immediately after cancel() gets dropped on some engines
  setTimeout(() => speechSynthesis.speak(u), 60);
}
