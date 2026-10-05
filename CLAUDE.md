# CLAUDE.md

Instructions for Claude Code working in the Wayforge repository. Read `README.md` first for the product description. This file is the working agreement.

## Prime directive

**This is an engine. Journeys are data.**

- Never hard-code anything about a particular journey (node ids, labels, coordinates, copy, colors, system names) in engine code.
- If supporting a new story would require editing `src/`, the engine is wrong. Fix the engine, not the data.
- Every decision should be tested against: "Could someone feed this a completely different journey and get the same quality of output?"

The deliverable pipeline is:

```
journeys/<name>.json  ->  wayforge build  ->  dist/<name>.html  (one self-contained file)
```

## Read this first

1. `README.md` (goals, concepts, commands).
2. `docs/authoring.md` (every field, layout math, validation messages).
3. The example journeys in `journeys/examples/`.

## Architecture rules

- **Separate three things strictly:** the engine (generic code), the theme (design tokens), and the journey (data). The journey never contains code; the engine never contains journey content.
- **Output is vanilla.** The built file has no framework runtime. Render with SVG plus a small amount of plain TypeScript compiled and inlined. Build tooling can be anything.
- **Data over code.** Every presentational behavior is a field in the journey or the theme, with a sensible default.
- **Validate everything.** All journeys are checked against a published JSON Schema plus reference-integrity rules before building. A build from an invalid journey must fail loudly with the offending id and path.
- **Explicit beats clever.** Prefer explicit lens lists over cryptic tags, explicit positions over inferred ones (auto-layout is a later, optional layer that produces the same explicit data).

## Domain model

Reproduce these rules exactly; the rendered output depends on them.

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

A layer is a named group with an accent tone and a ghost value. A scene lists which layers are switched on. Elements in off layers stay visible but faint, as a teaser of what comes later. Layers also drive accent color: active nodes and edges take their layer's tone for their outline. The engine supports any number of layers.

### Lenses

A lens is a named view. Each element declares which lenses show it with an explicit list:

| `lenses` | Meaning |
|---|---|
| missing | shared: shown in every lens |
| a list of lens ids | shown only in those lenses |
| `[]` | parked: kept in the data, never shown |

Two lenses can lay the same story out differently, so some edges exist in only one of them.

### Per-lens geometry

A lens can move nodes with a translate offset, animated with a smooth glide (about 0.9 s, ease in-out). Because moved nodes need different connections, alternate edges are limited to a single lens. Edge paths do not animate; they swap by fading.

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
- A **hidden edge** draws nothing but can be part of a packet route. It connects an incoming edge to an outgoing edge *through* a node (from where a packet enters the node to where it leaves). Without these, packets would jump between edges.
- A label is attached to one edge. It is full strength while that edge is active and dimmed (base 0.35) otherwise; it is never hidden by activity alone. Labels are placed manually today. Keep them clear of curves.

### Packets

- A packet is a bright head with a glow (blurred circle) and a fading tail of 7 dots spaced 15 units apart.
- Speed is 300 map units per second. After finishing, a route holds for 0.9 s, then repeats.
- A route is an ordered list of edge ids. Packets follow the combined length. Opacity fades in and out over 50 units at each end.
- Each route has a `phase` in seconds (used to stagger packets) and an optional `dim` (opacity x 0.45). `phase` is a clock offset, not a start delay: the head sits at `((now + phase) mod (travel + hold)) x speed`, where `now` is page time, not scene time.
- **Packets render beneath node shapes.** Do not move them above. This is what makes them look like they pass *through* a node.
- With reduced motion on, show one static packet at 55% of each route.

### Camera

- The map is one SVG. The camera is the `viewBox`, with `preserveAspectRatio="xMidYMid meet"`, so a camera rectangle with a different aspect ratio than the screen simply shows extra map around it.
- Moves tween the viewBox over 1.3 s with a cubic ease in-out. Reduced motion jumps instantly.
- **Readability rule of thumb:** on-screen text size is about `screenWidth / cameraWidth x fontSize`. Very wide cameras (the full picture) produce tiny text. That is acceptable for an overview shot, not for a content step. The `readability` lint in `validate` warns about this; mark establishing shots `"wide": true` to exempt them.

### Nodes, pills and rows

