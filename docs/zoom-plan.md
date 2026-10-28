# Zoom and pan on the photo: implementation plan

**Goal:** let people place and adjust measurement end points precisely by zooming into the photo inside its frame. The rest of the page does not zoom. Saved data does not change: points are still stored as fractions of the image (D6).

**Status:** built (tasks 1 to 4); the real-phone checks in `docs/phone-test-checklist.md` are still to do. Written to be handed off: every design choice below was made up front. If something here turns out to be wrong, stop and ask rather than choosing a different design.

Read first: `AGENTS.md`, `docs/contributing.md`, and all of `src/lib/components/AnnotationCanvas.svelte` (about 400 lines). Every change is in that component, a new `src/lib/zoom.ts`, `PhotoView.svelte` (keyboard shortcuts only), the tests and the docs.

---

## What the user gets

- **Zoom buttons** under the photo, at the right: "Zoom out" (−), the current zoom ("2×"), "Zoom in" (+) and "Fit". Zoom goes from 1× (the whole photo, as today) to 8×, doubling or halving each press. The buttons zoom around the centre of what is showing.
- **Keyboard:** `+` or `=` zooms in, `-` zooms out, `0` fits. These are ignored in text fields and while a dialog or menu is open, like the other photo-page shortcuts.
- **Pinch** with two fingers on the photo zooms around the point between the fingers. Moving both fingers pans.
- **Trackpad pinch or Ctrl + mouse wheel** over the photo zooms around the pointer. A plain wheel still scrolls the page.
- **Drag to pan:** when zoomed, dragging empty photo (one finger or the mouse) pans. A tap without movement still places a point, as today.
- Markers, handles, labels and the tap area around lines **keep their on-screen size** at every zoom, so at 4× an end point can be placed four times more precisely.
- The **arrow-key nudge** of a handle moves a fixed on-screen distance: 0.5% of the photo at 1×, 0.125% at 4×.
- Zooming and panning between the first and the second tap of a new measurement is allowed: the first point stays.
- Opening another photo starts at 1×. The page itself can still be zoomed by pinching anywhere outside the photo (the viewport meta tag is not changed: blocking page zoom would hurt accessibility).

Not in this plan (possible later tasks, listed at the end): a magnifier loupe while dragging, panning automatically when a dragged handle reaches the edge, and zooming to a measurement chosen from the list.

---

## The design (do not change it)

### One view state, in image fractions

The visible part of the photo is described by:

```ts
interface View {
	/** Left and top edge of what is showing, as fractions of the image (0 to 1). */
	x: number;
	y: number;
	/** 1 = the whole photo; 4 = a quarter of its width and height. */
	scale: number;
}
```

The frame keeps the photo's aspect ratio, so the visible width and height are both `1 / scale` of the image. `x` is always between `0` and `1 - 1 / scale` (the photo always fills the frame, no empty margin), and the same for `y`.

### How it is drawn: SVG viewBox, plus a CSS transform on the `<img>`

- The `<svg>` overlay keeps its size and position. Only its `viewBox` changes: `viewBox="{x*width} {y*height} {width/scale} {height/scale}"`. SVG then scales the lines itself, and `vector-effect: non-scaling-stroke` keeps working.
- The `<img>` stays in the page as now (the browser tests read its `width` attribute, and it carries the `alt`). It gets the matching CSS transform: `transform-origin: 0 0; transform: scale(S) translate(-X%, -Y%)` with `S = scale`, `X = x * 100`, `Y = y * 100`. Translate percentages are of the image's own box, which is the frame, so this lines up exactly with the viewBox.
- `.canvas` gets `overflow: hidden` **only while zoomed** (`class:zoomed={view.scale > 1}`). At 1× nothing changes from today, including labels that stick out past the photo's edge.

Why not a CSS transform on a wrapper around both: `vector-effect: non-scaling-stroke` does not reliably ignore CSS transforms on HTML ancestors, so strokes would grow with the zoom in some browsers. Why not `<image>` inside the SVG: the tests and the `alt` text rely on the `<img>`.

### Sizes that must stay constant on screen

Today `k = width / displayWidth` (image pixels per CSS pixel). With zoom it becomes:

```ts
const k = $derived(displayWidth ? width / (displayWidth * view.scale) : 1);
```

Everything already multiplied by `k` (end dots, handles, label size, pending ring) then keeps its on-screen size. Nothing else needs changing for sizes.

### Screen position to image position

