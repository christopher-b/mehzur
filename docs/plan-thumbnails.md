# Plan: server-generated photo thumbnails

**Problem.** The photo grid (`src/routes/p/[id]/PhotoGrid.svelte`) uses the full upload for every tile. Uploads are resized in the browser to at most 2560px at JPEG quality 0.85 (`src/lib/image.ts`), so each one is about 0.5–1.5 MB. Each tile is only about 8rem × 6.5rem. A room with 20 photos downloads 10–30 MB.

**Not the cache.** `/api/photos/[...key]` already sends `private, max-age=31536000, immutable`, so repeat visits are fine. The fix is smaller files for the first load.

**Goal.** The grid loads a thumbnail of about 400px (around 30 KB) instead of the 2560px original.

**Decisions:**
- Thumbnails are made on the server with `sharp` when a photo is uploaded.
- Photos uploaded before this change get thumbnails from a one-off backfill script.
- Until a photo has a thumbnail, the grid falls back to the full image.

## 1. Add sharp

- Run `npm install sharp`. It must go in **`dependencies`**, not dev dependencies; otherwise `npm prune --omit=dev` in the `Dockerfile` removes it.
- sharp ships ready-made Linux binaries for x64 and arm64, so `node:24-bookworm-slim` needs no extra apt packages. Confirm with `docker build`.
- If Vite tries to bundle sharp, add `ssr.external: ['sharp']` to the Vite config.

## 2. Thumbnail module: `src/lib/server/thumbnails.ts` (new)

- Constants: `THUMB_DIMENSION = 400`, `THUMB_QUALITY = 75`.
- `makeThumbnail(bytes: Uint8Array): Promise<Uint8Array>` runs sharp in this order:
  1. `.rotate()`, which follows EXIF orientation (client uploads are already upright, so this is a safety net).
  2. `.resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })`.
  3. `.jpeg({ quality: 75, mozjpeg: true })`.
- `thumbKeyFor(blobKey)` turns `projects/p/uuid.jpg` into `projects/p/uuid.thumb.jpg`.
- Unit test `thumbnails.test.ts`: build a real 1000×500 image with sharp and check:
  - the output is a JPEG;
  - its longest side is 400px;
  - a small image is not enlarged.

## 3. Database

- In `src/lib/server/db/schema.ts`, add `thumbKey: text('thumb_key').unique()` to `photos`. It is nullable; null means "use the full image".
- Run `npm run db:generate` and rename the output to `drizzle/0007_photo_thumbs.sql`, matching the existing names.

## 4. Upload: `src/routes/api/projects/[id]/photos/+server.ts`

- After the type check (`looksLike`), call `makeThumbnail(new Uint8Array(bytes))`. If it throws, return a **415** error: the image can't be decoded and must not be stored.
- Save the full image and the thumbnail (key from `thumbKeyFor(blobKey)`, type `image/jpeg`), then insert the database row with `thumbKey`. If the insert fails, delete both files.
- Tests in `src/tests/upload.test.ts`:
  - `imageFile()` in `src/tests/helpers.ts` makes fake bytes that only pass the type check, but sharp needs a real image. Add a helper that builds a real image with sharp, and use it wherever an upload should succeed.
  - A thumbnail is stored and `thumbKey` is set.
  - Bytes that look like a JPEG but are corrupt give a 415 and store nothing.

## 5. Serving: `src/routes/api/photos/[...key]/+server.ts`

- Change the permission check from `eq(photos.blobKey, params.key)` to `or(eq(photos.blobKey, params.key), eq(photos.thumbKey, params.key))`.
- Tests in `src/tests/auth-routes.test.ts`: the owner gets the thumbnail; a stranger gets a 404.

## 6. Grid

- Add `thumbKey` to the photo query behind `PageData['photos']` (find it from the project page loader).
- In `src/routes/p/[id]/PhotoGrid.svelte`, use `src="/api/photos/{photo.thumbKey ?? photo.blobKey}"` and add `decoding="async"`.
- Leave the photo viewer (`PhotoView.svelte`), the PDF export (`pdf.ts`) and `export.ts` alone. They need the full image.

## 7. Deleting

Wherever `blobKey` is deleted from storage, delete `thumbKey` too (when it is set):

- `src/lib/server/photos.ts`, photo delete: add `thumbKey` to `.returning(...)`.
- `src/lib/server/projects.ts`, project delete (around line 39): also select `thumbKey`.
- Account deletion: grep `storage.delete` in `src/lib/server/accounts.ts`.

Extend the matching tests (`photo-actions.test.ts`, `projects.test.ts`, `accounts.test.ts`) to check that both files are gone.

## 8. Backfill script for older photos: `docker/backfill-thumbs.js` (new)

The script is plain JS so it runs in the container without a build step. It uses `better-sqlite3` and `sharp` directly and reads the `DATABASE_PATH` and `PHOTOS_PATH` environment variables. To see how a key maps to a file path, check `src/lib/server/storage/fs.ts`.

For each row from `SELECT id, blob_key FROM photos WHERE thumb_key IS NULL`:

1. Read the file and make the thumbnail with the same settings as `thumbnails.ts`.
2. Write the `.thumb.jpg` file.
3. Run `UPDATE photos SET thumb_key = ? WHERE id = ?`.

Behaviour:

- If a file is missing or can't be read, log it and continue.
- Running it again is safe: it only handles rows that still have no thumbnail.
- Print counts at the end (done, skipped, failed).

Setup and safety:

- Add `COPY docker/backfill-thumbs.js ./backfill-thumbs.js` to the runtime stage of the `Dockerfile`.
- Usage: `docker exec <container> node backfill-thumbs.js`. Document this in `README.md` or the deployment docs.
- The settings must match `thumbnails.ts`. Add a comment in each file pointing to the other, because the script can't import TypeScript from `#lib`.
- **Never run it against `./data`** (the developer's own database). Test it on a temporary copy.

## 9. Docs and checks

- Update `docs/architecture.md` (thumbnails, `thumb_key`, the backfill script) and `PLAN.md`.
- Add a line to `docs/phone-test-checklist.md`: "The photo grid loads quickly on mobile data."
- Stop anything on port 4180 first (`lsof -ti :4180 | xargs kill`). Then run `npm run check`, `npm test`, `npm run check:e2e`, `npm run test:e2e` and `docker build .`.
- No accessible names change, so `tests/e2e` needs no edits.

## Expected result

A grid of 20 photos goes from about 20 MB to about 0.6 MB on the first visit. Later visits load from the browser cache, as they already do.
