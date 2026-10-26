<script lang="ts">
	import Bluetooth from '@lucide/svelte/icons/bluetooth';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { toast } from 'svelte-sonner';
	import {
		Alert,
		AlertDescription,
		AlertTitle
	} from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogTitle
	} from '#lib/components/ui/dialog/index.js';
	import { device } from '#lib/device.svelte.js';
	import { closeConnect, showDemoPreview, ui } from '#lib/ui.svelte.js';
	import SignalGrid from './signal-grid.svelte';

	const busy = $derived(device.status === 'connecting');

	const linuxDesktop = $derived(
		typeof navigator !== 'undefined' &&
			/Linux/.test(navigator.userAgent) &&
			!/Android/.test(navigator.userAgent)
	);

	const steps = [
		{
			title: 'Bluetooth is on',
			body: 'Enable Bluetooth on the phone or computer you are pairing from.'
		},
		{
			title: 'H3 Pro is in pairing mode',
			body: 'Power on the headphones, keep them nearby, and hold the pairing control until the light indicates pairing mode.'
		},
		{
			title: 'Choose QCY H3 Pro',
			body: 'Pick QCY H3 Pro (or the JL/A002 name shown) from the browser prompt, then return to this tab.'
		},
		{
			title: 'Close the QCY app',
			body: 'The H3 Pro accepts one BLE control connection. Quit the QCY phone app and disconnect other Bluetooth hosts, then try again.'
		}
	];

	async function connect(acceptAll: boolean): Promise<void> {
		if (busy) return;
		try {
			await device.connect(acceptAll);
			toast.success(`Connected to ${device.name}`);
			closeConnect();
		} catch {
			toast.error(device.error ?? 'The Bluetooth connection failed.');
		}
	}

	function useDemo(): void {
		device.useDemo();
		showDemoPreview();
		closeConnect();
		toast.success('H3 Pro demo ready', { description: 'Every control works without hardware.' });
	}
</script>

<Dialog
	bind:open={ui.connectOpen}
	onOpenChange={(open) => {
		if (!open) device.error = null;
	}}
>
	<DialogContent
		class="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto overscroll-contain rounded-[24px] border border-hairline bg-surface p-0 ring-0 sm:max-w-lg"
	>
		<div class="relative overflow-hidden border-b border-hairline px-6 pb-6 pt-8">
			<span
				aria-hidden="true"
				class="pointer-events-none absolute -top-28 left-1/2 size-64 -translate-x-1/2 rounded-full bg-signal/[0.07] blur-3xl"
			></span>
			<div class="relative flex flex-col items-center gap-4 text-center">
				<span
					class="flex size-20 items-center justify-center rounded-[20px] border border-hairline bg-surface-raised"
				>
					<SignalGrid size="lg" animate={false} class="size-14 text-signal" />
				</span>
				<div class="flex flex-col items-center">
					<p class="eyebrow flex items-center gap-2">
						{#if busy}
							<LoaderCircle class="size-3 animate-spin text-ember" />
							Scanning nearby
						{:else}
							<span class="size-1.5 rounded-full bg-signal" aria-hidden="true"></span>
							Ready to pair
						{/if}
					</p>
					<DialogTitle class="display mt-1.5 text-[2rem] leading-tight text-bone">
						Connect your H3 Pro
					</DialogTitle>
					<DialogDescription class="mt-2 max-w-sm text-[13px] leading-relaxed">
						Web Bluetooth pairs the QCY H3 Pro over JL A002 / RCSP. The studio asks only for the
						headphones and keeps every control tuned to that model.
					</DialogDescription>
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-5 p-6">
			<ol class="flex flex-col gap-3">
				{#each steps as step, index (step.title)}
					<li class="flex gap-3">
						<span
							class="flex size-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-raised text-[11px] font-semibold text-signal tabular"
						>
							{index + 1}
						</span>
						<div class="pt-0.5">
							<p class="text-[13px] font-medium text-bone">{step.title}</p>
							<p class="mt-0.5 text-[11px] leading-relaxed text-muted-warm text-pretty">
								{step.body}
							</p>
						</div>
					</li>
				{/each}
			</ol>

			{#if device.error}
				<Alert variant="destructive" class="border-ember/30 bg-ember/[0.05]">
					<TriangleAlert />
					<AlertTitle>Connection failed</AlertTitle>
					<AlertDescription>{device.error}</AlertDescription>
				</Alert>
			{/if}

			{#if linuxDesktop}
				<Alert class="gap-1 border-ember/25 bg-ember/[0.04] px-3.5 py-2.5 text-ember">
					<TriangleAlert />
					<AlertTitle class="text-[13px]">Web Bluetooth on Linux is experimental</AlertTitle>
					<AlertDescription class="text-xs leading-relaxed">
						Enable chrome://flags/#enable-experimental-web-platform-features, restart Chrome, and
						make sure BlueZ is running. Chrome or Edge on macOS, Windows, Android, or ChromeOS is more
						reliable.
					</AlertDescription>
				</Alert>
			{/if}

			<div class="flex flex-col gap-2">
				<Button size="lg" class="w-full" disabled={busy} onclick={() => void connect(false)}>
					{#if busy}
						<LoaderCircle data-icon="inline-start" class="animate-spin" />
						Scanning…
					{:else}
						<Bluetooth data-icon="inline-start" />
						Scan for QCY H3 Pro
					{/if}
				</Button>
				<Button
					size="lg"
					variant="outline"
					class="w-full"
					disabled={busy}
					aria-describedby="browse-all-hint"
					onclick={() => void connect(true)}
				>
					<ScanLine data-icon="inline-start" />
					Browse all devices
				</Button>
				<p
					id="browse-all-hint"
					class="px-1 text-[11px] leading-relaxed text-muted-warm text-pretty"
				>
					Use this only if the H3 Pro does not appear in the filtered scan.
				</p>
			</div>

			<p class="text-[11px] leading-relaxed text-muted-warm">
				Web Bluetooth needs Chrome or Edge over HTTPS or localhost. Firefox and Safari are not
				supported. Close the QCY phone app if the headphones do not appear.
			</p>

			<div class="border-t border-hairline pt-2">
				<Button variant="ghost" class="w-full text-muted-warm" onclick={useDemo}>
					Preview the H3 Pro demo
				</Button>
			</div>
		</div>
	</DialogContent>
</Dialog>
