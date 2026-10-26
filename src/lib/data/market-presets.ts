import { eqPresetListSchema, type EqPreset } from '#lib/schemas.js';
import { customEqBasis } from './presets.js';

/**
 * Bundled sound-market curves. These are custom curves, not official H3 Pro
 * presets: the controller always writes them to market slot 126 so ids 1–6/10
 * are never overwritten. They use the H3 Pro's layout-level custom EQ basis so
 * the curve drawn by the card matches the ten bands actually sent. User slider
 * edits are a separate target and use custom slot 128.
 */
const marketBase = {
	builtIn: false,
	author: 'Fucy Studio',
	frequencies: [...customEqBasis.frequencies],
	q: [...customEqBasis.q],
	eqTypes: [...customEqBasis.eqTypes],
	masterGain: customEqBasis.masterGain
};

export const marketPresets: EqPreset[] = eqPresetListSchema.parse([
	{
		...marketBase,
		id: 'studio-flat',
		name: 'Studio Flat',
		tagline: 'A neutral reference curve for checking your own edits.',
		category: 'balanced',
		accent: 'lime',
		gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		tags: ['neutral', 'reference']
	},
	{
		...marketBase,
		id: 'deep-bass',
		name: 'Deep Bass',
		tagline: 'Weight in the low end without the mud.',
		category: 'bass',
		accent: 'violet',
		gains: [6, 5, 4, 2, 0, -1, -1, 0, 0, 0],
		tags: ['hip-hop', 'electronic', 'warm']
	},
	{
		...marketBase,
		id: 'vocal-focus',
		name: 'Vocal Focus',
		tagline: 'Push voices forward for calls and podcasts.',
		category: 'vocal',
		accent: 'cyan',
		gains: [-2, -1, 0, 1, 3, 4, 3, 1, 0, -1],
		tags: ['speech', 'calls']
	},
	{
		...marketBase,
		id: 'bright-air',
		name: 'Bright Air',
		tagline: 'Open the top end for detail and space.',
		category: 'treble',
		accent: 'pink',
		gains: [-1, 0, 0, 0, 1, 2, 3, 4, 4, 3],
		tags: ['acoustic', 'jazz', 'airy']
	},
	{
		...marketBase,
		id: 'commute',
		name: 'Commute',
		tagline: 'A little extra body under city noise.',
		category: 'bass',
		accent: 'lime',
		gains: [4, 3, 2, 1, 0, -2, -2, -1, 0, 0],
		tags: ['travel', 'anc']
	},
	{
		...marketBase,
		id: 'late-night',
		name: 'Late Night',
		tagline: 'Softened highs for low-volume listening.',
		category: 'balanced',
		accent: 'violet',
		gains: [3, 2, 1, 0, -1, -2, -2, -1, 0, 0],
		tags: ['quiet', 'ambient']
	},
	{
		...marketBase,
		id: 'gaming',
		name: 'Game Detail',
		tagline: 'Footsteps and cues without a harsh edge.',
		category: 'gaming',
		accent: 'cyan',
		gains: [3, 2, 0, -1, -2, 0, 2, 4, 5, 4],
		tags: ['fps', 'positional']
	},
	{
		...marketBase,
		id: 'podcast',
		name: 'Podcast',
		tagline: 'Clear speech, restrained rumble.',
		category: 'podcast',
		accent: 'pink',
		gains: [-3, -2, 0, 2, 4, 4, 3, 1, -1, -2],
		tags: ['talk', 'long-form']
	},
	{
		...marketBase,
		id: 'acoustic',
		name: 'Acoustic Room',
		tagline: 'A gentle lift for strings and wood.',
		category: 'balanced',
		accent: 'lime',
		gains: [1, 1, 0, 1, 2, 2, 2, 1, 0, 0],
		tags: ['folk', 'instrumental']
	},
	{
		...marketBase,
		id: 'warm-tape',
		name: 'Warm Tape',
		tagline: 'Rounded lows, soft treble, analog feel.',
		category: 'vocal',
		accent: 'violet',
		gains: [2, 2, 1, 0, -1, -1, 0, 1, 1, 1],
		tags: ['soul', 'lo-fi', 'warm']
	}
]);
