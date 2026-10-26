import { eqPresetListSchema, type EqPreset } from '#lib/schemas.js';
import {
	H3_PRO_CUSTOM_FREQUENCIES,
	H3_PRO_CUSTOM_Q,
	H3_PRO_EQ_FREQUENCIES
} from '#lib/ble/constants.js';

/**
 * Official QCY H3 Pro (panel model 16759, firmware 1.0.0) built-in EQ presets.
 *
 * The panel stores each preset's `eqs` as dB values, not 0.1 dB. SysEQSeted
 * keeps the parsed value in `gainsFloat` and the JL command-34 builder writes
 * `round(gain * 100)` into the i16 gain field, so the values below are already
 * dB. Do not divide them by 10. See README for the decompiled references.
 *
 * `deviceIndex` is the panel's `sys_eq[].id` and is used verbatim as the
 * command-34 save index (1–6 and 10). Market curves use slot 126 and user
 * custom slider edits use slot 128.
 */
const OFFICIAL_FREQUENCIES = [...H3_PRO_EQ_FREQUENCIES];
const OFFICIAL_EQ_TYPES = [0, 2, 2, 2, 2, 2, 2, 2, 2, 2] as const;

const officialBase = {
	builtIn: true,
	author: 'QCY H3 Pro',
	accent: 'lime' as const,
	frequencies: OFFICIAL_FREQUENCIES,
	eqTypes: [...OFFICIAL_EQ_TYPES],
	masterGain: -4
};

/**
 * The layout-level custom EQ basis from the same panel. The H3 Pro uses these
 * bands for `individuation_eq` and the sound market. A slider edit after a
 * built-in preset switches to this basis (it must not inherit the official
 * preset's frequencies/Q), and custom edits are written to slot 128.
 */
export const customEqBasis: Required<
	Pick<EqPreset, 'frequencies' | 'q' | 'eqTypes' | 'masterGain'>
> = {
	frequencies: [...H3_PRO_CUSTOM_FREQUENCIES],
	q: [...H3_PRO_CUSTOM_Q],
	eqTypes: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
	masterGain: 0
};

const officialPresets = [
	{
		...officialBase,
		id: 'balanced',
		deviceIndex: 1,
		name: 'Balanced',
		tagline: 'The official Default tuning, balanced for everyday listening.',
		category: 'balanced',
		accent: 'lime',
		gains: [0, -3, -7, -13, 2, -5, 3, 2, -15, -4],
		q: [0.7, 0.7, 1, 0.7, 1.5, 2, 1.8, 2, 3, 2.5],
		tags: ['official', 'default', 'neutral']
	},
	{
		...officialBase,
		id: 'pop',
		deviceIndex: 2,
		name: 'Pop',
		tagline: 'Forward vocals and a lifted top end for modern pop.',
		category: 'pop',
		accent: 'pink',
		gains: [0, -8, -9, -15, 2, -5, 3, 2, -12, -2],
		q: [0.5, 0.5, 1, 0.7, 1.5, 2, 1.8, 1, 3, 2.5],
		tags: ['official', 'vocal', 'bright']
	},
	{
		...officialBase,
		id: 'bass',
		deviceIndex: 3,
		name: 'Bass',
		tagline: 'Deep low-end weight for hip-hop, electronic, and travel.',
		category: 'bass',
		accent: 'violet',
		gains: [0, 3, -5, -10, 2, -7, 0, -2, -15, -6],
		q: [0.8, 0.7, 1, 0.7, 1.5, 1.5, 1.8, 0.7, 3, 1.5],
		tags: ['official', 'low-end', 'warm']
	},
	{
		...officialBase,
		id: 'rock',
		deviceIndex: 4,
		name: 'Rock',
		tagline: 'Punchy low mids and a crisp attack for guitars and drums.',
		category: 'rock',
		accent: 'cyan',
		gains: [0, 2, -5, -12, -3, -7, 5, 2, -10, -2],
		q: [0.7, 0.7, 1, 0.7, 0.5, 1.8, 1, 1, 3, 2.5],
		tags: ['official', 'guitars', 'punch']
	},
	{
		...officialBase,
		id: 'soft',
		deviceIndex: 5,
		name: 'Soft',
		tagline: 'Relaxed highs and a gentle low end for long, quiet sessions.',
		category: 'balanced',
		accent: 'violet',
		gains: [0, -5, -7, -15, 2, -5, 3, 1, -15, -4],
		q: [0.7, 0.5, 1, 0.5, 1.5, 2, 1.8, 2, 2, 2],
		tags: ['official', 'quiet', 'relaxed']
	},
	{
		...officialBase,
		id: 'classical',
		deviceIndex: 6,
		name: 'Classical',
		tagline: 'Open dynamics and detail for strings, piano, and orchestral works.',
		category: 'classical',
		accent: 'lime',
		gains: [0, 1, -3, -8, 2, -5, 3, 2, -15, -4],
		q: [0.7, 0.7, 1, 0.7, 1, 2, 1.8, 2, 3, 2.5],
		tags: ['official', 'orchestral', 'detail']
	},
	{
		...officialBase,
		id: 'spatial',
		deviceIndex: 10,
		name: 'Spatial Audio',
		tagline: "QCY's wide, immersive curve for games and movies.",
		category: 'spatial',
		accent: 'cyan',
		gains: [0, -3, -7, -13, 2, -5, 3, 2, -15, -4],
		q: [0.7, 0.7, 1, 0.7, 1.5, 2, 1.8, 2, 3, 2.5],
		tags: ['official', 'spatial', 'cinema']
	}
];

/** Parse once at module load so a malformed official curve fails loudly. */
export const presets: EqPreset[] = eqPresetListSchema.parse(officialPresets);

export const presetById = (id: string): EqPreset | undefined =>
	presets.find((preset) => preset.id === id);

export const defaultPreset = presets[0];
