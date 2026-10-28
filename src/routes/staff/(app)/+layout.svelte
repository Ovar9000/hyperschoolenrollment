<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_SCHOOL_NAME } from '$app/env/public';
	import seal48 from '#lib/assets/seal-48.webp';
	import seal96 from '#lib/assets/seal-96.webp';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const allLinks: { href: string; label: string; exact?: boolean; roles?: string[] }[] = [
		{ href: '/staff', label: 'Dashboard', exact: true },
		{ href: '/staff/applications', label: 'Applications', roles: ['REGISTRAR', 'DEAN', 'CASHIER'] },
		{ href: '/staff/cashier', label: 'Cashier', roles: ['CASHIER'] },
		{ href: '/staff/classes', label: 'Classes & slots' }
	];

	// Show only what this account can open (ADMIN sees everything). The server still checks.
	let links = $derived(
		allLinks.filter(
			(l) => !l.roles || data.user?.roles.some((r) => r === 'ADMIN' || l.roles!.includes(r))
		)
	);

	const isCurrent = (href: string, exact = false) =>
		exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
</script>

<div class="staff-shell">
	<nav class="staff-nav" aria-label="Staff">
		<a class="staff-brand" href="/staff">
			<img src={seal48} srcset="{seal48} 1x, {seal96} 2x" width="36" height="36" alt="" />
			<div>
				<strong>{PUBLIC_SCHOOL_NAME}</strong>
				<span>Student Records</span>
			</div>
		</a>

		<p class="nav-section">Enrollment</p>
		{#each links as link (link.href)}
			<a
				class="nav-link"
				href={link.href}
				aria-current={isCurrent(link.href, link.exact) ? 'page' : undefined}>{link.label}</a
			>
		{/each}

		<p class="nav-section">Account</p>
		<a
			class="nav-link"
			href="/staff/account/password"
			aria-current={isCurrent('/staff/account') ? 'page' : undefined}>Change password</a
		>

		{#if data.user}
			<div class="staff-user">
				<strong>{data.user.displayName}</strong>
				<div class="roles">{data.user.roles.join(' · ')}</div>
				<form method="POST" action="/staff/logout">
					<button class="btn-sm">Sign out</button>
				</form>
			</div>
		{/if}
	</nav>

	<main class="staff-main">
		{@render children()}
	</main>
</div>
