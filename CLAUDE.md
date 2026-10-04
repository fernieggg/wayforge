# CLAUDE.md

Instructions for Claude Code working in the Wayforge repository. Read `README.md` first for the product description. This file is the working agreement.

## Prime directive

**This is an engine. The lead journey is only its first dataset.**

- Never hard-code anything about the lead journey (node ids, labels, coordinates, copy, colors, system names) in engine code.
- If supporting a new story would require editing `src/engine/`, the engine is wrong. Fix the engine, not the data.
- Every decision should be tested against: "Could someone feed this a completely different journey and get the same quality of output?"

The deliverable pipeline is:

```
journeys/<name>.json  ->  wayforge build  ->  dist/<name>.html  (one self-contained file)
```

## Read this first

1. `README.md` (goals, concepts, target schema sketch, acceptance criteria).
2. `reference/lead-journey.html`. This is the **golden master**. Never edit it. Its rendered output is the spec. When this file and any document disagree, the file wins.
3. Do not write code until you have proposed (a) the final JSON schema and (b) the module layout, and the user has approved them.

## Architecture rules

- **Separate three things strictly:** the engine (generic code), the theme (design tokens), and the journey (data). The journey never contains code; the engine never contains journey content.
- **Output is vanilla.** The built file has no framework runtime. Render with SVG plus a small amount of plain TypeScript compiled and inlined. Build tooling can be anything.
- **Data over code.** Every behavior the reference hard-codes (see the inventory below) must become a field in the schema, with a sensible default.
- **Validate everything.** All journeys are checked against a published JSON Schema plus reference-integrity rules before building. A build from an invalid journey must fail loudly with the offending id and path.
- **Explicit beats clever.** Prefer explicit lens lists over cryptic tags, explicit positions over inferred ones (auto-layout is a later, optional layer that produces the same explicit data).

## Domain model: the rules the reference implements

These rules were worked out by hand over many iterations. Reproduce them exactly.

### Element states and opacity

Every node, edge and label is always drawn, and its opacity is the product of three things:

```
opacity = base(active) x ghost(layer) x lens(visible)
```

| Factor | Values |
|---|---|
| base, nodes | active 1, inactive 0.32 |
| base, edges | active 1, inactive 0.5 |
| base, labels | active 1, inactive 0.35 |
| ghost | 1 when the element's layer is switched on by the scene, otherwise the layer's ghost value (about 0.38 to 0.45) |
| lens | 1 if the element is visible in the current lens, otherwise 0 |

All three are CSS variables so each transitions smoothly (about 0.6 s). Elements outside the current lens are not removed, only faded to 0 with pointer events off.

### Layers

A layer is a named group with an accent color and a ghost value. A scene lists which layers are switched on. Elements in off layers stay visible but faint, as a teaser of what comes later. Layers also drive accent color: active nodes and edges take their layer's accent for their outline.

The reference uses two layers in practice (`deep` for the data layer, `nur` for the nurture journey). Two more (`bk`, `rl`) exist in the CSS from removed work. The engine should support any number.

### Lenses

A lens is a named view. Each element declares which lenses show it. The reference encodes this with one-letter tags; the engine's schema should use explicit lists. The mapping:

| Reference tag | Meaning | Explicit lens list |
|---|---|---|
| `b` or untagged | shared | all lenses |
| `p` | prospect-facing | prospect, both |
| `d` | data-facing | data, both |
| `x` | prospect lens only | prospect |
| `o` | both lens only | both |
| `z` | parked | none (kept in data, never shown) |

Why `x` and `o` exist: the Prospect lens and the Both lens lay the same story out differently, so some edges exist only in one of them.

### Per-lens geometry

A lens can move nodes with a translate offset, animated with a smooth glide (about 0.9 s, ease in-out). The reference does this in the Prospect lens only (`P_SHIFT`): the booking screen, Booked, Nurture journey and "No booking screen" are moved so the story lines up. Because moved nodes need different connections, alternate edges are tagged to a single lens. Edge paths do not animate; they swap by fading.

### Scenes and place-keeping

Each lens has its own ordered scene list. A scene has:

- `key`: the stage it represents (shared across lenses where the stage exists),
- a label (used for the step dot tooltip), a title and a caption,
- a camera rectangle `[x, y, w, h]`,
- the active nodes and edges (and therefore which labels show),
- which layers are on,
- routes (packets),
- optional effects: cycle a highlight through one container's rows, or statically highlight one row.

**Switching lenses keeps the presenter's place.** Find the scene in the new lens with the same `key`. If none, use the scene whose key is nearest in the global `stageOrder` list. On a tie, choose the later one. The camera then glides to that scene.

### Edges, labels and hidden pass-through edges

- Edges are SVG paths. Corners are rounded with `Q` curves. Dashed edges use a `7 9` dash.
- A **hidden edge** draws nothing but can be part of a packet route. It connects an incoming edge to an outgoing edge *through* a node (for example, from where a packet enters the booking screen to where it leaves). Without these, packets would jump between edges.
- A label is attached to one edge and is visible only while that edge is active. Labels are placed manually today. Keep them clear of curves.

