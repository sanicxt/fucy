import { getContext, setContext } from "svelte";
import type { MotionGridContextType } from "./types";

const MOTION_GRID_CONTEXT_KEY = Symbol("motion-grid-context");

export function setMotionGridContext(value: MotionGridContextType): MotionGridContextType {
	setContext(MOTION_GRID_CONTEXT_KEY, value);
	return value;
}

export function useMotionGridContext(): MotionGridContextType {
	const context = getContext<MotionGridContextType>(MOTION_GRID_CONTEXT_KEY);
	if (!context) {
		throw new Error("MotionGridCells must be used within a MotionGrid provider");
	}
	return context;
}
