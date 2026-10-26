<script lang="ts">
	import { EQ_FREQUENCIES, EQ_MAX_GAIN, EQ_MIN_GAIN } from '#lib/ble/constants.js';
	import { cn } from '#lib/utils.js';

	type Accent = 'lime' | 'cyan' | 'violet' | 'pink';

	let {
		gains,
		frequencies = EQ_FREQUENCIES,
		class: className,
		height = 240,
		compact = false,
		showLabels = true,
		accent = 'lime'
	}: {
		gains: number[];
		frequencies?: readonly number[];
		class?: string;
		height?: number;
		compact?: boolean;
		showLabels?: boolean;
		accent?: Accent;
	} = $props();

	const uid = $props.id();

	/* Preset schema accents are mapped onto the studio console palette. */
	const COLORS: Record<Accent, string> = {
		lime: '#d7ff4f',
		cyan: '#ff8a5c',
		violet: '#c9c0ad',
		pink: '#ffa47f'
	};

	const LABEL_INDEXES = [0, 2, 5, 7, 9] as const;
	const MIN_DB = EQ_MIN_GAIN;
	const MAX_DB = EQ_MAX_GAIN;

	const color = $derived(COLORS[accent]);
	const chartHeight = $derived(compact ? 56 : height);
	const padX = $derived(compact ? 2 : 4);
	const padY = $derived(compact ? 12 : 12);

	const labelFrequencies = $derived.by(() => {
		const fallback = frequencies[frequencies.length - 1] ?? 16_000;
		return LABEL_INDEXES.map((index) => frequencies[index] ?? fallback);
	});

	function xForFrequency(freq: number): number {
		const t = Math.log10(freq / 20) / Math.log10(20000 / 20);
		return padX + t * (100 - padX * 2);
	}

	function yForGain(gain: number): number {
		const clamped = Math.max(MIN_DB, Math.min(MAX_DB, gain));
		const t = (clamped - MIN_DB) / (MAX_DB - MIN_DB);
		return padY + (1 - t) * (100 - padY * 2);
	}

	function formatFrequency(freq: number): string {
		return freq >= 1000 ? `${Number((freq / 1000).toFixed(1))}k` : `${freq}`;
	}

	function formatDb(gain: number): string {
		if (Math.abs(gain) < 0.05) return '0 dB';
		return `${gain > 0 ? '+' : ''}${Number(gain.toFixed(1))} dB`;
	}

	function smoothPath(points: { x: number; y: number }[]): string {
		if (points.length < 2) return '';
		let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
		for (let i = 0; i < points.length - 1; i += 1) {
			const p0 = points[i - 1] ?? points[i];
			const p1 = points[i];
			const p2 = points[i + 1];
			const p3 = points[i + 2] ?? p2;
			const c1x = p1.x + (p2.x - p0.x) / 6;
			const c1y = Math.max(0, Math.min(100, p1.y + (p2.y - p0.y) / 6));
			const c2x = p2.x - (p3.x - p1.x) / 6;
			const c2y = Math.max(0, Math.min(100, p2.y - (p3.y - p1.y) / 6));
			d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
		}
		return d;
	}

	function interpolateGain(values: number[], t: number): number {
		if (values.length < 2) return values[0] ?? 0;
		const max = values.length - 1;
		const position = t * max;
		const index = Math.min(Math.floor(position), max - 1);
		const fraction = position - index;
		const p0 = values[Math.max(0, index - 1)] ?? 0;
		const p1 = values[index] ?? 0;
		const p2 = values[index + 1] ?? 0;
		const p3 = values[Math.min(max, index + 2)] ?? 0;
		return (
			0.5 *
			(2 * p1 +
				(-p0 + p2) * fraction +
				(2 * p0 - 5 * p1 + 4 * p2 - p3) * fraction * fraction +
				(-p0 + 3 * p1 - 3 * p2 + p3) * fraction * fraction * fraction)
		);
	}

	/* Edge anchors let the stroke reach both sides of the chart. */
	const points = $derived.by(() => {
		const values = gains.length ? gains : [0];
		const bandPoints = values.map((gain, index) => ({
			x: xForFrequency(frequencies[index] ?? frequencies[frequencies.length - 1] ?? 16_000),
			y: yForGain(gain)
		}));
		return [
			{ x: padX, y: yForGain(values[0] ?? 0) },
			...bandPoints,
			{ x: 100 - padX, y: yForGain(values[values.length - 1] ?? 0) }
		];
	});

	const curvePath = $derived(smoothPath(points));
	const areaPath = $derived(`${curvePath} L ${100 - padX} 100 L ${padX} 100 Z`);

	const horizontalLines = $derived(
		[MIN_DB, MIN_DB / 2, 0, MAX_DB / 2, MAX_DB].map((db) => ({ db, y: yForGain(db) }))
	);

	const bars = $derived.by(() => {
		if (compact) return [];
		const values = gains.length ? gains : [0];
		const count = 34;
		const width = 1.1;
		return Array.from({ length: count }, (_, index) => {
			const t = index / (count - 1);
			const center = padX + t * (100 - padX * 2);
			return {
				left: center - width / 2,
				width,
				height: Math.max(2, 100 - yForGain(interpolateGain(values, t))),
				delay: index * 12
			};
		});
	});

	const ariaLabel = $derived.by(() => {
		if (compact) return 'Preset frequency response preview.';
		const values = gains.length ? gains : [0];
		const summary = values
			.map(
				(gain, index) =>
					`${formatFrequency(frequencies[index] ?? frequencies[frequencies.length - 1] ?? 16_000)} hertz ${formatDb(gain)}`
			)
			.join(', ');
		return `Frequency response curve. ${summary}.`;
	});

	const fillId = `${uid}-fill`;
