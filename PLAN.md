# Mehzur: what is left

The app is built: house photo measurement for a small group of invited people, with projects, rooms, areas, CSV/PDF export, home-screen install, error handling and Docker deployment. How it works is in the [README](README.md) and [docs/](docs/); decisions are in [docs/decisions.md](docs/decisions.md).

## Done recently
- "Add photo" on the photo page uploads into the current photo's room and opens the new photo (its own upload queue, shared with the project page through `createPageUploads`). Still to do: the real-phone check in `docs/phone-test-checklist.md`.
- Measurement labels are drawn above every line (and the selected line's handles above the labels), so a later line never covers an earlier label.
- Zoom and pan inside the photo (1× to 8×): buttons, `+`/`-`/`0`, pinch, Ctrl/trackpad wheel and one-finger pan when zoomed (D54, `docs/zoom-plan.md`). Still to do: the real-phone checks in `docs/phone-test-checklist.md`.
- Code review (`docs/code-review.md`): all tasks done except the ones listed there as left on purpose. Security headers and a CSP, upload checks, transactions for account changes, accessibility (keyboard handles for end points, live regions, focus), shared `FormError` and `PasswordPair`, and a naming rule for components (`docs/contributing.md`).
- Upload progress is an overlay fixed to the bottom of the window.
- With a measurement selected, the first tap on empty photo now starts a new measurement (Esc deselects).
- Default names for unnamed measurements, like "Living Room 1-A" (rule in `docs/decisions.md`).
- Multi-user: accounts, invites, private projects, project sharing, passkeys, changing your email address, password reset by email, administrator page, sign-in limits. Record: `docs/multi-user-plan.md`.
- Deployed with Dokploy from the GitHub Container Registry image `ghcr.io/christopher-b/mehzur` (linux/amd64); the GitHub Actions workflow builds and publishes it, and runs the type checks.
- Cloudflare support removed (D47). The `Db` type is synchronous only; existing code still `await`s database calls (see Future ideas).

## Left to do
- [ ] Run the new real-phone checks in `docs/phone-test-checklist.md`: the Add project and Add room dialogs with the iOS keyboard, the CSP in real iOS Safari, keyboard handles, default measurement names and leaving during an upload.
- [ ] Try the email-change link through Proton SMTP (Account > Email address); password reset, passkeys and migration 0003 are confirmed in production
- [ ] Owner decisions: run the browser tests in CI (needs Playwright's browsers, about 4 minutes); add ESLint and Prettier; confirm that the account and admin name forms keep what was typed after saving (`reset: false`, B9 in `docs/code-review.md`); whether clearing a measurement's name should give it a new default name (it does today).
- [ ] Decide whether measurements saved before default names existed (they show as "Measurement x") should get a stored name in a migration.

### Requested features
- [ ] **Choose the two area measurements from the measurements themselves.** Today a room's area is set only from the room menu, with two dropdowns (`RoomAreaForm.svelte`, action `setRoomArea`). Add "Use as length" and "Use as width" for a measurement, in its row on the photo page's list, in the project page's measurement table and in the measurement's edit dialog, so you can pick one while looking at the line. Mark the measurements in use with a "Length" or "Width" tag. Things to settle when building: `setRoomArea` (`src/lib/server/rooms.ts`) refuses one measurement without the other (`need-two`) and the two columns are stored together, so either allow a half-chosen pair (the room card then says which one is missing and shows no area) or keep the choice in the browser until both are set; choosing the same measurement for both slots, or one from another room, keeps the existing errors; moving a photo to another room already clears the choice (`photos.ts`), and deleting a measurement already clears it; whether the room menu's dropdowns stay (they are the way to clear or swap, and keep the accessible names the e2e tests use). Update `docs/endpoints.md` if an action is added, add unit tests for the server rule and e2e tests that pick each slot from the photo page, and add a line to the phone checklist.
- [ ] **Consider a "floor" grouping for rooms.** A floor (for example "Ground floor", "Upstairs") holds rooms; the project page shows one collapsible section per floor with a per-floor total area, and "No floor" for the rest. To decide first: floors as a new table with a position, or a plain text label on each room; whether rooms are listed by floor in the exports (CSV and PDF) and in the room filter and "Change room" list; how the floor total is worked out when a room has no area; and how floors are added, renamed, deleted and reordered (rooms are in creation order today, a product decision). Needs a schema change and migration, new unit and e2e tests, and updates to `docs/decisions.md`.

## Not planned
- Cloudflare deployment (Workers, D1, R2). Docker is the only supported target (D46, D47).

## Future ideas (not scheduled)
- Migrate email provider: move outgoing email from Proton SMTP to another provider (only the `SMTP_*` and `MAIL_FROM` settings should need to change; check the TLS rules in `src/lib/server/email.ts` and `docs/deployment.md`)
- Drop the leftover `await`s on database calls and wrap the remaining multi-step writes in transactions, now that only better-sqlite3 is supported (E5 in `docs/code-review.md`)
- Rearrange rooms: let the user change the order of rooms on the project page (for example drag to reorder, or move up/down in the room menu). Rooms are shown in creation order everywhere today (a product decision in `docs/decisions.md`); this would need a stored position per room (a schema change and migration) and the same order used in the room filter and the photo page's "Change room" list
