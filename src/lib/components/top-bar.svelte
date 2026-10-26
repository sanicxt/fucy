<script lang="ts">
	import { page } from '$app/state';
	import Bluetooth from '@lucide/svelte/icons/bluetooth';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import X from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import SignalGrid from '#lib/components/signal-grid.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { device } from '#lib/device.svelte.js';
	import { hideDemoPreview, openConnect, ui } from '#lib/ui.svelte.js';
	import { cn } from '#lib/utils.js';

	const sectionTitles: Record<string, string> = {
		'/': 'Overview',
		'/equalizer': 'Equalizer',
		'/noise': 'Noise control',
		'/market': 'Sound market',
		'/device': 'Device'
	};

	const section = $derived(sectionTitles[page.url.pathname] ?? 'Overview');
	const busy = $derived(device.status === 'connecting' || device.status === 'restarting');

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

	const batteryLabel = $derived(
		device.battery.left === null ? 'Battery not reported' : `${device.battery.left}% battery`
	);

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
</script>

<header class="sticky top-0 z-30 border-b border-hairline bg-canvas/80 backdrop-blur-xl">
	<div
		class="mx-auto flex h-[68px] w-full max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:h-[76px] lg:px-10"
	>
		<div class="flex min-w-0 items-center gap-3">
			<a
				href="/"
				class="flex items-center gap-2.5 lg:hidden"
				aria-label="Fucy Studio home"
			>
				<span
					class="flex size-9 items-center justify-center rounded-xl border border-hairline bg-surface text-signal"
				>
					<SignalGrid size="sm" animate={false} class="size-6" />
				</span>
			</a>
			<div class="min-w-0">
				<p class="eyebrow hidden sm:block">Fucy Studio</p>
				<h1 class="display truncate text-[1.35rem] leading-tight text-bone lg:text-[1.5rem]">
					{section}
				</h1>
				<p class={cn('mt-0.5 text-[9px] font-medium sm:hidden', statusTone)} aria-live="polite">
					{statusLabel}
				</p>
			</div>
		</div>

		<div class="flex shrink-0 items-center gap-2.5 sm:gap-3">
			<div
				class="hidden items-center gap-3 border-r border-hairline pr-3 sm:flex lg:pr-4"
				aria-live="polite"
			>
				<span
					class={cn(
						'status-dot',
						device.status === 'connected' && 'status-dot--live',
						statusTone
					)}
					aria-hidden="true"
				></span>
				<div class="leading-tight">
					<p class="text-[11px] font-semibold text-bone">
						{statusLabel}
					</p>
					<p class="mt-0.5 text-[10px] font-medium text-muted-warm">
						{device.status === 'connected' ? batteryLabel : 'QCY H3 Pro · JL A002'}
					</p>
				</div>
			</div>

			{#if ui.demoPreview && !device.connected}
				<Button
					variant="ghost"
					size="sm"
					class="hidden h-9 px-2.5 text-[11px] text-muted-warm hover:text-bone sm:inline-flex"
					onclick={hideDemoPreview}
				>
					<X data-icon="inline-start" />
					Exit demo
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					class="size-9 text-muted-warm hover:text-bone sm:hidden"
					aria-label="Exit demo preview"
					onclick={hideDemoPreview}
				>
					<X />
				</Button>
			{/if}

			{#if device.status === 'connected'}
				<Button href="/device" variant="outline" size="sm" class="h-9">
					H3 Pro
				</Button>
			{:else if busy && !device.canReconnect}
				<Button size="sm" class="h-9" disabled>
					<LoaderCircle data-icon="inline-start" class="animate-spin" />
					<span class="hidden sm:inline">{statusLabel}…</span>
					<span class="sm:hidden">{statusLabel}</span>
				</Button>
			{:else if device.canReconnect}
				<Button
					size="sm"
					class="h-9"
					disabled={device.status === 'connecting'}
					onclick={() => void reconnect()}
				>
					{#if device.status === 'connecting'}
						<LoaderCircle data-icon="inline-start" class="animate-spin" />
						<span class="hidden sm:inline">Reconnecting…</span>
						<span class="sm:hidden">Reconnecting</span>
					{:else}
						<Bluetooth data-icon="inline-start" />
						<span class="hidden sm:inline">Reconnect H3 Pro</span>
						<span class="sm:hidden">Reconnect</span>
					{/if}
				</Button>
			{:else}
				<Button size="sm" class="h-9" onclick={openConnect}>
					<Bluetooth data-icon="inline-start" />
					<span class="hidden sm:inline">Connect H3 Pro</span>
					<span class="sm:hidden">Connect</span>
				</Button>
			{/if}
		</div>
	</div>
	<div
		class="absolute inset-x-0 bottom-0 h-px bg-hairline"
		aria-hidden="true"
	></div>
</header>
