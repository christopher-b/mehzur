<script lang="ts">
	import FormError from '#lib/components/ui/FormError.svelte';
	import PasswordPair from '#lib/components/ui/PasswordPair.svelte';
	import { NAME_MAX_LENGTH } from '#lib/constants.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Set up · Mehzur</title></svelte:head>

<div class="auth">
	<h1>Set up Mehzur</h1>
	<p>Create the administrator account. You need the app's setup password (<code>APP_PASSWORD</code>).</p>
	<form method="POST">
		<label>
			Setup password
			<input type="password" name="setupPassword" autocomplete="off" required />
		</label>
		<label>
			Your name
			<input name="name" value={form?.name ?? ''} maxlength={NAME_MAX_LENGTH} autocomplete="name" required />
		</label>
		<label>
			Email
			<input type="email" name="email" value={form?.email ?? ''} autocomplete="username" required />
		</label>
		<PasswordPair />
		<FormError message={form?.error} />
		<button type="submit" class="primary">Create account</button>
	</form>
</div>
