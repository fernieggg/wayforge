# Wayforge

A data-driven engine that turns a description of a journey or architecture into a sleek, animated, single-file presentation: a camera that glides across a map, glowing data packets that travel along the paths, and "lenses" that let the presenter switch between different views of the same story.

> Wayforge is a data-driven engine for animated, multi-lens journey and architecture presentations. Planned to be open source.

## The goal: an engine, not a one-off

This project is **not** "the lead journey presentation." That presentation is only **dataset #1**, the first thing the engine was used to make.

The engine must let its author describe *anything* as data (a customer journey, a system architecture, an onboarding flow, a data pipeline, an org process) and get the same polished output:

```
journey.json  ──►  wayforge build  ──►  one self-contained animated HTML file
```

**Success test:** feed the engine the lead-journey dataset and it reproduces today's presentation exactly. Feed it a completely different dataset and it produces a new presentation of the same quality, with **zero changes to engine code**.

If a change requires editing engine code to support a new story, the engine is not done. That is a bug in the engine, not a feature request.

## Quick start

Requires Node 20 or later.

```bash
npm install
npx playwright install chromium        # only needed for snapshot and the parity tests

npx wayforge validate journeys/examples/support-ticket.json
npx wayforge build    journeys/examples/support-ticket.json -o dist/support-ticket.html
npx wayforge dev      journeys/examples/support-ticket.json     # http://localhost:5173, reloads on save
```

Open the built file in any browser. It is one self-contained page.

## Where things stand today

v1 parity is in place. The engine reads a journey JSON file, validates it, and builds one self-contained page. Built from dataset #1, that page matches the hand-built reference page in every scene of every lens, in light and dark mode, with and without reduced motion. The Playwright parity tests check this structurally (every element's computed look, the camera, the caption and the packet positions) and with screenshots. A second, unrelated journey (`journeys/examples/support-ticket.json`) builds with no engine changes.

The reference file is the **golden master**. Do not edit it. Treat its rendered output as the specification.

## What the engine needs to do

### Core concepts

| Concept | What it is |
|---|---|
| **Node** | A box, circle, diamond or container on the map. Has a title, optional subtitle, optional pills, optional sub-rows. |
| **Pill** | A small colored label that straddles a node's top edge and names the platform or owner (for example "Automator", "CRM", "Messenger"). |
| **Edge** | A path between nodes. Solid or dashed, any accent color. Can be a hidden pass-through (see below). |
| **Label** | Small text attached to an edge. Full strength while its edge is active, dimmed otherwise. |
| **Panel** | A dashed rounded background that groups nodes and carries a title. |
| **Layer** | A named group of elements (for example "data layer"). Layers can be shown ghosted (faded teaser) until a scene reveals them. |
| **Lens** | A named view of the same map, such as "Prospect", "Data" or "Both". Each element declares which lenses show it. Lenses can also move nodes and swap in alternate edges. |
| **Scene** | One step in a lens's walkthrough: a camera position, which elements are active, a caption, and which packets travel. |
| **Route** | An ordered list of edges a packet travels along during a scene. |
| **Camera** | A rectangle of the map the viewport glides to for each scene. |

### Behaviors to preserve

- **Lens switching keeps the presenter's place.** Each scene has a `key` naming its stage. Switching lenses jumps to the scene with the same key, or the nearest stage if the new lens has none (ties go to the later stage).
- **Layered reveal.** Elements in an inactive layer stay visible but ghosted, as a teaser. Scenes switch layers on.
- **Packets pass under nodes.** Packets render beneath node shapes, so they appear to travel *through* a system and come out the other side. Hidden pass-through edges connect the entry and exit of a node.
- **Animated geometry per lens.** A lens can move a node (smooth glide) and swap in lens-specific edges so each view can be laid out cleanly.
- **Parked content.** Elements can be kept in the data but hidden in every lens, so work can be set aside and restored later.
- **Light and dark themes** from design tokens, following the viewer's system setting.
- **Reduced-motion support**: no camera glide, static packets.
- **Navigation**: Back/Next buttons, step dots, arrow keys, Home/End, `1 2 3` to switch lens, `F` for full screen, swipe on touch.
- **Responsive**: works on phones (best in landscape) and respects safe-area insets.