- Kinds: rounded box, circle, diamond, and **container** (a title plus stacked sub-rows).
- Box: corner radius 16 (containers 20). Title is left-aligned with a 22-unit inset. With a subtitle, the title baseline sits 2 units above center and the subtitle 24 below; with no subtitle, the title sits 8 below center. Font sizes: title 22, subtitle 17, container title 21, row 18.
- **Pill:** a 24-unit-high rounded label straddling the node's top edge, right-aligned with a 10-unit inset. Width defaults to `characters x 7.6 + 26` and can be set per pill. Text uses the "button ink" token for contrast on its fill. Pills name the platform or owner. The pill color is a theme tone (the default theme has `blue`, `violet`, `pink`, `teal`, `lime`).
- A pill can be hidden in specific lenses, for example to avoid naming systems in an audience-facing view.
- Container rows: height 32, pitch 40, inset 24 from the container edge by default. Containers can override their layout per node (`metrics`: row inset, title position, first-row offset).

### Theming

Colors are CSS variables: `--bg --ink --muted --node --node-line --panel --sys --deep --deep-soft --packet --glass --btn-ink --grid --glow --pink --teal --panel-pink --panel-teal --lime --lime-soft`. Tones (`themes/default.json`) point at these variables; journeys use tone names. The light set is the default; the dark set applies under `prefers-color-scheme: dark` (unless `data-theme="light"`) and under `data-theme="dark"`. Both themes were designed deliberately; check both. The packet color (gold) is reserved for packets only.

### Sub-flows (zoom)

- A node or panel with `zoom: { journey }` opens another journey file. `src/model/tree.ts` loads the tree. Each reference is its own flow instance with an id prefix (`""` for the root, `z1`, `z2`...), validated with the normal pipeline. A reference back to an ancestor is an error.
- All flows live in one SVG as **sibling** groups (`[data-flow]`), never nested, so scoped descendant selectors cannot leak between flows. Map CSS is scoped per flow under `.wf-f<i>`. Every rule gains exactly one class, which preserves the cascade inside a flow; lens and layer state classes sit on the flow group itself.
- A sub-flow is placed by `fitTransform` (uniform, centered, 6% padding) inside its owner's box. Its root-coordinate transform is composed at entry from the parent's transform, the owner's offset in the parent's current lens, and the fit (`absoluteTransform` in `src/geometry/zoom.ts`). Cameras of a sub-flow are its own cameras mapped through that transform. The camera is still only the viewBox.
- The zoom is one flight (`motion.zoom`, 1.6 s). Size interpolates geometrically, and the center follows the size change so the destination stays in view (`zoomFrame`). The two maps cross-fade, staggered, in the middle of the flight. Reduced motion swaps instantly. The `fly` tween used for ordinary camera moves is separate and unchanged by zoom.
- Root ids stay unprefixed and the root keeps its structure, so a journey without sub-flows renders exactly as it would without zoom support. Keep it that way after any zoom change.
- `goToScene(..., 'dots')` in `src/cli/drive.ts` jumps by step dot. Use it in tests: stepping with the arrow key through a scene with `enter` zooms in.

### Interaction

