# Writing a Wayforge journey: brief for an LLM

You are turning a plain-language description of a process, journey or system into a Wayforge journey file: one JSON document that Wayforge builds into an animated, single-page presentation. This brief is self-contained. For full details, the authoritative sources are `schema/journey.schema.json` (every field, with descriptions) and [authoring.md](authoring.md) (the human guide).

## Your output

1. **One JSON file** that validates against `schema/journey.schema.json`, with no errors and ideally no warnings. Save it in `journeys/local/<name>.json` (ignored by git) with `"$schema": "../../schema/journey.schema.json"` as its first field.
2. **A short list of open questions and assumptions**, outside the JSON: anything you were not told and therefore left out, simplified or marked as a placeholder.

If you can run commands, validate with `npx wayforge validate <file>` and fix everything it reports before you finish. Every message names the exact path, for example `scenes.team[2].routes[0].edges[1]: unknown edge "qa"`.

## Hard rules

1. **Never invent facts.** Use only systems, steps, names and connections the author stated. If something is unknown, leave it out, or use a neutral title and add `"notes": "Placeholder: confirm with the author."`. List it in your open questions.
2. **No unknown fields.** The schema rejects any field it does not define. Do not add fields such as `color`, `description` on nodes, `arrow` or `type` on edges.
3. **Every reference must resolve.** Ids in scenes, routes, labels, groups and effects must exist. Every scene `key` must appear in `stageOrder`. Every lens needs at least one scene.
4. **A route may only use edges visible in its scene's lens.**
5. **Captions describe only what is on screen** in that scene, in one or two plain sentences.
6. **Park, don't delete.** If the author says to hide something "for now", keep it with `"lenses": []`.
7. **Keep it generic in tone.** Titles are short nouns ("Help center", "Triage"); subtitles are short lower-case phrases ("contact form").

## Procedure

Work in this order. Planning first makes the coordinates easy.

### 1. Story, stages, lenses

- Write the story in one sentence.
- List 3 to 8 **stages** in order as short ids: this is `stageOrder`. Add `overview` first if there will be an overview scene.
- Choose **lenses** (views): one per audience or perspective, typically 1 to 3 (for example `customer` and `team`). Mark one `"default": true`.
- Decide on **layers** only if part of the map should stay faint until later (for example a back-office layer): `{ "id": "back", "tone": "violet", "ghost": 0.4 }`.

### 2. Elements

List nodes and connections. For each node, pick a kind:

| Kind | Use for |
|---|---|
| `box` | A system, screen, team or step. Title plus optional subtitle. |
| `circle` | A person or a starting event ("Guest", "Click"). One short word. |
| `diamond` | A decision ("Paid?", "Urgent?"). |
| `container` | A system or step with an internal list (`rows`), for example a set of checks. |

Use `pills` (`{ "text": "POS", "tone": "blue" }`) to name the platform or owner of a node. Use `hideIn` on a pill to keep system names out of a customer-facing lens.

### 3. Grid layout

Place nodes on a grid. All coordinates are map units; `at` is the **top-left corner of the bounding box** for every kind; `size` is `[width, height]`.

- Main lane centered at y = 200. Further lanes at y = 400, 600... (or above, at y = 0).
- Columns about 300 to 400 apart. Leave 80 to 140 units between nodes horizontally.
- Center every node in a lane on the lane's y: `at[1] = laneY - height / 2`.

Size each node to its text (text never wraps):

| Kind | Size |
|---|---|
| box | width = max(160, 44 + max(title chars × 11, subtitle chars × 8.5)), rounded up to a multiple of 10; height 90 with a subtitle, 70 without |
| circle | `[100, 100]` for one short word; subtitle (optional) shows below it |
| diamond | `[180, 180]` for up to about 10 title characters; a subtitle shows below it |
| container | height = 80 + 40 × rows; width = max(260, 84 + longest row chars × 9) |

Do not connect an edge to the bottom point of a circle or diamond that has a subtitle: the subtitle sits there.

