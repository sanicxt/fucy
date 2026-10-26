<script lang="ts">
	import Bluetooth from '@lucide/svelte/icons/bluetooth';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { device } from '#lib/device.svelte.js';
	import { cn } from '#lib/utils.js';

	const visible = $derived(
		device.status === 'restarting' ||
			device.status === 'error' ||
			device.status === 'connecting'
	);

	const tone = $derived(
		device.status === 'restarting' || device.status === 'connecting' ? 'restarting' : 'error'
	);

	const headline = $derived(
		device.status === 'restarting'
			? 'H3 Pro is reconnecting'
			: device.status === 'connecting'
				? device.canReconnect
					? 'Reconnecting to H3 Pro'
					: 'Connecting to H3 Pro'
				: device.status === 'error'
					? 'Connection needs attention'
					: ''
	);

	const message = $derived(
		device.statusMessage ??
			(device.status === 'restarting'
				? 'The link dropped after a write. The studio is restoring it without another Bluetooth prompt.'
				: device.status === 'error'
					? 'The last live values are kept on screen. Reconnect without opening the Bluetooth picker.'
					: device.canReconnect
						? 'The saved headphones are being restored without another Bluetooth prompt.'
						: 'Keep the H3 Pro nearby and choose it in the Bluetooth prompt.')
	);

	async function reconnect(): Promise<void> {
		try {
			await device.reconnect();
			toast.success('H3 Pro reconnected', { description: 'Live controls are back online.' });
		} catch (error) {
			toast.error('Could not reconnect', {
				description:
					error instanceof Error ? error.message : 'Keep the headphones nearby and try again.'
			});
		}
	}
</script>

{#if visible}
	<section
		class={cn(
			'relative overflow-hidden rounded-[18px] border px-4 py-3.5 sm:px-5',
			tone === 'restarting'
				? 'border-ember/25 bg-ember/[0.045]'
				: 'border-ember/35 bg-ember/[0.07]'
		)}
		aria-live="polite"
	>
		{#if device.status === 'restarting' || device.status === 'connecting'}
			<div class="scan-track absolute inset-x-0 top-0 h-[2px]" aria-hidden="true"></div>
		{/if}
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex min-w-0 items-start gap-3">
				<span
					class={cn(
						'flex size-9 shrink-0 items-center justify-center rounded-full border',
						tone === 'restarting'
							? 'border-ember/25 bg-ember/10 text-ember'
							: 'border-ember/35 bg-ember/10 text-ember'
					)}
				>
					{#if tone === 'restarting'}
						<LoaderCircle class="size-4 animate-spin" />
					{:else}
						<TriangleAlert class="size-4" />
					{/if}
				</span>
				<div class="min-w-0">
					<p class="text-[13px] font-semibold text-bone">{headline}</p>
					<p class="mt-0.5 max-w-[70ch] text-[11px] leading-relaxed text-muted-warm text-pretty">
						{message}
					</p>
				</div>
			</div>

			{#if device.canReconnect && !(device.status === 'connecting')}
				<Button
					size="sm"
					variant="outline"
					class="shrink-0 border-ember/30 bg-transparent text-ember hover:bg-ember/10 hover:text-ember"
					onclick={() => void reconnect()}
				>
					{#if device.status === 'error'}
						<RotateCw data-icon="inline-start" />
					{:else}
						<Bluetooth data-icon="inline-start" />
					{/if}
					Reconnect H3 Pro
				</Button>
			{/if}
		</div>
	</section>
{/if}
