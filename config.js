// Einstellungen der Katalog-App
// Webhook-Adressen aus Make: "Katalog-App: Katalog aus Airtable" und "Katalog-App: Angebot erstellen (Kopie, Webhook)".
// Leer lassen = App nutzt den lokalen Datenstand data/katalog.json und kann keine Angebote senden.

export default {
  KATALOG_URL: 'https://hook.eu2.make.com/m6k7om7bom37gn37r46e3fa9canqrfj9',
  ANGEBOT_URL: 'https://hook.eu2.make.com/p6qj9n51w6164yimlkasbhn5jrkriqau',

  // So lange wird der Katalog im Browser zwischengespeichert (Minuten)
  CACHE_MINUTEN: 30,

  MAX_POSITIONEN: 6,
  LAUFZEITEN: [36, 48, 60],

  // Hinweis im Angebot bei Miete (steht so auch in der Google-Doc-Vorlage)
  HINWEIS_MIETE: 'zzgl. Bearbeitungsgebühr der Leasinggesellschaft 79 € netto'
};
