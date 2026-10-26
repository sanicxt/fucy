<script lang="ts">
	import { onMount } from 'svelte';
	import Zap from '@lucide/svelte/icons/zap';
	import { cn } from '#lib/utils.js';

	let {
		value,
		size = 188,
		strokeWidth = 7,
		charging = false,
		label = 'Battery',
		detail,
		class: className
	}: {
		value: number | null;
		size?: number;
		strokeWidth?: number;
		charging?: boolean;
		label?: string;
		detail?: string;
		class?: string;
	} = $props();

	const uid = $props.id();
	let ready = $state(false);

	const radius = 42;
	const circumference = 2 * Math.PI * radius;
	const level = $derived(value === null ? 0 : Math.max(0, Math.min(100, value)));
	const targetOffset = $derived(circumference * (1 - level / 100));
	const offset = $derived(ready ? targetOffset : circumference);
	const tone = $derived(value !== null && value <= 20 ? 'var(--ember)' : 'var(--signal)');
	const low = $derived(value !== null && value <= 20);

	onMount(() => {
		const frame = requestAnimationFrame(() => {
			ready = true;
		});
		return () => cancelAnimationFrame(frame);
	});
</script>

<div
	class={cn('relative inline-flex shrink-0 items-center justify-center', className)}
	style="width: {size}px; height: {size}px"
	role="img"
	aria-label={value === null ? `${label} not reported` : `${label} ${value} percent${charging ? ', charging' : ''}`}
>
	<svg viewBox="0 0 100 100" class="size-full -rotate-90" aria-hidden="true" focusable="false">
		<defs>
			<linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" style="stop-color: {tone}; stop-opacity: 0.55"></stop>
				<stop offset="55%" style="stop-color: {tone}; stop-opacity: 1"></stop>
				<stop offset="100%" style="stop-color: {low ? '#ffb08f' : '#f3efe6'}; stop-opacity: 0.9"></stop>
			</linearGradient>
		</defs>
		<circle
			cx="50"
			cy="50"
			r={radius}
			fill="none"
			stroke="rgb(243 239 230 / 0.08)"
			stroke-width={strokeWidth}
		/>
		<circle
			cx="50"
			cy="50"
			r={radius}
			fill="none"
			stroke={`url(#${uid}-ring)`}
			stroke-width={strokeWidth}
			stroke-linecap="round"
			stroke-dasharray={circumference}
			stroke-dashoffset={offset}
			class="battery-ring__value"
		/>
		<circle
			cx="50"
			cy="50"
			r={radius - strokeWidth - 3}
			fill="none"
			stroke="rgb(243 239 230 / 0.055)"
			stroke-width="0.65"
			stroke-dasharray="1 4"
		/>
	</svg>

	<div class="absolute inset-0 flex flex-col items-center justify-center text-center">
		<span class="display leading-none tracking-[-0.045em] text-bone" style="font-size: {size * 0.255}px">
			{value ?? '—'}<span
				class="ml-0.5 font-sans font-medium text-muted-warm"
				style="font-size: {size * 0.08}px"
			>%</span>
		</span>
		<span class="mt-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-warm">
			{#if charging}
				<Zap class="size-3 text-signal" aria-hidden="true" />
				Charging
			{:else}
				<span class="size-1 rounded-full bg-signal/80" aria-hidden="true"></span>
				{label}
			{/if}
		</span>
		{#if detail}
			<span class="mt-1 text-[9px] text-muted-warm/75">{detail}</span>
		{/if}
	</div>
</div>
