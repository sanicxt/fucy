<script lang="ts">
	import Bluetooth from '@lucide/svelte/icons/bluetooth';
	import BluetoothConnected from '@lucide/svelte/icons/bluetooth-connected';
	import Check from '@lucide/svelte/icons/check';
	import Headphones from '@lucide/svelte/icons/headphones';
	import Info from '@lucide/svelte/icons/info';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Unplug from '@lucide/svelte/icons/unplug';
	import Zap from '@lucide/svelte/icons/zap';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Alert, AlertDescription, AlertTitle } from '#lib/components/ui/alert/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import BatteryRing from '#lib/components/battery-ring.svelte';
	import PageHeading from '#lib/components/page-heading.svelte';
	import { isWebBluetoothSupported } from '#lib/ble/client.js';
	import { device } from '#lib/device.svelte.js';
	import { openConnect, showDemoPreview } from '#lib/ui.svelte.js';
	import { cn } from '#lib/utils.js';

	type FeatureToggle = {
		id: 'ldac' | 'multipoint';
		label: string;
		description: string;
		checked: boolean;
		set: (enabled: boolean) => Promise<void>;
	};

	let bluetoothSupported = $state<boolean | null>(null);

	const busy = $derived(device.status === 'connecting' || device.status === 'restarting');

	const statusLabel = $derived(
		device.status === 'connected'
			? 'Connected'
			: device.status === 'restarting'
				? 'Reconnecting'
				: device.status === 'connecting'
					? device.canReconnect
						? 'Reconnecting'
						: 'Connecting'
					: 'Not connected'
	);

	const statusTone = $derived(
		device.status === 'connected'
			? 'text-signal'
			: device.status === 'restarting' || device.status === 'connecting' || device.status === 'error'
				? 'text-ember'
				: 'text-muted-warm'
	);

	const lastSync = $derived(
		device.connected ? (device.lastSyncedAt?.toLocaleTimeString() ?? 'Just now') : 'Demo data'
	);

	const playbackEstimate = $derived.by(() => {
		const average = device.batteryAverage;
		if (average === null) return '—';
		const totalMinutes = Math.round((average / 100) * 8 * 60);
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		if (hours === 0) return `${minutes}m`;
		return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
	});

	const featureChips = $derived([
		{ label: 'ANC scenes', available: device.capabilities.anc },
		{ label: '10-band EQ', available: device.capabilities.eq },
		{ label: 'LDAC', available: device.capabilities.ldac },
		{ label: 'Multipoint', available: device.capabilities.multipoint }
	]);

	const featureToggles = $derived.by((): FeatureToggle[] => {
		const toggles: FeatureToggle[] = [];

		if (device.capabilities.ldac) {
			toggles.push({
				id: 'ldac',
				label: 'LDAC',
				description:
					'High-bitrate codec. Enabling restarts the H3 Pro and disables multipoint. Spatial Audio is an EQ preset that runs with LDAC off.',
				checked: device.ldacEnabled,
				set: (enabled) => device.setLdac(enabled)
			});
		}

		if (device.capabilities.multipoint) {
			toggles.push({
				id: 'multipoint',
				label: 'Multipoint',
				description:
					'Two source devices. Enabling restarts the H3 Pro and disables LDAC.',
				checked: device.multipointEnabled,
				set: (enabled) => device.setMultipoint(enabled)
			});
		}

		return toggles;
	});

	onMount(() => {
		bluetoothSupported = isWebBluetoothSupported();
	});

	function disconnect(): void {
		device.disconnect();
		toast.success('Disconnected', { description: 'The H3 Pro demo remains available.' });
	}

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

	function useDemo(): void {
		device.useDemo();
		showDemoPreview();
		toast.success('H3 Pro demo restored', {
			description: 'Battery, noise, EQ, LDAC, and multipoint are back to their H3 Pro defaults.'
		});
	}

	async function toggleFeature(toggle: FeatureToggle, enabled: boolean): Promise<void> {
		if (toggle.id === 'ldac' && enabled && device.isSpatialApplied) {
			toast.warning('Leave Spatial Audio first', {
				description:
					'Spatial Audio is the active EQ preset and runs with LDAC off. Apply another EQ preset in the Equalizer before enabling LDAC.'
			});
			return;
		}

		try {
			// In demo mode, mirror the H3 Pro's mutually exclusive LDAC/multipoint
			// behavior. A live connection lets the headphone report the change.
			if (device.isDemo && enabled) {
				if (toggle.id === 'ldac') await device.setMultipoint(false);
				else await device.setLdac(false);
			}

			await toggle.set(enabled);
			toast.success(`${toggle.label} ${enabled ? 'enabled' : 'disabled'}`, {
				description: device.isDemo
					? 'Demo mode updates the interface only.'
					: 'The H3 Pro restarts after this change and the studio will try to reconnect.'
			});
		} catch (error) {
			toast.error(`${toggle.label} could not be ${enabled ? 'enabled' : 'disabled'}`, {
				description:
					error instanceof Error ? error.message : 'The H3 Pro did not accept the change.'
			});
		}
	}
