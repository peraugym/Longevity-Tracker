# Longevity Tracker

Static training log for Stefan. GitHub Pages serves this repository from the `main` branch at the site root:

https://peraugym.github.io/Longevity-Tracker/

There is no build, no framework, and no server. `index.html`, `styles.css`, and `app.js` load **`data/data.json`** in the browser and render every number from that file. A weekly update is one edit to `data/data.json`, then a commit to `main`. Refresh the page to see it. Do not put sessions, weights, or targets in the JavaScript.

The repository is public on purpose and the file contains real training numbers. Do not add photographs, body photos, image URLs, or embedded images anywhere. `proof` is a short text label. The page does not render images from the data.

## Update checklist

1. Append new sessions to `sessions` (end of the array). Same-day order matters: a later array item is treated as later that day.
2. Append weigh-ins to `weights`. Order does not matter.
3. When a Monday–Sunday week is finished, append one object to `weeks`. `week` is the Monday.
4. Replace `nextTargets` with the upcoming work. Key order is the card order.
5. Leave `penalties` as `[]` for a clean sheet, or append penalty objects.
6. Set `updated` to the day you edited the file (`YYYY-MM-DD`).
7. Commit `data/data.json`. Do not rename exercise strings if that lift should keep one progression line.

`updated` is the header date only. **This week** is the Monday–Sunday week that contains today's date in `timezone`, using the calendar dates as written. A session counts in the glance when its `date` falls in that week.

## What the page computes

Do not store these. They are derived when the page loads.

| Shown | Rule |
| --- | --- |
| Strength count | Sessions this week with `type` `"strength"`. |
| Zone 2 count | Sessions this week with `type` `"zone2"`. |
| Compliance | `min(strength, goals.strengthSessionsPerWeek) + min(zone2, goals.zone2PerWeek)` over `strengthSessionsPerWeek + zone2PerWeek`. Extra sessions still show in the strength and Zone 2 tiles. Sport and walk sessions are not part of this fraction. |
| Latest weight | Weigh-in with the greatest `date` (later array item wins on a tie). |
| 7-day average | Mean of weigh-ins dated from that latest date minus 6 days through the latest date, inclusive. Days with no weigh-in are skipped, not filled in. |
| Rolling average line | Same 7-day window, ending on each weigh-in. |
| Best set | Highest Epley estimate in that exercise for that session. Epley: `loadKg × (1 + reps / 30)`. A set of 1 rep uses the load itself. Ties go to the higher rep count. |
| Top-set reps | Reps of that best set. |
| In band / below band / above band | Only on `type` `"zone2"` when `avgHr` is set, compared with `goals.zone2HrBpm` inclusive. |

One chart point per exercise `name` per session. Names must match exactly, including `+kg` and spacing. `"Lateral raise (cable)"` and `"Cable lateral raise"` are different lifts.

`volumeKg` is displayed as stored. The page does not recompute volume.

## Schema

The root value is one JSON object. Dates are `YYYY-MM-DD`. Unknown fields are ignored. Do not rename the fields below.

### Root

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `athlete` | string | yes | Name in the header. |
| `updated` | string | yes | Last edit date, shown in the header. Not used to pick "this week". |
| `timezone` | string | yes | IANA timezone, e.g. `Europe/Vienna`. Used only to decide which calendar day "today" is. Session and weight dates are not shifted. |
| `heightCm` | number | yes | Height in centimeters, shown in the header. Not used in any calculation. |
| `links` | object | yes | External links. |
| `links.gymCrowdTracker` | string | yes | URL of the separate gym crowd tracker. `http` or `https` only. Shown as the header link. |
| `goals` | object | yes | Standing targets. |
| `goals.stepsPerDay` | number | yes | Daily step goal. Displayed. Steps are not logged in this file. |
| `goals.proteinG` | array of two numbers | yes | Daily protein range in grams, low then high. Displayed. Intake is not logged here. |
| `goals.strengthSessionsPerWeek` | number | yes | Strength sessions that count as a full week. |
| `goals.zone2PerWeek` | number | yes | Zone 2 sessions that count as a full week. |
| `goals.zone2HrBpm` | array of two numbers | yes | Inclusive Zone 2 heart-rate band in bpm, low then high. |
| `goals.lt1CyclingBpm` | number | yes | Cycling first lactate threshold in bpm. Displayed with the standing targets. |
| `weights` | array | yes | Weigh-ins. May be empty. |
| `sessions` | array | yes | Training sessions. Append in chronological order. |
| `weeks` | array | yes | Closed weeks for the history section. The glance does not read this array. |
| `nextTargets` | object | yes | Upcoming session cards. Use `{}` when there are none. |
| `penalties` | array | yes | Penalty board. `[]` shows **Clean sheet**. |

