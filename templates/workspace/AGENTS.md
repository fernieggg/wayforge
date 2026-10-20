# Wayforge workspace

This folder holds Wayforge journeys. A journey is one JSON file that the `wayforge` command builds into a single self-contained HTML presentation: a camera glides across a map of boxes and connections, packets travel along the connections, and each step has a caption.

## Before you write or edit a journey

Read `.wayforge/docs/llm-authoring.md` first. It is the complete brief: the rules, a step-by-step procedure, layout numbers and a skeleton. Use these for details:

- `.wayforge/schema/journey.schema.json`: every field, with descriptions. Unknown fields are rejected.
- `.wayforge/docs/authoring.md`: the full human guide, including what every validation message means.
- `.wayforge/examples/`: complete, valid journeys to learn from.

## Folder map

| Path | What it is |
|---|---|
| `*.json` (here) | The author's journeys. Start each with `"$schema": "./.wayforge/schema/journey.schema.json"`. |
| `.wayforge/` | Copies of the guides, schema and examples from the installed Wayforge. Do not edit; `wayforge init` replaces them. |
| `dist/` | Built presentations (`wayforge build`). |

## Commands

```bash
wayforge validate story.json     # errors and warnings, each with its exact path
wayforge dev story.json          # live preview at http://localhost:5173, reloads on save
wayforge build story.json        # writes dist/story.html
wayforge docs llm                # prints the brief from the installed version
```

## Rules

- Never invent facts. Use only the systems, steps, names and connections the author gave you. Leave out what is unknown, or use a neutral title with `"notes": "Placeholder: confirm with the author."`, and list your open questions.
- Run `wayforge validate` and fix everything it reports before you finish.
- If `.wayforge/VERSION` is older than `wayforge --version`, run `wayforge init` to refresh the guides. It never overwrites journeys or this file.
