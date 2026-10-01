// Geräteberater: Merkmale je Gerät und die Fragen pro Bereich.
//
// Merkmale werden über Regeln aus dem Modellnamen in Airtable abgeleitet. Neue Geräte laufen so
// automatisch mit, solange der Name dem bekannten Muster folgt. Für Sonderfälle gibt es unten
// AUSNAHMEN (Record-ID → Merkmale), die die Regeln überschreiben.
//
// Merkmale:
//   bereich      wasser | bottle | kaffee | barista | vending | (leer = nicht im Berater)
//   bauform      Wasser: theke | stand | untertisch     Kaffee: tisch | becher
//   leistung     Wasser: l/h   Kaffee: Tassen pro Tag   Siebträger: Gruppen   Automat: Schächte
//   heiss        true = Heißwasser
//   milch        frisch | instant | keine
//   wasser       fest | tank   (Kaffee, leer = beides möglich oder unbekannt)
//   tall         true = Tall Cup für To-go-Becher
//   linie        einstieg | mittel | premium
//   sortiment    snack | drink | frozen | kaffee | nonfood
//   aussen       true = Outdoor-Ausführung
//   touch        true = Touchdisplay
//   lift         true = Lift für empfindliche Ware
//   erweiterung  true = Slave- oder Zusatzeinheit, wird nur zusammen mit einem Hauptgerät verkauft
//   pruefen      true = Merkmale geschätzt, bitte gegen das Datenblatt prüfen