Back and Next buttons, one dot per scene, arrow keys, Page Up/Down, space, Home and End, `1 2 3` to select lens (in the order defined by the journey's lenses), `F` for full screen (hidden if unavailable), and swipe left or right on touch.

## Output and hosting constraints

The built file must be one self-contained HTML file, under 16 MB:

- Inline all CSS and JS. Embed images as `data:` URIs.
- No runtime network requests. Google Fonts is the only external resource, always with real fallbacks (the default theme uses Unbounded for headings and Figtree for text).
- Prefer no CDN scripts. If unavoidable, only `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `cdn.tailwindcss.com` and `code.jquery.com`, with exact pinned versions, as UMD scripts.
- Never rely on `window.storage`, `window.fs`, `window.claude` or any injected API. If you use `localStorage` or `sessionStorage`, wrap every access in try/catch and render correctly when storage is empty.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, with root padding from `env(safe-area-inset-top/bottom)`. Size full-screen layouts with `height: 100%` on `html` and `body`, not `100vh`.
- No `<form>` tags if any React is used.

## Open-source readiness

The repo will become public. Build with that in mind from the start:

- **Nothing private in the engine.** No company names, internal system names or customer data in `src/`, `schema/`, `themes/`, tests or docs.
- **Proprietary journeys never go in this repo.** Keep them outside it or in the ignored `journeys/local/`. Public example journeys go in `journeys/examples/` and must be generic.
- **No secrets, ever.** There should be none to begin with. Keep the `.gitignore` and the `.env.example` placeholder, and never commit credentials.
- **Package identity.** Scoped npm package `@<owner>/wayforge` with a `wayforge` binary. Do not publish anything without the user's explicit go-ahead.
- **Name hygiene.** Use "Wayforge" consistently. Do not reuse names of other projects in code or docs. On 2026-10-04 npm and PyPI had no `wayforge` package and the closest GitHub match was a small unrelated repo. A domain and trademark check is still pending; flag it before any public release.
- **Discoverability.** The name is a coined word, so the repo description and topics do the search work. One-liner: "Diagram-as-code for animated, multi-lens journey and architecture presentations." Topics: `diagram-as-code`, `visualization`, `svg`, `presentation`, `journey-map`, `architecture-diagram`.
- **README is for users.** It describes the product. Internal development notes belong here, not in the README.
- **Before launch:** license file (ask which), `CONTRIBUTING.md`, CI running validation, regression and screenshot tests, and a README quick start that works on a clean machine.

## Tooling and commands

Unless the user says otherwise: Node 22.12+ (Vite and Vitest need it; the CLI checks at startup), TypeScript, Vite with a single-file plugin for the build, Ajv for JSON Schema, Vitest for unit tests, Playwright for screenshots. Keep the dependency list short.

Commands to keep working (documented in `README.md`):

```bash
wayforge validate <file>
wayforge build <file> -o <out.html>
wayforge dev <file>
wayforge snapshot <file> [--lens <id>] [--theme light|dark]
npm test
```

### Visual regression

`tests/regression/` builds a journey and compares it, scene by scene in every lens, light and dark, against a reference HTML page: computed styles of every map element, plus screenshots with a tiny pixel tolerance for font rendering. Point it at the pair with `WAYFORGE_REGRESSION_JOURNEY` and `WAYFORGE_REGRESSION_REFERENCE`; it skips when they are unset. `npm run regression:report` prints the structural differences without failing.

## Testing and definition of done

A change is done only when all of these hold:

1. **Regression.** When `WAYFORGE_REGRESSION_JOURNEY` and `WAYFORGE_REGRESSION_REFERENCE` are set, `npm run test:browser` shows no structural or pixel differences in any scene of any lens, in light and dark mode.
2. **Engine-ness.** The `journeys/examples/` journeys still build with no engine changes. If you add a feature, add a field to an example or a new one.
3. **Validation.** `wayforge validate` fails on: unknown node or edge ids in scenes, routes and labels; routes through an edge not visible in that scene's lens; duplicate ids; nodes without positions; lenses with no scenes; scenes whose `key` is missing from `stageOrder`. It warns (and fails with `--strict`) on cameras so wide that on-screen text would drop below a configurable minimum. This is a warning rather than an error because a content scene occasionally needs a wide shot.
4. **Constraints.** The output passes every check in "Output and hosting constraints." `tests/constraints/` scans built files for external URLs and forbidden APIs.
5. `npm test` passes.

## Authoring docs

`docs/authoring.md` (for people) and `docs/llm-authoring.md` (for an LLM) must stay complete and correct. Any change to the schema, the theme, defaults, layout math, validation rules or interaction updates them in the same change. Every ```json block in `README.md` and `docs/` is parsed by `tests/validate/docs.test.ts`, and each complete journey among them must validate with no errors or warnings. Fence fragments as ```jsonc.

## Authoring rules for journey data

- **Never invent facts.** Only put in the data what the author has stated. If a connection or system is unknown, leave it as a plain arrow or omit it, and add a note. Do not guess system names, roles or routes.
- **Placeholders are flagged.** A title chosen only to fit a design ("CRM records", "Event routing") is a placeholder. Mark it in a `notes` field so it can be confirmed.
- **Park, don't delete.** When the author says "remove X for now," set it to no lenses and keep it. Delete only when they say to delete.
- **Keep scenes honest.** A scene's caption must describe only what is on screen. When elements are removed, review captions that mention them.
- **One decision per change.** Small data changes should be single, reviewable commits.

## Gotchas learned the hard way

- **Apostrophes in hand-written JS strings** break builds. Keeping data in JSON removes the class of bug, but keep escaping in mind in any generated code.
- **Wide maps shrink text.** Check scene cameras for readability, especially the full-picture step.
- **Labels collide with curves.** Place them on the empty side of a curve and away from node edges; verify visually.
- **Arrows have no arrowheads.** Direction comes from packets and labels. If you add optional arrowheads, keep them off by default so existing output is unchanged.
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
