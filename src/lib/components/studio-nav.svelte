<script lang="ts">
	import { page } from '$app/state';
	import type { LucideIcon } from '@lucide/svelte';
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import Bluetooth from '@lucide/svelte/icons/bluetooth';
	import Headphones from '@lucide/svelte/icons/headphones';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Store from '@lucide/svelte/icons/store';
	import Unplug from '@lucide/svelte/icons/unplug';
	import Waves from '@lucide/svelte/icons/waves';
	import { toast } from 'svelte-sonner';
	import SignalGrid from '#lib/components/signal-grid.svelte';
	import { device } from '#lib/device.svelte.js';
	import { openConnect, hideDemoPreview } from '#lib/ui.svelte.js';
	import { cn } from '#lib/utils.js';

	type NavItem = {
		href: string;
		label: string;
		mobileLabel: string;
		icon: LucideIcon;
	};

	const navItems: NavItem[] = [
		{ href: '/', label: 'Overview', mobileLabel: 'Overview', icon: LayoutGrid },
		{ href: '/equalizer', label: 'Equalizer', mobileLabel: 'EQ', icon: AudioLines },
		{ href: '/noise', label: 'Noise control', mobileLabel: 'Noise', icon: Waves },
		{ href: '/market', label: 'Sound market', mobileLabel: 'Market', icon: Store },
		{ href: '/device', label: 'Device', mobileLabel: 'Device', icon: Headphones }
	];

	const statusLabel = $derived(
		device.status === 'connected'
			? 'Connected'
			: device.status === 'restarting'
				? 'Reconnecting'
				: device.status === 'connecting'
					? device.canReconnect
						? 'Reconnecting'
						: 'Connecting'
					: 'Not connected'
	);

	const statusTone = $derived(
		device.status === 'connected'
			? 'text-signal'
			: device.status === 'restarting' || device.status === 'connecting'
				? 'text-ember'
				: device.status === 'error'
					? 'text-ember'
					: 'text-muted-warm'
	);

	const busy = $derived(device.status === 'connecting' || device.status === 'restarting');

	function isActive(href: string): boolean {
		const pathname = page.url.pathname;
		return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
	}

	async function reconnect(): Promise<void> {
		try {
			await device.reconnect();
			toast.success('H3 Pro reconnected');
		} catch (error) {
			toast.error('Could not reconnect', {
				description:
					error instanceof Error ? error.message : 'Keep the headphones nearby and try again.'
			});
		}
	}

	function disconnect(): void {
		device.disconnect();
		hideDemoPreview();
		toast.success('Disconnected', { description: 'Connect again or preview the H3 Pro demo.' });
	}
</script>

<aside
	class="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r border-hairline bg-[#0c0c0b]/95 backdrop-blur-xl lg:flex"
	aria-label="Studio navigation"
