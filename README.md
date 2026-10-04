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

## Where things stand today

There is one hand-built reference file: `reference/lead-journey.html` (about 38 KB, one self-contained page). It works and looks right, but **data and code are tangled together**:

- Most content is already data-shaped JavaScript objects inside the file (`NODES`, `EDGES`, `LABELS`, `SCENES`, `PROSPECT`, `DATA`, `NODE_TAG`, `EDGE_TAG`, `P_SHIFT`, `ORDER`).
- Some content is hard-coded in the rendering code: five hand-drawn nodes (a circle, two diamonds, and two containers with sub-rows), two background panels, pill labels, and every visual constant.
- Coordinates and edge paths are typed by hand.

The first job is to separate those two things without changing a single pixel of output. See `CLAUDE.md` for the full inventory of what to lift into data.

The reference file is the **golden master**. Do not edit it. Treat its rendered output as the specification.

## What the engine needs to do

### Core concepts

| Concept | What it is |
|---|---|
| **Node** | A box, circle, diamond or container on the map. Has a title, optional subtitle, optional pills, optional sub-rows. |
| **Pill** | A small colored label that straddles a node's top edge and names the platform or owner (for example "Automator", "CRM", "Messenger"). |
| **Edge** | A path between nodes. Solid or dashed, any accent color. Can be a hidden pass-through (see below). |
| **Label** | Small text attached to an edge. Only visible while its edge is active. |
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

## Target data model (sketch)

This is a starting design, not a final schema. Claude Code should finalize it, publish it as JSON Schema, and validate every journey against it.

Visibility is explicit lens lists, replacing the reference's cryptic one-letter tags (the mapping is in `CLAUDE.md`).

```jsonc
{
  "meta": { "title": "A lead's journey, from ad to agent", "favicon": "⚡" },

  "layers": {
    "data":  { "accent": "deep", "ghost": 0.45 },
    "nurture": { "accent": "teal", "ghost": 0.38 }
  },

  "lenses": {
    "prospect": { "label": "Prospect", "key": "1" },
    "data":     { "label": "Data",     "key": "2" },
    "both":     { "label": "Both",     "key": "3", "default": true }
  },

  "stageOrder": ["overview", "ads", "landing", "gate", "data", "sfrec", "lcap", "handoff", "full"],

  "nodes": [
    { "id": "wp", "kind": "box", "at": [700, 170], "size": [250, 90],
      "title": "Landing page",
      "pills": [{ "label": "CMS", "tone": "blue" }] },

    { "id": "sf", "kind": "container", "at": [1930, 628], "size": [190, 184],
      "title": "CRM records", "layer": "data",
      "pills": [{ "label": "CRM", "tone": "violet" }],
      "rows": ["Lead", "Contact", "History Record"] },

    { "id": "book", "kind": "box", "at": [1830, 150], "size": [240, 100],
      "title": "Booking screen", "sub": "meet with an agent",
      "lenses": ["prospect", "both"],
      "positionByLens": { "prospect": [0, 102] } }
  ],

  "edges": [
    { "id": "cwp", "path": "M546 302 C625 302 625 215 700 215" },
    { "id": "bk_thru", "path": "M1830 200 L2070 235", "hidden": true, "lenses": ["both"] },
    { "id": "pnb", "path": "M2070 314 C2190 314 2190 417 2330 417",
      "accent": "teal", "lenses": ["prospect"] }
  ],

  "labels": [
    { "edge": "pnb", "at": [2316, 446], "anchor": "end", "text": "not booked" }
  ],

  "panels": [
    { "id": "datalayer", "rect": [1060, 545, 1925, 350], "layer": "data",
      "title": { "at": [1262, 582], "text": "The data layer, behind the form" },
      "lenses": ["data", "both"] }
  ],

  "scenes": {
    "both": [
      {
        "key": "gate",
        "label": "Form gate",
        "title": "The form decides who sees the booking screen",
        "text": "Logic on the form decides whether the prospect continues...",
        "camera": [1440, 60, 2400, 780],
        "layers": ["nurture"],
        "active": { "nodes": ["gate", "book", "booked"], "edges": ["fg", "gb", "bkd"] },
        "routes": [
          { "path": ["fg", "gb", "thru_bkd", "bkd"], "delay": 0 },
          { "path": ["fg", "gn"], "delay": 6.4, "dim": true }
        ]
      }
    ],
    "prospect": [],
    "data": []
  }
}
```

Scene effects that are currently hard-coded and should become data: cycling highlight through a container's rows (the qualification steps), and statically highlighting one row (the "History Record" trigger).

## Commands (to be built)

```bash
wayforge validate journeys/lead-journey.json     # schema + reference-integrity checks
wayforge build    journeys/lead-journey.json -o dist/lead-journey.html
wayforge dev      journeys/lead-journey.json     # live reload while editing data
wayforge snapshot journeys/lead-journey.json     # PNG of every scene in every lens
```

`validate` must catch the mistakes that were made by hand during development: a scene or route referencing an edge or node id that does not exist, a packet route that uses a parked or hidden-in-this-lens edge, a node with no position, duplicate ids, and a lens with no scenes.

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

## Proposed repo layout

```
wayforge/
  README.md
  CLAUDE.md
  package.json
  reference/
    lead-journey.html          # golden master, never edited
  schema/
    journey.schema.json
  src/
    engine/                    # generic renderer: camera, packets, lenses, scenes, layout
    themes/                    # token sets (light, dark)
    cli/                       # build, validate, dev, snapshot
    template.html
  journeys/
    lead-journey.json          # dataset #1
  tests/
    parity/                    # screenshot comparison against the reference
    validate/                  # good and bad journey fixtures
  dist/                        # built single-file output (gitignored)
```

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
- **Dataset #1 is private-ish.** The lead journey names real systems and a real process. Before going public, either sanitize it into a generic example or keep it out of the public repo. The engine and schema must never depend on it.
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
