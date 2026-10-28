import { describe, expect, it } from 'vitest';
import { FIT, MAX_SCALE, clampView, panBy, toImage, zoomAt } from './zoom.ts';

describe('clampView', () => {
	it('raises a scale below 1 to 1 and puts the view at the origin', () => {
		expect(clampView({ x: 0.3, y: 0.4, scale: 0.5 })).toEqual({ x: 0, y: 0, scale: 1 });
	});

	it('limits the scale to the maximum', () => {
		expect(clampView({ x: 0, y: 0, scale: 20 }).scale).toBe(MAX_SCALE);
	});

	it('keeps x and y within 0 .. 1 - 1/scale', () => {
		expect(clampView({ x: -0.2, y: 0.9, scale: 2 })).toEqual({ x: 0, y: 0.5, scale: 2 });
		expect(clampView({ x: 0.3, y: 0.2, scale: 2 })).toEqual({ x: 0.3, y: 0.2, scale: 2 });
	});
});

describe('toImage', () => {
	it('is the identity at FIT', () => {
		expect(toImage(FIT, 0.3, 0.7)).toEqual({ x: 0.3, y: 0.7 });
	});

	it('maps a frame point through the view', () => {
		const p = toImage({ x: 0.375, y: 0.375, scale: 4 }, 0.2, 0.2);
		expect(p.x).toBeCloseTo(0.425, 10);
		expect(p.y).toBeCloseTo(0.425, 10);
	});

	it('clamps to the image', () => {
		expect(toImage(FIT, -0.2, 1.3)).toEqual({ x: 0, y: 1 });
		expect(toImage({ x: 0.5, y: 0.5, scale: 2 }, 1.5, 1.5)).toEqual({ x: 1, y: 1 });
	});
});

describe('zoomAt', () => {
	it('zooms FIT by 2 around the centre', () => {
		expect(zoomAt(FIT, 2)).toEqual({ x: 0.25, y: 0.25, scale: 2 });
	});

	it('keeps the corner when zooming at (0, 0)', () => {
		const v = zoomAt(FIT, 4, 0, 0);
		expect(v.x).toBe(0);
		expect(v.y).toBe(0);
		expect(v.scale).toBe(4);
	});

	it('keeps the image point under the zoom point where it is', () => {
		const start = { x: 0.2, y: 0.3, scale: 2 };
		for (const [fx, fy] of [
			[0.3, 0.4],
			[0.5, 0.5],
			[0.7, 0.6]
		]) {
			const before = toImage(start, fx, fy);
			const after = toImage(zoomAt(start, 1.5, fx, fy), fx, fy);
			expect(after.x).toBeCloseTo(before.x, 10);
			expect(after.y).toBeCloseTo(before.y, 10);
		}
	});

	it('stops at the maximum scale', () => {
		expect(zoomAt({ x: 0, y: 0, scale: 4 }, 4).scale).toBe(MAX_SCALE);
	});

	it('returns to FIT when zooming out of 2x by 2', () => {
		expect(zoomAt({ x: 0.25, y: 0.25, scale: 2 }, 1 / 2)).toEqual(FIT);
	});
});

describe('panBy', () => {
	it('moves x against the drag, scaled by the zoom', () => {
		const v = panBy({ x: 0.25, y: 0.25, scale: 2 }, 0.1, 0);
		expect(v.x).toBeCloseTo(0.2, 10);
		expect(v.y).toBe(0.25);
	});

	it('cannot go past the edges', () => {
		expect(panBy({ x: 0.25, y: 0.25, scale: 2 }, 5, 5)).toEqual({ x: 0, y: 0, scale: 2 });
		expect(panBy({ x: 0.25, y: 0.25, scale: 2 }, -5, -5)).toEqual({ x: 0.5, y: 0.5, scale: 2 });
	});

	it('does nothing at FIT', () => {
		expect(panBy(FIT, 0.3, -0.3)).toEqual(FIT);
	});
});
