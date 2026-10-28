# Mehzur: what is left

The app is built: house photo measurement for a small group of invited people, with projects, rooms, areas, CSV/PDF export, home-screen install, error handling and Docker deployment. How it works is in the [README](README.md) and [docs/](docs/); decisions are in [docs/decisions.md](docs/decisions.md).

## Done recently
- Code review (`docs/code-review.md`): all tasks done except the ones listed there as left on purpose. Security headers and a CSP, upload checks, transactions for account changes, accessibility (keyboard handles for end points, live regions, focus), shared `FormError` and `PasswordPair`, and a naming rule for components (`docs/contributing.md`).
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
- [ ] **Add a photo to the same room, from the photo page.** A shortcut on the photo page (for example in its menu or beside Previous and Next) that opens the photo picker or camera and uploads into the current photo's room (or "No room"), then lands on the new photo. Reuse the upload queue (`UploadQueue` in `src/lib/client/uploads.svelte.ts`) and the file input behind `AddTile` in `file` mode. Open question: the queue belongs to the project page (D53), so decide whether the photo page gets its own queue or the upload hands off to the project page.
- [ ] **One tap starts a new measurement, even when one is selected.** Today the first tap on empty photo only deselects the selected measurement and a second tap places the first point (`deselect` in `tests/e2e/helpers.ts` exists for this). Change it so that the tap deselects and places the first point at once. Tapping a line or a handle must still select or drag it. Update the e2e helpers and specs that tap twice, the phone checklist, and the note in the canvas code.
- [ ] **Pinch to zoom the photo inside its frame, without zooming the page.** The photo zooms and pans within the canvas; the rest of the page does not scale. This reverses the "zoom and pan" entry under "Dropped on purpose" in `docs/decisions.md`, so update that entry. Points and handles are stored as fractions of the image (D6), so saved data is unaffected, but hit-testing, handle size and label size must account for the zoom. Dragging a handle must keep working (touch-action) and one-finger scrolling must still move the page when not zoomed. Add keyboard and button controls (zoom in, out, reset) for people who cannot pinch, and test on a real phone (`docs/phone-test-checklist.md`).
- [ ] **Upload progress as an overlay.** The upload list under **Rooms** is out of sight when the page is scrolled. Show the progress in a fixed overlay (for example a compact bar at the bottom of the screen, similar to the notifications) that stays visible while uploading, shows per-file failures with Retry, and does not cover the Add and menu buttons. Keep the live region and accessible names the e2e tests use (`UploadList.svelte`), and keep it clear of the notifications.
- [ ] **Consider a "floor" grouping for rooms.** A floor (for example "Ground floor", "Upstairs") holds rooms; the project page shows one collapsible section per floor with a per-floor total area, and "No floor" for the rest. To decide first: floors as a new table with a position, or a plain text label on each room; whether rooms are listed by floor in the exports (CSV and PDF) and in the room filter and "Change room" list; how the floor total is worked out when a room has no area; and how floors are added, renamed, deleted and reordered (rooms are in creation order today, a product decision). Needs a schema change and migration, new unit and e2e tests, and updates to `docs/decisions.md`.

## Not planned
- Cloudflare deployment (Workers, D1, R2). Docker is the only supported target (D46, D47).

## Future ideas (not scheduled)
- Migrate email provider: move outgoing email from Proton SMTP to another provider (only the `SMTP_*` and `MAIL_FROM` settings should need to change; check the TLS rules in `src/lib/server/email.ts` and `docs/deployment.md`)
- Drop the leftover `await`s on database calls and wrap the remaining multi-step writes in transactions, now that only better-sqlite3 is supported (E5 in `docs/code-review.md`)
- Rearrange rooms: let the user change the order of rooms on the project page (for example drag to reorder, or move up/down in the room menu). Rooms are shown in creation order everywhere today (a product decision in `docs/decisions.md`); this would need a stored position per room (a schema change and migration) and the same order used in the room filter and the photo page's "Change room" list
