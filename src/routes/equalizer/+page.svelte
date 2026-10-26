<script lang="ts">
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import Check from '@lucide/svelte/icons/check';
	import Gauge from '@lucide/svelte/icons/gauge';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Send from '@lucide/svelte/icons/send';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { toast } from 'svelte-sonner';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Slider } from '#lib/components/ui/slider/index.js';
	import { ToggleGroup, ToggleGroupItem } from '#lib/components/ui/toggle-group/index.js';
	import EqCurve from '#lib/components/eq-curve.svelte';
	import EqRestartDialog from '#lib/components/eq-restart-dialog.svelte';
	import PageHeading from '#lib/components/page-heading.svelte';
	import { EQ_MAX_GAIN, EQ_MIN_GAIN } from '#lib/ble/constants.js';
	import { device, presets } from '#lib/device.svelte.js';
	import type { EqPreset, EqProtocol } from '#lib/schemas.js';
	import { cn } from '#lib/utils.js';

	type ApplyDialogMode = 'normal' | 'spatial-ldac' | 'leaving-spatial';

	const accentDot: Record<EqPreset['accent'], string> = {
		lime: 'bg-signal',
		cyan: 'bg-ember',
		violet: 'bg-bone/60',
		pink: 'bg-ember/75'
	};

	let protocol = $state<EqProtocol>(device.eqProtocol);
	let applyDialogOpen = $state(false);
	let applyDialogMode = $state<ApplyDialogMode>('normal');

	/**
	 * The official H3 Pro preset basis and the custom basis have different
	 * band edges. Label the listening map with the basis the controller is
	 * actually editing, not always the official 30 Hz–11 kHz set.
	 */
	const ranges = $derived(
		device.eqTarget === 'official'
			? [
					{ range: '30–120 Hz', copy: 'Weight and rumble. A small lift adds body without mud.' },
					{ range: '220 Hz–2.8 kHz', copy: 'Voices, snare, and presence. This is where speech lives.' },
					{ range: '6–16 kHz', copy: 'Air and detail. Ease off here if the top end feels sharp.' }
				]
			: [
					{ range: '32–125 Hz', copy: 'The custom basis adds sub-bass weight without the official preset’s tuning.' },
					{ range: '250 Hz–2 kHz', copy: 'Body and presence on the panel’s custom 250 Hz–2 kHz bands.' },
					{ range: '4–16 kHz', copy: 'Air and detail across the custom 4 kHz–16 kHz top end.' }
				]
	);

	const linkState = $derived(
		device.connected
			? 'Live'
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

	const linkTone = $derived(
		device.connected ? 'text-signal' : device.isDemo ? 'text-muted-warm' : 'text-ember'
	);

	function formatGain(gain: number): string {
		const rounded = Number(gain.toFixed(1));
		if (rounded === 0) return '0';
		return `${rounded > 0 ? '+' : ''}${rounded}`;
	}

	function formatFrequency(freq: number): string {
		if (freq >= 1000) return `${Number((freq / 1000).toFixed(1))}k`;
		return `${freq}`;
	}

	function formatRangeFrequency(freq: number): string {
		if (freq >= 1000) return `${Number((freq / 1000).toFixed(1))} kHz`;
		return `${freq} Hz`;
	}

	function previewPreset(preset: EqPreset): void {
		if (preset.id === device.eqPresetId && !device.eqDirty) return;
		device.selectPreset(preset);
		const spatial = device.isSpatialPreset;
		toast.success(`${preset.name} previewed`, {
			description:
				spatial && device.ldacEnabled
					? 'LDAC is on. Apply EQ will ask you to disable it; the H3 Pro restarts when Spatial Audio is written.'
					: spatial
						? 'Spatial Audio is local only until Apply EQ. Leaving it later restarts the H3 Pro.'
						: `This official curve is local only. Apply EQ writes it once to slot ${preset.deviceIndex}.`
		});
	}

	async function resetCurve(): Promise<void> {
		await device.resetEq({ apply: false });
		toast.success('Official Default curve loaded locally', {
			description: 'Nothing was sent. Apply EQ when you are ready.'
		});
	}

	function requestApply(): void {
		if (!device.eqDirty || device.eqApplying) return;

		// Spatial Audio is official preset id 10/18, not a toggle. The app asks
		// for LDAC to be disabled only when the spatial curve is the target.
		if (device.isSpatialPreset && device.ldacEnabled) {
			applyDialogMode = 'spatial-ldac';
			applyDialogOpen = true;
			return;
		}

		// The reboot warning applies only when the last written preset was
		// spatial and the user is now applying a different curve.
		if (device.isSpatialApplied && !device.isSpatialPreset) {
			applyDialogMode = 'leaving-spatial';
			applyDialogOpen = true;
			return;
		}

		// Normal presets and custom edits are already an explicit one-write
		// action: Apply EQ. No generic restart dialog is needed.
		void runApply();
	}

	async function runApply(options: { rethrow?: boolean } = {}): Promise<void> {
		if (!device.eqDirty || device.eqApplying) return;
		const applyingSpatial = device.isSpatialPreset;
		const leavingSpatial = device.isSpatialApplied && !applyingSpatial;
		try {
			await device.applyEq();
			if (device.eqDirty) {
				toast.warning('Curve kept locally', {
					description: 'Reconnect H3 Pro before applying. Nothing was sent.'
				});
				return;
			}

			if (device.isDemo) {
				toast.success(applyingSpatial ? 'Spatial Audio applied in demo' : 'EQ applied in demo', {
					description: applyingSpatial
						? 'Demo mode mirrors the H3 Pro: LDAC is now off and leaving Spatial Audio will simulate a restart.'
						: 'Demo mode updates the curve locally.'
				});
				return;
			}

			toast.success(
				applyingSpatial
					? 'Spatial Audio applied'
					: leavingSpatial
						? 'EQ applied · H3 Pro restarting'
						: 'EQ applied',
				{
					description: applyingSpatial
						? 'The spatial preset turned LDAC off. If the H3 Pro restarts, the studio reconnects automatically.'
						: leavingSpatial
							? 'The H3 Pro restarts after leaving Spatial Audio. The studio reconnects automatically.'
							: `Written once to ${device.eqTargetDescription}. Official, market, and custom EQ applies do not restart the headphones.`
				}
			);
		} catch (error) {
			toast.error('EQ could not be sent', {
				description:
					error instanceof Error ? error.message : 'Reconnect the headphones and try again.'
			});
			if (options.rethrow) throw error;
		}
	}

	async function confirmApply(): Promise<void> {
		await runApply({ rethrow: true });
	}

	function setProtocol(value: string): void {
		if (value === 'multi' || value === 'legacy') {
			protocol = value;
			device.setEqProtocol(value);
			toast.success(value === 'legacy' ? 'Legacy EQ selected' : 'Multi-band EQ selected');
		} else {
			protocol = device.eqProtocol;
		}
	}
</script>

<div class="flex flex-col gap-5">
	<PageHeading
		eyebrow="QCY H3 Pro · 10-band EQ"
		title="Shape it here. Send it once."
		description="Faders and preset previews stay local. Apply EQ writes the selected curve once: official presets use slots 1–6/10, market curves slot 126, and your slider edits slot 128. None of those normal applies restart the H3 Pro; Spatial Audio requires LDAC off and may restart it."
	>
		<Badge
			variant="outline"
			class={cn(
				'h-8 gap-2 border-hairline bg-surface px-3 text-[11px]',
				device.eqDirty ? 'text-ember' : 'text-muted-warm'
			)}
		>
			<span
				class={cn('size-1.5 rounded-full', device.eqApplying ? 'bg-ember' : device.eqDirty ? 'bg-ember' : 'bg-signal')}
			></span>
			{device.eqApplying ? 'Sending EQ' : device.eqDirty ? 'Unsaved changes' : 'All changes applied'}
		</Badge>
		<Badge
			variant="outline"
			class={cn(
				'h-8 gap-2 border-hairline bg-surface px-3 text-[11px] tabular',
				device.isCustomEq
					? 'text-ember'
					: device.isMarketEq
						? 'text-bone'
						: 'text-signal'
			)}
		>
			<span
				class={cn(
					'size-1.5 rounded-full',
					device.isCustomEq ? 'bg-ember' : device.isMarketEq ? 'bg-bone/60' : 'bg-signal'
				)}
			></span>
			{device.eqTargetLabel}
		</Badge>
		<Button
			class="h-8"
			disabled={!device.eqDirty || device.eqApplying}
			onclick={requestApply}
		>
			{#if device.eqApplying}
				<LoaderCircle data-icon="inline-start" class="animate-spin" />
				Applying…
			{:else}
				<Send data-icon="inline-start" />
				Apply EQ
			{/if}
		</Button>
	</PageHeading>

	<div class="studio-reveal grid gap-4 xl:grid-cols-12" style="--reveal-delay: 90ms">
		<div class="flex min-w-0 flex-col gap-4 xl:col-span-8">
			<section
				class="overflow-hidden rounded-[24px] border border-hairline bg-surface"
				aria-busy={device.eqApplying}
			>
				<div class="flex flex-wrap items-start justify-between gap-3 px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
					<div>
						<p class="eyebrow">Current curve · local preview</p>
						<div class="mt-1.5 flex flex-wrap items-baseline gap-2.5">
							<h3 class="display text-[2rem] leading-none text-bone">
								{device.currentPreset?.name ?? 'Custom curve'}
							</h3>
							<span
								class="inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[9px] font-semibold tabular text-muted-warm"
							>
								{#if device.isCustomEq}
									<Sparkles class="size-2.5" />
								{/if}
								{device.eqTargetLabel}
							</span>
						</div>
						<p class="mt-1.5 text-[11px] text-muted-warm">
							{device.eqDirty
								? 'Edited locally — not yet sent.'
								: 'Matches the last applied curve.'}
							{device.isCustomEq
								? ' Custom edits use the panel basis 32 Hz–16 kHz at slot 128.'
								: device.isMarketEq
									? ' Market curves use the custom basis at slot 126.'
									: ' Official presets keep their exact panel basis and slot.'}
						</p>
					</div>
					<div class="flex items-center gap-2">
						<Badge variant="outline" class="border-hairline bg-transparent text-muted-warm">
							10 bands
						</Badge>
						<span class="flex items-center gap-1.5 text-[10px] font-medium text-muted-warm">
							<span class={cn('status-dot', linkTone)} aria-hidden="true"></span>
							{linkState}
						</span>
					</div>
				</div>

				<div class="px-2 pb-1 pt-3 sm:px-4">
					<EqCurve
						gains={device.eqGains}
						frequencies={device.bandFrequencies}
						height={264}
					/>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-5 py-3.5 sm:px-6">
					<span class="text-[10px] font-medium text-muted-warm">
						±15 dB · {formatRangeFrequency(device.bandFrequencies[0] ?? 30)} –
						{formatRangeFrequency(device.bandFrequencies.at(-1) ?? 11_000)}
					</span>
					<span class="text-[10px] font-medium tabular text-muted-warm">
						Master {formatGain(device.masterGain)} dB
					</span>
					<span class="text-[10px] font-medium text-muted-warm">
						{device.eqApplying ? 'Sending one frame…' : device.eqDirty ? 'Apply to write' : 'Saved'}
					</span>
				</div>
			</section>

			<section class="overflow-hidden rounded-[24px] border border-hairline bg-surface">
				<div class="flex flex-wrap items-start justify-between gap-3 px-5 pb-0 pt-5 sm:px-6">
					<div>
						<p class="eyebrow">Band gain</p>
						<h3 class="display mt-1.5 text-[1.65rem] leading-none text-bone">Ten faders, one curve</h3>
						<p class="mt-1.5 text-[11px] leading-relaxed text-muted-warm">
							Drag any band. The first edit after a built-in or market curve switches to the
							custom basis (32 Hz–16 kHz, panel Q values) and targets slot 128. Edits stay local
							until Apply EQ.
						</p>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<Badge variant="outline" class="border-hairline bg-transparent text-[10px] text-muted-warm">
							{device.isOfficialEq ? 'Official basis' : device.isMarketEq ? 'Custom basis · market' : 'Custom basis'}
						</Badge>
						<Badge variant="outline" class="border-hairline bg-transparent text-[10px] text-muted-warm tabular">
							±15 dB
						</Badge>
					</div>
				</div>

				<div class="px-2 pb-6 pt-6 sm:px-4">
					<div class="grid grid-cols-5 gap-x-1 gap-y-7 sm:gap-x-2 lg:grid-cols-10">
						{#each device.bands as band, index (band.freq)}
							<div class="flex flex-col items-center gap-2">
								<span
									class={cn(
										'h-4 text-[11px] font-semibold tabular',
										Math.abs(band.gain) > 0.05 ? 'text-signal' : 'text-muted-warm'
									)}
								>
									{formatGain(band.gain)}
								</span>
								<div class="relative flex h-44 items-center justify-center">
									<Slider
										type="single"
										orientation="vertical"
										class="h-44"
										min={EQ_MIN_GAIN}
										max={EQ_MAX_GAIN}
										step={0.5}
										value={band.gain}
										onValueChange={(value: number) => device.setBandGain(index, value)}
										aria-label={`${formatFrequency(band.freq)} hertz band gain`}
									/>
									<span
										aria-hidden="true"
										class="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px bg-bone/15"
									></span>
								</div>
								<span class="text-[10px] font-semibold tabular text-muted-warm">
									{formatFrequency(band.freq)}
								</span>
								<span class="text-[9px] leading-none tabular text-muted-warm/70">
									Q {band.q}
								</span>
							</div>
						{/each}
					</div>
				</div>
			</section>

			<section class="rounded-[18px] border border-hairline bg-surface/60 p-4">
				<div class="flex items-start gap-3">
					<span
						class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-signal/25 bg-signal/[0.06] text-signal"
					>
						<RefreshCw class="size-3.5" />
					</span>
					<div>
						<p class="text-[12px] font-semibold text-bone">One write, one spatial exception</p>
						<p class="mt-1 text-[11px] leading-relaxed text-muted-warm text-pretty">
							Official presets, market curves, and custom edits each apply in one frame without
							restarting the H3 Pro. They target different slots: the official panel ids 1–6/10,
							market slot 126, and custom edit slot 128. Spatial Audio is the official preset at
							slot 10: applying it turns LDAC off on the headphones and may restart them. The
							studio reconnects automatically. Faders and preset previews stay local until
							Apply EQ.
						</p>
					</div>
				</div>
			</section>
		</div>

		<div class="flex min-w-0 flex-col gap-4 xl:col-span-4">
			<section class="overflow-hidden rounded-[24px] border border-hairline bg-surface">
				<div class="border-b border-hairline px-5 py-4">
					<p class="eyebrow">H3 Pro presets</p>
					<h3 class="display mt-1.5 text-[1.65rem] leading-none text-bone">Official starting points</h3>
					<p class="mt-1.5 text-[11px] leading-relaxed text-muted-warm">
						All seven built-ins from the H3 Pro panel. Selecting one previews its exact curve;
						Apply EQ writes it once to its official slot (1–6/10). Moving a fader after a
						built-in switches to the custom basis at slot 128. Spatial Audio (id 10) runs with
						LDAC off and may restart the headphones.
					</p>
				</div>

				<div class="flex flex-wrap gap-2 p-5">
					{#each presets as preset (preset.id)}
						{@const active = device.eqPresetId === preset.id}
						<button
							type="button"
							aria-pressed={active}
							disabled={device.eqApplying}
							class={cn(
								'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold transition-colors duration-200 disabled:opacity-60',
								active
									? 'border-signal/45 bg-signal/10 text-signal'
									: 'border-hairline bg-canvas/30 text-muted-warm hover:border-hairline hover:bg-bone/[0.04] hover:text-bone'
							)}
							onclick={() => previewPreset(preset)}
						>
							<span class={cn('size-1.5 rounded-full', accentDot[preset.accent])}></span>
							{preset.name}
							{#if active && !device.eqDirty}
								<Check class="size-3" />
							{/if}
						</button>
					{/each}
				</div>

				<div class="border-t border-hairline px-5 py-3.5">
					<p class="text-[10px] leading-relaxed text-muted-warm">
						Balanced maps to panel id 1; Pop, Bass, Rock, Soft, and Classical use ids 2–6;
						Spatial Audio uses id 10. Market curves use slot 126 and your own fader edits use
						slot 128, so official presets and market curves stay intact.
					</p>
				</div>
			</section>

			<section class="overflow-hidden rounded-[24px] border border-hairline bg-surface">
				<div class="flex items-start justify-between gap-3 px-5 pb-0 pt-5">
					<div>
						<p class="eyebrow">Master gain</p>
						<h3 class="display mt-1.5 text-[1.5rem] leading-none text-bone">Global trim</h3>
					</div>
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas/50 text-signal"
					>
						<Gauge class="size-3.5" />
					</span>
				</div>

				<div class="px-5 pb-5 pt-4">
					<p class="display text-[2.1rem] leading-none tabular text-bone">
						{formatGain(device.masterGain)}<span class="ml-1 font-sans text-xs font-medium text-muted-warm">dB</span>
					</p>
					<Slider
						type="single"
						class="mt-5"
						min={EQ_MIN_GAIN}
						max={EQ_MAX_GAIN}
						step={0.5}
						value={device.masterGain}
						onValueChange={(value: number) => device.setMasterGain(value)}
						aria-label="Master gain"
					/>
					<div class="mt-1 flex justify-between text-[10px] font-medium text-muted-warm tabular">
						<span>-15</span>
						<span>0</span>
						<span>+15</span>
					</div>
					<p class="mt-3 text-[10px] leading-relaxed text-muted-warm">
						{device.isCustomEq
							? 'Custom master trim — written with the custom basis to slot 128.'
							: 'Changing this fader switches to a custom edit on the custom basis (slot 128).'}
					</p>
				</div>
			</section>

			<section class="overflow-hidden rounded-[24px] border border-hairline bg-surface">
				<div class="flex items-start justify-between gap-3 px-5 pb-0 pt-5">
					<div>
						<p class="eyebrow">EQ protocol</p>
						<h3 class="display mt-1.5 text-[1.5rem] leading-none text-bone">Write format</h3>
					</div>
					<Badge variant="outline" class="border-hairline bg-transparent text-[9px] text-muted-warm">
						Auto fallback
					</Badge>
				</div>

				<div class="px-5 pb-5 pt-4">
					<ToggleGroup
						type="single"
						bind:value={protocol}
						onValueChange={setProtocol}
						aria-label="EQ protocol"
						class="w-full rounded-full border border-hairline bg-canvas/50 p-1"
					>
						<ToggleGroupItem
							value="multi"
							class="flex-1 rounded-full text-[11px] font-semibold data-[state=on]:bg-signal data-[state=on]:text-primary-foreground"
						>
							Multi-band
						</ToggleGroupItem>
						<ToggleGroupItem
							value="legacy"
							class="flex-1 rounded-full text-[11px] font-semibold data-[state=on]:bg-signal data-[state=on]:text-primary-foreground"
						>
							Legacy
						</ToggleGroupItem>
					</ToggleGroup>
					<p class="mt-3 text-[10px] leading-relaxed text-muted-warm">
						Multi-band sends all ten gains, frequencies, Q values, and per-band types in one
						packet. The controller falls back automatically if the H3 Pro rejects it.
					</p>
				</div>
			</section>

			<section class="rounded-[18px] border border-hairline bg-surface/60">
				<div class="flex items-center justify-between gap-3 px-4 py-4">
					<div>
						<p class="text-[12px] font-semibold text-bone">Reset locally</p>
						<p class="mt-0.5 text-[10px] text-muted-warm">Load the official Default curve, then apply.</p>
					</div>
					<Button variant="outline" size="sm" disabled={device.eqApplying} onclick={() => void resetCurve()}>
						<RotateCcw data-icon="inline-start" />
						Reset
					</Button>
				</div>
			</section>

			<section class="overflow-hidden rounded-[24px] border border-hairline bg-surface">
				<div class="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
					<div>
						<p class="eyebrow">Listening map</p>
						<h3 class="display mt-1.5 text-[1.5rem] leading-none text-bone">How it sounds</h3>
					</div>
					<AudioLines class="mt-1 size-4 text-signal/70" />
				</div>
				<div class="flex flex-col gap-3 px-5 py-4">
					{#each ranges as range (range.range)}
						<div>
							<p class="text-[10px] font-semibold tabular text-signal">{range.range}</p>
							<p class="mt-0.5 text-[10px] leading-relaxed text-muted-warm">{range.copy}</p>
						</div>
					{/each}
					<p class="rounded-[12px] border border-hairline bg-canvas/40 px-3 py-2 text-[10px] leading-relaxed text-muted-warm">
						±3 dB is usually enough. Big boosts can mask detail instead of adding it.
					</p>
				</div>
			</section>
		</div>
	</div>

	<!-- Obvious, sticky commit bar: the only path that writes EQ. It appears
	     only when there is something to send so it does not cover the faders. -->
	{#if device.eqDirty || device.eqApplying}
		<div
			class="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 mt-1 lg:bottom-4"
			role="status"
			aria-live="polite"
		>
			<div
				class={cn(
					'flex flex-col gap-3 rounded-[18px] border bg-surface-raised/95 px-4 py-3 shadow-[0_18px_60px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between',
					device.eqDirty ? 'border-signal/30' : 'border-hairline'
				)}
			>
				<div class="flex min-w-0 items-start gap-3">
					<span
						class={cn(
							'flex size-9 shrink-0 items-center justify-center rounded-full border',
							device.eqDirty
								? 'border-signal/30 bg-signal/10 text-signal'
								: 'border-hairline bg-canvas/50 text-muted-warm'
						)}
					>
						{#if device.eqApplying}
							<LoaderCircle class="size-4 animate-spin" />
						{:else}
							<Send class="size-4" />
						{/if}
					</span>
					<div class="min-w-0">
						<p class="text-[12px] font-semibold text-bone">
							{device.eqApplying ? 'Sending the curve once…' : 'Unsaved EQ changes'}
						</p>
						<p class="mt-0.5 max-w-[60ch] text-[10px] leading-relaxed text-muted-warm text-pretty">
							{device.eqApplying
								? `Sending the curve once to ${device.eqTargetDescription}. Spatial Audio may restart the H3 Pro.`
								: `Apply EQ writes one frame to ${device.eqTargetDescription}. Official, market, and custom applies do not restart; applying Spatial Audio or leaving it may reconnect the headphones.`}
						</p>
					</div>
				</div>

				<Button
					class="h-10 shrink-0 px-4"
					disabled={!device.eqDirty || device.eqApplying}
					onclick={requestApply}
				>
					{#if device.eqApplying}
						<LoaderCircle data-icon="inline-start" class="animate-spin" />
						Applying…
					{:else}
						<Send data-icon="inline-start" />
						Apply EQ
					{/if}
				</Button>
			</div>
		</div>
	{/if}

	<EqRestartDialog bind:open={applyDialogOpen} mode={applyDialogMode} onconfirm={confirmApply} />
</div>