>
	<div class="flex h-[76px] shrink-0 items-center justify-center">
		<a
			href="/"
			class="group relative flex size-11 items-center justify-center rounded-[15px] border border-hairline bg-surface text-signal transition-colors duration-200 hover:border-signal/35 hover:bg-surface-raised"
			aria-label="Fucy Studio home"
		>
			<SignalGrid size="sm" animate={false} class="size-7" />
			<span
				role="tooltip"
				class="pointer-events-none absolute left-full z-50 ml-3 w-max rounded-lg border border-hairline bg-surface-raised px-2.5 py-1.5 text-[11px] font-medium text-bone opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
			>
				Fucy Studio
			</span>
		</a>
	</div>

	<nav class="relative flex flex-1 flex-col items-center gap-2 pt-3" aria-label="Primary">
		{#each navItems as item (item.href)}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				aria-label={item.label}
				class={cn(
					'group relative flex size-12 items-center justify-center rounded-[15px] transition-colors duration-200',
					active
						? 'bg-bone/[0.055] text-signal'
						: 'text-muted-warm hover:bg-bone/[0.035] hover:text-bone'
				)}
			>
				<span
					aria-hidden="true"
					class={cn(
						'absolute -left-4 h-5 w-[2px] rounded-full bg-signal transition-all duration-300',
						active ? 'scale-y-100 opacity-100' : 'scale-y-50 opacity-0'
					)}
				></span>
				<item.icon class="size-[19px]" strokeWidth={active ? 1.8 : 1.5} />
				<span
					role="tooltip"
					class="pointer-events-none absolute left-full z-50 ml-3 flex w-max items-center gap-2 rounded-lg border border-hairline bg-surface-raised px-2.5 py-1.5 text-[11px] font-medium text-bone opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
				>
					{item.label}
					{#if active}
						<span class="size-1 rounded-full bg-signal" aria-hidden="true"></span>
					{/if}
				</span>
			</a>
		{/each}
	</nav>

	<div class="flex shrink-0 flex-col items-center gap-3 pb-5">
		<div class="h-px w-8 bg-hairline" aria-hidden="true"></div>

		{#if device.status === 'restarting' || device.status === 'error' || device.status === 'connecting'}
			<button
				type="button"
				onclick={device.canReconnect ? () => void reconnect() : openConnect}
				disabled={device.status === 'connecting'}
				class={cn(
					'group relative flex size-11 items-center justify-center rounded-[15px] border border-hairline bg-surface transition-colors duration-200 hover:bg-surface-raised disabled:cursor-wait',
					statusTone
				)}
				aria-label={device.canReconnect ? `Reconnect H3 Pro · ${statusLabel}` : `Connect H3 Pro · ${statusLabel}`}
			>
				{#if busy}
					<LoaderCircle class="size-[18px] animate-spin" />
				{:else}
					<Bluetooth class="size-[18px]" />
				{/if}
				<span class={cn('absolute right-2 top-2 size-1.5 rounded-full bg-current', busy && 'status-dot--live')}></span>
				<span
					role="tooltip"
					class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 -translate-x-1/2 w-max rounded-lg border border-hairline bg-surface-raised px-2.5 py-1.5 text-[11px] font-medium text-bone opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
				>
					{device.canReconnect ? 'Reconnect H3 Pro' : 'Connect H3 Pro'}
				</span>
			</button>
			<p class="max-w-14 text-center text-[8px] font-medium leading-tight text-muted-warm">
				{statusLabel}
			</p>
		{:else if device.connected}
			<a
				href="/device"
				class="group relative flex size-11 flex-col items-center justify-center gap-1 rounded-[15px] border border-hairline bg-surface transition-colors duration-200 hover:bg-surface-raised"
				aria-label={`Connected to QCY H3 Pro, ${device.battery.left ?? 'unknown'} percent battery`}
			>
				<span class="status-dot status-dot--live text-signal" aria-hidden="true"></span>
				<span class="text-[10px] font-semibold tabular text-bone">
					{device.battery.left ?? '—'}%
				</span>
				<span
					role="tooltip"
					class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 -translate-x-1/2 w-max rounded-lg border border-hairline bg-surface-raised px-2.5 py-1.5 text-[11px] font-medium text-bone opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
				>
					Connected · QCY H3 Pro
				</span>
			</a>
			<p class="text-[8px] font-medium leading-tight text-signal">Connected</p>
		{:else}
			<button
				type="button"
				onclick={openConnect}
				class="group relative flex size-11 items-center justify-center rounded-[15px] border border-hairline bg-surface text-muted-warm transition-colors duration-200 hover:bg-surface-raised hover:text-bone"
				aria-label="Connect H3 Pro"
			>
				<Bluetooth class="size-[18px]" />
				<span class="absolute right-2 top-2 size-1.5 rounded-full bg-muted-warm/60" aria-hidden="true"></span>
				<span
					role="tooltip"
					class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 -translate-x-1/2 w-max rounded-lg border border-hairline bg-surface-raised px-2.5 py-1.5 text-[11px] font-medium text-bone opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
				>
					Connect H3 Pro
				</span>
			</button>
			<p class="max-w-14 text-center text-[8px] font-medium leading-tight text-muted-warm">
				Not connected
			</p>
		{/if}

		{#if device.connected}
			<button
				type="button"
				onclick={disconnect}
				class="group relative flex size-8 items-center justify-center rounded-full text-muted-warm/70 transition-colors duration-200 hover:bg-bone/[0.04] hover:text-bone"
				aria-label="Disconnect H3 Pro"
			>
				<Unplug class="size-3.5" />
				<span
					role="tooltip"
					class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 w-max rounded-lg border border-hairline bg-surface-raised px-2.5 py-1.5 text-[11px] font-medium text-bone opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
				>
					Disconnect H3 Pro
				</span>
			</button>
		{/if}
	</div>
</aside>

<nav
	class="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-[#0c0c0b]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
	aria-label="Primary"
>
	<div class="mx-auto grid max-w-lg grid-cols-5 px-2 py-1.5">
		{#each navItems as item (item.href)}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				class={cn(
					'relative flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors duration-200',
					active ? 'text-signal' : 'text-muted-warm hover:text-bone'
				)}
			>
				<span
					aria-hidden="true"
					class={cn(
						'absolute top-0 h-[2px] w-6 rounded-full bg-signal transition-opacity duration-200',
						active ? 'opacity-100' : 'opacity-0'
					)}
				></span>
				<item.icon class="size-[18px]" strokeWidth={active ? 1.8 : 1.5} />
				<span>{item.mobileLabel}</span>
			</a>
		{/each}
	</div>
</nav>
