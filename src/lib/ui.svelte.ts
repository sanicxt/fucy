import { device } from './device.svelte.js';

export const ui = $state({ connectOpen: false, demoPreview: false });

export function openConnect(): void {
	ui.connectOpen = true;
}

export function closeConnect(): void {
	ui.connectOpen = false;
}

export function showDemoPreview(): void {
	// The studio only presents the H3 Pro. An older saved layout must not leak
	// an earbuds or speaker demo into the UI.
	if (!device.connected) {
		if (device.kind !== 'headphones') device.setDeviceKind('headphones');
		// LDAC and multipoint are mutually exclusive on the H3 Pro. Keep the
		// demo state coherent instead of showing both switches as active.
		if (device.ldacEnabled && device.multipointEnabled) void device.setMultipoint(false);
	}
	ui.demoPreview = true;
}

export function hideDemoPreview(): void {
	ui.demoPreview = false;
}
