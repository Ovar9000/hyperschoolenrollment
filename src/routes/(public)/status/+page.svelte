<script lang="ts">
	import { enhance } from '$app/forms';
	import { PUBLIC_SCHOOL_NAME } from '$app/env/public';
	import Registration from '#lib/components/Registration.svelte';
	import PrintButton from '#lib/components/PrintButton.svelte';
	import CheckIcon from '#lib/components/CheckIcon.svelte';
	import { LRN_PATTERN } from '#lib/validation.ts';
	import { formatPeso } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	const STEPS = [
		{ status: 'SUBMITTED', label: 'Submitted' },
		{ status: 'PROVISIONAL', label: 'Accepted' },
		{ status: 'ASSESSED', label: 'Assessed' },
		{ status: 'OFFICIAL', label: 'Officially enrolled' }
	];

	let reg = $derived(form && 'reg' in form ? form.reg : null);
	let missing = $derived(form && 'missing' in form ? (form.missing ?? []) : []);
	let printedAt = $derived(
		(form && 'printedAt' in form ? form.printedAt : undefined) ?? new Date()
	);
	let stepIndex = $derived(reg ? STEPS.findIndex((s) => s.status === reg.app.status) : -1);
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Check enrollment status — {PUBLIC_SCHOOL_NAME}</title>
</svelte:head>

<main>
	<div class="container">
		{#if !reg}
			<div class="page-head">
				<h1>Check your enrollment status</h1>
				<p class="muted">Use the reference number you got when you submitted the form.</p>
			</div>
			<form
				class="form-section status-form"
				method="POST"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update({ reset: false });
						submitting = false;
					};
				}}
			>
				{#if form?.error}<p class="form-error" role="alert">{form.error}</p>{/if}
				<div class="field">
					<label for="ref">Reference number</label>
					<input
						id="ref"
						name="ref"
						autocapitalize="characters"
						autocomplete="off"
						maxlength="8"
						placeholder="7KX3QF9M"
						required
						class="mono"
						value={form?.values?.ref ?? ''}
					/>
				</div>
				<div class="field">
					<label for="lrn">LRN</label>
					<input
						id="lrn"
						name="lrn"
						inputmode="numeric"
						pattern={LRN_PATTERN}
						maxlength="12"
						autocomplete="off"
						required
						value={form?.values?.lrn ?? ''}
					/>
				</div>
				<div class="field">
					<label for="birthdate">Birthdate</label>
					<input
						id="birthdate"
						name="birthdate"
						type="date"
						autocomplete="bday"
						required
						value={form?.values?.birthdate ?? ''}
					/>
				</div>
				<div class="field">
					<button class="btn" disabled={submitting}
						>{submitting ? 'Checking…' : 'Check status'}</button
					>
				</div>
			</form>
		{:else}
			<div class="page-head no-print">
				<h1>Hi, {reg.student.firstName}</h1>
				<span class="term-chip">{reg.app.termLabel}</span>
			</div>

			{#if reg.app.status === 'CANCELLED'}
				<div class="card no-print">
					<h2>This application was cancelled</h2>
					<p class="muted">Please visit the Registrar's Office if you think this is a mistake.</p>
				</div>
			{:else}
				<ol class="tracker no-print" aria-label="Enrollment progress">
					{#each STEPS as s, i (s.status)}
						<li class={{ done: i <= stepIndex, current: i === stepIndex }}>
							<span class="dot"
								>{#if i <= stepIndex}<CheckIcon size={12} />{/if}</span
							>
							{s.label}
						</li>
					{/each}
				</ol>

				<div class="card no-print">
					<h2>What to do next</h2>
					{#if reg.app.status === 'SUBMITTED' || reg.app.status === 'PROVISIONAL'}
						<p>
							The Registrar is reviewing your application{reg.app.sectionCode
								? ` (section ${reg.app.sectionCode})`
								: ''}. Your assessment will appear here once it's issued.
						</p>
					{:else if reg.app.status === 'ASSESSED' && reg.assessment}
						<p>
							Your amount due is <strong>{formatPeso(reg.assessment.netDueCentavos)}</strong>.
							{reg.assessment.netDueCentavos > 0
								? 'Pay at the Cashier and bring this assessment slip.'
								: 'Nothing to pay. Visit the Cashier to confirm your enrollment.'}
						</p>
					{:else if reg.app.status === 'OFFICIAL'}
						<p>
							You're officially enrolled. Your student number is
							<strong class="mono">{reg.studentNo}</strong>. Print or save your Certificate of
							Registration below.
						</p>
					{/if}

					{#if missing.length > 0}
						<div class="callout">
							<p><strong>Original documents still needed by the Registrar:</strong></p>
							<ul>
								{#each missing as m (m.label)}
									<li>{m.label} <span class="muted">({m.note})</span></li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>

				{#if reg.app.status === 'ASSESSED' || reg.app.status === 'OFFICIAL'}
					<div class="print-bar">
						<PrintButton
							label={reg.app.status === 'OFFICIAL'
								? 'Print / save COR'
								: 'Print / save assessment slip'}
						/>
					</div>
					<Registration {reg} {printedAt} />
				{/if}
			{/if}
			<p class="no-print"><a href="/status">← Check another</a></p>
		{/if}
	</div>
</main>
