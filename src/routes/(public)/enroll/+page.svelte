<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { PUBLIC_SCHOOL_NAME } from '$app/env/public';
	import CheckIcon from '#lib/components/CheckIcon.svelte';
	import { LRN_PATTERN, ageOn, isLrn, normalizeMobile } from '#lib/validation.ts';
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
	let consented = $state(false);
	let submitting = $state(false);

	let errors = $derived(form?.errors ?? {});
	let validBirthdate = $derived(/^\d{4}-\d{2}-\d{2}$/.test(values.birthdate));
	let isMinor = $derived(validBirthdate && ageOn(values.birthdate, data.today) < 18);

	let sections = $derived([
		{ id: 'consent', label: 'Privacy consent', done: consented },
		{ id: 'learner', label: 'Learner reference number', done: isLrn(values.lrn) },
		{
			id: 'personal',
			label: 'Personal details',
			done:
				!!values.last_name.trim() &&
				!!values.first_name.trim() &&
				!!values.sex &&
				validBirthdate &&
				(!isMinor || !!values.guardian_name.trim())
		},
		{ id: 'contact', label: 'Contact', done: normalizeMobile(values.mobile) !== null },
		{ id: 'program', label: 'Program', done: !!values.program && !!values.mode }
	]);
	let doneCount = $derived(sections.filter((s) => s.done).length);
	let programName = $derived(data.programs.find((p) => p.code === values.program)?.name);

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

	const invalid = (field: keyof typeof errors) => (errors[field] ? 'true' : undefined);
</script>

<svelte:head>
	<title>Enrollment form — {PUBLIC_SCHOOL_NAME}</title>
</svelte:head>

