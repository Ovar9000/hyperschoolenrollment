<script lang="ts">
	import { PUBLIC_SCHOOL_NAME } from '$app/env/public';
</script>

<svelte:head>
	<title>Enroll — {PUBLIC_SCHOOL_NAME}</title>
	<meta name="description" content="Online enrollment for {PUBLIC_SCHOOL_NAME}" />
</svelte:head>

<main>
	<h1>{PUBLIC_SCHOOL_NAME} Online Enrollment</h1>
	<p>Enroll from your phone in about 5 minutes. Have these ready:</p>
	<ul>
		<li>Your 12-digit LRN (on your SF9 / Report Card)</li>
		<li>Your PSA birth certificate details</li>
	</ul>
	<p><a href="/enroll">Start enrollment →</a></p>
	<p class="hint">
		Original hardcopies of your SF9, PSA birth certificate and Good Moral certificate must be
		submitted to the Registrar before 2nd semester enrollment.
	</p>
</main>
