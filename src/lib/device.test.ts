import { afterEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_EQ_SAVE_INDEX, MARKET_EQ_SAVE_INDEX } from './ble/constants';
import type { ClientEvent } from './ble/client';
import { DeviceController } from './device.svelte';
import { H3_PRO_ANC_MODES, H3_PRO_ANC_SCENES, inferDeviceKind } from './data/devices';
import { marketPresets } from './data/market-presets';
import { customEqBasis, presets } from './data/presets';

const controllers: DeviceController[] = [];

afterEach(() => {
	for (const device of controllers) device.disconnect();
	controllers.length = 0;
	vi.restoreAllMocks();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

async function connectController(transport: 'a001' | 'a002') {
	const device = new DeviceController();
	controllers.push(device);
	const listeners = new Set<(event: ClientEvent) => void>();
	vi.spyOn(device.client, 'onEvent').mockImplementation((listener) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	});
	vi.spyOn(device.client, 'transport', 'get').mockReturnValue(transport);
	vi.spyOn(device.client, 'canReconnect', 'get').mockReturnValue(true);
	device.client.connect = async () => ({ name: 'QCY H3 Pro', id: 'test-device' });
	const setAnc = vi.spyOn(device.client, 'setAnc').mockResolvedValue();
	const setNoiseMode = vi.spyOn(device.client, 'setNoiseMode').mockResolvedValue();
	const setNoiseLevel = vi.spyOn(device.client, 'setNoiseLevel').mockResolvedValue();
	const setEq = vi.spyOn(device.client, 'setEq').mockResolvedValue();

	await device.connect();

	const emit = (event: ClientEvent) => {
		for (const listener of listeners) listener(event);
	};

	return { device, setAnc, setNoiseMode, setNoiseLevel, setEq, emit };
}

describe('H3 Pro ANC constants', () => {
	it('matches the panel mode values and scene labels', () => {
		expect(H3_PRO_ANC_MODES).toEqual({
			anc: { mode: 1, scene: 1, level: 2 },
			transparency: { mode: 3, scene: 1, level: 4 },
			normal: { mode: 2, scene: 0, level: 0 }
		});
		expect(H3_PRO_ANC_SCENES).toEqual([
			{ id: 'adaptive', label: 'Adaptive', mode: 1, scene: 5, level: 0 },
			{ id: 'noisy', label: 'Noisy', mode: 1, scene: 1, level: 0 },
			{ id: 'commute', label: 'Commute', mode: 1, scene: 2, level: 0 },
			{ id: 'indoor', label: 'Indoor', mode: 1, scene: 3, level: 0 },
			{ id: 'wind', label: 'Wind', mode: 1, scene: 4, level: 0 }
		]);
	});
});

describe('H3 Pro official preset data', () => {
	it('ships all seven built-ins with the panel ids and English names', () => {
		expect(presets).toHaveLength(7);
		expect(presets.map((preset) => preset.deviceIndex)).toEqual([1, 2, 3, 4, 5, 6, 10]);
		expect(presets.map((preset) => preset.name)).toEqual([
			'Balanced',
			'Pop',
			'Bass',
			'Rock',
			'Soft',
			'Classical',
			'Spatial Audio'
		]);
		expect(presets.every((preset) => preset.builtIn)).toBe(true);
		expect(presets.every((preset) => preset.author === 'QCY H3 Pro')).toBe(true);
	});

	it('uses the exact panel gains, frequencies, Q, types, and master gain', () => {
		const expected = [
			{
				id: 'balanced',
				deviceIndex: 1,
				gains: [0, -3, -7, -13, 2, -5, 3, 2, -15, -4],
				q: [0.7, 0.7, 1, 0.7, 1.5, 2, 1.8, 2, 3, 2.5]
			},
			{
				id: 'pop',
				deviceIndex: 2,
				gains: [0, -8, -9, -15, 2, -5, 3, 2, -12, -2],
				q: [0.5, 0.5, 1, 0.7, 1.5, 2, 1.8, 1, 3, 2.5]
			},
			{
				id: 'bass',
				deviceIndex: 3,
				gains: [0, 3, -5, -10, 2, -7, 0, -2, -15, -6],
				q: [0.8, 0.7, 1, 0.7, 1.5, 1.5, 1.8, 0.7, 3, 1.5]
			},
			{
				id: 'rock',
				deviceIndex: 4,
				gains: [0, 2, -5, -12, -3, -7, 5, 2, -10, -2],
				q: [0.7, 0.7, 1, 0.7, 0.5, 1.8, 1, 1, 3, 2.5]
			},
			{
				id: 'soft',
				deviceIndex: 5,
				gains: [0, -5, -7, -15, 2, -5, 3, 1, -15, -4],
				q: [0.7, 0.5, 1, 0.5, 1.5, 2, 1.8, 2, 2, 2]
			},
			{
				id: 'classical',
				deviceIndex: 6,
				gains: [0, 1, -3, -8, 2, -5, 3, 2, -15, -4],
				q: [0.7, 0.7, 1, 0.7, 1, 2, 1.8, 2, 3, 2.5]
			},
			{
				id: 'spatial',
				deviceIndex: 10,
				gains: [0, -3, -7, -13, 2, -5, 3, 2, -15, -4],
				q: [0.7, 0.7, 1, 0.7, 1.5, 2, 1.8, 2, 3, 2.5]
			}
		];

		for (const entry of expected) {
			const preset = presets.find((candidate) => candidate.id === entry.id);
			expect(preset).toBeDefined();
			expect(preset!.deviceIndex).toBe(entry.deviceIndex);
			expect(preset!.gains).toEqual(entry.gains);
			expect(preset!.frequencies).toEqual([
				30, 45, 120, 220, 900, 1300, 2800, 6000, 7500, 11000
			]);
			expect(preset!.q).toEqual(entry.q);
			expect(preset!.eqTypes).toEqual([0, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
			expect(preset!.masterGain).toBe(-4);
		}
	});

	it('keeps all bundled market curves custom and on the H3 Pro custom basis', () => {
		expect(marketPresets).toHaveLength(10);
		expect(marketPresets.every((preset) => !preset.builtIn)).toBe(true);
		expect(marketPresets.every((preset) => preset.deviceIndex === undefined)).toBe(true);
		expect(marketPresets.every((preset) => preset.frequencies?.length === 10)).toBe(true);
		expect(marketPresets.every((preset) => preset.q?.length === 10)).toBe(true);
		expect(marketPresets.every((preset) => preset.eqTypes?.length === 10)).toBe(true);
	});
});

describe('DeviceController demo mode', () => {
	it('starts with the QCY H3 Pro headphones profile and one battery', () => {
		const device = new DeviceController();
		expect(device.status).toBe('demo');
		expect(device.kind).toBe('headphones');
		expect(device.name).toBe('QCY H3 Pro');
		expect(device.model).toBe('H3 Pro');
		expect(device.firmware).toBe('1.0.0');
		expect(device.battery).toEqual({
			left: 78,
			right: null,
			case: null,
			leftCharging: false,
			rightCharging: false,
			caseCharging: false,
			hasCase: false
		});
		expect(device.capabilities).toEqual({
			anc: true,
			eq: true,
			playback: true,
			volume: true,
			ldac: true,
			multipoint: true,
			spatial: false,
			wearDetection: false
		});
		expect(device.singleBattery).toBe(true);
		expect(device.hasCaseBattery).toBe(false);
		expect(device.ancScene).toBe('noisy');
		expect(device.eqDeviceIndex).toBe(1);
		expect(device.eqGains).toHaveLength(10);
	});

	it('applies a preset and carries its official curve data', () => {
		const device = new DeviceController();
		const bass = presets.find((preset) => preset.id === 'bass');
		expect(bass).toBeDefined();
		device.applyPreset(bass!);
		expect(device.eqPresetId).toBe('bass');
		expect(device.eqTarget).toBe('official');
		expect(device.eqGains).toEqual(bass!.gains);
		expect(device.eqDeviceIndex).toBe(3);
		expect(device.eqFrequencies).toEqual(bass!.frequencies);
		expect(device.eqQs).toEqual(bass!.q);
		expect(device.eqTypes).toEqual(bass!.eqTypes);
		expect(device.masterGain).toBe(-4);
	});

	it('mirrors the H3 Pro LDAC-off behaviour when spatial is applied in demo mode', async () => {
		const device = new DeviceController();
		const spatial = presets.find((preset) => preset.id === 'spatial');
		expect(spatial).toBeDefined();
		expect(device.ldacEnabled).toBe(true);

		device.selectPreset(spatial!);
		expect(device.isSpatialPreset).toBe(true);
		expect(device.isSpatialApplied).toBe(false);

		await device.applyEq();

		expect(device.ldacEnabled).toBe(false);
		expect(device.isSpatialApplied).toBe(true);
		expect(device.eqDirty).toBe(false);
		expect(device.eqDeviceIndex).toBe(10);
	});

	it('clamps a band gain to ±15 dB and moves edits to custom slot 128', () => {
		const device = new DeviceController();
		device.setBandGain(0, 30);
		expect(device.eqGains[0]).toBe(15);
		expect(device.eqPresetId).toBe('custom');
		expect(device.eqTarget).toBe('custom');
		expect(device.eqDeviceIndex).toBe(CUSTOM_EQ_SAVE_INDEX);
		expect(device.eqFrequencies).toEqual(customEqBasis.frequencies);
		expect(device.eqQs).toEqual(customEqBasis.q);
		expect(device.eqTypes).toEqual(customEqBasis.eqTypes);

		device.setBandGain(0, -30);
		expect(device.eqGains[0]).toBe(-15);
	});

	it('switches a master-gain edit after an official preset to the custom basis and slot 128', () => {
		const device = new DeviceController();
		const bass = presets.find((preset) => preset.id === 'bass')!;

		device.selectPreset(bass);
		expect(device.eqTarget).toBe('official');

		device.setMasterGain(2.5);

		expect(device.eqTarget).toBe('custom');
		expect(device.eqDeviceIndex).toBe(CUSTOM_EQ_SAVE_INDEX);
		expect(device.eqFrequencies).toEqual(customEqBasis.frequencies);
		expect(device.eqQs).toEqual(customEqBasis.q);
		expect(device.eqTypes).toEqual(customEqBasis.eqTypes);
		expect(device.eqGains).toEqual(bass.gains);
		expect(device.masterGain).toBe(2.5);
	});

	it('clamps volume to 0–100', () => {
		const device = new DeviceController();
		device.setVolume(140);
		expect(device.volume).toBe(100);

		device.setVolume(-9);
		expect(device.volume).toBe(0);
	});

	it('switches noise modes and clamps the level', () => {
		const device = new DeviceController();
		device.setAncMode('transparency');
		expect(device.ancMode).toBe('transparency');

		device.setAncLevel(180);
		expect(device.ancLevel).toBe(100);
	});

	it('tracks ANC scenes in demo mode', () => {
		const device = new DeviceController();
		device.setAncScene('wind');

		expect(device.ancScene).toBe('wind');
		expect(device.ancMode).toBe('anc');

		device.setAncScene('not-a-scene');
		expect(device.ancScene).toBe('wind');
	});

	it('returns to demo defaults', () => {
		const device = new DeviceController();
		device.setBandGain(2, 9);
		device.setVolume(12);
		device.setAncMode('normal');
		device.setAncScene('wind');
		device.useDemo();

		expect(device.volume).toBe(58);
		expect(device.ancMode).toBe('anc');
		expect(device.ancScene).toBe('noisy');
		expect(device.eqPresetId).toBe('balanced');
		expect(device.eqDeviceIndex).toBe(1);
		expect(device.eqGains).toEqual(presets[0]!.gains);
		expect(device.eqFrequencies).toEqual(presets[0]!.frequencies);
		expect(device.eqTypes).toEqual(presets[0]!.eqTypes);
		expect(device.masterGain).toBe(-4);
	});

	it('collapses to one battery for over-ear headphones', () => {
		const device = new DeviceController();
		device.setDeviceKind('headphones');

		expect(device.kind).toBe('headphones');
		expect(device.singleBattery).toBe(true);
		expect(device.name).toBe('QCY H3 Pro');
		expect(device.battery.left).toBe(78);
		expect(device.battery.right).toBeNull();
		expect(device.battery.case).toBeNull();
		expect(device.hasCaseBattery).toBe(false);
		expect(device.capabilities.anc).toBe(true);
	});

	it('hides ANC controls for speakers and ignores ANC writes', () => {
		const device = new DeviceController();
		device.setDeviceKind('speaker');

		expect(device.kind).toBe('speaker');
		expect(device.singleBattery).toBe(true);
		expect(device.capabilities.anc).toBe(false);
		expect(device.ancMode).toBe('normal');

		device.setAncMode('anc');
		expect(device.ancMode).toBe('normal');
	});

	it('keeps the selected layout when restoring demo data', () => {
		const device = new DeviceController();
		device.setDeviceKind('headphones');
		device.setVolume(12);
		device.useDemo();

		expect(device.kind).toBe('headphones');
		expect(device.name).toBe('QCY H3 Pro');
		expect(device.battery.left).toBe(78);
		expect(device.battery.right).toBeNull();
		expect(device.volume).toBe(58);
	});

	it('starts H3 Pro feature switches with spatial and wear hidden', async () => {
		const device = new DeviceController();
		expect(device.ldacEnabled).toBe(true);
		expect(device.multipointEnabled).toBe(true);
		expect(device.spatialEnabled).toBe(false);
		expect(device.wearDetectionEnabled).toBe(false);

		await device.setLdac(false);
		expect(device.ldacEnabled).toBe(false);
	});

	it('keeps the full feature set on the earbuds demo profile', () => {
		const device = new DeviceController();
		device.setDeviceKind('earbuds');

		expect(device.ldacEnabled).toBe(true);
		expect(device.multipointEnabled).toBe(true);
		expect(device.spatialEnabled).toBe(true);
		expect(device.wearDetectionEnabled).toBe(true);
	});

	it('gates feature switches by device class and resets their defaults', () => {
		const device = new DeviceController();
		device.setDeviceKind('headphones');
		expect(device.ldacEnabled).toBe(true);
		expect(device.multipointEnabled).toBe(true);
		expect(device.spatialEnabled).toBe(false);
		expect(device.wearDetectionEnabled).toBe(false);

		device.setDeviceKind('speaker');
		expect(device.ldacEnabled).toBe(false);
		expect(device.multipointEnabled).toBe(false);
		expect(device.spatialEnabled).toBe(false);
		expect(device.wearDetectionEnabled).toBe(false);
	});

	it('ignores a feature switch the current device does not support', async () => {
		const device = new DeviceController();
		device.setDeviceKind('speaker');

		await device.setSpatialAudio(true);
		await device.setLdac(true);
		expect(device.spatialEnabled).toBe(false);
		expect(device.ldacEnabled).toBe(false);
	});

	it('resets feature switches when restoring the same demo layout', async () => {
		const device = new DeviceController();
		await device.setMultipoint(false);
		expect(device.multipointEnabled).toBe(false);

		device.useDemo();
		expect(device.multipointEnabled).toBe(true);
	});
});

describe('DeviceController ANC transport commands', () => {
	it('sends H3 Pro mode settings through command 23 on A002', async () => {
		const { device, setAnc, setNoiseMode } = await connectController('a002');

		device.setAncMode('anc');
		expect(setAnc).toHaveBeenLastCalledWith(1, 1, 2);

		device.setAncMode('transparency');
		expect(setAnc).toHaveBeenLastCalledWith(3, 1, 4);

		device.setAncMode('normal');
		expect(setAnc).toHaveBeenLastCalledWith(2, 0, 0);
		expect(setNoiseMode).not.toHaveBeenCalled();
	});

	it('sends every H3 Pro scene as a packed command 23 payload on A002', async () => {
		const { device, setAnc } = await connectController('a002');

		for (const scene of H3_PRO_ANC_SCENES) {
			device.setAncScene(scene.id);
			expect(device.ancScene).toBe(scene.id);
			expect(setAnc).toHaveBeenLastCalledWith(scene.mode, scene.scene, scene.level);
		}
	});

	it('sends the selected scene and level through command 23 on A002', async () => {
		vi.useFakeTimers();
		const { device, setAnc } = await connectController('a002');

		device.setAncScene('commute');
		setAnc.mockClear();
		device.setAncLevel(45);
		await vi.advanceTimersByTimeAsync(150);

		expect(setAnc).toHaveBeenCalledWith(1, 2, 45);
	});

	it('keeps A001 on noise mode 12 and noise level 7', async () => {
		vi.useFakeTimers();
		const { device, setAnc, setNoiseMode, setNoiseLevel } = await connectController('a001');

		device.setAncMode('transparency');
		expect(setNoiseMode).toHaveBeenLastCalledWith(2);
		expect(setAnc).not.toHaveBeenCalled();

		device.setAncScene('wind');
		expect(device.ancScene).toBe('wind');
		expect(setAnc).not.toHaveBeenCalled();

		device.setAncLevel(45);
		await vi.advanceTimersByTimeAsync(150);
		expect(setNoiseLevel).toHaveBeenLastCalledWith(45);
		expect(setAnc).not.toHaveBeenCalled();
	});

	it('applies all seven official presets with their own save ids', async () => {
		const { device, setEq } = await connectController('a002');

		for (const preset of presets) {
			await device.applyPreset(preset);
			expect(device.eqTarget).toBe('official');
			expect(device.eqDeviceIndex).toBe(preset.deviceIndex);
			expect(device.eqGains).toEqual(preset.gains);
			expect(device.eqFrequencies).toEqual(preset.frequencies);
			expect(device.eqQs).toEqual(preset.q);
			expect(device.eqTypes).toEqual(preset.eqTypes);
			expect(setEq).toHaveBeenLastCalledWith(
				preset.gains.map((gain, index) => ({
					freq: preset.frequencies![index],
					gain,
					q: preset.q![index],
					eqType: preset.eqTypes![index]
				})),
				{
					protocol: 'multi',
					masterGain: -4,
					saveIndex: preset.deviceIndex
				}
			);
		}

		expect(setEq).toHaveBeenCalledTimes(presets.length);
	});

	it('turns LDAC off locally after one spatial EQ write without sending command 35', async () => {
		const { device, setEq } = await connectController('a002');
		const setLdac = vi.spyOn(device.client, 'setLdac').mockResolvedValue();
		const spatial = presets.find((preset) => preset.id === 'spatial');
		expect(spatial).toBeDefined();

		device.selectPreset(spatial!);
		expect(device.isSpatialPreset).toBe(true);
		expect(device.isSpatialApplied).toBe(false);
		expect(device.ldacEnabled).toBe(true);

		await device.applyEq();

		expect(setEq).toHaveBeenCalledTimes(1);
		expect(setEq).toHaveBeenLastCalledWith(
			expect.any(Array),
			expect.objectContaining({ saveIndex: 10 })
		);
		expect(device.ldacEnabled).toBe(false);
		expect(device.isSpatialApplied).toBe(true);
		expect(device.eqDirty).toBe(false);
		expect(device.status).toBe('connected');
		expect(setLdac).not.toHaveBeenCalled();
	});

	it('leaves LDAC untouched and stays connected when applying a normal preset', async () => {
		const { device, setEq } = await connectController('a002');
		const setLdac = vi.spyOn(device.client, 'setLdac').mockResolvedValue();
		const pop = presets.find((preset) => preset.id === 'pop');
		expect(pop).toBeDefined();

		await device.applyPreset(pop!);

		expect(setEq).toHaveBeenCalledTimes(1);
		expect(setEq).toHaveBeenLastCalledWith(
			expect.any(Array),
			expect.objectContaining({ saveIndex: 2 })
		);
		expect(device.ldacEnabled).toBe(true);
		expect(device.isSpatialApplied).toBe(false);
		expect(device.eqDirty).toBe(false);
		expect(device.status).toBe('connected');
		expect(device.statusMessage).toBeNull();
		expect(setLdac).not.toHaveBeenCalled();
	});

	it('writes user custom bands to slot 128 with the H3 Pro custom basis', async () => {
		const customController = await connectController('a002');
		await customController.device.applyBands([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

		expect(customController.device.eqTarget).toBe('custom');
		expect(customController.device.eqDeviceIndex).toBe(CUSTOM_EQ_SAVE_INDEX);
		expect(customController.setEq).toHaveBeenCalledTimes(1);
		const [bands, options] = customController.setEq.mock.calls.at(-1)!;
		expect(options).toEqual({
			protocol: 'multi',
			masterGain: customEqBasis.masterGain,
			saveIndex: CUSTOM_EQ_SAVE_INDEX
		});
		expect(bands.map((band) => band.freq)).toEqual(customEqBasis.frequencies);
		expect(bands.map((band) => band.q)).toEqual(customEqBasis.q);
		expect(bands.map((band) => band.eqType)).toEqual(customEqBasis.eqTypes);
		expect(bands.map((band) => band.gain)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});

	it('switches a slider edit after an official preset to the custom basis and slot 128', async () => {
		const rock = presets.find((preset) => preset.id === 'rock');
		expect(rock).toBeDefined();
		const { device, setEq } = await connectController('a002');

		device.selectPreset(rock!);
		expect(device.eqTarget).toBe('official');
		expect(device.eqDeviceIndex).toBe(rock!.deviceIndex);

		device.setBandGain(0, 4.5);

		expect(device.eqPresetId).toBe('custom');
		expect(device.eqTarget).toBe('custom');
		expect(device.eqDeviceIndex).toBe(CUSTOM_EQ_SAVE_INDEX);
		// The first fader movement replaces the official basis entirely; only
		// the ten gain values are carried over positionally.
		expect(device.eqFrequencies).toEqual(customEqBasis.frequencies);
		expect(device.eqQs).toEqual(customEqBasis.q);
		expect(device.eqTypes).toEqual(customEqBasis.eqTypes);
		expect(device.eqGains).toEqual([4.5, ...rock!.gains.slice(1)]);
		expect(device.masterGain).toBe(customEqBasis.masterGain);
		expect(setEq).not.toHaveBeenCalled();

		await device.applyEq();
		expect(setEq).toHaveBeenCalledTimes(1);
		const [bands, options] = setEq.mock.calls.at(-1)!;
		expect(options).toEqual({
			protocol: 'multi',
			masterGain: customEqBasis.masterGain,
			saveIndex: CUSTOM_EQ_SAVE_INDEX
		});
		expect(bands.map((band) => band.freq)).toEqual(customEqBasis.frequencies);
		expect(bands.map((band) => band.q)).toEqual(customEqBasis.q);
		expect(bands.map((band) => band.eqType)).toEqual(customEqBasis.eqTypes);
		expect(bands.map((band) => band.gain)).toEqual([4.5, ...rock!.gains.slice(1)]);
	});

	it('switches a slider edit after a market curve to custom slot 128', async () => {
		const market = marketPresets.find((preset) => preset.id === 'deep-bass');
		expect(market).toBeDefined();
		const { device, setEq } = await connectController('a002');

		device.selectPreset(market!);
		expect(device.eqTarget).toBe('market');
		expect(device.eqDeviceIndex).toBe(MARKET_EQ_SAVE_INDEX);

		device.setBandGain(2, -1.5);

		expect(device.eqTarget).toBe('custom');
		expect(device.eqDeviceIndex).toBe(CUSTOM_EQ_SAVE_INDEX);
		expect(device.eqFrequencies).toEqual(customEqBasis.frequencies);
		expect(device.eqQs).toEqual(customEqBasis.q);
		expect(device.eqTypes).toEqual(customEqBasis.eqTypes);
		expect(device.eqGains).toEqual([
			...market!.gains.slice(0, 2),
			-1.5,
			...market!.gains.slice(3)
		]);
		expect(setEq).not.toHaveBeenCalled();

		await device.applyEq();
		expect(setEq).toHaveBeenCalledTimes(1);
		expect(setEq).toHaveBeenLastCalledWith(
			expect.any(Array),
			expect.objectContaining({ saveIndex: CUSTOM_EQ_SAVE_INDEX })
		);
	});
});

describe('DeviceController explicit H3 Pro EQ apply and reconnect recovery', () => {
	it('keeps slider edits local and dirty without scheduling an EQ write', async () => {
		vi.useFakeTimers();
		const { device, setEq } = await connectController('a002');

		device.setBandGain(0, 4.5);
		device.setMasterGain(2.5);

		expect(device.eqDirty).toBe(true);
		expect(setEq).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(500);
		expect(setEq).not.toHaveBeenCalled();
		expect(device.status).toBe('connected');
	});

	it('cancels a pending non-headphone debounce before an explicit apply', async () => {
		vi.useFakeTimers();
		const { device, setEq } = await connectController('a002');
		device.setDeviceKind('earbuds');

		device.setBandGain(0, 3);
		expect(device.eqDirty).toBe(true);
		expect(setEq).not.toHaveBeenCalled();

		await device.applyEq();
		expect(setEq).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(500);
		expect(setEq).toHaveBeenCalledTimes(1);
		expect(device.eqDirty).toBe(false);
	});

	it('applies once and leaves the link connected when the firmware does not disconnect', async () => {
		vi.useFakeTimers();
		const { device, setEq } = await connectController('a002');
		const reconnect = vi
			.spyOn(device.client, 'reconnect')
			.mockResolvedValue({ name: 'QCY H3 Pro', id: 'test-device' });

		device.setBandGain(1, 3);
		await device.applyEq();

		expect(setEq).toHaveBeenCalledTimes(1);
		expect(device.eqDirty).toBe(false);
		expect(device.status).toBe('connected');
		expect(reconnect).not.toHaveBeenCalled();

		await device.applyEq();
		expect(setEq).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(8_500);
		expect(reconnect).not.toHaveBeenCalled();
		expect(device.status).toBe('connected');
	});

	it('reconnects automatically only if the link actually drops after an EQ write', async () => {
		vi.useFakeTimers();
		const { device, setEq, emit } = await connectController('a002');
		const reconnect = vi
			.spyOn(device.client, 'reconnect')
			.mockResolvedValue({ name: 'QCY H3 Pro', id: 'test-device' });

		device.setBandGain(1, 3);
		await device.applyEq();
		expect(device.status).toBe('connected');
		expect(reconnect).not.toHaveBeenCalled();

		emit({ type: 'state', state: 'disconnected' });
		expect(device.status).toBe('restarting');
		expect(device.statusMessage).toContain('Reconnecting');

		await vi.advanceTimersByTimeAsync(1_000);
		expect(reconnect).toHaveBeenCalledTimes(1);
		expect(device.status).toBe('connected');
		expect(device.statusMessage).toBeNull();
		expect(setEq).toHaveBeenCalledTimes(1);
	});

	it('commits a built-in and a market curve with exactly one EQ frame each', async () => {
		vi.useFakeTimers();
		const pop = presets.find((preset) => preset.id === 'pop');
		const market = marketPresets.find((preset) => preset.id === 'deep-bass');
		expect(pop).toBeDefined();
		expect(market).toBeDefined();

		const presetController = await connectController('a002');
		presetController.device.selectPreset(pop!);
		expect(presetController.device.eqDirty).toBe(true);
		expect(presetController.setEq).not.toHaveBeenCalled();

		await presetController.device.applyPreset(pop!, { apply: true });
		expect(presetController.setEq).toHaveBeenCalledTimes(1);
		expect(presetController.setEq).toHaveBeenLastCalledWith(
			expect.any(Array),
			expect.objectContaining({ saveIndex: 2 })
		);
		expect(presetController.device.eqTarget).toBe('official');
		expect(presetController.device.eqDirty).toBe(false);
		await vi.advanceTimersByTimeAsync(500);
		expect(presetController.setEq).toHaveBeenCalledTimes(1);

		const marketController = await connectController('a002');
		await marketController.device.applyPreset(market!);
		expect(marketController.setEq).toHaveBeenCalledTimes(1);
		const [marketBands, marketOptions] = marketController.setEq.mock.calls.at(-1)!;
		expect(marketOptions).toEqual({
			protocol: 'multi',
			masterGain: customEqBasis.masterGain,
			saveIndex: MARKET_EQ_SAVE_INDEX
		});
		expect(marketBands.map((band) => band.freq)).toEqual(customEqBasis.frequencies);
		expect(marketBands.map((band) => band.q)).toEqual(customEqBasis.q);
		expect(marketBands.map((band) => band.eqType)).toEqual(customEqBasis.eqTypes);
		expect(marketController.device.eqTarget).toBe('market');
		expect(marketController.device.status).toBe('connected');
		await vi.advanceTimersByTimeAsync(500);
		expect(marketController.setEq).toHaveBeenCalledTimes(1);
	});

	it('keeps the last live values and exposes manual reconnect after automatic retries fail', async () => {
		vi.useFakeTimers();
		const { device, setEq, emit } = await connectController('a002');
		const reconnect = vi
			.spyOn(device.client, 'reconnect')
			.mockRejectedValue(new Error('The headphones are still reconnecting.'));

		device.setBandGain(2, 5);
		await device.applyEq();
		emit({ type: 'state', state: 'disconnected' });

		await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000 + 100);

		expect(reconnect).toHaveBeenCalledTimes(3);
		expect(device.status).toBe('error');
		expect(device.canReconnect).toBe(true);
		expect(device.eqGains[2]).toBe(5);
		expect(setEq).toHaveBeenCalledTimes(1);

		reconnect.mockResolvedValueOnce({ name: 'QCY H3 Pro', id: 'test-device' });
		await device.reconnect();

		expect(device.status).toBe('connected');
		expect(device.statusMessage).toBeNull();
		expect(setEq).toHaveBeenCalledTimes(1);
	});
});

describe('DeviceController A002 command notifications', () => {
	it('applies TLV battery and version commands', async () => {
		const device = new DeviceController();
		controllers.push(device);
		const listeners = new Set<(event: ClientEvent) => void>();

		device.client.onEvent = (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		};
		device.client.connect = async () => ({
			name: 'Sanic Headphones-APP',
			id: 'test-device'
		});

		await device.connect();

		expect(device.status).toBe('connected');

		const emit = (event: ClientEvent) => {
			for (const listener of listeners) listener(event);
		};

		emit({
			type: 'command',
			command: { cmd: 47, data: Uint8Array.from([80, 80, 60]) }
		});
		expect(device.battery).toMatchObject({
			left: 80,
			right: 80,
			case: 60,
			hasCase: true
		});

		emit({
			type: 'command',
			command: { cmd: 48, data: Uint8Array.from([1, 2, 3]) }
		});
		expect(device.firmware).toBe('1.2.3');
	});

	it('decodes JL mode values and scenes from command 23 notifications', async () => {
		const device = new DeviceController();
		controllers.push(device);
		const listeners = new Set<(event: ClientEvent) => void>();

		device.client.onEvent = (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		};
		device.client.connect = async () => ({ name: 'QCY H3 Pro', id: 'test-device' });
		vi.spyOn(device.client, 'transport', 'get').mockReturnValue('a002');

		await device.connect();

		const emit = (event: ClientEvent) => {
			for (const listener of listeners) listener(event);
		};

		emit({
			type: 'command',
			command: { cmd: 23, data: Uint8Array.from([3, 1, 4]) }
		});
		expect(device.ancMode).toBe('transparency');
		expect(device.ancLevel).toBe(4);

		emit({
			type: 'command',
			command: { cmd: 23, data: Uint8Array.from([1, 5, 0]) }
		});
		expect(device.ancMode).toBe('anc');
		expect(device.ancScene).toBe('adaptive');
		expect(device.ancLevel).toBe(0);

		emit({
			type: 'command',
			command: { cmd: 23, data: Uint8Array.from([2, 0, 0]) }
		});
		expect(device.ancMode).toBe('normal');
	});
});

describe('DeviceController settings storage', () => {
	afterEach(() => {
		vi.resetModules();
	});

	it('uses the v2 settings key and ignores the legacy earbuds default', async () => {
		const store = new Map<string, string>();
		store.set(
			'qcy-studio.settings.v1',
			JSON.stringify({
				eqProtocol: 'multi',
				lastPresetId: 'balanced',
				deviceKind: 'earbuds',
				reducedMotion: false
			})
		);

		vi.stubGlobal('window', {});
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItem: (key: string) => {
				store.delete(key);
			}
		});
		vi.resetModules();

		const { DeviceController: FreshController } = await import('./device.svelte');
		const device = new FreshController();

		expect(device.kind).toBe('headphones');
		expect(device.name).toBe('QCY H3 Pro');

		device.setDeviceKind('speaker');
		const saved = JSON.parse(store.get('qcy-studio.settings.v2') ?? '{}');
		expect(saved.deviceKind).toBe('speaker');
		expect(store.get('qcy-studio.settings.v1')).toContain('"earbuds"');
	});

	it('restores a saved preset and its official curve data from v2 settings', async () => {
		const store = new Map<string, string>();
		store.set(
			'qcy-studio.settings.v2',
			JSON.stringify({
				eqProtocol: 'legacy',
				lastPresetId: 'classical',
				deviceKind: 'headphones',
				reducedMotion: false
			})
		);

		vi.stubGlobal('window', {});
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItem: (key: string) => {
				store.delete(key);
			}
		});
		vi.resetModules();

		const { DeviceController: FreshController } = await import('./device.svelte');
		const device = new FreshController();
		const classical = presets.find((preset) => preset.id === 'classical')!;

		expect(device.kind).toBe('headphones');
		expect(device.eqProtocol).toBe('legacy');
		expect(device.eqPresetId).toBe('classical');
		expect(device.eqTarget).toBe('official');
		expect(device.eqDeviceIndex).toBe(6);
		expect(device.eqGains).toEqual(classical.gains);
		expect(device.eqFrequencies).toEqual(classical.frequencies);
		expect(device.eqQs).toEqual(classical.q);
		expect(device.eqTypes).toEqual(classical.eqTypes);
		expect(device.masterGain).toBe(-4);
	});

	it('restores a saved market preset to the custom slot', async () => {
		const store = new Map<string, string>();
		store.set(
			'qcy-studio.settings.v2',
			JSON.stringify({
				eqProtocol: 'multi',
				lastPresetId: 'late-night',
				deviceKind: 'headphones',
				reducedMotion: false
			})
		);

		vi.stubGlobal('window', {});
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItem: (key: string) => {
				store.delete(key);
			}
		});
		vi.resetModules();

		const { DeviceController: FreshController } = await import('./device.svelte');
		const device = new FreshController();
		const lateNight = marketPresets.find((preset) => preset.id === 'late-night')!;

		expect(device.eqPresetId).toBe('late-night');
		expect(device.eqTarget).toBe('market');
		expect(device.eqDeviceIndex).toBe(MARKET_EQ_SAVE_INDEX);
		expect(device.eqGains).toEqual(lateNight.gains);
		expect(device.eqFrequencies).toEqual(lateNight.frequencies);
		expect(device.eqQs).toEqual(lateNight.q);
		expect(device.eqTypes).toEqual(lateNight.eqTypes);
		expect(device.masterGain).toBe(0);
	});
});

describe('inferDeviceKind', () => {
	it('detects headphones and speakers from the advertised name', () => {
		expect(inferDeviceKind('QCY H3')).toBe('headphones');
		expect(inferDeviceKind('QCY H3 Pro')).toBe('headphones');
		expect(inferDeviceKind('QCY HT03')).toBe('headphones');
		expect(inferDeviceKind('QCY SP300')).toBe('speaker');
	});

	it('keeps earbuds when both buds and a case are reported', () => {
		expect(
			inferDeviceKind('QCY MeloBuds Pro', {
				left: 80,
				right: 80,
				case: 70,
				leftCharging: false,
				rightCharging: false,
				caseCharging: false,
				hasCase: true
			})
		).toBe('earbuds');
	});

	it('falls back to a single-battery headphone layout when the case is absent', () => {
		expect(
			inferDeviceKind('QCY Mystery Device', {
				left: 80,
				right: null,
				case: null,
				leftCharging: false,
				rightCharging: false,
				caseCharging: false,
				hasCase: false
			})
		).toBe('headphones');
	});
});
