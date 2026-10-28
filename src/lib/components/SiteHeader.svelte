<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_SCHOOL_NAME } from '$app/env/public';
	import seal48 from '#lib/assets/seal-48.webp';
	import seal96 from '#lib/assets/seal-96.webp';

	const links = [
		{ href: '/enroll', label: 'Enroll' },
		{ href: '/status', label: 'Check status' },
		{ href: '/privacy', label: 'Privacy' }
	];
</script>

<header class="site-header">
	<div class="container">
		<a class="brand" href="/">
			<img src={seal48} srcset="{seal48} 1x, {seal96} 2x" width="44" height="44" alt="" />
			<div>
				<strong>{PUBLIC_SCHOOL_NAME}</strong>
				<span>Online Enrollment</span>
			</div>
		</a>
		<nav class="site-nav" aria-label="Main">
			{#each links as link (link.href)}
				<a
					href={link.href}
					aria-current={page.url.pathname.startsWith(link.href) ? 'page' : undefined}
					>{link.label}</a
				>
			{/each}
		</nav>
	</div>
</header>
