import {
	ANC_MODE,
	CUSTOM_EQ_SAVE_INDEX,
	EQ_DEFAULT_Q,
	EQ_MAX_GAIN,
	EQ_MIN_GAIN,
	MAX_FRAME_PAYLOAD,
	RCSP_FLAG_COMMAND,
	RCSP_FLAG_RESPONSE,
	RCSP_MAGIC,
	RCSP_OPCODE_CUSTOM,
	RCSP_TAIL
} from './constants';

export class QcyProtocolError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'QcyProtocolError';
	}
}

export type QcyCommand = {
	cmd: number;
	data: Uint8Array | number[];
};

export type ParsedCommand = {
	cmd: number;
	data: Uint8Array;
};

export type EqBand = {
	freq: number;
	gain: number;
	q: number;
	/** H3 Pro per-band `iitType`. 0 and 2 are the values used by the panel. */
	eqType?: 0 | 2;
};

export type Battery = {
	left: number | null;
	right: number | null;
	case: number | null;
	leftCharging: boolean;
	rightCharging: boolean;
	caseCharging: boolean;
	hasCase: boolean;
};

function bytesOf(data: DataView | Uint8Array | number[]): Uint8Array {
	if (data instanceof Uint8Array) return data;
	if (data instanceof DataView) {
		return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	}
	return Uint8Array.from(data);
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function u16le(value: number): [number, number] {
	const v = Math.max(0, Math.min(0xffff, Math.round(value)));
	return [v & 0xff, (v >> 8) & 0xff];
}

function i16le(value: number): [number, number] {
	const v = Math.max(-0x8000, Math.min(0x7fff, Math.round(value)));
	const unsigned = v < 0 ? v + 0x10000 : v;
	return [unsigned & 0xff, (unsigned >> 8) & 0xff];
}

/**
 * Build `FF <payload length> (cmd, data length, data...)...`.
 * The length byte counts every byte after the two-byte header.
 */
export function encodeFrame(commands: QcyCommand[]): Uint8Array {
	let payloadLength = 0;
	for (const command of commands) {
		const data = bytesOf(command.data);
		if (data.length > 255) {
			throw new QcyProtocolError('Command data cannot exceed 255 bytes');
		}
		payloadLength += 2 + data.length;
	}

	if (payloadLength > MAX_FRAME_PAYLOAD) {
		throw new QcyProtocolError('Frame length cannot exceed 255 bytes');
	}

	const frame = new Uint8Array(2 + payloadLength);
	frame[0] = 0xff;
	frame[1] = payloadLength;

	let offset = 2;
	for (const command of commands) {
		const data = bytesOf(command.data);
		frame[offset] = command.cmd & 0xff;
		frame[offset + 1] = data.length;
		frame.set(data, offset + 2);
		offset += 2 + data.length;
	}

	return frame;
}

/**
 * Decode one complete A001 notification. A frame that is split across ATT
 * boundaries, truncated, or has a mismatched length byte is rejected whole.
 */
export function decodeFrame(input: DataView | Uint8Array): ParsedCommand[] {
	const bytes =
		input instanceof Uint8Array
			? input
			: new Uint8Array(input.buffer, input.byteOffset, input.byteLength);

	if (bytes.length < 4) {
		throw new QcyProtocolError('Frame is too short to contain a command');
	}

	if (bytes[0] !== 0xff) {
		throw new QcyProtocolError('Frame does not start with 0xFF');
	}

	const declared = bytes[1];
	if (bytes.length !== declared + 2) {
		throw new QcyProtocolError(
			`Frame length mismatch: declared ${declared + 2}, received ${bytes.length}`
		);
	}

	const commands: ParsedCommand[] = [];
	let offset = 2;

	while (offset < bytes.length) {
		if (offset + 1 >= bytes.length) {
			throw new QcyProtocolError('Frame ends before a command length');
		}

		const cmd = bytes[offset];
		const dataLength = bytes[offset + 1];
		const end = offset + 2 + dataLength;

		if (end > bytes.length) {
			throw new QcyProtocolError(
				`Command 0x${cmd.toString(16)} length overruns the frame`
			);
		}

		commands.push({ cmd, data: bytes.slice(offset + 2, end) });
		offset = end;
	}

	return commands;
}

export function buildRequest(cmd: number): Uint8Array {
	return encodeFrame([{ cmd: 254, data: [cmd] }]);
}

export function buildSetNoiseMode(mode: number): Uint8Array {
	return encodeFrame([{ cmd: 12, data: [mode & 0xff] }]);
}

export function buildSetNoiseLevel(level: number): Uint8Array {
	return encodeFrame([{ cmd: 7, data: [Math.round(clamp(level, 0, 100))] }]);
}

export function buildSetAnc(mode: number, scene: number, level: number): Uint8Array {
	// The app normalises the legacy "3,1,0" UI value to "3,2,0".
	const resolvedScene = mode === ANC_MODE.NORMAL && scene === 1 && level === 0 ? 2 : scene;
	return encodeFrame([
		{
			cmd: 23,
			data: [
				mode & 0xff,
				resolvedScene & 0xff,
				Math.round(clamp(level, 0, 100)) & 0xff
			]
		}
	]);
}

export function buildSetVolume(level: number): Uint8Array {
	const value = Math.round(clamp(level, 0, 100));
	return encodeFrame([{ cmd: 8, data: [value, value, 0] }]);
}

export function buildMusicAction(action: 1 | 2 | 3 | 4): Uint8Array {
	return encodeFrame([{ cmd: 4, data: [action] }]);
}

function togglePayload(enabled: boolean): [number] {
	return [enabled ? 1 : 2];
}

export function buildSetWearDetection(enabled: boolean): Uint8Array {
	return encodeFrame([{ cmd: 6, data: togglePayload(enabled) }]);
}

export function buildSetLdac(enabled: boolean): Uint8Array {
	// JL firmware expects 0 for off (the A001-style 2 is not accepted).
	return encodeFrame([{ cmd: 35, data: [enabled ? 1 : 0] }]);
}

export function buildSetMultipoint(enabled: boolean): Uint8Array {
	// JL firmware expects 0 for off, matching the LDAC switch.
	return encodeFrame([{ cmd: 36, data: [enabled ? 1 : 0] }]);
}

export function buildSetSpatialAudio(enabled: boolean): Uint8Array {
	return encodeFrame([{ cmd: 45, data: togglePayload(enabled) }]);
}

/**
 * Multi-band EQ (command 34). Each band is seven bytes:
 * frequency u16 LE, gain i16 LE (0.01 dB), Q i16 LE (0.01), eq type.
 *
 * `saveIndex` is the device preset slot to save into. Official H3 Pro
 * presets use their panel id (1–6 and 10), market curves use slot 126, and
 * user slider edits use custom slot 128. The default deliberately points at
 * the custom slot so a generic call cannot overwrite a built-in preset or a
 * market curve.
 */
export function buildSetEq(
	bands: EqBand[],
	masterGain = 0,
	saveIndex = CUSTOM_EQ_SAVE_INDEX
): Uint8Array {
	if (bands.length === 0) {
		throw new QcyProtocolError('At least one EQ band is required');
	}

	const data = new Uint8Array(3 + bands.length * 7);
	data[0] = Math.round(clamp(saveIndex, 0, 255));
	const [masterLow, masterHigh] = i16le(masterGain * 100);
	data[1] = masterLow;
	data[2] = masterHigh;

	let offset = 3;
	for (const band of bands) {
		const [freqLow, freqHigh] = u16le(band.freq);
		const [gainLow, gainHigh] = i16le(clamp(band.gain, EQ_MIN_GAIN, EQ_MAX_GAIN) * 100);
		const [qLow, qHigh] = i16le(clamp(band.q, 0.01, 20) * 100);

		data[offset] = freqLow;
		data[offset + 1] = freqHigh;
		data[offset + 2] = gainLow;
		data[offset + 3] = gainHigh;
		data[offset + 4] = qLow;
		data[offset + 5] = qHigh;
		data[offset + 6] = band.eqType ?? 0;
		offset += 7;
	}

	return encodeFrame([{ cmd: 34, data }]);
}

/** Raw legacy EQ write for characteristic 0000000B: [eqType, ten int8 dB gains]. */
export function buildLegacyEq(gains: number[], eqType = 0): Uint8Array {
	const payload = new Uint8Array(1 + gains.length);
	payload[0] = eqType & 0xff;
	gains.forEach((gain, index) => {
		payload[index + 1] = Math.round(clamp(gain, EQ_MIN_GAIN, EQ_MAX_GAIN)) & 0xff;
	});
	return payload;
}

export function buildSyncTime(date = new Date()): Uint8Array {
	return encodeFrame([
		{
			cmd: 62,
			data: [
				date.getFullYear() % 100,
				date.getMonth() + 1,
				date.getDate(),
				date.getHours(),
				date.getMinutes(),
				date.getSeconds(),
				1 << date.getDay()
			]
		}
	]);
}

export function parseBattery(bytes: Uint8Array): Battery {
	const read = (value: number | undefined) => {
		if (value === undefined) return { percent: null, charging: false };
		return { percent: value & 0x7f, charging: (value & 0x80) !== 0 };
	};

	const left = read(bytes[0]);
	const right = read(bytes[1]);
	const box = read(bytes[2]);

	return {
		left: left.percent,
		right: right.percent,
		case: box.percent,
		leftCharging: left.charging,
		rightCharging: right.charging,
		caseCharging: box.charging,
		hasCase: bytes.length >= 3
	};
}

function formatTriplet(bytes: Uint8Array, offset: number): string {
	return `${bytes[offset] ?? 0}.${bytes[offset + 1] ?? 0}.${bytes[offset + 2] ?? 0}`;
}

export function parseVersion(bytes: Uint8Array): string {
	if (bytes.length < 3) {
		throw new QcyProtocolError('Version payload must be at least three bytes');
	}

	const left = formatTriplet(bytes, 0);
	if (bytes.length >= 6) {
		const right = formatTriplet(bytes, 3);
		if (right !== left) return `${left} / ${right}`;
	}
	return left;
}

export function defaultBands(frequencies: readonly number[] = []): EqBand[] {
	return frequencies.map((freq) => ({ freq, gain: 0, q: EQ_DEFAULT_Q }));
}

/* ------------------------------------------------------------------ *
 * JieLi RCSP (A002) transport
 *
 * JL-family QCY devices carry the same QCY TLV blocks used by the A001
 * protocol, but without the leading FF + length bytes, inside a
 * JieLi RCSP CustomCmd (opcode 255):
 *
 *   FE DC BA C0 FF <lenHi> <lenLo> <seq> <QCY TLV...> EF
 *
 * There is no checksum. A response uses type 0 and starts with status/seq.
 * ------------------------------------------------------------------ */

export interface RcspPacket {
	type: 'command' | 'response';
	hasResponse: boolean;
	opCode: number;
	sequence: number;
	status?: number;
	payload: Uint8Array;
}

export function encodeRcspCustom(payload: Uint8Array, sequence = 0): Uint8Array {
	const paramLength = payload.length + 1;
	if (paramLength > 0xffff) {
		throw new QcyProtocolError('RCSP payload is too large.');
	}

	const frame = new Uint8Array(paramLength + 8);
	frame[0] = RCSP_MAGIC[0];
	frame[1] = RCSP_MAGIC[1];
	frame[2] = RCSP_MAGIC[2];
	frame[3] = RCSP_FLAG_COMMAND | RCSP_FLAG_RESPONSE; // command + response expected
	frame[4] = RCSP_OPCODE_CUSTOM;
	frame[5] = (paramLength >> 8) & 0xff;
	frame[6] = paramLength & 0xff;
	frame[7] = sequence & 0xff;
	frame.set(payload, 8);
	frame[frame.length - 1] = RCSP_TAIL;
	return frame;
}

export function decodeRcspPacket(input: DataView | Uint8Array): RcspPacket {
	const bytes = bytesOf(input);
	if (bytes.length < 8) {
		throw new QcyProtocolError('RCSP packet is too short.');
	}
	if (
		bytes[0] !== RCSP_MAGIC[0] ||
		bytes[1] !== RCSP_MAGIC[1] ||
		bytes[2] !== RCSP_MAGIC[2]
	) {
		throw new QcyProtocolError('RCSP magic header is missing.');
	}
	if (bytes[bytes.length - 1] !== RCSP_TAIL) {
		throw new QcyProtocolError('RCSP packet is missing its tail byte.');
	}

	const flags = bytes[3];
	const opCode = bytes[4];
	const paramLength = (bytes[5] << 8) | bytes[6];
	if (bytes.length !== paramLength + 8) {
		throw new QcyProtocolError('RCSP length does not match the packet.');
	}
	if (opCode !== RCSP_OPCODE_CUSTOM) {
		throw new QcyProtocolError(`Unsupported RCSP opcode 0x${opCode.toString(16)}.`);
	}
	if (
		flags !== (RCSP_FLAG_COMMAND | RCSP_FLAG_RESPONSE) &&
		flags !== RCSP_FLAG_COMMAND &&
		flags !== 0
	) {
		throw new QcyProtocolError(`Unsupported RCSP flags 0x${flags.toString(16)}.`);
	}

	const param = bytes.subarray(7, 7 + paramLength);
	const type = (flags & RCSP_FLAG_COMMAND) !== 0 ? 'command' : 'response';
	const hasResponse = (flags & RCSP_FLAG_RESPONSE) !== 0;

	if (type === 'command') {
		if (param.length < 1) {
			throw new QcyProtocolError('RCSP command has no sequence byte.');
		}
		return {
			type,
			hasResponse,
			opCode,
			sequence: param[0],
			payload: param.subarray(1)
		};
	}

	if (param.length < 2) {
		throw new QcyProtocolError('RCSP response has no status or sequence byte.');
	}
	return {
		type,
		hasResponse,
		opCode,
		status: param[0],
		sequence: param[1],
		payload: param.subarray(2)
	};
}

/** Parse the inner QCY TLV blocks used by JL/A002 (no `FF len` header). */
export function decodeQcyTlv(input: DataView | Uint8Array): ParsedCommand[] {
	const bytes = bytesOf(input);
	const commands: ParsedCommand[] = [];
	let offset = 0;

	while (offset < bytes.length) {
		if (offset + 2 > bytes.length) {
			throw new QcyProtocolError('QCY TLV block is truncated.');
		}
		const cmd = bytes[offset];
		const length = bytes[offset + 1];
		if (offset + 2 + length > bytes.length) {
			throw new QcyProtocolError('QCY TLV payload is truncated.');
		}
		commands.push({
			cmd,
			data: bytes.slice(offset + 2, offset + 2 + length)
		});
		offset += 2 + length;
	}

	return commands;
}
