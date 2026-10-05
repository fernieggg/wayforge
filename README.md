# Wayforge

**Diagram-as-code for animated, multi-lens journey and architecture presentations.**

Describe a customer journey, a system architecture, an onboarding flow or a data pipeline as one JSON file. Wayforge turns it into a single self-contained HTML presentation: a camera glides across a map, glowing packets travel along the connections, and the presenter can switch between different views of the same story.

```
journey.json  ──►  wayforge build  ──►  journey.html  (one self-contained file)
```

## Features

- **A guided tour.** Each step frames part of the map, lights up what matters, shows a caption, and sends packets along the paths that carry the story.
- **Lenses.** Several views of one map (for example "Customer" and "Team"). Switching lens keeps the presenter's place in the story.
- **Layered reveal.** Parts of the map stay faint until the story reaches them.
- **Zoom into sub-flows.** Any node can open another journey file; the camera flies into it and the node dissolves into a whole new flow.
- **One file out.** No server and no runtime dependencies. Email it, host it anywhere, or open it from disk.
- **Light and dark themes**, reduced-motion support, keyboard and touch navigation, phone-friendly layout.
- **Validation that explains itself.** Every mistake is reported with its exact location and a plain message, before anything is built.

## Quick start

Requires Node 20 or later.

```bash
npm install
npx wayforge dev journeys/examples/support-ticket.json      # live preview at http://localhost:5173
npx wayforge build journeys/examples/support-ticket.json -o support-ticket.html
```

`dev` rebuilds and reloads the page every time you save. Open the built file in any browser.

To write your own, read **[docs/authoring.md](docs/authoring.md)**, the complete guide: workflow, every field, colors, layout with concrete numbers, scenes, sub-flows, and what every validation message means. To have an LLM write one, give it **[docs/llm-authoring.md](docs/llm-authoring.md)**.

## How it works

| Concept | What it is |
|---|---|
| **Node** | A box, circle, diamond or container (a box with rows) on the map. Has a title, optional subtitle, and optional pills naming a platform or owner. |
| **Edge** | A connection between nodes, drawn as an SVG path. Solid, dashed, or hidden (to carry packets through a node). |
| **Label** | Short text attached to an edge. |
| **Panel** | A dashed background area that groups nodes under a title. |
| **Layer** | A group of elements that stays faint until a scene switches it on. |
| **Lens** | A view of the map. Each element says which lenses show it, and a node can sit in a different place per lens. |
| **Scene** | One step of a lens's tour: where the camera looks, what is active, the caption, and which packets travel. |
| **Route** | The ordered edges one packet travels along during a scene. |
| **Sub-flow** | Another journey file that opens when you zoom into a node or panel. |

The look comes from a theme ([`themes/default.json`](themes/default.json)) that a journey can adjust with `themeOverrides`.

## Writing a journey

A journey is one JSON file, validated against [`schema/journey.schema.json`](schema/journey.schema.json). Start the file with `"$schema"` pointing at it, and editors such as VS Code autocomplete fields and explain each one on hover.

```json
{
  "$schema": "../schema/journey.schema.json",
  "version": 1,
  "meta": { "title": "A support ticket, start to finish", "brand": "Support flow" },
  "lenses": [
    { "id": "customer", "label": "Customer" },
    { "id": "team", "label": "Team", "default": true }
  ],
  "layers": [{ "id": "ops", "tone": "lime", "ghost": 0.4 }],
  "stageOrder": ["overview", "submit", "triage", "work"],
  "groups": { "lane": ["customer", "portal", "triage", "agent"] },
  "panels": [
    { "id": "backoffice", "rect": [780, 450, 760, 280], "tone": "lime", "layer": "ops", "lenses": ["team"],
      "title": { "text": "Behind the scenes", "at": [806, 484] } }
  ],
  "nodes": [
    { "id": "portal", "kind": "box", "at": [240, 205], "size": [220, 90], "title": "Help center",
      "subtitle": "contact form", "pills": [{ "text": "Web", "tone": "blue" }] },
    { "id": "agent", "kind": "box", "at": [860, 330], "size": [240, 90], "title": "Support agent",
      "offsetByLens": { "customer": [0, -125] } },
    { "id": "queue", "kind": "container", "at": [820, 500], "size": [320, 200], "title": "Support queue",
      "layer": "ops", "rows": ["Assign an owner", "Set priority"], "lenses": ["team"] }
  ],
  "edges": [
    { "id": "ta", "path": "M740 250 C800 250 800 375 860 375", "lenses": ["team"] },
    { "id": "a_thru", "path": "M860 375 L1100 375", "hidden": true, "lenses": ["team"] },
    { "id": "qa", "path": "M980 500 L980 420", "layer": "ops", "lenses": ["team"] }
  ],
  "labels": [{ "edge": "ta", "at": [818, 296], "text": "routine" }],
  "scenes": {
    "customer": [
      { "key": "submit", "label": "Ask", "title": "You ask for help", "caption": "You fill out the contact form.",
        "camera": [200, 100, 800, 330], "active": { "nodes": ["portal"] } }
    ],
    "team": [
      { "key": "work", "label": "Queue", "title": "Working the queue", "caption": "Each ticket gets an owner.",
        "camera": [760, 300, 820, 460], "layers": ["ops"],
        "active": { "nodes": ["agent", "queue"], "edges": ["qa"] },
        "routes": [{ "edges": ["qa"] }, { "edges": ["ta", "a_thru"], "phase": 1.5, "dim": true }],
        "effects": [{ "type": "cycleRows", "node": "queue" }] }
    ]
  }
}
```

