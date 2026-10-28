<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { PUBLIC_SCHOOL_NAME } from '$app/env/public';
	import { LRN_PATTERN, ageOn } from '#lib/validation.ts';
	import { FIELDS, type Field } from './fields.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The draft holds personal data on a possibly shared phone: expire it, clear it on submit.
	const DRAFT_KEY = 'enroll-draft-v1';
	const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

	const empty = Object.fromEntries(FIELDS.map((k) => [k, ''])) as Record<Field, string>;

	// Without JS a failed submit re-renders the page with `form.values`; capture them once.
	// With JS the bound inputs already hold what the student typed, so not tracking `form` is intended.
	// svelte-ignore state_referenced_locally
	let values = $state<Record<Field, string>>({ ...empty, mode: 'BLOCK', ...form?.values });
	let submitting = $state(false);

	let isMinor = $derived(
		/^\d{4}-\d{2}-\d{2}$/.test(values.birthdate) && ageOn(values.birthdate, data.today) < 18
	);
	let errors = $derived(form?.errors ?? {});

	onMount(() => {
		if (form?.values) return;
		try {
			const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
			if (saved && Date.now() - saved.savedAt < DRAFT_TTL_MS) Object.assign(values, saved.values);
			else localStorage.removeItem(DRAFT_KEY);
		} catch {
			// storage blocked or corrupt; the form still works
		}
	});

	// Runs in response to typing, so it belongs in an event handler, not an $effect.
	function saveDraft() {
		try {
			localStorage.setItem(
				DRAFT_KEY,
				JSON.stringify({ savedAt: Date.now(), values: $state.snapshot(values) })
			);
		} catch {
			// quota exceeded / private mode
		}
	}
</script>

<svelte:head>
	<title>Enrollment form — {PUBLIC_SCHOOL_NAME}</title>
</svelte:head>

<main>
	<h1>Enrollment form</h1>

	{#if !data.term}
		<p class="card">Enrollment is currently closed. Please check back later.</p>
	{:else}
		<p class="hint">{data.term.label} · New students (1st year)</p>

		<form
			method="POST"
			oninput={saveDraft}
			use:enhance={() => {
				submitting = true;
				return async ({ result, update }) => {
					if (result.type === 'redirect') {
						try {
							localStorage.removeItem(DRAFT_KEY);
						} catch {
							// ignore
						}
					}
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			{#if errors.form}<p class="error" role="alert">{errors.form}</p>{/if}

			<div class="card">
				<label>
					<input type="checkbox" name="consent" value="yes" required />
					I have read the <a href="/privacy">Privacy Notice</a> and consent to {PUBLIC_SCHOOL_NAME}
					processing my personal data for enrollment (RA 10173).
				</label>
				{#if errors.consent}<p class="error">{errors.consent}</p>{/if}
			</div>

			<label for="lrn">LRN (Learner Reference Number)</label>
			<input
				id="lrn"
				name="lrn"
				inputmode="numeric"
				pattern={LRN_PATTERN}
				maxlength="12"
				autocomplete="off"
				required
				bind:value={values.lrn}
			/>
			<p class="hint">12 digits, printed on your SF9 / Report Card</p>
			{#if errors.lrn}<p class="error">{errors.lrn}</p>{/if}

			<p class="hint">Write your name exactly as it appears on your PSA birth certificate.</p>
			<label for="last_name">Last name</label>
			<input
				id="last_name"
				name="last_name"
				autocomplete="family-name"
				required
				bind:value={values.last_name}
			/>
			{#if errors.last_name}<p class="error">{errors.last_name}</p>{/if}

			<label for="first_name">First name</label>
			<input
				id="first_name"
				name="first_name"
				autocomplete="given-name"
				required
				bind:value={values.first_name}
			/>
			{#if errors.first_name}<p class="error">{errors.first_name}</p>{/if}

			<label for="middle_name">Middle name <span class="hint">(if any)</span></label>
			<input
				id="middle_name"
				name="middle_name"
				autocomplete="additional-name"
				bind:value={values.middle_name}
			/>

			<label for="suffix">Suffix <span class="hint">(Jr., III — if any)</span></label>
			<input id="suffix" name="suffix" autocomplete="honorific-suffix" bind:value={values.suffix} />

			<label for="sex">Sex at birth</label>
			<select id="sex" name="sex" required bind:value={values.sex}>
				<option value="" disabled>Select</option>
				<option value="F">Female</option>
				<option value="M">Male</option>
			</select>
			{#if errors.sex}<p class="error">{errors.sex}</p>{/if}

			<label for="birthdate">Birthdate</label>
			<input
				id="birthdate"
				name="birthdate"
				type="date"
				autocomplete="bday"
				max={data.today}
				required
				bind:value={values.birthdate}
			/>
			{#if errors.birthdate}<p class="error">{errors.birthdate}</p>{/if}

			{#if isMinor}
				<label for="guardian_name">Parent / guardian full name</label>
				<input id="guardian_name" name="guardian_name" required bind:value={values.guardian_name} />
				<p class="hint">You are under 18, so your parent or guardian must also consent.</p>
				{#if errors.guardian_name}<p class="error">{errors.guardian_name}</p>{/if}
			{/if}

			<label for="mobile">Mobile number</label>
			<input
				id="mobile"
				name="mobile"
				type="tel"
				inputmode="tel"
				autocomplete="tel"
				placeholder="09XXXXXXXXX"
				required
				bind:value={values.mobile}
			/>
			{#if errors.mobile}<p class="error">{errors.mobile}</p>{/if}

			<label for="email">Email <span class="hint">(optional)</span></label>
			<input id="email" name="email" type="email" autocomplete="email" bind:value={values.email} />

			<label for="program">Program</label>
			<select id="program" name="program" required bind:value={values.program}>
				<option value="" disabled>Select a program</option>
				{#each data.programs as p (p.code)}
					<option value={p.code}>{p.code} — {p.name}</option>
				{/each}
			</select>
			{#if errors.program}<p class="error">{errors.program}</p>{/if}

			<fieldset class="card">
				<legend>Enrollment type</legend>
				<label>
					<input type="radio" name="mode" value="BLOCK" bind:group={values.mode} />
					Regular — take the full block schedule (recommended)
				</label>
				<label>
					<input type="radio" name="mode" value="IRREGULAR" bind:group={values.mode} />
					Irregular / transferee — the Registrar will build my schedule
				</label>
				{#if errors.mode}<p class="error">{errors.mode}</p>{/if}
			</fieldset>

			<button disabled={submitting}>{submitting ? 'Submitting…' : 'Submit enrollment'}</button>
		</form>
	{/if}
</main>

<style>
	fieldset {
		border: none;
	}
	legend {
		font-weight: 600;
	}
</style>
