import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	describeBluetoothError,
	QcyBluetoothClient,
	QcyBluetoothError,
	type ClientEvent
} from './client';
import {
	CHAR_A002_NOTIFY,
	CHAR_A002_WRITE,
	CHAR_NOTIFY,
	CHAR_WRITE,
	EQ_FREQUENCIES,
	SERVICE_UUID,
	SERVICE_UUID_A002
} from './constants';
import { buildRequest, decodeQcyTlv, decodeRcspPacket } from './protocol';

type FakeCharacteristic = {
	uuid: string;
	properties: {
		write?: boolean;
		writeWithoutResponse?: boolean;
		notify?: boolean;
		indicate?: boolean;
	};
	value: DataView | null;
	startNotifications: () => Promise<unknown>;
	addEventListener: (type: string, listener: (event: Event) => void) => void;
	writeValue: (value: Uint8Array) => Promise<void>;
	writeValueWithoutResponse: (value: Uint8Array) => Promise<void>;
};

function concatenate(writes: Uint8Array[]): Uint8Array {
	const frame = new Uint8Array(writes.reduce((total, chunk) => total + chunk.length, 0));
	let offset = 0;
	for (const chunk of writes) {
		frame.set(chunk, offset);
		offset += chunk.length;
	}
	return frame;
}

function installFakeBluetooth(
	mode: 'a001' | 'a002',
	options: { writeWithoutResponse?: boolean } = {}
) {
	const writes: Uint8Array[] = [];
	const writeMethods: Array<'write' | 'writeWithoutResponse'> = [];
	const notifications: Array<{
		characteristic: FakeCharacteristic;
		listener: (event: Event) => void;
	}> = [];
	const deviceListeners = new Map<string, Set<(event: Event) => void>>();
	let requestOptions: unknown;
	let requestCount = 0;
	let gattConnected = true;

	function writeCharacteristic(uuid: string): FakeCharacteristic {
		return {
			uuid,
			properties: options.writeWithoutResponse ? { writeWithoutResponse: true } : { write: true },
			value: null,
			startNotifications: async () => undefined,
			addEventListener: () => undefined,
			writeValue: async (value) => {
				if (options.writeWithoutResponse) {
					throw new Error('writeValue must not be used without a write property.');
				}
				writes.push(Uint8Array.from(value));
				writeMethods.push('write');
			},
			writeValueWithoutResponse: async (value) => {
				if (!options.writeWithoutResponse) {
					throw new Error('writeValueWithoutResponse must not be used when write is available.');
				}
				writes.push(Uint8Array.from(value));
				writeMethods.push('writeWithoutResponse');
			}
		};
	}

	function notifyCharacteristic(uuid: string): FakeCharacteristic {
		let characteristic: FakeCharacteristic;
		characteristic = {
			uuid,
			properties: { notify: true },
			value: null,
			startNotifications: async () => undefined,
			addEventListener: (type, listener) => {
				if (type === 'characteristicvaluechanged') {
					notifications.push({ characteristic, listener });
				}
			},
			writeValue: async () => {
				throw new Error('The notify characteristic is not writable.');
			},
			writeValueWithoutResponse: async () => {
				throw new Error('The notify characteristic is not writable.');
			}
		};
		return characteristic;
	}

	const a001Write = writeCharacteristic(CHAR_WRITE);
	const a001Notify = notifyCharacteristic(CHAR_NOTIFY);
	const a002Write = writeCharacteristic(CHAR_A002_WRITE);
	const a002Notify = notifyCharacteristic(CHAR_A002_NOTIFY);
	const activeNotify = mode === 'a001' ? a001Notify : a002Notify;

	const server = {
		getPrimaryService: async (uuid: string) => {
			if (mode === 'a001' && uuid === SERVICE_UUID) {
				return { getCharacteristics: async () => [a001Write, a001Notify] };
			}
			if (mode === 'a002' && uuid === SERVICE_UUID_A002) {
				return { getCharacteristics: async () => [a002Write, a002Notify] };
			}
			throw new DOMException('Service not found', 'NotFoundError');
		}
	};

	const gatt = {
		get connected(): boolean {
			return gattConnected;
		},
		connect: async () => {
			gattConnected = true;
			return server;
		},
		disconnect: () => {
			gattConnected = false;
		}
	};

	const device = {
		name: 'Sanic Headphones-APP',
		id: 'fake-device',
		gatt,
		addEventListener: (type: string, listener: (event: Event) => void) => {
			const listeners = deviceListeners.get(type) ?? new Set();
			listeners.add(listener);
			deviceListeners.set(type, listeners);
		},
		removeEventListener: (type: string, listener: (event: Event) => void) => {
			deviceListeners.get(type)?.delete(listener);
		}
	};

	vi.stubGlobal('navigator', {
		bluetooth: {
			requestDevice: async (options: unknown) => {
				requestCount++;
				requestOptions = options;
				return device;
			}
		}
	});

	return {
		writes,
		writeMethods,
		get requestOptions(): unknown {
			return requestOptions;
		},
		get requestCount(): number {
			return requestCount;
		},
		disconnect(): void {
			gattConnected = false;
			for (const listener of deviceListeners.get('gattserverdisconnected') ?? []) {
				listener({} as Event);
			}
		},
		emitNotification(bytes: Uint8Array): void {
			activeNotify.value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			for (const notification of notifications) {
				if (notification.characteristic !== activeNotify) continue;
				notification.listener({ target: activeNotify } as unknown as Event);
			}
		}
	};
}