## Journey format

A journey is one JSON file, validated against [`schema/journey.schema.json`](schema/journey.schema.json). Point your editor at it with `"$schema"` to get completion and inline docs. The look comes from a theme ([`themes/default.json`](themes/default.json), validated by [`schema/theme.schema.json`](schema/theme.schema.json)), which a journey picks with `"theme"` and can adjust with `"themeOverrides"`.

```jsonc
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

The rules that matter most:

- `at` is the top-left of a node's bounding box, for every kind (`box`, `circle`, `diamond`, `container`).
- `lenses` left out means every lens. `lenses: []` parks an element: it stays in the data and is never shown.
- Array order is paint order.
- Scene `active` lists accept `"@group"` references.
- A route's `phase` (seconds) staggers its packet against the others; `dim` draws it fainter.
- Labels inherit their edge's layer and lenses.
- Any object can carry `notes`. Use them to flag placeholder titles.

`wayforge validate` rejects broken references and their paths, for example `scenes.both[3].routes[1].edges[2]: unknown edge "thru_bk" (scene "gate")`. It also warns about likely mistakes: text too small to read for the camera, packets jumping between edges outside a node, rows overflowing a container.

## Commands

```bash
wayforge validate <journey.json> [--strict]                 # schema, integrity and lint checks
wayforge build    <journey.json> [-o out.html] [--strict]   # one self-contained HTML file (default dist/<name>.html)
wayforge dev      <journey.json> [--port 5173]              # serve, rebuild and reload on save
wayforge snapshot <journey.json> [--lens id] [--theme light|dark] [-o dir]   # PNG of every scene
npm test                                                     # unit, validation and output-constraint tests
npm run test:parity                                          # Playwright parity against the reference (skips if absent)
npm run parity:report                                        # readable structural diff, scene by scene
```

`--strict` turns warnings into errors. In a source checkout, `npx wayforge …` runs the CLI directly from TypeScript.

## Output constraints

The built file must be **one self-contained HTML file** that can be hosted anywhere, including a locked-down page host:

- Under 16 MB; all CSS and JS inlined; images as `data:` URIs.
- No network requests at runtime. The only external resource allowed is Google Fonts (always with real fallback font stacks).
- If scripts must load from a CDN, only `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `cdn.tailwindcss.com` or `code.jquery.com`. The preferred answer is **no CDN scripts at all**.
- Do not depend on `window.storage` or any browser-injected API. If `localStorage` is ever used, wrap every access in try/catch.
- Include `viewport-fit=cover` and respect `env(safe-area-inset-*)`.
- Theme from CSS variables, with a dark theme under `prefers-color-scheme: dark` and manual `data-theme` overrides.

## Dataset #1: the lead journey

A prospect's path from an ad to a booking, and what happens to their data along the way. Three lenses:

| Lens | Steps |
|---|---|
| **Prospect** (6) | Overview, Ads, Landing pages, Form gate, Nurture, Full picture |
| **Data** (5) | Overview, Webhook, Qualification, CRM, Capture Event |
| **Both** (8) | Overview, Ads, Landing pages, Form gate, Data layer, Capture Event, Nurture handoff, Full picture |

Systems on the map: ads on four platforms; landing pages on CMS and on a proprietary React app; a form with a qualification gate; a booking screen with Booked / Not booked outcomes; a nurture journey in Messenger that loops back to the booking screen; Automator recipes (intake, qualification, Capture Event); CRM records (Lead, Contact, History Record); Events.

Size: 20 nodes (15 data-driven plus 5 hand-built), 35 edges, 18 labels, 2 panels.

**Parked, not deleted:** the "Booked?" filter, "Never enters", the Capture Event / not-booked / booked lines into that filter, and the Messenger panel. They stay in the data, hidden in every lens, so they can be restored as a lighter chapter later.

## Repo layout

