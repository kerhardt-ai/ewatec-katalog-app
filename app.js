import CONFIG from './config.js';
import INHALTE from './inhalte.js';
import ZUORDNUNG from './zuordnung.js';

/* ---------- Konstanten ---------- */

const KAT = {
  Wasserversorgung: { name: 'Wasserversorgung', lead: 'Tafelwasseranlagen und Wasserspender', img: 'w_mf20' },
  Kaffeeversorgung: { name: 'Kaffeeversorgung', lead: 'Kaffeevollautomaten und Siebträger', img: 'k_g500' },
  Warenautomaten: { name: 'Warenautomaten', lead: 'Snack-, Getränke- und Kaffeeautomaten', img: 'v_gsnack' },
  gemischt: { name: 'Sonstige', lead: 'Ohne Kategorie in Airtable', img: null }
};
// Stichwort, unter dem Zubehör und Lieferpauschalen in Airtable die Versorgungsart führen
const VERSORGUNG_STICHWORT = { Wasserversorgung: 'Wasser', Kaffeeversorgung: 'Kaffee', Warenautomaten: 'Snack' };
const LIEFER_STICHWORT = { Wasserversorgung: 'Wasser', Kaffeeversorgung: 'Kaffee', Warenautomaten: 'Warenautomaten' };
const PREIS_FILTER = [
  ['bis 2.000 €', p => p < 2000],
  ['2.000 bis 5.000 €', p => p >= 2000 && p < 5000],
  ['über 5.000 €', p => p >= 5000]
];
const ENTWURF_KEY = 'ewatec-angebot-entwurf';
const CACHE_KEY = 'ewatec-katalog-cache';
const INHALT_BY_ID = Object.fromEntries(INHALTE.PRODUCTS.map(p => [p.id, p]));

/* ---------- Hilfen ---------- */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const zahl = n => (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = n => zahl(n) + ' €';
const heute = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privater Modus */ } };
const sauber = s => String(s ?? '').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
const nummer = v => (v === '' || v == null || isNaN(Number(v))) ? null : Math.round(Number(v) * 100) / 100;
const liste = v => Array.isArray(v) ? v : (typeof v === 'string' && v ? v.split(',').map(s => s.trim()) : []);

const ICON = {
  schlossZu: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="4" y="9" width="12" height="8.5" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M6.8 9V6.6a3.2 3.2 0 0 1 6.4 0V9" stroke="currentColor" stroke-width="1.6"/></svg>',
  schlossAuf: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="4" y="9" width="12" height="8.5" rx="2" stroke="#0992D1" stroke-width="1.6"/><path d="M6.8 9V6.6a3.2 3.2 0 0 1 6.2-1.1" stroke="#0992D1" stroke-width="1.6"/></svg>',
  lupe: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="flex:0 0 auto"><circle cx="8" cy="8" r="5.5" stroke="#93A4B5" stroke-width="1.6"/><path d="M12.2 12.2L16 16" stroke="#93A4B5" stroke-width="1.6" stroke-linecap="round"/></svg>',
  zurueck: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
};

/* ---------- Zustand ---------- */

const neuePosition = (geraetId = '') => ({ uid: uid(), geraetId, menge: 1, zubehoer: [], installation: '', lieferung: '', care: '' });
const neuesAngebot = () => ({
  finanzierung: 'Miete', laufzeit: 60, einweisung: true,
  kunde: { vertriebler: '', anrede: '', nachname: '', firma: '', strasse: '', plz: '', ort: '', email: '', dealId: '', deckblattDatum: heute() },
  positionen: []
});

const S = {
  data: null, quelle: '', stand: '', ladefehler: '',
  view: 'start', param: '',
  vertrieb: false, q: '', layout: 'karten',
  f: { kat: [], hersteller: [], preis: [] },
  angebot: lsGet(ENTWURF_KEY) || neuesAngebot(),
  mehrZubehoer: {}, fehlend: [], senden: { status: '', text: '' }
};
const speichereEntwurf = () => lsSet(ENTWURF_KEY, S.angebot);

/* ---------- Daten ---------- */

// Antwort des Make-Szenarios: Airtable-Datensätze im API-Format { id, fields: { Feldname: Wert } }.
// Hier werden die Airtable-Feldnamen auf das App-Format übersetzt. Feld in Airtable umbenannt? Dann hier anpassen.
function ausAirtable(roh) {
  const eindeutig = l => [...new Map((l || []).map(r => [r.id, r])).values()]; // Seiten ohne offset liefern Seite 1 doppelt
  const f = r => r.fields || {};
  return {
    stand: roh.stand,
    geraete: eindeutig(roh.geraete).map(r => ({
      id: r.id, name: f(r)['Modellname'], typ: f(r)['Typ'], hersteller: f(r)['Hersteller'],
      kauf: f(r)['Geräte-Preis Kauf'], m36: f(r)['Geräte-Preis 36 Monate'], m48: f(r)['Geräte-Preis 48 Monate'], m60: f(r)['Geräte-Preis 60 Monate'],
      zubehoer: f(r)['Kompatibles_Zubehör'], produktblatt: !!f(r)['Produktblatt']?.length
    })),
    zubehoer: eindeutig(roh.zubehoer).map(r => ({
      id: r.id, name: f(r)['Zubehör Name'], art: f(r)['Art'], versorgung: f(r)['Versorgungsart'],
      kauf: f(r)['Kaufpreis Zubehör'], m36: f(r)['Zubehör-Preis 36 Monate'], m48: f(r)['Zubehör-Preis 48 Monate'], m60: f(r)['Zubehör-Preis 60 Monate'],
      geraete: f(r)['Kompatible Geräte']
    })),
    care: eindeutig(roh.care).map(r => ({ id: r.id, name: f(r)['Servicelevel'], monat: f(r)['Kosten pro Monat'], versorgung: f(r)['Versorgungsart'] })),
    installation: eindeutig(roh.installation).map(r => ({ id: r.id, name: f(r)['Name'], kauf: f(r)['Kaufpreis'], m36: f(r)['36'], m48: f(r)['48'], m60: f(r)['60'], versorgung: f(r)['Versorgungsart'] })),
    lieferung: eindeutig(roh.lieferung).map(r => ({ id: r.id, name: f(r)['Name'], kauf: f(r)['Kaufpreis'], m36: f(r)['36'], m48: f(r)['48'], m60: f(r)['60'], versorgung: f(r)['Versorgung'] })),
    vertrieb: eindeutig(roh.vertrieb).map(r => f(r)['Name']).sort((a, b) => String(a).localeCompare(String(b), 'de'))
  };
}

