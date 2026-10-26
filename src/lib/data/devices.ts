import {
	deviceProfileSchema,
	type AncMode,
	type BatteryState,
	type DeviceKind,
	type DeviceProfile
} from '#lib/schemas.js';

export type H3ProAncSetting = {
	mode: number;
	scene: number;
	level: number;
};

/**
 * H3 Pro (16759 / JL A002) packs ANC state into three bytes: mode, scene,
 * level. Values come from the panel's defaultcmd and scene command ranges.
 * The mode numbers are JL-specific (normal is 2, transparency is 3).
 */
export const H3_PRO_ANC_MODES: Record<AncMode, H3ProAncSetting> = {
	anc: { mode: 1, scene: 1, level: 2 },
	transparency: { mode: 3, scene: 1, level: 4 },
	normal: { mode: 2, scene: 0, level: 0 }
};

export type H3ProAncScene = H3ProAncSetting & {
	id: 'adaptive' | 'noisy' | 'commute' | 'indoor' | 'wind';
	label: string;
};

export const H3_PRO_ANC_SCENES: H3ProAncScene[] = [
	{ id: 'adaptive', label: 'Adaptive', mode: 1, scene: 5, level: 0 },
	{ id: 'noisy', label: 'Noisy', mode: 1, scene: 1, level: 0 },
	{ id: 'commute', label: 'Commute', mode: 1, scene: 2, level: 0 },
	{ id: 'indoor', label: 'Indoor', mode: 1, scene: 3, level: 0 },
	{ id: 'wind', label: 'Wind', mode: 1, scene: 4, level: 0 }
];

const profiles: Record<DeviceKind, DeviceProfile> = {
	earbuds: {
		kind: 'earbuds',
		name: 'QCY MeloBuds Pro',
		model: 'MeloBuds Pro',
		firmware: '1.0.7',
		summary: 'True wireless earbuds · left, right, and case',
		battery: {
			left: 86,
			right: 83,
			case: 64,
			leftCharging: false,
			rightCharging: false,
			caseCharging: false,
			hasCase: true
		},
		capabilities: {
			anc: true,
			eq: true,
			playback: true,
			volume: true,
			ldac: true,
			multipoint: true,
			spatial: true,
			wearDetection: true
		}
	},
	headphones: {
		kind: 'headphones',
		name: 'QCY H3 Pro',
		model: 'H3 Pro',
		firmware: '1.0.0',
		summary: 'Over-ear headphones · adaptive ANC and one battery',
		battery: {
			left: 78,
			right: null,
			case: null,
			leftCharging: false,
			rightCharging: false,
			caseCharging: false,
			hasCase: false
		},
		capabilities: {
			anc: true,
			eq: true,
			playback: true,
			volume: true,
			ldac: true,
			multipoint: true,
			spatial: false,
			wearDetection: false
		}
	},
	speaker: {
		kind: 'speaker',
		name: 'QCY SP300',
		model: 'SP300',
		firmware: '2.0.4',
		summary: 'Portable speaker · one battery, no noise control',
		battery: {
			left: 92,
			right: null,
			case: null,
			leftCharging: false,
			rightCharging: false,
			caseCharging: false,
			hasCase: false
		},
		capabilities: {
			anc: false,
			eq: true,
			playback: true,
			volume: true,
			ldac: false,
			multipoint: false,
			spatial: false,
			wearDetection: false
		}
	}
};

/** Demo profiles are validated once at module load so bad demo data fails loudly in dev. */
export const demoProfiles = (Object.keys(profiles) as DeviceKind[]).map((kind) =>
	deviceProfileSchema.parse(profiles[kind])
);

export const deviceKindLabels: Record<DeviceKind, string> = {
	earbuds: 'Earbuds',
	headphones: 'Headphones',
	speaker: 'Speaker'
};

export const deviceKindHints: Record<DeviceKind, string> = {
	earbuds: 'TWS layout with left, right, and case batteries.',
	headphones: 'Single battery. Over-ear headphones and headsets share this layout.',
	speaker: 'Single battery and no ANC controls.'
};

export function demoProfile(kind: DeviceKind): DeviceProfile {
	return demoProfiles.find((profile) => profile.kind === kind) ?? demoProfiles[0]!;
}

/**
 * Web Bluetooth cannot expose the manufacturer data that the Android app uses
 * to identify a model. Infer the closest layout from the advertised name and
 * the battery shape, then let the user correct it from the device page.
 */
export function inferDeviceKind(name: string, battery?: BatteryState): DeviceKind {
	const normalized = name.toLowerCase().replace(/[-_]/g, ' ');

	if (/\b(sp\s?\d{1,4}|speaker|soundbox|party|boombox)\b/.test(normalized)) return 'speaker';
	if (/\b(h\s?\d{1,2}|ht\s?\d{1,2}|headphone|headset|over[\s-]?ear)\b/.test(normalized)) {
		return 'headphones';
	}

	if (battery) {
		if (battery.hasCase && battery.case !== null) return 'earbuds';
		if (!battery.hasCase && battery.right === null) return 'headphones';
	}

	return 'earbuds';
}
