# Working on the code

## Environment

- Node 24 via `mise` (`mise exec -- npm ...`, or activate mise in your shell). npm, not pnpm or yarn.
- SvelteKit **3** and Svelte **5** (runes: `$state`, `$derived`, `$props`, `$effect`). This differs from most examples online:
  - Library imports use `#lib/...` **with the `.ts` extension** (for example `import { formatLength } from '#lib/units.ts'`). `$lib` does not exist.
  - Server secrets come from `$app/env/private` (declared in `src/env.ts`), not `$env/*`.
  - Hook types come from `@sveltejs/kit/hooks`.
  - Form actions return JSON unless the request sends `Accept: text/html`.
  - Imports in `src/lib/server/db/schema.ts` must be relative, because drizzle-kit uses its own loader.
- Never touch `./data` (the developer's own dev database). The browser tests use a throwaway `.e2e-data`.

## Before you finish a change

```sh
npm run check          # Svelte/TypeScript: 0 errors and 0 warnings
npm test               # unit and route tests (Vitest)
npm run check:e2e      # type-check the browser tests
npm run test:e2e       # browser tests, Chromium (builds first; about 3 to 4 minutes)
```

Also: `npm run test:e2e:safari` after UI or style changes; `npm run db:generate` after a schema change (and commit the new migration in `drizzle/`).

## Pitfalls

- **Stray servers:** stop anything on port 4180 before browser tests (`lsof -tiTCP:4180 -sTCP:LISTEN | xargs kill`). Two servers on one port cause confusing failures.
- **Accessible names are a contract:** the browser tests find things by role and name (`getByRole`, `getByLabel`; see `tests/e2e/helpers.ts`). Renaming a button, field or dialog means updating the tests in the same change. A few helpers still use CSS classes (`.annotation`, `.handle`, `.canvas`, `.room`, `.grid li`, ...); keep them or update the helpers.
- **Hydration:** the app sets `data-hydrated` on `<html>` once its scripts run, and the test helpers wait for it; a click before then is lost.
- **Timestamps:** `created_at` has whole-second resolution. Ties in ordering are broken by `rowid` (`photoOrder`, `roomOrder`, `annotationOrder` in `src/lib/server/photos.ts`).
- **Database calls:** better-sqlite3 is synchronous, but server code still `await`s every call through the shared `Db` type (a leftover from when D1 was supported). Transactions are available (`db.transaction((tx) => ...)`, synchronous inside: use `.get()`, `.all()`, `.run()`). Account creation, invites and email changes use one; most other multi-step writes are not wrapped yet. Hash a password before the transaction starts, never inside it.
- **Shared pieces:** shared UI is in `src/lib/components/ui/`, shared styles and design tokens in `src/app.css`, failure messages in one table in `src/lib/client/errors.ts`. Prefer these over new one-off versions.

## Naming components

Name a component for what it is, so a file list reads like the screen.

| Kind | Name | Examples |
| --- | --- | --- |
| Dialog | `<Thing><Action>Dialog` | `ProjectAddDialog`, `ProjectEditDialog`, `ProjectShareDialog`, `RoomAddDialog`, `RoomRenameDialog`, `PhotoChangeRoomDialog` |
| Dialog doing several actions, chosen by a `mode` prop | `<Thing>Dialog` | `MeasurementDialog` (create and edit) |
| Form shared by several dialogs or pages | `<Thing><Part>Form` | `ProjectForm`, `RoomNameForm`, `RoomAreaForm` |
| Menu | `<Thing>Menu` | `ProjectMenu`, `RoomMenu` |
| Shared building block | what it is, in `components/ui/` | `Dialog`, `Modal`, `PopupMenu`, `AddTile`, `FormError`, `PasswordPair` |

- The thing comes first, then the action (a verb), so related files sort together. Do not start a name with the verb (`AddProject`), and do not call something a dialog unless it is one.
- A dialog holds no trigger. The page or menu that opens it renders the button (for example an `AddTile`) and passes `bind:open`. The flag is named for the action in the gerund: `adding`, `editing`, `sharing`, `renaming`, `changingRoom`.
- `open` is always `$bindable(false)`. A dialog that posts its own form (`ProjectAddDialog`, `RoomRenameDialog`) closes itself on success; one that the parent saves for (`MeasurementDialog`, `PhotoChangeRoomDialog`) takes `onsave`, `busy` and `error`.
- The dialog's title is the action and thing in plain words ("Add a project", "Rename room"), and its accessible name is a contract with the browser tests.

AI coding agents: see also [AGENTS.md](../AGENTS.md).

Decisions and known limitations are in [decisions.md](decisions.md); the code layout is in [architecture.md](architecture.md).
