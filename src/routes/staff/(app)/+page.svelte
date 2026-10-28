<script lang="ts">
	import { STATUS_LABELS, formatDateTime } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Dashboard · Staff</title>
</svelte:head>

{#if !data.term}
	<h1>Dashboard</h1>
	<p class="muted">No terms set up yet. Run <code>npm run db:seed</code> for sample data.</p>
{:else}
	<div class="page-bar">
		<div>
			<h1>Dashboard</h1>
			<p class="muted">
				{data.term.label} · Enrollment {data.term.open ? 'open' : 'closed'}
			</p>
		</div>
		<a class="btn-sm" href="/staff/applications">View all applications</a>
	</div>

	<div class="stats">
		<a class="stat" href="/staff/applications">
			<div class="label">All applications</div>
			<div class="value">{data.total}</div>
		</a>
		{#each Object.entries(data.byStatus) as [status, n] (status)}
			<a class="stat" href="/staff/applications?status={status}">
				<div class="label">{STATUS_LABELS[status]}</div>
				<div class="value">{n}</div>
			</a>
		{/each}
		<a class="stat" href="/staff/applications?section=none">
			<div class="label">Needs a section</div>
			<div class="value">{data.needsSection}</div>
		</a>
	</div>

	<div class="detail-grid">
		<section class="panel">
			<h2>Latest applications</h2>
			{#if data.recent.length === 0}
				<p class="empty">No applications yet.</p>
			{:else}
				<table class="data">
					<thead>
						<tr><th>Name</th><th>Ref</th><th>Program</th><th>Status</th><th>Submitted</th></tr>
					</thead>
					<tbody>
						{#each data.recent as a (a.id)}
							<tr>
								<td>
									<a class="row-link" href="/staff/applications/{a.id}"
										>{a.lastName}, {a.firstName}</a
									>
								</td>
								<td class="mono">{a.refCode}</td>
								<td>{a.programCode}</td>
								<td><span class="pill {a.status}">{STATUS_LABELS[a.status]}</span></td>
								<td>{formatDateTime(a.submittedAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>

		<section class="panel">
			<h2>Block sections</h2>
			{#if data.sections.length === 0}
				<p class="empty">No sections for this term.</p>
			{:else}
				<table class="data">
					<tbody>
						{#each data.sections as s (s.id)}
							<tr>
								<td><a class="row-link" href="/staff/classes?section={s.id}">{s.code}</a></td>
								<td>
									<div class={['fill', s.enrolled >= s.capacity && 'full']}>
										<progress max={s.capacity} value={s.enrolled}></progress>
										<span class="slots">
											{s.enrolled}/{s.capacity} · {s.capacity - s.enrolled} slots left
										</span>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
	</div>
{/if}
