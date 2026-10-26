import {
	CHAR_A002_NOTIFY,
	CHAR_A002_WRITE,
	CHAR_BATTERY,
	CHAR_EQ_LEGACY,
	CHAR_NOTIFY,
	CHAR_VERSION,
	CHAR_WRITE,
	CUSTOM_EQ_SAVE_INDEX,
	SERVICE_UUID,
	SERVICE_UUID_A002
} from './constants.js';
import {
	buildLegacyEq,
	buildMusicAction,
	buildRequest,
	buildSetAnc,
	buildSetEq,
	buildSetLdac,
	buildSetMultipoint,
	buildSetNoiseLevel,
	buildSetNoiseMode,
	buildSetSpatialAudio,
	buildSetVolume,
	buildSetWearDetection,
	buildSyncTime,
	decodeFrame,
	decodeQcyTlv,
	decodeRcspPacket,
	encodeRcspCustom,
	parseBattery,
	parseVersion,
	type Battery,
	type EqBand,
	type ParsedCommand
} from './protocol.js';
import type { EqProtocol } from '#lib/schemas.js';

export type ClientState = 'idle' | 'connecting' | 'connected' | 'disconnected';

export type ClientEvent =
	| { type: 'state'; state: ClientState; message?: string }
	| { type: 'battery'; battery: Battery }
	| { type: 'version'; version: string }
	| { type: 'command'; command: ParsedCommand }
	| { type: 'warning'; message: string };

export class QcyBluetoothError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'QcyBluetoothError';
	}
}

/**
 * Turn a Web Bluetooth failure into a message that tells the person what to
 * do next. The browser's default text ("No device was selected") is accurate
 * but does not explain why the chooser may have been empty.
 */
export function describeBluetoothError(error: unknown): string {
	if (error instanceof QcyBluetoothError) return error.message;

	if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
		switch (error.name) {
			case 'NotFoundError':
				return 'No device was selected. Keep the earbuds in pairing mode with the case open, close the QCY app on your phone, then try again. If your model does not start with QCY, choose Browse all devices.';
			case 'SecurityError':
			case 'NotAllowedError':
				return 'Bluetooth permission was blocked. Allow Bluetooth access for this site, then try again.';
			case 'NetworkError':
				return 'The device could not be reached. Move it closer, disconnect it from other devices, and try again.';
			case 'InvalidStateError':
				return 'Bluetooth is turned off or unavailable on this computer. Turn Bluetooth on and try again.';
			case 'AbortError':
				return 'The Bluetooth chooser closed before a device was selected. Try again and choose your QCY device.';
		}
	}

	if (error instanceof TypeError) {
		return 'This browser could not start a Bluetooth scan. Use Chrome or Edge over localhost or HTTPS.';
	}

	return error instanceof Error && error.message
		? error.message
		: 'The Bluetooth connection failed.';
}

type ConnectOptions = {
	/** Show every BLE device instead of devices whose name starts with QCY. */
	acceptAll?: boolean;
};

function bytesOf(value: DataView): Uint8Array {
	return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

/** Copy into a plain ArrayBuffer-backed view for Web Bluetooth's BufferSource. */
function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy;
}

/**
 * Thin Web Bluetooth transport for the QCY A001 stack and the JieLi
 * RCSP/A002 transport used by JL-family devices. All GATT writes and reads
 * go through one promise chain so slider spam cannot interleave operations.
 */
