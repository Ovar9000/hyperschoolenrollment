<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Change password · Staff</title>
</svelte:head>

<div class="page-bar">
	<div>
		<h1>Change password</h1>
		{#if data.mustChange}
			<p class="muted">Your account uses a temporary password. Set your own to continue.</p>
		{/if}
	</div>
</div>

<div class="panel narrow">
	<form method="POST" use:enhance>
		{#if form?.error}<p class="form-error" role="alert">{form.error}</p>{/if}
		<div class="field">
			<label for="current">Current password</label>
			<input id="current" name="current" type="password" autocomplete="current-password" required />
		</div>
		<div class="field">
			<label for="next">New password</label>
			<input
				id="next"
				name="next"
				type="password"
				autocomplete="new-password"
				minlength={data.minLength}
				required
				aria-describedby="next-hint"
			/>
			<p class="hint" id="next-hint">
				At least {data.minLength} characters. A short sentence is easier to remember than symbols.
			</p>
		</div>
		<div class="field">
			<label for="confirm">Confirm new password</label>
			<input
				id="confirm"
				name="confirm"
				type="password"
				autocomplete="new-password"
				minlength={data.minLength}
				required
			/>
		</div>
		<div class="field">
			<button class="btn-sm primary">Save password</button>
		</div>
	</form>
</div>