function normalisiere(roh) {
  if (roh.quelle === 'airtable') roh = ausAirtable(roh);
  const g = (roh.geraete || []).map(x => ({
    id: x.id, name: sauber(x.name), typ: x.typ || 'gemischt', hersteller: sauber(x.hersteller) || '',
    kauf: nummer(x.kauf), m36: nummer(x.m36), m48: nummer(x.m48), m60: nummer(x.m60),
    zubehoer: liste(x.zubehoer), produktblatt: x.produktblatt ?? null
  })).filter(x => x.id && x.name);
  const z = (roh.zubehoer || []).map(x => ({
    id: x.id, name: sauber(x.name), art: x.art || '', versorgung: liste(x.versorgung),
    kauf: nummer(x.kauf), m36: nummer(x.m36), m48: nummer(x.m48), m60: nummer(x.m60), geraete: liste(x.geraete)
  })).filter(x => x.id && x.name);
  const teil = x => ({ id: x.id, name: sauber(x.name), kauf: nummer(x.kauf), m36: nummer(x.m36), m48: nummer(x.m48), m60: nummer(x.m60), versorgung: String(x.versorgung || '') });
  const d = {
    geraete: g.sort((a, b) => a.typ.localeCompare(b.typ) || a.name.localeCompare(b.name, 'de')),
    zubehoer: z.sort((a, b) => a.name.localeCompare(b.name, 'de')),
    care: (roh.care || []).map(x => ({ id: x.id, name: sauber(x.name), monat: nummer(x.monat), versorgung: String(x.versorgung || '') })).filter(x => x.id && x.name),
    installation: (roh.installation || []).map(teil).filter(x => x.id && x.name),
    lieferung: (roh.lieferung || []).map(teil).filter(x => x.id && x.name),
    vertrieb: (roh.vertrieb || []).map(sauber).filter(Boolean)
  };
  d.byId = {};
  for (const k of ['geraete', 'zubehoer', 'care', 'installation', 'lieferung']) for (const x of d[k]) d.byId[x.id] = x;
  // Verknüpfung Zubehör ↔ Gerät kann in Airtable auf beiden Seiten gepflegt sein
  d.kompatibel = {};
  for (const x of d.geraete) d.kompatibel[x.id] = new Set(x.zubehoer.filter(id => d.byId[id]));
  for (const x of d.zubehoer) for (const gid of x.geraete) d.kompatibel[gid]?.add(x.id);
  return d;
}

async function ladeKatalog() {
  const cache = lsGet(CACHE_KEY);
  if (CONFIG.KATALOG_URL) {
    if (cache && Date.now() - cache.zeit < CONFIG.CACHE_MINUTEN * 60000) return fertig(cache.roh, 'cache', cache.zeit);
    try {
      const r = await fetch(CONFIG.KATALOG_URL, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const roh = await r.json();
      if (!roh.geraete?.length) throw new Error('keine Geräte in der Antwort');
      lsSet(CACHE_KEY, { zeit: Date.now(), roh });
      return fertig(roh, 'live', Date.now());
    } catch (e) {
      S.ladefehler = 'Airtable nicht erreichbar (' + e.message + ').';
      if (cache) return fertig(cache.roh, 'cache', cache.zeit);
    }
  }
  const r = await fetch('data/katalog.json');
  const roh = await r.json();
  fertig(roh, 'snapshot', null, roh.stand);
}

function fertig(roh, quelle, zeit, stand) {
  S.data = normalisiere(roh);
  S.quelle = quelle;
  S.stand = zeit ? new Date(zeit).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : (stand || '');
  // Positionen mit Geräten, die es nicht mehr gibt, bleiben sichtbar, aber ohne Gerät
  for (const p of S.angebot.positionen) if (p.geraetId && !S.data.byId[p.geraetId]) p.geraetId = '';
}

function ladeNeu() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* egal */ }
  S.data = null; S.ladefehler = '';
  render();
  ladeKatalog().then(render);
}

/* ---------- Fachlogik ---------- */

function inhalt(g) {
  const z = ZUORDNUNG[g.id];
  const p = z && INHALT_BY_ID[z.inhalt];
  if (!p) return { img: null, voll: null };
  return { img: p.img, voll: z.voll ? p : null };
}

const passtVersorgung = (typ, text, stichworte) => typ === 'gemischt' || !stichworte[typ] || String(text).includes(stichworte[typ]);

function optionenFuer(g) {
  const d = S.data;
  const komp = [...(d.kompatibel[g.id] || [])].map(id => d.byId[id]).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const kompIds = new Set(komp.map(z => z.id));
  const weitere = d.zubehoer.filter(z => !kompIds.has(z.id) && passtVersorgung(g.typ, z.versorgung.join(' '), VERSORGUNG_STICHWORT));
  return {
    komp, weitere,
    care: d.care.filter(c => g.typ === 'gemischt' || c.versorgung === g.typ),
    installation: d.installation.filter(i => g.typ === 'gemischt' || i.versorgung === g.typ),
    lieferung: d.lieferung.filter(l => passtVersorgung(g.typ, l.versorgung, LIEFER_STICHWORT))
  };
}

