import { SvelteDate } from 'svelte/reactivity';
import { QcyBluetoothClient, QcyBluetoothError } from '#lib/ble/client.js';
import {
	ANC_MODE,
	CUSTOM_EQ_SAVE_INDEX,
	EQ_DEFAULT_Q,
	EQ_MAX_GAIN,
	EQ_MIN_GAIN,
	MARKET_EQ_SAVE_INDEX
} from '#lib/ble/constants.js';
import type { Battery, EqBand } from '#lib/ble/protocol.js';
import { clamp, parseBattery, parseVersion } from '#lib/ble/protocol.js';
import {
	H3_PRO_ANC_MODES,
	H3_PRO_ANC_SCENES,
	demoProfile,
	inferDeviceKind
} from '#lib/data/devices.js';
import { customEqBasis, defaultPreset, presetById, presets } from '#lib/data/presets.js';
import { marketPresets } from '#lib/data/market-presets.js';
import {
	ancModeSchema,
	deviceKindSchema,
	eqProtocolSchema,
	settingsSchema,
	type AncMode,
	type BatteryState,
	type DeviceCapabilities,
	type DeviceKind,
	type DeviceProfile,
	type EqPreset,
	type EqProtocol
} from '#lib/schemas.js';

export type ConnectionStatus = 'demo' | 'connecting' | 'connected' | 'restarting' | 'error';

/**
 * Where the current curve is addressed. These are deliberately distinct:
 * - `official`: one of the H3 Pro's seven panel presets (slots 1–6/10),
 *   written with that preset's exact frequency/Q/type basis.
 * - `market`: a bundled or remote sound-market curve, written to slot 126
 *   on the H3 Pro custom basis.
 * - `custom`: a user slider edit, written to slot 128 on the H3 Pro custom
 *   basis. It must never inherit an official preset's basis or save index.
 */
export type EqTarget = 'official' | 'market' | 'custom';

const SETTINGS_KEY = 'qcy-studio.settings.v2';

/**
 * Spatial Audio is the built-in EQ preset at panel ids 10 (and 18 on some
 * firmware), not a separate toggle. Applying it makes the headset drop LDAC
 * itself, so the controller only mirrors that state locally after the EQ
 * write succeeds and never sends an extra command-35 frame.
 */
const SPATIAL_PRESET_INDEXES = new Set([10, 18]);

function isSpatialDeviceIndex(index: number | undefined): boolean {
	return index !== undefined && SPATIAL_PRESET_INDEXES.has(index);
}

/**
 * Normal H3 Pro EQ presets apply without a mandatory reboot. Spatial Audio is
 * the exception: writing the spatial preset makes the headset turn LDAC off
 * and reboot itself. If a firmware build drops the link, it is usually back
 * within a few seconds; keep a short grace window so an actual disconnect is
 * recovered automatically without telling every user that a restart is
 * required.
 */
const EQ_RECONNECT_GRACE_MS = 8_000;
const EQ_RECONNECT_DELAY_MS = 1_000;
const EQ_RECONNECT_RETRY_DELAYS_MS = [2_000, 4_000] as const;
const canUseStorage = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
const INITIAL_PROFILE = demoProfile('headphones');

function modeValue(mode: AncMode): number {
	switch (mode) {
		case 'anc':
			return ANC_MODE.ANC;
		case 'transparency':
			return ANC_MODE.TRANSPARENCY;
		default:
			return ANC_MODE.NORMAL;
	}
}

/**
 * A001 uses noise-mode values 1/2/3, but JL/A002 packs mode as
 * 1 = ANC, 2 = Normal, 3 = Transparency. Decode using the active transport.
 */
function modeFromValue(value: number, transport: 'a001' | 'a002' | null = 'a001'): AncMode {
	if (transport === 'a002') {
		if (value === H3_PRO_ANC_MODES.anc.mode) return 'anc';
		if (value === H3_PRO_ANC_MODES.transparency.mode) return 'transparency';
		return 'normal';
	}
	if (value === ANC_MODE.ANC) return 'anc';
	if (value === ANC_MODE.TRANSPARENCY) return 'transparency';
	return 'normal';
}

function toBatteryState(battery: Battery): BatteryState {
	return {
		left: battery.left,
		right: battery.right,
		case: battery.case,
		leftCharging: battery.leftCharging,
		rightCharging: battery.rightCharging,
		caseCharging: battery.caseCharging,
		hasCase: battery.hasCase
	};
}

