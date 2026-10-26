<script lang="ts">
	import BatteryMedium from '@lucide/svelte/icons/battery-medium';
	import Bluetooth from '@lucide/svelte/icons/bluetooth';
	import Headphones from '@lucide/svelte/icons/headphones';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import { Button } from '#lib/components/ui/button/index.js';
	import { openConnect, showDemoPreview } from '#lib/ui.svelte.js';
	import PageHeading from './page-heading.svelte';

	let { section }: { section: string } = $props();

	const notes = [
		{ label: 'Single H3 Pro battery', icon: BatteryMedium },
		{ label: 'Scene-based ANC', icon: ShieldCheck },
		{ label: 'Ten-band local EQ', icon: SlidersHorizontal }
	];
</script>

<div class="flex flex-col gap-5">
	<PageHeading
		eyebrow="H3 Pro only"
		title={`Connect to use ${section}.`}
		description="This screen reads live values from the QCY H3 Pro. Pair the over-ear headphones first, or preview the full studio with simulated H3 Pro data."
	>
		<Button size="sm" onclick={openConnect}>
			<Bluetooth data-icon="inline-start" />
			Connect H3 Pro
		</Button>
		<Button variant="ghost" size="sm" onclick={showDemoPreview}>Preview demo</Button>
	</PageHeading>

	<section
		aria-labelledby="connect-gate-title"
		class="studio-reveal relative isolate overflow-hidden rounded-[24px] border border-hairline bg-surface"
		style="--reveal-delay: 100ms"
	>
		<div aria-hidden="true" class="pointer-events-none absolute inset-0">
			<div
				class="absolute left-1/2 top-1/2 size-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal/[0.045] blur-3xl sm:size-[30rem]"
			></div>
			<div
				class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/25 to-transparent"
			></div>
		</div>

		<div
			class="relative flex min-h-[22rem] flex-col items-center justify-center gap-7 px-5 py-12 text-center sm:px-8 sm:py-16"
		>
			<div class="relative flex size-36 shrink-0 items-center justify-center sm:size-44" aria-hidden="true">
				<span class="absolute inset-0 rounded-full border border-hairline"></span>
				<span class="absolute inset-[12%] rounded-full border border-hairline-soft"></span>
				<span class="absolute inset-[25%] rounded-full border border-signal/20"></span>
				<span
					class="absolute inset-[35%] rounded-full border border-hairline bg-[radial-gradient(circle_at_50%_30%,rgba(243,239,230,0.08),rgba(18,18,16,0.7)_72%)]"
				></span>
				<Headphones class="relative size-16 text-bone sm:size-20" strokeWidth={0.8} />
				<span class="absolute right-[14%] top-[30%] size-1.5 rounded-full bg-signal"></span>
			</div>

			<div class="flex max-w-md flex-col items-center gap-2.5">
				<p class="eyebrow flex items-center gap-2">
					<span class="size-1.5 rounded-full bg-signal/80" aria-hidden="true"></span>
					Waiting for QCY H3 Pro
				</p>
				<h2 id="connect-gate-title" class="display text-[2rem] leading-tight text-bone sm:text-[2.4rem]">
					The studio is ready.
				</h2>
				<p class="text-[13px] leading-relaxed text-muted-warm text-pretty sm:text-sm">
					Connect over Web Bluetooth and the H3 Pro identity, single battery, ANC scenes, and
					equalizer load automatically. Nothing else is requested.
				</p>
			</div>

			<ul
				class="flex w-full max-w-xl flex-wrap items-center justify-center gap-x-5 gap-y-2.5"
				aria-label="What loads after pairing"
			>
				{#each notes as note (note.label)}
					{@const Icon = note.icon}
					<li class="flex items-center gap-1.5 text-[11px] font-medium text-muted-warm">
						<Icon class="size-3.5 shrink-0 text-signal/80" aria-hidden="true" />
						{note.label}
					</li>
				{/each}
			</ul>

			<div class="flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
				<Button size="sm" class="h-9 px-4" onclick={openConnect}>
					<Bluetooth data-icon="inline-start" />
					Connect H3 Pro
				</Button>
				<Button variant="outline" size="sm" class="h-9 px-4" onclick={showDemoPreview}>
					Preview the H3 Pro demo
				</Button>
			</div>
		</div>
	</section>
</div>