</script>

<div class={cn('w-full', className)}>
	<div class="relative w-full overflow-hidden rounded-xl" style="height: {chartHeight}px">
		{#if !compact}
			<div class="absolute inset-0" aria-hidden="true">
				{#each bars as bar, index (index)}
					<span
						class="eq-bar absolute bottom-0 rounded-t-[2px]"
						style="left: {bar.left}%; width: {bar.width}%; height: {bar.height}%; background: {color}; opacity: 0.12; animation-delay: {bar.delay}ms"
					></span>
				{/each}
			</div>
		{/if}

		<svg
			class="absolute inset-0 h-full w-full"
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
			role="img"
			aria-label={ariaLabel}
			focusable="false"
		>
			<defs>
				<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" style="stop-color: {color}; stop-opacity: 0.22"></stop>
					<stop offset="62%" style="stop-color: {color}; stop-opacity: 0.05"></stop>
					<stop offset="100%" style="stop-color: {color}; stop-opacity: 0"></stop>
				</linearGradient>
			</defs>

			{#if !compact}
				{#each horizontalLines as line (line.db)}
					<line
						x1="0"
						y1={line.y}
						x2="100"
						y2={line.y}
						stroke="white"
						stroke-opacity={line.db === 0 ? 0.14 : 0.045}
						stroke-width="1"
						stroke-dasharray={line.db === 0 ? '3 4' : undefined}
						vector-effect="non-scaling-stroke"
					/>
				{/each}
				{#each frequencies as freq, index (freq)}
					<line
						x1={xForFrequency(freq)}
						y1="0"
						x2={xForFrequency(freq)}
						y2="100"
						stroke="white"
						stroke-opacity={index % 3 === 0 ? 0.05 : 0.022}
						stroke-width="1"
						vector-effect="non-scaling-stroke"
					/>
				{/each}
			{/if}

			<path d={areaPath} fill="url(#{fillId})" />
			<path
				d={curvePath}
				fill="none"
				stroke={color}
				stroke-opacity="0.14"
				stroke-width={compact ? 5 : 7}
				vector-effect="non-scaling-stroke"
				stroke-linecap="round"
			/>
			<path
				d={curvePath}
				fill="none"
				stroke={color}
				stroke-width={compact ? 1.5 : 2}
				vector-effect="non-scaling-stroke"
				stroke-linecap="round"
				stroke-linejoin="round"
				pathLength="1"
				class="eq-draw"
			/>
		</svg>

		{#if !compact}
			{#each points.slice(1, -1) as point, index (index)}
				<span
					aria-hidden="true"
					class="absolute size-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full"
					style="left: {point.x}%; top: {point.y}%; background: {color}; box-shadow: 0 0 0 3px var(--surface), 0 0 12px {color}66"
				></span>
			{/each}
		{/if}
	</div>

	{#if !compact && showLabels}
		<div class="relative mt-2 h-4" aria-hidden="true">
			{#each labelFrequencies as freq (freq)}
				<span
					class="absolute -translate-x-1/2 text-[10px] font-medium tabular text-muted-warm"
					style="left: {xForFrequency(freq)}%"
				>
					{formatFrequency(freq)}
				</span>
			{/each}
		</div>
	{/if}
</div>
