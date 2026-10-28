<script lang="ts">
	import { STATUS_LABELS, formatDateTime } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let pages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

	function pageHref(n: number) {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(data.filters)) if (v) params.set(k, v);
		params.set('page', String(n));
		return `?${params}`;
	}
</script>

<svelte:head>
	<title>Applications · Staff</title>
</svelte:head>

<div class="page-bar">
	<div>
		<h1>Applications</h1>
		<p class="muted">{data.total} found</p>
	</div>
</div>

<form class="filters" method="GET">
	<label>
		Term
		<select name="term" value={data.filters.term}>
			{#each data.terms as t (t.id)}
				<option value={t.id}>{t.label}</option>
			{/each}
		</select>
	</label>
	<label>
		Status
		<select name="status" value={data.filters.status}>
			<option value="">All statuses</option>
			{#each Object.entries(STATUS_LABELS) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</label>
	<label>
		Section
		<select name="section" value={data.filters.section}>
			<option value="">All sections</option>
			<option value="none">No section yet</option>
			{#each data.sections as s (s.id)}
				<option value={s.id}>{s.code}</option>
			{/each}
		</select>
	</label>
	<label>
		Search
		<input
			type="search"
			name="q"
			value={data.filters.q}
			placeholder="Name, 12-digit LRN, or reference no."
		/>
	</label>
	<button class="btn-sm primary">Filter</button>
	{#if data.filters.status || data.filters.section || data.filters.q}
		<a class="btn-sm" href="?term={data.filters.term}">Clear</a>
	{/if}
</form>

<div class="table-wrap">
	{#if data.rows.length === 0}
		<p class="empty">No applications match these filters.</p>
	{:else}
		<table class="data">
			<thead>
				<tr>
					<th>Name</th>
					<th>LRN</th>
					<th>Ref</th>
					<th>Program</th>
					<th>Type</th>
					<th>Section</th>
					<th>Status</th>
					<th>Submitted</th>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as a (a.id)}
					<tr>
						<td>
							<a class="row-link" href="/staff/applications/{a.id}">
								{a.lastName}, {a.firstName}{a.middleName ? ` ${a.middleName}` : ''}
							</a>
						</td>
						<td class="mono">{a.lrn ?? '—'}</td>
						<td class="mono">{a.refCode}</td>
						<td>{a.programCode}</td>
						<td>{a.mode === 'BLOCK' ? 'Regular' : 'Irregular'}</td>
						<td class="nowrap">{a.sectionCode ?? '—'}</td>
						<td><span class="pill {a.status}">{STATUS_LABELS[a.status]}</span></td>
						<td>{formatDateTime(a.submittedAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

{#if pages > 1}
	<nav class="pager" aria-label="Pages">
		{#if data.page > 1}<a class="btn-sm" href={pageHref(data.page - 1)}>← Previous</a>{/if}
		<span>Page {data.page} of {pages}</span>
		{#if data.page < pages}<a class="btn-sm" href={pageHref(data.page + 1)}>Next →</a>{/if}
	</nav>
{/if}
