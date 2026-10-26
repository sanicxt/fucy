<script lang="ts">
	import type { LucideIcon } from '@lucide/svelte';
	import AudioWaveform from '@lucide/svelte/icons/audio-waveform';
	import Check from '@lucide/svelte/icons/check';
	import Ear from '@lucide/svelte/icons/ear';
	import Headphones from '@lucide/svelte/icons/headphones';
	import House from '@lucide/svelte/icons/house';
	import Shield from '@lucide/svelte/icons/shield';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import TrainFront from '@lucide/svelte/icons/train-front';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import Wind from '@lucide/svelte/icons/wind';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import PageHeading from '#lib/components/page-heading.svelte';
	import { H3_PRO_ANC_SCENES, type H3ProAncScene } from '#lib/data/devices.js';
	import { device } from '#lib/device.svelte.js';
	import type { AncMode } from '#lib/schemas.js';
	import { cn } from '#lib/utils.js';

	type Mode = {
		id: AncMode;
		label: string;
		blurb: string;
		icon: LucideIcon;
	};

	const modes: Mode[] = [
		{
			id: 'anc',
			label: 'ANC',
			blurb: 'Actively cancels steady noise — engines, rail, air conditioning.',
			icon: Shield
		},
		{
			id: 'transparency',
			label: 'Transparency',
			blurb: 'Lets the room in so you can hear announcements and conversation.',
			icon: Ear
		},
		{
			id: 'normal',
			label: 'Normal',
			blurb: 'Turns processing off for the most natural, unprocessed sound.',
			icon: VolumeX
		}
	];

	const sceneMeta: Record<H3ProAncScene['id'], { description: string; icon: LucideIcon }> = {
		adaptive: {
			description: 'Adjusts itself as the noise around you changes.',
			icon: Sparkles
		},
		noisy: {
			description: 'Maximum cancellation for planes, trains, and busy streets.',
			icon: AudioWaveform
		},
		commute: {
			description: 'Cuts engine rumble while keeping announcements audible.',
			icon: TrainFront
		},
		indoor: {
			description: 'Softens office hum, fans, and air conditioning.',
			icon: House
		},
		wind: {
			description: 'Reduces wind buffeting on exposed walks and rides.',
			icon: Wind
		}
	};

	const activeMode = $derived(modes.find((mode) => mode.id === device.ancMode) ?? modes[0]);
	const activeScene = $derived(
		H3_PRO_ANC_SCENES.find((scene) => scene.id === device.ancScene)
	);
	const activeSceneLabel = $derived(activeScene?.label ?? 'Noisy');

	const modeStatus = $derived(
		device.ancMode === 'anc'
			? `ANC · ${activeSceneLabel}`
			: device.ancMode === 'transparency'
				? 'Transparency on'
				: 'Processing off'
	);
</script>

