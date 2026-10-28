<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Enrollment submitted</title>
</svelte:head>

<main>
	<h1>Enrollment submitted ✓</h1>
	<div class="card">
		<p>Your reference number:</p>
		<p class="ref">{data.ref}</p>
		<p class="hint">
			Screenshot this page. You will need this number at the Registrar and Cashier.
		</p>
	</div>
	<h2>Next steps</h2>
	<ol>
		<li>Wait for your assessment slip (SMS / email).</li>
		<li>Pay at the Cashier or via the payment options on your slip.</li>
		<li>
			Submit original hardcopies of your SF9, PSA birth certificate and Good Moral certificate.
		</li>
	</ol>
</main>

<style>
	.ref {
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		font-family: ui-monospace, monospace;
		margin: 0.25rem 0;
	}
</style>