</script>

<div class="flex flex-col gap-5">
	<PageHeading
		eyebrow="Fixed studio identity"
		title="QCY H3 Pro."
		description="One headphone, one battery, and only the controls JL/A002 actually exposes. No layout to choose."
	/>

	<!-- Identity + single battery, one wide console. -->
	<section
		class="studio-reveal relative overflow-hidden rounded-[24px] border border-hairline bg-surface"
		style="--reveal-delay: 80ms"
		aria-labelledby="device-identity"
	>
		<div
			aria-hidden="true"
			class="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-signal/[0.045] blur-3xl"
		></div>
		<div class="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
			<div class="min-w-0">
				<div class="flex items-center gap-3">
					<span
						class="flex size-12 shrink-0 items-center justify-center rounded-[15px] border border-hairline bg-canvas/60 text-signal"
					>
						<Headphones class="size-5" strokeWidth={1.4} />
					</span>
					<div class="min-w-0">
						<h2 id="device-identity" class="display text-[2.3rem] leading-none text-bone">
							QCY H3 Pro
						</h2>
						<p class="mt-1 text-[11px] font-medium text-muted-warm">
							Over-ear headphones · single battery · JL A002
						</p>
					</div>
				</div>

				<div class="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="H3 Pro features">
					{#each featureChips as feature (feature.label)}
						<Badge
							variant="outline"
							class={cn(
								'gap-1 text-[10px]',
								feature.available
									? 'border-signal/25 bg-signal/[0.06] text-signal'
									: 'border-hairline text-muted-warm'
							)}
						>
							{#if feature.available}<Check class="size-2.5" />{/if}
							{feature.label}
						</Badge>
					{/each}
				</div>

				<dl
					class="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-hairline pt-4 text-[11px] sm:grid-cols-4"
				>
					<div>
						<dt class="text-[9px] font-medium text-muted-warm">Protocol</dt>
						<dd class="mt-0.5 font-semibold text-bone">JL A002 · RCSP</dd>
					</div>
					<div>
						<dt class="text-[9px] font-medium text-muted-warm">Firmware</dt>
						<dd class="mt-0.5 font-semibold text-bone tabular">{device.firmware}</dd>
					</div>
					<div>
						<dt class="text-[9px] font-medium text-muted-warm">Connection</dt>
						<dd class={cn('mt-0.5 font-semibold', statusTone)}>{statusLabel}</dd>
					</div>
					<div>
						<dt class="text-[9px] font-medium text-muted-warm">Last sync</dt>
						<dd class="mt-0.5 font-semibold text-bone">{lastSync}</dd>
					</div>
				</dl>
			</div>

			<div class="flex flex-col items-center gap-3 border-t border-hairline pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
				<BatteryRing
					value={device.battery.left}
					charging={device.battery.leftCharging}
					label="Headphone battery"
					size={164}
				/>
				<div class="text-center">
					<p class="text-[10px] font-semibold text-bone">Estimated playback · {playbackEstimate}</p>
					<p class="mt-1 text-[9px] text-muted-warm">Refreshes every 30 seconds</p>
				</div>
			</div>
		</div>

		<div
			class="relative flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-4 sm:px-7"
		>
			{#if device.status === 'connected'}
				<Button variant="outline" onclick={disconnect}>
					<Unplug data-icon="inline-start" />
					Disconnect
				</Button>
			{:else if device.canReconnect}
				<Button onclick={() => void reconnect()} disabled={device.status === 'connecting'}>
					{#if device.status === 'connecting'}
						<LoaderCircle data-icon="inline-start" class="animate-spin" />
						Reconnecting…
					{:else}
						<BluetoothConnected data-icon="inline-start" />
						Reconnect H3 Pro
					{/if}
				</Button>
			{:else}
				<Button disabled={busy} onclick={openConnect}>
					{#if busy}
						<LoaderCircle data-icon="inline-start" class="animate-spin" />
						{statusLabel}…
					{:else}
						<Bluetooth data-icon="inline-start" />
						Connect H3 Pro
					{/if}
				</Button>
			{/if}
			<Button variant="ghost" onclick={useDemo}>
				<Sparkles data-icon="inline-start" />
				Restore H3 Pro demo
			</Button>
			<span class="ml-auto hidden text-[10px] text-muted-warm sm:block">
				Only the H3 Pro identity is available.
			</span>
		</div>
	</section>

	{#if device.status === 'restarting' || device.status === 'error' || (device.status === 'connecting' && device.canReconnect)}
		<section
			class="studio-reveal relative overflow-hidden rounded-[18px] border border-ember/30 bg-ember/[0.05] p-4 sm:p-5"
			style="--reveal-delay: 110ms"
			aria-live="polite"
		>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-start gap-3">
					<span
						class="flex size-9 shrink-0 items-center justify-center rounded-full border border-ember/30 bg-ember/10 text-ember"
					>
						{#if device.status === 'error'}
							<Info class="size-4" />
						{:else}
							<LoaderCircle class="size-4 animate-spin" />
						{/if}
					</span>
					<div>
						<p class="text-[12px] font-semibold text-bone">
							{device.status === 'restarting'
								? 'H3 Pro reconnecting'
								: device.status === 'error'
									? 'Connection needs attention'
									: 'Reconnecting to H3 Pro'}
						</p>
						<p class="mt-1 max-w-[70ch] text-[10px] leading-relaxed text-muted-warm text-pretty">
							{device.statusMessage ??
								'The saved headphones are being restored without another Bluetooth prompt.'}
						</p>
					</div>
				</div>
				{#if device.canReconnect && device.status !== 'connecting'}
					<Button
						size="sm"
						variant="outline"
						class="shrink-0 border-ember/30 bg-transparent text-ember hover:bg-ember/10 hover:text-ember"
						onclick={() => void reconnect()}
					>
						<RotateCw data-icon="inline-start" />
						Reconnect H3 Pro
					</Button>
				{/if}
			</div>
		</section>
	{/if}

	<div class="grid gap-4 lg:grid-cols-2">
		<section class="studio-reveal overflow-hidden rounded-[24px] border border-hairline bg-surface" style="--reveal-delay: 140ms">
			<div class="border-b border-hairline px-5 py-4 sm:px-6">
				<p class="eyebrow">Device features</p>
				<h3 class="display mt-1.5 text-[1.65rem] leading-none text-bone">Two wireless switches</h3>
				<p class="mt-1.5 text-[11px] leading-relaxed text-muted-warm text-pretty">
					Enabling either LDAC or multipoint restarts the H3 Pro and disables the other. Spatial
					Audio is not a separate switch: applying preset 10 in the Equalizer turns LDAC off and
					may restart the headphones.
				</p>
			</div>

			<div class="flex flex-col divide-y divide-hairline-soft px-5 sm:px-6">
				{#each featureToggles as toggle (toggle.id)}
					<div class="flex items-center justify-between gap-4 py-4 sm:gap-6">
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<p class="text-[12px] font-semibold text-bone">{toggle.label}</p>
								{#if toggle.checked}
									<span class="text-[9px] font-semibold text-signal">Active</span>
								{/if}
							</div>
							<p class="mt-1 max-w-[46ch] text-[10px] leading-relaxed text-muted-warm text-pretty">
								{toggle.description}
							</p>
							{#if toggle.id === 'ldac' && device.isSpatialApplied}
								<p
									class="mt-1.5 inline-flex items-center gap-1 rounded-full border border-signal/25 bg-signal/[0.06] px-2 py-0.5 text-[9px] font-semibold text-signal"
								>
									Spatial Audio active · LDAC off
								</p>
								<p class="mt-1 max-w-[46ch] text-[10px] leading-relaxed text-muted-warm text-pretty">
									Leave Spatial Audio in the Equalizer before enabling LDAC. The headset stays on
									the spatial EQ preset until another curve is applied.
								</p>
							{:else if toggle.id === 'ldac' && device.isSpatialPreset}
								<p class="mt-1.5 text-[10px] font-medium text-ember">
									Spatial Audio selected · apply in the Equalizer
								</p>
							{/if}
						</div>
						<Switch
							checked={toggle.checked}
							onCheckedChange={(checked) => void toggleFeature(toggle, checked)}
							disabled={(!device.connected && !device.isDemo) ||
								(toggle.id === 'ldac' && device.isSpatialApplied)}
							aria-label={`Toggle ${toggle.label}`}
							class="shrink-0 data-checked:border-signal data-checked:bg-signal"
						/>
					</div>
				{/each}
			</div>

			<div class="border-t border-hairline px-5 py-3.5 text-[10px] leading-relaxed text-muted-warm sm:px-6">
				{#if device.isSpatialApplied}
					Spatial Audio is active. LDAC stays off until you apply a different EQ preset. Changes to
					LDAC or multipoint restart the H3 Pro and trigger its reconnect sequence.
				{:else if device.isDemo}
					Demo mode updates the interface only. The switches mirror their real mutual exclusion.
				{:else}
					LDAC and multipoint changes are written to the H3 Pro and trigger its restart / reconnect
					sequence. Spatial Audio is applied from the Equalizer and turns LDAC off.
				{/if}
			</div>
		</section>

		<section class="studio-reveal overflow-hidden rounded-[24px] border border-hairline bg-surface" style="--reveal-delay: 170ms">
			<div class="border-b border-hairline px-5 py-4 sm:px-6">
				<p class="eyebrow">Details</p>
				<h3 class="display mt-1.5 text-[1.65rem] leading-none text-bone">The live link</h3>
				<p class="mt-1.5 text-[11px] leading-relaxed text-muted-warm">
					Identity, sync, and the single-battery reading.
				</p>
			</div>

			<div class="flex flex-col gap-4 px-5 py-4 sm:px-6">
				<dl class="flex flex-col gap-3 text-[11px]">
					<div class="flex items-center justify-between gap-4 border-b border-hairline-soft pb-3">
						<dt class="text-muted-warm">Battery</dt>
						<dd class="flex items-center gap-1.5 font-semibold text-bone">
							{#if device.battery.leftCharging}
								<Zap class="size-3 text-signal" />
								{device.battery.left ?? '—'}% · Charging
							{:else}
								{device.battery.left ?? '—'}% · On battery
							{/if}
						</dd>
					</div>
					<div class="flex items-center justify-between gap-4 border-b border-hairline-soft pb-3">
						<dt class="text-muted-warm">Noise control</dt>
						<dd class="font-semibold text-signal">Scene ANC</dd>
					</div>
					<div class="flex items-center justify-between gap-4 border-b border-hairline-soft pb-3">
						<dt class="text-muted-warm">Equalizer</dt>
						<dd class="font-semibold text-bone">10 bands · local apply</dd>
					</div>
					<div class="flex items-center justify-between gap-4 border-b border-hairline-soft pb-3">
						<dt class="text-muted-warm">Wireless</dt>
						<dd class="font-semibold text-bone">
							LDAC {device.ldacEnabled ? 'on' : 'off'} · Multipoint
							{device.multipointEnabled ? 'on' : 'off'}
						</dd>
					</div>
					<div class="flex items-center justify-between gap-4">
						<dt class="text-muted-warm">Protocol</dt>
						<dd class="font-semibold text-bone">JL A002 · RCSP</dd>
					</div>
				</dl>

				<div class="mt-1 flex items-center gap-2 rounded-[12px] border border-hairline bg-canvas/40 px-3 py-2.5">
					<span class={cn('status-dot', device.connected && 'status-dot--live', statusTone)} aria-hidden="true"></span>
					<p class="text-[10px] font-medium text-muted-warm">
						{device.connected
							? 'Web Bluetooth session is live.'
							: device.status === 'restarting'
								? 'Waiting for the H3 Pro link to come back.'
								: 'Demo values are local; connect for live readings.'}
					</p>
				</div>
			</div>
		</section>
	</div>

	{#if bluetoothSupported !== null}
		<Alert class="studio-reveal border-hairline bg-surface" style="--reveal-delay: 210ms">
			<Info class="text-signal" />
			<AlertTitle>Web Bluetooth support</AlertTitle>
			<AlertDescription>
				Web Bluetooth is available in Chrome and Edge on desktop/Android over HTTPS or localhost.
				Safari and Firefox do not support it.
				<span class="mt-1 block font-medium text-bone">
					{bluetoothSupported
						? 'This browser supports the H3 Pro connection flow.'
						: 'This browser cannot open a BLE session, but the H3 Pro demo stays fully usable.'}
				</span>
			</AlertDescription>
		</Alert>
	{/if}
</div>
