# Authoring journeys

This guide covers everything needed to write a working Wayforge journey from scratch: the workflow, every field, colors, layout, scenes, sub-flows, and what each validation message means. If you are an LLM, or briefing one, also read [llm-authoring.md](llm-authoring.md).

- [1. What you are making](#1-what-you-are-making)
- [2. Workflow](#2-workflow)
- [3. Plan before you type](#3-plan-before-you-type)
- [4. File anatomy](#4-file-anatomy)
- [5. Field reference](#5-field-reference)
- [6. Colors and themes](#6-colors-and-themes)
- [7. Layout guide](#7-layout-guide)
- [8. Scenes and storytelling](#8-scenes-and-storytelling)
- [9. Sub-flows (zoom)](#9-sub-flows-zoom)
- [10. Validation messages](#10-validation-messages)
- [11. Presenting and sharing](#11-presenting-and-sharing)
- [12. A complete example](#12-a-complete-example)

## 1. What you are making

A journey is one JSON file. Wayforge turns it into one self-contained HTML page: a map of boxes and connections, a camera that glides between views, packets of light that travel along the connections, and a caption for each step.

- The **map** is one big canvas. Everything on it is placed by coordinates in "map units" (think pixels at 100% zoom).
- **Lenses** are different views of the same map (for example "Customer" and "Team"). Every element says which lenses show it.
- **Scenes** are the steps of the walkthrough. Each lens has its own ordered list of scenes.
- **Layers** are groups of elements that stay faint until a scene switches them on.
- **Sub-flows** are other journey files that open when you zoom into a node.

## 2. Workflow

```bash
npm install                                   # once, in the wayforge folder
npx wayforge dev journeys/my-story.json       # live preview at http://localhost:5173
```

Edit the JSON and save; the page rebuilds and reloads. When something is wrong, the page lists the errors with their exact location instead. Then:

```bash
npx wayforge validate journeys/my-story.json  # errors and warnings only
npx wayforge build journeys/my-story.json -o my-story.html
npx wayforge snapshot journeys/my-story.json  # PNG of every step (needs: npx playwright install chromium)
```

Start the file with `"$schema": "../schema/journey.schema.json"` (path relative to your file). Editors such as VS Code then autocomplete fields, show their documentation on hover and underline mistakes.

The fastest way to start is to copy `journeys/examples/support-ticket.json` or the example in [section 12](#12-a-complete-example).

## 3. Plan before you type

Answer these on paper first. Layout is the slow part, and a plan makes it fast.

1. **The story in one sentence.** What does the audience understand at the end?
2. **The stages.** The ordered steps of the story, as short ids (`overview`, `order`, `pay`, `make`, `pickup`). These become `stageOrder`.
3. **The lenses.** Who looks at it and what differs between their views. One lens is fine. Two or three is typical.
4. **The layers.** Is there a part that should stay faint until later (a "behind the scenes" layer)?
5. **The elements.** List nodes and connections. Note which are only in some lenses.
6. **A rough grid.** Sketch the nodes in columns (left to right is the usual reading order) and lanes (rows). See [section 7](#7-layout-guide) for spacing numbers.
7. **The scenes.** For each lens: which stages, what the camera frames, what lights up, what the caption says.

Rules worth keeping from the start:

- **Never invent facts.** Only put in what you know. If a connection or system is unknown, leave it out or mark it in `notes`.
- **Flag placeholders.** A title chosen to fill space ("CRM records") gets a `notes` entry so it can be confirmed later.
- **Park, don't delete.** To hide something for now, set `"lenses": []`. It stays in the file.
- **Captions describe only what is on screen.**

## 4. File anatomy

| Key | Required | What it is |
|---|---|---|
| `$schema` | no | Path to `schema/journey.schema.json`, for editor help. |
| `version` | yes | Always `1`. |
| `meta` | yes | Title, header text, accessible description, language, favicon. |
| `theme` | no | `"default"` (built in) or a path to a theme file. |
| `themeOverrides` | no | Colors, tones or other theme values to change. See [section 6](#6-colors-and-themes). |
| `ui` | no | Interface text (buttons, hints), for other languages. |
| `lenses` | yes | The views, in button order. |
| `layers` | no | Groups that stay faint until a scene switches them on. |
| `stageOrder` | yes | The ordered stage ids that scenes refer to. |
| `groups` | no | Named lists of ids, used as `"@name"` in scenes. |
| `panels` | no | Dashed background areas with a title. |
| `nodes` | yes | Boxes, circles, diamonds and containers. |
| `edges` | yes | Connections (SVG paths). Can be `[]`. |
| `labels` | no | Text attached to edges. |
| `scenes` | yes | One ordered scene list per lens id. |
| `notes` | no | Free text, never shown. Allowed on almost every object. |

Ids (for nodes, edges, panels, lenses, layers, groups, stages) use letters, digits, `_` and `-`, and start with a letter. Each kind has its own namespace, so a lens and a layer may both be called `data`, but two nodes may not share an id.

**Array order is paint order**: later nodes draw on top of earlier ones, and the same goes for edges, labels and panels.

## 5. Field reference

Defaults are in parentheses. Coordinates are `[x, y]` in map units; sizes are `[width, height]`; rectangles are `[x, y, width, height]`.

### meta

| Field | |
|---|---|
| `title` | Required. Browser tab title. |
| `brand` | Small text at the top left of the page. Also the first breadcrumb when inside a sub-flow. |
| `description` | Accessible description of the whole map, read by screen readers. Recommended. |
| `lang` | Page language (`"en"`). |
| `favicon` | An emoji (`"🎫"`) or a `data:` URI. None by default. |

### ui

All optional; English defaults. `{keys}`, `{n}`, `{label}` and `{title}` are filled in.

| Field | Default |
|---|---|
| `back` | `Back` |
| `next` | `Next` |
| `fullscreen` | `Full screen` |
| `hint` | `Arrow keys to move, {keys} to switch lens` |
| `lensGroup` | `Lens` (accessible name of the lens buttons) |
| `steps` | `Journey steps` (accessible name of the step dots) |
| `step` | `Step {n}: {label}` (each step dot) |
| `open` | `Open {title}` (accessible name of a zoomable element) |
| `exit` | `Back to {title}` (breadcrumb buttons) |
| `breadcrumb` | `Where you are` (accessible name of the breadcrumb) |

### lenses

```jsonc
"lenses": [
  { "id": "guest", "label": "Guest" },
  { "id": "barista", "label": "Barista", "default": true }
]
```

Order sets the button order and the number keys (1, 2, 3...). One lens may be `"default": true` (otherwise the first). With a single lens, the lens buttons and hint are hidden.

### layers

```jsonc
"layers": [{ "id": "back", "tone": "violet", "ghost": 0.4 }]
```

- `tone`: the accent color of the layer's active elements (see [section 6](#6-colors-and-themes)).
- `ghost`: opacity multiplier (0 to 1) while a scene has the layer switched off. 0.38 to 0.45 reads as "a teaser of what comes later".

An element joins a layer with `"layer": "back"`. A scene switches layers on with `"layers": ["back"]`.

### stageOrder and groups

```jsonc
"stageOrder": ["overview", "order", "pay", "make", "pickup"],
"groups": { "lane": ["guest", "order", "paid"], "all": ["@lane", "bar", "pickup"] }
```

Every scene's `key` must be in `stageOrder`. When the viewer switches lens, Wayforge shows the scene with the same key in the new lens, or the nearest stage in this order (the later one on a tie).

Groups are only shortcuts for scene `active` lists. They can include other groups.

### nodes

Common fields for every kind:

| Field | |
|---|---|
| `id`, `kind`, `at`, `size`, `title` | Required. `at` is the **top-left corner of the bounding box** for every kind. |
| `subtitle` | Second line (boxes) or a caption below (circles, diamonds). Not shown on containers. |
| `layer` | Layer id. |
| `tone` | Outline color when active (the layer's tone, else the theme's default tone). |
| `outline` | `"normal"` or `"strong"` (thicker active outline). (`"normal"`) |
| `pills` | Small labels on the top edge. See below. |
| `lenses` | Lens ids that show the node. Left out means all lenses; `[]` parks it. |
| `offsetByLens` | `{ "lensId": [dx, dy] }` moves the node in that lens, with a smooth glide. |
| `metrics` | Per-node layout overrides. See below. |
| `zoom` | Makes the node open a sub-flow. See [section 9](#9-sub-flows-zoom). |
| `notes` | Never shown. |

Kinds:

| `kind` | Shape | Text |
|---|---|---|
| `box` | Rounded rectangle (corner radius 16). | Title left-aligned 22 in from the left edge. With a subtitle, the title sits just above the middle and the subtitle below it. |
| `circle` | Circle of diameter `min(width, height)`. | Title centered; subtitle centered below the circle. |
| `diamond` | Diamond touching the middle of each side of the box. | Title centered; subtitle centered below the diamond. |
| `container` | Rounded rectangle (radius 20) with a title and stacked rows. | Title at the top left; rows below it. |

Container-only fields:

- `rows`: list of strings, or `{ "id": "two", "text": "Second row" }` when a scene needs to highlight that row.
- `rowStyle`: `"outline"` (rows take the node's outline color while active) or `"tint"` (rows fill with the tone's soft color while active). (`"outline"`)

**Pills** (`"pills": [{ "text": "POS", "tone": "blue" }]`): a 24-high rounded label straddling the top edge, right-aligned 10 in from the right edge. Several pills line up right to left. Fields: `text`, `tone`, `width` (default `round(characters × 7.6 + 26)`), `hideIn` (lens ids in which the pill fades out, for example to avoid naming systems in a customer view).

**`metrics`** overrides layout numbers for one node. Only keys that apply to the node's kind are allowed:

| Kind | Keys (defaults) |
|---|---|
| `box` | `radius` 16, `inset` 22, `titleDy` 8 (title baseline below center, no subtitle), `titleDySub` -2 (title baseline with a subtitle), `subDy` 24 (subtitle baseline) |
| `circle`, `diamond` | `titleDy` 7, `subGap` 28 for circles and 34 for diamonds (subtitle baseline below the shape) |
| `container` | `radius` 20, `titleOffset` [26, 50], `rowsTop` 80, `rowInset` 24, `rowTextInset` 18, `rowHeight` 32, `rowPitch` 40, `rowRadius` 10 |

### edges

```jsonc
{ "id": "e3", "path": "M700 200 L780 200", "layer": "back", "tone": "pink", "dashed": true, "lenses": ["barista"] }
```

| Field | |
|---|---|
| `id`, `path` | Required. `path` is SVG path data in map units. See [section 7](#7-layout-guide). |
| `layer`, `tone`, `lenses`, `notes` | As for nodes. |
| `dashed` | Dashed line. (`false`) |
| `hidden` | Draws nothing; carries packets through a node. (`false`) |

Edges have no arrowheads. Direction comes from the packets and the labels.

### labels

```jsonc
{ "edge": "e3", "at": [740, 188], "anchor": "middle", "text": "paid" }
```

`at` is where the text's baseline starts (`start`), centers (`middle`) or ends (`end`). (`anchor`: `"start"`.) A label is full strength while its edge is active and dimmed otherwise. It takes its edge's layer and lenses unless you set `layer` or `lenses`. Labels can have an optional `id`.

### panels

```jsonc
{ "id": "counter", "rect": [750, 70, 360, 280], "tone": "violet", "layer": "back",
  "title": { "text": "Behind the counter", "at": [776, 104] } }
```

A dashed rounded rectangle (radius 28) filled with the tone's panel color, drawn behind everything else. Fields: `id`, `rect`, `tone` (required), `layer`, `lenses`, `title` (`text` and the baseline position `at`), `zoom`, `notes`. Panels have no "active" state; they follow their layer and lenses only.

### scenes

```jsonc
"scenes": {
  "barista": [
    { "key": "make", "label": "Make", "title": "The bar makes the drink",
      "caption": "Each drink is ground, pulled and steamed to order.",
      "camera": [700, 40, 720, 340],
      "layers": ["back"],
      "active": { "nodes": ["paid", "bar", "pickup"], "edges": ["e3", "e4"] },
      "routes": [{ "edges": ["e3", "thru", "e4"] }],
      "effects": [{ "type": "cycleRows", "node": "bar" }] }
  ]
}
```

| Field | |
|---|---|
| `key` | Required. A stage id from `stageOrder`. |
| `label` | Required. Tooltip on the step dot. Keep it to one or two words. |
| `title`, `caption` | Required. Shown in the footer. |
| `camera` | Required. `[x, y, width, height]` of the map to show. See [section 7](#7-layout-guide). |
| `active` | Required. `{ "nodes": [...], "edges": [...] }`. Ids or `"@group"`. Active elements are full strength; everything else dims. A label is active when its edge is. |
| `layers` | Layers switched on. (none) |
| `routes` | Packets. See below. (none) |
| `effects` | Movement inside containers. See below. (none) |
| `enter` | A zoomable node or panel; Next on this scene zooms into its sub-flow. |
| `wide` | Marks an establishing shot, so the readability warning ignores it. (`false`) |
| `notes` | Never shown. |

**Routes** (`{ "edges": ["e1", "e2"], "phase": 1.5, "dim": true }`): one packet that travels along the edges in order, then waits 0.9 s and repeats. Packets move at 300 map units per second and draw underneath nodes, so they appear to pass through them. `phase` (seconds, default 0) shifts the packet's timing so several packets don't move in lockstep; `dim` makes it fainter (good for the less common path). Every edge in a route must be visible in the scene's lens.

**Effects**:
- `{ "type": "cycleRows", "node": "bar", "interval": 1.1 }` steps a highlight through a container's rows (`interval` in seconds, default 1.1). The node's tone needs a soft color ([section 6](#6-colors-and-themes)).
- `{ "type": "highlightRow", "node": "kb", "row": "published" }` highlights one row, chosen by its row `id`.

## 6. Colors and themes

Elements are colored by **tone**, a named color from the theme. The default theme defines:

| Tone | Light | Dark | Soft (for row fills) | Panel fill |
|---|---|---|---|---|
| `blue` (default tone) | `#1d6fd8` | `#5cc8ff` | no | no |
| `violet` | `#6a52e0` | `#a596ff` | yes | yes |
| `pink` | `#d6336c` | `#ff8fa8` | no | yes |
| `teal` | `#0b9a74` | `#4fe3b5` | no | yes |
| `lime` | `#4c8a00` | `#b8f26a` | yes | no |

- A node or edge with no `tone` takes its layer's tone, else `blue`.
- `cycleRows`, `highlightRow` and `rowStyle: "tint"` look best on a tone with a soft color (`violet` or `lime`), and the validator warns otherwise.
- A panel's fill is its tone's panel color; tones without one give an unfilled panel.
- Packets are always gold (the `packet` color). Don't use it for anything else.

Both light and dark themes are generated; the page follows the viewer's system setting.

**Adding or changing colors** with `themeOverrides`. Add the colors to both palettes, then define tones that point at them:

```jsonc
"themeOverrides": {
  "colors": {
    "light": { "mint": "#0f8f64", "mint-soft": "rgba(15,143,100,.14)", "mint-panel": "rgba(15,143,100,.05)" },
    "dark":  { "mint": "#43e0a8", "mint-soft": "rgba(67,224,168,.18)", "mint-panel": "rgba(67,224,168,.05)" }
  },
  "tones": { "mint": { "color": "mint", "soft": "mint-soft", "panel": "mint-panel" } },
  "defaultTone": "mint"
}
```

You can also override existing colors (`bg`, `ink`, `muted`, `node`, `node-line`, `glass`, `btn-ink`, `grid`, `glow`, `packet`), fonts, motion timings or packet style. The full list of theme keys, with descriptions, is in `schema/theme.schema.json`; the default values are in `themes/default.json`. The page chrome (background, header, footer) always uses the root journey's theme.

## 7. Layout guide

### Coordinates and spacing

The origin is the top-left; x grows right, y grows down. There is no fixed canvas size: the map is as big as your coordinates.

A comfortable grid:

- **Columns** about 300 to 400 units apart (left edge to left edge), leaving 80 to 140 units of gap between nodes for edges and labels.
- **Lanes** about 150 to 250 units apart (center to center).
- Keep each lane's nodes vertically centered on one line, so straight edges connect them.

### Sizing nodes to their text

Text does not wrap; size boxes so it fits. Approximate widths per character in the default fonts:

| Text | Size | Width per character |
|---|---|---|
| Node title | 22 | about 11 |
| Subtitle | 17 | about 8.5 |
| Container title | 21 | about 10.5 |
| Container row | 18 | about 9 |
| Label | 16 | about 8 |
| Pill | 13 | covered by the default pill width |

Sizing rules:

- **Box**: width ≥ 44 + the longer of (title characters × 11, subtitle characters × 8.5). Height 90 to 100 with a subtitle, 70 to 80 without. If it has pills, keep the pill clear of the title: pill width + 10 + title width + 22 ≤ box width, or accept the pill sitting over empty space on the right.
- **Circle**: diameter ≥ title characters × 11 + 24 (a one-word title in a 90 to 100 circle). The subtitle sits 28 below the circle; leave room.
- **Diamond**: width ≥ title characters × 11 × 1.6 (the middle of a diamond is the only wide part); 180 square fits a ten-character title. The subtitle sits 34 below the bottom point.
- **Container**: height = 80 + 40 × rows (for example 200 for three rows, 240 for four). Width ≥ 48 + 36 + the longest row's characters × 9, and ≥ 52 + title characters × 10.5.

### Connection points

Every kind connects most cleanly at the middle of a side of its bounding box. For a node at `[x, y]` with size `[w, h]`:

| Side | Point |
|---|---|
| left | `(x, y + h/2)` |
| right | `(x + w, y + h/2)` |
| top | `(x + w/2, y)` |
| bottom | `(x + w/2, y + h)` |

For circles (with equal width and height) and diamonds these points lie exactly on the shape. Boxes and containers can also connect anywhere along a side.

### Writing paths

Paths are SVG path data. Four commands cover nearly everything (capital letters use absolute coordinates):

| Command | Meaning |
|---|---|
| `M x y` | Start here. |
| `L x y` | Straight line to here. |
| `C x1 y1 x2 y2 x y` | Smooth curve to `x y`; the two middle points pull the curve. |
| `Q cx cy x y` | Gentle curve; used here for rounded corners. |

Patterns:

- **Straight, same lane**: `M 440 200 L 520 200`.
- **S-curve between lanes** from `(x1, y1)` to `(x2, y2)`: put both control points at the horizontal midpoint `m = (x1 + x2) / 2`: `M x1 y1 C m y1 m y2 x2 y2`. Example: `M740 250 C800 250 800 375 860 375`.
- **Right-angle with a rounded corner** (radius 40), going right then down: `M 1100 85 L 1310 85 Q 1350 85 1350 125 L 1350 205`. The corner runs from 40 before the turn to 40 after it, with the control point at the turn itself.
- **Fan-in** (several sources into one target): give each source its own S-curve ending at the same target point.

Start and end every edge exactly on a connection point. When a packet route chains edges, the end of one and the start of the next should either be the same point or lie on the same node (the packet passes underneath it). To make the packet travel visibly through the node, add a **hidden edge** across it, for example `{ "id": "thru", "path": "M780 200 L1080 200", "hidden": true }`, and put it in the route between the two.

### Labels

- On a horizontal edge: centered above it, `anchor: "middle"`, at the edge's middle x and 12 above the line.
- On a vertical edge: `anchor: "start"`, 14 to the right of the line.
- On a curve: on the empty side of the bend, away from node edges. Check the preview; labels are placed by hand.

### Panels

Leave about 30 units between the panel and the nodes it surrounds, plus room at the top for the title. Put the title at the panel's left edge + 26 and top + 34.

### Common layout mistakes

Check every scene in the preview. The validator cannot see overlaps, and these are the usual ones:

- **A subtitle under a circle or diamond, plus an edge from its bottom point.** The subtitle sits exactly where the edge leaves. Connect from a side, or leave the subtitle out.
- **A label on a border.** Labels placed where an edge crosses a panel's dashed outline, or within about 10 units of a node, are hard to read. Move the label along the edge to an empty stretch.
- **Text wider than its box.** Titles do not wrap; use the width rules above.
- **Two labels near one point.** Where edges fan out from one node, move the labels out to where the edges have separated.
- **Pills over titles.** A long pill on a narrow box covers the title; widen the box.
- **Cameras that cut a node in half.** Leave a margin, and remember the camera's shape: a tall camera on a wide screen shows extra map at the sides, and a wide one shows extra above and below.

### Per-lens geometry

`offsetByLens` moves a node in one lens. Edges do not move, so give the moved layout its own edges and show each set in its own lens (for example `"lenses": ["team"]` on the original edges and `"lenses": ["customer"]` on the alternates). Labels follow their edge's lenses automatically.

### Cameras

`camera` is the rectangle of the map that the scene shows. The visible map area on a laptop is about **2 : 1** (wide), so a camera with that shape fills the screen; other shapes show extra map around them. Leave 40 to 60 units of margin around what the scene is about.

On-screen text size is roughly `1440 / camera width × 16` pixels on a laptop:

| Camera width | Label text on screen |
|---|---|
| 700 | about 33 px (close-up) |
| 1000 | about 23 px |
| 1400 | about 16 px (comfortable maximum for a content step) |
| 2100 | about 11 px (the validator's warning line) |
| 3000 | about 8 px (overview only; mark the scene `"wide": true`) |

## 8. Scenes and storytelling

- **One idea per scene.** Frame only what the caption talks about, and make those elements active.
- **Open with an overview** (wide camera, everything active, one packet showing the main path) and optionally close with a full picture. Mark wide shots `"wide": true`.
- **Use packets to show direction and sequence.** Two or three routes per scene at most; stagger them with `phase` (for example 0, 2.5 and 5 seconds) and `dim` the secondary path.
- **Reveal layers gradually.** Keep a "behind the scenes" layer off in the early scenes and switch it on when the story gets there.
- **Keep keys shared across lenses** for the same stage, so switching lens mid-presentation lands on the matching step.
- **Prefer fewer distinct scenes** over zoomed-in repeats of an earlier one.
- **Write captions for listening**: one or two plain sentences, describing only what is on screen.

## 9. Sub-flows (zoom)

Any node or panel can open another journey file, which is a full journey in its own right:

```jsonc
{ "id": "bar", "kind": "container", "...": "...",
  "zoom": { "journey": "./espresso-bar.json", "label": "Espresso bar", "badge": true } }
```

- `journey` (required) is a path relative to this file. `label` names the level in the breadcrumb (default: the sub-flow's `meta.title`). `badge` shows the small "+" marker (default `true`).
- A scene with `"enter": "bar"` zooms in when the presenter presses Next. Zoomable elements can also be clicked, or focused and opened with Enter, at any time.
- Inside, the sub-flow uses its own lenses, scenes, colors and step dots. It opens in the lens with the same id as the parent's current lens, or its own default lens.
- Next on its last scene zooms out and continues the parent's tour; Back on its first scene, Escape, or the breadcrumb return to the parent.
- The sub-flow is drawn scaled inside the element, so its map can use any size. Design it like any other journey and check it on its own with `wayforge dev`.
- Sub-flows can contain zoomable elements of their own. A file cannot (directly or indirectly) open itself.

## 10. Validation messages

Every message names a path into the file, for example `scenes.team[2].routes[0].edges[1]`, and, inside a sub-flow, the file it came from: `support-queue.json (via nodes[7](queue).zoom) › scenes.team[1]...`. Errors stop the build; warnings do not (`--strict` treats them as errors).

### Errors

| Rule | Meaning | Fix |
|---|---|---|
| `load` | The file cannot be read or is not valid JSON. | Check the path; look for a missing comma or quote at the reported position. |
| `schema` | A field is missing, misspelled, unknown, or of the wrong type. | Compare with [section 5](#5-field-reference). Unknown fields are always errors, so typos never pass silently. |
| `theme`, `theme-schema` | The theme or `themeOverrides` is broken (unknown default tone, a tone pointing at a missing color, a wrong type). | Add the color to both `light` and `dark`, or fix the value. |
| `duplicate-id` | Two nodes, edges, panels, lenses, layers, labels, rows or stages share an id. | Rename one. |
| `default-lens` | More than one lens is `default`. | Keep one. |
| `unknown-node`, `unknown-edge` | A scene, route, label or group names an id that does not exist. | Fix the spelling or add the element. "via @group" means the bad id is inside that group. |
| `unknown-lens`, `unknown-layer`, `unknown-tone` | A reference to a lens, layer or tone that is not defined. | Define it, or fix the spelling. Tones come from the theme ([section 6](#6-colors-and-themes)). |
| `bad-group` | A `"@group"` that does not exist, or groups that include each other in a loop. | Define the group or break the loop. |
| `lens-without-scenes` | A lens has no scenes. | Add at least one scene for it under `scenes.<lens>`. |
| `key-not-in-stage-order` | A scene's `key` is missing from `stageOrder`. | Add the key to `stageOrder`. |
| `route-edge-not-in-lens` | A packet route uses an edge that is hidden (or parked) in that scene's lens. | Use the lens's own edge, or add the lens to the edge. |
| `bad-size` | A size, rectangle or camera has a zero or negative width or height. | Fix the numbers. |
| `bad-path` | The SVG path data cannot be read. | Every command needs its full set of numbers, for example `L x y`. |
| `rows-not-container` | `rows` or `rowStyle` on a node that is not a container. | Change the kind or remove the field. |
| `bad-metric` | A `metrics` key that does not apply to the node's kind. | See the metrics table in [section 5](#5-field-reference). |
| `effect-not-container`, `effect-no-rows`, `unknown-row` | An effect names a node that is not a container, has no rows, or has no row with that id. | Point the effect at a container; give the row an `id`. |
| `unknown-enter`, `enter-not-zoomable`, `enter-not-in-lens` | `enter` names something that does not exist, has no `zoom`, or is not visible in that lens. | Fix the id, add a `zoom`, or show the element in the lens. |
| `zoom-missing` | A sub-flow file cannot be found. | Paths are relative to the file containing the `zoom`. |
| `zoom-cycle` | Sub-flows open each other in a loop. | Remove one of the references. |
| `empty-sub-flow` | A sub-flow has no nodes. | Add nodes to it. |

### Warnings

| Rule | Meaning | Fix |
|---|---|---|
| `readability` | The camera is so wide that text would be smaller than about 11 px on a laptop. | Narrow the camera, or mark an overview `"wide": true`. |
| `active-not-visible` | An element is active in a scene but hidden in that lens, so it will not show. | Remove it from `active`, or add the lens to the element. |
| `route-gap` | A packet would jump between two edges across empty space. | Make the edges meet, or add a hidden edge between them. |
| `row-overflow` | A container's rows do not fit its height. | Height ≥ 80 + 40 × rows. |
| `container-subtitle` | Containers do not show subtitles. | Remove it or use a box. |
| `tone-without-soft` | Row effects or tinted rows on a tone with no soft color. | Use `violet` or `lime`, or add a `soft` color to the tone. |
| `label-on-hidden-edge` | A label on an edge that draws nothing. | Attach it to a visible edge. |
| `enter-off-camera` | The element a scene zooms into is not fully inside that scene's camera. | Widen or move the camera. |
| `zoom-unreachable` | A zoomable element is parked in every lens, so its sub-flow can never open. | Show the element in a lens, or remove the zoom. |

## 11. Presenting and sharing

The built page is one HTML file with everything inside it. Email it, put it on any web host, or open it from disk. The only thing it fetches is the Google Fonts stylesheet; without a connection it falls back to system fonts.

| Key | Action |
|---|---|
| → , Space, Page Down | Next step (zooms into a sub-flow when the scene has `enter`) |
| ← , Page Up | Previous step |
| Home, End | First, last step of the current flow |
| 1 to 9 | Switch lens, staying at the same point in the story |
| Enter | Open a focused zoomable element |
| Escape | Leave the current sub-flow |
| F | Full screen |

On touch screens, swipe left or right to step. The page follows the viewer's light or dark setting and respects reduced motion (no camera glide, static packets).

## 12. A complete example

A small journey that exercises most features: two lenses, a layer, a panel, every node kind, a pill, a dashed edge, a hidden pass-through edge, labels, packets with phase and dim, a row effect, groups, and a parked element. Save it as `journeys/coffee.json` and run `npx wayforge dev journeys/coffee.json`.

```json
{
  "$schema": "../schema/journey.schema.json",
  "version": 1,
  "meta": {
    "title": "Ordering a coffee",
    "brand": "Coffee bar",
    "description": "A guest orders at the counter and pays; a declined payment means trying again. Paid orders go to the bar, which grinds, pulls the shot and steams the milk, and the drink is called out at pickup."
  },
  "lenses": [
    { "id": "guest", "label": "Guest" },
    { "id": "barista", "label": "Barista", "default": true }
  ],
  "layers": [{ "id": "back", "tone": "violet", "ghost": 0.4 }],
  "stageOrder": ["overview", "order", "pay", "make", "pickup"],
  "groups": {
    "front": ["guest", "order", "paid"],
    "everything": ["@front", "bar", "pickup", "retry"]
  },
  "panels": [
    {
      "id": "counter", "rect": [750, 70, 360, 280], "tone": "violet", "layer": "back", "lenses": ["barista"],
      "title": { "text": "Behind the counter", "at": [776, 104] }
    }
  ],
  "nodes": [
    { "id": "guest", "kind": "circle", "at": [40, 150], "size": [100, 100], "title": "Guest", "subtitle": "wants a coffee" },
    {
      "id": "order", "kind": "box", "at": [220, 155], "size": [220, 90], "title": "Order", "subtitle": "at the counter",
      "pills": [{ "text": "POS", "tone": "blue", "hideIn": ["guest"] }]
    },
    { "id": "paid", "kind": "diamond", "at": [520, 110], "size": [180, 180], "title": "Paid?" },
    {
      "id": "bar", "kind": "container", "at": [780, 120], "size": [300, 200], "title": "Bar", "layer": "back",
      "rows": ["Grind", "Pull the shot", "Steam the milk"]
    },
    { "id": "pickup", "kind": "box", "at": [1160, 155], "size": [220, 90], "title": "Pickup", "subtitle": "name is called" },
    { "id": "retry", "kind": "box", "at": [520, 360], "size": [180, 70], "title": "Try again", "tone": "pink" },
    {
      "id": "loyalty", "kind": "box", "at": [220, 360], "size": [220, 70], "title": "Loyalty card", "lenses": [],
      "notes": "Parked until we know whether the loyalty scheme continues."
    }
  ],
  "edges": [
    { "id": "e1", "path": "M140 200 L220 200" },
    { "id": "e2", "path": "M440 200 L520 200" },
    { "id": "e3", "path": "M700 200 L780 200" },
    { "id": "thru", "path": "M780 200 L1080 200", "hidden": true },
    { "id": "e4", "path": "M1080 200 L1160 200" },
    { "id": "e5", "path": "M610 290 L610 360", "tone": "pink", "dashed": true }
  ],
  "labels": [
    { "edge": "e3", "at": [725, 188], "anchor": "middle", "text": "paid" },
    { "edge": "e5", "at": [624, 330], "text": "declined" }
  ],
  "scenes": {
    "guest": [
      {
        "key": "order", "label": "Order", "title": "You order at the counter",
        "caption": "You walk up, choose a drink and place your order.",
        "camera": [0, 90, 740, 340],
        "active": { "nodes": ["@front"], "edges": ["e1", "e2"] },
        "routes": [{ "edges": ["e1", "e2"] }]
      },
      {
        "key": "pay", "label": "Pay", "title": "You pay",
        "caption": "Most payments go straight through. A declined card means trying again.",
        "camera": [400, 80, 620, 400],
        "active": { "nodes": ["paid", "retry"], "edges": ["e3", "e5"] },
        "routes": [{ "edges": ["e3"] }, { "edges": ["e5"], "phase": 1.5, "dim": true }]
      },
      {
        "key": "pickup", "label": "Pickup", "title": "Your name is called",
        "caption": "A few minutes later the drink is ready at the pickup point.",
        "camera": [740, 60, 700, 340],
        "active": { "nodes": ["bar", "pickup"], "edges": ["e4"] },
        "routes": [{ "edges": ["thru", "e4"] }]
      }
    ],
    "barista": [
      {
        "key": "overview", "label": "Overview", "title": "A coffee, from order to pickup",
        "caption": "Orders are taken and paid at the counter, made at the bar, and called out at pickup.",
        "camera": [0, 40, 1420, 440], "layers": ["back"],
        "active": { "nodes": ["@everything"], "edges": ["e1", "e2", "e3", "e4", "e5"] },
        "routes": [{ "edges": ["e1", "e2", "e3", "thru", "e4"] }]
      },
      {
        "key": "order", "label": "Order", "title": "Every order starts at the till",
        "caption": "The order is rung up on the till and paid for before anything is made.",
        "camera": [0, 90, 740, 340],
        "active": { "nodes": ["@front"], "edges": ["e1", "e2"] },
        "routes": [{ "edges": ["e1", "e2"] }]
      },
      {
        "key": "make", "label": "Make", "title": "The bar makes the drink",
        "caption": "Each drink is ground, pulled and steamed to order.",
        "camera": [700, 40, 720, 340], "layers": ["back"],
        "active": { "nodes": ["paid", "bar", "pickup"], "edges": ["e3", "e4"] },
        "routes": [{ "edges": ["e3", "thru", "e4"] }],
        "effects": [{ "type": "cycleRows", "node": "bar" }]
      }
    ]
  }
}
```
