'use strict';
// Olympiade – Browserseite: Start, Lobby, laufende Disziplin, Wertung und Siegerehrung.
(function(){
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const speicher = {
  lesen(k, std){ try { const v = localStorage.getItem('olympiade.' + k); return v == null ? std : JSON.parse(v); } catch (e) { return std; } },
  schreiben(k, v){ try { localStorage.setItem('olympiade.' + k, JSON.stringify(v)); } catch (e) { /* egal */ } }
};
const MEDAILLE = ['🥇', '🥈', '🥉'];

let ws = null, katalog = null, stand = null, zuletztCode = null, meineWahl = speicher.lesen('emoji', null);
let entwurf = null;          // Plan, den die Leitung gerade bearbeitet
let handReihenfolge = null;
let verbindenVersuch = 0;

/* ---------- Verbindung ---------- */
function senden(m){ if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
function verbinden(){
  const neu = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws = neu;
  neu.onopen = () => { verbindenVersuch = 0; $('#verbindung').hidden = true; };
  neu.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } empfangen(m); };
  neu.onclose = () => {
    if (ws !== neu) return;
    ws = null;
    $('#verbindung').hidden = false;
    $('#verbindung').textContent = 'Verbindung weg – verbinde neu …';
    setTimeout(verbinden, Math.min(8000, 800 * ++verbindenVersuch));
  };
}

function empfangen(m){
  switch (m.t){
    case 'hallo':
      katalog = m;
      emojiWahlBauen();
      // Wiederkommen: gespeicherter Platz in einer Olympiade
      {
        const code = zuletztCode || new URLSearchParams(location.search).get('code');
        const token = code ? speicher.lesen('platz.' + code.toUpperCase(), null) : null;
        if (code && token) senden({ t:'beitreten', code, token });
        else zeigen('start');
      }
      break;
    case 'drin':
      zuletztCode = m.code;
      speicher.schreiben('platz.' + m.code, m.token);
      if (new URLSearchParams(location.search).get('code') !== m.code) history.replaceState(null, '', '/?code=' + m.code);
      break;
    case 'stand': {
      const alt = stand;
      stand = m;
      if (!alt || alt.phase !== m.phase || alt.nr !== m.nr){ entwurf = null; handReihenfolge = null; window.scrollTo(0, 0); }
      darstellen();
      break;
    }
    case 'ticket':
      location.href = m.url;
      break;
    case 'fehler':
      if (m.code === 'weg'){
        if (zuletztCode) speicher.schreiben('platz.' + zuletztCode, null);
        zuletztCode = null; stand = null;
        history.replaceState(null, '', '/');
        zeigen('start');
        $('#startFehler').textContent = m.text;
      } else if (m.code === 'name'){
        zeigen('start');
        $('#startFehler').textContent = 'Gib deinen Namen ein und tritt dann bei.';
        $('#name').focus();
      } else if (!stand){
        $('#startFehler').textContent = m.text;
      } else meldung(m.text);
      break;
  }
}

function meldung(text){
  const el = $('#meldung');
  el.textContent = text; el.hidden = false;
  clearTimeout(meldung.uhr);
  meldung.uhr = setTimeout(() => (el.hidden = true), 3500);
}

function zeigen(id){
  for (const s of ['start', 'lobby', 'disziplin', 'wertung', 'ende']) $('#' + s).hidden = s !== id;
  $('#kopfCode').hidden = !stand;
  if (stand) $('#kopfCode').textContent = stand.code;
  if (id === 'start'){
    const code = new URLSearchParams(location.search).get('code');
    if (code && !$('#code').value) $('#code').value = code.toUpperCase();
    $('#name').value = $('#name').value || speicher.lesen('name', '');
  }
}

/* ---------- Hilfen ---------- */
const spiel = id => katalog.spiele[id];
const ich = () => stand.spieler.find(s => s.id === stand.du);
const istLeiter = () => stand.leiter === stand.du;
const spielerVon = id => stand.spieler.find(s => s.id === id) || { name:'?', emoji:'❔', punkte:0, medaillen:[0, 0, 0] };
function einstText(sp, einst){
  return spiel(sp).einst.map(o => (o.werte.find(w => w[0] === einst[o.id]) || [0, '?'])[1]).join(' · ');
}
function rangliste(spieler){
  return spieler.slice().sort((a, b) => b.punkte - a.punkte || b.medaillen[0] - a.medaillen[0] || b.medaillen[1] - a.medaillen[1] || b.medaillen[2] - a.medaillen[2] || a.name.localeCompare(b.name));
}
// Plätze mit Gleichstand (1, 1, 3 …)
function mitPlatz(liste){
  return liste.map((s, i) => {
    let p = i + 1;
    for (let j = i - 1; j >= 0 && liste[j].punkte === s.punkte && String(liste[j].medaillen) === String(s.medaillen); j--) p = j + 1;
    return { ...s, platz:p };
  });
}
function medaillenText(m){ return m.map((n, i) => n ? `${MEDAILLE[i]}${n > 1 ? '×' + n : ''}` : '').join(' '); }
function knopf(text, klasse, fn){
  const b = document.createElement('button');
  b.className = 'knopf ' + (klasse || ''); b.textContent = text; b.onclick = fn;
  return b;
}

/* ---------- Start ---------- */
function emojiWahlBauen(){
  for (const ziel of [$('#emojiWahl'), $('#lobbyEmoji')]){
    ziel.innerHTML = '';
    for (const e of katalog.emojis){
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = e; b.setAttribute('role', 'radio'); b.dataset.e = e;
      b.setAttribute('aria-label', 'Tier ' + e);
      b.onclick = () => {
        meineWahl = e; speicher.schreiben('emoji', e);
        if (stand) senden({ t:'emoji', emoji:e });
        emojiMarkieren();
      };
      ziel.appendChild(b);
    }
  }
  if (!meineWahl) meineWahl = katalog.emojis[Math.floor(Math.random() * katalog.emojis.length)];
  emojiMarkieren();
}
function emojiMarkieren(){
  const belegt = stand ? new Set(stand.spieler.filter(s => s.id !== stand.du).map(s => s.emoji)) : new Set();
  const meins = stand ? ich()?.emoji : meineWahl;
  document.querySelectorAll('.emoji-wahl button').forEach(b => {
    b.setAttribute('aria-checked', b.dataset.e === meins ? 'true' : 'false');
    b.disabled = belegt.has(b.dataset.e);
  });
}
function nameHolen(){
  const name = $('#name').value.trim();
  if (!name){ $('#startFehler').textContent = 'Gib zuerst deinen Namen ein.'; $('#name').focus(); return null; }
  speicher.schreiben('name', name);
  $('#startFehler').textContent = '';
  return name;
}
$('#neu').onclick = () => { const name = nameHolen(); if (name) senden({ t:'erstellen', name, emoji:meineWahl }); };
$('#beitretenForm').onsubmit = e => {
  e.preventDefault();
  const code = $('#code').value.trim().toUpperCase();
  if (code.length !== 4){ $('#startFehler').textContent = 'Der Code hat 4 Zeichen.'; $('#code').focus(); return; }
  const name = nameHolen();
  if (!name) return;
  senden({ t:'beitreten', code, name, emoji:meineWahl, token:speicher.lesen('platz.' + code, null) });
};

/* ---------- Darstellung je nach Phase ---------- */
function darstellen(){
  if (!stand || !katalog) return;
  emojiMarkieren();
  if (stand.phase === 'lobby') lobbyZeigen();
  else if (stand.phase === 'disziplin') disziplinZeigen();
  else if (stand.phase === 'wertung') wertungZeigen();
  else endeZeigen();
}

function lobbyZeigen(){
  zeigen('lobby');
  $('#lobbyCode').textContent = stand.code;
  $('#einladeLink').value = `${location.origin}/?code=${stand.code}`;
  $('#anzahl').textContent = `(${stand.spieler.length}/${katalog.max})`;
  const liste = $('#lobbySpieler');
  liste.innerHTML = '';
  for (const s of stand.spieler){
    const li = document.createElement('li');
    li.innerHTML = `<span class="tier">${esc(s.emoji)}</span><span class="name">${esc(s.name)}${s.id === stand.du ? ' (du)' : ''}</span>
      ${s.id === stand.leiter ? '<span class="marke-klein">👑 Leitung</span>' : ''}<span class="punkt ${s.online ? 'an' : ''}" title="${s.online ? 'online' : 'nicht verbunden'}"></span>`;
    if (istLeiter() && s.id !== stand.du){
      const x = knopf('✕', 'klein', () => { if (confirm(`${s.name} aus der Olympiade nehmen?`)) senden({ t:'rauswerfen', id:s.id }); });
      x.setAttribute('aria-label', `${s.name} entfernen`);
      li.appendChild(x);
    }
    liste.appendChild(li);
  }
  planZeigen();
  const leiter = istLeiter();
  $('#starten').hidden = !leiter;
  $('#lobbyInfo').textContent = leiter
    ? (stand.spieler.length < 2 ? 'Schick den Code oder Link an deine Leute. Allein geht es auch – zum Ausprobieren.' : 'Alle da? Dann los!')
    : `Warte, bis ${spielerVon(stand.leiter).name} die Olympiade startet.`;
  const leitungDa = spielerVon(stand.leiter).online;
  if (!leiter && !leitungDa){
    $('#lobbyInfo').innerHTML = 'Die Leitung ist gerade nicht da. ';
    $('#lobbyInfo').appendChild(knopf('Leitung übernehmen', 'klein', () => senden({ t:'leiterWerden' })));
  }
}

function planZeigen(){
  const leiter = istLeiter();
  // Die Leitung sieht alle Spiele (ausgewählte zuerst), die anderen nur den Plan
  if (leiter && !entwurf){
    const drin = stand.plan.map(d => ({ ...d, an:true }));
    const rest = Object.keys(katalog.spiele).filter(id => !stand.plan.some(d => d.spiel === id))
      .map(id => ({ spiel:id, einst:Object.fromEntries(spiel(id).einst.map(o => [o.id, o.std])), an:false }));
    entwurf = { plan:[...drin, ...rest], einst:{ ...stand.einst } };
  }
  const plan = leiter ? entwurf.plan : stand.plan.map(d => ({ ...d, an:true }));
  $('#planHinweis').textContent = leiter ? 'Du leitest: Wähl die Spiele aus und leg die Reihenfolge fest.' : 'Die Leitung stellt die Disziplinen zusammen.';
  const ol = $('#plan');
  ol.innerHTML = '';
  plan.forEach((d, i) => {
    const sp = spiel(d.spiel);
    const li = document.createElement('li');
    if (!d.an) li.className = 'aus';
    const icon = `<div class="icon">${sp.emoji}</div>`;
    if (!leiter){
      li.innerHTML = `${icon}<div><div class="titel">${i + 1}. ${esc(sp.name)}</div><div class="leise klein">${esc(einstText(d.spiel, d.einst))}</div></div><span></span>`;
      ol.appendChild(li);
      return;
    }
    li.innerHTML = `${icon}<label class="schalter"><input type="checkbox" ${d.an ? 'checked' : ''}><span class="titel">${esc(sp.name)}</span></label><div class="pfeile"></div><div class="werte"></div>`;
    li.querySelector('input').onchange = e => { d.an = e.target.checked; planSenden(); };
    const pfeile = li.querySelector('.pfeile');
    const hoch = knopf('↑', 'klein', () => { if (i > 0){ [plan[i - 1], plan[i]] = [plan[i], plan[i - 1]]; planSenden(); } });
    const runter = knopf('↓', 'klein', () => { if (i < plan.length - 1){ [plan[i + 1], plan[i]] = [plan[i], plan[i + 1]]; planSenden(); } });
    hoch.disabled = i === 0; runter.disabled = i === plan.length - 1;
    hoch.setAttribute('aria-label', `${sp.name} nach oben`); runter.setAttribute('aria-label', `${sp.name} nach unten`);
    pfeile.append(hoch, runter);
    const werte = li.querySelector('.werte');
    for (const o of sp.einst){
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', `${sp.name}: ${o.name}`);
      sel.innerHTML = o.werte.map(([w, t]) => `<option value="${esc(JSON.stringify(w))}" ${w === d.einst[o.id] ? 'selected' : ''}>${esc(o.name)}: ${esc(t)}</option>`).join('');
      sel.onchange = () => { d.einst[o.id] = JSON.parse(sel.value); planSenden(); };
      werte.appendChild(sel);
    }
    ol.appendChild(li);
  });
  const opt = $('#planOptionen');
  opt.innerHTML = '';
  const e = leiter ? entwurf.einst : stand.einst;
  const schalter = (feld, text) => {
    const l = document.createElement('label');
    l.className = 'schalter';
    l.innerHTML = `<input type="checkbox" ${e[feld] ? 'checked' : ''} ${leiter ? '' : 'disabled'}><span>${text}</span>`;
    l.querySelector('input').onchange = ev => { entwurf.einst[feld] = ev.target.checked; planSenden(); };
    opt.appendChild(l);
  };
  schalter('joker', '🃏 Joker: Jeder darf einmal seine Punkte in einer Disziplin verdoppeln');
  schalter('finaleDoppelt', '🔥 Finale: Die letzte Disziplin zählt doppelt');
  const p = katalog.punkte;
  const erklaerung = document.createElement('p');
  erklaerung.className = 'leise klein';
  erklaerung.textContent = `Punkte pro Disziplin: ${p.map((x, i) => `${i + 1}. Platz ${x}`).join(', ')}.`;
  opt.appendChild(erklaerung);
}
function planSenden(){
  if (!entwurf.plan.some(d => d.an)){ meldung('Mindestens eine Disziplin muss dabei sein.'); entwurf.plan[0].an = true; }
  senden({ t:'plan', plan:entwurf.plan.filter(d => d.an).map(d => ({ spiel:d.spiel, einst:d.einst })), einst:entwurf.einst });
  planZeigen();
}
$('#starten').onclick = () => senden({ t:'starten' });
$('#linkKopieren').onclick = async () => {
  try { await navigator.clipboard.writeText($('#einladeLink').value); meldung('Link kopiert'); }
  catch (e) { $('#einladeLink').select(); meldung('Markiert – jetzt kopieren'); }
};
$('#verlassen').onclick = () => {
  if (!confirm('Olympiade wirklich verlassen?')) return;
  senden({ t:'verlassen' });
  speicher.schreiben('platz.' + stand.code, null);
  stand = null; zuletztCode = null;
  history.replaceState(null, '', '/');
  zeigen('start');
};

/* ---------- Laufende Disziplin ---------- */
const ZUSTAND = { bereit:'noch nicht gestartet', unterwegs:'auf dem Weg ins Spiel', da:'im Spiel, wartet', spielt:'spielt gerade', fertig:'fertig' };
function disziplinZeigen(){
  zeigen('disziplin');
  const l = stand.lauf, sp = spiel(l.spiel);
  const letzte = stand.nr === stand.plan.length - 1 && stand.plan.length > 1;
  $('#dIcon').textContent = sp.emoji;
  $('#dNr').textContent = `Disziplin ${stand.nr + 1} von ${stand.plan.length}`;
  $('#dName').textContent = sp.name;
  $('#dEinst').textContent = einstText(l.spiel, l.einst);
  $('#dRegel').textContent = sp.regel;
  $('#dFinale').hidden = !(letzte && stand.einst.finaleDoppelt);
  const meinZ = l.zustand[stand.du] || { was:'bereit' };
  const gruppe = l.gruppen.findIndex(g => g.includes(stand.du));
  $('#dGruppe').textContent = l.gruppen.length > 1
    ? `Vorlauf ${gruppe + 1} von ${l.gruppen.length}, mit: ${l.gruppen[gruppe].filter(id => id !== stand.du).map(id => spielerVon(id).name).join(', ') || 'nur du'}`
    : l.gruppen[0].length > 1 ? 'Alle spielen zusammen in einem Raum.' : 'Du spielst allein.';
  const fertig = meinZ.was === 'fertig';
  $('#spielen').textContent = fertig ? 'Erledigt ✓' : meinZ.was === 'bereit' ? 'Jetzt spielen →' : 'Zurück ins Spiel →';
  $('#spielen').disabled = fertig;
  $('#dMein').textContent = fertig ? `Dein Ergebnis: ${meinZ.text || 'gemeldet'} – warte auf die anderen.` : '';
  // Joker
  const meiner = ich();
  const jokerErlaubt = stand.einst.joker && !fertig;
  $('#jokerBox').hidden = !jokerErlaubt;
  if (jokerErlaubt){
    const hier = meiner.joker === stand.nr, schonWeg = meiner.joker !== null && !hier, gesperrt = meinZ.was !== 'bereit';
    $('#joker').checked = hier;
    $('#joker').disabled = schonWeg || gesperrt;
    $('#jokerInfo').textContent = schonWeg ? `Deinen Joker hast du schon bei ${spiel(stand.plan[meiner.joker].spiel).name} eingesetzt.`
      : gesperrt ? (hier ? 'Joker ist gesetzt.' : 'Der Joker geht nur vor dem Start.') : 'Du hast nur einen Joker für die ganze Olympiade.';
  }
  // Status aller
  const ul = $('#dStatus');
  ul.innerHTML = '';
  for (const s of stand.spieler){
    const z = l.zustand[s.id] || { was:'bereit' };
    const li = document.createElement('li');
    li.innerHTML = `<span class="tier">${esc(s.emoji)}</span><span class="name">${esc(s.name)}${l.jokerHier.includes(s.id) ? ' 🃏' : ''}</span>
      <span class="marke-klein">${z.was === 'fertig' ? '✓ ' + esc(z.text || 'fertig') : esc(ZUSTAND[z.was] || z.was)}</span>`;
    ul.appendChild(li);
  }
  // Leitung
  $('#leitung').hidden = !istLeiter();
  if (istLeiter()){
    if (!handReihenfolge) handReihenfolge = rangliste(stand.spieler).map(s => s.id);
    handZeigen();
  }
}
$('#spielen').onclick = () => { $('#spielen').disabled = true; senden({ t:'ticket' }); setTimeout(() => { $('#spielen').disabled = false; }, 4000); };
$('#joker').onchange = () => senden({ t:'joker' });
$('#auswerten').onclick = () => { if (confirm('Jetzt auswerten? Wer noch kein Ergebnis hat, bekommt 0 Punkte.')) senden({ t:'auswerten' }); };
$('#ueberspringen').onclick = () => { if (confirm('Diese Disziplin überspringen? Niemand bekommt Punkte.')) senden({ t:'ueberspringen' }); };
$('#handAuf').onclick = () => { $('#hand').hidden = !$('#hand').hidden; };
function handZeigen(){
  const ol = $('#handListe');
  ol.innerHTML = '';
  handReihenfolge.forEach((id, i) => {
    const s = spielerVon(id);
    const li = document.createElement('li');
    li.innerHTML = `<b>${i + 1}.</b><span class="tier">${esc(s.emoji)}</span><span class="name">${esc(s.name)}</span>`;
    const hoch = knopf('↑', 'klein', () => { [handReihenfolge[i - 1], handReihenfolge[i]] = [handReihenfolge[i], handReihenfolge[i - 1]]; handZeigen(); });
    hoch.disabled = i === 0; hoch.setAttribute('aria-label', `${s.name} nach oben`);
    li.appendChild(hoch);
    ol.appendChild(li);
  });
}
$('#handOk').onclick = () => { if (confirm('Mit dieser Reihenfolge werten?')) senden({ t:'hand', reihenfolge:handReihenfolge }); };

/* ---------- Wertung ---------- */
function gesamtListe(ziel, vorher){
  const liste = mitPlatz(rangliste(stand.spieler));
  const altPlatz = vorher ? new Map(mitPlatz(rangliste(vorher)).map(s => [s.id, s.platz])) : null;
  ziel.innerHTML = '';
  for (const s of liste){
    const li = document.createElement('li');
    if (s.id === stand.du) li.className = 'ich';
    let aenderung = '';
    if (altPlatz && altPlatz.has(s.id)){
      const d = altPlatz.get(s.id) - s.platz;
      if (d > 0) aenderung = `<span class="aenderung hoch">▲${d}</span>`;
      else if (d < 0) aenderung = `<span class="aenderung runter">▼${-d}</span>`;
    }
    li.innerHTML = `<span class="platz">${s.platz}.</span><span class="tier">${esc(s.emoji)}</span>
      <span class="name">${esc(s.name)}${aenderung}<span class="detail medaillen">${medaillenText(s.medaillen) || '&nbsp;'}</span></span><span class="pkt">${s.punkte}</span>`;
    ziel.appendChild(li);
  }
}
function wertungZeigen(){
  zeigen('wertung');
  const v = stand.verlauf[stand.verlauf.length - 1];
  const sp = spiel(v.spiel);
  $('#wNr').textContent = `Disziplin ${stand.verlauf.length} von ${stand.plan.length}${v.finale ? ' · Finale, doppelte Punkte' : ''}`;
  $('#wTitel').textContent = `${sp.emoji} ${sp.name}`;
  const ol = $('#wErgebnis');
  ol.innerHTML = '';
  if (v.uebersprungen){
    ol.innerHTML = '<li><span></span><span></span><span class="leise">Übersprungen – keine Punkte.</span><span></span></li>';
  }
  for (const e of v.ergebnis){
    const s = spielerVon(e.s);
    const li = document.createElement('li');
    if (e.s === stand.du) li.className = 'ich';
    const platz = e.platz ? (e.platz <= 3 ? MEDAILLE[e.platz - 1] : e.platz + '.') : '–';
    li.innerHTML = `<span class="platz">${platz}</span><span class="tier">${esc(s.emoji)}</span>
      <span class="name">${esc(s.name)}${e.joker ? ' 🃏' : ''}<span class="detail">${esc(e.text)}</span></span><span class="pkt plus">+${e.punkte}</span>`;
    ol.appendChild(li);
  }
  // Stand vor dieser Disziplin für die Pfeile
  const vorher = stand.spieler.map(s => {
    const e = v.ergebnis.find(x => x.s === s.id);
    const m = s.medaillen.slice();
    if (e && e.platz && e.platz <= 3) m[e.platz - 1]--;
    return { ...s, punkte:s.punkte - (e ? e.punkte : 0), medaillen:m };
  });
  gesamtListe($('#wGesamt'), stand.verlauf.length > 1 ? vorher : null);
  const naechste = stand.plan[stand.nr + 1];
  $('#weiter').hidden = !istLeiter();
  $('#weiter').textContent = naechste ? `Weiter: ${spiel(naechste.spiel).emoji} ${spiel(naechste.spiel).name} →` : 'Zur Siegerehrung 🏆';
  $('#wInfo').textContent = istLeiter() ? '' : `${spielerVon(stand.leiter).name} startet gleich ${naechste ? 'die nächste Disziplin' : 'die Siegerehrung'}.`;
}
$('#weiter').onclick = () => senden({ t:'weiter' });

/* ---------- Siegerehrung ---------- */
function endeZeigen(){
  zeigen('ende');
  const liste = mitPlatz(rangliste(stand.spieler));
  const sieger = liste.filter(s => s.platz === 1);
  $('#eTitel').textContent = sieger.length === 1 ? `${sieger[0].emoji} ${sieger[0].name} gewinnt die Olympiade!` : `Gleichstand an der Spitze: ${sieger.map(s => s.name).join(' & ')}!`;
  const podest = $('#podest');
  podest.innerHTML = '';
  for (const p of [2, 1, 3]){
    const leute = liste.filter(s => s.platz === p);
    const div = document.createElement('div');
    div.className = `stufe p${p}`;
    div.innerHTML = leute.length ? `<span class="tier">${leute.map(s => esc(s.emoji)).join('')}</span><div class="wer">${leute.map(s => esc(s.name)).join(' & ')}</div>
      <div class="leise">${leute[0].punkte} Punkte</div><div class="block">${p}</div>` : `<div class="block">${p}</div>`;
    podest.appendChild(div);
  }
  gesamtListe($('#eGesamt'), null);
  const ul = $('#eSieger');
  ul.innerHTML = '';
  for (const v of stand.verlauf){
    const sp = spiel(v.spiel);
    const erste = v.ergebnis.filter(e => e.platz === 1).map(e => `${spielerVon(e.s).emoji} ${esc(spielerVon(e.s).name)}`);
    const li = document.createElement('li');
    li.innerHTML = `${sp.emoji} <b>${esc(sp.name)}</b>: ${v.uebersprungen ? '<span class="leise">übersprungen</span>' : erste.join(' & ') || '<span class="leise">niemand</span>'}`;
    ul.appendChild(li);
  }
  // Kleine Auszeichnungen aus dem Verlauf
  const aus = [];
  const meisteGold = Math.max(...stand.spieler.map(s => s.medaillen[0]));
  if (meisteGold > 1) aus.push(`🥇 Goldhamster: ${stand.spieler.filter(s => s.medaillen[0] === meisteGold).map(s => esc(s.name)).join(' & ')} (${meisteGold}× Gold)`);
  let jokerBester = null;
  for (const v of stand.verlauf) for (const e of v.ergebnis) if (e.joker && (!jokerBester || e.punkte > jokerBester.punkte)) jokerBester = e;
  if (jokerBester && jokerBester.punkte > 0) aus.push(`🃏 Bester Joker: ${esc(spielerVon(jokerBester.s).name)} (+${jokerBester.punkte})`);
  const podestPlaetze = new Map(stand.spieler.map(s => [s.id, s.medaillen.reduce((a, b) => a + b, 0)]));
  const meistePodest = Math.max(...podestPlaetze.values());
  if (meistePodest > 1) aus.push(`🎖️ Dauergast auf dem Podest: ${stand.spieler.filter(s => podestPlaetze.get(s.id) === meistePodest).map(s => esc(s.name)).join(' & ')}`);
  const letzter = liste[liste.length - 1];
  if (liste.length > 2 && letzter.platz !== 1) aus.push(`🐢 Rote Laterne: ${esc(letzter.name)} – nächstes Mal!`);
  $('#eAuszeichnungen').innerHTML = aus.length ? aus.map(a => `<li>${a}</li>`).join('') : '<li class="leise">Diesmal keine.</li>';
}
$('#nochmal').onclick = () => {
  if (stand) speicher.schreiben('platz.' + stand.code, null);
  senden({ t:'verlassen' });
  stand = null; zuletztCode = null;
  history.replaceState(null, '', '/');
  zeigen('start');
};

// Beim Zurückkommen aus einem Spiel (bfcache) frisch verbinden
window.addEventListener('pageshow', e => { if (e.persisted && (!ws || ws.readyState !== 1)) verbinden(); });
$('#verbindung').hidden = false;
verbinden();
})();