`toPoint` and `screenDistance` go through the view:

```ts
function toPoint(e: PointerEvent | MouseEvent): Point {
	const rect = svg.getBoundingClientRect();
	return toImage(view, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
}

function screenDistance(a: Point, b: Point) {
	const rect = svg.getBoundingClientRect();
	return Math.hypot((a.x - b.x) * rect.width * view.scale, (a.y - b.y) * rect.height * view.scale);
}
```

`toImage` (below) clamps to 0..1, as `toPoint` does today. Because the drag, tap and hover code all go through `toPoint`, they need no other change.

---

## Task 1: the pure view maths (`src/lib/zoom.ts`), with unit tests

One commit. No UI.

Create `src/lib/zoom.ts`:

```ts
export interface View {
	x: number;
	y: number;
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
```

Create `src/lib/zoom.test.ts` (Vitest, like `src/lib/units.test.ts`). Cover at least:

- `clampView`: scale below 1 becomes 1 with x and y 0; scale above 8 becomes 8; x and y are kept within `0 .. 1 - 1/scale`.
- `toImage`: at `FIT`, frame fractions equal image fractions; at `{ x: 0.375, y: 0.375, scale: 4 }`, frame point (0.2, 0.2) is image point (0.425, 0.425); results are clamped to 0..1.
- `zoomAt`: zooming FIT by 2 at the centre gives `{ x: 0.25, y: 0.25, scale: 2 }`; zooming at (0, 0) keeps x and y at 0; the image point under (fx, fy) is the same before and after (check with `toImage` for a few points away from the edges); zooming past 8 stops at 8; zooming out of 2× by 2 gives FIT.
- `panBy`: at 2×, panning by (0.1, 0) moves x by −0.05; panning cannot go past the edges; at FIT, panning does nothing.

**Done when:** `npm test` passes with the new tests, and `npm run check` is clean.

---

## Task 2: draw through the view, with zoom buttons and keys

One commit. Only buttons and keys change the view in this task; gestures come in Task 3.

### `AnnotationCanvas.svelte`

