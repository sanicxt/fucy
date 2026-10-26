<script lang="ts">
	import { appHref } from '#lib/paths.js';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import BatteryMedium from '@lucide/svelte/icons/battery-medium';
	import Check from '@lucide/svelte/icons/check';
	import Headphones from '@lucide/svelte/icons/headphones';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import Shield from '@lucide/svelte/icons/shield';
	import SkipBack from '@lucide/svelte/icons/skip-back';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Store from '@lucide/svelte/icons/store';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import Waves from '@lucide/svelte/icons/waves';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Slider } from '#lib/components/ui/slider/index.js';
	import BatteryRing from '#lib/components/battery-ring.svelte';
	import ConnectHero from '#lib/components/connect-hero.svelte';
	import EqCurve from '#lib/components/eq-curve.svelte';
	import PageHeading from '#lib/components/page-heading.svelte';
	import { H3_PRO_ANC_SCENES } from '#lib/data/devices.js';
	import { device } from '#lib/device.svelte.js';
	import { hideDemoPreview, openConnect, showDemoPreview, ui } from '#lib/ui.svelte.js';
	import { cn } from '#lib/utils.js';

	const noiseModes = [
		{ value: 'anc', label: 'ANC', name: 'Noise cancelling' },
		{ value: 'transparency', label: 'Transparency', name: 'Transparency' },
		{ value: 'normal', label: 'Normal', name: 'Normal' }
	] as const;

	const showDashboard = $derived(device.connected || ui.demoPreview);
	const activeScene = $derived(H3_PRO_ANC_SCENES.find((scene) => scene.id === device.ancScene));
	const activeSceneLabel = $derived(activeScene?.label ?? 'Noisy');
	const activeNoise = $derived(
		noiseModes.find((mode) => mode.value === device.ancMode) ?? noiseModes[0]
	);

	const bandRangeLabel = $derived.by(() => {
		const freqs = device.bandFrequencies;
		const format = (freq: number) =>
			freq >= 1000 ? `${Number((freq / 1000).toFixed(1))} kHz` : `${freq} Hz`;
		return `${format(freqs[0] ?? 30)} – ${format(freqs.at(-1) ?? 11_000)}`;
	});

	const noiseCopy = $derived(
		device.ancMode === 'anc'
			? `Scene-based cancellation tuned for ${activeSceneLabel.toLowerCase()} surroundings.`
			: device.ancMode === 'transparency'
				? 'Room sound comes through the mics so you can stay aware.'
				: 'Processing is off; the driver runs untouched.'
	);

	const batteryDetail = $derived(
		device.battery.left === null
			? 'Not reported'
			: device.battery.leftCharging
				? 'Charging'
				: 'On battery'
	);

	const playbackEstimate = $derived.by(() => {
		const average = device.battery.left;
		if (average === null) return '—';
		const totalMinutes = Math.round((average / 100) * 8 * 60);
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		if (hours === 0) return `${minutes}m`;
		return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
	});

	const lastSync = $derived(
		device.connected ? (device.lastSyncedAt?.toLocaleTimeString() ?? 'Just now') : 'Demo data'
	);

	const connectionLabel = $derived(
		device.connected
			? 'Connected'
			: device.isDemo
				? 'Preview'
				: device.status === 'error'
					? 'Offline'
					: device.status === 'connecting'
						? device.canReconnect
							? 'Reconnecting'
							: 'Connecting'
						: 'Reconnecting'
	);

	const connectionTone = $derived(
		device.connected ? 'text-signal' : device.isDemo ? 'text-muted-warm' : 'text-ember'
	);

	const curveState = $derived(
		device.connected
			? 'Live'
			: device.isDemo
				? 'Preview'
				: device.status === 'error'
					? 'Offline'
					: device.status === 'connecting'
						? 'Reconnecting'
						: 'Restarting'
	);

	const quickLinks = [
		{
			href: appHref('/noise'),
			label: 'Noise control',
			detail: 'Scenes, transparency, normal',
			icon: Waves
		},
		{
			href: appHref('/equalizer'),
			label: 'Equalizer',
			detail: 'Ten bands, one local curve',
			icon: SlidersHorizontal
		},
		{
			href: appHref('/market'),
			label: 'Sound market',
			detail: 'H3 Pro starting points',
			icon: Store
		},
		{
			href: appHref('/device'),
			label: 'Device',
			detail: 'Battery, LDAC, multipoint',
			icon: Headphones
		}
	];
