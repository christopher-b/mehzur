<script lang="ts">
	import { PASSWORD_MIN_LENGTH } from '#lib/constants.ts';

	let {
		label = 'New password',
		repeatLabel = 'Repeat the password'
	}: { label?: string; repeatLabel?: string } = $props();
</script>

<label>
	{label}
	<input type="password" name="password" minlength={PASSWORD_MIN_LENGTH} autocomplete="new-password" required />
</label>
<label>
	{repeatLabel}
	<input type="password" name="confirm" minlength={PASSWORD_MIN_LENGTH} autocomplete="new-password" required />
</label>
