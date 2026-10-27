<script lang="ts">
	import FormError from '#lib/components/ui/FormError.svelte';
	import PasswordPair from '#lib/components/ui/PasswordPair.svelte';
		import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>New password · Mehzur</title></svelte:head>

<div class="auth">
	<h1>Choose a new password</h1>
	{#if data.valid}
		<form method="POST">
			<PasswordPair />
			<FormError message={form?.error} />
			<button type="submit" class="primary">Set the password</button>
		</form>
	{:else}
		<p>This reset link is no longer valid. It may have expired or already been used.</p>
		<p><a href="/forgot">Ask for a new link</a></p>
	{/if}
</div>
