<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { stripBase } from '#lib/paths.js';
	import ConnectDialog from '#lib/components/connect-dialog.svelte';
	import ConnectGate from '#lib/components/connect-gate.svelte';
	import DeviceStatusBanner from '#lib/components/device-status-banner.svelte';
	import StudioNav from '#lib/components/studio-nav.svelte';
	import TopBar from '#lib/components/top-bar.svelte';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { device } from '#lib/device.svelte.js';
	import { ui } from '#lib/ui.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const sectionTitles: Record<string, string> = {
		'/': 'Overview',
		'/equalizer': 'Equalizer',
		'/noise': 'Noise control',
		'/market': 'Sound market',
		'/device': 'Device'
	};

	const section = $derived(sectionTitles[stripBase(page.url.pathname)] ?? 'Sound Studio');

	/**
	 * Keep the page context visible while the retained H3 Pro is restarting or
	 * reconnecting. The gate is only for a session with no device to return to.
	 */
	const showGate = $derived(
		stripBase(page.url.pathname) !== '/' &&
			!device.connected &&
			!ui.demoPreview &&
			!device.canReconnect &&
			device.status !== 'restarting'
	);
</script>

<svelte:head>
	<title>{section} · Fucy Studio</title>
	<meta
		name="description"
		content="A QCY companion app for H3 Pro — battery, scene ANC, ten-band EQ, LDAC, and multipoint."
	/>
</svelte:head>

<div class="relative min-h-dvh overflow-x-clip">
	<div aria-hidden="true" class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
		<div
			class="absolute -left-40 -top-56 size-[34rem] rounded-full bg-signal/[0.035] blur-[110px]"
		></div>
		<div
			class="absolute -bottom-72 right-[-10%] size-[38rem] rounded-full bg-ember/[0.03] blur-[120px]"
		></div>
		<div class="absolute inset-y-0 left-0 w-px bg-hairline-soft lg:left-20"></div>
	</div>

	<StudioNav />

	<div class="relative z-10 lg:pl-20">
		<TopBar />
		<main
			class="mx-auto w-full max-w-[1500px] px-4 pb-32 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pb-16 lg:pt-10"
		>
			<div class="mb-4 empty:hidden">
				<DeviceStatusBanner />
			</div>

			{#key stripBase(page.url.pathname)}
				{#if showGate}
					<ConnectGate {section} />
				{:else}
					{@render children()}
				{/if}
			{/key}

			<footer
				class="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-hairline-soft pt-4 text-[10px] font-medium text-muted-warm/70"
			>
				<span>Fucy Studio · H3 Pro companion</span>
				<span class="tabular">JL A002 · RCSP</span>
			</footer>
		</main>
	</div>

	<ConnectDialog />
	<Toaster position="top-right" theme="dark" offset={{ top: 88, right: 16 }} />
</div>