### 4. Edges

Connect at the middle of a side of the bounding box. For a node at `[x, y]` with size `[w, h]`: left `(x, y+h/2)`, right `(x+w, y+h/2)`, top `(x+w/2, y)`, bottom `(x+w/2, y+h)`.

Paths are SVG path strings with absolute commands:

- Same lane: `"M{x1} {y} L{x2} {y}"`.
- Between lanes, S-curve with `m = (x1 + x2) / 2`: `"M{x1} {y1} C{m} {y1} {m} {y2} {x2} {y2}"`.
- Right angle with a rounded corner (radius 40): `"M1100 85 L1310 85 Q1350 85 1350 125 L1350 205"`.

Optional: `"dashed": true` for a less common or conditional path; `"tone": "pink"` for an exception path.

**Packets pass through nodes.** When a route goes into a node and out the other side, add a hidden edge across the node and include it in the route: `{ "id": "bar_thru", "path": "M780 200 L1080 200", "hidden": true }`.

### 5. Labels

Use a label for an edge whose meaning is not obvious ("paid", "declined", "routine"):

- Horizontal edge: `{ "edge": "e3", "at": [midX, lineY - 12], "anchor": "middle", "text": "paid" }`.
- Vertical edge: `{ "edge": "e5", "at": [lineX + 14, midY], "text": "declined" }`.
- Keep labels away from node edges and panel borders.

### 6. Lens differences

- An element shown only in some lenses gets `"lenses": ["team"]`. Leaving `lenses` out means every lens.
- To move a node in one lens: `"offsetByLens": { "customer": [0, -125] }`. Edges do not move, so create alternate edges for that lens (`"lenses": ["customer"]`) and give the originals the other lens.

### 7. Scenes

For each lens, write an ordered list of scenes. Each scene:

```jsonc
{ "key": "make", "label": "Make", "title": "The bar makes the drink",
  "caption": "Each drink is ground, pulled and steamed to order.",
  "camera": [700, 40, 720, 340],
  "layers": ["back"],
  "active": { "nodes": ["paid", "bar", "pickup"], "edges": ["e3", "e4"] },
  "routes": [{ "edges": ["e3", "bar_thru", "e4"] }],
  "effects": [{ "type": "cycleRows", "node": "bar" }] }
```

- `key` is a stage id. Use the **same key for the same stage in every lens**, so switching lens keeps the viewer's place.
- `camera` is `[x, y, width, height]` around the active elements, plus 40 to 60 units of margin, with a shape of about 2 : 1. Content scenes keep `width` at 1400 or less. An overview may be wider: add `"wide": true`.
- `active` lists what lights up. Groups help: define `"groups": { "front": ["a", "b"] }` and write `"@front"`.
- `routes`: 1 to 3 packets. Stagger extra packets with `"phase": 2.5` (seconds) and mark secondary paths `"dim": true`.
- `layers`: the layers switched on in this scene.
- `effects` (containers only): `cycleRows` steps a highlight through the rows; `highlightRow` (with a row `{ "id": ..., "text": ... }`) marks one row. Use a tone with a soft color on that container (`violet` or `lime`).

A good shape for each lens: an overview scene (everything active, one packet along the main path), then one scene per stage.

### 8. Colors

Default tones: `blue` (default), `violet`, `pink`, `teal`, `lime`. A node or edge takes its layer's tone unless it sets `tone`. Use color sparingly: a layer tone for the back-office part, `pink` for exceptions. Do not add `themeOverrides` unless asked.

### 9. Sub-flows (only if asked for drill-down)

A node can open another journey file: `"zoom": { "journey": "./details.json" }`. That file is a complete journey of its own. A scene with `"enter": "<node id>"` zooms into it when the presenter presses Next. The sub-flow opens in the lens with the same id as the parent's current lens, if it has one.

## Skeleton

A minimal valid journey to start from. Replace the content, keep the structure.

