# Claude Usage Anzeige

Eine kleine, inoffizielle Chrome-Erweiterung, die auf **claude.ai** dein aktuelles Nutzungslimit anzeigt – direkt auf der Seite, ohne in die Einstellungen wechseln zu müssen.

> ⚠️ **Inoffiziell.** Dieses Projekt ist nicht mit Anthropic verbunden und wird nicht von Anthropic unterstützt. „Claude“ ist eine Marke von Anthropic.

## Was es anzeigt

- **5-Stunden-Limit** – wie viel deines aktuellen Sitzungsfensters verbraucht ist und wann es zurückgesetzt wird
- **Wochenlimit** – gesamt sowie (falls vorhanden) getrennt für Opus und Sonnet
- Farbige Balken: grün (< 70 %), gelb (70–89 %), rot (≥ 90 %)
- Aktualisiert sich automatisch jede Minute

## Bedienung

| Aktion | Wie |
|---|---|
| Ausblenden | Auf **–** klicken → es bleibt nur ein kleiner Kreis mit der 5-Stunden-Prozentzahl |
| Einblenden | Auf den Kreis klicken |
| Umschalten per Tastatur | **Alt + U** (Mac: **⌥ + U**) |
| Verschieben | An der Titelzeile ziehen |
| Sofort aktualisieren | Auf **↻** klicken |

Position und Ein-/Ausblend-Zustand werden gespeichert.

## Installation

1. Dieses Repository herunterladen: grüner Button **Code → Download ZIP**, dann entpacken.
2. In Chrome `chrome://extensions` öffnen.
3. Oben rechts den **Entwicklermodus** einschalten.
4. **„Entpackte Erweiterung laden“** klicken und den Ordner `extension` auswählen.
5. claude.ai neu laden.

## Datenschutz

- Die Erweiterung läuft **nur auf claude.ai**.
- Sie liest ausschließlich deine eigenen Nutzungsdaten – über dieselbe Schnittstelle, die auch die Nutzungsseite in den claude.ai-Einstellungen verwendet.
- Es werden **keine Daten an fremde Server** gesendet, es gibt kein Tracking.
- Gespeichert wird lokal nur, ob das Kästchen ein- oder ausgeblendet ist und wo es steht.

## Bekannte Einschränkungen

Die Erweiterung nutzt eine **interne, nicht dokumentierte** Schnittstelle von claude.ai. Wenn Anthropic diese ändert, zeigt das Kästchen „Konnte Usage nicht laden“. In dem Fall gern ein Issue öffnen.

---

## English (short)

Unofficial Chrome extension that shows your **5-hour session limit** and **weekly limit** as a small, draggable, hideable overlay on claude.ai. Press **Alt/⌥ + U** to toggle. Install via `chrome://extensions` → Developer mode → *Load unpacked* → select the `extension` folder. No data leaves your browser except requests to claude.ai itself. Not affiliated with Anthropic.

## Lizenz

[MIT](LICENSE)
