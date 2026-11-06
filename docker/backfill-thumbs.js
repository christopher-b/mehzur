// One-off: make a thumbnail for every photo that has none (photos uploaded before thumbnails existed).
// Safe to run again: it only handles photos whose thumb_key is still empty.
//
//   docker exec <container> node backfill-thumbs.js
//
// Reads DATABASE_PATH and PHOTOS_PATH like the app. Run it only against the container's own data.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';

// Keep in step with src/lib/server/thumbnails.ts, which this script cannot import.
const THUMB_DIMENSION = 400;
const THUMB_QUALITY = 75;
const thumbKeyFor = (blobKey) => blobKey.replace(/\.[^./]+$/, '') + '.thumb.jpg';

const dbPath = process.env.DATABASE_PATH ?? '/data/mehzur.db';
const root = resolve(process.env.PHOTOS_PATH ?? '/data/photos');
const pathFor = (key) => {
	const p = resolve(root, key);
	if (!p.startsWith(root + sep)) throw new Error(`Invalid blob key: ${key}`);
	return p;
};

const db = new Database(dbPath);
const rows = db.prepare('select id, blob_key from photo where thumb_key is null').all();
const setThumb = db.prepare('update photo set thumb_key = ? where id = ?');

let done = 0;
let failed = 0;
for (const { id, blob_key } of rows) {
	try {
		const thumb = await sharp(await readFile(pathFor(blob_key)))
			.rotate()
			.resize({ width: THUMB_DIMENSION, height: THUMB_DIMENSION, fit: 'inside', withoutEnlargement: true })
			.jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
			.toBuffer();
		const thumbKey = thumbKeyFor(blob_key);
		const thumbPath = pathFor(thumbKey);
		await mkdir(dirname(thumbPath), { recursive: true });
		await writeFile(thumbPath, thumb);
		await writeFile(`${thumbPath}.meta`, 'image/jpeg');
		setThumb.run(thumbKey, id);
		done++;
	} catch (e) {
		failed++;
		console.error(`photo ${id} (${blob_key}): ${e.message}`);
	}
}
console.log(`${rows.length} without a thumbnail: ${done} done, ${failed} failed`);