export class DeviceController {
	status = $state<ConnectionStatus>('demo');
	kind = $state<DeviceKind>(INITIAL_PROFILE.kind);
	name = $state(INITIAL_PROFILE.name);
	model = $state(INITIAL_PROFILE.model);
	firmware = $state(INITIAL_PROFILE.firmware);
	battery = $state<BatteryState>({ ...INITIAL_PROFILE.battery });
	capabilities = $state<DeviceCapabilities>({ ...INITIAL_PROFILE.capabilities });
	ancMode = $state<AncMode>('anc');
	ancScene = $state<string>('noisy');
	ancLevel = $state(H3_PRO_ANC_MODES.anc.level);
	volume = $state(58);
	ldacEnabled = $state(INITIAL_PROFILE.capabilities.ldac);
	multipointEnabled = $state(INITIAL_PROFILE.capabilities.multipoint);
	spatialEnabled = $state(INITIAL_PROFILE.capabilities.spatial);
	wearDetectionEnabled = $state(INITIAL_PROFILE.capabilities.wearDetection);
	isPlaying = $state(true);
	eqPresetId = $state(defaultPreset.id);
	/**
	 * The preset that was last written successfully (or committed locally in
	 * demo mode). `eqPresetId` can already point at a preview, so this separate
	 * marker is what lets the UI warn when leaving Spatial Audio.
	 */
	appliedPresetId = $state(defaultPreset.id);
	eqGains = $state<number[]>([...defaultPreset.gains]);
	eqFrequencies = $state<number[]>([...(defaultPreset.frequencies ?? customEqBasis.frequencies)]);
	eqQs = $state<number[]>([...(defaultPreset.q ?? customEqBasis.q)]);
	eqTypes = $state<(0 | 2)[]>([...(defaultPreset.eqTypes ?? customEqBasis.eqTypes)]);
	eqTarget = $state<EqTarget>('official');
	eqDeviceIndex = $state(defaultPreset.deviceIndex ?? CUSTOM_EQ_SAVE_INDEX);
	masterGain = $state(defaultPreset.masterGain);
	eqDirty = $state(false);
	eqApplying = $state(false);
	eqProtocol = $state<EqProtocol>('multi');
	statusMessage = $state<string | null>(null);
	error = $state<string | null>(null);
	warning = $state<string | null>(null);
	lastSyncedAt = $state<Date | null>(null);

	readonly client = new QcyBluetoothClient();
	#unsubscribe: (() => void) | null = null;
	#batteryTimer: ReturnType<typeof setInterval> | null = null;
	#writeTimer: ReturnType<typeof setTimeout> | null = null;
	#eqWriteTimer: ReturnType<typeof setTimeout> | null = null;
	#eqApplyPromise: Promise<void> | null = null;
	#restartTimer: ReturnType<typeof setTimeout> | null = null;
	#eqReconnectWindow: ReturnType<typeof setTimeout> | null = null;
	#eqAwaitingReconnect = false;
	#restartAttempt = 0;
	#reconnectPromise: Promise<void> | null = null;
	#connectionEpoch = 0;
	#eqRevision = 0;
	#receivedBattery = false;

	constructor() {
		this.#loadSettings();
	}

	get isDemo(): boolean {
		return this.status === 'demo';
	}

	get connected(): boolean {
		return this.status === 'connected';
	}

	/** The saved BluetoothDevice can be reused without showing the chooser. */
	get canReconnect(): boolean {
		return this.status !== 'connected' && this.client.canReconnect;
	}

	get batteryAverage(): number | null {
		const values = [this.battery.left, this.battery.right].filter(
			(value): value is number => value !== null
		);
		if (values.length === 0) return null;
		return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
	}

	get singleBattery(): boolean {
		return this.kind !== 'earbuds' || this.battery.right === null;
	}

	get hasCaseBattery(): boolean {
		return this.battery.hasCase && this.battery.case !== null;
	}

	get batteryLabel(): string {
		if (this.kind === 'speaker') return 'Speaker battery';
		if (this.kind === 'headphones') return 'Headphone battery';
		return 'Battery';
	}

	get bands(): EqBand[] {
		return this.eqFrequencies.map((freq, index) => ({
			freq,
			gain: this.eqGains[index] ?? 0,
			q: this.eqQs[index] ?? EQ_DEFAULT_Q,
			eqType: this.eqTypes[index] ?? 0
		}));
	}

	/**
	 * The exact ten-band basis the UI is currently editing. Built-in presets
	 * replace it with their official frequencies/Q/types; slider edits keep
	 * it and move the write to the custom slot.
	 */
	get bandFrequencies(): number[] {
		return this.eqFrequencies;
	}

	/** True when the local curve is a user slider edit (custom slot 128). */
	get isCustomEq(): boolean {
		return this.eqTarget === 'custom';
	}

	/** True when the local curve came from the sound market (slot 126). */
	get isMarketEq(): boolean {
		return this.eqTarget === 'market';
	}

	/** True when the local curve is one of the seven official H3 Pro presets. */
	get isOfficialEq(): boolean {
		return this.eqTarget === 'official';
	}

