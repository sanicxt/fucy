<script lang="ts">
	import { motion } from "motion-sv";
	import { setMotionGridContext } from "./use-motion-grid-context.svelte";
	import type { MotionGridCellMotionProps, MotionGridProps } from "./types";

	type StyleValue = MotionGridCellMotionProps["style"];

	function mergeStyles(baseStyle: StyleValue, userStyle: StyleValue): StyleValue {
		return {
			...(baseStyle ?? {}),
			...(userStyle ?? {}),
		};
	}

	function withRefProp<T extends Record<string, unknown>>(props: T) {
		return Object.defineProperty(props, "ref", {
			enumerable: true,
			configurable: true,
			get: () => ref,
			set: (value) => {
				ref = value as HTMLDivElement | null;
			},
		}) as T & { ref: HTMLDivElement | null };
	}

	let {
		ref = $bindable(null),
		gridSize,
		frames,
		duration = 200,
		animate = true,
		child,
		children,
		...restProps
	}: MotionGridProps = $props();

	let index = $state(0);

	let cols = $derived(gridSize[0]);
	let rows = $derived(gridSize[1]);

	setMotionGridContext({
		animate: () => {
			return animate;
		},
		index: () => {
			return index;
		},
		cols: () => {
			return cols;
		},
		rows: () => {
			return rows;
		},
		frames: () => {
			return frames;
		},
		duration: () => {
			return duration;
		},
	});

	$effect(() => {
		frames;
		index = 0;
	});

	$effect(() => {
		if (frames.length === 0) {
			index = 0;
			return;
		}

		if (index >= frames.length) {
			index = 0;
		}
	});

	$effect(() => {
		if (!animate || frames.length === 0) return;

		let interval = setInterval(() => {
			index = (index + 1) % frames.length;
		}, duration);

		return () => clearInterval(interval);
	});

	let baseStyle = $derived({
		display: "grid",
		gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
		gridAutoRows: "1fr",
	});

	let mergedProps = $derived.by(() => {
		let style = mergeStyles(baseStyle, restProps.style as StyleValue);
		return withRefProp({
			...restProps,
			"data-animate": animate,
			style,
		}) as MotionGridCellMotionProps;
	});
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<motion.div bind:ref {...mergedProps}>
		{@render children?.()}
	</motion.div>
{/if}
