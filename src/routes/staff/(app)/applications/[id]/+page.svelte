<script lang="ts">
	import { STATUS_LABELS, formatDateTime, fullName } from '#lib/format.ts';
	import { formatMeetings } from '#lib/schedule.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const EVENT_LABELS: Record<string, string> = {
		'core.person.registered.v1': 'Person record created',
		'enrollment.application.submitted.v1': 'Application submitted online'
	};

	let totalUnits = $derived(data.classes.reduce((sum, c) => sum + c.units, 0));
</script>

<svelte:head>
	<title>{data.student.lastName}, {data.student.firstName} · Applications</title>
</svelte:head>

<p><a href="/staff/applications">← Applications</a></p>

<div class="page-bar">
	<div>
		<h1>{fullName(data.student)}</h1>
		<p class="muted">
			Ref <span class="mono">{data.app.refCode}</span> · {data.app.termLabel} ·
			<span class="pill {data.app.status}">{STATUS_LABELS[data.app.status]}</span>
		</p>
	</div>
</div>

<div class="detail-grid">
	<div>
		<section class="panel">
			<h2>Enrollment</h2>
			<dl class="kv">
				<dt>Program</dt>
				<dd>{data.app.programCode} — {data.app.programName}</dd>
				<dt>Year level</dt>
				<dd>{data.app.yearLevel}</dd>
				<dt>Type</dt>
				<dd>{data.app.mode === 'BLOCK' ? 'Regular (block)' : 'Irregular / transferee'}</dd>
				<dt>Section</dt>
				<dd>{data.app.sectionCode ?? 'Not assigned yet'}</dd>
				<dt>Free tuition (RA 10931)</dt>
				<dd>{data.app.fheStatus.replaceAll('_', ' ').toLowerCase()}</dd>
				<dt>Submitted</dt>
				<dd>{formatDateTime(data.app.submittedAt)}</dd>
			</dl>
		</section>

		<section class="panel">
			<h2>Classes ({data.classes.length} subjects · {totalUnits} units)</h2>
			{#if data.classes.length === 0}
				<p class="muted">
					No classes yet. {data.app.mode === 'IRREGULAR'
						? 'Irregular students are scheduled by the Registrar.'
						: 'No block section had a free seat when this student applied.'}
				</p>
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
	</div>

	<div>
		<section class="panel">
			<h2>Student</h2>
			<dl class="kv">
				{#each data.identifiers as id (id.scheme)}
					<dt>{id.scheme === 'LRN' ? 'LRN' : id.scheme.replace('_', ' ').toLowerCase()}</dt>
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
						<time>{formatDateTime(e.time)}</time>
						{EVENT_LABELS[e.type] ?? e.type}
					</li>
				{/each}
			</ol>
		</section>
	</div>
</div>