	/**
	 * A short, explicit target label for the UI. It names the physical save
	 * index so a custom edit can never be mistaken for market slot 126.
	 */
	get eqTargetLabel(): string {
		if (this.eqTarget === 'custom') return `Custom · slot ${CUSTOM_EQ_SAVE_INDEX}`;
		if (this.eqTarget === 'market') return `Market · slot ${MARKET_EQ_SAVE_INDEX}`;
		return `Official · slot ${this.eqDeviceIndex}`;
	}

	/** Lower-case target phrase for prose, e.g. “custom slot 128”. */
	get eqTargetDescription(): string {
		if (this.eqTarget === 'custom') return `custom slot ${CUSTOM_EQ_SAVE_INDEX}`;
		if (this.eqTarget === 'market') return `market slot ${MARKET_EQ_SAVE_INDEX}`;
		return `official slot ${this.eqDeviceIndex}`;
	}

	get currentPreset(): EqPreset | undefined {
		return (
			presetById(this.eqPresetId) ??
			marketPresets.find((preset) => preset.id === this.eqPresetId)
		);
	}

	/** The preset that is currently written to the headphones. */
	get appliedPreset(): EqPreset | undefined {
		return (
			presetById(this.appliedPresetId) ??
			marketPresets.find((preset) => preset.id === this.appliedPresetId)
		);
	}

	/** True when the curve selected in the studio is Spatial Audio. */
	get isSpatialPreset(): boolean {
		return isSpatialDeviceIndex(this.currentPreset?.deviceIndex);
	}

	/** True only after a Spatial Audio EQ preset has been committed. */
	get isSpatialApplied(): boolean {
		return isSpatialDeviceIndex(this.appliedPreset?.deviceIndex);
	}

	setEqProtocol(protocol: EqProtocol): void {
		const parsed = eqProtocolSchema.safeParse(protocol);
		if (!parsed.success) return;
		this.eqProtocol = parsed.data;
		this.#saveSettings();
	}

	setDeviceKind(kind: DeviceKind): void {
		const parsed = deviceKindSchema.safeParse(kind);
		if (!parsed.success) return;

		const profile = demoProfile(parsed.data);
		if (this.isDemo) {
			this.#applyDemoProfile(profile);
		} else {
			this.kind = profile.kind;
			this.capabilities = { ...profile.capabilities };
			if (!this.capabilities.anc) this.ancMode = 'normal';
			if (!this.capabilities.ldac) this.ldacEnabled = false;
			if (!this.capabilities.multipoint) this.multipointEnabled = false;
			if (!this.capabilities.spatial) this.spatialEnabled = false;
			if (!this.capabilities.wearDetection) this.wearDetectionEnabled = false;
		}
		this.#saveSettings();
	}

	#setPresetCurve(preset: EqPreset): void {
		const isOfficial = preset.builtIn && preset.deviceIndex !== undefined;