```json
{
  "$schema": "../../schema/journey.schema.json",
  "version": 1,
  "meta": { "title": "Story title", "description": "One or two sentences describing the whole map for screen readers." },
  "lenses": [{ "id": "main", "label": "Overview", "default": true }],
  "stageOrder": ["start", "decide", "finish"],
  "nodes": [
    { "id": "a", "kind": "circle", "at": [40, 150], "size": [100, 100], "title": "Start" },
    { "id": "b", "kind": "diamond", "at": [220, 110], "size": [180, 180], "title": "Ready?" },
    { "id": "c", "kind": "box", "at": [480, 155], "size": [220, 90], "title": "Finish", "subtitle": "all done" }
  ],
  "edges": [
    { "id": "ab", "path": "M140 200 L220 200" },
    { "id": "bc", "path": "M400 200 L480 200" }
  ],
  "labels": [{ "edge": "bc", "at": [440, 188], "anchor": "middle", "text": "yes" }],
  "scenes": {
    "main": [
      {
        "key": "start", "label": "Start", "title": "It starts here",
        "caption": "Something begins and moves to a decision.",
        "camera": [0, 60, 460, 280],
        "active": { "nodes": ["a", "b"], "edges": ["ab"] },
        "routes": [{ "edges": ["ab"] }]
      },
      {
        "key": "decide", "label": "Decide", "title": "A decision",
        "caption": "When it is ready, it moves on to the finish.",
        "camera": [180, 60, 560, 280],
        "active": { "nodes": ["b", "c"], "edges": ["bc"] },
        "routes": [{ "edges": ["bc"] }]
      },
      {
        "key": "finish", "label": "Finish", "title": "The whole path",
        "caption": "From the start, through the decision, to the finish.",
        "camera": [0, 40, 740, 320],
        "active": { "nodes": ["a", "b", "c"], "edges": ["ab", "bc"] },
        "routes": [{ "edges": ["ab", "bc"] }]
      }
    ]
  }
}
```

## Fixing validation messages

| Message rule | Usual fix |
|---|---|
| `schema` ... unknown field | Remove or rename the field; check spelling against the schema. |
| `schema` ... missing required field | Add it (nodes need `id`, `kind`, `at`, `size`, `title`; scenes need `key`, `label`, `title`, `caption`, `camera`, `active`). |
| `unknown-node`, `unknown-edge` | Fix the id or add the element. |
| `key-not-in-stage-order` | Add the key to `stageOrder`. |
| `lens-without-scenes` | Add scenes for that lens. |
| `route-edge-not-in-lens` | Use an edge visible in that lens, or add the lens to the edge. |
| `unknown-tone` | Use `blue`, `violet`, `pink`, `teal` or `lime`. |
| `bad-path` | Every command needs all its numbers: `M x y`, `L x y`, `C x1 y1 x2 y2 x y`, `Q cx cy x y`. |
| `row-overflow` (warning) | Container height = 80 + 40 × rows. |
| `route-gap` (warning) | Make consecutive route edges meet, or join them through a node or a hidden edge. |
| `readability` (warning) | Narrow the camera to 1400 or less, or mark an overview `"wide": true`. |
| `tone-without-soft` (warning) | Give the container `"tone": "violet"` or `"lime"`. |

The complete list is in [authoring.md, section 10](authoring.md#10-validation-messages).

## Final checklist

- [ ] The JSON parses and has `"version": 1`.
- [ ] `npx wayforge validate` reports no errors (and ideally no warnings).
- [ ] Every stage in `stageOrder` is used by at least one scene; keys are shared across lenses for the same stage.
- [ ] Every node's text fits its size; no edge leaves the bottom of a circle or diamond that has a subtitle.
- [ ] Edges start and end on connection points; routes that pass through a node use a hidden edge.
- [ ] Cameras keep a margin around their content and are roughly 2 : 1; only overview scenes are wider than 1400.
- [ ] Every caption describes only what its scene shows.
- [ ] Nothing was invented; placeholders have `notes`; open questions are listed outside the JSON.