const REGELN = [
  // ---------- Tafelwasser ----------
  [/^MF 10 UP/i, { bereich: 'wasser', bauform: 'theke', leistung: 10 }],
  [/^MF 20 UPH/i, { bereich: 'wasser', bauform: 'theke', leistung: 20, heiss: true }],
  [/^MF 20 UP/i, { bereich: 'wasser', bauform: 'theke', leistung: 20 }],
  [/^M1 OF/i, { bereich: 'wasser', bauform: 'stand', leistung: 10 }],
  [/^M2 OF/i, { bereich: 'wasser', bauform: 'stand', leistung: 20 }],
  [/^Blusoda Box.*Hot/i, { bereich: 'wasser', bauform: 'untertisch', leistung: 30, heiss: true }],
  [/^Blusoda Box/i, { bereich: 'wasser', bauform: 'untertisch', leistung: 30 }],
  [/^Blusoda.*HOT/i, { bereich: 'wasser', bauform: 'theke', leistung: 30, heiss: true }],
  [/^Blusoda.*45/i, { bereich: 'wasser', bauform: 'theke', leistung: 45 }],
  [/^Blusoda/i, { bereich: 'wasser', bauform: 'theke', leistung: 30 }],
  [/^(Rock|Rebel) Super Hot/i, { bereich: 'wasser', bauform: 'theke', leistung: 30, heiss: true, touch: false }],
  [/^Cool ?1/i, { bereich: 'wasser', bauform: 'stand', leistung: 80 }],
  [/^Piccola Box/i, { bereich: 'wasser', bauform: 'untertisch', leistung: 15 }],
  [/^Piccola/i, { bereich: 'wasser', bauform: 'theke', leistung: 15, pruefen: true }],
  [/^IQ\.?BIG/i, { bereich: 'wasser', bauform: 'stand', leistung: 150, pruefen: true }],
  [/Osmose/i, { bereich: '' }], // Filtertechnik, kein eigenständiges Gerät
  // ---------- Wasserspender mit Bottle ----------
  [/^F-Max HC/i, { bereich: 'bottle', bauform: 'stand', heiss: true }],
  [/^F-Max/i, { bereich: 'bottle', bauform: 'stand' }],
  [/^Aquality/i, { bereich: 'bottle', bauform: 'stand', sprudel: true }],
  // ---------- Kaffeevollautomaten ----------
  [/^Magic M/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 80, milch: 'frisch', wasser: 'tank', linie: 'einstieg' }],
  [/^Magic B/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 80, milch: 'keine', wasser: 'tank', linie: 'einstieg' }],
  [/^Vitro S1.*FW/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 80, milch: 'instant', wasser: 'fest', linie: 'einstieg' }],
  [/^Vitro S1/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 80, milch: 'instant', wasser: 'tank', linie: 'einstieg' }],
  [/^G50/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 50, milch: 'instant', wasser: 'fest', linie: 'einstieg' }],
  [/^G100.*M\b|^G100.*\dRM/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 100, milch: 'frisch', linie: 'mittel' }],
  [/^G100/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 100, milch: 'instant', linie: 'mittel' }],
  [/^G300/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 150, milch: 'instant', linie: 'mittel' }],
  [/^G500/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 200, milch: 'frisch', touch: true, linie: 'premium' }],
  [/^G700/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 300, milch: 'frisch', touch: true, linie: 'premium' }],
  [/MasterBrew/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 250, milch: 'keine', linie: 'mittel', filter: true }],
  [/^Barista 200/i, { bereich: 'kaffee', bauform: 'becher', leistung: 200, milch: 'instant', linie: 'mittel' }],
  [/^Barista 500/i, { bereich: 'kaffee', bauform: 'becher', leistung: 300, milch: 'instant', touch: true, linie: 'premium' }],
  [/^Necta Swing/i, { bereich: 'kaffee', bauform: 'becher', leistung: 150, milch: 'instant', linie: 'einstieg', gebraucht: true }],
  [/^Animo/i, { bereich: 'kaffee', bauform: 'tisch', leistung: 150, milch: 'instant', linie: 'einstieg', gebraucht: true, pruefen: true }],
  // ---------- Siebträger ----------
  [/^GT3 1-gruppig/i, { bereich: 'barista', leistung: 1, linie: 'einstieg' }],
  [/^GT3 2-gruppig Tall/i, { bereich: 'barista', leistung: 2, tall: true, linie: 'einstieg' }],
  [/^GT3 2-gruppig/i, { bereich: 'barista', leistung: 2, linie: 'einstieg' }],
  [/^La Nera/i, { bereich: 'barista', leistung: 2, linie: 'einstieg' }],
  [/^La Vetro Pro (\d).*Tall/i, m => ({ bereich: 'barista', leistung: +m[1], tall: true, linie: 'premium' })],
  [/^La Vetro Pro (\d)/i, m => ({ bereich: 'barista', leistung: +m[1], linie: 'premium' })],
  [/^La Vetro (\d)/i, m => ({ bereich: 'barista', leistung: +m[1], linie: 'mittel' })],
  [/^GT7 (\d).*Tall/i, m => ({ bereich: 'barista', leistung: +m[1], tall: true, linie: 'premium' })],
  [/^GT7 (\d)/i, m => ({ bereich: 'barista', leistung: +m[1], linie: 'premium' })],
  // ---------- Warenautomaten ----------
  [/Frozen/i, { bereich: 'vending', sortiment: ['frozen'] }],
  [/^G-Snack/i, { bereich: 'vending', sortiment: ['snack', 'drink'] }],
  [/^G-Drink/i, { bereich: 'vending', sortiment: ['drink'] }],
  [/(Narrow|Flex|Super)stack|^B&C/i, { bereich: 'vending', sortiment: ['drink'] }],
  [/^Locker/i, { bereich: 'vending', sortiment: ['nonfood'] }],
  [/Trommelautomat/i, { bereich: 'vending', sortiment: ['snack', 'nonfood'], leistung: 6 }],
  [/^(Brain|Multibox)/i, { bereich: 'vending', sortiment: [], erweiterung: true }]
];

const AUSNAHMEN = {
  // recXXXXXXXXXXXXXX: { leistung: 25 },
};

export function merkmale(g) {
  let m = { bereich: '' };
  for (const [rx, wert] of REGELN) {
    const treffer = g.name.match(rx);
    if (treffer) { m = { ...(typeof wert === 'function' ? wert(treffer) : wert) }; break; }
  }
  if (m.bereich === 'vending') {
    const n = g.name;
    m.aussen = /\bOD\b|outdoor/i.test(n);
    if (m.touch == null) m.touch = /touch/i.test(n) && !/für Touch/i.test(n);
    m.lift = /mit Lift/i.test(n);
    if (/slave|für Touch/i.test(n)) m.erweiterung = true;
    if (m.leistung == null) { const z = n.match(/\b[A-Z]{1,3}X? ?(\d{1,2})\b/); m.leistung = z ? +z[1] : null; }
  }
  return { ...m, ...(AUSNAHMEN[g.id] || {}) };
}

const ja = (x, text) => x ? { punkte: 3, grund: text } : null;