### Packets

- A packet is a bright head with a glow (blurred circle) and a fading tail of 7 dots spaced 15 units apart.
- Speed is 300 map units per second. After finishing, a route holds for 0.9 s, then repeats.
- A route is an ordered list of edge ids. Packets follow the combined length. Opacity fades in and out over 50 units at each end.
- Each route has a start `delay` in seconds (used to stagger packets) and an optional `dim` (opacity x 0.45).
- **Packets render beneath node shapes.** Do not move them above. This is what makes them look like they pass *through* a node.
- With reduced motion on, show one static packet at 55% of each route.

### Camera

- The map is one SVG. The camera is the `viewBox`, with `preserveAspectRatio="xMidYMid meet"`, so a camera rectangle with a different aspect ratio than the screen simply shows extra map around it.
- Moves tween the viewBox over 1.3 s with a cubic ease in-out. Reduced motion jumps instantly.
- **Readability rule of thumb:** on-screen text size is about `screenWidth / cameraWidth x fontSize`. Very wide cameras (the full picture) produce tiny text. That is acceptable for an overview shot, not for a content step. A lint for this belongs in `validate`.

### Nodes, pills and rows

- Kinds in use: rounded box, circle, diamond, and **container** (a title plus stacked sub-rows).
- Box: corner radius 16 (containers 20). Title is left-aligned with a 22-unit inset. With a subtitle, the title baseline sits 2 units above center and the subtitle 24 below; with no subtitle, the title sits 8 below center. Font sizes: title 22, subtitle 17, container title 21, row 18.
- **Pill:** a 24-unit-high rounded label straddling the node's top edge, right-aligned with a 10-unit inset. Width is `characters x 7.6 + 26`. Text uses the "button ink" token for contrast on its fill. Pills name the platform or owner. The pill color is a token (`blue`, `violet`, `pink`, `lime`, `teal` in the reference).
- A pill can be hidden in specific lenses (the Messenger pill hides in the Prospect lens, which avoids naming systems).
- Container rows: height 32, pitch 40, inset 24 from the container edge.

### Theming

Colors are CSS variables: `--bg --ink --muted --node --node-line --panel --sys --deep --deep-soft --packet --glass --btn-ink --grid --glow --bk --nur --panel-bk --panel-nur --wk --wk-soft`. The light set is the default; the dark set applies under `prefers-color-scheme: dark` (unless `data-theme="light"`) and under `data-theme="dark"`. Both themes were designed deliberately; check both. The packet color (gold) is reserved for packets only.

### Interaction

