<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDateTime, formatPeso, fullName } from '#lib/format.ts';
	import { PAYMENT_METHODS } from '#lib/enrollment.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let sel = $derived(data.selected);
	let due = $derived(sel?.assessment?.netDueCentavos ?? 0);
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Cashier · Staff</title>
</svelte:head>

<div class="page-bar">
	<div>
		<h1>Cashier</h1>
		<p class="muted">{data.termLabel ?? 'No term'} · {data.queue.length} waiting for payment</p>
	</div>
</div>

{#if form?.error}<p class="form-error" role="alert">{form.error}</p>{/if}
{#if form?.success}<p class="flash" role="status">{form.success}</p>{/if}

<div class="detail-grid">
	<section>
		<form class="filters" method="GET">
			<label>
				Find student
				<input type="search" name="q" value={data.q} placeholder="Reference no., LRN, or name" />
			</label>
			<button class="btn-sm primary">Search</button>
		</form>
		<div class="table-wrap">
			{#if data.queue.length === 0}
				<p class="empty">No assessed students waiting{data.q ? ' for that search' : ''}.</p>
			{:else}
				<table class="data">
					<thead>
						<tr
							><th>Name</th><th>Ref</th><th>Program</th><th class="num">Due</th><th>Assessed</th
							></tr
						>
					</thead>
					<tbody>
						{#each data.queue as a (a.id)}
							<tr class={{ selected: sel?.app.id === a.id }}>
								<td>
									<a class="row-link" href="?id={a.id}{data.q ? `&q=${data.q}` : ''}"
										>{a.lastName}, {a.firstName}</a
									>
								</td>
								<td class="mono">{a.refCode}</td>
								<td>{a.programCode}</td>
								<td class="num">{formatPeso(a.netDueCentavos)}</td>
								<td>{formatDateTime(a.issuedAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</section>

	<section class="panel next-step">
		{#if !sel}
			<h2>Payment</h2>
			<p class="muted">Choose a student from the list or search by reference number.</p>
		{:else}
			<h2>{fullName(sel.student)}</h2>
			<p class="muted">
				Ref <span class="mono">{sel.app.refCode}</span> · {sel.app.programCode}
				{sel.app.yearLevel} · {sel.app.sectionCode ?? 'no section'}
			</p>

			{#if sel.app.status === 'OFFICIAL'}
				<p>
					<strong>Officially enrolled.</strong> Student no.
					<span class="mono">{sel.studentNo}</span>
				</p>
				<a class="btn-sm primary" href="/staff/print/{sel.app.id}" target="_blank" rel="noopener"
					>Print COR</a
				>
			{:else if sel.app.status !== 'ASSESSED' || !sel.assessment}
				<p class="warn">This student isn't assessed yet. Send them to the Registrar.</p>
			{:else}
				<table class="data lines">
					<tbody>
						{#each sel.lines as l (l.code)}
							<tr><td>{l.label}</td><td class="num">{formatPeso(l.amountCentavos)}</td></tr>
						{/each}
					</tbody>
				</table>
				<dl class="kv">
					<dt>Total</dt>
					<dd>{formatPeso(sel.assessment.totalCentavos)}</dd>
					<dt>Covered by FHE</dt>
					<dd>− {formatPeso(sel.assessment.fheCoveredCentavos)}</dd>
					<dt>Amount due</dt>
					<dd class="due">{formatPeso(due)}</dd>
				</dl>

				<form
					method="POST"
					action="?id={sel.app.id}&/pay"
					use:enhance={() => {
						submitting = true;
						return async ({ update }) => {
							await update({ reset: false });
							submitting = false;
						};
					}}
				>
					<input type="hidden" name="id" value={sel.app.id} />
					{#if due === 0}
						<input type="hidden" name="zeroDue" value="yes" />
						<p>Nothing to pay. Confirm to make the enrollment official.</p>
					{:else}
						<div class="field">
							<label for="orNumber">Official receipt (OR) number</label>
							<input id="orNumber" name="orNumber" required autocomplete="off" class="mono" />
						</div>
						<div class="field">
							<label for="amount">Amount received (₱)</label>
							<input
								id="amount"
								name="amount"
								inputmode="decimal"
								required
								value={(due / 100).toFixed(2)}
							/>
						</div>
						<div class="field">
							<label for="method">Paid through</label>
							<select id="method" name="method" required>
								{#each PAYMENT_METHODS as m (m.value)}
									<option value={m.value}>{m.label}</option>
								{/each}
							</select>
						</div>
					{/if}
					<div class="field">
						<button class="btn-sm primary" disabled={submitting}>
							{due === 0 ? 'Confirm enrollment' : 'Record payment and enroll'}
						</button>
					</div>
				</form>
			{/if}
		{/if}
	</section>
</div>
