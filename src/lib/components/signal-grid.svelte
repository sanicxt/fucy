<script lang="ts">
	import { browser } from '$app/env';
	import {
		MotionGrid,
		MotionGridCells,
		type FrameDot,
		type Frames,
		type MotionGridCellMotionProps
	} from '#lib/components/magic/motion-grid/index.js';
	import { cn } from '#lib/utils.js';

	type SignalSize = 'sm' | 'md' | 'lg';

	let {
		size = 'md',
		class: className,
		animate = true
	}: {
		size?: SignalSize;
		class?: string;
		animate?: boolean;
	} = $props();

	/* Five bars, pulsing outward from the centre like a tiny waveform. */
	const FRAME_HEIGHTS = [
		[1, 2, 3, 2, 1],
		[2, 3, 5, 3, 2],
		[1, 3, 4, 3, 1],
		[2, 4, 3, 4, 2],
		[1, 2, 4, 2, 1]
	];

	const frames: Frames = FRAME_HEIGHTS.map((heights) => {
		const dots: FrameDot[] = [];
		heights.forEach((height, x) => {
			const start = Math.max(0, Math.round((5 - height) / 2));
			for (let row = start; row < Math.min(5, start + height); row += 1) {
				dots.push([x, row]);
			}
		});
		return dots;
	});

	const sizes: Record<SignalSize, string> = {
		sm: 'size-7',
		md: 'size-10',
		lg: 'size-16'
	};

	const reducedMotion =
		browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const activeProps: MotionGridCellMotionProps = reducedMotion
		? { class: 'bg-current' }
		: {
				class: 'bg-current',
				animate: { scale: [0.55, 1], opacity: [0.45, 1] },
				transition: { duration: 0.3, ease: 'easeOut' }
			};

	const inactiveProps: MotionGridCellMotionProps = reducedMotion
		? { class: 'bg-white/10' }
		: {
				class: 'bg-white/10',
				animate: { scale: 0.8, opacity: 0.9 },
				transition: { duration: 0.35, ease: 'easeOut' }
			};
</script>

<span
	class={cn('inline-grid shrink-0 place-items-center text-signal', sizes[size], className)}
	aria-hidden="true"
>
	<MotionGrid
		gridSize={[5, 5]}
		{frames}
		duration={430}
		animate={animate && !reducedMotion}
		class="size-full gap-[3px]"
	>
		<MotionGridCells
			class="rounded-[2px]"
			{activeProps}
			{inactiveProps}
		/>
	</MotionGrid>
</span>
