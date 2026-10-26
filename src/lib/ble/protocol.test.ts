import { describe, expect, it } from 'vitest';
import {
	buildLegacyEq,
	buildMusicAction,
	buildSetAnc,
	buildSetEq,
	buildSetLdac,
	buildSetMultipoint,
	buildSetNoiseMode,
	buildSetSpatialAudio,
	buildSetVolume,
	buildSetWearDetection,
	decodeFrame,
	decodeQcyTlv,
	decodeRcspPacket,
	encodeFrame,
	encodeRcspCustom,
	parseBattery,
	parseVersion
} from './protocol';
import { CUSTOM_EQ_SAVE_INDEX, EQ_FREQUENCIES, MARKET_EQ_SAVE_INDEX } from './constants';

function dataView(bytes: Uint8Array): DataView {
	return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

describe('encodeFrame', () => {
	it('encodes a single TLV command', () => {
		expect([...buildSetNoiseMode(1)]).toEqual([0xff, 0x03, 0x0c, 0x01, 0x01]);
	});

	it('encodes multiple TLVs with the correct payload length', () => {
		const bytes = encodeFrame([
			{ cmd: 1, data: [] },
			{ cmd: 3, data: [] }
		]);
		expect([...bytes]).toEqual([0xff, 0x04, 0x01, 0x00, 0x03, 0x00]);
	});

	it('rejects a payload that does not fit the one-byte length', () => {
		expect(() =>
			encodeFrame([{ cmd: 1, data: new Uint8Array(254) }])
		).toThrow(/length/);
	});
});

describe('decodeFrame', () => {
	it('decodes multiple TLVs', () => {
		const buffer = Uint8Array.from([0xff, 0x06, 0x0c, 0x01, 0x01, 0x07, 0x01, 0x32]);
		expect(decodeFrame(dataView(buffer))).toEqual([
			{ cmd: 12, data: Uint8Array.from([1]) },
			{ cmd: 7, data: Uint8Array.from([0x32]) }
		]);
	});

	it('rejects a frame whose declared length does not match', () => {
		const buffer = Uint8Array.from([0xff, 0x06, 0x0c, 0x01, 0x01]);
		expect(() => decodeFrame(dataView(buffer))).toThrow(/length/);
	});

	it('rejects a frame with the wrong start byte', () => {
		const buffer = Uint8Array.from([0xfe, 0x02, 0x01, 0x00]);
		expect(() => decodeFrame(dataView(buffer))).toThrow(/start/);
	});

	it('rejects a truncated TLV body', () => {
		const buffer = Uint8Array.from([0xff, 0x03, 0x0c, 0x05, 0x01]);
		expect(() => decodeFrame(dataView(buffer))).toThrow(/length/);
	});
});

describe('command builders', () => {
	it('builds a noise mode command', () => {
		expect([...buildSetNoiseMode(2)]).toEqual([0xff, 0x03, 0x0c, 0x01, 0x02]);
	});

	it('maps the legacy ANC scene special case', () => {
		expect([...buildSetAnc(3, 1, 0)]).toEqual([0xff, 0x05, 0x17, 0x03, 0x03, 0x02, 0x00]);
	});

	it('packs H3 Pro ANC, transparency, and normal values into command 23', () => {
		expect([...buildSetAnc(1, 1, 2)]).toEqual([0xff, 0x05, 0x17, 0x03, 0x01, 0x01, 0x02]);
		expect([...buildSetAnc(3, 1, 4)]).toEqual([0xff, 0x05, 0x17, 0x03, 0x03, 0x01, 0x04]);
		expect([...buildSetAnc(2, 0, 0)]).toEqual([0xff, 0x05, 0x17, 0x03, 0x02, 0x00, 0x00]);
	});

	it('packs H3 Pro ANC scenes into command 23', () => {
		expect([...buildSetAnc(1, 5, 0)]).toEqual([0xff, 0x05, 0x17, 0x03, 0x01, 0x05, 0x00]);
		expect([...buildSetAnc(1, 1, 0)]).toEqual([0xff, 0x05, 0x17, 0x03, 0x01, 0x01, 0x00]);
		expect([...buildSetAnc(1, 2, 0)]).toEqual([0xff, 0x05, 0x17, 0x03, 0x01, 0x02, 0x00]);
		expect([...buildSetAnc(1, 3, 0)]).toEqual([0xff, 0x05, 0x17, 0x03, 0x01, 0x03, 0x00]);
		expect([...buildSetAnc(1, 4, 0)]).toEqual([0xff, 0x05, 0x17, 0x03, 0x01, 0x04, 0x00]);
	});

	it('clamps volume to 0–100 and mirrors both channels', () => {
		expect([...buildSetVolume(150)]).toEqual([0xff, 0x05, 0x08, 0x03, 0x64, 0x64, 0x00]);
		expect([...buildSetVolume(-4)]).toEqual([0xff, 0x05, 0x08, 0x03, 0x00, 0x00, 0x00]);
	});

	it('builds a music action', () => {
		expect([...buildMusicAction(3)]).toEqual([0xff, 0x03, 0x04, 0x01, 0x03]);
	});

	it('builds a 10-band multi-EQ frame with a 75-byte payload length', () => {
		const bands = EQ_FREQUENCIES.map((freq) => ({ freq, gain: 0, q: 1 }));
		const frame = buildSetEq(bands);
		expect(frame).toHaveLength(77);
		expect(frame[0]).toBe(0xff);
		expect(frame[1]).toBe(75);
		expect(frame[2]).toBe(34);
		expect(frame[3]).toBe(73);
		expect(frame[4]).toBe(CUSTOM_EQ_SAVE_INDEX);
		expect(frame[7]).toBe(31);
		expect(frame[8]).toBe(0);
	});

	it('writes each band frequency, gain, Q, and eqType exactly', () => {
		const bands = [
			{ freq: 30, gain: -3, q: 0.7, eqType: 0 as const },
			{ freq: 45, gain: 2, q: 1.2, eqType: 2 as const }
		];
		const frame = buildSetEq(bands, -4, 10);

		expect(frame[4]).toBe(10);
		// master gain -4.00 dB
		expect([...frame.slice(5, 7)]).toEqual([0x70, 0xfe]);
		// band 0: 30 Hz, -3.00 dB, Q 0.70, type 0
		expect([...frame.slice(7, 14)]).toEqual([0x1e, 0x00, 0xd4, 0xfe, 0x46, 0x00, 0x00]);
		// band 1: 45 Hz, +2.00 dB, Q 1.20, type 2
		expect([...frame.slice(14, 21)]).toEqual([0x2d, 0x00, 0xc8, 0x00, 0x78, 0x00, 0x02]);
	});

	it('keeps the official -15 dB H3 Pro notch instead of clamping at -12', () => {
		const frame = buildSetEq(
			[{ freq: 7500, gain: -15, q: 2.5, eqType: 2 }],
			-4,
			1
		);

		// 7500 Hz, -15.00 dB, Q 2.50, type 2
		expect([...frame.slice(7, 14)]).toEqual([0x4c, 0x1d, 0x24, 0xfa, 0xfa, 0x00, 0x02]);
	});

	it('writes the selected device preset slot as the EQ save index', () => {
		const bands = EQ_FREQUENCIES.map((freq) => ({ freq, gain: 0, q: 1 }));

		expect(buildSetEq(bands, -4, 1)[4]).toBe(1);
		expect(buildSetEq(bands, -4, 3)[4]).toBe(3);
		expect(buildSetEq(bands, -4, 10)[4]).toBe(10);
		expect(buildSetEq(bands, -4, 42)[4]).toBe(42);
		expect(buildSetEq(bands, -4, MARKET_EQ_SAVE_INDEX)[4]).toBe(126);
		expect(buildSetEq(bands, -4, CUSTOM_EQ_SAVE_INDEX)[4]).toBe(128);
		expect(buildSetEq(bands, -4, 300)[4]).toBe(255);
		expect(buildSetEq(bands)[4]).toBe(128);
	});

	it('builds a raw legacy EQ payload', () => {
		const gains = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
		expect([...buildLegacyEq(gains, 2)]).toEqual([2, ...gains]);
	});

	it('builds feature switches with the payloads each firmware expects', () => {
		expect([...buildSetWearDetection(true)]).toEqual([0xff, 0x03, 0x06, 0x01, 0x01]);
		expect([...buildSetWearDetection(false)]).toEqual([0xff, 0x03, 0x06, 0x01, 0x02]);
		// H3 Pro / JL: off is 0 for LDAC and multipoint.
		expect([...buildSetLdac(true)]).toEqual([0xff, 0x03, 0x23, 0x01, 0x01]);
		expect([...buildSetLdac(false)]).toEqual([0xff, 0x03, 0x23, 0x01, 0x00]);
		expect([...buildSetMultipoint(true)]).toEqual([0xff, 0x03, 0x24, 0x01, 0x01]);
		expect([...buildSetMultipoint(false)]).toEqual([0xff, 0x03, 0x24, 0x01, 0x00]);
		expect([...buildSetSpatialAudio(false)]).toEqual([0xff, 0x03, 0x2d, 0x01, 0x02]);
	});
});

describe('response parsers', () => {
	it('parses battery percentages and charging bits', () => {
		const battery = parseBattery(Uint8Array.from([0x80 | 87, 0x80 | 45, 64]));
		expect(battery).toMatchObject({
			left: 87,
			right: 45,
			case: 64,
			leftCharging: true,
			rightCharging: true,
			caseCharging: false,
			hasCase: true
		});
	});

	it('treats a missing case byte as no case', () => {
		const battery = parseBattery(Uint8Array.from([87, 45]));
		expect(battery.left).toBe(87);
		expect(battery.right).toBe(45);
		expect(battery.hasCase).toBe(false);
	});

	it('formats a three-byte firmware version', () => {
		expect(parseVersion(Uint8Array.from([1, 2, 3]))).toBe('1.2.3');
	});

	it('prefers the left-bud version when left and right match', () => {
		expect(parseVersion(Uint8Array.from([1, 2, 3, 1, 2, 3]))).toBe('1.2.3');
	});
});

describe('RCSP / A002 transport', () => {
	it('wraps a QCY TLV payload in an RCSP CustomCmd frame', () => {
		const frame = encodeRcspCustom(Uint8Array.from([0xfe, 0x01, 0x2f]), 0);

		expect([...frame]).toEqual([
			0xfe, 0xdc, 0xba, 0xc0, 0xff, 0x00, 0x04, 0x00, 0xfe, 0x01, 0x2f, 0xef
		]);
	});

	it('decodes a response frame with status, sequence, and inner TLV', () => {
		const packet = decodeRcspPacket(
			dataView(
				Uint8Array.from([
					0xfe, 0xdc, 0xba, 0x00, 0xff, 0x00, 0x07, 0x00, 0x00, 0x2f, 0x03, 0x50, 0x50,
					0x3c, 0xef
				])
			)
		);

		expect(packet.type).toBe('response');
		expect(packet.hasResponse).toBe(false);
		expect(packet.opCode).toBe(0xff);
		expect(packet.status).toBe(0);
		expect(packet.sequence).toBe(0);
		expect([...packet.payload]).toEqual([0x2f, 0x03, 0x50, 0x50, 0x3c]);
	});

	it('parses bare QCY TLV blocks without an FF length header', () => {
		expect(decodeQcyTlv(dataView(Uint8Array.from([0x2f, 0x03, 0x50, 0x50, 0x3c])))).toEqual([
			{ cmd: 47, data: Uint8Array.from([0x50, 0x50, 0x3c]) }
		]);
	});

	it('rejects a packet with bad magic bytes', () => {
		const buffer = Uint8Array.from([0x00, 0xdc, 0xba, 0xc0, 0xff, 0x00, 0x01, 0x00, 0xef]);
		expect(() => decodeRcspPacket(dataView(buffer))).toThrow(/magic/);
	});

	it('rejects a packet whose declared length does not match', () => {
		const buffer = Uint8Array.from([
			0xfe, 0xdc, 0xba, 0x00, 0xff, 0x00, 0x06, 0x00, 0x00, 0x2f, 0x03, 0x50, 0x50, 0x3c,
			0xef
		]);
		expect(() => decodeRcspPacket(dataView(buffer))).toThrow(/length/);
	});

	it('rejects a packet without the tail byte', () => {
		const buffer = Uint8Array.from([0xfe, 0xdc, 0xba, 0xc0, 0xff, 0x00, 0x01, 0x00, 0x00]);
		expect(() => decodeRcspPacket(dataView(buffer))).toThrow(/tail/);
	});

	it('rejects unsupported flags and opcodes', () => {
		const badFlags = Uint8Array.from([
			0xfe, 0xdc, 0xba, 0x40, 0xff, 0x00, 0x02, 0x00, 0x00, 0xef
		]);
		expect(() => decodeRcspPacket(dataView(badFlags))).toThrow(/flags/);

		const badOpcode = Uint8Array.from([
			0xfe, 0xdc, 0xba, 0x00, 0xfe, 0x00, 0x02, 0x00, 0x00, 0xef
		]);
		expect(() => decodeRcspPacket(dataView(badOpcode))).toThrow(/opcode/);
	});

	it('rejects a response without status and sequence bytes', () => {
		const buffer = Uint8Array.from([0xfe, 0xdc, 0xba, 0x00, 0xff, 0x00, 0x01, 0x00, 0xef]);
		expect(() => decodeRcspPacket(dataView(buffer))).toThrow(/status/);
	});

	it('rejects a truncated bare TLV block', () => {
		expect(() => decodeQcyTlv(Uint8Array.from([0x2f, 0x03, 0x50]))).toThrow(/truncated/);
	});
});
