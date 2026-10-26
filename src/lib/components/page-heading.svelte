<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		eyebrow,
		children
	}: {
		title: string;
		description?: string;
		eyebrow?: string;
		children?: Snippet;
	} = $props();
</script>

<header
	class="studio-reveal flex flex-col gap-5 pb-1 md:flex-row md:items-end md:justify-between md:gap-10"
	style="--reveal-delay: 30ms"
>
	<div class="flex min-w-0 max-w-3xl flex-col">
		{#if eyebrow}
			<p class="eyebrow flex items-center gap-2.5">
				<span class="h-px w-5 bg-signal/70" aria-hidden="true"></span>
				{eyebrow}
			</p>
		{/if}
		<h2 class="display mt-2.5 text-[2.45rem] leading-[0.98] text-balance text-bone sm:text-[3.1rem] lg:text-[3.35rem]">
			{title}
		</h2>
		{#if description}
			<p class="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-warm text-pretty sm:text-sm">
				{description}
			</p>
		{/if}
	</div>
	{#if children}
		<div class="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
			{@render children()}
		</div>
	{/if}
</header>
