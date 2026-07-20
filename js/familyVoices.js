// familyVoices.js — the Family Voice Crew.
// Record short clips of real family voices in the browser, keep them on-device
// (IndexedDB), and optionally seal them into an encrypted "voice vault" file
// that can live safely inside the PUBLIC GitHub repo: clips are AES-GCM
// encrypted with a family passphrase before they ever leave the browser, and
// decrypted only on family devices. The site auto-loads voices/family.vault
// when present; unlocking it puts the whole family on the soundboard.

const SUGGESTED_LABELS = ['Hello!', 'Laugh', 'Woohoo!', 'Uh-oh…', 'Good idea!', 'Dinner time!'];
const MAX_CLIP_SECONDS = 10;

// ---------- tiny IndexedDB wrapper ----------
function openDB(dbName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('clips', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idb(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('clips', mode);
    const out = fn(tx.objectStore('clips'));
    tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- crypto (WebCrypto: PBKDF2 → AES-256-GCM) ----------
const te = new TextEncoder();
const td = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

async function encryptVault(passphrase, obj) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 200000;
  const key = await deriveKey(passphrase, salt, iterations);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  return JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iterations, salt: b64(salt), iv: b64(iv), data: b64(data) });
}

async function decryptVault(passphrase, vaultText) {
  const v = JSON.parse(vaultText);
  const key = await deriveKey(passphrase, unb64(v.salt), v.iterations || 200000);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, key, unb64(v.data));
  return JSON.parse(td.decode(plain));
}

function blobToB64(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.readAsDataURL(blob);
  });
}

