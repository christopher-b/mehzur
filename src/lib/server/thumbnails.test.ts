import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { makeThumbnail, thumbKeyFor } from './thumbnails.ts';

const image = (width: number, height: number) =>
	sharp({ create: { width, height, channels: 3, background: '#c33' } }).png().toBuffer();

describe('makeThumbnail', () => {
	it('makes a JPEG whose longest side is 400px', async () => {
		const meta = await sharp(await makeThumbnail(await image(1000, 500))).metadata();
		expect(meta).toMatchObject({ format: 'jpeg', width: 400, height: 200 });
	});

	it('does not enlarge a small image', async () => {
		const meta = await sharp(await makeThumbnail(await image(100, 50))).metadata();
		expect(meta).toMatchObject({ width: 100, height: 50 });
	});

	it('throws for bytes that are not an image', async () => {
		await expect(makeThumbnail(new Uint8Array(16).fill(7))).rejects.toThrow();
	});
});

describe('thumbKeyFor', () => {
	it('swaps the extension for .thumb.jpg', () => {
		expect(thumbKeyFor('projects/p/abc.jpg')).toBe('projects/p/abc.thumb.jpg');
		expect(thumbKeyFor('projects/p/abc.webp')).toBe('projects/p/abc.thumb.jpg');
	});
});
