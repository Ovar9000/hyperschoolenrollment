<script lang="ts">
	import { enhance } from '$app/forms';
	import { STATUS_LABELS, formatDateTime, formatPeso, fullName } from '#lib/format.ts';
	import { FHE_OPTIONS, REQUIREMENTS } from '#lib/enrollment.ts';
	import { formatMeetings } from '#lib/schedule.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let app = $derived(data.app);
	let totalUnits = $derived(data.classes.reduce((sum, c) => sum + c.units, 0));
	let editable = $derived(
		data.canEdit && (app.status === 'SUBMITTED' || app.status === 'PROVISIONAL')
	);
	let missing = $derived(data.requirements.filter((r) => !r.receivedAt).length);
	let printable = $derived(app.status === 'ASSESSED' || app.status === 'OFFICIAL');

	const sectionCode = (id: unknown) => data.sections.find((s) => s.id === id)?.code ?? 'a section';
	const reqLabel = (kind: unknown) => REQUIREMENTS.find((r) => r.kind === kind)?.label ?? kind;
	const fheLabel = (v: unknown) => FHE_OPTIONS.find((o) => o.value === v)?.label ?? v;

	function describe(type: string, d: Record<string, unknown>): string {
		switch (type) {
			case 'core.person.registered.v1':
				return 'Person record created';
			case 'enrollment.application.submitted.v1':
				return 'Application submitted online';
			case 'enrollment.application.accepted.v1':
				return 'Accepted as provisional';
			case 'enrollment.section.assigned.v1':
				return `Placed in ${sectionCode(d.sectionId)}`;
			case 'enrollment.requirement.updated.v1':
				return `${reqLabel(d.kind)} ${d.received ? 'received' : 'marked not received'}`;
			case 'enrollment.application.assessed.v1':
				return `Assessed: ${fheLabel(d.fheStatus)} · ${formatPeso(Number(d.netDueCentavos))} due`;
			case 'enrollment.assessment.reverted.v1':
				return 'Assessment undone';
			case 'records.student.admitted.v1':
				return `Student number ${d.studentNo} issued`;
			case 'enrollment.application.officially_enrolled.v1':
				return d.orNumber
					? `Officially enrolled · OR ${d.orNumber}`
					: 'Officially enrolled · ₱0 due';
			case 'enrollment.application.cancelled.v1':
				return 'Application cancelled';
			default:
				return type;
		}
	}
</script>

<svelte:head>
	<title>{data.student.lastName}, {data.student.firstName} · Applications</title>
</svelte:head>

<p><a href="/staff/applications">← Applications</a></p>

