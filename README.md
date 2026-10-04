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

**Writing your own journey:** read [docs/authoring.md](docs/authoring.md), the complete guide: workflow, every field, colors, layout with concrete numbers, scenes, sub-flows, and what every validation message means. To have an LLM write one, give it [docs/llm-authoring.md](docs/llm-authoring.md).

## Where things stand today

v1 parity is in place. The engine reads a journey JSON file, validates it, and builds one self-contained page. Built from dataset #1, that page matches the hand-built reference page in every scene of every lens, in light and dark mode, with and without reduced motion. The Playwright parity tests check this structurally (every element's computed look, the camera, the caption and the packet positions) and with screenshots. A second, unrelated journey (`journeys/examples/support-ticket.json`) builds with no engine changes.

The reference file is the **golden master**. Do not edit it. Treat its rendered output as the specification.

## What the engine needs to do

### Core concepts

| Concept | What it is |
|---|---|
| **Node** | A box, circle, diamond or container on the map. Has a title, optional subtitle, optional pills, optional sub-rows. |
| **Pill** | A small colored label that straddles a node's top edge and names the platform or owner (for example "CRM", "Email", "Wiki"). |
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

The full reference is [docs/authoring.md](docs/authoring.md); this is the short version. A journey is one JSON file, validated against [`schema/journey.schema.json`](schema/journey.schema.json). Point your editor at it with `"$schema"` to get completion and inline docs. The look comes from a theme ([`themes/default.json`](themes/default.json), validated by [`schema/theme.schema.json`](schema/theme.schema.json)), which a journey picks with `"theme"` and can adjust with `"themeOverrides"`.

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

The rules that matter most:

- `at` is the top-left of a node's bounding box, for every kind (`box`, `circle`, `diamond`, `container`).
- `lenses` left out means every lens. `lenses: []` parks an element: it stays in the data and is never shown.
- Array order is paint order.
- Scene `active` lists accept `"@group"` references.
- A route's `phase` (seconds) staggers its packet against the others; `dim` draws it fainter.
- Labels inherit their edge's layer and lenses.
- Any object can carry `notes`. Use them to flag placeholder titles.

`wayforge validate` rejects broken references and their paths, for example `scenes.both[3].routes[1].edges[2]: unknown edge "thru_bk" (scene "gate")`. It also warns about likely mistakes: text too small to read for the camera, packets jumping between edges outside a node, rows overflowing a container.

## Zooming into sub-flows

Any node or panel can open another journey file, a **sub-flow**. During the presentation the camera flies into the element, the element dissolves into the sub-flow's own map, and the sub-flow plays with its own scenes, lenses and packets. Zooming out lands back in the parent.

```jsonc
// in the parent journey
{ "id": "queue", "kind": "container", "...": "...",
  "zoom": { "journey": "./support-queue.json", "label": "Support queue" } }

// a parent scene that dives in when the presenter presses Next
{ "key": "work", "...": "...", "enter": "queue" }
```

- **Two ways in.** A scene with `"enter"` dives in on Next. Any zoomable element can also be clicked, or focused and opened with Enter, at any time. Zoomable elements show a small "+" marker; `"badge": false` hides it.
- **Ways out.** Next on the sub-flow's last scene zooms out and continues the parent tour. Back on its first scene returns to the scene that entered it. Escape, or a breadcrumb in the header, exits one level or several.
- **Lenses.** A sub-flow keeps its own lenses. It opens in the lens with the same id as the parent's current lens, or else its own default. While inside, the lens buttons, step dots and number keys belong to the sub-flow.
- **Files.** The `journey` path is relative to the referencing file. A sub-flow is an ordinary journey: it builds on its own, can be opened from several places, and can contain zoomable elements of its own. `wayforge build` bundles the whole tree into one page.
- **Theme.** The page chrome (background, header, footer) uses the root journey's theme. Each sub-flow's map uses its own theme and overrides.
- **Validation.** `validate` checks every file in the tree and prefixes sub-flow problems with where they come from, for example `support-queue.json (via nodes[7](queue).zoom) › scenes.team[1]…`. It rejects missing files, zoom cycles, an `enter` that names something without a zoom, and empty sub-flows. It warns when the entering scene's camera doesn't contain the element.

See `journeys/examples/support-ticket.json` (tour entry into `support-queue.json`, and click-only entry into `knowledge-base.json`).

## Commands

```bash
wayforge validate <journey.json> [--strict]                 # schema, integrity and lint checks
wayforge build    <journey.json> [-o out.html] [--strict]   # one self-contained HTML file (default dist/<name>.html)
wayforge dev      <journey.json> [--port 5173]              # serve, rebuild and reload on save
wayforge snapshot <journey.json> [--lens id] [--theme light|dark] [-o dir]   # PNG of every step of the tour, sub-flows included
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

## Dataset #1

The first dataset is a real lead journey: three lenses (Prospect, Data, Both) with 6, 5 and 8 steps, 20 nodes, 35 edges and 18 labels. It names real systems, so the dataset, the golden master and their notes live in the private `wayforge-private` repository, not here.

## Repo layout

```
wayforge/
  schema/                       journey.schema.json, theme.schema.json (published)
  themes/default.json           design tokens of the reference look
  journeys/examples/            generic example journeys
  docs/                         authoring.md (complete guide), llm-authoring.md (brief for an LLM)
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
- **Dataset #1 is private.** The lead journey names real systems and a real process, so it lives in the private `wayforge-private` repo. It never appears in this repository or its history. The engine and schema must never depend on it.
- **Discoverability.** Because the name is a coined word, the repo description and topics do the search work. Suggested one-liner: "Diagram-as-code for animated, multi-lens journey and architecture presentations." Suggested topics: `diagram-as-code`, `visualization`, `svg`, `presentation`, `journey-map`, `architecture-diagram`.
- **Housekeeping before launch:** choose a license, add `CONTRIBUTING.md`, add CI that runs validation, parity and screenshot tests, and include at least two non-proprietary example journeys.