// ---------- the module ----------
export function createFamilyVoices({ dbName, vaultUrl = 'voices/family.vault', playBlob = null, onChange = null }) {
  let db = null;
  let localClips = [];          // {id, member, label, mime, blob}
  let vaultClips = [];          // same shape, id null, from the unlocked vault
  let vaultRaw = null;          // encrypted vault text, if found
  let vaultUnlocked = false;
  const passKey = `${dbName}.vaultpass`;
  let recording = null;         // {recorder, stream, timer}

  const notify = () => onChange?.(api);

  const play = (blob) => {
    if (playBlob) return playBlob(blob, {});
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.onended = () => URL.revokeObjectURL(url);
    return a.play().catch(() => {});
  };

  async function init() {
    try { db = await openDB(dbName); } catch (e) { console.warn('voice db unavailable', e); }
    if (db) {
      localClips = (await idb(db, 'readonly', (s) => s.getAll())) || [];
    }
    try {
      const res = await fetch(vaultUrl, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        if (text.trim().startsWith('{')) vaultRaw = text;
      }
    } catch { /* no vault published — fine */ }
    if (vaultRaw) {
      const saved = localStorage.getItem(passKey);
      if (saved) { try { await unlockVault(saved, false); } catch { localStorage.removeItem(passKey); } }
    }
    notify();
    return api;
  }

  async function unlockVault(passphrase, remember) {
    const data = await decryptVault(passphrase, vaultRaw);
    vaultClips = [];
    for (const m of data.members || []) {
      for (const c of m.clips || []) {
        vaultClips.push({
          id: null, member: m.name, label: c.label, mime: c.mime,
          blob: new Blob([unb64(c.b64)], { type: c.mime }),
        });
      }
    }
    vaultUnlocked = true;
    if (remember) localStorage.setItem(passKey, passphrase);
    notify();
  }

  function lockVault() {
    vaultClips = [];
    vaultUnlocked = false;
    localStorage.removeItem(passKey);
    notify();
  }

  function allClips() { return [...localClips, ...vaultClips]; }
  function members() { return [...new Set(allClips().map((c) => c.member))]; }
  function clipsFor(member) { return allClips().filter((c) => c.member === member); }
  function randomClip(member, labelRe = null) {
    let pool = clipsFor(member);
    if (labelRe) {
      const match = pool.filter((c) => labelRe.test(c.label));
      if (match.length) pool = match;
    }
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  async function startRecording(member, label, onStop) {
    if (recording) stopRecording();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      .find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size > 500) {
        const rec = { member, label, mime: blob.type, blob, ts: Date.now() };
        if (db) {
          const id = await idb(db, 'readwrite', (s) => s.add(rec));
          rec.id = id;
        }
        localClips.push(rec);
        notify();
      }
      onStop?.(blob);
    };
    recorder.start();
    const timer = setTimeout(() => stopRecording(), MAX_CLIP_SECONDS * 1000);
    recording = { recorder, stream, timer };
  }

  function stopRecording() {
    if (!recording) return;
    clearTimeout(recording.timer);
    try { recording.recorder.stop(); } catch {}
    recording = null;
  }

  async function deleteClip(clip) {
    if (clip.id != null && db) await idb(db, 'readwrite', (s) => s.delete(clip.id));
    localClips = localClips.filter((c) => c !== clip);
    notify();
  }

  async function exportVault(passphrase) {
    // seal EVERYTHING currently audible (local + unlocked vault) into one file
    const byMember = {};
    for (const c of allClips()) {
      (byMember[c.member] ||= []).push({ label: c.label, mime: c.mime, b64: await blobToB64(c.blob) });
    }
    const payload = { members: Object.entries(byMember).map(([name, clips]) => ({ name, clips })) };
    const text = await encryptVault(passphrase, payload);
    const blobFile = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blobFile);
    a.download = 'family.vault';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function importVaultFile(file, passphrase, remember) {
    vaultRaw = await file.text();
    await unlockVault(passphrase, remember);
  }

  // ============================== UI: the booth ==============================
  function renderBooth(container) {
    container.innerHTML = '';

    // vault status / unlock
    const vaultCard = document.createElement('div');
    vaultCard.className = 'settings-card voice-vault-card';
    if (vaultRaw && !vaultUnlocked) {
      vaultCard.innerHTML = `
        <h3>🔒 A family voice vault is published with this site</h3>
        <p class="vault-note">Enter the family passphrase to unlock everyone's clips on this device.</p>
        <div class="row-btns">
          <input type="password" class="vault-pass" placeholder="family passphrase">
          <label class="vault-remember"><input type="checkbox" checked> remember on this device</label>
          <button class="vault-unlock">Unlock</button>
          <span class="vault-msg"></span>
        </div>`;
      vaultCard.querySelector('.vault-unlock').addEventListener('click', async () => {
        const msg = vaultCard.querySelector('.vault-msg');
        try {
          await unlockVault(
            vaultCard.querySelector('.vault-pass').value,
            vaultCard.querySelector('.vault-remember input').checked,
          );
          renderBooth(container);
        } catch { msg.textContent = '✗ wrong passphrase'; msg.className = 'vault-msg bad'; }
      });
    } else if (vaultUnlocked) {
      vaultCard.innerHTML = `
        <h3>🔓 Family vault unlocked — ${members().length} voice${members().length === 1 ? '' : 's'} aboard</h3>
        <div class="row-btns"><button class="vault-lock">Lock &amp; forget on this device</button></div>`;
      vaultCard.querySelector('.vault-lock').addEventListener('click', () => { lockVault(); renderBooth(container); });
    } else {
      vaultCard.innerHTML = `
        <h3>🎙 No voice vault published yet</h3>
        <p class="vault-note">Record some clips below, then export an encrypted vault and add it to the
        site's repo at <code>voices/family.vault</code> — the clips are sealed with your family
        passphrase before they leave this browser, so the public repo only ever holds scrambled bytes.
        You can also load a vault file directly:</p>
        <div class="row-btns">
          <label class="filebtn">📂 Load vault file<input type="file" class="vault-file" accept=".vault,.json"></label>
          <input type="password" class="vault-pass" placeholder="family passphrase">
          <span class="vault-msg"></span>
        </div>`;
      vaultCard.querySelector('.vault-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const msg = vaultCard.querySelector('.vault-msg');
        if (!file) return;
        try {
          await importVaultFile(file, vaultCard.querySelector('.vault-pass').value, true);
          renderBooth(container);
        } catch { msg.textContent = '✗ could not unlock that file'; msg.className = 'vault-msg bad'; }
        e.target.value = '';
      });
    }
    container.appendChild(vaultCard);

    // add member
    const addCard = document.createElement('div');
    addCard.className = 'settings-card';
    addCard.innerHTML = `
      <h3>Add a family voice</h3>
      <div class="row-btns">
        <input type="text" class="new-member" placeholder="Name (e.g. Audrey)" maxlength="24">
        <button class="add-member">+ Join the crew</button>
      </div>`;
    const doAdd = () => {
      const name = addCard.querySelector('.new-member').value.trim();
      if (!name) return;
      if (!members().includes(name)) localClips.push({ id: null, member: name, label: '', mime: '', blob: null, placeholder: true });
      addCard.querySelector('.new-member').value = '';
      notify();
      renderBooth(container);
    };
    addCard.querySelector('.add-member').addEventListener('click', doAdd);
    addCard.querySelector('.new-member').addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
    container.appendChild(addCard);

    // member cards
    for (const name of members()) {
      const clips = clipsFor(name).filter((c) => !c.placeholder);
      const card = document.createElement('div');
      card.className = 'settings-card member-card';
      card.innerHTML = `
        <h3>🎙 ${name} <span class="clip-count">${clips.length} clip${clips.length === 1 ? '' : 's'}</span></h3>
        <div class="prompt-chips"></div>
        <div class="row-btns custom-row">
          <input type="text" class="custom-label" placeholder="…or a custom line (e.g. 'Best day ever!')" maxlength="40">
          <button class="rec-custom">● Record</button>
        </div>
        <div class="clip-list"></div>`;
      const chips = card.querySelector('.prompt-chips');
      const recBtns = [];
      const wireRecord = (btn, labelFn) => {
        recBtns.push(btn);
        btn.addEventListener('click', async () => {
          if (btn.classList.contains('recording')) { stopRecording(); return; }
          const label = labelFn();
          if (!label) return;
          try {
            await startRecording(name, label, () => renderBooth(container));
            recBtns.forEach((b) => b.classList.remove('recording'));
            btn.classList.add('recording');
            btn.dataset.old = btn.textContent;
            btn.textContent = '■ Stop';
          } catch { alert('Microphone unavailable — check browser permissions.'); }
        });
      };
      for (const label of SUGGESTED_LABELS) {
        const b = document.createElement('button');
        b.className = 'chip-rec';
        b.textContent = `● ${label}`;
        wireRecord(b, () => label);
        chips.appendChild(b);
      }
      wireRecord(card.querySelector('.rec-custom'), () => card.querySelector('.custom-label').value.trim());

      const list = card.querySelector('.clip-list');
      for (const clip of clips) {
        const row = document.createElement('div');
        row.className = 'clip-row';
        row.innerHTML = `
          <button class="clip-play">▶</button>
          <span class="clip-label">${clip.label}</span>
          <span class="clip-src">${clip.id == null ? 'vault' : 'this device'}</span>
          ${clip.id == null ? '' : '<button class="clip-del">✕</button>'}`;
        row.querySelector('.clip-play').addEventListener('click', () => play(clip.blob));
        row.querySelector('.clip-del')?.addEventListener('click', async () => { await deleteClip(clip); renderBooth(container); });
        list.appendChild(row);
      }
      container.appendChild(card);
    }

    // export
    if (allClips().some((c) => !c.placeholder)) {
      const exp = document.createElement('div');
      exp.className = 'settings-card';
      exp.innerHTML = `
        <h3>⬇ Seal &amp; export the vault</h3>
        <p class="vault-note">Pick a passphrase the whole family knows. The exported <code>family.vault</code>
        file is encrypted (AES-256) — commit it to the repo at <code>voices/family.vault</code>
        (or hand it to Claude to push) and every family device can unlock the crew.</p>
        <div class="row-btns">
          <input type="password" class="exp-pass" placeholder="passphrase">
          <input type="password" class="exp-pass2" placeholder="repeat it">
          <button class="exp-go">Seal &amp; download</button>
          <span class="vault-msg"></span>
        </div>`;
      exp.querySelector('.exp-go').addEventListener('click', async () => {
        const p1 = exp.querySelector('.exp-pass').value;
        const p2 = exp.querySelector('.exp-pass2').value;
        const msg = exp.querySelector('.vault-msg');
        if (p1.length < 4) { msg.textContent = '✗ at least 4 characters'; msg.className = 'vault-msg bad'; return; }
        if (p1 !== p2) { msg.textContent = "✗ passphrases don't match"; msg.className = 'vault-msg bad'; return; }
        await exportVault(p1);
        msg.textContent = '✓ vault downloaded';
        msg.className = 'vault-msg ok';
      });
      container.appendChild(exp);
    }
  }

  // ============================== UI: the soundboard ==============================
  function renderSoundboard(container, onCameo) {
    const names = members().filter((n) => clipsFor(n).some((c) => !c.placeholder));
    container.innerHTML = '';
    container.style.display = names.length ? '' : 'none';
    if (!names.length) return;
    const tag = document.createElement('span');
    tag.className = 'anim-label';
    tag.textContent = 'Family cameo:';
    container.appendChild(tag);
    for (const name of names) {
      const b = document.createElement('button');
      b.className = 'anim-btn cameo-btn';
      b.textContent = `🎙 ${name}`;
      b.addEventListener('click', () => {
        const clip = randomClip(name);
        if (!clip) return;
        play(clip.blob);
        onCameo?.(name, clip.label);
      });
      container.appendChild(b);
    }
  }

  const api = {
    init, members, clipsFor, randomClip, renderBooth, renderSoundboard,
    unlockVault, exportVault, deleteClip,
    get vaultFound() { return !!vaultRaw; },
    get vaultUnlocked() { return vaultUnlocked; },
    hasClips() { return allClips().some((c) => !c.placeholder); },
  };
  return api;
}