<div class="page-bar">
	<div>
		<h1>{fullName(data.student)}</h1>
		<p class="muted">
			Ref <span class="mono">{app.refCode}</span> · {app.termLabel} ·
			<span class="pill {app.status}">{STATUS_LABELS[app.status]}</span>
			{#if data.studentNo}· Student no. <span class="mono">{data.studentNo}</span>{/if}
		</p>
	</div>
	{#if printable}
		<a class="btn-sm" href="/staff/print/{app.id}" target="_blank" rel="noopener">
			{app.status === 'OFFICIAL' ? 'Print COR' : 'Print assessment slip'}
		</a>
	{/if}
</div>

{#if form?.error}<p class="form-error" role="alert">{form.error}</p>{/if}
{#if form?.success}<p class="flash" role="status">{form.success}</p>{/if}

<div class="detail-grid">
	<div>
		<section class="panel next-step">
			<h2>Next step</h2>
			{#if app.status === 'SUBMITTED'}
				<p>Check the student's details, then accept the application.</p>
				{#if data.canEdit}
					<form method="POST" action="?/accept" use:enhance>
						<button class="btn-sm primary">Accept as provisional</button>
					</form>
				{/if}
			{:else if app.status === 'PROVISIONAL'}
				{#if !data.currentSectionId}
					<p>Place the student in a section below, then issue the assessment.</p>
				{:else if data.canEdit && data.preview.length > 0}
					<p>Choose the student's Free Higher Education status and issue the assessment.</p>
					<table class="data lines">
						<thead><tr><th>Fee</th><th class="num">Amount</th><th>FHE covers</th></tr></thead>
						<tbody>
							{#each data.preview[0]?.lines ?? [] as l (l.code)}
								<tr>
									<td>{l.label}</td>
									<td class="num">{formatPeso(l.amountCentavos)}</td>
									<td>{l.fheCovered ? 'Yes' : 'No'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<form method="POST" action="?/assess" use:enhance class="fhe-form">
						<fieldset>
							<legend>FHE status</legend>
							{#each data.preview as p, i (p.value)}
								<label class="fhe-option">
									<input type="radio" name="fheStatus" value={p.value} checked={i === 0} />
									<span>{p.label}</span>
									<strong>{formatPeso(p.netDueCentavos)} due</strong>
								</label>
							{/each}
						</fieldset>
						<button class="btn-sm primary">Issue assessment</button>
					</form>
				{:else}
					<p>Waiting for the Registrar to issue the assessment.</p>
				{/if}
			{:else if app.status === 'ASSESSED' && data.assessment}
				<dl class="kv">
					<dt>Total fees</dt>
					<dd>{formatPeso(data.assessment.totalCentavos)}</dd>
					<dt>Covered by FHE</dt>
					<dd>− {formatPeso(data.assessment.fheCoveredCentavos)}</dd>
					<dt>Amount due</dt>
					<dd class="due">{formatPeso(data.assessment.netDueCentavos)}</dd>
				</dl>
				<p class="muted">Waiting for the student to settle at the Cashier.</p>
				{#if data.canEdit}
					<form method="POST" action="?/revert" use:enhance>
						<button class="btn-sm">Undo assessment</button>
					</form>
				{/if}
			{:else if app.status === 'OFFICIAL'}
				<p>
					<strong>Officially enrolled.</strong> Student number
					<span class="mono">{data.studentNo}</span>.
					{#each data.payments as p (p.orNumber)}
						OR <span class="mono">{p.orNumber}</span> · {formatPeso(p.amountCentavos)} ({formatDateTime(
							p.paidAt
						)}).
					{:else}
						No payment was due.
					{/each}
				</p>
				{#if missing > 0}
					<p class="warn">
						{missing} original document{missing === 1 ? '' : 's'} still missing. The student can't enroll
						next semester until they're submitted.
					</p>
				{/if}
			{:else if app.status === 'CANCELLED'}
				<p>Cancelled. Seats were released.</p>
			{/if}
		</section>

		<section class="panel">
			<div class="panel-head">
				<h2>
					Section {app.sectionCode ?? '— not assigned'} · {data.classes.length} subjects · {totalUnits}
					units
				</h2>
				{#if editable}
					<form method="POST" action="?/section" use:enhance class="inline-form">
						<label class="sr-only" for="sectionId">Section</label>
						<select id="sectionId" name="sectionId" required>
							<option value="">Choose section…</option>
							{#each data.sections as s (s.id)}
								<option
									value={s.id}
									disabled={s.id === data.currentSectionId || s.enrolled >= s.capacity}
								>
									{s.code} · {s.capacity - s.enrolled} slots left
								</option>
							{/each}
						</select>
						<button class="btn-sm">{data.currentSectionId ? 'Move' : 'Assign'}</button>
					</form>
				{/if}
			</div>
			{#if data.classes.length === 0}
				<p class="muted">No classes yet.</p>
			{:else}
				<table class="data">
					<thead>
						<tr><th>Subject</th><th>Schedule</th><th>Professor</th><th class="num">Units</th></tr>
					</thead>
					<tbody>
						{#each data.classes as c (c.id)}
							<tr>
								<td
									><strong>{c.subjectCode}</strong><br /><span class="muted">{c.subjectTitle}</span
									></td
								>
								<td>
									{#each formatMeetings(c.meetings) as line (line)}<div>{line}</div>{/each}
								</td>
								<td>{c.faculty ?? 'TBA'}</td>
								<td class="num">{c.units}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>

		<section class="panel">
			<h2>Enrollment</h2>
			<dl class="kv">
				<dt>Program</dt>
				<dd>{app.programCode} — {app.programName}</dd>
				<dt>Year level</dt>
				<dd>{app.yearLevel}</dd>
				<dt>Type</dt>
				<dd>{app.mode === 'BLOCK' ? 'Regular (block)' : 'Irregular / transferee'}</dd>
				<dt>FHE</dt>
				<dd>
					{app.fheStatus === 'PENDING' ? 'Not assessed yet' : fheLabel(app.fheStatus)}
					{#if !data.fheEligible}<span class="muted">(program not FHE-eligible)</span>{/if}
				</dd>
			</dl>
		</section>
	</div>

	<div>
		<section class="panel">
			<h2>Original documents {missing === 0 ? '✓' : `· ${missing} missing`}</h2>
			<ul class="req-list">
				{#each data.requirements as r (r.kind)}
					<li class={{ done: !!r.receivedAt }}>
						<div>
							<strong>{r.label}</strong>
							<span class="muted">
								{r.receivedAt ? `Received ${formatDateTime(r.receivedAt)}` : r.note}
							</span>
						</div>
						{#if data.canEdit && app.status !== 'CANCELLED'}
							<form method="POST" action="?/requirement" use:enhance>
								<input type="hidden" name="kind" value={r.kind} />
								<input type="hidden" name="received" value={r.receivedAt ? 'no' : 'yes'} />
								<button class="btn-sm">{r.receivedAt ? 'Undo' : 'Received'}</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<section class="panel">
			<h2>Student</h2>
			<dl class="kv">
				{#each data.identifiers as id (id.scheme)}
					<dt>
						{id.scheme === 'LRN' ? 'LRN' : id.scheme === 'STUDENT_NO' ? 'Student no.' : id.scheme}
					</dt>
					<dd class="mono">{id.value}</dd>
				{/each}
				<dt>Sex at birth</dt>
				<dd>
					{data.student.sexAtBirth === 'F'
						? 'Female'
						: data.student.sexAtBirth === 'M'
							? 'Male'
							: '—'}
				</dd>
				<dt>Birthdate</dt>
				<dd>{data.student.birthdate ?? '—'}</dd>
				<dt>Mobile</dt>
				<dd>{data.student.mobile ?? '—'}</dd>
				<dt>Email</dt>
				<dd>{data.student.email ?? '—'}</dd>
			</dl>
		</section>

		<section class="panel">
			<h2>Consent (RA 10173)</h2>
			{#each data.consents as c (c.id)}
				<dl class="kv">
					<dt>Given</dt>
					<dd>{formatDateTime(c.grantedAt)}</dd>
					<dt>Notice version</dt>
					<dd>{c.noticeVersion}</dd>
					{#if c.guardianName}
						<dt>Guardian</dt>
						<dd>{c.guardianName}</dd>
					{/if}
				</dl>
			{:else}
				<p class="muted">No consent on record.</p>
			{/each}
		</section>

		<section class="panel">
			<h2>History</h2>
			<ol class="timeline">
				{#each data.timeline as e (e.seq)}
					<li>
						<time>{formatDateTime(e.time)}{e.by ? ` · ${e.by}` : ''}</time>
						{describe(e.type, e.detail)}
					</li>
				{/each}
			</ol>
		</section>

		{#if data.canEdit && app.status !== 'OFFICIAL' && app.status !== 'CANCELLED'}
			<details class="panel danger-zone">
				<summary>Cancel this application</summary>
				<form method="POST" action="?/cancel" use:enhance>
					<div class="field">
						<label for="reason">Reason</label>
						<input
							id="reason"
							name="reason"
							required
							placeholder="Withdrew, duplicate, transferred…"
						/>
					</div>
					<div class="field">
						<button class="btn-sm danger">Cancel application and release seats</button>
					</div>
				</form>
			</details>
		{/if}
	</div>
</div>
