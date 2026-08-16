# @arhen/pi-core-ask

[![npm version](https://img.shields.io/npm/v/@arhen%2Fpi-core-ask?color=cb3837&logo=npm)](https://www.npmjs.com/package/@arhen/pi-core-ask)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![pi extension](https://img.shields.io/badge/pi-extension-7c3aed)](https://github.com/earendil-works/pi)

Minimalist pi questionnaire: `ask_user_question` tool with up to 4 structured questions per call — 2–4 options each, `multiSelect`, markdown `previews`, and an auto-appended "Type something." free-text row. Stateless: one tool, one dialog, no lifecycle machinery.

## Install

```sh
pi install npm:@arhen/pi-core-ask
```

> Registers the `ask_user_question` tool. Only one extension may register it per session.

## Tool contract (unchanged from rpiv)

- `questions` (1–4): `question`, `header` (≤16 chars), `options` (2–4 of `label` ≤60 chars / `description` / optional `preview`), `multiSelect` (default false)
- Reserved labels rejected: `Other`, `Type something.`, `Next` — the runtime appends its own free-text row
- Validation: duplicate questions/labels, too few options, too many questions — all rejected with the same error strings
- Envelope: `User has answered your questions: "Q"="A". selected preview: …` / `User declined to answer questions` on Esc

## UI

Boxed dialog, one question at a time: progress dots, header chip, option list (pi-tui SelectList), preview pane for focused options, "Type something." → inline input, `Enter` next / `Ctrl+S` done (multiSelect) / `Esc` cancel.

![ask_user_question example](assets/ask-example.png)

```
Questions (1/3)           ● ○ ○          [Workspace]
Where to run ask frnd-chat-improvements? Active feature analyze-vision-billing exists…

→ Continue in main workspace (Re…
  Parallel ej workspace
  Type something.
─────────────────────────────────────────────
Enter next ↵ select → Type something. = custom ⇫ Esc cancel
```

## What's cut (vs rpiv, 4,823 lines → ~900)

- RPC fallback (VSCode/Zed hosts), external editor, notes field
- i18n/locales, config + guidance validation
- Tab components, preview layout decider, markdown cache, key-router state machine
- Lifecycle events (stateless by design — no session wiring needed)

## Development

```sh
bun install
npx tsc --noEmit
bun test   # pure-logic: validation guards + response envelope
```

## License

MIT.