// Preise einer Position: Kauf einmalig, Miete je Laufzeit (Gerät + Zubehör + Installation + Lieferung), Care monatlich extra
function positionsPreise(p) {
  const d = S.data;
  const g = d.byId[p.geraetId];
  const leer = { kauf: 0, m36: 0, m48: 0, m60: 0, care: 0, luecke: false };
  if (!g) return leer;
  const teile = [g, ...p.zubehoer.map(id => d.byId[id]), d.byId[p.installation], d.byId[p.lieferung]].filter(Boolean);
  const n = Math.max(1, Number(p.menge) || 1);
  const summe = k => Math.round(teile.reduce((s, t) => s + (t[k] || 0), 0) * n * 100) / 100;
  const care = d.byId[p.care];
  return {
    kauf: summe('kauf'), m36: summe('m36'), m48: summe('m48'), m60: summe('m60'),
    care: care ? Math.round((care.monat || 0) * n * 100) / 100 : 0,
    luecke: teile.some(t => t.kauf == null)
  };
}

function gesamt() {
  const t = { kauf: 0, m36: 0, m48: 0, m60: 0, care: 0, luecke: false };
  for (const p of S.angebot.positionen) {
    const x = positionsPreise(p);
    for (const k of ['kauf', 'm36', 'm48', 'm60', 'care']) t[k] = Math.round((t[k] + x[k]) * 100) / 100;
    t.luecke ||= x.luecke;
  }
  return t;
}

function hinzufuegen(geraetId) {
  const a = S.angebot;
  const frei = a.positionen.find(p => !p.geraetId);
  if (frei) frei.geraetId = geraetId;
  else if (a.positionen.length < CONFIG.MAX_POSITIONEN) a.positionen.push(neuePosition(geraetId));
  else return alert('Ein Angebot hat höchstens ' + CONFIG.MAX_POSITIONEN + ' Positionen.');
  speichereEntwurf();
  location.hash = '#/angebot';
}

/* ---------- Angebot senden ---------- */

const PFLICHT = [['vertriebler', 'Vertrieb'], ['anrede', 'Anrede'], ['nachname', 'Nachname'], ['firma', 'Firma'], ['email', 'E-Mail']];

function baueNutzlast() {
  const a = S.angebot, d = S.data;
  const pos = a.positionen.filter(p => d.byId[p.geraetId]);
  const typen = [...new Set(pos.map(p => d.byId[p.geraetId].typ))];
  const L = 'm' + a.laufzeit;
  const t = gesamt();
  const nutz = {
    quelle: 'katalog-app',
    finanzierung: a.finanzierung,
    laufzeit: a.laufzeit + ' Monate',
    kategorie: typen.length === 1 ? typen[0] : 'gemischt',
    einweisung: a.einweisung ? 'JA' : 'NEIN',
    ...a.kunde,
    geraetIds: pos.map(p => p.geraetId).join(','),
    preisGesamt: zahl(a.finanzierung === 'Kauf' ? t.kauf : t[L]),
    careGesamt: t.care ? zahl(t.care) : ''
  };
  for (let i = 0; i < CONFIG.MAX_POSITIONEN; i++) {
    const p = pos[i], k = 'p' + (i + 1) + '_';
    if (!p) {
      Object.assign(nutz, { [k + 'menge']: '', [k + 'geraet']: '', [k + 'geraetId']: '', [k + 'zubehoer']: '', [k + 'care']: '', [k + 'preisCare']: '', [k + 'preisKauf']: '', [k + 'preisMiete']: '' });
      continue;
    }
    const x = positionsPreise(p);
    const extras = [...p.zubehoer, p.installation, p.lieferung].map(id => d.byId[id]?.name).filter(Boolean);
    Object.assign(nutz, {
      [k + 'menge']: String(Math.max(1, Number(p.menge) || 1)),
      [k + 'geraet']: d.byId[p.geraetId].name,
      [k + 'geraetId']: p.geraetId,
      [k + 'zubehoer']: extras.join(', '),
      [k + 'care']: d.byId[p.care]?.name || '',
      [k + 'preisCare']: x.care ? zahl(x.care) : '',
      [k + 'preisKauf']: zahl(x.kauf),
      [k + 'preisMiete']: zahl(x[L])
    });
  }
  return nutz;
}

async function senden() {
  const a = S.angebot;
  S.fehlend = PFLICHT.filter(([k]) => !String(a.kunde[k] || '').trim()).map(([k]) => k);
  if (a.kunde.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.kunde.email)) S.fehlend.push('email');
  const hatPos = a.positionen.some(p => S.data.byId[p.geraetId]);
  if (!hatPos || S.fehlend.length) {
    S.senden = { status: 'fehler', text: !hatPos ? 'Bitte mindestens ein Gerät auswählen.' : 'Bitte die markierten Felder ausfüllen: ' + PFLICHT.filter(([k]) => S.fehlend.includes(k)).map(x => x[1]).join(', ') + '.' };
    return render();
  }
  if (!CONFIG.ANGEBOT_URL) {
    S.senden = { status: 'fehler', text: 'Der Angebots-Webhook ist noch nicht eingetragen (config.js → ANGEBOT_URL).' };
    return render();
  }
  if (!confirm('Angebot für ' + a.kunde.firma + ' erstellen? Der Mail-Entwurf landet in vertrieb@.')) return;
  S.senden = { status: 'laeuft', text: 'Angebot wird übermittelt …' };
  render();
  try {
    // Formular-Kodierung vermeidet den CORS-Preflight, Make liest das Feld "data" als JSON
    const r = await fetch(CONFIG.ANGEBOT_URL, { method: 'POST', body: new URLSearchParams({ data: JSON.stringify(baueNutzlast()) }) });
    const text = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + text.slice(0, 120));
    let nr = '';
    try { nr = JSON.parse(text).nr || ''; } catch { /* Antwort "Accepted" */ }
    S.senden = { status: 'ok', text: (nr ? 'Angebot Nr. ' + nr : 'Angebot') + ' wird erstellt. PDF und Mail-Entwurf liegen in etwa einer Minute im Postfach vertrieb@, der Pipedrive-Deal wird aktualisiert.' };
    a.gesendet = new Date().toISOString();
    speichereEntwurf();
  } catch (e) {
    S.senden = { status: 'fehler', text: e instanceof TypeError
      ? 'Keine Bestätigung von Make erhalten. Bitte erst im Postfach vertrieb@ prüfen, ob der Entwurf angekommen ist, bevor du erneut sendest.'
      : 'Senden fehlgeschlagen: ' + e.message };
  }
  render();
}