### `weights[]`

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `date` | string | yes | Weigh-in date. |
| `kg` | number | yes | Bodyweight in kilograms. |

### `sessions[]`

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `date` | string | yes | Session date. |
| `type` | string | yes | `strength`, `zone2`, `sport`, `walk`, or another short lowercase label. Only `strength` and `zone2` count toward the weekly goals. |
| `name` | string | yes | Session title, e.g. `Upper A`. |
| `minutes` | number | yes | Duration in minutes. |
| `proof` | string | yes | Short text for how it was logged, e.g. `Strong`, `Apple Watch`, `recap`. Not a URL and not a photo. Image-like values are replaced with the text "Logged" and are never shown as media. |
| `prs` | number | no | Count of personal records. Omitted when there were none. |
| `volumeKg` | number | no | Session volume in kilograms, using the convention already used for that session. Omit when you are not logging volume. |
| `avgHr` | number | no | Average heart rate in bpm. |
| `exercises` | array | no | Lifts. Omit for sessions with no loaded work. |

### `sessions[].exercises[]`

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | string | yes | Exercise name. This is the progression key. Keep the spelling stable. |
| `sets` | array | yes | Working sets, in the order they were done. |

Each set is a two-number array `[loadKg, reps]`.

- `loadKg` is external load. `0` means unloaded or bodyweight.
- For names marked `+kg`, `loadKg` is the added weight only. Do not add bodyweight. Epley runs on the stored load.
- `reps` is the repetition count. A carry or distance piece can use `1`.

### `weeks[]`

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `week` | string | yes | Monday that starts the week. |
| `compliance` | string | yes | Shown as written, e.g. `6/6`. |
| `strengthSessions` | number | yes | Strength sessions in that closed week. |
| `zone2Sessions` | number | yes | Zone 2 sessions in that closed week. |
| `note` | string | yes | One line on how the week went. Use `""` if there is nothing to say. |

### `nextTargets`

Keys are the card titles, for example `Lower A (Tue 17 Nov)`. The value is an array of strings, one target per line, in the order they should be read. Object key order is the card order.

### `penalties[]`

Use this object. An empty array is the clean sheet. A plain string is also shown, but new entries should be objects.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `date` | string | yes | Date of the miss or flag. |
| `reason` | string | yes | Short label. |
| `detail` | string | no | Longer note. Omit the key if there is nothing else to say. |

## Examples

Shapes only. Add a block when it is a real session, weigh-in, week, or penalty.

Session:

```json
{
  "date": "2026-11-17",
  "type": "strength",
  "name": "Lower A",
  "minutes": 45,
  "proof": "Strong",
  "exercises": [
    { "name": "RDL", "sets": [[50, 9]] }
  ]
}
```

Zone 2 session with heart rate:

```json
{
  "date": "2026-11-18",
  "type": "zone2",
  "name": "Indoor cycle",
  "minutes": 60,
  "avgHr": 115,
  "proof": "Apple Watch"
}
```

Weigh-in:

```json
{ "date": "2026-11-17", "kg": 72.7 }
```

Closed week:

```json
{
  "week": "2026-11-16",
  "compliance": "6/6",
  "strengthSessions": 4,
  "zone2Sessions": 2,
  "note": ""
}
```

Penalty:

```json
{
  "date": "2026-11-18",
  "reason": "Missed strength session",
  "detail": "No Lower A."
}
```

## Files

| File | Role |
| --- | --- |
| `index.html` | Page shell. |
| `styles.css` | Dark, phone-first layout. |
| `app.js` | Loads `data/data.json` and draws the page. Chart.js is loaded from a CDN. |
| `data/data.json` | The only data source. |
| `favicon.svg` | Tab icon. |
| `.nojekyll` | Tells GitHub Pages to skip Jekyll. |

Chart.js is the only external request. If it fails to load, the tables and counts still render.
