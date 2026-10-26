<script module lang="ts">
	/**
	 * `normal` is the no-restart case and is normally applied directly without
	 * opening this dialog. The two warning modes mirror the decompiled app:
	 * applying Spatial Audio asks to disable LDAC; leaving Spatial Audio shows
	 * the EQ reboot tip.
	 */
	export type EqRestartDialogMode = 'normal' | 'spatial-ldac' | 'leaving-spatial';
</script>

<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Send from '@lucide/svelte/icons/send';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Zap from '@lucide/svelte/icons/zap';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '#lib/components/ui/dialog/index.js';

	let {
		open = $bindable(false),
		mode = 'normal',
		onconfirm
	}: {
		open?: boolean;
		mode?: EqRestartDialogMode;
		onconfirm: () => void | Promise<void>;
	} = $props();

	let applying = $state(false);

	const copy = $derived.by(() => {
		if (mode === 'spatial-ldac') {
			return {
				title: 'Spatial Audio requires LDAC off',
				description:
					'Please disable LDAC before you enable spatial sound. This will make the headset reboot.',
				note: 'Applying Spatial Audio writes only the spatial EQ preset. The H3 Pro turns LDAC off and restarts itself; the studio reconnects automatically. No separate LDAC command is sent.',
				confirmLabel: 'Disable LDAC & apply'
			};
		}

		if (mode === 'leaving-spatial') {
			return {
				title: 'Leaving Spatial Audio',
				description:
					'The headset will restart after switching away from Spatial Audio. Please reconnect after it reboots — the studio restores the retained Bluetooth link automatically.',
				note: 'The new curve is written once. Normal EQ presets do not restart the headphones; this warning applies only when leaving Spatial Audio.',
				confirmLabel: 'Apply & restart'
			};
		}

		return {
			title: 'Apply this EQ curve?',
			description:
				'The selected curve is written once to its save slot. Normal EQ presets apply without restarting the headphones.',
			note: 'One write, no repeated frames. The selected curve and its save slot are sent together, so built-in presets are not overwritten by custom or market curves.',
			confirmLabel: 'Apply EQ'
		};
	});

	async function confirm(): Promise<void> {
		if (applying) return;
		applying = true;
		try {
			await onconfirm();
			open = false;
		} catch {
			// The caller surfaces the error and the dialog stays open for a retry.
		} finally {
			applying = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent
		showCloseButton={false}
		class="gap-5 rounded-[22px] border border-hairline bg-surface ring-0 sm:max-w-[27rem]"
	>
		<DialogHeader class="gap-3">
			<span
				class="flex size-10 items-center justify-center rounded-full border {mode === 'normal'
					? 'border-signal/30 bg-signal/10 text-signal'
					: 'border-ember/30 bg-ember/10 text-ember'}"
			>
				{#if mode === 'spatial-ldac'}
					<Zap class="size-5" />
				{:else if mode === 'leaving-spatial'}
					<TriangleAlert class="size-5" />
				{:else}
					<Send class="size-5" />
				{/if}
			</span>
			<DialogTitle class="display text-[1.75rem] leading-tight text-bone">
				{copy.title}
			</DialogTitle>
			<DialogDescription class="text-[13px] leading-relaxed text-muted-warm">
				{copy.description}
			</DialogDescription>
		</DialogHeader>

		<div class="rounded-[14px] border border-hairline bg-canvas/50 px-3.5 py-3">
			<p class="text-[11px] leading-relaxed text-muted-warm">
				{copy.note}
			</p>
		</div>

		<DialogFooter class="gap-2">
			<Button variant="outline" disabled={applying} onclick={() => (open = false)}>Cancel</Button>
			<Button variant={mode === 'normal' ? 'default' : 'destructive'} disabled={applying} onclick={() => void confirm()}>
				{#if applying}
					<LoaderCircle data-icon="inline-start" class="animate-spin" />
					Applying…
				{:else}
					{copy.confirmLabel}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