1. Import from `#lib/zoom.ts` (with the `.ts` extension). Add the state `let view = $state<View>(FIT);`.
2. Replace `k` as shown above. Change `toPoint` and `screenDistance` as shown above.
3. The `<svg>`'s `viewBox` becomes `"{view.x * width} {view.y * height} {width / view.scale} {height / view.scale}"`.
4. The `<img>` gets `style:transform="scale({view.scale}) translate({-view.x * 100}%, {-view.y * 100}%)"`. In the CSS, `img` gets `transform-origin: 0 0;`.
5. `.canvas` gets `class:zoomed={view.scale > 1}`. Add `.canvas.zoomed { overflow: hidden; border-radius: var(--radius-md); }` (the image's own radius is lost when it is scaled).
6. In `onHandleKeydown`, divide both steps by the scale: `const step = (e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP) / view.scale;`.
7. Export three functions next to `cancel()`, so `PhotoView` can call them:

   ```ts
   export const zoomIn = () => (view = zoomAt(view, ZOOM_STEP));
   export const zoomOut = () => (view = zoomAt(view, 1 / ZOOM_STEP));
   export const fit = () => (view = FIT);
   ```

8. After the closing `</div>` of `.canvas`, add the zoom bar. Use Lucide icons like the rest of the app (`@lucide/svelte/icons/zoom-in`, `zoom-out`, `maximize`), with `aria-hidden="true"` on the icons:

   ```svelte
   <div class="zoom-bar">
   	<button type="button" class="icon-button" aria-label="Zoom out" disabled={view.scale <= MIN_SCALE} onclick={zoomOut}>…</button>
   	<span class="zoom-level" aria-live="polite">{view.scale}×</span>
   	<button type="button" class="icon-button" aria-label="Zoom in" disabled={view.scale >= MAX_SCALE} onclick={zoomIn}>…</button>
   	<button type="button" aria-label="Fit photo" disabled={view.scale === 1} onclick={fit}>Fit</button>
   </div>
   ```

   Style: `display: flex; justify-content: flex-end; align-items: center; gap: 0.4rem; margin-top: 0.5rem;`. Show the level rounded: `{Math.round(view.scale * 10) / 10}×` (pinching in Task 3 gives fractional scales). Check that `.icon-button` exists in `src/app.css` and reuse it. These accessible names ("Zoom in", "Zoom out", "Fit photo") are new and become a contract with the tests.

9. Leave everything else in the component alone.

### `PhotoView.svelte`

In `onKeydown`, before the `if (modalOpen || !selectedId) return;` line, add a branch that works whether or not a measurement is selected:

```ts
if ((e.key === '+' || e.key === '=' || e.key === '-' || e.key === '0') && !(e.altKey || e.ctrlKey || e.metaKey)) {
	if (modalOpen || (e.target as HTMLElement).closest(TEXT_FIELD)) return;
	e.preventDefault();
	if (e.key === '-') canvas.zoomOut();
	else if (e.key === '0') canvas.fit();
	else canvas.zoomIn();
	return;
}
```

`canvas` is the existing `bind:this` reference. Ctrl/Cmd with `+`, `-` and `0` must stay the browser's own page zoom, which is why those modifiers are excluded.

### Browser tests (`tests/e2e/zoom.spec.ts`, new file)

Add to `tests/e2e/helpers.ts`:

```ts
export const zoomButton = (page: Page, name: 'Zoom in' | 'Zoom out' | 'Fit photo') =>
	page.getByRole('button', { name, exact: true });

/** The x1, y1, x2, y2 of the first measurement line, as fractions of the image. */
export async function firstLine(page: Page) { … }
```

`firstLine` reads the `x1 y1 x2 y2` attributes of `.annotation line.stroke` (they are image pixels) and divides by the image size from `.canvas img`'s `width` and `height` attributes.

Note for every test: `tapAt` takes fractions of the **frame** (the visible part), not of the image.

Tests (each sets up with `createProject`, `addRoom`, `addAndOpenPhoto`, as in `measurements.spec.ts`):

1. **Zoom buttons.** At first "Zoom out" and "Fit photo" are disabled and the level reads "1×". Press "Zoom in" twice: "4×", and "Zoom in" is still enabled. Press it once more: "8×" and "Zoom in" is disabled. "Fit photo" returns to "1×".
2. **Placing while zoomed is precise.** Zoom in twice (4×, view `{ x: 0.375, y: 0.375 }`). `tapAt(0.2, 0.2)` and `tapAt(0.8, 0.2)`, fill `10'`, Save. `firstLine` gives `x1 ≈ 0.425`, `y1 ≈ 0.425`, `x2 ≈ 0.575` (`toBeCloseTo(…, 2)`). After "Fit photo" the line is still there with the same values.
3. **Markers keep their size.** Draw a measurement at 1× and note the on-screen height of `.annotation text` (`boundingBox`). Zoom in twice: the height is the same within 1 px.
4. **Dragging a handle while zoomed.** Draw a measurement, zoom in twice, `dragHandle(page, 0, 0.5, 0.5)`: `firstLine` x1 and y1 are about 0.5 (the centre of the frame is image 0.5 at this view).
5. **Keys.** Press `+`: "2×". Press `-`: "1×". Press `+` twice then `0`: "1×". Typing `+` in the measurement dialog's field does not zoom.
6. **Zoom resets on another photo.** With two photos in the room, zoom in, follow the "Next" link (`getByRole('link', { name: /Next/ })`, as in `photos.spec.ts`): "1×". (`+page.svelte` wraps `PhotoView` in `{#key data.photo.id}`, so this needs no code.)

**Done when:** `npm run check`, `npm test`, `npm run check:e2e` and `npm run test:e2e` pass, and `npm run test:e2e:safari` passes (sizes and transforms differ in WebKit).

---

## Task 3: gestures (pinch, drag to pan, trackpad and Ctrl + wheel)

One commit. All in `AnnotationCanvas.svelte`, plus tests and the phone checklist.

### Pointer tracking

Add plain (non-reactive) state:

```ts
/** Pointers down on the photo (not on a handle), by pointer id, in client coordinates. */
const pointers = new Map<number, { x: number; y: number }>();
/** What the current gesture started from. */
let gesture: { kind: 'tap' | 'pan' | 'pinch'; startView: View; startX: number; startY: number; startDistance: number } | null = null;
const TAP_SLOP = 8; // CSS pixels a finger may move and still count as a tap
```

Add `onpointerdown={onPointerDown}` to the `<svg>`. Handles already call `e.stopPropagation()` in `startDrag`, so a press on a handle never reaches it. Taps on lines and on the background do reach it, which is wanted.

- **`onPointerDown(e)`:** return if `!interactive` or `drag`. Ignore mouse buttons other than the main one (`e.button !== 0`). Add the pointer to `pointers`.
  - With one pointer: `gesture = { kind: 'tap', startView: view, startX: e.clientX, startY: e.clientY, startDistance: 0 }`.
  - With two pointers: `gesture = { kind: 'pinch', startView: view, startX: midX, startY: midY, startDistance: distance }` (midpoint and distance of the two pointers). Set `suppressClick = true` so the lifted finger does not place a point.
  - Three or more pointers: ignore the extra ones.
  - **Do not call `setPointerCapture` here.** Capturing would send the following `click` to the `<svg>` instead of the background `<rect>`, and taps would stop placing points.
- **In `onPointerMove(e)`**, first keep the existing `drag` branch exactly as it is (a handle drag wins). Otherwise, if `pointers.has(e.pointerId)`, update its position, then:
  - `tap` and the pointer has moved more than `TAP_SLOP` from the start: if `view.scale > 1`, switch to `pan` and call `svg.setPointerCapture(e.pointerId)` (now safe: this will not be a tap). At 1× do nothing (there is nothing to pan; on a phone the page scrolls instead, see touch-action below).
  - `pan`: `view = panBy(gesture.startView, (e.clientX - gesture.startX) / rect.width, (e.clientY - gesture.startY) / rect.height)`.
  - `pinch` (two pointers): with the current midpoint and distance, `view = panBy(zoomAt(gesture.startView, distance / gesture.startDistance, startMidFx, startMidFy), (midX - gesture.startX) / rect.width, (midY - gesture.startY) / rect.height)`, where `startMidFx` and `startMidFy` are the start midpoint as fractions of the frame (`(gesture.startX - rect.left) / rect.width`, and the same for y).
  - Keep the existing mouse `hover` update for the dashed preview line.
- **`onpointerup` and `onpointercancel`:** keep calling `endDrag` and `cancelDrag` as today, and also remove the pointer from `pointers`. If the gesture was `pan` or `pinch`, set `suppressClick = true` and clear it with `setTimeout(..., 0)`, exactly as `endDrag` does, so the click that follows a pan does not place a point. When the pinch loses one of its two fingers, end the gesture (`gesture = null`); do not turn the remaining finger into a pan.

Taps still place points through the existing `onclick` on the background `<rect>`; that code does not change.

### touch-action

Replace the `svg.editing { touch-action: pinch-zoom; }` rule. The overlay needs:

- `touch-action: none` while zoomed or editing: `class:no-touch-scroll={view.scale > 1 || (selectedId !== null && interactive)}` with `svg.no-touch-scroll { touch-action: none; }`. When zoomed, one-finger drags pan the photo instead of scrolling the page, and handle drags work as today.
- Otherwise `touch-action: pan-y` on `svg`, so at 1× a one-finger swipe on the photo still scrolls the page, while a two-finger pinch reaches the pointer handlers.

Keep the existing comment's explanation (browsers ignore touch-action on SVG shapes, so it goes on the whole overlay) and update it.

### iOS Safari page zoom

iOS Safari zooms the page on a pinch whatever `touch-action` says, and sends its own `gesturestart` and `gesturechange` events. In an `$effect`, add listeners to the `.canvas` element for `gesturestart`, `gesturechange` and `gestureend` that call `e.preventDefault()`, with `{ passive: false }`, and remove them in the cleanup. Pointer events still arrive, so the pinch above works.

### Trackpad pinch and Ctrl + wheel

Trackpad pinches arrive as `wheel` events with `ctrlKey` set, the same as Ctrl + wheel. In an `$effect`, add a `wheel` listener to the `<svg>` with `{ passive: false }` (do not use Svelte's `onwheel` attribute: it may be passive, and then `preventDefault` is ignored):

```ts
function onWheel(e: WheelEvent) {
	if (!e.ctrlKey || !interactive) return; // a plain wheel scrolls the page
	e.preventDefault();
	const rect = svg.getBoundingClientRect();
	view = zoomAt(view, Math.exp(-e.deltaY * 0.01), (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
}
```

### Browser tests (add to `tests/e2e/zoom.spec.ts`)

1. **Ctrl + wheel zooms around the pointer** (desktop projects only: `test.skip(isTouch(), …)`). Move the mouse to the frame centre, `page.keyboard.down('Control')`, `page.mouse.wheel(0, -100)`, `page.keyboard.up('Control')`. The level is above "1×". The page did not scroll (`window.scrollY` unchanged).
2. **Drag to pan, and the drag does not place a point** (mouse). Zoom in once (2×, view x = 0.25). Drag empty photo from frame (0.6, 0.5) to (0.4, 0.5) with `page.mouse` (`down`, `move` in 5 steps, `up`). No "second point" hint shows (`page.getByText(/second point/)` has count 0). A following tap at frame (0.5, 0.5) and a second tap make a line whose `x1` is about `0.25 + 0.1 + 0.5 / 2 = 0.6` (it was dragged 0.2 of the frame = 0.1 of the image at 2×).
3. **Pinch zooms** (phone project in Chromium only: `test.skip(!isTouch() || browserName !== 'chromium', 'Only Chromium can inject two touch points')`). Use the DevTools protocol as `dragHandle` does: `Input.dispatchTouchEvent` `touchStart` with two `touchPoints` 40 px either side of the frame centre, five `touchMove` steps moving them to 120 px apart, then `touchEnd`. The level is about "3×". No point was placed.
4. **A pan or pinch between the two taps keeps the first point.** Tap once, zoom in with the button, pan by dragging (mouse), tap a second point: the measurement dialog opens.

**Done when:** all checks and both browser suites pass (`npm run test:e2e` and `npm run test:e2e:safari`), and the phone checklist has the new section below.

### Phone checklist (`docs/phone-test-checklist.md`)

Add to section 4 (Measuring):

- [ ] **Pinch on the photo** zooms the photo, not the page; the header and the measurement list stay the same size. Moving both fingers pans. Lifting the fingers does not place a point.
- [ ] **When zoomed**, one finger dragging on the photo pans it, and a tap still places a point. Markers, labels and handles look the same size as at 1×.
- [ ] **At 1×**, a one-finger swipe up or down on the photo still scrolls the page.
- [ ] Zoom in (pinch or the + button), drag a handle a short way, then tap **Fit**: the end point moved by the small amount you dragged.
- [ ] Pinching **outside the photo** still zooms the whole page (an accessibility feature that must keep working).

---

## Task 4: docs

One commit (or include in Task 3's commit).

- `docs/decisions.md`: remove "zoom and pan" from "Dropped on purpose". Add **D54**: "The photo zooms inside its frame (1× to 8×) for precise placement: the SVG's viewBox and a matching CSS transform on the `<img>` show the same part of the photo; markers keep their on-screen size; a pinch, Ctrl/trackpad wheel, the zoom buttons or `+`, `-` and `0` change it; when zoomed a one-finger drag pans. Page zoom is still allowed outside the photo." Rationale: "Placing an end point to within a few image pixels is impossible with a fingertip on a whole photo; storing fractions (D6) means zoom needs no data change."
- `docs/architecture.md`, "Measuring" section: one line on zoom and pan, and that `src/lib/zoom.ts` holds the view maths. Add `src/lib/zoom.ts` to the project layout list.
- `PLAN.md`: remove the "Pinch to zoom the photo" item from "Requested features" and add a line under "Done recently".
- `README.md`: in the Measurements bullet, add "zoom in for precise placement".

---

## Pitfalls (read before starting)

- **Pointer capture breaks taps.** Capture only once a gesture has become a pan. See Task 3.
- **Svelte event attributes may be passive.** Use `addEventListener(..., { passive: false })` in an `$effect` for `wheel` and the iOS `gesture*` events, and remove them in the effect's cleanup.
- **`suppressClick`** is the existing guard against a click right after a drag. Reuse it for pans and pinches; do not add a second flag.
- **The view must be clamped** after every change (`zoomAt` and `panBy` already do). Never assign a hand-built `View` except `FIT`.
- **`k` must include the scale**, or markers grow with the zoom.
- **Do not change** the accessible names of existing buttons and fields, the `Photo annotations` group, the `.annotation`, `.handle`, `.canvas img` and `.annotation text` selectors, or the viewport meta tag.
- Use `mise exec -- npm …` if `node` is not on the path; stop anything on port 4180 before browser tests (`lsof -ti :4180 | xargs kill`); never touch `./data`.

## Later (not part of this plan)

- **Magnifier loupe** while dragging a handle on a phone, because the fingertip hides the point. A circle near the finger showing the photo at 2× the current zoom around the point.
- **Pan automatically** when a dragged handle reaches the edge of the frame while zoomed.
- **Zoom to a measurement** chosen in the list.