<div class="flex flex-col gap-5">
	<PageHeading
		eyebrow="QCY H3 Pro · scene-based ANC"
		title="Noise, without a slider."
		description="The H3 Pro stores a listening scene instead of a 0–100 depth. Pick the mode and the scene that matches where you are."
	>
		{#if device.capabilities.anc}
			<Badge
				variant="outline"
				class="h-8 gap-2 overflow-visible border-hairline bg-surface px-3 text-[11px] text-bone"
			>
				<span class="status-dot status-dot--live text-signal" aria-hidden="true"></span>
				{modeStatus}
			</Badge>
		{/if}
	</PageHeading>

	{#if device.capabilities.anc}
		<div class="studio-reveal grid gap-4 xl:grid-cols-12" style="--reveal-delay: 90ms">
			<div class="flex flex-col gap-4 xl:col-span-8">
				<!-- One mode console, not three independent cards. -->
				<section class="overflow-hidden rounded-[24px] border border-hairline bg-surface">
					<div class="border-b border-hairline p-5 sm:p-6">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p class="eyebrow">Active mode</p>
								<h3 class="display mt-2 text-[2rem] leading-none text-bone">
									{activeMode.label}
								</h3>
								<p class="mt-2 max-w-md text-[11px] leading-relaxed text-muted-warm text-pretty">
									{activeMode.blurb}
								</p>
							</div>
							<span
								class="hidden size-10 items-center justify-center rounded-full border border-hairline bg-canvas/50 text-signal sm:flex"
							>
								<activeMode.icon class="size-4" />
							</span>
						</div>

						<div
							role="group"
							aria-label="Noise mode"
							class="mt-5 grid w-full grid-cols-3 gap-1 rounded-full border border-hairline bg-canvas/50 p-1"
						>
							{#each modes as mode (mode.id)}
								{@const selected = device.ancMode === mode.id}
								<button
									type="button"
									aria-pressed={selected}
									class={cn(
										'flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[11px] font-semibold transition-colors duration-200',
										selected
											? 'bg-signal text-primary-foreground'
											: 'text-muted-warm hover:bg-bone/[0.05] hover:text-bone'
									)}
									onclick={() => device.setAncMode(mode.id)}
								>
									<mode.icon class="size-3.5" aria-hidden="true" />
									<span class="hidden sm:inline">{mode.label}</span>
									<span class="sm:hidden">{mode.label === 'Transparency' ? 'Transp.' : mode.label}</span>
								</button>
							{/each}
						</div>
					</div>

					<div class="p-5 sm:p-6">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p class="eyebrow">ANC scenes</p>
								<h4 class="display mt-1.5 text-[1.65rem] leading-none text-bone">
									{device.ancMode === 'anc' ? `Scene · ${activeSceneLabel}` : 'Scenes pause outside ANC'}
								</h4>
								<p class="mt-1.5 text-[11px] leading-relaxed text-muted-warm text-pretty">
									{device.ancMode === 'anc'
										? 'Five listening environments tuned for the H3 Pro. Changes apply live.'
										: 'Switch to ANC to choose Adaptive, Noisy, Commute, Indoor, or Wind.'}
								</p>
							</div>
							{#if device.ancMode !== 'anc'}
								<Button variant="outline" size="sm" onclick={() => device.setAncMode('anc')}>
									<Shield data-icon="inline-start" />
									Switch to ANC
								</Button>
							{/if}
						</div>

						<div class={cn('mt-5 grid gap-2.5 sm:grid-cols-2', device.ancMode !== 'anc' && 'opacity-55')}>
							{#each H3_PRO_ANC_SCENES as scene (scene.id)}
								{@const meta = sceneMeta[scene.id]}
								{@const active = device.ancScene === scene.id}
								<button
									type="button"
									aria-pressed={active}
									disabled={device.ancMode !== 'anc'}
									class={cn(
										'group relative flex items-start gap-3 rounded-[16px] border p-3.5 text-left transition-colors duration-200 disabled:cursor-not-allowed',
										scene.id === 'adaptive' && 'sm:col-span-2',
										active
											? 'border-signal/40 bg-signal/[0.055]'
											: 'border-hairline bg-canvas/30 hover:border-hairline hover:bg-bone/[0.025] disabled:hover:bg-canvas/30'
									)}
									onclick={() => device.setAncScene(scene.id)}
								>
									<span
										class={cn(
											'flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200',
											active
												? 'border-signal/30 bg-signal/10 text-signal'
												: 'border-hairline bg-surface text-muted-warm'
										)}
									>
										<meta.icon class="size-4" />
									</span>

									<span class="min-w-0 flex-1">
										<span class="flex flex-wrap items-center gap-2">
											<span class="text-[12px] font-semibold text-bone">{scene.label}</span>
											{#if active}
												<span class="inline-flex items-center gap-1 text-[9px] font-semibold text-signal">
													<Check class="size-3" />
													Active
												</span>
											{/if}
										</span>
										<span class="mt-1 block text-[10px] leading-relaxed text-muted-warm text-pretty">
											{meta.description}
										</span>
									</span>
								</button>
							{/each}
						</div>

						<p
							class="mt-4 flex items-center gap-2 border-t border-hairline pt-3.5 text-[10px] font-medium text-muted-warm"
							aria-live="polite"
						>
							<span class="size-1.5 rounded-full bg-signal" aria-hidden="true"></span>
							{#if device.ancMode === 'anc'}
								{activeSceneLabel} is active. Scene changes apply live and do not restart the
								H3 Pro.
							{:else}
								Scenes resume as soon as ANC is selected.
							{/if}
						</p>
					</div>
				</section>
			</div>

			<aside class="flex flex-col gap-4 xl:col-span-4">
				<section class="overflow-hidden rounded-[24px] border border-hairline bg-surface">
					<div class="border-b border-hairline p-5">
						<p class="eyebrow">H3 Pro behaviour</p>
						<h3 class="display mt-1.5 text-[1.65rem] leading-tight text-bone">
							How the H3 Pro listens
						</h3>
					</div>
					<div class="flex flex-col divide-y divide-hairline-soft px-5">
						<div class="flex gap-3 py-4">
							<span
								class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas/50 text-signal/80"
							>
								<Shield class="size-3.5" />
							</span>
							<div>
								<p class="text-[12px] font-semibold text-bone">Scenes, not depth</p>
								<p class="mt-1 text-[10px] leading-relaxed text-muted-warm text-pretty">
									Each scene applies its own cancellation profile. There is no 0–100 slider on
									JL/A002 firmware.
								</p>
							</div>
						</div>
						<div class="flex gap-3 py-4">
							<span
								class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas/50 text-signal/80"
							>
								<Ear class="size-3.5" />
							</span>
							<div>
								<p class="text-[12px] font-semibold text-bone">Transparency</p>
								<p class="mt-1 text-[10px] leading-relaxed text-muted-warm text-pretty">
									Brings outside sound through the microphones without taking the headphones off.
								</p>
							</div>
						</div>
						<div class="flex gap-3 py-4">
							<span
								class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas/50 text-signal/80"
							>
								<VolumeX class="size-3.5" />
							</span>
							<div>
								<p class="text-[12px] font-semibold text-bone">Normal</p>
								<p class="mt-1 text-[10px] leading-relaxed text-muted-warm text-pretty">
									Cancellation and amplification are off, leaving the driver untouched.
								</p>
							</div>
						</div>
					</div>
					<div class="border-t border-hairline px-5 py-4">
						<p class="text-[10px] leading-relaxed text-muted-warm">
							Noise scenes never restart the headphones. EQ is applied once when you press
							Apply. Normal EQ presets do not restart the H3 Pro; Spatial Audio may, and leaving
							it shows the restart warning. LDAC and multipoint can also trigger a reconnect.
						</p>
					</div>
				</section>

				<div
					class="flex items-center justify-between gap-3 rounded-[18px] border border-hairline bg-surface/60 px-4 py-3.5"
				>
					<div>
						<p class="text-[11px] font-semibold text-bone">Restart-free scene changes</p>
						<p class="mt-0.5 text-[10px] text-muted-warm">Bluetooth stays connected.</p>
					</div>
					<span class="size-2 rounded-full bg-signal/80" aria-hidden="true"></span>
				</div>
			</aside>
		</div>
	{:else}
		<div class="studio-reveal rounded-[24px] border border-hairline bg-surface p-8 text-center sm:p-12" style="--reveal-delay: 90ms">
			<span
				class="mx-auto flex size-12 items-center justify-center rounded-full border border-hairline bg-canvas/50 text-muted-warm"
			>
				<VolumeX class="size-5" />
			</span>
			<h3 class="display mt-4 text-[1.8rem] text-bone">Noise control is H3 Pro only</h3>
			<p class="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-muted-warm text-pretty">
				Connect the QCY H3 Pro to use scene-based ANC, transparency, and normal modes. The rest of
				the studio remains H3 Pro-focused as well.
			</p>
			<Button href="/device" variant="outline" class="mt-4">
				<Headphones data-icon="inline-start" />
				H3 Pro device
			</Button>
		</div>
	{/if}
</div>
