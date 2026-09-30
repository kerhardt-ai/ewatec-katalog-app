# ewatec Katalog-App

Produktkatalog und Angebotskonfigurator für den Außendienst. Die Produkte und Preise kommen aus Airtable, das Angebot erstellt Make.

## So hängt alles zusammen

```
App (Browser)  ──GET──▶  Make „Katalog-App: Katalog aus Airtable“  ──▶  Airtable (Geräte, Zubehör, Care, Installation, Lieferung, Vertrieb)
App (Browser)  ──POST─▶  Make „Katalog-App: Angebot erstellen (Kopie, Webhook)“  ──▶  Google-Doc-Vorlage → PDF → Mail-Entwurf vertrieb@ → Pipedrive
```

Im Browser steht kein Airtable-Schlüssel. Der Zugang liegt nur in Make.

## Dateien

| Datei | Zweck |
|---|---|
| `config.js` | Webhook-Adressen, Cache-Dauer, Laufzeiten |
| `app.js` | Logik, Preisberechnung, Airtable-Feldnamen (Funktion `ausAirtable`) |
| `zuordnung.js` | Airtable-Gerät → Bild und Texte aus `inhalte.js` |
| `inhalte.js` | Bilder, Beschreibungen, technische Daten aus Claude Design |
| `data/katalog.json` | Datenstand vom 30.09.2026, falls Make nicht erreichbar ist |
| `bilder/` | Produktbilder |

## Preislogik

- **Kauf** = (Gerät + Zubehör + Installationseinheit + Lieferung) × Menge
- **Miete 36/48/60** = Summe der Airtable-Monatswerte derselben Teile × Menge
- **ewatec Care** = Monatspreis × Menge, wird separat ausgewiesen und nicht in die Rate eingerechnet

## Pflege

- **Neues Gerät oder neuer Preis:** nur in Airtable ändern. Die App lädt spätestens nach 30 Minuten neu. Über „neu laden“ in der Fußzeile geht es sofort (nur im Vertriebsmodus sichtbar).
- **Bild für ein neues Gerät:** Bild nach `bilder/` legen, in `inhalte.js` eintragen und die Record-ID in `zuordnung.js` ergänzen.
- **Feld in Airtable umbenannt:** Feldname in `app.js` (Funktion `ausAirtable`) und im Make-Szenario „Katalog aus Airtable“ anpassen.

## Starten

Es ist eine statische Webseite ohne Build-Schritt. Lokal:

```
cd app
python3 -m http.server 8000
```

Online reicht jeder statische Hoster, z. B. GitHub Pages, Netlify oder ein Ordner auf dem Webspace.