A few rules shape everything else:

- `at` is the top-left corner of a node's bounding box, for every kind.
- Leaving out `lenses` shows an element in every lens; `"lenses": []` parks it (kept in the file, never shown).
- Array order is paint order.
- Scene `active` lists accept `"@group"` references.
- Any object can carry `notes`, which are never shown. Use them to flag placeholders.

The complete reference, layout guide and worked examples are in [docs/authoring.md](docs/authoring.md). Full example journeys live in [`journeys/examples/`](journeys/examples/).

## Zooming into sub-flows

```jsonc
// a zoomable node in the parent journey
{ "id": "queue", "kind": "container", "...": "...", "zoom": { "journey": "./support-queue.json" } }

// a parent scene that dives in when the presenter presses Next
{ "key": "work", "...": "...", "enter": "queue" }
```

A sub-flow is an ordinary journey file: it builds on its own, can be opened from several places, and can nest. During the presentation, Next on a scene with `enter` zooms in, and any zoomable element can also be clicked. Inside, the sub-flow has its own lenses, steps and colors, opening in the lens that matches the parent's when there is one. Next past its last step zooms out and continues the parent tour. Escape or the breadcrumb returns at any time. `wayforge build` bundles the whole tree into one page.

## Presenting

| Key | Action |
|---|---|
| → , Space, Page Down | Next step |
| ← , Page Up | Previous step |
| Home, End | First or last step |
| 1 to 9 | Switch lens |
| Enter | Open a focused zoomable element |
| Escape | Leave a sub-flow |
| F | Full screen |

On touch screens, swipe left or right. The page follows the viewer's light or dark setting and respects reduced-motion preferences.

## Commands

```bash
wayforge validate <journey.json> [--strict]                 # check a journey and its sub-flows
wayforge build    <journey.json> [-o out.html] [--strict]   # build one self-contained HTML file (default dist/<name>.html)
wayforge dev      <journey.json> [--port 5173]              # serve, rebuild and reload on save
wayforge snapshot <journey.json> [--lens id] [--theme light|dark] [-o dir]   # a PNG of every step of the tour
```

`--strict` treats warnings as errors. `snapshot` needs a browser for Playwright: run `npx playwright install chromium` once. From a source checkout, run any command as `npx wayforge …`.

## What you get

The built page is a single HTML file, well under the 16 MB limit of strict page hosts:

- All CSS and JavaScript inlined, with no framework at runtime. The map is plain SVG.
- No network requests except the Google Fonts stylesheet, with system font fallbacks when offline.
- No reliance on browser storage or injected APIs.
- Safe-area aware on phones (`viewport-fit=cover`).
- Light and dark themes from CSS variables, following the system setting, with a manual `data-theme` override.

## Project structure

```
schema/        journey.schema.json, theme.schema.json
themes/        default.json (design tokens)
journeys/      examples/ (support-ticket, support-queue, knowledge-base)
docs/          authoring.md (complete guide), llm-authoring.md (brief for an LLM)
src/
  model/       loading, defaults, sub-flow tree, lens rules, generated schema types
  geometry/    pure layout math: shapes, text and pill placement, paths, zoom placement
  validate/    JSON Schema, reference integrity, lints
  render/      build-time HTML: CSS from the theme, SVG, page chrome, runtime data
  runtime/     browser code (camera, packets, lenses, scenes, effects, zoom, input), bundled and inlined
  cli/         validate, build, dev, snapshot
tests/         unit, validate (fixtures and docs examples), constraints (built output), e2e and visual (Playwright)
```

## Development

```bash
npm test                  # unit, validation, docs-example and output-constraint tests
npx playwright test       # end-to-end tests in a real browser (sub-flow zooming, navigation)
npm run typecheck
```

The visual regression suite in `tests/parity/` compares builds against a reference page kept outside this repository. It runs when that reference is available (see `WAYFORGE_PRIVATE_DIR` in `tests/private.ts`) and skips otherwise.

## Roadmap

- **Less typing.** Lane-and-column auto-layout so coordinates are computed, waypoint-based edge routing with rounded corners, label placement that avoids curves, and an overlap lint.
- **Authoring workflow.** Turning a plain-language description into a journey, with the JSON as the reviewed artifact ([docs/llm-authoring.md](docs/llm-authoring.md) is the first step).
- **More outputs.** PNG or PDF export of key frames, video recording, speaker notes.
- **More vocabulary.** More node kinds, theme packs, optional arrowheads.

## Status

Wayforge is in active development and not yet published to npm. A license has not been chosen yet.