```
wayforge/
  schema/                       journey.schema.json, theme.schema.json (published)
  themes/default.json           design tokens of the reference look
  journeys/examples/            generic example journeys
  src/
    model/       loading, defaults, group expansion, lens visibility, generated schema types
    geometry/    pure layout math: shapes, text and pill placement, path parsing
    validate/    JSON Schema, reference integrity, lints
    render/      build-time HTML: CSS from the theme, SVG, page chrome, runtime data
    runtime/     browser code (camera, packets, lenses, scenes, effects, input), bundled and inlined
    cli/         validate, build, dev, snapshot
  tests/         unit, validate (fixtures), constraints (built output), parity (Playwright)
  dist/          built pages (gitignored)
```

Dataset #1 (`journeys/lead-journey.json`) and the golden master (`reference/lead-journey.html`) describe a real process, so they live in a separate private repository, `wayforge-private`. Clone it next to this one, or set `WAYFORGE_PRIVATE_DIR`. The parity tests use it when present and skip otherwise.

## Acceptance criteria for "v1: parity"

1. `journeys/lead-journey.json` plus the engine builds a file that matches `reference/lead-journey.html` scene for scene, lens for lens: same step counts (6 / 5 / 8), same titles and captions, same camera framing, same packet routes.
2. A second, deliberately different journey (for example a 6-node support-ticket flow with two lenses) builds with no engine changes. Keep it in `journeys/examples/` as a regression test for "this is an engine."
3. `wayforge validate` rejects every class of broken reference listed above.
4. Built output meets every constraint in "Output constraints."
5. Screenshot tests pass in light and dark mode.

## Roadmap

- **v1: parity.** Everything above.
- **v2: less typing.** Lane-and-column auto-layout so coordinates are computed, plus waypoint-based edge routing with rounded corners. Label placement that avoids curves. A collision lint.
- **v3: authoring.** A prompt and workflow that turns a plain-English description into journey JSON (this is how dataset #1 was made, conversationally), with the JSON as the reviewed artifact.
- **v4: more outputs.** PNG or PDF export of key frames, MP4 recording, more node kinds, theme packs, optional arrowheads, speaker notes.

## Open source plans

Wayforge is intended to become a public repository. That affects a few decisions now:

- **Name.** An availability check on 2026-10-04 found no existing `wayforge` package on npm or PyPI, and the closest GitHub match was a small unrelated repo. Domains, company names and trademarks have **not** been checked. Do that before the first public release.
- **Package.** Publish under a scoped npm name (`@<owner>/wayforge`) with a `wayforge` binary. A scoped name avoids most collisions.
- **Dataset #1 is private.** The lead journey names real systems and a real process, so it lives in the private `wayforge-private` repo. This repo's history from before the split still contains it: remove it from history (or publish from a fresh repo) before going public. The engine and schema must never depend on it.
- **Discoverability.** Because the name is a coined word, the repo description and topics do the search work. Suggested one-liner: "Diagram-as-code for animated, multi-lens journey and architecture presentations." Suggested topics: `diagram-as-code`, `visualization`, `svg`, `presentation`, `journey-map`, `architecture-diagram`.
- **Housekeeping before launch:** choose a license, add `CONTRIBUTING.md`, add CI that runs validation, parity and screenshot tests, and include at least two non-proprietary example journeys.

## Starting with Claude Code

Put `README.md`, `CLAUDE.md` and `lead-journey.html` (renamed into `reference/`) in a new repo called `wayforge`, open Claude Code in it, and start with something like:

> Read README.md and CLAUDE.md. Then read reference/lead-journey.html. Before writing any code, propose the final JSON schema and the engine's module layout, and wait for my approval. The goal is an engine: the lead journey is just the first dataset.

## Open content questions for dataset #1

These came out of building the first version. None block the engine.

- Some titles are placeholders chosen to pair with platform pills: "CRM records" (CRM) and "Event routing" (Events). Confirm or replace.
- Automator recipe names ("Intake recipe", "Qualification recipe", "Capture Event recipe") are descriptive, not the real recipe names.
- The Both-lens full picture is very wide and its text is small by design; it works as a closing shot, not for reading.
- Arrows have no arrowheads. Direction is conveyed by packets and labels. Decide whether the engine should offer arrowheads as an option.