</script>

<div class="flex flex-col gap-5">
	{#if !showDashboard}
		<PageHeading
			eyebrow="Fucy Studio · H3 Pro companion"
			title="The H3 Pro, tuned."
			description="One pair of over-ear headphones, one battery, five noise scenes, and ten bands of shaping. Connect to begin — or look around the H3 Pro demo first."
		>
			<Button size="sm" onclick={openConnect}>Connect H3 Pro</Button>
			<Button variant="ghost" size="sm" onclick={showDemoPreview}>Preview demo</Button>
		</PageHeading>

		<ConnectHero onDismiss={showDemoPreview} />

		<p
			class="studio-reveal px-1 text-[11px] leading-relaxed text-muted-warm/80 text-pretty"
			style="--reveal-delay: 150ms"
		>
			The studio currently targets the QCY H3 Pro (JL A002) only. Battery, ANC scenes, EQ, LDAC,
			and multipoint are all read from that headphone — no layout switching.
		</p>
	{:else}
		<PageHeading
			eyebrow={ui.demoPreview && !device.connected ? 'H3 Pro demo preview' : 'QCY H3 Pro'}
			title="Your H3 Pro, in the studio."
			description="A single view of battery, noise, wireless state, and the curve shaping the H3 Pro right now."
		>
			<Button href={appHref('/equalizer')} size="sm">
				<SlidersHorizontal data-icon="inline-start" />
				Open equalizer
			</Button>
			<Button href={appHref('/noise')} variant="ghost" size="sm">Noise control</Button>
		</PageHeading>

		{#if !device.connected}
			<div
				class="studio-reveal flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-hairline bg-surface/70 px-4 py-2.5"
				style="--reveal-delay: 70ms"
			>
				<p class="flex items-center gap-2 text-[11px] font-medium text-muted-warm">
					<span class="size-1.5 rounded-full bg-signal" aria-hidden="true"></span>
					H3 Pro demo preview — values are simulated.
				</p>
				<div class="flex items-center gap-1.5">
					<Button
						variant="outline"
						size="sm"
						class="h-7 border-hairline bg-transparent px-2.5 text-[11px]"
						onclick={openConnect}
					>
						Connect H3 Pro
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="h-7 px-2.5 text-[11px] text-muted-warm hover:text-bone"
						onclick={hideDemoPreview}
					>
						Hide preview
					</Button>
				</div>
			</div>
		{/if}

		<!-- Battery + noise: one asymmetric hero instead of a grid of stat cards. -->
		<section
			class="studio-reveal grid gap-4 xl:grid-cols-12"
			style="--reveal-delay: 100ms"
			aria-label="H3 Pro status"
		>
			<div
				class="relative overflow-hidden rounded-[24px] border border-hairline bg-surface xl:col-span-7"
			>
				<div
					aria-hidden="true"
					class="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-signal/[0.05] blur-3xl"
				></div>
				<div
					aria-hidden="true"
					class="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-signal/20 to-transparent"
				></div>

				<div class="relative flex flex-col gap-6 p-5 sm:p-7">
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0">
							<p class="eyebrow flex items-center gap-2">
								<BatteryMedium class="size-3.5 text-signal/80" aria-hidden="true" />
								Single battery
							</p>
							<h3 class="display mt-2 text-[2rem] leading-none text-bone sm:text-[2.4rem]">
								QCY H3 Pro
							</h3>
							<p class="mt-1.5 text-[11px] font-medium text-muted-warm">
								Over-ear · JL A002 · {device.connected ? 'Live connection' : 'Demo session'}
							</p>
						</div>
						<Badge
							variant="outline"
							class={cn(
								'h-6 gap-2 border-hairline bg-transparent px-2.5 text-[10px]',
								connectionTone
							)}
						>
							<span
								class={cn(
									'status-dot',
									device.connected && 'status-dot--live',
									connectionTone
								)}
								aria-hidden="true"
							></span>
							{connectionLabel}
						</Badge>
					</div>

					<div class="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
						<BatteryRing
							value={device.battery.left}
							charging={device.battery.leftCharging}
							label="Remaining"
							size={176}
						/>

						<dl class="grid w-full flex-1 grid-cols-2 gap-x-5 gap-y-4">
							<div class="border-b border-hairline-soft pb-3">
								<dt class="text-[10px] font-medium text-muted-warm">Battery state</dt>
								<dd class="mt-1 text-[13px] font-semibold text-bone">{batteryDetail}</dd>
							</div>
							<div class="border-b border-hairline-soft pb-3">
								<dt class="text-[10px] font-medium text-muted-warm">Estimated playback</dt>
								<dd class="mt-1 text-[13px] font-semibold text-bone tabular">{playbackEstimate}</dd>
							</div>
							<div>
								<dt class="text-[10px] font-medium text-muted-warm">Last sync</dt>
								<dd class="mt-1 text-[13px] font-semibold text-bone">{lastSync}</dd>
							</div>
							<div>
								<dt class="text-[10px] font-medium text-muted-warm">Firmware</dt>
								<dd class="mt-1 text-[13px] font-semibold text-bone tabular">{device.firmware}</dd>
							</div>
						</dl>
					</div>

					<div
						class="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4 text-[10px] font-medium text-muted-warm"
					>
						<span>Refreshes every 30 seconds while connected</span>
						<a
							href={appHref('/device')}
							class="inline-flex items-center gap-1.5 text-bone transition-colors duration-200 hover:text-signal"
						>
							Device details
							<ArrowUpRight class="size-3" />
						</a>
					</div>
				</div>
			</div>

			<div class="flex flex-col overflow-hidden rounded-[24px] border border-hairline bg-surface xl:col-span-5">
				<div class="flex flex-col gap-4 p-5 sm:p-6">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="eyebrow flex items-center gap-2">
								<Shield class="size-3.5 text-signal/80" aria-hidden="true" />
								Noise control
							</p>
							<h3 class="display mt-2 text-[1.9rem] leading-none text-bone">
								{activeNoise.name}
							</h3>
							<p class="mt-1.5 text-[11px] leading-relaxed text-muted-warm text-pretty">
								{noiseCopy}
							</p>
						</div>
					</div>

					<div
						role="group"
						aria-label="Noise mode"
						class="grid w-full grid-cols-3 gap-1 rounded-full border border-hairline bg-canvas/50 p-1"
					>
						{#each noiseModes as mode (mode.value)}
							{@const selected = device.ancMode === mode.value}
							<button
								type="button"
								aria-pressed={selected}
								class={cn(
									'rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors duration-200',
									selected
										? 'bg-signal text-primary-foreground'
										: 'text-muted-warm hover:bg-bone/[0.05] hover:text-bone'
								)}
								onclick={() => device.setAncMode(mode.value)}
							>
								{mode.label}
							</button>
						{/each}
					</div>

					{#if device.ancMode === 'anc'}
						<div class="rounded-[14px] border border-hairline bg-canvas/40 p-3.5">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="flex items-center gap-1.5 text-[11px] font-semibold text-bone">
										<span class="size-1 rounded-full bg-signal" aria-hidden="true"></span>
										Scene · {activeSceneLabel}
									</p>
									<p class="mt-1 text-[10px] leading-relaxed text-muted-warm text-pretty">
										Scene changes apply live and do not restart the H3 Pro.
									</p>
								</div>
								<a
									href={appHref('/noise')}
									class="shrink-0 text-[10px] font-medium text-signal transition-colors duration-200 hover:text-bone"
								>
									Choose
								</a>
							</div>
						</div>
					{:else}
						<div class="rounded-[14px] border border-hairline bg-canvas/40 p-3.5">
							<p class="text-[11px] font-semibold text-bone">
								{device.ancMode === 'transparency' ? 'Transparency is on' : 'Processing is off'}
							</p>
							<p class="mt-1 text-[10px] leading-relaxed text-muted-warm text-pretty">
								Noise scenes are available in ANC mode.
								<a href={appHref('/noise')} class="font-medium text-signal hover:text-bone">Switch to ANC</a>
							</p>
						</div>
					{/if}
				</div>

				<div class="mt-auto border-t border-hairline p-5 sm:p-6 sm:pt-4">
					<p class="eyebrow">Wireless state</p>
					<div class="mt-3 flex flex-col divide-y divide-hairline-soft">
						<div class="flex items-center justify-between gap-3 py-2.5 first:pt-0">
							<div>
								<p class="text-[12px] font-semibold text-bone">LDAC</p>
								<p class="mt-0.5 text-[10px] text-muted-warm">High-bitrate codec</p>
							</div>
							<span
								class={cn(
									'flex items-center gap-1.5 text-[10px] font-semibold',
									device.ldacEnabled ? 'text-signal' : 'text-muted-warm'
								)}
							>
								{#if device.ldacEnabled}<Check class="size-3" />{/if}
								{device.ldacEnabled ? 'On' : 'Off'}
							</span>
						</div>
						<div class="flex items-center justify-between gap-3 py-2.5 last:pb-0">
							<div>
								<p class="text-[12px] font-semibold text-bone">Multipoint</p>
								<p class="mt-0.5 text-[10px] text-muted-warm">Two source devices</p>
							</div>
							<span
								class={cn(
									'flex items-center gap-1.5 text-[10px] font-semibold',
									device.multipointEnabled ? 'text-signal' : 'text-muted-warm'
								)}
							>
								{#if device.multipointEnabled}<Check class="size-3" />{/if}
								{device.multipointEnabled ? 'On' : 'Off'}
							</span>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- EQ + transport. -->
		<section class="studio-reveal grid gap-4 xl:grid-cols-12" style="--reveal-delay: 160ms">
			<div class="overflow-hidden rounded-[24px] border border-hairline bg-surface xl:col-span-8">
				<div class="flex flex-wrap items-start justify-between gap-3 px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
					<div>
						<p class="eyebrow">Current curve</p>
						<div class="mt-1.5 flex flex-wrap items-baseline gap-2.5">
							<h3 class="display text-[1.9rem] leading-none text-bone">
								{device.currentPreset?.name ?? 'Custom curve'}
							</h3>
							<span class="text-[10px] font-medium tabular text-muted-warm">
								{device.eqTargetLabel}
							</span>
							{#if device.eqDirty}
								<span class="text-[10px] font-semibold text-ember">Unsaved changes</span>
							{:else if device.eqApplying}
								<span class="text-[10px] font-semibold text-ember">Sending…</span>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-2">
						<Badge variant="outline" class="border-hairline bg-transparent text-muted-warm">
							10 bands
						</Badge>
						<span class="flex items-center gap-1.5 text-[10px] font-medium text-muted-warm">
							<span class={cn('status-dot', connectionTone)} aria-hidden="true"></span>
							{curveState}
						</span>
					</div>
				</div>

				<div class="px-2 pb-1 pt-2 sm:px-4">
					<EqCurve
						gains={device.eqGains}
						frequencies={device.bandFrequencies}
						height={228}
					/>
				</div>

				<div
					class="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-5 py-3.5 sm:px-6"
				>
					<span class="text-[10px] font-medium text-muted-warm">±15 dB · {bandRangeLabel}</span>
					<span class="text-[10px] font-medium text-muted-warm tabular">
						Master {device.masterGain > 0 ? '+' : ''}{device.masterGain.toFixed(1)} dB
					</span>
					<a
						href={appHref('/equalizer')}
						class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-signal transition-colors duration-200 hover:text-bone"
					>
						Shape the curve
						<ArrowRight class="size-3" />
					</a>
				</div>
			</div>

			<div class="flex flex-col overflow-hidden rounded-[24px] border border-hairline bg-surface xl:col-span-4">
				<div class="p-5 sm:p-6">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="eyebrow">Bluetooth audio</p>
							<h3 class="display mt-2 text-[1.9rem] leading-none text-bone">
								{device.isPlaying ? 'Playing' : 'Paused'}
							</h3>
							<p class="mt-1.5 text-[11px] leading-relaxed text-muted-warm">
								Transport and volume controls for the H3 Pro link.
							</p>
						</div>
						<AudioLines class="size-6 shrink-0 text-signal" aria-hidden="true" />
					</div>

					<div class="mt-6 flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							class="size-9 rounded-full text-muted-warm hover:text-bone"
							aria-label="Previous track"
							onclick={() => device.previousTrack()}
						>
							<SkipBack class="size-4" />
						</Button>
						<Button
							variant="secondary"
							size="icon"
							class="size-12 rounded-full border border-hairline bg-bone text-primary-foreground hover:bg-bone/90"
							aria-label={device.isPlaying ? 'Pause' : 'Play'}
							onclick={() => device.togglePlayback()}
						>
							{#if device.isPlaying}
								<Pause class="size-4" />
							{:else}
								<Play class="size-4" />
							{/if}
						</Button>
						<Button
							variant="ghost"
							size="icon"
							class="size-9 rounded-full text-muted-warm hover:text-bone"
							aria-label="Next track"
							onclick={() => device.nextTrack()}
						>
							<SkipForward class="size-4" />
						</Button>
						<span class="ml-auto text-[10px] font-medium text-muted-warm">
							{device.isPlaying ? 'Playing' : 'Paused'}
						</span>
					</div>

					<div class="mt-6 flex items-center gap-2.5">
						<Volume2 class="size-3.5 shrink-0 text-muted-warm" aria-hidden="true" />
						<Slider
							type="single"
							min={0}
							max={100}
							step={1}
							value={device.volume}
							onValueChange={(value: number) => device.setVolume(value)}
							class="flex-1"
							aria-label="Volume"
						/>
						<span class="w-7 text-right text-[10px] font-semibold tabular text-muted-warm">
							{device.volume}
						</span>
					</div>
				</div>

				<div class="mt-auto border-t border-hairline px-5 py-3.5 sm:px-6">
					<p class="text-[10px] leading-relaxed text-muted-warm">
						{device.connected
							? 'Controls are sent to the connected H3 Pro.'
							: device.isDemo
								? 'Demo mode updates the interface only.'
								: 'Waiting for the H3 Pro link to return.'}
					</p>
				</div>
			</div>
		</section>

		<!-- Quick links share one surface with internal dividers. -->
		<nav
			class="studio-reveal overflow-hidden rounded-[20px] border border-hairline bg-surface/60"
			style="--reveal-delay: 220ms"
			aria-label="Studio sections"
		>
			<div class="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-x xl:grid-cols-4 xl:divide-y-0">
				{#each quickLinks as link (link.href)}
					<a
						href={link.href}
						class="group flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-200 hover:bg-bone/[0.025] sm:first:pl-5 xl:border-l xl:border-hairline xl:first:border-l-0"
					>
						<span class="flex min-w-0 items-center gap-3">
							<span
								class="flex size-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas/60 text-signal/80"
							>
								<link.icon class="size-3.5" aria-hidden="true" />
							</span>
							<span class="min-w-0">
								<span class="block text-[12px] font-semibold text-bone">{link.label}</span>
								<span class="mt-0.5 block truncate text-[10px] text-muted-warm">{link.detail}</span>
							</span>
						</span>
						<ArrowUpRight
							class="size-3.5 shrink-0 text-muted-warm transition-colors duration-200 group-hover:text-signal"
							aria-hidden="true"
						/>
					</a>
				{/each}
			</div>
		</nav>
	{/if}
</div>