// Jede Antwort bewertet ein Gerät: null = passt nicht, { punkte, grund } = passt (grund erscheint in der Empfehlung).
// weich: true = passt trotzdem mit Abzug, wenn sonst nichts übrig bleibt.
export const BEREICHE = [
  {
    key: 'wasser', titel: 'Wasser', sub: 'Tafelwasseranlagen und Wasserspender', bild: 'w_mf20',
    fragen: [
      {
        key: 'anschluss', frage: 'Gibt es einen Wasseranschluss in der Nähe?',
        antworten: [
          { titel: 'Ja', sub: 'Festwasser, unbegrenzt Wasser', test: m => m.bereich === 'wasser' ? { punkte: 2, grund: 'Festwasseranschluss, kein Flaschenschleppen' } : null },
          { titel: 'Nein', sub: 'Wasserspender mit 18,9-l-Bottles', test: m => m.bereich === 'bottle' ? { punkte: 2, grund: 'Braucht nur eine Steckdose' } : null }
        ]
      },
      {
        key: 'personen', frage: 'Wie viele Personen trinken täglich?', nur: a => a.anschluss !== 1,
        antworten: [
          { titel: 'bis 15', sub: 'Kleines Büro, Praxis', test: m => bedarf(m.leistung, 10, 20, 'Passende Leistung für kleine Teams') },
          { titel: '15 bis 50', sub: 'Büro, Verwaltung', test: m => bedarf(m.leistung, 20, 45, 'Genug Leistung für 15 bis 50 Personen') },
          { titel: '50 bis 100', sub: 'Mehrere Abteilungen', test: m => bedarf(m.leistung, 45, 80, 'Hohe Leistung für bis zu 100 Personen') },
          { titel: 'über 100', sub: 'Kantine, Produktion, Self-Service', test: m => bedarf(m.leistung, 80, 999, 'Kantinentauglich für über 100 Personen') }
        ]
      },
      {
        key: 'ort', frage: 'Wo soll das Gerät stehen?', nur: a => a.anschluss !== 1,
        antworten: [
          { titel: 'Auf der Theke', sub: 'Arbeitsfläche ist frei', test: m => ja(m.bauform === 'theke', 'Auftischgerät für die Arbeitsfläche') },
          { titel: 'Freistehend', sub: 'Keine Theke, z. B. Flur oder Empfang', test: m => ja(m.bauform === 'stand', 'Standgerät, braucht keine Theke') },
          { titel: 'Unter der Spüle', sub: 'Unsichtbar, Zapfhahn an der Spüle', test: m => ja(m.bauform === 'untertisch', 'Verschwindet im Unterschrank') },
          { titel: 'Egal', sub: 'Platz ist vorhanden', test: () => ({ punkte: 0 }) }
        ]
      },
      {
        key: 'heiss', frage: 'Soll das Gerät auch heißes Wasser liefern?',
        antworten: [
          { titel: 'Ja', sub: 'Tee und Instant ohne Wasserkocher', test: m => ja(m.heiss, 'Heißwasser für Tee, ersetzt den Wasserkocher') },
          { titel: 'Nein', sub: 'Still, gekühlt, sprudelnd reicht', test: m => m.heiss ? { punkte: -1, weich: true } : { punkte: 1 } }
        ]
      }
    ]
  },
  {
    key: 'kaffee', titel: 'Kaffee', sub: 'Kaffeevollautomaten fürs Büro', bild: 'k_g500',
    fragen: [
      {
        key: 'tassen', frage: 'Wie viele Tassen am Tag?',
        antworten: [
          { titel: 'bis 50', sub: 'Kleines Team', test: m => bedarf(m.leistung, 40, 100, 'Ausgelegt für kleine Teams') },
          { titel: '50 bis 100', sub: 'Büro mit 20 bis 40 Personen', test: m => bedarf(m.leistung, 80, 150, 'Schafft 50 bis 100 Tassen am Tag') },
          { titel: '100 bis 200', sub: 'Größeres Büro, Bäckerei', test: m => bedarf(m.leistung, 150, 250, 'Schafft 100 bis 200 Tassen am Tag') },
          { titel: 'über 200', sub: 'Großer Standort, Kantine', test: m => bedarf(m.leistung, 200, 999, 'Für über 200 Tassen am Tag') }
        ]
      },
      {
        key: 'milch', frage: 'Welche Getränke sollen raus?',
        antworten: [
          { titel: 'Cappuccino mit frischer Milch', sub: 'Milchschaum wie im Café', test: m => ja(m.milch === 'frisch', 'Frischmilch für echten Milchschaum') },
          { titel: 'Milchgetränke aus Pulver', sub: 'Einfach, wenig Reinigung', test: m => ja(m.milch === 'instant', 'Milch- und Kakaopulver, wenig Reinigungsaufwand') || (m.milch === 'frisch' ? { punkte: 1, grund: 'Kann auch mit Frischmilch' } : null) },
          { titel: 'Nur Kaffee und Espresso', sub: 'Schwarz', test: m => ({ punkte: m.milch === 'keine' ? 2 : 1 }) }
        ]
      },
      {
        key: 'bedienung', frage: 'Wie wird der Kaffee geholt?',
        antworten: [
          { titel: 'Mit eigener Tasse', sub: 'Tischgerät in der Teeküche', test: m => ja(m.bauform === 'tisch', 'Tischgerät für die eigene Tasse') },
          { titel: 'Self-Service mit Becher', sub: 'Standautomat, Bezahlsystem möglich', test: m => ja(m.bauform === 'becher', 'Becherautomat mit Bezahlsystem möglich') }
        ]
      },
      {
        key: 'wasser', frage: 'Gibt es einen Wasseranschluss am Aufstellort?',
        antworten: [
          { titel: 'Ja', sub: 'Festwasser', test: m => m.wasser === 'tank' ? { punkte: -1, weich: true } : { punkte: m.wasser === 'fest' ? 2 : 1, grund: m.wasser === 'fest' ? 'Festwasseranschluss, kein Nachfüllen' : undefined } },
          { titel: 'Nein', sub: 'Wassertank', test: m => m.wasser === 'fest' ? null : { punkte: m.wasser === 'tank' ? 2 : 0, grund: m.wasser === 'tank' ? 'Mit Wassertank, kein Anschluss nötig' : undefined } }
        ]
      }
    ]
  },
  {
    key: 'barista', titel: 'Siebträger', sub: 'Gastronomie, Bäckerei, Hotel', bild: 'gg_gt7_life',
    fragen: [
      {
        key: 'menge', frage: 'Wie viele Kaffees in der Spitze?',
        antworten: [
          { titel: 'bis 150 am Tag', sub: 'Kleines Café, Büro', test: m => ja(m.leistung === 1, '1 Gruppe reicht für diese Menge') || (m.leistung === 2 ? { punkte: 1, weich: true } : null) },
          { titel: '150 bis 400 am Tag', sub: 'Café, Bäckerei', test: m => ja(m.leistung === 2, '2 Gruppen für den normalen Gastrobetrieb') },
          { titel: 'über 400 am Tag', sub: 'Hohe Frequenz', test: m => ja(m.leistung === 3, '3 Gruppen für Stoßzeiten') || (m.leistung === 2 ? { punkte: 0, weich: true } : null) }
        ]
      },
      {
        key: 'tall', frage: 'Werden To-go-Becher befüllt?',
        antworten: [
          { titel: 'Ja', sub: 'Hohe Becher unter der Brühgruppe', test: m => ja(m.tall, 'Tall Cup, passt für hohe To-go-Becher') || { punkte: -2, weich: true } },
          { titel: 'Nein', sub: 'Tassen und Gläser', test: m => ({ punkte: m.tall ? 0 : 1 }) }
        ]
      },
      {
        key: 'linie', frage: 'Welche Ausstattung soll es sein?',
        antworten: [
          { titel: 'Solide Einstiegsklasse', sub: 'Gutes Preis-Leistungs-Verhältnis', test: m => ja(m.linie === 'einstieg', 'Robuste Einstiegsklasse zum fairen Preis') || { punkte: -1, weich: true } },
          { titel: 'Gehobene Mitte', sub: 'Mehr Komfort im Alltag', test: m => ja(m.linie === 'mittel', 'Gehobene Ausstattung') || { punkte: 0 } },
          { titel: 'Premium', sub: 'Beste Technik, Design', test: m => ja(m.linie === 'premium', 'Premium-Technik und Design') || { punkte: -1, weich: true } }
        ]
      }
    ]
  },
  {
    key: 'vending', titel: 'Warenautomat', sub: 'Snacks, Getränke, Tiefkühl, Non-Food', bild: 'v_gsnack',
    fragen: [
      {
        key: 'sortiment', frage: 'Was soll verkauft werden?',
        antworten: [
          { titel: 'Snacks', sub: 'Riegel, Chips, Sandwiches', test: m => ja(m.sortiment?.includes('snack'), 'Für Snacks ausgelegt') },
          { titel: 'Kalte Getränke', sub: 'Dosen, PET, Glas', test: m => ja(m.sortiment?.[0] === 'drink', 'Reiner Getränkeautomat mit hoher Kapazität') || ja(m.sortiment?.includes('drink'), 'Getränke und Snacks in einem Gerät') },
          { titel: 'Tiefkühlware', sub: 'Eis, Pizza, Fertiggerichte', test: m => ja(m.sortiment?.includes('frozen'), 'Tiefkühlautomat') },
          { titel: 'Non-Food', sub: 'Arbeitsschutz, Ersatzteile', test: m => ja(m.sortiment?.includes('nonfood'), 'Für Non-Food-Artikel') }
        ]
      },
      {
        key: 'ort', frage: 'Wo steht der Automat?',
        antworten: [
          { titel: 'Innen', sub: 'Pausenraum, Foyer', test: m => m.aussen ? null : { punkte: 2, grund: 'Für den Innenbereich' } },
          { titel: 'Außen', sub: 'Wetterfest, beheizte Scheibe', test: m => ja(m.aussen, 'Outdoor-Ausführung, wetterfest') }
        ]
      },
      {
        key: 'groesse', frage: 'Wie viele Personen kaufen am Automaten?',
        antworten: [
          { titel: 'bis 50', sub: 'Kleiner Betrieb', test: m => bedarf(m.leistung, 0, 6, 'Kompakte Größe für kleine Betriebe') },
          { titel: '50 bis 150', sub: 'Mittlerer Betrieb', test: m => bedarf(m.leistung, 7, 8, 'Mittlere Größe, gute Auswahl') },
          { titel: 'über 150', sub: 'Schichtbetrieb, großer Standort', test: m => bedarf(m.leistung, 9, 99, 'Große Kapazität, seltener Nachfüllen') }
        ]
      },
      {
        key: 'bedienung', frage: 'Wie soll bezahlt und bedient werden?',
        antworten: [
          { titel: 'Touchdisplay', sub: 'Modern, Karte und Handy', test: m => ja(m.touch, 'Touchdisplay, modern und intuitiv') || { punkte: -1, weich: true } },
          { titel: 'Klassisch mit Tasten', sub: 'Robust, günstiger', test: m => m.touch ? { punkte: -1, weich: true } : { punkte: 2, grund: 'Robuste Tastenbedienung' } }
        ]
      },
      {
        key: 'lift', frage: 'Gibt es empfindliche Ware wie Glasflaschen oder Kuchen?', nur: a => a.sortiment === 0 || a.sortiment === 1,
        antworten: [
          { titel: 'Ja', sub: 'Ware soll nicht fallen', test: m => ja(m.lift, 'Lift, die Ware fällt nicht') || { punkte: -2, weich: true } },
          { titel: 'Nein', sub: 'Standardware', test: m => ({ punkte: m.lift ? 0 : 1 }) }
        ]
      }
    ]
  }
];

