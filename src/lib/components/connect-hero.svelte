<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import BatteryMedium from '@lucide/svelte/icons/battery-medium';
	import Bluetooth from '@lucide/svelte/icons/bluetooth';
	import Headphones from '@lucide/svelte/icons/headphones';
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import Waves from '@lucide/svelte/icons/waves';
	import { Button } from '#lib/components/ui/button/index.js';
	import { openConnect } from '#lib/ui.svelte.js';

	let { onDismiss }: { onDismiss: () => void } = $props();

	const specs = [
		{ icon: BatteryMedium, label: 'One battery', value: 'Up to 50 h' },
		{ icon: Waves, label: 'Scene ANC', value: 'Five places' },
		{ icon: AudioLines, label: 'Codec', value: 'LDAC' }
	];
</script>

<section
	class="studio-reveal relative isolate overflow-hidden rounded-[26px] border border-hairline bg-surface"
	style="--reveal-delay: 90ms"
	aria-labelledby="connect-hero-title"
>
	<div aria-hidden="true" class="pointer-events-none absolute inset-0">
		<div
			class="absolute -left-24 -top-32 size-[26rem] rounded-full bg-signal/[0.055] blur-3xl"
		></div>
		<div
			class="absolute -bottom-40 right-0 size-[24rem] rounded-full bg-ember/[0.04] blur-3xl"
		></div>
		<div
			class="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-signal/25 to-transparent"
		></div>
	</div>

	<div
		class="relative grid items-center gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-12 lg:px-12 lg:py-14"
	>
		<div class="flex min-w-0 flex-col items-start">
			<p class="eyebrow flex items-center gap-2.5">
				<span class="size-1.5 rounded-full bg-signal" aria-hidden="true"></span>
				QCY H3 Pro · JL A002
			</p>

			<h2
				id="connect-hero-title"
				class="display mt-4 max-w-[15ch] text-[2.7rem] leading-[0.94] text-balance text-bone sm:text-[3.6rem] lg:text-[4rem]"
			>
				Connect your <span class="display-italic text-signal">H3 Pro.</span>
			</h2>

			<p
				class="mt-5 max-w-[46ch] text-[13px] leading-relaxed text-muted-warm text-pretty sm:text-sm"
			>
				One pair of over-ear headphones, one battery, five noise scenes. The studio reads the
				H3 Pro directly and tunes every control to it — no device layouts to sort out.
			</p>

			<div class="mt-7 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
				<Button
					size="lg"
					class="h-11 w-full gap-2 px-5 text-[13px] font-semibold sm:w-auto"
					onclick={openConnect}
				>
					<Bluetooth data-icon="inline-start" />
					Connect H3 Pro
					<ArrowRight data-icon="inline-end" class="size-3.5" />
				</Button>
				<Button
					variant="ghost"
					size="lg"
					class="h-11 w-full px-4 text-[13px] text-muted-warm hover:text-bone sm:w-auto"
					onclick={onDismiss}
				>
					Preview the H3 Pro demo
				</Button>
			</div>

			<p class="mt-4 text-[11px] font-medium text-muted-warm/80">
				Web Bluetooth · Chrome or Edge · No account needed
			</p>

			<dl class="mt-8 grid w-full max-w-xl grid-cols-1 gap-0 border-t border-hairline sm:grid-cols-3">
				{#each specs as spec, index (spec.label)}
					<div
						class="flex items-center gap-3 border-b border-hairline px-0 py-3.5 sm:border-b-0 sm:px-4 sm:first:pl-0 sm:last:pr-0 {index >
						0
							? 'sm:border-l sm:border-hairline'
							: ''}"
					>
						<spec.icon class="size-4 shrink-0 text-signal/80" aria-hidden="true" />
						<div>
							<dt class="text-[10px] font-medium text-muted-warm">{spec.label}</dt>
							<dd class="mt-0.5 text-[12px] font-semibold text-bone">{spec.value}</dd>
						</div>
					</div>
				{/each}
			</dl>
		</div>

		<div
			class="relative mx-auto flex aspect-[1/1.05] w-full max-w-[19rem] items-center justify-center sm:max-w-[22rem] lg:max-w-[24rem]"
			aria-hidden="true"
		>
			<div class="absolute inset-0 rounded-[26px] border border-hairline bg-[#0e0e0c] inset-hairline"></div>
			<div class="absolute inset-[7%] rounded-[22px] border border-hairline-soft"></div>
			<div
				class="absolute inset-[19%] rounded-full border border-bone/[0.07] bg-[radial-gradient(circle_at_50%_38%,rgba(243,239,230,0.09),rgba(18,18,16,0.4)_66%)]"
			></div>

			<span
				class="display absolute left-5 top-4 text-[2.6rem] leading-none text-bone/[0.08] sm:text-[3.2rem]"
			>
				H3
			</span>

			<Headphones class="absolute size-[46%] text-bone" strokeWidth={0.75} />

			<span
				class="absolute bottom-[23%] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-hairline bg-canvas/85 px-3 py-1.5 backdrop-blur"
			>
				<span class="size-1 rounded-full bg-signal"></span>
				<span class="text-[10px] font-semibold text-bone">H3 Pro</span>
			</span>

			<span class="absolute left-5 top-1/2 h-10 w-px bg-signal/35"></span>
			<span class="absolute right-5 top-4 text-[9px] font-medium text-muted-warm">JL A002</span>
			<span class="absolute bottom-4 right-5 text-[9px] font-medium text-muted-warm">
				RCSP · BLE
			</span>

			<span class="absolute left-[18%] top-[22%] size-1 rounded-full bg-signal/70"></span>
			<span class="absolute bottom-[27%] right-[17%] size-1 rounded-full bg-ember/70"></span>
		</div>
	</div>
</section>
