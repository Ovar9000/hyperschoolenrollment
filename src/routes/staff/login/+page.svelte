<script lang="ts">
	import { enhance } from '$app/forms';
	import { PUBLIC_SCHOOL_NAME } from '$app/env/public';
	import seal120 from '#lib/assets/seal-120.webp';
	import seal240 from '#lib/assets/seal-240.webp';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Staff sign in — {PUBLIC_SCHOOL_NAME}</title>
</svelte:head>

<div class="login-wrap">
	<div class="card login-card">
		<img
			class="seal"
			src={seal120}
			srcset="{seal120} 1x, {seal240} 2x"
			width="80"
			height="80"
			alt=""
		/>
		<h1>Student Records</h1>
		<p class="hint">{PUBLIC_SCHOOL_NAME} · Staff only</p>

		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			{#if form?.error}<p class="form-error" role="alert">{form.error}</p>{/if}
			<div class="field">
				<label for="username">Username</label>
				<input
					id="username"
					name="username"
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					required
					value={form?.username ?? ''}
				/>
			</div>
			<div class="field">
				<label for="password">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
			</div>
			<div class="field">
				<button class="btn" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
			</div>
		</form>
	</div>
</div>
