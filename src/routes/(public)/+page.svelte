<script lang="ts">
	import { PUBLIC_SCHOOL_NAME } from '$app/env/public';
	import CheckIcon from '#lib/components/CheckIcon.svelte';
	import seal120 from '#lib/assets/seal-120.webp';
	import seal240 from '#lib/assets/seal-240.webp';

	const prepare = [
		'Your 12-digit LRN (on your SF9 / Report Card)',
		'Your name exactly as on your PSA birth certificate',
		'An active mobile number for updates',
		'Parent or guardian name, if you are under 18'
	];
</script>

<svelte:head>
	<title>Online Enrollment — {PUBLIC_SCHOOL_NAME}</title>
	<meta
		name="description"
		content="Enroll at {PUBLIC_SCHOOL_NAME} from your phone in about 5 minutes."
	/>
</svelte:head>

<section class="hero">
	<div class="container hero-grid">
		<div class="hero-copy">
			<img
				src={seal120}
				srcset="{seal120} 1x, {seal240} 2x"
				width="120"
				height="120"
				alt="{PUBLIC_SCHOOL_NAME} seal"
				fetchpriority="high"
			/>
			<span class="eyebrow">Now enrolling · New students</span>
			<h1>Enroll online at {PUBLIC_SCHOOL_NAME}</h1>
			<p class="lead">
				Fill in one short form from your phone or laptop. No need to line up. It takes about 5
				minutes, and your answers are saved if your signal drops.
			</p>
			<p><a class="btn" href="/enroll">Start enrollment</a></p>
		</div>

		<div class="card">
			<h2>Have these ready</h2>
			<ul class="checklist">
				{#each prepare as item (item)}
					<li><CheckIcon />{item}</li>
				{/each}
			</ul>
		</div>
	</div>
</section>

<main>
	<div class="container">
		<h2 class="section-title">How it works</h2>
		<ol class="steps row">
			<li>
				<h3>Fill in the form</h3>
				<p>Your details, LRN and program. Regular students get a block section in one tap.</p>
			</li>
			<li>
				<h3>Get your reference number</h3>
				<p>Screenshot it. You'll use it at the Registrar and the Cashier.</p>
			</li>
			<li>
				<h3>Complete on campus</h3>
				<p>
					Submit your original documents and settle your assessment to become officially enrolled.
				</p>
			</li>
		</ol>

		<div class="callout section-title">
			<p>
				<strong>Bring your originals:</strong> SF9 (Report Card), PSA birth certificate and Good Moral
				certificate must be submitted to the Registrar before 2nd semester enrollment.
			</p>
		</div>
	</div>
</main>