export class QcyBluetoothClient {
	#device: BluetoothDevice | null = null;
	#writeChar: BluetoothRemoteGATTCharacteristic | null = null;
	#chars = new Map<string, BluetoothRemoteGATTCharacteristic>();
	#queue: Promise<unknown> = Promise.resolve();
	#listeners = new Set<(event: ClientEvent) => void>();
	#connecting = false;
	#transport: 'a001' | 'a002' | null = null;
	#rcspSequence = 0;
	/** Invalidates an in-flight connect/reconnect when the user disconnects. */
	#generation = 0;
	#disconnectedHandler = () => {
		// Keep #device so reconnect() can reuse the browser's permission without
		// showing the chooser again. Only disconnect() forgets the device.
		this.#resetGatt();
		this.#emit({ type: 'state', state: 'disconnected' });
	};
	#notificationHandler = (event: Event) => {
		const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
		const value = characteristic.value;
		if (!value) return;
		this.#handleNotification(characteristic.uuid.toLowerCase(), bytesOf(value));
	};

	get connected(): boolean {
		return Boolean(this.#device?.gatt?.connected);
	}

	/** A previously selected device is retained, so reconnect() needs no chooser. */
	get canReconnect(): boolean {
		return this.#device !== null;
	}

	get deviceName(): string | null {
		return this.#device?.name ?? null;
	}

	get deviceId(): string | null {
		return this.#device?.id ?? null;
	}

	get transport(): 'a001' | 'a002' | null {
		return this.#transport;
	}

	onEvent(listener: (event: ClientEvent) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	#emit(event: ClientEvent): void {
		for (const listener of this.#listeners) listener(event);
	}

	async connect(options: ConnectOptions = {}): Promise<{ name: string; id: string }> {
		if (!isWebBluetoothSupported()) {
			throw new QcyBluetoothError(
				'Web Bluetooth is not available here. Use Chrome or Edge on desktop or Android, over HTTPS or localhost.'
			);
		}

		if (this.#connecting) {
			throw new QcyBluetoothError('A connection attempt is already in progress.');
		}

		this.#connecting = true;
		const generation = ++this.#generation;
		this.#emit({ type: 'state', state: 'connecting' });

		try {
			if (this.#device?.gatt?.connected) this.#device.gatt.disconnect();

			const requestOptions: RequestDeviceOptions = options.acceptAll
				? {
						acceptAllDevices: true,
						optionalServices: [SERVICE_UUID, SERVICE_UUID_A002]
					}
				: {
						filters: [
							{ namePrefix: 'QCY' },
							{ namePrefix: 'MeloBuds' },
							{ namePrefix: 'Crossky' },
							{ services: [SERVICE_UUID] },
							{ services: [SERVICE_UUID_A002] }
						],
						optionalServices: [SERVICE_UUID, SERVICE_UUID_A002]
					};

			const device = await navigator.bluetooth.requestDevice(requestOptions);
			if (generation !== this.#generation) {
				throw new QcyBluetoothError('The connection attempt was cancelled.');
			}
			this.#retainDevice(device);
			return await this.#establishConnection(device, generation);
		} catch (error) {
			if (generation === this.#generation) {
				this.#resetGatt();
				this.#emit({ type: 'state', state: 'idle' });
			} else {
				this.#resetGatt();
			}
			throw new QcyBluetoothError(describeBluetoothError(error));
		} finally {
			this.#connecting = false;
		}
	}

	/**
	 * Reuse the retained BluetoothDevice. This never calls requestDevice, so the
	 * browser chooser does not reappear after a restart or a dropped link.
	 */
	async reconnect(): Promise<{ name: string; id: string }> {
		if (!isWebBluetoothSupported()) {
			throw new QcyBluetoothError(
				'Web Bluetooth is not available here. Use Chrome or Edge on desktop or Android, over HTTPS or localhost.'
			);
		}

		const device = this.#device;
		if (!device) {
			throw new QcyBluetoothError(
				'No previous Bluetooth device is saved. Use Connect device to choose it once.'
			);
		}

		if (this.#connecting) {
			throw new QcyBluetoothError('A connection attempt is already in progress.');
		}

		if (this.connected && this.#writeChar && this.#transport) {
			return {
				name: device.name ?? 'QCY device',
				id: device.id
			};
		}

		this.#connecting = true;
		const generation = ++this.#generation;
		this.#emit({ type: 'state', state: 'connecting', message: 'Reconnecting to the saved device…' });

		try {
			return await this.#establishConnection(device, generation);
		} catch (error) {
			this.#resetGatt();
			if (generation === this.#generation) {
				this.#emit({
					type: 'state',
					state: 'disconnected',
					message: describeBluetoothError(error)
				});
			}
			throw new QcyBluetoothError(describeBluetoothError(error));
		} finally {
			this.#connecting = false;
		}
	}

	#retainDevice(device: BluetoothDevice): void {
		if (this.#device === device) return;
		this.#device?.removeEventListener('gattserverdisconnected', this.#disconnectedHandler);
		device.addEventListener('gattserverdisconnected', this.#disconnectedHandler);
		this.#device = device;
	}

	async #establishConnection(
		device: BluetoothDevice,
		generation: number
	): Promise<{ name: string; id: string }> {
		this.#resetGatt();

		const server = await device.gatt?.connect();
		if (generation !== this.#generation) {
			throw new QcyBluetoothError('The connection attempt was cancelled.');
		}
		if (!server) {
			throw new QcyBluetoothError('The device did not expose a GATT server.');
		}

		let a001Service: BluetoothRemoteGATTService | null = null;
		try {
			a001Service = await server.getPrimaryService(SERVICE_UUID);
		} catch {
			a001Service = null;
		}

		if (generation !== this.#generation) {
			throw new QcyBluetoothError('The connection attempt was cancelled.');
		}

		if (a001Service) {
			await this.#setupA001(a001Service);
		} else {
			await this.#setupA002(server);
		}

		if (generation !== this.#generation) {
			throw new QcyBluetoothError('The connection attempt was cancelled.');
		}
		if (!device.gatt?.connected) {
			throw new QcyBluetoothError('The device disconnected while the connection was being set up.');
		}

		this.#emit({ type: 'state', state: 'connected' });
		await this.#safeReadInitialValues();
		if (this.#transport === 'a001') {
			await this.#safe(buildSyncTime());
		}
		await this.requestSettings();

		return {
			name: device.name ?? 'QCY device',
			id: device.id
		};
	}

	async #setupA001(service: BluetoothRemoteGATTService): Promise<void> {
		const characteristics = await service.getCharacteristics();

		this.#chars = new Map(
			characteristics.map((characteristic) => [
				characteristic.uuid.toLowerCase(),
				characteristic
			])
		);

		const writeChar = this.#chars.get(CHAR_WRITE);
		if (!writeChar) {
			throw new QcyBluetoothError(
				'This device does not expose the QCY command characteristic (00001001).'
			);
		}
		this.#writeChar = writeChar;
		this.#transport = 'a001';

		for (const characteristic of characteristics) {
			if (!characteristic.properties.notify && !characteristic.properties.indicate) {
				continue;
			}
			try {
				await characteristic.startNotifications();
				characteristic.addEventListener(
					'characteristicvaluechanged',
					this.#notificationHandler
				);
			} catch {
				this.#emit({
					type: 'warning',
					message: `Could not subscribe to ${characteristic.uuid.slice(0, 8)}.`
				});
			}
		}
	}

	async #setupA002(server: BluetoothRemoteGATTServer): Promise<void> {
		let service: BluetoothRemoteGATTService;
		try {
			service = await server.getPrimaryService(SERVICE_UUID_A002);
		} catch {
			throw new QcyBluetoothError(
				'This device exposes neither the QCY A001 nor the JL A002 service.'
			);
		}

		const characteristics = await service.getCharacteristics();
		this.#chars = new Map(
			characteristics.map((characteristic) => [
				characteristic.uuid.toLowerCase(),
				characteristic
			])
		);

		const writeChar = this.#chars.get(CHAR_A002_WRITE);
		if (!writeChar) {
			throw new QcyBluetoothError(
				'This device does not expose the JL A002 command characteristic (00000001).'
			);
		}

		const notifyChar = this.#chars.get(CHAR_A002_NOTIFY);
		if (!notifyChar) {
			throw new QcyBluetoothError(
				'This device does not expose the JL A002 notify characteristic (00000002).'
			);
		}

		this.#writeChar = writeChar;
		this.#transport = 'a002';
		this.#rcspSequence = 0;

		try {
			await notifyChar.startNotifications();
			notifyChar.addEventListener('characteristicvaluechanged', this.#notificationHandler);
		} catch {
			this.#emit({
				type: 'warning',
				message: `Could not subscribe to ${notifyChar.uuid.slice(0, 8)}.`
			});
		}
	}

	/** Manual disconnect is the only path that forgets the retained device. */
	disconnect(): void {
		this.#generation++;
		const device = this.#device;
		if (device) {
			device.removeEventListener('gattserverdisconnected', this.#disconnectedHandler);
			if (device.gatt?.connected) device.gatt.disconnect();
		}
		this.#resetGatt();
		this.#device = null;
		this.#emit({ type: 'state', state: 'idle' });
	}

	#resetGatt(): void {
		this.#writeChar = null;
		this.#chars.clear();
		this.#transport = null;
		this.#rcspSequence = 0;
	}

	#enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const run = this.#queue.then(operation, operation);
		this.#queue = run.catch(() => undefined);
		return run;
	}

	#send(bytes: Uint8Array): Promise<void> {
		return this.#enqueue(async () => {
			const characteristic = this.#writeChar;
			if (!characteristic) {
				throw new QcyBluetoothError('The earbuds are not connected.');
			}

			let frame = bytes;
			if (this.#transport === 'a002') {
				const payload = bytes[0] === 0xff ? bytes.slice(2) : bytes;
				frame = encodeRcspCustom(payload, this.#rcspSequence++ & 0xff);
			}

			// A002 devices with the default 23-byte MTU only accept 20-byte ATT
			// payloads. Long frames (the RCSP-framed 10-band EQ is 84 bytes) must
			// be split and written sequentially. A001 keeps its single write.
			const chunkSize = this.#transport === 'a002' ? 20 : frame.length;
			const withoutResponse =
				characteristic.properties.writeWithoutResponse && !characteristic.properties.write;

			try {
				for (let offset = 0; offset < frame.length; offset += chunkSize) {
					const target = toBufferSource(frame.subarray(offset, offset + chunkSize));
					if (withoutResponse) {
						await characteristic.writeValueWithoutResponse(target);
					} else {
						await characteristic.writeValue(target);
					}
				}
			} catch (error) {
				throw new QcyBluetoothError(
					error instanceof Error && error.message
						? `The Bluetooth write failed: ${error.message}`
						: 'The Bluetooth write failed.'
				);
			}
		});
	}

	async #safe(bytes: Uint8Array): Promise<void> {
		try {
			await this.#send(bytes);
		} catch (error) {
			this.#emit({
				type: 'warning',
				message: error instanceof Error ? error.message : 'A Bluetooth write failed.'
			});
		}
	}

	async #safeReadInitialValues(): Promise<void> {
		try {
			await this.readBattery();
		} catch {
			// Battery may only be available over the notify characteristic.
		}
		try {
			await this.readVersion();
		} catch {
			// Some firmware only answers the TLV version request.
		}
	}

	async readBattery(): Promise<Battery | null> {
		const characteristic = this.#chars.get(CHAR_BATTERY);
		if (characteristic?.properties.read) {
			const value = await this.#read(characteristic);
			const battery = parseBattery(bytesOf(value));
			this.#emit({ type: 'battery', battery });
			return battery;
		}
		await this.#send(buildRequest(47));
		return null;
	}

	async readVersion(): Promise<string | null> {
		const characteristic = this.#chars.get(CHAR_VERSION);
		if (characteristic?.properties.read) {
			const value = await this.#read(characteristic);
			const version = parseVersion(bytesOf(value));
			this.#emit({ type: 'version', version });
			return version;
		}
		await this.#send(buildRequest(48));
		return null;
	}

	#read(characteristic: BluetoothRemoteGATTCharacteristic): Promise<DataView> {
		return this.#enqueue(() => characteristic.readValue());
	}

	async requestSettings(): Promise<void> {
		// JL/H3 Pro only exposes ANC, LDAC, multipoint and volume. Sending the
		// A001-only wear/spatial/level requests back-to-back makes some JL
		// firmware drop the link immediately after connection.
		const commands =
			this.#transport === 'a002'
				? [12, 23, 35, 36, 8]
				: [12, 7, 23, 8, 6, 35, 36, 45];

		for (const cmd of commands) {
			await this.#safe(buildRequest(cmd));
			if (this.#transport === 'a002') {
				await new Promise((resolve) => setTimeout(resolve, 60));
			}
		}
	}

	async setNoiseMode(mode: number): Promise<void> {
		await this.#send(buildSetNoiseMode(mode));
	}

	async setAnc(mode: number, scene: number, level: number): Promise<void> {
		await this.#send(buildSetAnc(mode, scene, level));
	}

	async setNoiseLevel(level: number): Promise<void> {
		await this.#send(buildSetNoiseLevel(level));
	}

	async setVolume(level: number): Promise<void> {
		await this.#send(buildSetVolume(level));
	}

	async setWearDetection(enabled: boolean): Promise<void> {
		await this.#send(buildSetWearDetection(enabled));
	}

	async setLdac(enabled: boolean): Promise<void> {
		await this.#send(buildSetLdac(enabled));
	}

	async setMultipoint(enabled: boolean): Promise<void> {
		await this.#send(buildSetMultipoint(enabled));
	}

	async setSpatialAudio(enabled: boolean): Promise<void> {
		await this.#send(buildSetSpatialAudio(enabled));
	}

	async musicAction(action: 1 | 2 | 3 | 4): Promise<void> {
		await this.#send(buildMusicAction(action));
	}

	async setEq(
		bands: EqBand[],
		options: {
			protocol?: EqProtocol;
			masterGain?: number;
			eqType?: number;
			saveIndex?: number;
		} = {}
	): Promise<void> {
		const gains = bands.map((band) => band.gain);

		if (options.protocol === 'legacy' && this.#transport !== 'a002') {
			await this.writeLegacyEq(gains, options.eqType ?? 0);
			return;
		}

		try {
			await this.#send(
				buildSetEq(bands, options.masterGain ?? 0, options.saveIndex ?? CUSTOM_EQ_SAVE_INDEX)
			);
		} catch (error) {
			if (this.#transport === 'a002' || !this.#chars.has(CHAR_EQ_LEGACY)) throw error;
			this.#emit({
				type: 'warning',
				message: 'Multi-band EQ was rejected; falling back to the legacy EQ characteristic.'
			});
			await this.writeLegacyEq(gains, options.eqType ?? 0);
		}
	}

	async writeLegacyEq(gains: number[], eqType = 0): Promise<void> {
		const characteristic = this.#chars.get(CHAR_EQ_LEGACY);
		if (!characteristic) {
			throw new QcyBluetoothError('This device does not expose the legacy EQ characteristic.');
		}
		const payload = buildLegacyEq(gains, eqType);
		await this.#enqueue(() => characteristic.writeValue(toBufferSource(payload)));
	}

	async syncTime(): Promise<void> {
		await this.#send(buildSyncTime());
	}

	#handleNotification(uuid: string, bytes: Uint8Array): void {
		try {
			if (this.#transport === 'a002') {
				if (uuid !== CHAR_A002_NOTIFY) return;

				const packet = decodeRcspPacket(bytes);
				if (packet.status !== undefined && packet.status !== 0) {
					this.#emit({
						type: 'warning',
						message: `The device reported RCSP status 0x${packet.status
							.toString(16)
							.padStart(2, '0')}; using the response payload anyway.`
					});
				}

				this.#emitCommands(decodeQcyTlv(packet.payload));
				return;
			}

			if (uuid === CHAR_BATTERY) {
				this.#emit({ type: 'battery', battery: parseBattery(bytes) });
				return;
			}

			if (uuid === CHAR_VERSION) {
				this.#emit({ type: 'version', version: parseVersion(bytes) });
				return;
			}

			if (uuid !== CHAR_NOTIFY) return;

			this.#emitCommands(decodeFrame(bytes));
		} catch (error) {
			this.#emit({
				type: 'warning',
				message:
					error instanceof Error ? `Ignored a malformed notification: ${error.message}` : 'Ignored a malformed notification.'
			});
		}
	}

	#emitCommands(commands: ParsedCommand[]): void {
		for (const command of commands) {
			if (command.cmd === 47 && command.data.length >= 3) {
				this.#emit({ type: 'battery', battery: parseBattery(command.data) });
			}
			if (command.cmd === 48 && command.data.length >= 3) {
				this.#emit({ type: 'version', version: parseVersion(command.data) });
			}
			this.#emit({ type: 'command', command });
		}
	}
}

export function isWebBluetoothSupported(): boolean {
	return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}