/* ---------- Bausteine ---------- */

function bild(g, gross) {
  const i = inhalt(g);
  if (i.img) return `<div class="bild"><img src="bilder/${esc(i.img)}.webp" alt="${esc(g.name)}" loading="lazy"></div>`;
  return `<div class="platzhalter"${gross ? ' style="height:100%"' : ''}><span>${gross ? 'Produktbild ' + esc(g.name) : ''}</span></div>`;
}

const preisKurz = g => S.vertrieb ? (g.kauf != null ? eur(g.kauf) : '–') : 'Preis auf Anfrage';

function kopf() {
  const n = S.angebot.positionen.filter(p => p.geraetId).length;
  const nav = [['start', 'Start'], ['katalog', 'Katalog'], ['angebot', 'Angebot']].map(([k, l]) => {
    const aktiv = S.view === k || (k === 'katalog' && S.view === 'geraet');
    return `<button class="nav-btn${aktiv ? ' aktiv' : ''}" data-go="${k}">${l}${k === 'angebot' && n ? `<span class="zahl">${n}</span>` : ''}</button>`;
  }).join('');
  return `<header class="kopf"><div class="innen kopf-zeile">
    <div class="marke" data-go="start"><b>ewatec</b><span>Produktkatalog</span></div>
    <nav class="haupt">${nav}</nav>
    <div class="suche"><div class="suche-feld">${ICON.lupe}<input id="suche" value="${esc(S.q)}" placeholder="Modell, Hersteller, Kategorie" autocomplete="off"></div><div id="treffer">${treffer()}</div></div>
    <button class="modus-btn" data-action="modus" title="${S.vertrieb ? 'Vertriebsmodus aktiv' : 'Kundenmodus'}">${S.vertrieb ? ICON.schlossAuf : ICON.schlossZu}</button>
  </div>${S.vertrieb ? '<div class="modus-leiste"><div class="innen"><span class="punkt"></span><span>Vertriebsmodus · Netto-Preise, Mietraten und interne Hinweise sichtbar</span></div></div>' : ''}</header>`;
}

function treffer() {
  const q = S.q.trim().toLowerCase();
  if (!q || !S.data) return '';
  const r = S.data.geraete.filter(g => [g.name, g.hersteller, g.typ, inhalt(g).voll?.sub].join(' ').toLowerCase().includes(q)).slice(0, 8);
  return `<div class="suche-treffer">${r.length ? r.map(g => `
    <div class="treffer" data-open="${esc(g.id)}"><div class="mini">${bild(g)}</div>
      <div class="treffer-text"><b>${esc(g.name)}</b><span>${esc([g.hersteller, KAT[g.typ]?.name].filter(Boolean).join(' · '))}</span></div></div>`).join('')
    : `<div style="padding:18px 14px;color:var(--text-3)">Keine Treffer für „${esc(S.q)}“.</div>`}</div>`;
}

function fuss() {
  const quelle = { live: 'Preise live aus Airtable', cache: 'Preise aus Airtable (zwischengespeichert)', snapshot: 'Preise aus lokalem Datenstand' }[S.quelle] || '';
  return `<footer class="fuss"><div class="innen">
    <span>ewatec e.K.</span><span>·</span><span>Isny im Allgäu</span><span>·</span><a href="mailto:info@ewatec.biz">info@ewatec.biz</a><span>·</span><span>Alle Preise netto zzgl. MwSt.</span>
    ${S.vertrieb && quelle ? `<span>·</span><span>${quelle}${S.stand ? ', Stand ' + esc(S.stand) : ''}</span><span>·</span><a href="#" data-action="neu-laden">neu laden</a>` : ''}
  </div></footer>`;
}

/* ---------- Ansichten ---------- */

function viewStart() {
  const d = S.data;
  const kacheln = ['Wasserversorgung', 'Kaffeeversorgung', 'Warenautomaten'].map(k => {
    const n = d.geraete.filter(g => g.typ === k).length;
    return `<div class="kachel" data-kat="${k}">
      ${KAT[k].img ? `<div class="bild"><img src="bilder/${KAT[k].img}.webp" alt=""></div>` : '<div class="platzhalter"></div>'}
      <div class="kachel-text"><b>${KAT[k].name}</b><span>${n} Geräte · ${esc(KAT[k].lead)}</span></div></div>`;
  }).join('');
  return `<section class="start">
    <div style="display:flex;flex-direction:column;gap:20px;max-width:760px">
      <span class="eyebrow">Produktkatalog ${new Date().getFullYear()}</span>
      <h1 class="gross">Wasser, Kaffee und Verpflegung für Ihr Unternehmen</h1>
      <p class="lead">Geräte, Montage und Service durch eigene Techniker aus Isny im Allgäu.</p>
    </div>
    <div class="kacheln">${kacheln}</div>
    <div class="einstiege">
      <div class="einstieg blau" data-go="angebot"><small>Angebot</small><div><b>Angebot zusammenstellen</b><span>Geräte wählen, Kauf und Miete vergleichen, direkt versenden.</span></div></div>
      <div class="einstieg" data-go="katalog"><small style="color:var(--text-3)">Übersicht</small><div><b>Alle Geräte auf einen Blick</b><span style="color:var(--text-2)">${d.geraete.length} Geräte, filterbar nach Kategorie und Hersteller.</span></div></div>
    </div>
  </section>`;
}

function gefiltert() {
  const f = S.f;
  return S.data.geraete.filter(g =>
    (!f.kat.length || f.kat.includes(g.typ)) &&
    (!f.hersteller.length || f.hersteller.includes(g.hersteller || 'ohne Angabe')) &&
    (!S.vertrieb || !f.preis.length || (g.kauf != null && PREIS_FILTER.some(([l, fn]) => f.preis.includes(l) && fn(g.kauf)))));
}

