export interface View {
	/** Left and top edge of what is showing, as fractions of the image (0 to 1). */
	x: number;
	y: number;
	/** 1 = the whole photo; 4 = a quarter of its width and height. */
	scale: number;
}

export const FIT: View = { x: 0, y: 0, scale: 1 };
export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
/** The zoom buttons and keys double or halve the scale. */
export const ZOOM_STEP = 2;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keeps the scale in range and the photo filling the frame. */
export function clampView(v: View): View {
	const scale = clamp(v.scale, MIN_SCALE, MAX_SCALE);
	const max = 1 - 1 / scale;
	return { scale, x: clamp(v.x, 0, max), y: clamp(v.y, 0, max) };
}

/** The image point (fractions) under a point of the frame (fractions of the frame), clamped to the image. */
export function toImage(v: View, fx: number, fy: number) {
	return { x: clamp(v.x + fx / v.scale, 0, 1), y: clamp(v.y + fy / v.scale, 0, 1) };
}

/** Multiply the scale by `factor`, keeping the image point under frame point (fx, fy) where it is. */
export function zoomAt(v: View, factor: number, fx = 0.5, fy = 0.5): View {
	const ix = v.x + fx / v.scale;
	const iy = v.y + fy / v.scale;
	const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
	return clampView({ scale, x: ix - fx / scale, y: iy - fy / scale });
}

/** Move the photo with a finger or mouse that moved (dfx, dfy) fractions of the frame. */
export function panBy(v: View, dfx: number, dfy: number): View {
	return clampView({ ...v, x: v.x - dfx / v.scale, y: v.y - dfy / v.scale });
}
