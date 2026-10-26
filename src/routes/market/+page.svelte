<script lang="ts">
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Search from '@lucide/svelte/icons/search';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Alert, AlertDescription, AlertTitle } from '#lib/components/ui/alert/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { ToggleGroup, ToggleGroupItem } from '#lib/components/ui/toggle-group/index.js';
	import EqRestartDialog from '#lib/components/eq-restart-dialog.svelte';
	import PageHeading from '#lib/components/page-heading.svelte';
	import PresetCard from '#lib/components/preset-card.svelte';
	import { loadMarketPresets, marketEndpoint, type MarketSource } from '#lib/data/market.js';
	import { marketPresets } from '#lib/data/market-presets.js';
	import { device } from '#lib/device.svelte.js';
	import type { EqPreset } from '#lib/schemas.js';
	import { cn } from '#lib/utils.js';

	type ApplyDialogMode = 'normal' | 'spatial-ldac' | 'leaving-spatial';

	let items = $state<EqPreset[]>([...marketPresets]);
	let source = $state<MarketSource>('bundled');
	let error = $state<string | null>(null);
	let loading = $state(Boolean(marketEndpoint()));
	let query = $state('');
	let category = $state('all');
	let applyDialogOpen = $state(false);
	let applyDialogMode = $state<ApplyDialogMode>('normal');
	let pendingPreset = $state<EqPreset | null>(null);

	const categories = $derived(Array.from(new Set(['all', ...items.map((preset) => preset.category)])));

	const filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return items.filter((preset) => {
			const matchesCategory = category === 'all' || preset.category === category;
			const matchesQuery =
				needle.length === 0 ||
				[preset.name, preset.tagline, preset.author, preset.category, ...preset.tags].some(
					(value) => value.toLowerCase().includes(needle)
				);
			return matchesCategory && matchesQuery;
		});
	});

	const sourceLabel = $derived(source === 'remote' ? 'Remote feed' : 'Bundled locally');

	onMount(() => {
		const controller = new AbortController();
		void refresh(controller.signal, false);
		return () => controller.abort();
	});

	async function refresh(signal?: AbortSignal, announce = true): Promise<void> {
		if (marketEndpoint()) loading = true;
		error = null;
		try {
			const result = await loadMarketPresets(signal);
			items = result.presets;
			source = result.source;
			error = result.error ?? null;
			if (announce) {
				if (result.error) {
					toast.warning('Showing bundled presets', { description: result.error });
				} else if (result.source === 'remote') {
					toast.success('Remote market loaded');
				} else {
					toast.success('Presets refreshed');
				}
			}
		} catch (cause) {
			items = [...marketPresets];
			source = 'bundled';
			error = cause instanceof Error ? cause.message : 'The EQ market is unreachable.';
			if (announce) toast.error('Showing bundled presets');
		} finally {
			loading = false;
		}
	}

	function refreshNow(): void {
		void refresh(undefined, true);
	}

	function requestPreset(preset: EqPreset): void {
		if (preset.id === device.eqPresetId && !device.eqDirty) return;
		if (device.eqApplying) return;

		// Market curves always write their own slot 126, never the custom-edit
		// slot 128, so applying one never carries the spatial preset itself and
		// cannot overwrite a user edit. The ONLY restart warning is the official
		// "leaving Spatial Audio" tip when the last applied preset was spatial.
		if (device.isSpatialApplied) {
			pendingPreset = preset;
			applyDialogMode = 'leaving-spatial';
			applyDialogOpen = true;
			return;
		}

		void applyMarketPreset(preset);
	}

	async function applyMarketPreset(preset: EqPreset, rethrow = false): Promise<void> {
		const leavingSpatial = device.isSpatialApplied;
		try {
			// Exactly one write. The controller sends one EQ frame to the custom
			// slot (126); the request guard prevents repeat clicks while waiting.
			await device.applyPreset(preset);
			if (device.eqDirty) {
				toast.warning(`${preset.name} selected locally`, {
					description: 'Reconnect H3 Pro before applying. No EQ frame was sent.'
				});
				return;
			}

			toast.success(`Applied ${preset.name}`, {
				description: device.isDemo
					? leavingSpatial
						? 'Demo mode updates the curve locally; leaving Spatial Audio simulated the restart.'
						: 'Demo mode updates the curve locally.'
					: leavingSpatial
						? 'The H3 Pro restarts after leaving Spatial Audio. The studio reconnects automatically. Written once to market slot 126.'
						: 'Written once to market slot 126. Market curves use the custom basis and apply without a restart.'
			});
		} catch (cause) {
			toast.error('Preset could not be applied', {
				description:
					cause instanceof Error ? cause.message : 'Reconnect the H3 Pro and try again.'
			});
			if (rethrow) throw cause;
		}
	}

	async function confirmPreset(): Promise<void> {
		const preset = pendingPreset;
		if (!preset) return;
		await applyMarketPreset(preset, true);
		pendingPreset = null;
	}

	function clearFilters(): void {
		query = '';
		category = 'all';
	}

	function categoryLabel(value: string): string {
		return value === 'all' ? 'All curves' : value.charAt(0).toUpperCase() + value.slice(1);
	}
</script>

