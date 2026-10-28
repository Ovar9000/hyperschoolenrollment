<script lang="ts">
	import CheckIcon from '#lib/components/CheckIcon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Enrollment submitted</title>
</svelte:head>

<main>
	<div class="container done-wrap">
		<div class="success-icon"><CheckIcon size={32} /></div>
		<h1>Enrollment submitted</h1>
		<p class="muted">We've received your application. Here's your reference number.</p>

		<div class="ref-box">
			<p class="hint">Reference number</p>
			<p class="ref">{data.ref}</p>
			<p class="hint">Screenshot this page. You'll need it at the Registrar and the Cashier.</p>
		</div>

		<p><a class="btn btn-ghost" href="/status">Check your status anytime</a></p>

		<div class="card">
			<h2>Next steps</h2>
			<ol class="steps">
				<li>
					<h3>Wait for your assessment</h3>
					<p>We'll send your assessment slip by SMS or email.</p>
				</li>
				<li>
					<h3>Settle your assessment</h3>
					<p>Pay at the Cashier or through the options on your slip, if you're not FHE covered.</p>
				</li>
				<li>
					<h3>Submit your originals</h3>
					<p>Bring your SF9, PSA birth certificate and Good Moral certificate to the Registrar.</p>
				</li>
			</ol>
		</div>
	</div>
</main>
