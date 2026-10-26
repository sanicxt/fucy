import { describe, expect, it } from 'vitest';
import { decodeQcyTlv, decodeRcspPacket } from './protocol.js';

const bytes = (hex: string) =>
	Uint8Array.from(
		hex
			.trim()
			.split(/\s+/)
			.map((value) => Number.parseInt(value, 16))
	);

describe('RCSP frames captured from Sanic Headphones-APP', () => {
	it('decodes the empty spatial ACK', () => {
		const packet = decodeRcspPacket(bytes('FE DC BA 00 FF 00 02 00 00 EF'));

		expect(packet.type).toBe('response');
		expect(packet.hasResponse).toBe(false);
		expect(packet.opCode).toBe(0xff);
		expect(packet.status).toBe(0);
		expect(packet.sequence).toBe(0);
		expect(packet.payload).toHaveLength(0);
	});

	it('decodes the spatial state notification', () => {
		const packet = decodeRcspPacket(bytes('FE DC BA 00 FF 00 05 00 09 2D 01 01 EF'));

		expect(packet.status).toBe(0);
		expect(packet.sequence).toBe(9);

		const commands = decodeQcyTlv(packet.payload);
		expect(commands).toHaveLength(1);
		expect(commands[0].cmd).toBe(45);
		expect(Array.from(commands[0].data)).toEqual([1]);
	});
});