<div class="flex flex-col gap-5">
	<PageHeading
		eyebrow="QCY H3 Pro · curated custom curves"
		title="Custom curves for the H3 Pro."
		description="Ten-band custom curves voiced for the QCY H3 Pro. Applying one writes market slot 126 once, so official presets (slots 1–6/10) and your own custom edits (slot 128) are never overwritten. Market curves apply without a restart; leaving Spatial Audio may restart the headphones."
	>
		<Badge variant="outline" class="h-8 gap-2 border-hairline bg-surface px-3 text-[11px] text-muted-warm">
			<span class={cn('size-1.5 rounded-full', source === 'remote' ? 'bg-ember' : 'bg-signal')}></span>
			{sourceLabel}
		</Badge>
		<Button variant="outline" size="sm" disabled={loading} onclick={refreshNow}>
			<RefreshCw data-icon="inline-start" class={loading ? 'animate-spin' : ''} />
			Refresh
		</Button>
	</PageHeading>

	{#if error}
		<Alert class="studio-reveal border-ember/25 bg-ember/[0.045]" style="--reveal-delay: 70ms">
			<TriangleAlert class="text-ember" />
			<AlertTitle>Remote market unavailable</AlertTitle>
			<AlertDescription class="text-muted-warm">
				Showing the curves bundled with the app. {error}
			</AlertDescription>
		</Alert>
	{/if}

	<div
		class="studio-reveal flex flex-col gap-3 rounded-[18px] border border-hairline bg-surface/60 p-3 xl:flex-row xl:items-center xl:justify-between"
		style="--reveal-delay: 80ms"
	>
		<div class="relative w-full xl:max-w-sm">
			<Search
				class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-warm"
			/>
			<Input
				bind:value={query}
				placeholder="Search by name, tag, or mood"
				class="h-10 rounded-full border-hairline bg-canvas/40 pl-9 text-[12px]"
				aria-label="Search H3 Pro custom curves"
			/>
		</div>

		<div class="scrollbar-none flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
			<span class="hidden shrink-0 text-[10px] font-medium text-muted-warm sm:inline">Category</span>
			<ToggleGroup
				type="single"
				bind:value={category}
				onValueChange={(value) => {
					if (!value) category = 'all';
				}}
				aria-label="Filter presets by category"
				class="w-max rounded-full border border-hairline bg-canvas/40 p-1"
			>
				{#each categories as value (value)}
					<ToggleGroupItem
						value={value}
						class="h-7 rounded-full px-3 text-[10px] font-semibold capitalize data-[state=on]:bg-signal data-[state=on]:text-primary-foreground"
					>
						{categoryLabel(value)}
					</ToggleGroupItem>
				{/each}
			</ToggleGroup>
		</div>
	</div>

	{#if loading}
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{#each Array.from({ length: 6 }) as _, index (index)}
				<div class="rounded-[18px] border border-hairline bg-surface p-5">
					<Skeleton class="h-5 w-20 rounded-full" />
					<Skeleton class="mt-4 h-6 w-40" />
					<Skeleton class="mt-2 h-4 w-full" />
					<Skeleton class="mt-5 h-14 w-full rounded-xl" />
					<div class="mt-5 flex items-center justify-between gap-3">
						<Skeleton class="h-4 w-24" />
						<Skeleton class="h-8 w-20 rounded-full" />
					</div>
				</div>
			{/each}
		</div>
	{:else if filtered.length > 0}
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{#each filtered as preset (preset.id)}
				<PresetCard
					{preset}
					active={device.eqPresetId === preset.id}
					dirty={device.eqDirty}
					onapply={requestPreset}
				/>
			{/each}
		</div>
	{:else}
		<div
			class="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-hairline bg-surface/50 px-6 py-16 text-center"
		>
			<span
				class="flex size-12 items-center justify-center rounded-full border border-hairline bg-canvas/50 text-muted-warm"
			>
				<Search class="size-5" />
			</span>
			<h3 class="display text-[1.6rem] text-bone">No H3 Pro custom curves found</h3>
			<p class="max-w-sm text-[12px] leading-relaxed text-muted-warm text-pretty">
				Try a different search or category. The bundled market has ten H3 Pro-ready custom
				curves.
			</p>
			<Button variant="outline" size="sm" class="mt-1" onclick={clearFilters}>Clear filters</Button>
		</div>
	{/if}

	<div
		class="flex flex-col gap-2 rounded-[16px] border border-hairline bg-surface/50 px-4 py-3.5 text-[10px] leading-relaxed text-muted-warm sm:flex-row sm:items-center sm:justify-between"
	>
		<p class="max-w-[80ch]">
			Market applies write exactly one EQ frame to slot 126 on the H3 Pro custom basis. Slider
			edits made in the Equalizer are a different target: custom slot 128. Market and custom
			applies do not restart the headphones; if you are leaving Spatial Audio, the H3 Pro
			restarts and the app reconnects automatically. Official presets (1–6/10) are never
			overwritten. Previews in the Equalizer stay local until Apply EQ.
		</p>
		<p class="shrink-0 font-medium text-muted-warm/80">Bundled · VITE_EQ_MARKET_URL for remote</p>
	</div>

	<EqRestartDialog bind:open={applyDialogOpen} mode={applyDialogMode} onconfirm={confirmPreset} />
</div>