// Leistung im Wunschbereich: volle Punkte. Etwas darüber: passt mit Reserve. Darunter: passt nicht.
function bedarf(wert, min, max, grund) {
  if (wert == null) return { punkte: 0, weich: true };
  if (wert >= min && wert <= max) return { punkte: 3, grund };
  if (wert > max) return { punkte: 1, grund: 'Mit Reserve nach oben', weich: true };
  return null;
}

// Bewertet alle Geräte eines Bereichs anhand der gegebenen Antworten.
// Ergebnis: { liste: [{ g, punkte, gruende }], hinweis }
export function empfehlen(bereich, antworten, geraete) {
  const b = BEREICHE.find(x => x.key === bereich);
  const kandidaten = geraete
    .map(g => ({ g, m: merkmale(g) }))
    .filter(({ m }) => !m.erweiterung && (m.bereich === bereich || (bereich === 'wasser' && m.bereich === 'bottle')));

  const bewerte = streng => kandidaten.map(({ g, m }) => {
    let punkte = m.pruefen ? -1 : 0; const gruende = [];
    for (const f of b.fragen) {
      const i = antworten[f.key];
      if (i == null || (f.nur && !f.nur(antworten))) continue;
      const r = f.antworten[i].test(m);
      if (r == null) { if (streng) return null; punkte -= 3; continue; }
      if (r.weich && streng && r.punkte < 0) return null;
      punkte += r.punkte;
      if (r.grund) gruende.push(r.grund);
    }
    return { g, m, punkte, gruende };
  }).filter(Boolean).sort((a, c) => c.punkte - a.punkte || (a.g.kauf ?? 1e9) - (c.g.kauf ?? 1e9));

  let liste = bewerte(true), hinweis = '';
  if (!liste.length) {
    liste = bewerte(false);
    hinweis = 'Kein Gerät erfüllt alle Wünsche. Diese Geräte kommen am nächsten.';
  }
  return { liste, hinweis };
}
