# How the app works

For a map of the server addresses see [endpoints.md](endpoints.md).

## Project layout

```
src/app.css                 Design tokens (colours, radii, shadows) and global styles
src/hooks.server.ts         Finds the signed-in user from the session cookie, refuses signed-out requests; logs unexpected errors with an id
src/hooks.client.ts         Tags lost connections; ids for unexpected browser errors
src/lib/units.ts            Parse and format measurements (12' 6", 3.2m), areas, unit labels
src/lib/measurements.ts     How a measurement is named and labelled
src/lib/zoom.ts             The photo's zoom and pan: a view in image fractions, clamping, zoom around a point
src/lib/rooms.ts            Room area calculation
src/lib/image.ts            Browser-side photo resizing
src/lib/constants.ts        Limits shared by the forms and the server (name length, password length)
src/lib/types.ts            Types shared by browser and server code (a project's guests)
src/lib/safeNext.ts         Accepts only in-app addresses for the sign-in redirect
src/lib/client/             Browser helpers:
                              enhance.ts (submitWith, inlineErrors) and actions.ts (postAction): how forms and scripted
                              requests are sent; errors.ts: classifies failures and holds the message table; session.svelte.ts:
                              the "Signed out" prompt; notify.svelte.ts: notifications; online.svelte.ts: online state;
                              drafts.ts: text kept across sign-in; collapsed.svelte.ts: remembered collapsed cards;
                              passkeys.ts: WebAuthn calls; upload.ts, upload-state.ts and uploads.svelte.ts: preparing and
                              sending photos, and the queue with per-file state; page-uploads.svelte.ts: a queue for a
                              page (project page, photo page) that opens the first new photo and asks before leaving mid-upload
src/lib/components/         AnnotationCanvas.svelte (draws and edits lines on a photo); ProjectMenu (the project menu button, on the
                            project page and the project list) with its ProjectEditDialog and ProjectShareDialog; ProjectForm
src/lib/components/ui/      Shared building blocks: Dialog, Modal, PopupMenu, AddTile, FormError, PasswordPair, HamburgerIcon, Notifications, SessionExpired
src/lib/server/db/          Drizzle schema and the SQLite client
src/lib/server/storage/     Photo storage on the filesystem
src/lib/server/thumbnails.ts  Makes the 400px JPEG thumbnail (sharp) that the photo grid shows; the upload endpoint stores it under `<photo key>.thumb.jpg` and records `photo.thumb_key` (null for photos from before thumbnails: the grid then shows the full image)
src/lib/server/             Database and storage setup (platform.ts), then by subject:
                              forms.ts and messages.ts (form parsing and validation texts), projects.ts (access: getProjectOr404,
                              roles), rooms.ts (room rules and areas), photos.ts (photo order and rules), annotations.ts (measurement
                              fields and default names), sharing.ts (guests), export.ts and pdf.ts (CSV and PDF export);
                              accounts: password.ts (hashing), auth.ts (token hashing, cookie), sessions.ts, users.ts (accounts,
                              sign-in limits, deleting a user), invites.ts (invite and reset links), emailChange.ts, passkeys.ts,
                              signin.ts, email.ts (SMTP)
src/routes/                 Pages and endpoints; each page's own components sit beside it
                            (for example src/routes/p/[id]/ for the project page and its photo page). Component names
                            follow docs/contributing.md#naming-components
drizzle/                    SQL migrations, applied by the server on startup
docker/server.js            Docker entry point
docker/backfill-thumbs.js   One-off script that makes thumbnails for photos that have none (see docs/deployment.md)
src/tests/                  Route and database tests (unit tests sit next to the code)
tests/e2e/                  Playwright browser tests; playwright.config.ts at the root
docs/                       Deployment, testing, endpoints, decisions, contributing, phone checklist
PLAN.md                     What is left to do
```

## Export

On a project page, the **Project menu** (hamburger button beside the project name in the header) shows the units and holds **Edit project**, **Export CSV** and **Export PDF**, and for the owner **Share** and **Delete project** (a guest gets **Leave project**). The project list has the same menu on every project. The two exports download the rooms, their areas and their measurements (CSV for spreadsheets, PDF for reading or printing). The PDF also shows each photo with its measurement lines drawn on; the CSV is text only. A project with very many photos makes a large PDF, which is built in memory.

## Add to home screen

The app has a web manifest and icons, so on a phone you can add it to the home screen (iPhone: Share > Add to Home Screen; Android: Install app) and it opens full-screen without the address bar. It still needs a connection: there is no offline mode. To change the icon, replace the files in `static/` (`icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`).

## Errors and feedback

- **Notifications:** problems that have no dialog open (a failed drag of an end point, a failed delete, a failed rename) appear in a small message at the bottom of the screen. Errors stay until you dismiss them and can have a **Retry** button; "Saved" and "Back online" disappear after a few seconds. A message stops counting down while the pointer is over it or it has keyboard focus. Problems inside a dialog or menu appear inside it, and what you typed is kept.
- **Offline:** a banner says "You're offline" while the browser reports no connection. Nothing is disabled; an action tried offline says so and can be repeated once you reconnect. There is no offline mode: changes are not queued.
- **Session expiry:** if the session has expired when you save, a "Signed out" box offers **Sign in**. A measurement being typed or a room name being added is kept in the browser tab and put back after you sign in and return to the same page. Photos that were not uploaded are listed as "Not uploaded" so you can add them again.
- **Uploads:** progress and results show in a panel fixed to the bottom of the window, so they stay in view however far the page is scrolled (with a summary such as "Uploading photos: 1 of 3 done"; the page and the notifications make room for it). Each photo shows its progress and result there; a failed one can be retried on its own. Each upload times out after 120 seconds. Leaving the page while photos are still uploading asks first ("Photos are still uploading. Leave anyway?") and then cancels the rest.

## Measuring

- **Names:** a measurement saved with no name is given one such as "Living Room 1-A" (the room, the photo's place in that room, a letter). The name is stored, so it does not change if the room is renamed or the photo moves. Clearing a name on edit gives a new one. Measurements from before this show as "Measurement x".
- **Selecting and drawing:** tapping a line selects it. With one selected, a tap on empty photo deselects it and places the first point of a new measurement in the same tap; Esc deselects without starting one.
- **Drawing order:** in `AnnotationCanvas.svelte` all lines and end dots come first (`.annotation`), then the labels (`text.label`), then the selected line's handles, so a label is never covered by a line. The browser tests read labels with `text.label`.
- **Keyboard:** the end points of the selected measurement are buttons ("Start of ...", "End of ..."). The arrow keys move one by 0.5% of the photo (Shift: 2%) and the move is saved shortly after the last key (the step shrinks with the zoom).
- **Zoom and pan (D54):** `AnnotationCanvas.svelte` keeps one view (`x`, `y`, `scale`, in image fractions) from `src/lib/zoom.ts`. The SVG's `viewBox` and a CSS transform on the `<img>` show the same part of the photo; `k` includes the scale, so markers keep their size. The zoom buttons, `+`/`-`/`0` (in `PhotoView.svelte`), a pinch, Ctrl + wheel and a one-finger drag while zoomed change the view. Pointer capture is used only once a drag has become a pan, so taps still place points.

## Limits

No offline mode, email only on the Docker build, the CSV export has no photos, and room areas use exactly two measurements (no L-shaped rooms).
