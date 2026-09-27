'use strict';
// Olympiade – Server: Lobby für bis zu 8 Leute, Disziplinen aus der Spielesammlung, Punkte und Medaillen.
// Die Spiele selbst laufen auf ihren eigenen Servern. Wer eine Disziplin startet, bekommt ein
// signiertes Ticket (olymp.js), mit dem er direkt im richtigen Raum landet. Das Spiel meldet
// das Ergebnis an /api/ergebnis zurück, hier wird daraus die Wertung.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const zugang = require('./zugang')({ titel:'Olympiade', offen:['/api/ergebnis', '/api/status'] });
const werkzeug = require('./olymp').werkzeug();
const { SPIELE, spielUrl } = require('./spiele');

const PORT = Number(process.env.PORT) || 10500;
const MAX_SPIELER = 8;
const MAX_OLYMPIADEN = 60;
const PUNKTE = [10, 8, 6, 5, 4, 3, 2, 1];
const TICKET_DAUER = 4 * 3600_000;
const AUFHEBEN = 24 * 3600_000;         // so lange bleibt eine Olympiade ohne Aktivität erhalten
const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EMOJIS = ['🦁', '🐯', '🐻', '🐼', '🦊', '🐸', '🐧', '🐵', '🦄', '🐙', '🦈', '🐢', '🦉', '🐨', '🦩', '🐳'];

const TYPEN = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8', '.svg':'image/svg+xml'
};
const DATEIEN = new Map([
  ['/', 'index.html'], ['/index.html', 'index.html'], ['/hub.js', 'hub.js'], ['/hub.css', 'hub.css'],
  ['/icon.svg', 'icon.svg'], ['/fonts/bricolage-grotesque.woff2', 'fonts/bricolage-grotesque.woff2'],
  ['/fonts/OFL-Bricolage.txt', 'fonts/OFL-Bricolage.txt']
]);

function senden(res, datei, cache){
  const voll = path.join(__dirname, datei);
  fs.readFile(voll, (fehler, daten) => {
    if (fehler){ res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'Content-Type':TYPEN[path.extname(voll)] || 'application/octet-stream', 'Cache-Control':cache, 'X-Content-Type-Options':'nosniff' });
    res.end(daten);
  });
}
function json(res, status, daten){
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
  res.end(JSON.stringify(daten));
}
function koerperLesen(req){
  return new Promise((ok, nein) => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 20_000){ nein(new Error('zu groß')); req.destroy(); } });
    req.on('end', () => ok(d));
    req.on('error', nein);
  });
}

/* ---------- Olympiaden ---------- */
const olympiaden = new Map();   // code -> Olympiade
const laeufe = new Map();       // laufId -> Olympiade