function viewKatalog() {
  const d = S.data, f = S.f;
  const liste = gefiltert();
  const chip = (gruppe, wert, label = wert) => `<button class="chip${f[gruppe].includes(wert) ? ' aktiv' : ''}" data-filter="${gruppe}" data-wert="${esc(wert)}">${esc(label)}</button>`;
  const typen = Object.keys(KAT).filter(t => d.geraete.some(g => g.typ === t));
  const basis = d.geraete.filter(g => !f.kat.length || f.kat.includes(g.typ));
  const hersteller = [...new Set(basis.map(g => g.hersteller || 'ohne Angabe'))].sort((a, b) => a.localeCompare(b, 'de'));
  const gruppen = [
    ['Kategorie', typen.map(t => chip('kat', t, KAT[t]?.name || t)).join('')],
    ['Hersteller', hersteller.map(h => chip('hersteller', h)).join('')]
  ];
  if (S.vertrieb) gruppen.push(['Kaufpreis netto', PREIS_FILTER.map(([l]) => chip('preis', l)).join('')]);
  const aktiv = f.kat.length + f.hersteller.length + (S.vertrieb ? f.preis.length : 0) > 0;

  const karten = liste.map(g => {
    const v = inhalt(g).voll;
    return `<div class="karte" data-open="${esc(g.id)}">${bild(g)}
      <div class="karte-text">
        <span class="klein">${esc(g.hersteller || KAT[g.typ]?.name || '')}</span>
        <b>${esc(g.name)}</b>
        <span class="unter">${esc(v?.sub || KAT[g.typ]?.name || '')}</span>
        <div class="karte-fuss"><div>${preisKurz(g)}${S.vertrieb && g.m60 ? `<br><small>ab ${eur(g.m60)} / Monat</small>` : ''}</div>
          <button class="plus" data-add="${esc(g.id)}" title="Zum Angebot hinzufügen">${ICON.plus}</button></div>
      </div></div>`;
  }).join('');

  const tabelle = `<div class="tabelle-rahmen"><table class="tabelle"><thead><tr><th>Gerät</th><th>Kategorie</th><th>Hersteller</th><th class="r">Kauf</th><th class="r">36 Monate</th><th class="r">48 Monate</th><th class="r">60 Monate</th></tr></thead><tbody>
    ${liste.map(g => `<tr class="zeile" data-open="${esc(g.id)}"><td>${esc(g.name)}</td><td>${esc(KAT[g.typ]?.name || g.typ)}</td><td>${esc(g.hersteller || '–')}</td>
      ${S.vertrieb ? `<td class="r">${g.kauf != null ? eur(g.kauf) : '–'}</td><td class="r">${g.m36 ? eur(g.m36) : '–'}</td><td class="r">${g.m48 ? eur(g.m48) : '–'}</td><td class="r">${g.m60 ? eur(g.m60) : '–'}</td>`
        : '<td class="r" colspan="4" style="color:var(--text-3)">auf Anfrage</td>'}</tr>`).join('')}
  </tbody></table></div>`;

  return `<section class="uebersicht">
    <div class="kopfzeile">
      <div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Katalog</span>
        <h2 class="titel">${liste.length === d.geraete.length ? 'Alle Geräte auf einen Blick' : liste.length + ' von ' + d.geraete.length + ' Geräten'}</h2></div>
      <div class="umschalter">${[['karten', 'Karten'], ['tabelle', 'Tabelle']].map(([k, l]) => `<button class="${S.layout === k ? 'aktiv' : ''}" data-layout="${k}">${l}</button>`).join('')}</div>
    </div>
    <div class="layout-filter">
      <aside class="filter">${gruppen.map(([t, h]) => `<div class="filtergruppe"><span class="label">${t}</span><div>${h}</div></div>`).join('')}
        ${aktiv ? '<button class="mehr" data-action="filter-reset">Filter zurücksetzen</button>' : ''}</aside>
      <div class="ergebnis">${liste.length ? (S.layout === 'karten' ? `<div class="karten">${karten}</div>` : tabelle)
        : '<div class="leer"><span>Kein Gerät passt zu dieser Filterkombination.</span><button class="btn" data-action="filter-reset">Filter zurücksetzen</button></div>'}</div>
    </div>
  </section>`;
}