		this.eqGains = [...preset.gains];
		// Official presets carry their own panel basis. Every market curve is
		// routed through the layout-level custom basis, exactly like the
		// decompiled setEQMarketData path, so a remote feed cannot smuggle in
		// a different frequency/Q layout.
		this.eqFrequencies = isOfficial
			? [...(preset.frequencies ?? customEqBasis.frequencies)]
			: [...customEqBasis.frequencies];
		this.eqQs = isOfficial ? [...(preset.q ?? customEqBasis.q)] : [...customEqBasis.q];
		this.eqTypes = isOfficial
			? [...(preset.eqTypes ?? customEqBasis.eqTypes)]
			: [...customEqBasis.eqTypes];
		this.eqPresetId = preset.id;
		this.eqTarget = isOfficial ? 'official' : 'market';
		this.eqDeviceIndex = isOfficial ? preset.deviceIndex! : MARKET_EQ_SAVE_INDEX;
		this.masterGain = preset.masterGain ?? 0;
	}

	/**
	 * Convert the current preview into a user custom edit. The first slider
	 * movement after a built-in or market curve must replace the basis:
	 * positional gains are kept, but frequencies/Q/types become the panel's
	 * custom basis and the write target becomes slot 128.
	 *
	 * The decompiled editor submits 255 and the device manager normalizes it
	 * to 128 when a prior EQ exists. The studio already has the official
	 * panel state, so it targets 128 directly and avoids the manager's
	 * "changed bands + last used params" merge, which would reintroduce the
	 * built-in basis we are replacing here.
	 */
	#enterCustomMode(): void {
		if (this.eqTarget === 'custom') return;

		const gains = [...this.eqGains];
		this.eqGains = customEqBasis.frequencies.map((_, index) =>
			Math.round(clamp(gains[index] ?? 0, EQ_MIN_GAIN, EQ_MAX_GAIN) * 10) / 10
		);
		this.eqFrequencies = [...customEqBasis.frequencies];
		this.eqQs = [...customEqBasis.q];
		this.eqTypes = [...customEqBasis.eqTypes];
		this.masterGain = customEqBasis.masterGain;
		this.eqPresetId = 'custom';
		this.eqTarget = 'custom';
		this.eqDeviceIndex = CUSTOM_EQ_SAVE_INDEX;
	}

	#applyDemoProfile(profile: DeviceProfile, resetEq = true): void {
		this.kind = profile.kind;
		this.name = profile.name;
		this.model = profile.model;
		this.firmware = profile.firmware;
		this.battery = { ...profile.battery };
		this.capabilities = { ...profile.capabilities };
		this.ancMode = profile.capabilities.anc ? 'anc' : 'normal';
		this.ancScene = 'noisy';
		this.ancLevel = profile.kind === 'headphones' ? H3_PRO_ANC_MODES.anc.level : 67;
		this.volume = 58;
		this.ldacEnabled = profile.capabilities.ldac;
		this.multipointEnabled = profile.capabilities.multipoint;
		this.spatialEnabled = profile.capabilities.spatial;
		this.wearDetectionEnabled = profile.capabilities.wearDetection;
		this.isPlaying = true;
		if (resetEq) {
			this.#setPresetCurve(defaultPreset);
			this.appliedPresetId = defaultPreset.id;
			this.#eqRevision++;
			this.eqDirty = false;
		}
	}

	async connect(acceptAll = false): Promise<void> {
		if (this.status === 'connecting') return;
		this.#connectionEpoch++;
		this.#cancelRestartRecovery();
		this.#cancelScheduledEqWrite();
		this.status = 'connecting';
		this.statusMessage = null;
		this.error = null;
		this.warning = null;
		this.#receivedBattery = false;
		this.#attach();

		try {
			const info = await this.client.connect({ acceptAll });
			this.name = info.name;
			this.model = info.name.replace(/^QCY\s+/i, '');
			this.status = 'connected';
			this.statusMessage = null;
			this.setDeviceKind(inferDeviceKind(info.name, this.#receivedBattery ? this.battery : undefined));
			this.lastSyncedAt = new SvelteDate();
			this.#startBatteryPoll();
			this.#saveSettings();
		} catch (error) {
			this.error =
				error instanceof QcyBluetoothError
					? error.message
					: error instanceof Error
						? error.message
						: 'The Bluetooth connection failed.';
			this.status = 'demo';
			this.statusMessage = null;
			this.#stopBatteryPoll();
			throw error;
		}
	}

	/**
	 * Reconnect the saved H3 Pro without opening the browser chooser. Safe to
	 * call from a "Reconnect" button after an automatic reconnect attempt fails.
	 */
	async reconnect(): Promise<void> {
		if (this.status === 'connected') return;
		if (!this.client.canReconnect) {
			this.status = 'error';
			this.statusMessage =
				'No saved Bluetooth device is available. Use Connect device to choose the H3 Pro again.';
			throw new QcyBluetoothError(this.statusMessage);
		}

		this.#cancelRestartRecovery();
		this.#cancelScheduledEqWrite();
		this.status = 'connecting';
		this.statusMessage = 'Reconnecting to H3 Pro…';
		this.error = null;
		const epoch = this.#connectionEpoch;

		try {
			await this.#runReconnect(epoch);
		} catch (error) {
			if (epoch === this.#connectionEpoch) {
				this.status = 'error';
				this.statusMessage =
					error instanceof Error
						? error.message
						: 'The H3 Pro did not reconnect. Keep it nearby and try again.';
			}
			throw error;
		}
	}

	async #runReconnect(epoch: number): Promise<void> {
		if (this.#reconnectPromise) return this.#reconnectPromise;

		const operation = (async () => {
			const info = await this.client.reconnect();
			if (epoch !== this.#connectionEpoch) return;
			this.#cancelRestartRecovery();
			this.name = info.name;
			this.model = info.name.replace(/^QCY\s+/i, '');
			this.status = 'connected';
			this.statusMessage = null;
			this.error = null;
			this.lastSyncedAt = new SvelteDate();
			this.#startBatteryPoll();
			this.#saveSettings();
		})();

		this.#reconnectPromise = operation;
		try {
			await operation;
		} finally {
			this.#reconnectPromise = null;
		}
	}

	useDemo(): void {
		this.#connectionEpoch++;
		this.#cancelRestartRecovery();
		this.#cancelScheduledEqWrite();
		this.client.disconnect();
		this.#detach();
		this.#stopBatteryPoll();
		this.status = 'demo';
		this.statusMessage = null;
		this.error = null;
		this.warning = null;
		this.#applyDemoProfile(demoProfile(this.kind));
	}

	disconnect(): void {
		this.#connectionEpoch++;
		this.#cancelRestartRecovery();
		this.#cancelScheduledEqWrite();
		this.client.disconnect();
		this.#detach();
		this.#stopBatteryPoll();
		this.status = 'demo';
		this.statusMessage = null;
	}

	setAncMode(mode: AncMode): void {
		if (!this.capabilities.anc) return;
		const parsed = ancModeSchema.safeParse(mode);
		if (!parsed.success) return;
		this.ancMode = parsed.data;

		if (!this.connected) return;

		if (this.client.transport === 'a002') {
			const setting = H3_PRO_ANC_MODES[parsed.data];
			this.ancLevel = setting.level;
			void this.client
				.setAnc(setting.mode, setting.scene, setting.level)
				.catch((error: unknown) => {
					this.warning =
						error instanceof Error ? error.message : 'Noise mode could not be changed.';
				});
			return;
		}

		// A001 firmware ignores the TLV ANC command and uses noise mode/level.
		void this.client.setNoiseMode(modeValue(parsed.data)).catch((error: unknown) => {
			this.warning = error instanceof Error ? error.message : 'Noise mode could not be changed.';
		});
	}

	/** Select one of the H3 Pro ANC scenes. Only JL/A002 accepts packed scenes. */
	setAncScene(id: string): void {
		if (!this.capabilities.anc) return;
		const scene = H3_PRO_ANC_SCENES.find((entry) => entry.id === id);
		if (!scene) return;
		this.ancScene = scene.id;

		if (!this.connected || this.client.transport !== 'a002') return;

		this.ancMode = modeFromValue(scene.mode, 'a002');
		this.ancLevel = scene.level;
		void this.client.setAnc(scene.mode, scene.scene, scene.level).catch((error: unknown) => {
			this.warning = error instanceof Error ? error.message : 'ANC scene could not be changed.';
		});
	}

	setAncLevel(level: number): void {
		if (!this.capabilities.anc) return;
		this.ancLevel = Math.round(clamp(level, 0, 100));
		if (!this.connected) return;

		if (this.client.transport === 'a002') {
			const setting = H3_PRO_ANC_MODES[this.ancMode];
			const scene = H3_PRO_ANC_SCENES.find((entry) => entry.id === this.ancScene);
			const sceneValue = this.ancMode === 'anc' && scene ? scene.scene : setting.scene;
			this.#debouncedWrite(() => {
				void this.client.setAnc(setting.mode, sceneValue, this.ancLevel).catch((error: unknown) => {
					this.warning =
						error instanceof Error ? error.message : 'Noise level could not be changed.';
				});
			}, 140);
			return;
		}

		this.#debouncedWrite(() => {
			void this.client.setNoiseLevel(this.ancLevel).catch((error: unknown) => {
				this.warning = error instanceof Error ? error.message : 'Noise level could not be changed.';
			});
		}, 140);
	}

	setVolume(level: number): void {
		this.volume = Math.round(clamp(level, 0, 100));
		if (this.connected) {
			this.#debouncedWrite(() => {
				void this.client.setVolume(this.volume).catch((error: unknown) => {
					this.warning =
						error instanceof Error ? error.message : 'Volume could not be changed.';
				});
			}, 80);
		}
	}

	async setLdac(enabled: boolean): Promise<void> {
		if (!this.capabilities.ldac) return;
		const previous = this.ldacEnabled;
		this.ldacEnabled = enabled;
		if (!this.connected) return;
		try {
			await this.client.setLdac(enabled);
			this.warning = null;
			this.lastSyncedAt = new SvelteDate();
		} catch (error) {
			this.ldacEnabled = previous;
			this.warning = error instanceof Error ? error.message : 'LDAC could not be changed.';
			throw error;
		}
	}

	async setMultipoint(enabled: boolean): Promise<void> {
		if (!this.capabilities.multipoint) return;
		const previous = this.multipointEnabled;
		this.multipointEnabled = enabled;
		if (!this.connected) return;
		try {
			await this.client.setMultipoint(enabled);
			this.warning = null;
			this.lastSyncedAt = new SvelteDate();
		} catch (error) {
			this.multipointEnabled = previous;
			this.warning =
				error instanceof Error ? error.message : 'Multipoint could not be changed.';
			throw error;
		}
	}

	async setSpatialAudio(enabled: boolean): Promise<void> {
		if (!this.capabilities.spatial) return;
		const previous = this.spatialEnabled;
		this.spatialEnabled = enabled;
		if (!this.connected) return;
		try {
			await this.client.setSpatialAudio(enabled);
			this.warning = null;
			this.lastSyncedAt = new SvelteDate();
		} catch (error) {
			this.spatialEnabled = previous;
			this.warning =
				error instanceof Error ? error.message : 'Spatial audio could not be changed.';
			throw error;
		}
	}

	async setWearDetection(enabled: boolean): Promise<void> {
		if (!this.capabilities.wearDetection) return;
		const previous = this.wearDetectionEnabled;
		this.wearDetectionEnabled = enabled;
		if (!this.connected) return;
		try {
			await this.client.setWearDetection(enabled);
			this.warning = null;
			this.lastSyncedAt = new SvelteDate();
		} catch (error) {
			this.wearDetectionEnabled = previous;
			this.warning =
				error instanceof Error ? error.message : 'Wear detection could not be changed.';
			throw error;
		}
	}

	setBandGain(index: number, gain: number): void {
		if (index < 0 || index >= this.eqGains.length) return;
		// The first edit after a built-in/market preview switches to the
		// custom basis before the new gain is written, so the official curve's
		// frequencies/Q can never leak into the custom slot.
		this.#enterCustomMode();
		const next = [...this.eqGains];
		next[index] = Math.round(clamp(gain, EQ_MIN_GAIN, EQ_MAX_GAIN) * 10) / 10;
		this.eqGains = next;
		this.#markEqDirty();
		this.#saveSettings();

		if (this.kind === 'headphones') {
			// H3 Pro: keep slider edits local and send the finished curve once
			// with applyEq(). This avoids a write per drag tick.
			return;
		}

		this.#scheduleEqWrite();
	}

	setMasterGain(gain: number): void {
		this.#enterCustomMode();
		this.masterGain = Math.round(clamp(gain, EQ_MIN_GAIN, EQ_MAX_GAIN) * 10) / 10;
		this.#markEqDirty();
		this.#saveSettings();

		if (this.kind === 'headphones') return;
		this.#scheduleEqWrite();
	}

	/** Choose a preset locally. Nothing is written until applyEq() is called. */
	selectPreset(preset: EqPreset): void {
		this.#cancelScheduledEqWrite();
		this.#setPresetCurve(preset);
		this.#markEqDirty();
		this.#saveSettings();
	}

	/**
	 * Select a preset and, by default, commit it once. Pass { apply: false }
	 * when the UI wants to preview the curve and apply it with applyEq().
	 */
	async applyPreset(preset: EqPreset, options: { apply?: boolean } = {}): Promise<void> {
		this.selectPreset(preset);
		if (options.apply !== false) await this.applyEq();
	}

	async applyBands(gains: number[], options: { apply?: boolean } = {}): Promise<void> {
		this.#cancelScheduledEqWrite();
		this.#enterCustomMode();
		this.eqGains = customEqBasis.frequencies.map((_, index) =>
			Math.round(clamp(gains[index] ?? 0, EQ_MIN_GAIN, EQ_MAX_GAIN) * 10) / 10
		);
		this.eqFrequencies = [...customEqBasis.frequencies];
		this.eqQs = [...customEqBasis.q];
		this.eqTypes = [...customEqBasis.eqTypes];
		this.eqPresetId = 'custom';
		this.eqTarget = 'custom';
		this.eqDeviceIndex = CUSTOM_EQ_SAVE_INDEX;
		this.masterGain = customEqBasis.masterGain;
		this.#markEqDirty();
		this.#saveSettings();
		if (options.apply !== false) await this.applyEq();
	}

	/**
	 * Commit the current curve exactly once, then clear the unsaved marker.
	 * Concurrent calls share one in-flight write; calls with no dirty state
	 * do not write again. The write itself is never debounced.
	 *
	 * EQ is not a mandatory-reboot operation for normal H3 Pro presets. Spatial
	 * Audio is the exception: the headset turns LDAC off and reboots itself when
	 * the spatial preset is written. The controller mirrors that LDAC change
	 * after the write succeeds but never sends a separate LDAC command. If the
	 * link drops, the disconnect handler uses the short reconnect window below.
	 */
	async applyEq(): Promise<void> {
		this.#cancelScheduledEqWrite();
		if (!this.eqDirty) return;
		const presetId = this.eqPresetId;
		const applyingSpatial = isSpatialDeviceIndex(this.eqDeviceIndex);
		if (!this.connected) {
			// Demo mode is a local-only commit. During a reconnect or a dropped
			// link, keep the unsaved state so it is not silently discarded.
			if (this.status === 'demo') {
				this.eqDirty = false;
				this.#commitAppliedPreset(presetId, applyingSpatial);
			}
			return;
		}
		if (this.#eqApplyPromise) return this.#eqApplyPromise;

		const revision = this.#eqRevision;
		const operation = (async () => {
			this.eqApplying = true;
			try {
				const sent = await this.#pushEq(revision);
				if (!sent) throw new Error(this.warning ?? 'The EQ could not be sent.');
				if (revision === this.#eqRevision) this.eqDirty = false;
				this.#commitAppliedPreset(presetId, applyingSpatial);

				if (this.kind === 'headphones') this.#armEqReconnectWindow();
			} finally {
				this.eqApplying = false;
			}
		})();

		this.#eqApplyPromise = operation;
		try {
			await operation;
		} finally {
			this.#eqApplyPromise = null;
		}
	}

	#commitAppliedPreset(presetId: string, spatial: boolean): void {
		this.appliedPresetId = presetId;
		// The H3 Pro disables LDAC itself when the spatial EQ preset is applied.
		// Do not send cmd 35 here; this is only the optimistic local mirror.
		if (spatial) this.ldacEnabled = false;
	}

	async resetEq(options: { apply?: boolean } = {}): Promise<void> {
		await this.applyPreset(defaultPreset, options);
	}

	togglePlayback(): void {
		this.isPlaying = !this.isPlaying;
		if (this.connected) {
			void this.client.musicAction(this.isPlaying ? 1 : 2).catch((error: unknown) => {
				this.warning = error instanceof Error ? error.message : 'Playback could not be changed.';
			});
		}
	}

	nextTrack(): void {
		this.isPlaying = true;
		if (this.connected) void this.client.musicAction(4).catch(() => undefined);
	}

	previousTrack(): void {
		if (this.connected) void this.client.musicAction(3).catch(() => undefined);
	}

	async refreshBattery(): Promise<void> {
		if (!this.connected) return;
		try {
			const battery = await this.client.readBattery();
			if (battery) this.battery = toBatteryState(battery);
		} catch {
			// Leave the last known values in place.
		}
	}

	#attach(): void {
		this.#detach();
		this.#unsubscribe = this.client.onEvent((event) => {
			switch (event.type) {
				case 'state':
					if (event.state === 'disconnected') {
						this.#stopBatteryPoll();
						if (this.status === 'restarting') {
							this.statusMessage =
								this.#restartAttempt === 0
									? 'H3 Pro disconnected after applying EQ. Reconnecting…'
									: `Reconnecting to H3 Pro (attempt ${this.#restartAttempt + 1}/${EQ_RECONNECT_RETRY_DELAYS_MS.length + 1})…`;
						} else if (this.#eqAwaitingReconnect) {
							this.#eqAwaitingReconnect = false;
							this.status = 'restarting';
							this.statusMessage = 'H3 Pro disconnected after applying EQ. Reconnecting…';
							this.#queueRestartAttempt(0, EQ_RECONNECT_DELAY_MS);
						} else if (this.status === 'connecting') {
							// reconnect() reports the failure once its promise settles.
						} else if (this.client.canReconnect) {
							this.status = 'error';
							this.statusMessage =
								'The Bluetooth connection was lost. Reconnect to continue with the last live values.';
						} else {
							this.status = 'demo';
							this.statusMessage = null;
						}
					}
					break;
				case 'battery':
					this.battery = toBatteryState(event.battery);
					this.#receivedBattery = true;
					break;
				case 'version':
					this.firmware = event.version;
					break;
				case 'warning':
					this.warning = event.message;
					break;
				case 'command': {
					const { cmd, data } = event.command;
					if (cmd === 12 && data.length >= 1) {
						this.ancMode = modeFromValue(data[0], this.client.transport);
					}
					if (cmd === 23 && data.length >= 3) {
						this.ancMode = modeFromValue(data[0], this.client.transport);
						if (this.client.transport === 'a002') {
							const scene = H3_PRO_ANC_SCENES.find(
								(entry) => entry.mode === data[0] && entry.scene === data[1]
							);
							if (scene) this.ancScene = scene.id;
						}
						this.ancLevel = data[2];
					}
					if (cmd === 7 && data.length >= 1 && data[0] <= 100) {
						this.ancLevel = data[0];
					}
					if (cmd === 8 && data.length >= 1) {
						this.volume = data[0];
					}
					if (cmd === 6 && data.length >= 1) {
						this.wearDetectionEnabled = data[0] === 1;
					}
					if (cmd === 35 && data.length >= 1) {
						this.ldacEnabled = data[0] === 1;
					}
					if (cmd === 36 && data.length >= 1) {
						this.multipointEnabled = data[0] === 1;
					}
					if (cmd === 45 && data.length >= 1) {
						this.spatialEnabled = data[0] === 1;
					}
					if (cmd === 47 && data.length >= 3) {
						this.battery = toBatteryState(parseBattery(data));
						this.#receivedBattery = true;
					}
					if (cmd === 48 && data.length >= 3) {
						this.firmware = parseVersion(data);
					}
					break;
				}
			}
		});
	}

	#detach(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = null;
	}

	#startBatteryPoll(): void {
		this.#stopBatteryPoll();
		this.#batteryTimer = setInterval(() => {
			void this.refreshBattery();
		}, 30_000);
	}

	#stopBatteryPoll(): void {
		if (this.#batteryTimer) {
			clearInterval(this.#batteryTimer);
			this.#batteryTimer = null;
		}
	}

	#markEqDirty(): void {
		this.#eqRevision++;
		this.eqDirty = true;
	}

	#scheduleEqWrite(): void {
		if (!this.connected) return;
		this.#cancelScheduledEqWrite();
		this.#eqWriteTimer = setTimeout(() => {
			this.#eqWriteTimer = null;
			void this.#pushEq();
		}, 110);
	}

	#cancelScheduledEqWrite(): void {
		if (this.#eqWriteTimer) {
			clearTimeout(this.#eqWriteTimer);
			this.#eqWriteTimer = null;
		}
	}

	#queueRestartAttempt(attempt: number, delay: number): void {
		if (this.#restartTimer) clearTimeout(this.#restartTimer);
		this.#restartAttempt = attempt;
		this.#restartTimer = setTimeout(() => {
			this.#restartTimer = null;
			void this.#attemptRestartReconnect();
		}, delay);
	}

	/**
	 * A successful EQ write does not imply a reboot. Arm a short watch window:
	 * if the link drops, reconnect automatically; if it stays up, do nothing.
	 */
	#armEqReconnectWindow(): void {
		this.#clearEqReconnectWindow();
		this.#eqAwaitingReconnect = true;
		this.#eqReconnectWindow = setTimeout(() => {
			this.#eqReconnectWindow = null;
			this.#eqAwaitingReconnect = false;
		}, EQ_RECONNECT_GRACE_MS);
	}

	#clearEqReconnectWindow(): void {
		if (this.#eqReconnectWindow) {
			clearTimeout(this.#eqReconnectWindow);
			this.#eqReconnectWindow = null;
		}
		this.#eqAwaitingReconnect = false;
	}

	#cancelRestartRecovery(): void {
		if (this.#restartTimer) {
			clearTimeout(this.#restartTimer);
			this.#restartTimer = null;
		}
		this.#restartAttempt = 0;
		this.#clearEqReconnectWindow();
	}

	async #attemptRestartReconnect(): Promise<void> {
		if (this.status !== 'restarting') return;
		const epoch = this.#connectionEpoch;
		if (!this.client.canReconnect) {
			this.status = 'error';
			this.statusMessage =
				'The saved H3 Pro is no longer available. Use Connect device to choose it again.';
			return;
		}

		const total = EQ_RECONNECT_RETRY_DELAYS_MS.length + 1;
		this.statusMessage =
			this.#restartAttempt === 0
				? 'Reconnecting to H3 Pro…'
				: `Reconnecting to H3 Pro (attempt ${this.#restartAttempt + 1}/${total})…`;

		try {
			await this.#runReconnect(epoch);
		} catch {
			if (epoch !== this.#connectionEpoch || this.status !== 'restarting') return;
			const next = this.#restartAttempt + 1;
			const delay = EQ_RECONNECT_RETRY_DELAYS_MS[next - 1];
			if (delay === undefined) {
				this.status = 'error';
				this.statusMessage =
					'H3 Pro did not reconnect after applying EQ. Keep it nearby, then choose Reconnect H3 Pro.';
				return;
			}
			this.#queueRestartAttempt(next, delay);
		}
	}

	async #pushEq(revision = this.#eqRevision): Promise<boolean> {
		if (!this.connected) return false;
		try {
			await this.client.setEq(this.bands, {
				protocol: this.eqProtocol,
				masterGain: this.masterGain,
				saveIndex: this.eqDeviceIndex
			});
			this.lastSyncedAt = new SvelteDate();
			this.warning = null;
			if (revision === this.#eqRevision) this.eqDirty = false;
			return true;
		} catch (error) {
			this.warning = error instanceof Error ? error.message : 'The EQ could not be sent.';
			return false;
		}
	}

	#debouncedWrite(operation: () => void, delay: number): void {
		if (this.#writeTimer) clearTimeout(this.#writeTimer);
		this.#writeTimer = setTimeout(() => {
			this.#writeTimer = null;
			operation();
		}, delay);
	}

	#loadSettings(): void {
		if (!canUseStorage) return;
		try {
			const raw = localStorage.getItem(SETTINGS_KEY);
			if (!raw) return;
			const parsed = settingsSchema.safeParse(JSON.parse(raw));
			if (!parsed.success) return;
			this.#applyDemoProfile(demoProfile(parsed.data.deviceKind), false);
			this.eqProtocol = parsed.data.eqProtocol;
			const preset =
				presetById(parsed.data.lastPresetId) ??
				marketPresets.find((candidate) => candidate.id === parsed.data.lastPresetId);
			if (preset) {
				this.#setPresetCurve(preset);
				this.appliedPresetId = preset.id;
				if (isSpatialDeviceIndex(preset.deviceIndex)) this.ldacEnabled = false;
			}
		} catch {
			// A corrupt settings entry should never block the UI.
		}
	}

	#saveSettings(): void {
		if (!canUseStorage) return;
		try {
			localStorage.setItem(
				SETTINGS_KEY,
				JSON.stringify({
					eqProtocol: this.eqProtocol,
					lastPresetId: this.eqPresetId,
					deviceKind: this.kind,
					reducedMotion: false
				})
			);
		} catch {
			// Private browsing can make localStorage unavailable.
		}
	}
}

export const device = new DeviceController();
export { presets };
