<script lang="ts">
	import Registration from '#lib/components/Registration.svelte';
	import PrintButton from '#lib/components/PrintButton.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title
		>{data.reg.app.status === 'OFFICIAL' ? 'COR' : 'Assessment slip'} · {data.reg.student
			.lastName}</title
	>
</svelte:head>

<main class="container">
	<div class="print-bar">
		<a class="btn-sm" href="/staff/applications/{data.reg.app.id}">← Back</a>
		<PrintButton />
	</div>
	<Registration reg={data.reg} printedAt={data.printedAt} />
</main>