const nameOk = n => String(n || '').replace(/[\u0000-\u001f\u007f<>&"]/g, '').trim().slice(0, 16);
const zufall = n => crypto.randomBytes(n).toString('hex');
function neuerCode(){
  for (;;){
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_ZEICHEN[crypto.randomInt(CODE_ZEICHEN.length)];
    if (!olympiaden.has(c)) return c;
  }
}
function mischen(a){ for (let i = a.length - 1; i > 0; i--){ const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Einstellungen einer Disziplin gegen den Katalog prüfen
function einstPruefen(spiel, e){
  const aus = {};
  e = e && typeof e === 'object' ? e : {};
  for (const opt of SPIELE[spiel].einst){
    const erlaubt = opt.werte.map(w => w[0]);
    aus[opt.id] = erlaubt.includes(e[opt.id]) ? e[opt.id] : opt.std;
  }
  return aus;
}
function standardPlan(){
  return Object.keys(SPIELE).map(spiel => ({ spiel, einst:einstPruefen(spiel, {}) }));
}

function spielerListe(o){ return [...o.spieler.values()]; }
function aktivBerühren(o){ o.zuletzt = Date.now(); }

// Was ein Browser über die Olympiade erfährt (Token bleiben geheim)
function standFuer(o, sp){
  const l = o.lauf;
  return {
    t:'stand', code:o.code, phase:o.phase, leiter:o.leiter, du:sp.id, nr:o.nr, plan:o.plan, einst:o.einst,
    spieler:spielerListe(o).map(s => ({
      id:s.id, name:s.name, emoji:s.emoji, punkte:s.punkte, medaillen:s.medaillen, joker:s.joker,
      online:s.verbindungen.size > 0
    })),
    lauf:l ? {
      id:l.id, spiel:l.spiel, einst:l.einst, gruppen:l.gruppen, start:l.start,
      zustand:Object.fromEntries(spielerListe(o).map(s => [s.id, laufZustand(o, s.id)])),
      jokerHier:spielerListe(o).filter(s => s.joker === o.nr).map(s => s.id)
    } : null,
    verlauf:o.verlauf
  };
}
function laufZustand(o, id){
  const l = o.lauf;
  if (!l) return null;
  if (l.werte[id]) return { was:'fertig', text:l.werte[id].text };
  for (const [g, rang] of Object.entries(l.raenge)) if (rang.some(r => r.s === id)) return { was:'fertig', text:(rang.find(r => r.s === id) || {}).text || '' };
  const g = l.gruppen.findIndex(gr => gr.includes(id));
  const st = l.status[g];
  if (st && (st.drin.includes(id) || (st.da && st.da.includes(id)))) return { was:st.phase === 'laeuft' ? 'spielt' : 'da' };
  if (l.tickets.has(id)) return { was:'unterwegs' };
  return { was:'bereit' };
}
function verteilen(o){
  aktivBerühren(o);
  for (const s of o.spieler.values()){
    const m = JSON.stringify(standFuer(o, s));
    for (const ws of s.verbindungen) if (ws.readyState === 1) ws.send(m);
  }
}

function olympiadeErstellen(){
  const o = {
    code:neuerCode(), leiter:null, phase:'lobby', spieler:new Map(), plan:standardPlan(),
    einst:{ joker:true, finaleDoppelt:true }, nr:-1, lauf:null, verlauf:[], zuletzt:Date.now()
  };
  olympiaden.set(o.code, o);
  return o;
}
function spielerDazu(o, name, emoji){
  const belegt = new Set(spielerListe(o).map(s => s.emoji));
  const s = {
    id:zufall(4), token:zufall(16), name, emoji:EMOJIS.includes(emoji) && !belegt.has(emoji) ? emoji : EMOJIS.find(e => !belegt.has(e)),
    punkte:0, medaillen:[0, 0, 0], joker:null, verbindungen:new Set()
  };
  o.spieler.set(s.id, s);
  if (!o.leiter) o.leiter = s.id;
  return s;
}

// Gruppen bilden: Spiele mit kleinen Räumen (Weltreiche: 4) bekommen Vorläufe mit ähnlich vielen Leuten
function gruppenBilden(o, spiel){
  const ids = mischen(spielerListe(o).map(s => s.id));
  const max = SPIELE[spiel].gruppeMax || MAX_SPIELER;
  const anzahl = Math.ceil(ids.length / max);
  const gruppen = Array.from({ length:anzahl }, () => []);
  ids.forEach((id, i) => gruppen[i % anzahl].push(id));
  return gruppen;
}

// Spieleserver aufwecken (Render schläft nach 15 Minuten ohne Besuch ein)
function aufwecken(spiel){
  const url = spielUrl(spiel);
  fetch(url + '/healthz', { signal:AbortSignal.timeout(60_000) }).catch(() => {});
}

function disziplinStarten(o){
  o.nr++;
  if (o.nr >= o.plan.length){ o.phase = 'ende'; o.lauf = null; return; }
  const { spiel, einst } = o.plan[o.nr];
  const l = {
    id:zufall(8), spiel, einst, start:Date.now(), gruppen:gruppenBilden(o, spiel),
    status:{}, raenge:{}, werte:{}, tickets:new Map(), fertig:false
  };
  if (o.lauf) laeufe.delete(o.lauf.id);
  o.lauf = l;
  laeufe.set(l.id, o);
  o.phase = 'disziplin';
  aufwecken(spiel);
  const naechste = o.plan[o.nr + 1];
  if (naechste) setTimeout(() => aufwecken(naechste.spiel), 60_000);
}

function ticketFuer(o, s, basis){
  const l = o.lauf;
  const g = l.gruppen.findIndex(gr => gr.includes(s.id));
  const inhalt = {
    sp:SPIELE[l.spiel].sp, o:o.code, l:l.id, g, s:s.id, n:s.name,
    m:l.gruppen[g].map(id => ({ s:id, n:o.spieler.get(id).name })),
    c:l.einst, u:basis, z:`${basis}/?code=${o.code}`, ti:`Olympiade ${o.code}`, nr:o.nr + 1, von:o.plan.length,
    bis:Date.now() + TICKET_DAUER
  };
  return `${spielUrl(l.spiel)}${SPIELE[l.spiel].pfad}?olymp=${werkzeug.ausstellen(inhalt)}`;
}

// Ist die Disziplin komplett? Rang-Spiele: alle Gruppen haben gemeldet. Wert-Spiele: alle Spieler.
function vollstaendig(o){
  const l = o.lauf;
  if (SPIELE[l.spiel].wertung === 'rang') return l.gruppen.every((_, g) => l.raenge[g]);
  return spielerListe(o).every(s => l.werte[s.id]);
}

// Aus den Meldungen die Plätze machen und Punkte vergeben
function auswerten(o, hand){
  const l = o.lauf;
  if (!l || l.fertig) return;
  l.fertig = true;
  const spiel = SPIELE[l.spiel];
  let plaetze = [];   // [{ s, platz, text }]
  if (hand){
    plaetze = hand.map((s, i) => ({ s, platz:i + 1, text:'von Hand' }));
  } else if (spiel.wertung === 'rang'){
    // In jeder Gruppe zählt die Reihenfolge; Vorläufe werden nebeneinander gewertet
    for (const rang of Object.values(l.raenge)){
      let vorher = null;
      rang.forEach((r, i) => {
        // Gleicher Wert wie der Vordermann (z. B. gleich viele Punkte) = gleicher Platz
        const platz = vorher && r.wert != null && r.wert === vorher.wert ? vorher.platz : i + 1;
        vorher = { wert:r.wert, platz };
        if (o.spieler.has(r.s) && !plaetze.some(p => p.s === r.s)) plaetze.push({ s:r.s, platz, text:r.text || '' });
      });
    }
  } else {
    const liste = Object.entries(l.werte).filter(([s]) => o.spieler.has(s)).sort((a, b) => b[1].wert - a[1].wert);
    liste.forEach(([s, w], i) => {
      const platz = i > 0 && w.wert === liste[i - 1][1].wert ? plaetze[i - 1].platz : i + 1;
      plaetze.push({ s, platz, text:w.text || '' });
    });
  }
  const finale = o.einst.finaleDoppelt && o.nr === o.plan.length - 1 && o.plan.length > 1;
  const ergebnis = [];
  for (const s of spielerListe(o)){
    const p = plaetze.find(x => x.s === s.id);
    let punkte = p ? PUNKTE[p.platz - 1] || 0 : 0;
    const joker = s.joker === o.nr;
    if (joker) punkte *= 2;
    if (finale) punkte *= 2;
    s.punkte += punkte;
    if (p && p.platz <= 3) s.medaillen[p.platz - 1]++;
    ergebnis.push({ s:s.id, platz:p ? p.platz : null, text:p ? p.text : 'nicht gewertet', punkte, joker });
  }
  ergebnis.sort((a, b) => (a.platz ?? 99) - (b.platz ?? 99));
  o.verlauf.push({ spiel:l.spiel, einst:l.einst, finale, ergebnis });
  o.phase = 'wertung';
  verteilen(o);
}

/* ---------- HTTP ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok:true });
  if (req.method === 'GET' && url.pathname.startsWith('/datenschutz')) return senden(res, 'datenschutz.html', 'no-cache');

  // Meldungen der Spieleserver (signiert statt Passwort-Cookie)
  if (req.method === 'POST' && (url.pathname === '/api/ergebnis' || url.pathname === '/api/status')){
    let text;
    try { text = await koerperLesen(req); } catch (e) { return json(res, 400, { fehler:'zu groß' }); }
    if (!werkzeug.meldungOk(text, req.headers['x-olymp-signatur'])) return json(res, 403, { fehler:'Signatur' });
    let m;
    try { m = JSON.parse(text); } catch (e) { return json(res, 400, { fehler:'JSON' }); }
    const o = laeufe.get(m.lauf);
    if (!o || !o.lauf || o.lauf.id !== m.lauf) return json(res, 404, { fehler:'Lauf unbekannt' });
    const l = o.lauf;
    const g = Number.isInteger(m.gruppe) && l.gruppen[m.gruppe] ? m.gruppe : 0;
    if (url.pathname === '/api/status'){
      const st = l.status[g] || (l.status[g] = { drin:[], da:[], phase:'warten' });
      if (Array.isArray(m.drin)) st.drin = m.drin.filter(s => typeof s === 'string').slice(0, 20);
      if (typeof m.da === 'string' && !st.da.includes(m.da)) st.da.push(m.da);
      if (['warten', 'laeuft'].includes(m.phase)) st.phase = m.phase;
      if (!l.fertig) verteilen(o);
      return json(res, 200, { ok:true });
    }
    if (l.fertig) return json(res, 409, { fehler:'schon ausgewertet' });
    if (m.art === 'rang' && Array.isArray(m.rang)){
      if (!l.raenge[g]) l.raenge[g] = m.rang.filter(r => r && typeof r.s === 'string' && l.gruppen[g].includes(r.s))
        .map(r => ({ s:r.s, text:String(r.text || '').slice(0, 40), wert:Number.isFinite(r.wert) ? r.wert : null }));
    } else if (m.art === 'wert' && typeof m.s === 'string' && o.spieler.has(m.s) && Number.isFinite(m.wert)){
      if (!l.werte[m.s]) l.werte[m.s] = { wert:m.wert, text:String(m.text || '').slice(0, 40) };
    } else return json(res, 400, { fehler:'Meldung unvollständig' });
    if (vollstaendig(o)) auswerten(o); else verteilen(o);
    return json(res, 200, { ok:true });
  }

  if (zugang.pruefen(req, res)) return;
  if (req.method === 'GET' && DATEIEN.has(url.pathname)){
    const datei = DATEIEN.get(url.pathname);
    return senden(res, datei, datei.startsWith('fonts') ? 'public, max-age=604800' : 'no-cache');
  }
  res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
  res.end('Nicht gefunden');
});

/* ---------- WebSocket für die Olympiade-Seite ---------- */
const wss = new WebSocketServer({ server, path:'/ws', maxPayload:8192, verifyClient:({ req }) => zugang.hatZugang(req) });
function sende(ws, m){ if (ws.readyState === 1) ws.send(JSON.stringify(m)); }

function verbinden(ws, o, s){
  if (ws.o && ws.s) ws.s.verbindungen.delete(ws);
  ws.o = o; ws.s = s;
  s.verbindungen.add(ws);
  sende(ws, { t:'drin', code:o.code, token:s.token, id:s.id });
  verteilen(o);
}

wss.on('connection', (ws, req) => {
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  ws.basis = `${proto === 'https' ? 'https' : 'http'}://${req.headers.host}`;
  ws.lebt = true; ws.o = null; ws.s = null; ws.zaehler = 0;
  ws.on('pong', () => { ws.lebt = true; });
  sende(ws, { t:'hallo', spiele:SPIELE, emojis:EMOJIS, punkte:PUNKTE, max:MAX_SPIELER });
  ws.on('message', roh => {
    if (++ws.zaehler > 40) return;
    let m;
    try { m = JSON.parse(roh); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const o = ws.o, s = ws.s;
    const leiter = !!o && o.leiter === s.id;
    const fehler = text => sende(ws, { t:'fehler', text });
    switch (m.t){
      case 'erstellen': {
        const name = nameOk(m.name);
        if (!name) return fehler('Gib zuerst deinen Namen ein.');
        if (olympiaden.size >= MAX_OLYMPIADEN) return fehler('Gerade laufen zu viele Olympiaden. Versuch es später nochmal.');
        const neu = olympiadeErstellen();
        return verbinden(ws, neu, spielerDazu(neu, name, m.emoji));
      }
      case 'beitreten': {
        const ziel = olympiaden.get(String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
        if (!ziel) return sende(ws, { t:'fehler', text:'Diese Olympiade gibt es nicht (mehr). Prüf den Code.', code:'weg' });
        const alt = typeof m.token === 'string' && spielerListe(ziel).find(x => x.token === m.token);
        if (alt) return verbinden(ws, ziel, alt);
        const name = nameOk(m.name);
        if (!name) return sende(ws, { t:'fehler', text:'Gib zuerst deinen Namen ein.', code:'name' });
        if (ziel.phase !== 'lobby') return fehler('Diese Olympiade läuft schon. Mitmachen geht nur vor dem Start.');
        if (ziel.spieler.size >= MAX_SPIELER) return fehler('Die Olympiade ist voll (8 Leute).');
        if (spielerListe(ziel).some(x => x.name.toLowerCase() === name.toLowerCase())) return fehler('Diesen Namen gibt es hier schon. Nimm einen anderen.');
        return verbinden(ws, ziel, spielerDazu(ziel, name, m.emoji));
      }
    }
    if (!o) return;
    switch (m.t){
      case 'emoji':
        if (EMOJIS.includes(m.emoji) && !spielerListe(o).some(x => x !== s && x.emoji === m.emoji)){ s.emoji = m.emoji; verteilen(o); }
        break;
      case 'plan': {
        if (!leiter || o.phase !== 'lobby' || !Array.isArray(m.plan)) return;
        const plan = m.plan.filter(d => d && SPIELE[d.spiel]).slice(0, 12).map(d => ({ spiel:d.spiel, einst:einstPruefen(d.spiel, d.einst) }));
        if (!plan.length) return fehler('Wähl mindestens eine Disziplin aus.');
        o.plan = plan;
        if (m.einst && typeof m.einst === 'object') o.einst = { joker:m.einst.joker !== false, finaleDoppelt:m.einst.finaleDoppelt !== false };
        verteilen(o);
        break;
      }
      case 'starten':
        if (!leiter || o.phase !== 'lobby') return;
        disziplinStarten(o); verteilen(o);
        break;
      case 'ticket': {
        if (o.phase !== 'disziplin' || !o.lauf) return;
        o.lauf.tickets.set(s.id, Date.now());
        sende(ws, { t:'ticket', url:ticketFuer(o, s, ws.basis) });
        verteilen(o);
        break;
      }
      case 'joker':
        // Nur vor dem eigenen Start und nur einmal pro Olympiade
        if (!o.einst.joker || o.phase !== 'disziplin' || !o.lauf || o.lauf.tickets.has(s.id)) return;
        if (s.joker !== null && s.joker !== o.nr) return fehler('Deinen Joker hast du schon eingesetzt.');
        s.joker = s.joker === o.nr ? null : o.nr;
        verteilen(o);
        break;
      case 'auswerten':
        if (leiter && o.phase === 'disziplin') auswerten(o);
        break;
      case 'hand': {
        if (!leiter || o.phase !== 'disziplin' || !Array.isArray(m.reihenfolge)) return;
        const r = [...new Set(m.reihenfolge.filter(id => o.spieler.has(id)))];
        auswerten(o, r);
        break;
      }
      case 'ueberspringen':
        if (!leiter || o.phase !== 'disziplin') return;
        o.lauf.fertig = true;
        for (const x of o.spieler.values()) if (x.joker === o.nr) x.joker = null;   // Joker gibt es zurück
        o.verlauf.push({ spiel:o.lauf.spiel, einst:o.lauf.einst, uebersprungen:true, ergebnis:[] });
        o.phase = 'wertung';
        verteilen(o);
        break;
      case 'weiter':
        if (!leiter || o.phase !== 'wertung') return;
        disziplinStarten(o); verteilen(o);
        break;
      case 'rauswerfen':
        if (!leiter || o.phase !== 'lobby' || m.id === s.id || !o.spieler.has(m.id)) return;
        for (const w of o.spieler.get(m.id).verbindungen){ sende(w, { t:'fehler', text:'Du wurdest aus der Olympiade genommen.', code:'weg' }); w.o = w.s = null; }
        o.spieler.delete(m.id);
        verteilen(o);
        break;
      case 'leiterWerden': {
        // Wenn der Leiter weg ist, darf jemand anderes übernehmen
        const l = o.spieler.get(o.leiter);
        if (l && l.verbindungen.size) return fehler('Die Leitung ist noch da.');
        o.leiter = s.id; verteilen(o);
        break;
      }
      case 'verlassen':
        s.verbindungen.delete(ws);
        if (o.phase === 'lobby'){
          o.spieler.delete(s.id);
          if (o.leiter === s.id) o.leiter = spielerListe(o)[0]?.id || null;
          if (!o.spieler.size) olympiaden.delete(o.code);
        }
        ws.o = ws.s = null;
        if (olympiaden.has(o.code)) verteilen(o);
        break;
    }
  });
  ws.on('close', () => { if (ws.s){ ws.s.verbindungen.delete(ws); if (olympiaden.has(ws.o.code)) verteilen(ws.o); } });
});

setInterval(() => {
  for (const ws of wss.clients){
    ws.zaehler = 0;
  }
}, 1000).unref();
setInterval(() => {
  for (const ws of wss.clients){
    if (!ws.lebt){ ws.terminate(); continue; }
    ws.lebt = false;
    try { ws.ping(); } catch (e) { /* egal */ }
  }
  const jetzt = Date.now();
  for (const [code, o] of olympiaden){
    if (jetzt - o.zuletzt > AUFHEBEN){ if (o.lauf) laeufe.delete(o.lauf.id); olympiaden.delete(code); }
  }
}, 30_000).unref();

server.listen(PORT, () => console.log(`Olympiade läuft auf http://localhost:${PORT}`));
