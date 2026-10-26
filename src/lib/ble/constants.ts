/** UUIDs and protocol constants for the QCY A001 and JieLi A002 stacks. */

export const SERVICE_UUID = '0000a001-0000-1000-8000-00805f9b34fb';

export const CHAR_WRITE = '00001001-0000-1000-8000-00805f9b34fb';
export const CHAR_NOTIFY = '00001002-0000-1000-8000-00805f9b34fb';
export const CHAR_BATTERY = '00000008-0000-1000-8000-00805f9b34fb';
export const CHAR_VERSION = '00000007-0000-1000-8000-00805f9b34fb';
export const CHAR_EQ_LEGACY = '0000000b-0000-1000-8000-00805f9b34fb';
export const CHAR_KEY_FUNCTION = '0000000d-0000-1000-8000-00805f9b34fb';
export const CHAR_FUNCTION_V1 = '0000000f-0000-1000-8000-00805f9b34fb';
export const CHAR_LANGUAGE = '00000009-0000-1000-8000-00805f9b34fb';
export const CHAR_RESET_V1 = '0000000a-0000-1000-8000-00805f9b34fb';
export const CHAR_TIME_V1 = '0000000c-0000-1000-8000-00805f9b34fb';

/** Command ids shared by the A001 TLV protocol and the A002 TLV payloads. */
export const CMD = {
	RESET_DEFAULT: 1,
	CLEAR_PAIRING: 2,
	FACTORY_RESET: 3,
	MUSIC_ACTION: 4,
	WEAR_DETECTION: 6,
	NOISE_LEVEL: 7,
	VOLUME: 8,
	NOISE_MODE: 12,
	ANC_SETTING: 23,
	RENAME: 24,
	VOICE_LANGUAGE: 25,
	MULTI_EQ: 34,
	LDAC: 35,
	MULTIPOINT: 36,
	KEY_FUNCTION: 43,
	SPATIAL_AUDIO: 45,
	BATTERY: 47,
	VERSION: 48,
	SYNC_TIME: 62,
	REQUEST_DATA: 254
} as const;

export const ANC_MODE = {
	ANC: 1,
	TRANSPARENCY: 2,
	NORMAL: 3
} as const;

export type AncModeValue = (typeof ANC_MODE)[keyof typeof ANC_MODE];

/** Frequencies used by QCY's generic ten-band EQ (A001 and older devices). */
export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

/**
 * H3 Pro (16759) official bands. The panel's `sys_eq` entries each carry
 * their own `freq`, `q`, and `iitType` arrays; these are the ten built-in
 * frequencies shared by all seven official presets.
 */
export const H3_PRO_EQ_FREQUENCIES = [30, 45, 120, 220, 900, 1300, 2800, 6000, 7500, 11000] as const;

/**
 * H3 Pro custom/market EQ basis. This is the panel layout's top-level
 * `freq`/`q`/`iitType` set, used by `individuation_eq` and the sound market.
 */
export const H3_PRO_CUSTOM_FREQUENCIES = [
	32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
] as const;

export const H3_PRO_CUSTOM_Q = [0.4, 1.2, 1.5, 1.5, 1.2, 0.8, 1.2, 1.2, 1.2, 1.2] as const;

/**
 * Sound-market slot. The decompiled H3 Pro panel writes `setEQMarketData`
 * curves to JL slot 126, using the layout-level custom EQ basis.
 */
export const MARKET_EQ_SAVE_INDEX = 126;

/**
 * User custom slot. The panel's `CustomEQLayout` and `CustomEQNewDialog`
 * paths submit save index 128 directly. `CustomEQEdit2Activity` submits 255;
 * `QCYConnectManager` normalizes that request to 128 whenever a previous EQ
 * exists (255 remains the no-slot sentinel when there is none). The studio
 * always has the official panel curve as prior context, so it addresses 128
 * directly and never merges the edit with a built-in preset's basis.
 *
 * Built-in ids 1–6/10 and market slot 126 must never be used for a custom
 * slider edit.
 */
export const CUSTOM_EQ_SAVE_INDEX = 128;

/** Official H3 Pro preset ids in the panel's `sys_eq` list. */
export const H3_PRO_BUILTIN_SAVE_INDEXES = [1, 2, 3, 4, 5, 6, 10] as const;

/**
 * Official presets reach -15 dB (the 8 kHz notch in the panel's `sys_eq`).
 * Keep the same ±15 dB window so applying a preset never silently clips it.
 */
export const EQ_MIN_GAIN = -15;
export const EQ_MAX_GAIN = 15;
export const EQ_DEFAULT_Q = 1;

/** A frame can carry at most 255 payload bytes after the two-byte header. */
export const MAX_FRAME_PAYLOAD = 255;

/** JieLi RCSP service used by JL-family QCY devices. */
export const SERVICE_UUID_A002 = '0000a002-0000-1000-8000-00805f9b34fb';
export const CHAR_A002_WRITE = '00000001-0000-1000-8000-00805f9b34fb';
export const CHAR_A002_NOTIFY = '00000002-0000-1000-8000-00805f9b34fb';

export const RCSP_MAGIC = [0xfe, 0xdc, 0xba] as const;
export const RCSP_TAIL = 0xef;
export const RCSP_OPCODE_CUSTOM = 0xff;
export const RCSP_FLAG_COMMAND = 0x80;
export const RCSP_FLAG_RESPONSE = 0x40;
