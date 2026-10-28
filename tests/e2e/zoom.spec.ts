import { expect, test } from './fixtures';
import {
	addAndOpenPhoto,
	addPhotos,
	addRoom,
	createProject,
	dragHandle,
	firstLine,
	isTouch,
	makeImage,
	measurementDialog,
	photoCanvas,
	measurementField,
	shownPhotoWidth,
	startMeasurement,
	tapAt,
	uniqueName,
	waitForPhoto,
	zoomButton
} from './helpers';
import type { Page } from '@playwright/test';

const level = (page: Page) => page.locator('.zoom-level');

async function openPhoto(page: Page) {
	await createProject(page, uniqueName('Zoom'));
	await addRoom(page, 'Kitchen');
	await addAndOpenPhoto(page, 'Kitchen');
}

/** A short measurement in the middle of the photo, so it stays in view at 4×. */
async function drawCentralMeasurement(page: Page) {
	await startMeasurement(page, 0.5, 0.45, 0.55);
	await measurementField(page).fill(`10'`);
	await measurementDialog(page).getByRole('button', { name: 'Save' }).click();
	await expect(measurementDialog(page)).toBeHidden();
}

test('the zoom buttons step from 1× to 8× and Fit returns to 1×', async ({ page }) => {
	await openPhoto(page);
	await expect(level(page)).toHaveText('1×');
	await expect(zoomButton(page, 'Zoom out')).toBeDisabled();
	await expect(zoomButton(page, 'Fit photo')).toBeDisabled();

	await zoomButton(page, 'Zoom in').click();
	await zoomButton(page, 'Zoom in').click();
	await expect(level(page)).toHaveText('4×');
	await expect(zoomButton(page, 'Zoom in')).toBeEnabled();

	await zoomButton(page, 'Zoom in').click();
	await expect(level(page)).toHaveText('8×');
	await expect(zoomButton(page, 'Zoom in')).toBeDisabled();

	await zoomButton(page, 'Fit photo').click();
	await expect(level(page)).toHaveText('1×');
});

test('placing a measurement while zoomed is precise', async ({ page }) => {
	await openPhoto(page);
	await zoomButton(page, 'Zoom in').click();
	await zoomButton(page, 'Zoom in').click();
	await tapAt(page, 0.2, 0.2);
	await tapAt(page, 0.8, 0.2);
	await measurementField(page).fill(`10'`);
	await measurementDialog(page).getByRole('button', { name: 'Save' }).click();
	await expect(measurementDialog(page)).toBeHidden();

	const expectLine = async () => {
		const line = await firstLine(page);
		expect(line.x1).toBeCloseTo(0.425, 2);
		expect(line.y1).toBeCloseTo(0.425, 2);
		expect(line.x2).toBeCloseTo(0.575, 2);
	};
	await expectLine();
	await zoomButton(page, 'Fit photo').click();
	await expect(page.locator('.annotation')).toHaveCount(1);
	await expectLine();
});

test('markers and labels keep their on-screen size when zoomed', async ({ page }) => {
	await openPhoto(page);
	await drawCentralMeasurement(page);
	const label = page.locator('text.label');
	const before = (await label.boundingBox())!;
	await zoomButton(page, 'Zoom in').click();
	await zoomButton(page, 'Zoom in').click();
	const after = (await label.boundingBox())!;
	expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
});

test('dragging a handle while zoomed moves it by the zoomed distance', async ({ page }) => {
	await openPhoto(page);
	await drawCentralMeasurement(page);
	await zoomButton(page, 'Zoom in').click();
	await zoomButton(page, 'Zoom in').click();
	await dragHandle(page, 0, 0.5, 0.5);
	await expect.poll(async () => (await firstLine(page)).x1).toBeCloseTo(0.5, 2);
	expect((await firstLine(page)).y1).toBeCloseTo(0.5, 2);
});

