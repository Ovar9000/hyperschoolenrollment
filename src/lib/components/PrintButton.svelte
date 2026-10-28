<script lang="ts">
	let { label = 'Print' }: { label?: string } = $props();
</script>

<button class="btn-sm primary btn no-print" type="button" onclick={() => window.print()}
	>{label}</button
>
