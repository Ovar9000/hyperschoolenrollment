<script lang="ts">
	import { PUBLIC_SCHOOL_NAME } from '$app/env/public';
	import type { Registration } from '#lib/server/enrollment/cor.ts';
	import { formatDateTime, formatPeso, fullName } from '#lib/format.ts';
	import { formatMeetings } from '#lib/schedule.ts';
	import seal96 from '#lib/assets/seal-96.webp';

	let { reg, printedAt }: { reg: Registration; printedAt: Date } = $props();

	let official = $derived(reg.app.status === 'OFFICIAL');
	let units = $derived(reg.classes.reduce((t, c) => t + c.units, 0));
	let paid = $derived(reg.payments.reduce((t, p) => t + p.amountCentavos, 0));
</script>

<article class="registration">
	<header class="reg-head">
		<img src={seal96} width="64" height="64" alt="" />
		<div>
			<strong>{PUBLIC_SCHOOL_NAME}</strong>
			<span>San Pascual, Masbate</span>
			<h1>{official ? 'Certificate of Registration' : 'Assessment Slip'}</h1>
			<span>{reg.app.termLabel}</span>
		</div>
	</header>

	{#if !official}
		<p class="reg-banner">
			Not yet officially enrolled. Present this slip at the Cashier to settle the amount due.
		</p>
	{/if}

	<dl class="reg-info">
		<div>
			<dt>Name</dt>
			<dd>{fullName(reg.student)}</dd>
		</div>
		<div>
			<dt>{official ? 'Student no.' : 'Reference no.'}</dt>
			<dd class="mono">{official ? reg.studentNo : reg.app.refCode}</dd>
		</div>
		<div>
			<dt>Program</dt>
			<dd>{reg.app.programCode} — {reg.app.programName}</dd>
		</div>
		<div>
			<dt>Year · Section</dt>
			<dd>{reg.app.yearLevel} · {reg.app.sectionCode ?? '—'}</dd>
		</div>
		<div>
			<dt>LRN</dt>
			<dd class="mono">{reg.lrn ?? '—'}</dd>
		</div>
		<div>
			<dt>Status</dt>
			<dd>{official ? 'Officially enrolled' : 'Assessed'}</dd>
		</div>
	</dl>

	<div class="reg-scroll">
		<table class="reg-table">
			<thead>
				<tr
					><th>Subject</th><th>Description</th><th>Schedule / Room</th><th>Instructor</th><th
						class="num">Units</th
					></tr
				>
			</thead>
			<tbody>
				{#each reg.classes as c (c.id)}
					<tr>
						<td class="nowrap">{c.subjectCode}</td>
						<td>{c.subjectTitle}</td>
						<td
							>{#each formatMeetings(c.meetings) as line (line)}<div>{line}</div>{/each}</td
						>
						<td>{c.faculty ?? 'TBA'}</td>
						<td class="num">{c.units}</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr><td colspan="4">Total units</td><td class="num">{units}</td></tr>
			</tfoot>
		</table>
	</div>

	{#if reg.assessment}
		<table class="reg-table fees">
			<thead><tr><th>Fees</th><th class="num">Amount</th></tr></thead>
			<tbody>
				{#each reg.lines as l (l.code)}
					<tr
						><td>{l.label}{l.fheCovered && reg.assessment.fheCoveredCentavos > 0 ? ' *' : ''}</td
						><td class="num">{formatPeso(l.amountCentavos)}</td></tr
					>
				{/each}
			</tbody>
			<tfoot>
				<tr
					><td>Total assessment</td><td class="num">{formatPeso(reg.assessment.totalCentavos)}</td
					></tr
				>
				{#if reg.assessment.fheCoveredCentavos > 0}
					<tr>
						<td>Less: Free Higher Education (RA 10931) *</td>
						<td class="num">− {formatPeso(reg.assessment.fheCoveredCentavos)}</td>
					</tr>
				{/if}
				<tr class="due"
					><td>Amount due</td><td class="num">{formatPeso(reg.assessment.netDueCentavos)}</td></tr
				>
				{#if official}
					<tr
						><td>Paid{reg.payments.map((p) => ` · OR ${p.orNumber}`).join('')}</td><td class="num"
							>{formatPeso(paid)}</td
						></tr
					>
				{/if}
			</tfoot>
		</table>
	{/if}

	<footer class="reg-foot">
		<div class="sign">
			<span></span>
			Registrar
		</div>
		<p>
			{#if official}Not valid without the Registrar's signature and the college dry seal.{/if}
			Printed {formatDateTime(printedAt)}.
		</p>
	</footer>
</article>
