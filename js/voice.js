// voice.js — outbound speech for the penguins.
// Two engines: free device voices (Web Speech API, shaped per character with
// pitch/rate) and Groq TTS (PlayAI voices, reuses the user's Groq key).

export const GROQ_TTS_VOICES = [
  'Arista-PlayAI', 'Atlas-PlayAI', 'Basil-PlayAI', 'Briggs-PlayAI', 'Calum-PlayAI',
  'Celeste-PlayAI', 'Cheyenne-PlayAI', 'Chip-PlayAI', 'Cillian-PlayAI', 'Deedee-PlayAI',
  'Fritz-PlayAI', 'Gail-PlayAI', 'Indigo-PlayAI', 'Mamaw-PlayAI', 'Mason-PlayAI',
  'Mikail-PlayAI', 'Mitch-PlayAI', 'Quinn-PlayAI', 'Thunder-PlayAI',
];

// Auto voice-picking leans deep for NPC, bright for CAP — but voices play
// exactly as the platform tuned them (no pitch/rate shaping).
const STYLE = { cap: 'bright', npc: 'deep' };

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

// Play an arbitrary audio Blob (used by Family Voices cameos).
export function playBlob(blob, { onstart, onend } = {}) {
  const url = URL.createObjectURL(blob);
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
  return audio.play().catch(done);
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
      window.dispatchEvent(new CustomEvent('voice-fallback', { detail: String(e.message || e) }));
    }
  }

  if (!('speechSynthesis' in window)) { onend?.(); return; }
  refreshVoices();
  const u = new SpeechSynthesisUtterance(clean);
  const explicit = cfg.deviceVoiceName && cfg.deviceVoiceName !== 'auto';
  const v = explicit
    ? deviceVoices.find((x) => x.name === cfg.deviceVoiceName)
    : autoVoice(STYLE[charId]);
  if (v) { u.voice = v; u.lang = v.lang; } // matching lang makes Chrome honor the voice
  u.onstart = () => onstart?.();
  u.onend = () => onend?.();
  u.onerror = () => onend?.();
  stopSpeaking();
  // speak() immediately after cancel() gets dropped on some engines
  setTimeout(() => speechSynthesis.speak(u), 60);
}
