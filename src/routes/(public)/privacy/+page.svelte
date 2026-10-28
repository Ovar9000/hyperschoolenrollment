<script lang="ts">
	import { PUBLIC_SCHOOL_NAME } from '$app/env/public';
</script>

<svelte:head>
	<title>Privacy Notice — {PUBLIC_SCHOOL_NAME}</title>
</svelte:head>

<main>
	<div class="container prose">
		<span class="eyebrow">Data Privacy Act of 2012 (RA 10173)</span>
		<h1>Privacy Notice</h1>
		<p class="hint">Version 2026-10-v1 · Draft, to be finalized by the Data Protection Officer</p>

		<div class="card section-title">
			<h2>What we collect and why</h2>
			<p>
				{PUBLIC_SCHOOL_NAME} collects your name, sex, birthdate, LRN, contact details, and the documents
				you upload only to process your enrollment and to submit reports required by CHED and UniFAST.
			</p>
			<h2>How we protect it</h2>
			<p>
				Your data is stored on the college's own server and in encrypted backups. Only authorized
				Registrar, Cashier and program staff can view it, and every view or change is logged.
			</p>
			<h2>Your rights</h2>
			<p>
				You may request access to, correction of, or deletion of your data by contacting the Data
				Protection Officer at the Registrar's Office.
			</p>
		</div>

		<p><a href="/enroll">← Back to enrollment</a></p>
	</div>
</main>
