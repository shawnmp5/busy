# Chronos

A calendar you can make your own, with a sticky-note corkboard for every day and reminders for events and notes.

No build step and no dependencies. Open `index.html` in a browser, or serve the folder with any static host (GitHub Pages works). Everything is saved in your browser's `localStorage`.

## What you can do

**Calendar**
- Day, Week, Month and Year views, with animated transitions and a live "now" line
- Drag across empty time in Week or Day view to create an event
- Drag an event to move it, or drag its bottom edge to change its length
- Drag event chips between days in Month view
- Repeating events (daily, weekdays, weekly, every 2 weeks, monthly, yearly), with an optional end date
- Moving or deleting one occurrence of a repeating event leaves the rest alone
- Calendars (Personal, Work, …) that you can rename, recolour, hide or add to
- US holidays, computed for any year
- A Year view heatmap showing how busy each day is
- Search across events and notes (`/`)

**Sticky notes**
- A corkboard for each day. Double-click anywhere on it to stick a note there.
- Drag notes around by their top edge, or drop one onto any day in the calendar to move it there
- Eight paper colours and five handwriting fonts
- Turn a note into a checklist (with a progress bar and confetti when you finish)
- Mark notes done, duplicate them, or delete them with undo
- Notes show up as tiny post-its in the Month view and Week headers

**Reminders**
- Event reminders (at start, 5 min … 1 day before)
- Note reminders at any date and time, with quick presets
- In-app reminder cards with Snooze 10 min, plus an optional desktop notification and chime
- Reminders missed while the tab was closed show up when you come back (within 12 hours)

**Make it yours** (the sliders icon, or `,`)
- 10 themes: Auto, Nocturne, Daylight, Sakura, Glacier, Moss, Dusk, Ocean, Mocha, Void
- Any accent colour, five font pairings, corner roundness, density
- Ambient glow, film grain and frosted glass toggles
- Event style (tinted, solid, outline), 12/24-hour clock, week start, week numbers, hide weekends
- Mood for each day, shown in the Month and Year views
- Export, import or copy a JSON backup

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `T` | Today |
| `←` `→` | Previous / next |
| `D` `W` `M` `Y` | Day, Week, Month, Year |
| `C` | New event |
| `N` | New sticky note |
| `/` | Search |
| `B` | Toggle day board |
| `[` | Toggle sidebar |
| `,` | Customize |
| `R` | Reminders |
| `Ctrl` `Z` | Undo |
| `?` | All shortcuts |

Right-click a day, an event or a note for more options. On a phone, swipe left or right to change months.

## Files

```
index.html       page structure and icons
css/styles.css   themes and layout
js/app.js        all app logic
```
