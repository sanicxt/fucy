import { z } from 'zod';
import {
	EQ_MAX_GAIN,
	EQ_MIN_GAIN,
	H3_PRO_BUILTIN_SAVE_INDEXES
} from './ble/constants';

/** H3 Pro band type from the panel's per-preset `iitType` values. */
export const eqTypeSchema = z.union([z.literal(0), z.literal(2)]);

export const eqBandSchema = z.object({
	freq: z.number().int().positive().max(20_000),
	gain: z.number().min(EQ_MIN_GAIN).max(EQ_MAX_GAIN),
	q: z.number().positive().max(20),
	eqType: eqTypeSchema.default(0)
});

export const presetCategorySchema = z.enum([
	'balanced',
	'bass',
	'vocal',
	'treble',
	'gaming',
	'podcast',
	'pop',
	'rock',
	'classical',
	'spatial'
]);

export const presetAccentSchema = z.enum(['lime', 'cyan', 'violet', 'pink']);

const tenBands = <T extends z.ZodType>(schema: T) => z.array(schema).length(10);

const builtInSaveIndexes = new Set<number>(H3_PRO_BUILTIN_SAVE_INDEXES);

/**
 * A preset can carry its own H3 Pro curve basis. Built-ins must provide all
 * three ten-band arrays plus the official `deviceIndex` (1–6/10); market
 * presets may omit them and the controller maps them to slot 126 on the H3
 * Pro custom basis. User slider edits are not presets and always use slot 128.
 */
export const eqPresetSchema = z
	.object({
		id: z.string().min(1),
		/** Official H3 Pro preset id (1–6/10) for built-ins. Market presets may omit it. */
		deviceIndex: z.number().int().min(1).max(255).optional(),
		/** Marks this curve as one of the seven official H3 Pro presets. */
		builtIn: z.boolean().default(false),
		name: z.string().min(1).max(40),
		tagline: z.string().min(1).max(120),
		category: presetCategorySchema,
		author: z.string().min(1).max(60),
		accent: presetAccentSchema,
		gains: tenBands(z.number().min(EQ_MIN_GAIN).max(EQ_MAX_GAIN)),
		frequencies: tenBands(z.number().int().positive().max(20_000)).optional(),
		q: tenBands(z.number().positive().max(20)).optional(),
		eqTypes: tenBands(eqTypeSchema).optional(),
		masterGain: z.number().min(EQ_MIN_GAIN).max(EQ_MAX_GAIN).default(0),
		tags: z.array(z.string().min(1).max(24)).max(6).default([])
	})
	.superRefine((preset, ctx) => {
		if (!preset.builtIn) return;

		if (preset.deviceIndex === undefined) {
			ctx.addIssue({
				code: 'custom',
				message: 'Built-in H3 Pro presets require the official deviceIndex.',
				path: ['deviceIndex']
			});
		} else if (!builtInSaveIndexes.has(preset.deviceIndex)) {
			ctx.addIssue({
				code: 'custom',
				message: 'Built-in H3 Pro presets must use one of the official ids 1–6 or 10.',
				path: ['deviceIndex']
			});
		}

		for (const key of ['frequencies', 'q', 'eqTypes'] as const) {
			if (!preset[key]) {
				ctx.addIssue({
					code: 'custom',
					message: 'Built-in H3 Pro presets require a ten-band curve basis.',
					path: [key]
				});
			}
		}
	});

export const eqPresetListSchema = z.array(eqPresetSchema).min(1);

export const batterySchema = z.object({
	left: z.number().int().min(0).max(100).nullable(),
	right: z.number().int().min(0).max(100).nullable(),
	case: z.number().int().min(0).max(100).nullable(),
	leftCharging: z.boolean(),
	rightCharging: z.boolean(),
	caseCharging: z.boolean(),
	hasCase: z.boolean()
});

export const ancModeSchema = z.enum(['anc', 'transparency', 'normal']);

export const eqProtocolSchema = z.enum(['multi', 'legacy']);

export const deviceKindSchema = z.enum(['earbuds', 'headphones', 'speaker']);

export const deviceCapabilitiesSchema = z.object({
	anc: z.boolean(),
	eq: z.boolean(),
	playback: z.boolean(),
	volume: z.boolean(),
	ldac: z.boolean(),
	multipoint: z.boolean(),
	spatial: z.boolean(),
	wearDetection: z.boolean()
});

export const deviceProfileSchema = z.object({
	kind: deviceKindSchema,
	name: z.string().min(1).max(60),
	model: z.string().min(1).max(40),
	firmware: z.string().min(1).max(20),
	summary: z.string().min(1).max(140),
	battery: batterySchema,
	capabilities: deviceCapabilitiesSchema
});

export const settingsSchema = z.object({
	eqProtocol: eqProtocolSchema.default('multi'),
	lastPresetId: z.string().default('balanced'),
	deviceKind: deviceKindSchema.default('headphones'),
	reducedMotion: z.boolean().default(false)
});

export const marketResponseSchema = z.object({
	version: z.number().int().nonnegative(),
	presets: eqPresetListSchema
});

export type EqBand = z.infer<typeof eqBandSchema>;
export type EqPreset = z.infer<typeof eqPresetSchema>;
export type PresetCategory = z.infer<typeof presetCategorySchema>;
export type PresetAccent = z.infer<typeof presetAccentSchema>;
export type BatteryState = z.infer<typeof batterySchema>;
export type AncMode = z.infer<typeof ancModeSchema>;
export type EqProtocol = z.infer<typeof eqProtocolSchema>;
export type DeviceKind = z.infer<typeof deviceKindSchema>;
export type DeviceCapabilities = z.infer<typeof deviceCapabilitiesSchema>;
export type DeviceProfile = z.infer<typeof deviceProfileSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type MarketResponse = z.infer<typeof marketResponseSchema>;
