import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
import { onDestroy } from 'svelte';
import { UploadQueue } from './uploads.svelte.ts';

/**
 * An upload queue for a page that adds photos to a project (call it while the component is set up).
 * When every file made it, the page goes straight to the first new photo to start measuring; otherwise
 * it stays so the list of failures stays visible. Leaving the page cancels what is still uploading,
 * after asking first.
 */
export function createPageUploads(projectId: () => string) {
	const uploads = new UploadQueue(projectId, async (items) => {
		if (items.some((i) => i.status === 'uploaded')) {
			try {
				await invalidateAll();
			} catch {
				// Offline right after uploading: the list still shows what happened.
				return;
			}
		}
		if (items.length && items.every((i) => i.status === 'uploaded')) {
			await goto(`/p/${projectId()}/photo/${items[0].photoId}`);
		}
	});
	onDestroy(() => uploads.destroy());
	beforeNavigate(({ cancel, willUnload }) => {
		if (!uploads.busy) return;
		// Closing the tab or reloading gets the browser's own prompt; in-app links get ours.
		if (willUnload || !confirm('Photos are still uploading. Leave anyway?')) cancel();
	});
	return uploads;
}