function viewGeraet() {
  const d = S.data, g = d.byId[S.param];
  if (!g || !d.geraete.includes(g)) return `<section class="detail"><div class="leer"><span>Dieses Gerät gibt es in Airtable nicht mehr.</span><button class="btn" data-go="katalog">Zum Katalog</button></div></section>`;
  const v = inhalt(g).voll;
  const o = optionenFuer(g);
  const preis = S.vertrieb
    ? `<div class="preisbox">
        <div class="zeile haupt"><span>Kauf netto</span><b>${g.kauf != null ? eur(g.kauf) : '–'}</b></div>
        ${CONFIG.LAUFZEITEN.map(l => `<div class="zeile"><span>Miete ${l} Monate</span><b>${g['m' + l] ? eur(g['m' + l]) + ' / Monat' : '–'}</b></div>`).join('')}
      </div>`
    : `<div class="preisbox"><div class="zeile haupt"><span>Preis</span><b>Preis auf Anfrage</b></div></div>`;
  const zub = o.komp.map(z => `<div><div>${esc(z.name)}${z.art ? `<small>${esc(z.art)}</small>` : ''}</div>
    <span class="p">${S.vertrieb ? (z.kauf != null ? eur(z.kauf) : '–') + (z.m60 ? `<small>ab ${eur(z.m60)} / Monat</small>` : '') : ''}</span></div>`).join('');
  return `<section class="detail">
    <button class="btn" style="align-self:flex-start" data-action="zurueck">${ICON.zurueck} Zurück</button>
    <div class="detail-oben">
      <div class="detail-bild">${bild(g, true)}</div>
      <div class="detail-info">
        <div style="display:flex;flex-direction:column;gap:14px">
          <span class="eyebrow">${esc([g.hersteller, KAT[g.typ]?.name].filter(Boolean).join(' · '))}</span>
          <h1>${esc(g.name)}</h1>
          ${v?.sub ? `<span class="lead">${esc(v.sub)}</span>` : ''}
        </div>
        ${v?.features?.length ? `<ul class="merkmale">${v.features.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${preis}
        <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn primaer" data-add="${esc(g.id)}">${ICON.plus} Zum Angebot hinzufügen</button></div>
        ${S.vertrieb && v?.internal ? `<div class="intern"><span class="label">Intern · Hinweis für den Vertrieb</span><span style="font-size:16px;line-height:1.5;color:#D6DFE7">${esc(v.internal)}</span></div>` : ''}
      </div>
    </div>
    ${v?.fits || v?.pitch ? `<div class="zwei">
      ${v.fits ? `<div style="display:flex;flex-direction:column;gap:10px"><span class="label">Passt zu</span><p>${esc(v.fits)}</p></div>` : ''}
      ${v.pitch ? `<div style="display:flex;flex-direction:column;gap:10px"><span class="label">Verkaufsargument</span><p>${esc(v.pitch)}</p></div>` : ''}
    </div>` : ''}
    ${v?.specs?.length ? `<div style="display:flex;flex-direction:column;gap:20px"><h3 class="titel">Technische Daten</h3>
      <div class="daten">${v.specs.map(([a, b]) => `<div><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}</div></div>` : ''}
    ${zub ? `<div style="display:flex;flex-direction:column;gap:20px"><h3 class="titel">Passendes Zubehör</h3><div class="zubehoer-liste">${zub}</div></div>` : ''}
  </section>`;
}

function viewAngebot() {
  const a = S.angebot, d = S.data;
  const L = 'm' + a.laufzeit;
  const fehlt = k => S.fehlend.includes(k) ? ' fehlt' : '';
  const k = a.kunde;

  const geraeteOptionen = sel => ['Wasserversorgung', 'Kaffeeversorgung', 'Warenautomaten', 'gemischt']
    .map(t => [t, d.geraete.filter(g => g.typ === t)]).filter(([, l]) => l.length)
    .map(([t, l]) => `<optgroup label="${esc(KAT[t]?.name || t)}">${l.map(g => `<option value="${esc(g.id)}"${g.id === sel ? ' selected' : ''}>${esc(g.name)}${g.kauf != null ? ' · ' + eur(g.kauf) : ''}</option>`).join('')}</optgroup>`).join('');

  const auswahl = (pi, feld, liste, wert, leerText, preisFn) => `<label class="feld"><span>${leerText}</span>
    <select data-pos="${pi}" data-feld="${feld}"><option value="">keine Auswahl</option>
    ${liste.map(x => `<option value="${esc(x.id)}"${x.id === wert ? ' selected' : ''}>${esc(x.name)} · ${preisFn(x)}</option>`).join('')}</select></label>`;
  const teilPreis = x => a.finanzierung === 'Kauf' ? eur(x.kauf) : eur(x[L]) + ' / Monat';

  const positionen = a.positionen.map((p, i) => {
    const g = d.byId[p.geraetId];
    let rest = '';
    if (g) {
      const o = optionenFuer(g);
      const mehr = S.mehrZubehoer[p.uid];
      const zChip = z => `<button class="chip${p.zubehoer.includes(z.id) ? ' aktiv' : ''}" data-zub="${esc(z.id)}" data-pos="${i}">${esc(z.name)}<small>${teilPreis(z)}</small></button>`;
      // gewähltes Zubehör aus "weitere" bleibt sichtbar, auch wenn die Liste zugeklappt ist
      const weitereSichtbar = mehr ? o.weitere : o.weitere.filter(z => p.zubehoer.includes(z.id));
      const x = positionsPreise(p);
      rest = `
        <div class="feld"><span>Zubehör${o.komp.length ? '' : ' (in Airtable ist kein passendes Zubehör verknüpft)'}</span>
          <div class="optionen">${o.komp.map(zChip).join('')}${weitereSichtbar.map(zChip).join('')}</div>
          ${o.weitere.length ? `<button class="mehr" data-mehr="${p.uid}">${mehr ? 'Weiteres Zubehör ausblenden' : 'Weiteres Zubehör anzeigen (' + o.weitere.length + ')'}</button>` : ''}
        </div>
        <div class="felder">
          ${auswahl(i, 'installation', o.installation, p.installation, 'Installationseinheit', teilPreis)}
          ${auswahl(i, 'lieferung', o.lieferung, p.lieferung, 'Lieferung', teilPreis)}
          ${auswahl(i, 'care', o.care, p.care, 'ewatec Care (monatlich)', c => eur(c.monat) + ' / Monat')}
        </div>
        <div class="pos-summe">
          <span>Kauf <b>${eur(x.kauf)}</b></span>
          ${CONFIG.LAUFZEITEN.map(l => `<span>${l} Mon. <b>${eur(x['m' + l])}</b></span>`).join('')}
          ${x.care ? `<span>Care <b>${eur(x.care)} / Monat</b></span>` : ''}
          ${x.luecke ? '<span style="color:var(--heiss)">Ein Teil hat in Airtable keinen Preis</span>' : ''}
        </div>`;
    }
    return `<div class="position">
      <div class="position-kopf"><b>Position ${i + 1}</b><button class="btn klein" data-entfernen="${i}">Entfernen</button></div>
      <div class="position-zeile">
        <label class="feld"><span>Gerät</span><select data-pos="${i}" data-feld="geraetId"><option value="">Gerät auswählen</option>${geraeteOptionen(p.geraetId)}</select></label>
        <label class="feld"><span>Menge</span><input type="number" min="1" max="99" inputmode="numeric" value="${esc(p.menge)}" data-pos="${i}" data-feld="menge"></label>
      </div>${rest}</div>`;
  }).join('');

  const t = gesamt();
  const kf = (key, label, typ = 'text', extra = '') => `<label class="feld${fehlt(key)}${extra}"><span>${label}</span><input type="${typ}" value="${esc(k[key])}" data-kunde="${key}"${typ === 'email' ? ' inputmode="email" autocapitalize="off"' : ''}></label>`;
  const laeuft = S.senden.status === 'laeuft';

  return `<section class="angebot">
    <div class="kopfzeile">
      <div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Angebot</span><h2 class="titel">Angebot zusammenstellen</h2></div>
      <button class="btn" data-action="angebot-neu">Neues Angebot</button>
    </div>
    <div class="angebot-raster">
      <div style="display:flex;flex-direction:column;gap:24px">
        <div class="block">
          <div class="block-kopf"><h3>Finanzierung</h3></div>
          <div class="schalter-reihe">${['Kauf', 'Miete'].map(x => `<button class="chip${a.finanzierung === x ? ' aktiv' : ''}" data-fin="${x}">${x === 'Miete' ? 'Miete / Leasing' : 'Kauf'}</button>`).join('')}</div>
          ${a.finanzierung === 'Miete' ? `<div class="schalter-reihe">${CONFIG.LAUFZEITEN.map(l => `<button class="chip${a.laufzeit === l ? ' aktiv' : ''}" data-laufzeit="${l}">${l} Monate</button>`).join('')}</div>` : ''}
          <label class="check"><input type="checkbox" data-action="einweisung"${a.einweisung ? ' checked' : ''}> Inbetriebnahme und Einweisung</label>
        </div>

        <div class="block">
          <div class="block-kopf"><h3>Positionen (${a.positionen.length} von ${CONFIG.MAX_POSITIONEN})</h3>
            ${a.positionen.length < CONFIG.MAX_POSITIONEN ? `<button class="btn klein" data-action="pos-neu">${ICON.plus} Position</button>` : ''}</div>
          ${positionen || '<div class="leer" style="padding:28px"><span>Noch keine Position. Gerät hier auswählen oder im Katalog mit + hinzufügen.</span><button class="btn" data-action="pos-neu">' + ICON.plus + ' Position hinzufügen</button></div>'}
        </div>

        <div class="block">
          <div class="block-kopf"><h3>Kunde</h3></div>
          <div class="felder">
            <label class="feld${fehlt('vertriebler')}"><span>Vertrieb</span><select data-kunde="vertriebler"><option value="">auswählen</option>${d.vertrieb.map(n => `<option${n === k.vertriebler ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
            <label class="feld${fehlt('anrede')}"><span>Anrede</span><select data-kunde="anrede"><option value="">auswählen</option>${['Herr', 'Frau'].map(n => `<option${n === k.anrede ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
            ${kf('nachname', 'Nachname Ansprechpartner')}
            ${kf('firma', 'Firma')}
            ${kf('strasse', 'Straße und Hausnummer')}
            ${kf('plz', 'PLZ')}
            ${kf('ort', 'Ort')}
            ${kf('email', 'E-Mail', 'email')}
            ${kf('dealId', 'Pipedrive Deal-ID (optional)')}
            ${kf('deckblattDatum', 'Datum auf dem Deckblatt', 'date')}
          </div>
        </div>
      </div>

      <aside class="summe">
        <div class="summe-box">
          <div class="kopf"><span class="label">Preisübersicht netto</span></div>
          <table class="vergleich">
            <tr class="${a.finanzierung === 'Kauf' ? 'gewaehlt' : ''}"><td>Kauf<small>einmalig</small></td><td>${eur(t.kauf)}</td></tr>
            ${CONFIG.LAUFZEITEN.map(l => `<tr class="${a.finanzierung === 'Miete' && a.laufzeit === l ? 'gewaehlt' : ''}"><td>Miete ${l} Monate<small>pro Monat</small></td><td>${eur(t['m' + l])}</td></tr>`).join('')}
            ${t.care ? `<tr><td>ewatec Care<small>pro Monat, zusätzlich</small></td><td>${eur(t.care)}</td></tr>` : ''}
          </table>
          <div class="summe-fuss">Alle Preise netto zzgl. MwSt.${a.finanzierung === 'Miete' ? '<br>' + esc(CONFIG.HINWEIS_MIETE) + '.' : ''}${t.luecke ? '<br><span style="color:var(--heiss)">Mindestens ein Teil hat in Airtable keinen Preis.</span>' : ''}</div>
        </div>
        <button class="btn primaer" style="height:56px;font-size:17px" data-action="senden"${laeuft ? ' disabled' : ''}>${laeuft ? 'Wird gesendet …' : (a.finanzierung === 'Kauf' ? 'Kaufangebot' : 'Mietangebot') + ' erstellen'}</button>
        ${S.senden.text ? `<div class="meldung ${S.senden.status === 'ok' ? 'ok' : S.senden.status === 'laeuft' ? 'info' : 'fehler'}">${esc(S.senden.text)}</div>` : ''}
        ${a.gesendet && S.senden.status !== 'ok' ? `<div class="meldung info">Dieser Entwurf wurde am ${new Date(a.gesendet).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} schon einmal gesendet.</div>` : ''}
      </aside>
    </div>
  </section>`;
}

/* ---------- Rendern ---------- */

function render() {
  const app = document.getElementById('app');
  if (!S.data) {
    app.innerHTML = `<main class="innen"><p class="daten-hinweis">Katalog wird geladen …</p></main>`;
    return;
  }
  const inhaltHtml = { start: viewStart, katalog: viewKatalog, geraet: viewGeraet, angebot: viewAngebot }[S.view]();
  const warn = S.ladefehler ? `<div class="innen"><p class="daten-hinweis warn">${esc(S.ladefehler)} Die App zeigt den ${S.quelle === 'cache' ? 'zuletzt geladenen' : 'lokalen'} Datenstand.</p></div>` : '';
  // Fokus merken und nach dem Neuzeichnen wiederherstellen
  const el = document.activeElement;
  const fokus = el?.id === 'suche' ? '#suche'
    : el?.dataset?.kunde ? `[data-kunde="${el.dataset.kunde}"]`
    : el?.dataset?.feld ? `[data-pos="${el.dataset.pos}"][data-feld="${el.dataset.feld}"]` : null;
  app.innerHTML = kopf() + warn + `<main class="innen">${inhaltHtml}</main>` + fuss();
  const neu = fokus && app.querySelector(fokus);
  if (neu) {
    neu.focus({ preventScroll: true });
    if (neu.tagName === 'INPUT' && neu.type === 'text') neu.setSelectionRange(neu.value.length, neu.value.length);
  }
}

function route() {
  const [, view = 'start', param = ''] = location.hash.split('/');
  S.view = ['start', 'katalog', 'geraet', 'angebot'].includes(view) ? view : 'start';
  S.param = decodeURIComponent(param);
  S.q = '';
  if (S.view !== 'angebot') S.fehlend = [];
  render();
  window.scrollTo(0, 0);
}

/* ---------- Ereignisse ---------- */

const app = document.getElementById('app');

app.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-open],[data-add],[data-kat],[data-filter],[data-layout],[data-action],[data-fin],[data-laufzeit],[data-zub],[data-mehr],[data-entfernen]');
  if (!t) {
    if (S.q && !e.target.closest('.suche')) { S.q = ''; document.getElementById('treffer').innerHTML = ''; }
    return;
  }
  const a = S.angebot, ds = t.dataset;
  if (ds.add) { e.stopPropagation(); return hinzufuegen(ds.add); }
  if (ds.go) { location.hash = '#/' + ds.go; return; }
  if (ds.open) { location.hash = '#/geraet/' + encodeURIComponent(ds.open); return; }
  if (ds.kat) { S.f = { kat: [ds.kat], hersteller: [], preis: [] }; location.hash = '#/katalog'; return; }
  if (ds.filter) { const l = S.f[ds.filter]; S.f[ds.filter] = l.includes(ds.wert) ? l.filter(x => x !== ds.wert) : [...l, ds.wert]; if (ds.filter === 'kat') S.f.hersteller = []; return render(); }
  if (ds.layout) { S.layout = ds.layout; return render(); }
  if (ds.fin) { a.finanzierung = ds.fin; speichereEntwurf(); return render(); }
  if (ds.laufzeit) { a.laufzeit = Number(ds.laufzeit); speichereEntwurf(); return render(); }
  if (ds.zub) { const p = a.positionen[ds.pos]; p.zubehoer = p.zubehoer.includes(ds.zub) ? p.zubehoer.filter(x => x !== ds.zub) : [...p.zubehoer, ds.zub]; speichereEntwurf(); return render(); }
  if (ds.mehr) { S.mehrZubehoer[ds.mehr] = !S.mehrZubehoer[ds.mehr]; return render(); }
  if (ds.entfernen) { a.positionen.splice(Number(ds.entfernen), 1); speichereEntwurf(); return render(); }
  switch (ds.action) {
    case 'modus': S.vertrieb = !S.vertrieb; if (!S.vertrieb) S.f.preis = []; return render();
    case 'filter-reset': S.f = { kat: [], hersteller: [], preis: [] }; return render();
    case 'zurueck': return history.length > 1 ? history.back() : (location.hash = '#/katalog');
    case 'pos-neu': a.positionen.push(neuePosition()); speichereEntwurf(); return render();
    case 'angebot-neu':
      if (a.positionen.length && !a.gesendet && !confirm('Aktuellen Entwurf verwerfen?')) return;
      S.angebot = neuesAngebot(); S.senden = { status: '', text: '' }; S.fehlend = []; speichereEntwurf(); return render();
    case 'senden': return senden();
    case 'neu-laden': e.preventDefault(); return ladeNeu();
  }
});

app.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'suche') { S.q = t.value; document.getElementById('treffer').innerHTML = treffer(); return; }
  if (t.dataset.kunde && t.tagName === 'INPUT') { S.angebot.kunde[t.dataset.kunde] = t.value; speichereEntwurf(); }
});

