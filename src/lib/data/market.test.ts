import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMarketPresets, marketEndpoint } from './market';
import { marketPresets } from './market-presets';

describe('marketEndpoint', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('reads the Vite public market URL', () => {
		vi.stubEnv('VITE_EQ_MARKET_URL', ' https://example.com/eq-market.json ');
		expect(marketEndpoint()).toBe('https://example.com/eq-market.json');
	});

	it('treats an empty URL as not configured', () => {
		vi.stubEnv('VITE_EQ_MARKET_URL', '   ');
		expect(marketEndpoint()).toBeUndefined();
	});
});

describe('bundled market curves', () => {
	it('falls back to ten custom curves, never the official built-ins', async () => {
		vi.stubEnv('VITE_EQ_MARKET_URL', '');
		const result = await loadMarketPresets();

		expect(result.source).toBe('bundled');
		expect(result.presets).toHaveLength(10);
		expect(result.presets).toEqual(marketPresets);
		expect(result.presets.every((preset) => !preset.builtIn)).toBe(true);
		expect(result.presets.some((preset) => preset.id === 'balanced')).toBe(false);
	});
});
