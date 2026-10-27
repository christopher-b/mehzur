<script lang="ts">
	import { onMount } from 'svelte';
	import { saveDraft, takeDraft } from '#lib/client/drafts.ts';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import RoomNameForm from './RoomNameForm.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let error = $state('');
	let name = $state('');

	// Back from signing in again: reopen the dialog with the name that was being typed.
	onMount(() => {
		const draft = takeDraft();
		if (draft?.kind !== 'room') return;
		name = draft.name;
		open = true;
	});
</script>

<Dialog bind:open title="Add a room" onopen={() => (error = '')}>
	{#snippet children(close)}
		<RoomNameForm
			action="?/createRoom"
			bind:name
			bind:error
			placeholder="e.g. Kitchen"
			submitLabel="Add room"
			onsession={() => saveDraft({ kind: 'room', name })}
			ondone={() => {
				name = '';
				close();
			}}
			oncancel={close}
		/>
	{/snippet}
</Dialog>
