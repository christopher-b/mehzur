<script lang="ts">
	import { statusLabel } from '#lib/client/upload-state.ts';
	import type { UploadQueue } from '#lib/client/uploads.svelte.ts';

	let { uploads }: { uploads: UploadQueue } = $props();

	let height = $state(0);
	const done = $derived(uploads.items.filter((i) => i.status === 'uploaded').length);
	const failed = $derived(uploads.items.filter((i) => i.status === 'failed' || i.status === 'not-uploaded').length);
	const summary = $derived(
		uploads.busy
			? `Uploading photos: ${done} of ${uploads.items.length} done`
			: `${done} of ${uploads.items.length} uploaded${failed ? `, ${failed} failed` : ''}`
	);

	// The page and the notifications make room for the overlay so nothing is hidden behind it.
	$effect(() => {
		document.documentElement.style.setProperty('--upload-overlay-height', `${height}px`);
		return () => document.documentElement.style.removeProperty('--upload-overlay-height');
	});
</script>

{#if uploads.items.length}
	<div class="overlay" bind:clientHeight={height}>
		<div class="uploads">
			<div class="head">
				<strong>{summary}</strong>
				{#if !uploads.busy}
					<button type="button" aria-label="Dismiss upload list" onclick={() => uploads.dismiss()}>Dismiss</button>
				{/if}
			</div>
			<ul>
				{#each uploads.items as item (item.id)}
					<li>
						<span class="name">{item.name}</span>
						<progress aria-label="Upload progress for {item.name}" max="100" value={Math.round(item.progress * 100)}></progress>
						<span class="status" class:error={item.status === 'failed'}>{statusLabel(item)}</span>
						{#if item.retryable && (item.status === 'failed' || item.status === 'not-uploaded')}
							<button type="button" aria-label="Retry {item.name}" onclick={() => uploads.retry(item.id)}>Retry</button>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	</div>
{/if}

<style>
	/* Fixed to the bottom of the window so progress stays in view however far the page is scrolled. */
	.overlay {
		position: fixed;
		inset: auto 0 0 0;
		z-index: 90;
		display: flex;
		justify-content: center;
		padding: 0 1rem calc(1rem + env(safe-area-inset-bottom));
		pointer-events: none;
	}
	.uploads {
		display: grid;
		gap: 0.5rem;
		width: min(40rem, 100%);
		max-height: 40vh;
		overflow-y: auto;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-menu);
		pointer-events: auto;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
	}
	.name {
		flex: 1 1 10rem;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	progress {
		flex: 0 1 8rem;
	}
	.status {
		color: var(--text-secondary);
	}
	.status.error {
		color: var(--danger);
	}
</style>
