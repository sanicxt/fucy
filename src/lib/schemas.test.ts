import { describe, expect, it } from 'vitest';
import {
	eqBandSchema,
	eqPresetSchema,
	marketResponseSchema,
	settingsSchema,
	type EqPreset
} from './schemas';

const validPreset: EqPreset = {
	id: 'balanced',
	name: 'Balanced',
	tagline: 'The honest starting point.',
	category: 'balanced',
	author: 'Fucy Studio',
	accent: 'lime',
	builtIn: false,
	gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	masterGain: 0,
	tags: ['neutral']
};

const officialBasis = {
	frequencies: [30, 45, 120, 220, 900, 1300, 2800, 6000, 7500, 11000],
	q: [0.8, 0.7, 1, 0.7, 1.5, 1.5, 1.8, 0.7, 3, 1.5],
	eqTypes: [0, 2, 2, 2, 2, 2, 2, 2, 2, 2] as (0 | 2)[]
};

const builtInPreset: EqPreset = {
	...validPreset,
	id: 'bass',
	deviceIndex: 3,
	builtIn: true,
	name: 'Bass',
	gains: [0, 3, -5, -10, 2, -7, 0, -2, -15, -6],
	masterGain: -4,
	...officialBasis
};

describe('eqBandSchema', () => {
	it('defaults the per-band eqType to 0', () => {
		expect(eqBandSchema.parse({ freq: 1000, gain: 3, q: 1 })).toEqual({
			freq: 1000,
			gain: 3,
			q: 1,
			eqType: 0
		});
	});

	it('accepts the H3 Pro eqType values 0 and 2', () => {
		expect(eqBandSchema.parse({ freq: 1000, gain: 3, q: 1, eqType: 2 }).eqType).toBe(2);
		expect(
			eqBandSchema.safeParse({ freq: 1000, gain: 3, q: 1, eqType: 1 }).success
		).toBe(false);
	});
});

describe('eqPresetSchema', () => {
	it('accepts a valid ten-band preset', () => {
		expect(eqPresetSchema.parse(validPreset)).toEqual(validPreset);
	});

	it('rejects a preset with nine bands', () => {
		const result = eqPresetSchema.safeParse({
			...validPreset,
			gains: [0, 0, 0, 0, 0, 0, 0, 0, 0]
		});
		expect(result.success).toBe(false);
	});

	it('rejects a gain outside the ±15 dB range', () => {
		const gains = [...validPreset.gains];
		gains[4] = 16;
		expect(eqPresetSchema.safeParse({ ...validPreset, gains }).success).toBe(false);

		gains[4] = -16;
		expect(eqPresetSchema.safeParse({ ...validPreset, gains }).success).toBe(false);
	});

	it('accepts the official -15 dB H3 Pro notch', () => {
		expect(eqPresetSchema.safeParse(builtInPreset).success).toBe(true);
	});

	it('rejects an unknown category', () => {
		expect(
			eqPresetSchema.safeParse({ ...validPreset, category: 'cinema' }).success
		).toBe(false);
	});

	it('accepts an optional device save index between 1 and 255', () => {
		expect(eqPresetSchema.parse({ ...validPreset, deviceIndex: 6 }).deviceIndex).toBe(6);
		expect(eqPresetSchema.parse({ ...validPreset, deviceIndex: 126 }).deviceIndex).toBe(126);
		expect(eqPresetSchema.parse(validPreset).deviceIndex).toBeUndefined();
	});

	it('rejects a device save index outside 1 to 255', () => {
		expect(eqPresetSchema.safeParse({ ...validPreset, deviceIndex: 0 }).success).toBe(false);
		expect(eqPresetSchema.safeParse({ ...validPreset, deviceIndex: 256 }).success).toBe(false);
	});

	it('requires a ten-band basis and an official id for built-ins', () => {
		expect(eqPresetSchema.safeParse(builtInPreset).success).toBe(true);

		expect(
			eqPresetSchema.safeParse({ ...builtInPreset, deviceIndex: undefined }).success
		).toBe(false);
		expect(eqPresetSchema.safeParse({ ...builtInPreset, deviceIndex: 7 }).success).toBe(false);
		expect(
			eqPresetSchema.safeParse({ ...builtInPreset, frequencies: undefined }).success
		).toBe(false);
		expect(eqPresetSchema.safeParse({ ...builtInPreset, q: undefined }).success).toBe(false);
		expect(eqPresetSchema.safeParse({ ...builtInPreset, eqTypes: undefined }).success).toBe(
			false
		);
	});

	it('rejects a built-in basis that is not ten bands long', () => {
		expect(
			eqPresetSchema.safeParse({
				...builtInPreset,
				frequencies: officialBasis.frequencies.slice(0, 9)
			}).success
		).toBe(false);
		expect(
			eqPresetSchema.safeParse({
				...builtInPreset,
				q: officialBasis.q.slice(0, 9)
			}).success
		).toBe(false);
		expect(
			eqPresetSchema.safeParse({
				...builtInPreset,
				eqTypes: officialBasis.eqTypes.slice(0, 9)
			}).success
		).toBe(false);
	});
});

describe('marketResponseSchema', () => {
	it('accepts a remote payload', () => {
		const payload = { version: 1, presets: [validPreset] };
		expect(marketResponseSchema.parse(payload).presets).toHaveLength(1);
	});

	it('rejects a payload with malformed presets', () => {
		const payload = { version: 1, presets: [{ ...validPreset, gains: 'flat' }] };
		expect(marketResponseSchema.safeParse(payload).success).toBe(false);
	});

	it('rejects a payload with an empty preset list', () => {
		expect(marketResponseSchema.safeParse({ version: 1, presets: [] }).success).toBe(false);
	});
});

describe('settingsSchema', () => {
	it('fills defaults for an empty object', () => {
		expect(settingsSchema.parse({})).toEqual({
			eqProtocol: 'multi',
			lastPresetId: 'balanced',
			deviceKind: 'headphones',
			reducedMotion: false
		});
	});

	it('rejects an unknown EQ protocol', () => {
		expect(settingsSchema.safeParse({ eqProtocol: 'magic' }).success).toBe(false);
	});
});