{#snippet badge(index: number)}
	<span class={['step-badge', sections[index]?.done && 'done']}>
		{#if sections[index]?.done}<CheckIcon size={14} />{:else}{index + 1}{/if}
	</span>
{/snippet}

{#snippet fieldError(field: keyof typeof errors)}
	{#if errors[field]}<p class="error" id="{field}-error">{errors[field]}</p>{/if}
{/snippet}

<main>
	<div class="container">
		<div class="page-head">
			<h1>Enrollment form</h1>
			{#if data.term}
				<span class="term-chip">{data.term.label} · 1st year</span>
			{/if}
		</div>

		{#if !data.term}
			<div class="card">
				<h2>Enrollment is closed</h2>
				<p class="muted">Please check back when the next enrollment period opens.</p>
			</div>
		{:else}
			<div class="form-layout">
				<form
					id="enroll-form"
					class="form-stack"
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
					{#if errors.form}<p class="form-error" role="alert">{errors.form}</p>{/if}

					<section class="form-section" aria-labelledby="s-consent">
						<header>
							{@render badge(0)}
							<h2 id="s-consent">Privacy consent</h2>
						</header>
						<label class="consent">
							<input
								type="checkbox"
								name="consent"
								value="yes"
								required
								bind:checked={consented}
								aria-invalid={invalid('consent')}
							/>
							<span>
								I have read the <a href="/privacy">Privacy Notice</a> and consent to
								{PUBLIC_SCHOOL_NAME} processing my personal data for enrollment (RA 10173).
							</span>
						</label>
						{@render fieldError('consent')}
					</section>

					<section class="form-section" aria-labelledby="s-learner">
						<header>
							{@render badge(1)}
							<h2 id="s-learner">Learner reference number</h2>
						</header>
						<div class="field">
							<label for="lrn">LRN</label>
							<input
								id="lrn"
								name="lrn"
								inputmode="numeric"
								pattern={LRN_PATTERN}
								maxlength="12"
								autocomplete="off"
								placeholder="123456789012"
								required
								bind:value={values.lrn}
								aria-invalid={invalid('lrn')}
								aria-describedby="lrn-hint"
							/>
							<p class="hint" id="lrn-hint">12 digits, printed on your SF9 / Report Card.</p>
							{@render fieldError('lrn')}
						</div>
					</section>

					<section class="form-section" aria-labelledby="s-personal">
						<header>
							{@render badge(2)}
							<h2 id="s-personal">Personal details</h2>
						</header>
						<p class="hint">Write your name exactly as it appears on your PSA birth certificate.</p>
						<div class="field-grid">
							<div class="field">
								<label for="last_name">Last name</label>
								<input
									id="last_name"
									name="last_name"
									autocomplete="family-name"
									required
									bind:value={values.last_name}
									aria-invalid={invalid('last_name')}
								/>
								{@render fieldError('last_name')}
							</div>
							<div class="field">
								<label for="first_name">First name</label>
								<input
									id="first_name"
									name="first_name"
									autocomplete="given-name"
									required
									bind:value={values.first_name}
									aria-invalid={invalid('first_name')}
								/>
								{@render fieldError('first_name')}
							</div>
							<div class="field">
								<label for="middle_name">Middle name <span class="optional">(if any)</span></label>
								<input
									id="middle_name"
									name="middle_name"
									autocomplete="additional-name"
									bind:value={values.middle_name}
								/>
							</div>
							<div class="field">
								<label for="suffix">Suffix <span class="optional">(Jr., III)</span></label>
								<input
									id="suffix"
									name="suffix"
									autocomplete="honorific-suffix"
									bind:value={values.suffix}
								/>
							</div>
							<div class="field">
								<label for="sex">Sex at birth</label>
								<select
									id="sex"
									name="sex"
									required
									bind:value={values.sex}
									aria-invalid={invalid('sex')}
								>
									<option value="" disabled>Select</option>
									<option value="F">Female</option>
									<option value="M">Male</option>
								</select>
								{@render fieldError('sex')}
							</div>
							<div class="field">
								<label for="birthdate">Birthdate</label>
								<input
									id="birthdate"
									name="birthdate"
									type="date"
									autocomplete="bday"
									max={data.today}
									required
									bind:value={values.birthdate}
									aria-invalid={invalid('birthdate')}
								/>
								{@render fieldError('birthdate')}
							</div>
							{#if isMinor}
								<div class="field span-2">
									<label for="guardian_name">Parent / guardian full name</label>
									<input
										id="guardian_name"
										name="guardian_name"
										required
										bind:value={values.guardian_name}
										aria-invalid={invalid('guardian_name')}
										aria-describedby="guardian-hint"
									/>
									<p class="hint" id="guardian-hint">
										You are under 18, so your parent or guardian must also consent.
									</p>
									{@render fieldError('guardian_name')}
								</div>
							{/if}
						</div>
					</section>

					<section class="form-section" aria-labelledby="s-contact">
						<header>
							{@render badge(3)}
							<h2 id="s-contact">Contact</h2>
						</header>
						<div class="field-grid">
							<div class="field">
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
									aria-invalid={invalid('mobile')}
								/>
								{@render fieldError('mobile')}
							</div>
							<div class="field">
								<label for="email">Email <span class="optional">(optional)</span></label>
								<input
									id="email"
									name="email"
									type="email"
									autocomplete="email"
									placeholder="juan@example.com"
									bind:value={values.email}
								/>
							</div>
						</div>
					</section>

					<section class="form-section" aria-labelledby="s-program">
						<header>
							{@render badge(4)}
							<h2 id="s-program">Program</h2>
						</header>
						<div class="field">
							<label for="program">Program</label>
							<select
								id="program"
								name="program"
								required
								bind:value={values.program}
								aria-invalid={invalid('program')}
							>
								<option value="" disabled>Select a program</option>
								{#each data.programs as p (p.code)}
									<option value={p.code}>{p.code} — {p.name}</option>
								{/each}
							</select>
							{@render fieldError('program')}
						</div>
						<fieldset class="choice-group">
							<legend class="sr-only">Enrollment type</legend>
							<div class="choices">
								<label class="choice">
									<input type="radio" name="mode" value="BLOCK" bind:group={values.mode} />
									<div>
										<strong>Regular <span class="recommend">Recommended</span></strong>
										<span class="desc"
											>Full block schedule. Your section is assigned right away.</span
										>
									</div>
								</label>
								<label class="choice">
									<input type="radio" name="mode" value="IRREGULAR" bind:group={values.mode} />
									<div>
										<strong>Irregular / transferee</strong>
										<span class="desc">The Registrar will build your schedule with you.</span>
									</div>
								</label>
							</div>
							{@render fieldError('mode')}
						</fieldset>
					</section>

					<div class="submit-row mobile-only">
						<progress max={sections.length} value={doneCount}
							>{doneCount} of {sections.length}</progress
						>
						<p>{doneCount} of {sections.length} sections complete</p>
						<button class="btn" disabled={submitting}>
							{submitting ? 'Submitting…' : 'Submit enrollment'}
						</button>
					</div>
				</form>

				<aside class="summary card" aria-label="Enrollment summary">
					<h2>Your enrollment</h2>
					<dl>
						<div>
							<dt>Term</dt>
							<dd>{data.term.label}</dd>
						</div>
						<div>
							<dt>Program</dt>
							<dd>{programName ?? 'Not selected yet'}</dd>
						</div>
						<div>
							<dt>Type</dt>
							<dd>
								{values.mode === 'IRREGULAR' ? 'Irregular / transferee' : 'Regular (block section)'}
							</dd>
						</div>
					</dl>
					<ul class="progress-list">
						{#each sections as s (s.id)}
							<li class={{ done: s.done }}>
								<span class="dot"
									>{#if s.done}<CheckIcon size={10} />{/if}</span
								>{s.label}
							</li>
						{/each}
					</ul>
					<button class="btn" form="enroll-form" disabled={submitting}>
						{submitting ? 'Submitting…' : 'Submit enrollment'}
					</button>
					<p class="hint">Your answers are saved on this device until you submit.</p>
				</aside>
			</div>
		{/if}
	</div>
</main>
