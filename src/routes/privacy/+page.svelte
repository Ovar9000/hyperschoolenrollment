<script lang="ts">
	import { PUBLIC_SCHOOL_NAME } from '$app/env/public';
</script>

<svelte:head>
	<title>Privacy Notice — {PUBLIC_SCHOOL_NAME}</title>
</svelte:head>

<main>
	<h1>Privacy Notice</h1>
	<p class="hint">Version 2026-10-v1 · DRAFT, to be finalized by the Data Protection Officer</p>
	<p>
		{PUBLIC_SCHOOL_NAME} collects your name, sex, birthdate, LRN, contact details, and the documents you
		upload only to process your enrollment and to submit reports required by CHED and UniFAST, as allowed
		by the Data Privacy Act of 2012 (RA 10173).
	</p>
	<p>
		Your data is stored on the college's own server and in encrypted backups. Only authorized
		Registrar, Cashier and program staff can view it, and every view or change is logged.
	</p>
	<p>
		You may request access to, correction of, or deletion of your data by contacting the Data
		Protection Officer at the Registrar's Office.
	</p>
	<p><a href="/enroll">← Back to enrollment</a></p>
</main>