Back and Next buttons, one dot per scene, arrow keys, Page Up/Down, space, Home and End, `1 2 3` to select lens (in the order defined by the journey's lenses), `F` for full screen (hidden if unavailable), and swipe left or right on touch.

## Inventory: what the reference hard-codes and must become data

Extract these into the schema. Where a value is a magic number, make it a theme or schema default.

**Hand-built nodes (not in the `NODES` array):**

| Node | Shape | Position | Notes |
|---|---|---|---|
| `click` | circle | center (500, 302), r 46 | caption "prospect clicks" below |
| `gate` | diamond | center (1560, 302), half-width 90 | "Qualified?" with "form logic" below |
| `filter` | diamond | center (2720, 720), half-width 100 | "Booked?" (parked) |
| `flow` | container | (1470, 600), 360 x 240 | "Qualification recipe", Automator pill, 4 rows that cycle highlight |
| `sf` | container | (1930, 628), 190 x 184 | "CRM records", CRM pill, rows Lead / Contact / History Record |

**Panels (hand-drawn):** the "data layer, behind the form" panel (1060, 545, 1925 x 350) and the parked "Messenger: the nurture journey" panel (2480, 420, 850 x 475).

**Other hard-coded values:** all pill labels and widths, the per-lens `P_SHIFT` offsets, the global `ORDER`, the lens-tag tables (`NODE_TAG`, `EDGE_TAG`), packet constants, camera tween duration, scene effects (row cycling and the History Record highlight), the keyboard map, the font stacks, and the default camera.

**Already data-shaped in the reference** (extract as-is): `NODES`, `EDGES`, `LABELS`, and the three scene arrays `SCENES` (Both), `PROSPECT`, `DATA`.

## Output and hosting constraints

The built file must be one self-contained HTML file, under 16 MB:

- Inline all CSS and JS. Embed images as `data:` URIs.
- No runtime network requests. Google Fonts is the only external resource, always with real fallbacks (the reference uses Unbounded for headings and Figtree for text).
- Prefer no CDN scripts. If unavoidable, only `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `cdn.tailwindcss.com` and `code.jquery.com`, with exact pinned versions, as UMD scripts.
- Never rely on `window.storage`, `window.fs`, `window.claude` or any injected API. If you use `localStorage` or `sessionStorage`, wrap every access in try/catch and render correctly when storage is empty.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, with root padding from `env(safe-area-inset-top/bottom)`. Size full-screen layouts with `height: 100%` on `html` and `body`, not `100vh`.
- No `<form>` tags if any React is used. (The reference uses none.)

## Open-source readiness

The repo will become public. Build with that in mind from the start:

- **Nothing private in the engine.** No company names, internal system names, real recipe names or customer data in `src/`, `schema/`, `themes/` or tests. Anything proprietary lives only in `journeys/`.
- **Dataset #1 is not public-safe yet.** `journeys/lead-journey.json` describes a real process. Keep it clearly separated so it can be removed or sanitized before release. Public example journeys go in `journeys/examples/` and must be generic.
- **No secrets, ever.** There should be none to begin with. Add a `.gitignore` and an `.env.example` placeholder, and never commit credentials.
- **Package identity.** Scoped npm package `@<owner>/wayforge` with a `wayforge` binary. Do not publish anything without the user's explicit go-ahead.
- **Name hygiene.** Use "Wayforge" consistently. Do not reuse names of other projects in code or docs. A domain and trademark check is still pending; flag it before any public release.
- **Before launch:** license file (ask which), `CONTRIBUTING.md`, CI running validation, parity and screenshot tests, and a README quick start that works on a clean machine.

## Tooling and commands

Unless the user says otherwise: Node 20+, TypeScript, Vite with a single-file plugin for the build, Ajv for JSON Schema, Vitest for unit tests, Playwright for screenshots. Keep the dependency list short.

Commands to implement and keep working (document them in `README.md` once they exist):

```bash
wayforge validate <file>
wayforge build <file> -o <out.html>
wayforge dev <file>
wayforge snapshot <file> [--lens prospect|data|both] [--theme light|dark]
npm test
```

## Testing and definition of done

A change is done only when all of these hold:

1. **Parity.** `journeys/lead-journey.json` builds a file whose screenshots match the reference for every scene in every lens, in light and dark mode. Expected step counts: Prospect 6, Data 5, Both 8. Allow a tiny pixel tolerance for font rendering only.
2. **Engine-ness.** The `journeys/examples/` journey (a small, deliberately different story) still builds with no engine changes. If you add a feature, add a field to that example or a second one.
3. **Validation.** `wayforge validate` fails on: unknown node or edge ids in scenes, routes and labels; routes through an edge not visible in that scene's lens; duplicate ids; nodes without positions; lenses with no scenes; scenes whose `key` is missing from `stageOrder`; cameras so wide that on-screen text would drop below a configurable minimum.
4. **Constraints.** The output passes every check in "Output and hosting constraints." Add an automated test that scans the built file for external URLs and forbidden APIs.
5. `npm test` passes.

## Authoring rules for journey data

- **Never invent facts.** Only put in the data what the author has stated. If a connection or system is unknown, leave it as a plain arrow or omit it, and add a note. Do not guess recipe names, system roles or routes.
- **Placeholders are flagged.** A title chosen only to fit a design ("CRM records", "Event routing") is a placeholder. Mark it in a `notes` field so it can be confirmed.
- **Park, don't delete.** When the author says "remove X for now," set it to no lenses and keep it. Delete only when they say to delete.
- **Keep scenes honest.** A scene's caption must describe only what is on screen. When elements are removed, review captions that mention them.
- **One decision per change.** Small data changes should be single, reviewable commits.

## Gotchas learned the hard way

- **Apostrophes in hand-written JS strings** broke the reference build once. Moving data to JSON removes the class of bug, but keep escaping in mind in any generated code.
- **Wide maps shrink text.** Check scene cameras for readability, especially the full-picture step.
- **Labels collide with curves.** Place them on the empty side of a curve and away from node edges; verify visually.
- **Arrows have no arrowheads.** Direction comes from packets and labels. If you add optional arrowheads, keep them off by default to preserve parity.
- **A scene that removes its only reason to exist** (for example a step that showed one node that was later deleted) should be removed, not left empty. Ask first.
- **Duplicated steps drift.** Prefer fewer, distinct scenes over zoomed-in repeats of an earlier scene.
- **Both themes matter.** Pill text uses `--btn-ink`, which flips between themes for contrast; do not hard-code white or black.

## Ask before

- Changing the JSON schema in a way that breaks existing journeys.
- Deleting parked content or removing a scene.
- Adding any runtime dependency to the built output.
- Changing the look (fonts, color tokens, packet style). Visual changes are the author's call.
- Running anything that publishes or deploys.

## Style

- Small, focused commits with plain-language messages.
- TypeScript with strict mode. Pure functions for layout and path math, with unit tests.
- No comments that restate code. Comment the *why* of any non-obvious rule above.
- When in doubt about intent, ask a single clear question rather than guessing.