app.addEventListener('change', e => {
  const t = e.target, ds = t.dataset, a = S.angebot;
  if (ds.action === 'einweisung') { a.einweisung = t.checked; speichereEntwurf(); return; }
  if (ds.kunde) {
    // kein Neuzeichnen: sonst verliert das nächste Feld beim Tippen den Fokus
    a.kunde[ds.kunde] = t.value;
    S.fehlend = S.fehlend.filter(x => x !== ds.kunde);
    t.closest('.feld')?.classList.remove('fehlt');
    speichereEntwurf();
    return;
  }
  if (ds.pos != null && ds.feld) {
    const p = a.positionen[ds.pos];
    if (ds.feld === 'menge') p.menge = Math.min(99, Math.max(1, parseInt(t.value, 10) || 1));
    else if (ds.feld === 'geraetId') Object.assign(p, { geraetId: t.value, zubehoer: [], installation: '', lieferung: '', care: '' });
    else p[ds.feld] = t.value;
    speichereEntwurf();
    render();
  }
});

app.addEventListener('keydown', e => {
  if (e.target.id === 'suche' && e.key === 'Enter') { const f = document.querySelector('.treffer'); if (f) f.click(); }
  if (e.target.id === 'suche' && e.key === 'Escape') { S.q = ''; e.target.value = ''; document.getElementById('treffer').innerHTML = ''; }
});

window.addEventListener('hashchange', route);

ladeKatalog()
  .catch(e => { S.ladefehler = 'Katalog konnte nicht geladen werden: ' + e.message; })
  .then(() => {
    if (!S.data) {
      document.getElementById('app').innerHTML = `<main class="innen"><div class="leer" style="margin:48px 0"><span>${esc(S.ladefehler)}</span></div></main>`;
      return;
    }
    route();
  });
