<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { MARKET_EQ_SAVE_INDEX } from '#lib/ble/constants.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardFooter,
		CardHeader
	} from '#lib/components/ui/card/index.js';
	import type { EqPreset } from '#lib/schemas.js';
	import { cn } from '#lib/utils.js';
	import EqCurve from './eq-curve.svelte';

	let {
		preset,
		active,
		dirty = false,
		onapply
	}: {
		preset: EqPreset;
		active: boolean;
		dirty?: boolean;
		onapply: (preset: EqPreset) => void;
	} = $props();

	const accents: Record<EqPreset['accent'], { dot: string; hairline: string; ring: string }> = {
		lime: {
			dot: 'bg-signal',
			hairline: 'from-signal/70',
			ring: 'border-signal/45'
		},
		cyan: {
			dot: 'bg-ember',
			hairline: 'from-ember/70',
			ring: 'border-ember/40'
		},
		violet: {
			dot: 'bg-bone/60',
			hairline: 'from-bone/40',
			ring: 'border-bone/25'
		},
		pink: {
			dot: 'bg-ember/75',
			hairline: 'from-ember/55',
			ring: 'border-ember/35'
		}
	};

	const accent = $derived(accents[preset.accent]);
	const targetLabel = $derived(
		preset.builtIn && preset.deviceIndex !== undefined
			? `Official · slot ${preset.deviceIndex}`
			: `Market · slot ${MARKET_EQ_SAVE_INDEX}`
	);
</script>

<Card
	class={cn(
		'group relative gap-0 overflow-hidden rounded-[18px] border bg-surface py-0 shadow-none ring-0',
		active ? cn(accent.ring, 'bg-signal/[0.025]') : 'border-hairline'
	)}
>
	<span
		aria-hidden="true"
		class={cn('absolute inset-x-5 top-0 h-px bg-gradient-to-r to-transparent', accent.hairline)}
	></span>

	<CardHeader class="flex flex-row items-start justify-between gap-3 px-5 pb-0 pt-4">
		<Badge variant="outline" class="gap-1.5 border-hairline bg-transparent capitalize text-muted-warm">
			<span class={cn('size-1.5 rounded-full', accent.dot)}></span>
			{preset.category}
		</Badge>
		{#if active}
			<span class="flex flex-wrap items-center gap-1 text-[10px] font-semibold text-signal">
				<Check class="size-3" />
				{dirty ? 'Selected' : 'Applied'}
				<span class="font-medium text-muted-warm">· {targetLabel}</span>
			</span>
		{:else}
			<span class="text-[10px] font-medium tabular text-muted-warm">
				{targetLabel}
			</span>
		{/if}
	</CardHeader>

	<CardContent class="flex flex-col gap-3 px-5 pb-4 pt-3">
		<div>
			<h3 class="display text-[1.55rem] leading-tight text-bone">{preset.name}</h3>
			<p class="mt-1 text-[12px] leading-relaxed text-muted-warm text-pretty">
				{preset.tagline}
			</p>
		</div>
		<div class="-mx-1">
			<EqCurve
				compact
				gains={preset.gains}
				frequencies={preset.frequencies}
				accent={preset.accent}
			/>
		</div>
	</CardContent>

	<CardFooter
		class="mt-auto flex items-center justify-between gap-3 border-t border-hairline px-5 py-3.5 [.border-t]:pt-3.5"
	>
		<div class="min-w-0">
			<p class="truncate text-[11px] font-medium text-bone">{preset.author}</p>
			<div class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
				{#each preset.tags.slice(0, 3) as tag (tag)}
					<span class="text-[10px] text-muted-warm">#{tag}</span>
				{/each}
			</div>
		</div>
		<Button
			size="sm"
			variant={active ? 'secondary' : 'outline'}
			aria-pressed={active}
			class={cn(
				'shrink-0',
				!active && 'border-signal/25 bg-signal/[0.04] text-signal hover:bg-signal/[0.1]'
			)}
			onclick={() => onapply(preset)}
		>
			{#if active}
				<Check data-icon="inline-start" />
				{dirty ? 'Selected' : 'Applied'}
			{:else}
				Apply
			{/if}
		</Button>
	</CardFooter>
</Card>