test('+, - and 0 zoom from the keyboard, but not while typing', async ({ page }) => {
	await openPhoto(page);
	await page.keyboard.press('+');
	await expect(level(page)).toHaveText('2×');
	await page.keyboard.press('-');
	await expect(level(page)).toHaveText('1×');
	await page.keyboard.press('+');
	await page.keyboard.press('=');
	await expect(level(page)).toHaveText('4×');
	await page.keyboard.press('0');
	await expect(level(page)).toHaveText('1×');

	await startMeasurement(page);
	await measurementField(page).press('+');
	await expect(level(page)).toHaveText('1×');
});

test('the zoom starts again at 1× on another photo', async ({ page }) => {
	await createProject(page, uniqueName('Zoom'));
	await addRoom(page, 'Kitchen');
	await addPhotos(page, 'Kitchen', [await makeImage(page, 640, 480, 'first'), await makeImage(page, 1000, 500, 'second')]);
	await expect(page).toHaveURL(/\/photo\//);
	await waitForPhoto(page);
	expect(await shownPhotoWidth(page)).toBe('640');

	await zoomButton(page, 'Zoom in').click();
	await expect(level(page)).toHaveText('2×');
	await page.getByRole('link', { name: /Next/ }).click();
	await expect.poll(() => shownPhotoWidth(page)).toBe('1000');
	await expect(level(page)).toHaveText('1×');
});

/** Drag with the mouse between two fractional positions of the frame. */
async function mouseDrag(page: Page, from: [number, number], to: [number, number]) {
	const box = (await photoCanvas(page).boundingBox())!;
	const at = ([fx, fy]: [number, number]) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
	await page.mouse.move(at(from).x, at(from).y);
	await page.mouse.down();
	await page.mouse.move(at(to).x, at(to).y, { steps: 5 });
	await page.mouse.up();
}

test('Ctrl + wheel zooms around the pointer and does not scroll the page', async ({ page }) => {
	test.skip(isTouch(), 'A wheel needs a mouse');
	await openPhoto(page);
	const box = (await photoCanvas(page).boundingBox())!;
	const scrollY = await page.evaluate(() => window.scrollY);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.keyboard.down('Control');
	await page.mouse.wheel(0, -100);
	await page.keyboard.up('Control');
	await expect(level(page)).not.toHaveText('1×');
	expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
});

test('dragging empty photo pans it, and the drag does not place a point', async ({ page }) => {
	await openPhoto(page);
	await zoomButton(page, 'Zoom in').click();
	await mouseDrag(page, [0.6, 0.5], [0.4, 0.5]);
	await expect(page.getByText(/second point/)).toHaveCount(0);

	await tapAt(page, 0.5, 0.5);
	await tapAt(page, 0.8, 0.5);
	await measurementField(page).fill(`10'`);
	await measurementDialog(page).getByRole('button', { name: 'Save' }).click();
	await expect(measurementDialog(page)).toBeHidden();
	const line = await firstLine(page);
	expect(line.x1).toBeCloseTo(0.6, 2);
	expect(line.y1).toBeCloseTo(0.5, 2);
});

test('pinching with two fingers zooms the photo', async ({ page, browserName }) => {
	test.skip(!isTouch() || browserName !== 'chromium', 'Only Chromium can inject two touch points');
	await openPhoto(page);
	const box = (await photoCanvas(page).boundingBox())!;
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	const fingers = (gap: number) => [
		{ x: cx - gap / 2, y: cy, id: 1 },
		{ x: cx + gap / 2, y: cy, id: 2 }
	];
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(40) });
	for (let i = 1; i <= 5; i++) {
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(40 + (80 * i) / 5) });
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

	await expect.poll(async () => Number.parseFloat((await level(page).textContent()) ?? '')).toBeCloseTo(3, 0);
	await expect(page.getByText(/second point/)).toHaveCount(0);
	await expect(page.locator('.annotation')).toHaveCount(0);
});

test('panning between the two taps keeps the first point', async ({ page }) => {
	await openPhoto(page);
	await tapAt(page, 0.3, 0.5);
	await expect(page.getByText(/second point/)).toBeVisible();
	await zoomButton(page, 'Zoom in').click();
	await mouseDrag(page, [0.6, 0.5], [0.4, 0.5]);
	await expect(page.getByText(/second point/)).toBeVisible();
	await tapAt(page, 0.8, 0.5);
	await expect(measurementDialog(page)).toBeVisible();
});
