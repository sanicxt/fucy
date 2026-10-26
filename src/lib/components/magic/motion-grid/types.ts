import type { MotionHTMLAttributes } from "motion-sv";
import type { MotionProps } from "motion-sv";
import type { Snippet } from "svelte";

export type FrameDot = [number, number];
export type Frame = FrameDot[];
export type Frames = Frame[];

export type MotionGridContextType = {
	index: () => number;
	cols: () => number;
	rows: () => number;
	frames: () => Frames;
	duration: () => number;
	animate: () => boolean;
};

export type MotionGridCellMotionProps = Omit<MotionProps, "children"> & MotionHTMLAttributes<"div">;

export type MotionGridProps = Omit<MotionProps, "children" | "animate"> &
	MotionHTMLAttributes<"div"> & {
		gridSize: [number, number];
		frames: Frames;
		duration?: number;
		animate?: boolean;
		child?: Snippet<[{ props: MotionGridCellMotionProps }]>;
		children?: Snippet;
	};

export type MotionGridCellsProps = Omit<MotionProps, "children"> &
	MotionHTMLAttributes<"div"> & {
		activeProps?: MotionGridCellMotionProps;
		inactiveProps?: MotionGridCellMotionProps;
	};
