import sharp from 'sharp';

// Keep in step with docker/backfill-thumbs.js, which cannot import this file.
export const THUMB_DIMENSION = 400;
export const THUMB_QUALITY = 75;

/** A small JPEG of the image, its longest side at most THUMB_DIMENSION. Throws if the bytes are not a readable image. */
export async function makeThumbnail(bytes: Uint8Array): Promise<Uint8Array> {
	const out = await sharp(bytes)
		.rotate()
		.resize({ width: THUMB_DIMENSION, height: THUMB_DIMENSION, fit: 'inside', withoutEnlargement: true })
		.jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
		.toBuffer();
	return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

/** `projects/p/uuid.jpg` becomes `projects/p/uuid.thumb.jpg`. */
export function thumbKeyFor(blobKey: string): string {
	return blobKey.replace(/\.[^./]+$/, '') + '.thumb.jpg';
}
