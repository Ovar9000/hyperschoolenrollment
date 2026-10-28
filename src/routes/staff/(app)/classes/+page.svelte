<script lang="ts">
	import { formatMeetings } from '#lib/schedule.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let totals = $derived(
		data.classes.reduce((t, c) => ({ seats: t.seats + c.capacity, taken: t.taken + c.enrolled }), {
			seats: 0,
			taken: 0
		})
	);
</script>

<svelte:head>
	<title>Classes & slots · Staff</title>
</svelte:head>

<div class="page-bar">
	<div>
		<h1>Classes & slots</h1>
		<p class="muted">
			{data.classes.length} classes · {totals.taken} of {totals.seats} seats taken
		</p>
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
		Section
		<select name="section" value={data.filters.section}>
			<option value="">All sections</option>
			{#each data.sections as s (s.id)}
				<option value={s.id}>{s.code}</option>
			{/each}
		</select>
	</label>
	<label>
		Subject
		<input type="search" name="q" value={data.filters.q} placeholder="Code or title" />
	</label>
	<button class="btn-sm primary">Filter</button>
</form>

<div class="table-wrap">
	{#if data.classes.length === 0}
		<p class="empty">No classes match. Run <code>npm run db:seed</code> for sample offerings.</p>
	{:else}
		<table class="data">
			<thead>
				<tr>
					<th>Class</th>
					<th>Subject</th>
					<th>Section</th>
					<th>Schedule</th>
					<th>Professor</th>
					<th class="num">Units</th>
					<th>Enrolled</th>
				</tr>
			</thead>
			<tbody>
				{#each data.classes as c (c.id)}
					{@const left = c.capacity - c.enrolled}
					<tr>
						<td class="mono">{c.code}</td>
						<td
							><strong>{c.subjectCode}</strong><br /><span class="muted">{c.subjectTitle}</span></td
						>
						<td class="nowrap">{c.sectionCode ?? 'Open'}</td>
						<td>
							{#each formatMeetings(c.meetings) as line (line)}<div>{line}</div>{:else}TBA{/each}
						</td>
						<td>{c.faculty ?? 'TBA'}</td>
						<td class="num">{c.units}</td>
						<td>
							<div class={['fill', left <= 0 && 'full']}>
								<progress max={c.capacity} value={c.enrolled}></progress>
								<span class="slots">
									{c.enrolled}/{c.capacity} · {left <= 0 ? 'Full' : `${left} left`}
								</span>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
