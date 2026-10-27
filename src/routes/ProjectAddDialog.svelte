<script lang="ts">
	import ProjectForm from '#lib/components/ProjectForm.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import type { UnitSystem } from '#lib/units.ts';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let name = $state('');
	let unitSystem = $state<UnitSystem>('imperial');
	let error = $state('');
</script>

<Dialog
	bind:open
	title="Add a project"
	onopen={() => {
		name = '';
		unitSystem = 'imperial';
		error = '';
	}}
>
	{#snippet children(close)}
		<ProjectForm
			action="?/create"
			bind:name
			bind:unitSystem
			bind:error
			placeholder="e.g. 12 Elm St"
			submitLabel="Create"
			oncancel={close}
		/>
	{/snippet}
</Dialog>