let activeClient: QcyBluetoothClient | null = null;

afterEach(() => {
	activeClient?.disconnect();
	activeClient = null;
	vi.unstubAllGlobals();
});

describe('describeBluetoothError', () => {
	it('explains an empty or cancelled device chooser', () => {
		const message = describeBluetoothError(new DOMException('cancelled', 'NotFoundError'));

		expect(message).toContain('No device was selected');
		expect(message).toContain('Browse all devices');
		expect(message).toContain('case open');
	});

	it('keeps a QCY error message intact', () => {
		expect(describeBluetoothError(new QcyBluetoothError('Custom QCY failure'))).toBe(
			'Custom QCY failure'
		);
	});

	it('explains blocked Bluetooth permission', () => {
		const message = describeBluetoothError(new DOMException('denied', 'NotAllowedError'));

		expect(message).toContain('permission was blocked');
	});

	it('explains a Bluetooth scan that could not start', () => {
		expect(describeBluetoothError(new TypeError('filters are unsupported'))).toContain(
			'could not start a Bluetooth scan'
		);
	});

	it('falls back to the original error message', () => {
		expect(describeBluetoothError(new Error('Adapter is off'))).toBe('Adapter is off');
	});
});

describe('QcyBluetoothClient transports', () => {
	it('keeps A001 frames raw and still syncs time', async () => {
		const fake = installFakeBluetooth('a001');
		const client = new QcyBluetoothClient();
		activeClient = client;

		await client.connect();

		expect(client.transport).toBe('a001');
		expect(fake.writes).toHaveLength(11);
		expect(fake.writes[0]).toEqual(buildRequest(47));
		expect(fake.writes[1]).toEqual(buildRequest(48));
		expect(fake.writes[2][0]).toBe(0xff);
		expect(fake.writes[2][2]).toBe(62);
		expect(fake.writes.every((bytes) => bytes[0] === 0xff)).toBe(true);
	});

	it('falls back to A002 and wraps battery/version requests in RCSP frames', async () => {
		const fake = installFakeBluetooth('a002');
		const client = new QcyBluetoothClient();
		activeClient = client;

		await client.connect();

		const options = fake.requestOptions as {
			filters?: unknown[];
			optionalServices?: string[];
		};
		expect(options.filters).toContainEqual({ services: [SERVICE_UUID_A002] });
		expect(options.optionalServices).toEqual(
			expect.arrayContaining([SERVICE_UUID, SERVICE_UUID_A002])
		);
		expect(client.transport).toBe('a002');

		expect(fake.writes).toHaveLength(7);
		expect([...fake.writes[0]]).toEqual([
			0xfe, 0xdc, 0xba, 0xc0, 0xff, 0x00, 0x04, 0x00, 0xfe, 0x01, 0x2f, 0xef
		]);
		expect([...fake.writes[1]]).toEqual([
			0xfe, 0xdc, 0xba, 0xc0, 0xff, 0x00, 0x04, 0x01, 0xfe, 0x01, 0x30, 0xef
		]);

		const payloads = fake.writes.map((bytes) => decodeRcspPacket(bytes).payload);
		expect(
			payloads.some(
				(payload) => payload[0] === 0xfe && payload[1] === 0x01 && payload[2] === 0x3e
			)
		).toBe(false);
		expect(fake.writes.every((bytes) => bytes[0] === 0xfe)).toBe(true);
	});

	it('decodes A002 TLVs into battery and version events', async () => {
		const fake = installFakeBluetooth('a002');
		const client = new QcyBluetoothClient();
		activeClient = client;
		const events: ClientEvent[] = [];
		client.onEvent((event) => events.push(event));

		await client.connect();
		events.length = 0;

		fake.emitNotification(
			Uint8Array.from([
				0xfe, 0xdc, 0xba, 0x00, 0xff, 0x00, 0x07, 0x00, 0x00, 0x2f, 0x03, 0x50, 0x50,
				0x3c, 0xef
			])
		);

		expect(events).toContainEqual({
			type: 'battery',
			battery: expect.objectContaining({
				left: 80,
				right: 80,
				case: 60,
				hasCase: true
			})
		});
		expect(events).toContainEqual({
			type: 'command',
			command: { cmd: 47, data: Uint8Array.from([80, 80, 60]) }
		});

		events.length = 0;
		fake.emitNotification(
			Uint8Array.from([
				0xfe, 0xdc, 0xba, 0x00, 0xff, 0x00, 0x07, 0x00, 0x00, 0x30, 0x03, 0x01, 0x02,
				0x03, 0xef
			])
		);

		expect(events).toContainEqual({ type: 'version', version: '1.2.3' });
		expect(events).toContainEqual({
			type: 'command',
			command: { cmd: 48, data: Uint8Array.from([1, 2, 3]) }
		});
	});

	it('warns on a nonzero RCSP status but still processes the payload', async () => {
		const fake = installFakeBluetooth('a002');
		const client = new QcyBluetoothClient();
		activeClient = client;
		const events: ClientEvent[] = [];
		client.onEvent((event) => events.push(event));

		await client.connect();
		events.length = 0;

		fake.emitNotification(
			Uint8Array.from([
				0xfe, 0xdc, 0xba, 0x00, 0xff, 0x00, 0x07, 0x01, 0x00, 0x2f, 0x03, 0x50, 0x50,
				0x3c, 0xef
			])
		);

		expect(events).toContainEqual({
			type: 'warning',
			message: expect.stringContaining('RCSP status 0x01')
		});
		expect(events).toContainEqual({
			type: 'battery',
			battery: expect.objectContaining({ left: 80, right: 80, case: 60 })
		});
	});

	it('uses multi-band EQ over A002 even when the legacy protocol is selected', async () => {
		const fake = installFakeBluetooth('a002');
		const client = new QcyBluetoothClient();
		activeClient = client;

		await client.connect();
		fake.writes.length = 0;

		await client.setEq([{ freq: 100, gain: 3, q: 1 }], { protocol: 'legacy' });

		expect(fake.writes).toHaveLength(2);
		const packet = decodeRcspPacket(concatenate(fake.writes));
		expect(decodeQcyTlv(packet.payload)[0].cmd).toBe(34);
	});

	it('chunks the 10-band EQ into 20-byte A002 writes and forwards the save index', async () => {
		const fake = installFakeBluetooth('a002');
		const client = new QcyBluetoothClient();
		activeClient = client;

		await client.connect();
		fake.writes.length = 0;
		fake.writeMethods.length = 0;

		const bands = EQ_FREQUENCIES.map((freq, index) => ({
			freq,
			gain: 0,
			q: 1,
			eqType: index === 0 ? (2 as const) : (0 as const)
		}));
		await client.setEq(bands, { masterGain: -4, saveIndex: 3 });

		expect(fake.writes.map((chunk) => chunk.length)).toEqual([20, 20, 20, 20, 4]);
		expect(fake.writeMethods).toEqual(['write', 'write', 'write', 'write', 'write']);

		const frame = concatenate(fake.writes);
		expect(frame).toHaveLength(84);
		const packet = decodeRcspPacket(frame);
		const [command] = decodeQcyTlv(packet.payload);
		expect(command.cmd).toBe(34);
		expect(command.data[0]).toBe(3);
		expect(command.data[3] | (command.data[4] << 8)).toBe(31);
		expect(command.data[9]).toBe(2);
	});

	it('uses writeValueWithoutResponse when an A002 characteristic has no write property', async () => {
		const fake = installFakeBluetooth('a002', { writeWithoutResponse: true });
		const client = new QcyBluetoothClient();
		activeClient = client;

		await client.connect();

		expect(client.transport).toBe('a002');
		expect(fake.writeMethods.every((method) => method === 'writeWithoutResponse')).toBe(true);

		fake.writes.length = 0;
		fake.writeMethods.length = 0;
		await client.setEq([{ freq: 100, gain: 3, q: 1 }], { saveIndex: 2 });

		expect(fake.writeMethods).toEqual(['writeWithoutResponse', 'writeWithoutResponse']);
		const packet = decodeRcspPacket(concatenate(fake.writes));
		expect(decodeQcyTlv(packet.payload)[0].data[0]).toBe(2);
	});

	it('keeps A001 EQ writes as one raw frame', async () => {
		const fake = installFakeBluetooth('a001');
		const client = new QcyBluetoothClient();
		activeClient = client;

		await client.connect();
		fake.writes.length = 0;

		const bands = EQ_FREQUENCIES.map((freq) => ({ freq, gain: 0, q: 1 }));
		await client.setEq(bands, { saveIndex: 3 });

		expect(fake.writes).toHaveLength(1);
		expect(fake.writes[0]).toHaveLength(77);
		expect(fake.writes[0][0]).toBe(0xff);
		expect(fake.writes[0][4]).toBe(3);
	});

	it.each(['a001', 'a002'] as const)(
		'reconnects a %s device from the retained object without the chooser',
		async (mode) => {
			const fake = installFakeBluetooth(mode);
			const client = new QcyBluetoothClient();
			activeClient = client;

			await client.connect();
			expect(client.canReconnect).toBe(true);
			const writesAfterConnect = fake.writes.length;

			fake.disconnect();
			expect(client.connected).toBe(false);
			expect(client.canReconnect).toBe(true);
			expect(client.transport).toBeNull();

			const info = await client.reconnect();

			expect(info).toEqual({ name: 'Sanic Headphones-APP', id: 'fake-device' });
			expect(fake.requestCount).toBe(1);
			expect(client.connected).toBe(true);
			expect(client.transport).toBe(mode);
			expect(fake.writes.length).toBeGreaterThan(writesAfterConnect);
		}
	);

	it('forgets the retained device only on manual disconnect', async () => {
		const fake = installFakeBluetooth('a002');
		const client = new QcyBluetoothClient();
		activeClient = client;

		await client.connect();
		client.disconnect();

		expect(client.canReconnect).toBe(false);
		await expect(client.reconnect()).rejects.toThrow(/No previous Bluetooth device/);
		expect(fake.requestCount).toBe(1);
	});
});
