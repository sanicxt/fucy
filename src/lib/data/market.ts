import { marketResponseSchema, type EqPreset } from '#lib/schemas.js';
import { marketPresets as bundledPresets } from './market-presets.js';
import { customEqBasis } from './presets.js';

export type MarketSource = 'bundled' | 'remote';

export type MarketResult = {
	presets: EqPreset[];
	source: MarketSource;
	error?: string;
};

export function marketEndpoint(): string | undefined {
	const env = import.meta.env as Record<string, string | undefined>;
	const value = env.VITE_EQ_MARKET_URL ?? env.PUBLIC_EQ_MARKET_URL;
	return value?.trim() || undefined;
}

/**
 * The market adapter. Point `VITE_EQ_MARKET_URL` at a CORS-enabled JSON
 * endpoint returning `{ version, presets }`; anything invalid falls back
 * to the bundled curves so the page is never empty.
 *
 * Remote entries are always treated as market curves. Even if a payload
 * carries a `deviceIndex` from an older copy, the controller writes market
 * curves to slot 126 so they can never overwrite an official H3 Pro preset.
 * Their basis is normalized to the H3 Pro custom EQ layout, matching the
 * decompiled market path and the curve the card draws.
 */
export async function loadMarketPresets(signal?: AbortSignal): Promise<MarketResult> {
	const url = marketEndpoint();
	if (!url) {
		return { presets: bundledPresets, source: 'bundled' };
	}

	try {
		const response = await fetch(url, {
			headers: { accept: 'application/json' },
			signal
		});

		if (!response.ok) {
			throw new Error(`The EQ market returned HTTP ${response.status}.`);
		}

		const payload: unknown = await response.json();
		const parsed = marketResponseSchema.safeParse(payload);

		if (!parsed.success) {
			throw new Error('The EQ market payload did not match the expected shape.');
		}

		const presets = parsed.data.presets.map((preset) => ({
			...preset,
			builtIn: false,
			deviceIndex: undefined,
			frequencies: [...customEqBasis.frequencies],
			q: [...customEqBasis.q],
			eqTypes: [...customEqBasis.eqTypes]
		}));

		return { presets, source: 'remote' };
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			return { presets: bundledPresets, source: 'bundled' };
		}
		return {
			presets: bundledPresets,
			source: 'bundled',
			error: error instanceof Error ? error.message : 'The EQ market is unreachable.'
		};
	}
}

export async function remoteMarketPresets(signal?: AbortSignal): Promise<EqPreset[]> {
	const result = await loadMarketPresets(signal);
	return result.presets;
}
