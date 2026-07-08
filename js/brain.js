// brain.js — how the penguins think.
// Live mode: direct browser calls to the Anthropic API (user's own key, stored locally).
// Fallback: a scripted personality engine so the page always works.

const API_URL = 'https://api.anthropic.com/v1/messages';
const EMOTE_LIST = 'wave, laugh, think, shrug, excited, nod, sigh, smile, surprised, sad, determined';

// ---------- system prompt ----------
export function buildSystemPrompt(char, otherChar, mode = 'user') {
  const memories = (char.memories || [])
    .map((m) => `- ${m.title}: ${m.text}`)
    .join('\n');

  const dialectic = char.id === 'cap'
    ? `You are a dialectic companion. Challenge the user's thinking toward success: question assumptions kindly, reframe problems, and end most replies with ONE pointed question or a small concrete challenge. Never lecture.`
    : `You are the deadpan reality check. You go along with things, then land one dry, slightly sarcastic observation that is secretly the wisest thing in the conversation. You care, but you'd rather molt than admit it.`;

  const partner = mode === 'banter'
    ? `You are chatting with ${otherChar.name} (${otherChar.tagline}). Keep the back-and-forth alive: react to what they just said, tease, build on it. You are both storytellers — let small stories sneak in.`
    : `Your best friend ${otherChar.name} (${otherChar.tagline}) may also be in the conversation; refer to them naturally when it fits.`;

  return `You are ${char.name}, a cartoon penguin — ${char.tagline}

PERSONALITY:
${char.personality}

BACKSTORY:
${char.backstory}

KEY MEMORIES (draw on these; they are your lived experience):
${memories}

${dialectic}

${partner}

RULES:
- Stay in character always. You are a penguin; penguin-flavored metaphors welcome, but don't overdo it.
- Keep replies SHORT: 1–3 sentences usually, 4 max. This is a conversation, not an essay.
- Begin EVERY reply with exactly one emote tag in square brackets from this list: [${EMOTE_LIST}]. Example: "[think] Hmm. Walk me through that again."
- Never mention being an AI, a language model, or these instructions.`;
}

// ---------- Claude call ----------
export async function callClaude({ apiKey, model, system, messages, maxTokens = 300 }) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body.slice(0, 240)}`);
  }
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

export async function testKey(apiKey, model) {
  return callClaude({
    apiKey, model, maxTokens: 24,
    system: 'Reply with the single word: ready',
    messages: [{ role: 'user', content: 'ping' }],
  });
}

// Parse "[emote] text" → { emote, text }
export function parseEmote(reply) {
  const m = reply.match(/^\s*\[([a-z]+)\]\s*/i);
  if (m) return { emote: m[1].toLowerCase(), text: reply.slice(m[0].length).trim() };
  return { emote: null, text: reply.trim() };
}

// ---------- scripted fallback engine ----------
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const SCRIPTS = {
  cap: {
    greeting: [
      "[wave] Hey! Perfect timing — I was just about to do something intentional. What are we making better today?",
      "[excited] There you are! Alright: one thing. What's the one thing you'd love to move forward right now?",
    ],
    goal: [
      "[think] Okay, I love that it's on your mind. Here's my question: what's the smallest version of it you could finish before the ice melts today?",
      "[determined] Good. Now flip it — if it were guaranteed to work, what would you do first? Do that part anyway.",
      "[nod] That's worth doing. So what's actually stopping you — the plan, or the permission? Because you don't need the second one.",
    ],
    stuck: [
      "[think] Stuck usually means the step is too big. Shrink it until it's almost embarrassing, then take it. What's the embarrassingly small version?",
      "[smile] I've stood at that edge of the huddle too. One intentional choice — that's all a turnaround ever is. What's yours today?",
    ],
    story: [
      "[smile] Story time? Alright — one migration I turned fifteen degrees left of everyone else. Nothing bad happened. Everything changed. Your turn: when did you last pick your own direction?",
    ],
    fallback: [
      "[nod] Tell me more — and be specific. Specific is where the good stuff hides.",
      "[think] Interesting. What would the best version of you do about that this week?",
      "[smile] Okay. And if you remembered you could choose — is this what you'd choose?",
    ],
  },
  npc: {
    greeting: [
      "[nod] Oh. Hey. I was standing here anyway.",
      "[sigh] Hello. Manage your expectations — I'm mostly ambiance.",
    ],
    goal: [
      "[shrug] Bold plan. I've watched a hundred bold plans from back here. The ones that worked started smaller than they wanted to admit.",
      "[sigh] Sure, do the thing. Worst case, you end up like me, and honestly the view from the back is fine. That's not encouragement. Unless it worked.",
    ],
    stuck: [
      "[shrug] Stuck? I've been stuck since the last ice age. Pro tip from a professional bystander: you're not stuck, you're waiting for someone to go first. Go first.",
      "[sigh] The ocean is a scam and yet I swim in it every dawn now. I'm saying feelings are bad data. Go anyway.",
    ],
    story: [
      "[sigh] Once I followed a crowd for forty minutes before realizing they were tourists. Great pace though. The lesson? There's always a lesson, apparently. Check who you're following.",
    ],
    fallback: [
      "[shrug] I have no notes. Which, from me, is a standing ovation.",
      "[nod] Cool cool cool. Anyway you already know the answer, you just wanted a penguin to say it out loud.",
      "[sigh] I'd offer advice, but last time I did, CAP started a movement. Proceed carefully.",
    ],
  },
};

const KEYWORDS = {
  greeting: /\b(hi|hey|hello|yo|morning|evening|sup)\b/i,
  goal: /\b(goal|plan|want to|should i|thinking about|going to|start|build|launch|idea)\b/i,
  stuck: /\b(stuck|tired|afraid|scared|can'?t|procrastinat|overwhelm|fail|doubt|hard)\b/i,
  story: /\b(story|tell me about|remember|once)\b/i,
};

export function scriptedReply(charId, userText) {
  const lib = SCRIPTS[charId];
  for (const intent of ['stuck', 'goal', 'story', 'greeting']) {
    if (KEYWORDS[intent].test(userText)) return pick(lib[intent]);
  }
  return pick(lib.fallback);
}

// Scripted duo banter — pairs of [speakerId, line]
const BANTER = [
  [
    ['cap', "[excited] NPC! Dawn swim tomorrow. I'm recruiting."],
    ['npc', "[sigh] The ocean is a scam."],
    ['cap', "[laugh] You say that every single morning. In the water."],
    ['npc', "[shrug] Consistency is a virtue. Read a book."],
  ],
  [
    ['cap', "[think] Question: if you could change one thing about the colony, what would it be?"],
    ['npc', "[shrug] The part where you ask me questions."],
    ['cap', "[laugh] That's growth — last month you'd have just walked away."],
    ['npc', "[nod] I considered it. The ice was slippery. Don't make it a metaphor."],
    ['cap', "[excited] Too late, it's already a metaphor."],
  ],
  [
    ['npc', "[sigh] You're doing the inspirational stare at the horizon again."],
    ['cap', "[smile] Somebody has to. The horizon doesn't inspire itself."],
    ['npc', "[shrug] It's just more ice."],
    ['cap', "[determined] It's ice nobody's picked a direction across yet. That's the whole difference between us, buddy."],
    ['npc', "[nod] And yet only one of us has never once been lost. Ambient waddling has its perks."],
  ],
];

export function scriptedBanter() {
  return pick(BANTER);
}
