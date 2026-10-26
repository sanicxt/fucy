# Fucy Studio

A QCY companion app for H3 Pro.

A browser control room for the **QCY H3 Pro**. It speaks the QCY **A001** Bluetooth LE protocol recovered from the decompiled QCY app (4.0.7) and the **JieLi RCSP/A002** transport used by JL-family models, and falls back to a fully interactive H3 Pro demo session when no hardware is connected.

Built with SvelteKit 3, Svelte 5, TypeScript, Tailwind CSS v4, shadcn-svelte, Zod, and Bun.

## Run it

```sh
cd web
bun install
bun run dev
```

Open `http://localhost:5173`. The pre-connect hero offers an H3 Pro demo session, so every screen and control works without a device.

Production build:

```sh
bun run build
bun run preview
```

## What works

| Area | Behaviour |
| --- | --- |
| Connection | Web Bluetooth scan, automatic A001 or JL A002 service discovery, notify subscriptions, battery polling, A001 clock sync, and retained-device reconnect without a second chooser |
| Battery | One battery reading for the H3 Pro; raw characteristic on A001, TLV command 47 on A002 |
| Device | Fixed QCY H3 Pro identity, capabilities, protocol (`JL A002 · RCSP`), and single-battery display |
| Firmware | Reads the A001 version characteristic or A002 TLV command 48 and formats `major.minor.patch` |
| Noise control | ANC, Transparency, and Normal modes; five scene-based ANC profiles on the H3 Pro; no 0–100 depth slider |
| Equalizer | Official H3 Pro ten-band curves (30 Hz–11 kHz) plus a custom basis (32 Hz–16 kHz), master gain, animated curve, preset chips, reset, and custom edits; H3 Pro edits stay local until Apply. Normal presets apply without a restart; Spatial Audio (id 10) requires LDAC off |
| Presets | Seven official H3 Pro built-ins (panel ids 1–6/10) plus ten bundled market curves written to slot 126. User slider edits use custom slot 128. Each apply sends exactly one EQ frame. Applying spatial or leaving it may restart the headphones |
| Sound market | Local bundled catalogue plus an optional CORS-enabled remote JSON feed |
| Playback | Play/pause, previous, and next media actions; volume slider on the dashboard |
| Device page | Fixed identity, single battery, ANC/EQ/LDAC/Multipoint chips, firmware, protocol, and reconnect state |
| Feature switches | LDAC and multipoint only; enabling either restarts the H3 Pro and disables the other. Spatial Audio is the EQ preset at id 10 and runs with LDAC off |
| Demo mode | Realistic H3 Pro state and every control usable with no Bluetooth hardware |
| Status recovery | `restarting` and `error` states show the controller message and a Reconnect H3 Pro action without reopening the Bluetooth chooser |

### Connect real hardware

1. Put the QCY device in pairing mode.
2. Click **Connect device** (or **Connect** in the sidebar).
3. Choose **Scan for QCY devices**. The browser filter matches names starting with `QCY`; use **Browse all devices** if yours is named differently.
4. Pick the device in the browser prompt.

The app asks the browser for both the A001 and A002 services, then tries A001 first and falls back to A002 automatically. JL-family devices expose A002 instead of A001, so no separate mode is needed. Web Bluetooth requires a secure context. `localhost` works during development; a deployed site must use HTTPS.

### JL / A002 support

JL-family QCY devices expose the JieLi **A002** service (`0000A002-…`) rather than A001. The data model stays the same: the app wraps the existing QCY TLV blocks in an RCSP `CustomCmd` (opcode `FF`) frame, without the A001 `FF <length>` header:

```text
FE DC BA <flags> FF <lenHi> <lenLo> <seq> <QCY TLV…> EF
```

- `flags` is `C0` for a command that expects a response, `80` for a command without one, and a response uses type `00`.
- `len` is `1 + payload length` (the sequence byte plus the TLV payload), big-endian.
- Responses are `[status][seq][QCY TLV…]`; a nonzero status shows a warning but the payload is still processed.

Battery and firmware arrive only as TLV commands `2F` (left, right, case) and `30` (major, minor, patch), because JL devices do not expose the A001 `00000008`/`00000007` characteristics. A002 also has no legacy `0000000B` EQ characteristic, so EQ writes always use the multi-band command `22`. Clock sync is skipped on A002. There is no OTA support on either transport.

### H3 Pro-only interface

The interface is currently fixed to the **QCY H3 Pro** (JL/A002): one battery, scene-based ANC, a ten-band EQ, LDAC, and multipoint. There is no device-layout switch, no earbuds or speaker demo state, and no separate spatial-audio switch: **Spatial Audio is the official EQ preset at save index 10**, not a toggle.

The controller still keeps compatibility profiles for A001 and future models internally. Those profiles are not exposed by the studio; every route describes and presents the H3 Pro. After connecting, the controller continues to use A001/A002 transport detection and the existing protocol commands, so the H3 Pro keeps working across both transports.

The Device page shows capability chips only for ANC, EQ, LDAC, and multipoint, and renders only the LDAC and multipoint switches. The Noise control route is always part of the studio navigation because the H3 Pro supports ANC.

### QCY H3 Pro profile

The demo session defaults to the **QCY H3 Pro** in the `headphones` layout. It is a single-battery, over-ear device with ANC, ten-band EQ, LDAC, and multipoint; Spatial Audio is the official EQ preset id 10 rather than a switch, and wear detection is not exposed.

- **Noise control:** scene-based rather than a 0–100 depth slider. The five scenes are Adaptive, Noisy, Commute, Indoor, and Wind (`H3_PRO_ANC_SCENES`), and each maps to the packed `mode, scene, level` payload written with TLV command `23` (`0x17`). The packed mode values are JL-specific: 1 ANC, 2 Normal, 3 Transparency. When Transparency or Normal is selected, the scene tiles are replaced by a prompt to switch back to ANC. Scene changes do not restart the headphones.
- **Equalizer:** the seven official H3 Pro built-ins use the panel's exact per-band `eqs`, `freq`, `q`, `iitType`/eqType, and `mastergain`. They are written with multi-band command `34` (`0x22`) using panel ids 1–6 and 10 as the save index. Market curves use the H3 Pro custom basis (32 Hz–16 kHz) and slot **126**. User slider edits also use the custom basis but write to custom slot **128**; the first fader move after a built-in or market curve replaces that curve's frequency/Q/type basis while keeping the ten gains positionally. RCSP writes are chunked for the default 20-byte ATT payload.
- **Custom target maps to slot 128:** the panel's `CustomEQLayout` and `CustomEQNewDialog` paths submit save index 128 directly. `CustomEQEdit2Activity` submits 255, and the device manager normalizes that to 128 when a previous EQ exists (255 is the no-slot sentinel only when none does). The studio always has the official panel state as prior context, so it sends 128 directly. That also avoids the manager's “changed bands + last used params” merge, which would otherwise reintroduce the built-in basis the edit is meant to replace.
- **Custom EQ is local until Apply:** dragging a band or master-gain fader only changes controller state and sets `eqDirty`; it does not call `client.setEq` and does not schedule a debounce. `applyEq()` cancels any pending EQ debounce, sends the current curve exactly once, clears the dirty flag, and ignores repeated calls without changes. Concurrent applies share one in-flight write.
- **Presets and market curves:** `selectPreset(preset)` previews a curve locally and marks it dirty. `applyPreset(preset)` selects and commits it once; `applyPreset(preset, { apply: false })` leaves it local for a later `applyEq()`. The sound market uses the `apply: true` path, so selecting from the market never writes twice.
- **Normal EQ applies without a restart:** current H3 Pro firmware applies ordinary EQ presets immediately. After a successful `applyEq()` the controller stays `connected`. A short grace window watches for an actual firmware disconnect; if one occurs, the controller enters `restarting` (shown as “Reconnecting”), reuses the retained device, and retries after 1 second with 2s/4s backoff. If the link never drops, no reconnect is attempted. A successful normal write never forces `restarting` or sets `ldacEnabled = false`.
- **Spatial Audio is an EQ preset, not a toggle:** it is the official built-in preset at save index **10** (the panel also uses **18**), not a separate `cmd 2D` switch. If the selected spatial preset is applied while LDAC is on, the UI shows “Spatial Audio requires LDAC off” with the official `dialog_tip_ldac` copy and a **Disable LDAC & apply** button. Confirming calls `applyEq()` once, which sends only the spatial EQ frame (`setEQData` semantics). The controller then optimistically sets `ldacEnabled = false`; it never sends a separate command-35 off frame. The headset itself disables LDAC and may reboot. If LDAC is already off, the spatial preset applies directly.
- **Leaving Spatial Audio warns, normal presets do not:** the controller tracks the successfully applied preset separately from the local preview (`appliedPresetId`). Applying a non-spatial preset while Spatial Audio is the last applied preset shows the official `eqRebootTip` warning (“Leaving Spatial Audio”) and then writes once. Applying a normal preset from a normal preset, or any market/custom curve from a non-spatial preset, applies directly with no generic restart dialog. Market curves always write slot **126**; user custom edits always write slot **128**, so neither carries a spatial save index.
- **Reconnect reuses the saved device:** the browser's `BluetoothDevice` is retained across an unexpected disconnect. `client.reconnect()` reconnects GATT, re-discovers A001 or A002, re-subscribes notifications, re-reads initial values, and requests the current settings without calling `requestDevice`, so no chooser appears. Only a manual `disconnect()` forgets the device.
- **If auto-reconnect fails:** the last live values stay in place instead of collapsing to demo data. The controller exposes `status = 'error'`, a readable `statusMessage`, `canReconnect`, and `reconnect()` for a **Reconnect H3 Pro** action. That path also never opens the browser chooser.
- **LDAC and multipoint are mutually exclusive:** enabling one turns the other off and triggers the same restart.
- **Spatial Audio and LDAC state:** the Device page reflects `ldacEnabled` and shows “Spatial Audio active · LDAC off” next to the LDAC switch while `isSpatialApplied` is true. Enabling LDAC is disabled while the spatial preset is active; leave Spatial Audio from the Equalizer first. There is no separate spatial toggle.

### Feature switches

The **Device features** console exposes only the two wireless switches that are relevant to the H3 Pro:

| Switch | Command | Notes |
| --- | --- | --- |
| LDAC | `23` | High-bitrate codec. Enabling it restarts the H3 Pro and disconnects multipoint. Spatial Audio runs with LDAC off and the switch cannot be enabled while spatial is active. |
| Multipoint | `24` | Connects two source devices. Enabling it restarts the H3 Pro and disconnects LDAC. |

Changes are written to the device when connected and update the demo state otherwise. If a write fails, the switch reverts and the page shows the reason. Applying Spatial Audio is done from the Equalizer: it turns LDAC off and may restart the headphones, but it does not send command `35`. Wear detection is not exposed by the H3 Pro studio.

### Browser support

| Browser | Connect to hardware | Demo mode |
| --- | --- | --- |
| Chrome / Edge (desktop, Android) | Yes | Yes |
| Firefox | No Web Bluetooth | Yes |
| Safari / iOS | No Web Bluetooth | Yes |

## Remote sound market

The bundled market presets are always available. To load a remote catalogue, create `web/.env`:

```sh
VITE_EQ_MARKET_URL=https://example.com/qcy-eq-market.json
```

The endpoint must allow CORS and return the validated shape:

```json
{
  "version": 1,
  "presets": [
    {
      "id": "night-drive",
      "name": "Night Drive",
      "tagline": "Soft top end, steady low end.",
      "category": "balanced",
      "author": "Example Studio",
      "accent": "violet",
      "gains": [3, 2, 1, 0, -1, -1, 0, 0, -1, -1],
      "masterGain": 0,
      "tags": ["night", "warm"]
    }
  ]
}
```

Rules enforced by Zod:

- `gains` must contain exactly ten numbers between −15 and +15 dB.
- `category` is one of `balanced`, `bass`, `vocal`, `treble`, `gaming`, `podcast`, `pop`, `rock`, `classical`, `spatial`.
- `accent` is one of `lime`, `cyan`, `violet`, `pink`.
- `name` ≤ 40 characters, `tagline` ≤ 120, `author` ≤ 60, up to six tags.
- Remote presets are forced to `builtIn: false` and written to market slot 126; any `deviceIndex` in the payload is ignored. Their basis is normalized to the H3 Pro custom layout, matching the decompiled market path. Optional `frequencies`, `q`, and `eqTypes` arrays must each contain ten values when supplied.

If the feed is unreachable or invalid, the market falls back to the bundled curves and shows a readable warning.

## Scope and known limits

This is an interoperability client for the generic QCY A001 command stack and the JieLi RCSP/A002 transport used by JL-family models. It intentionally does **not** include:

- Firmware/OTA flashing, including JL-family OTA.
- Key-function, touch-gesture, or head-gesture mapping.
- Watch, health, notification, or companion-app features.
- A002-only vendor extensions beyond the shared QCY TLV commands used by this UI.
- Manufacturer-data scanning. Web Bluetooth cannot read the full QCY advertisement payload, so the app filters by device name or lets you browse all devices.
- Reading the current EQ curve back from every model. The app writes curves and keeps its own state; read-back is model-dependent and not relied on.
- Background reconnection. The tab must stay open for the 4-second post-EQ recovery, the retry/backoff attempts, and the manual **Reconnect H3 Pro** action. Reloading the page loses the browser's retained `BluetoothDevice`.
- Reliable identification of the QCY model or chip family. `device.id` is an opaque browser identifier, not the Bluetooth MAC address, and manufacturer data is unavailable. The controller still infers an internal profile after connecting, but the studio UI is fixed to the H3 Pro.

Some models accept only a subset of the commands. On A001, where a multi-band EQ write fails, the controller can fall back to the legacy `0000000B` EQ characteristic; you can also force the protocol from the equalizer or device page. A002 always uses multi-band command `22` and ignores the legacy option because JL devices do not expose that characteristic.

## Project map

```text
web/
├── src/
│   ├── routes/                 Overview, equalizer, noise, market, device
│   ├── lib/
│   │   ├── ble/
│   │   │   ├── constants.ts    A001/A002 UUIDs, command IDs, RCSP and EQ constants
│   │   │   ├── protocol.ts     A001 TLV and RCSP framing, builders, parsers
│   │   │   └── client.ts       Web Bluetooth GATT client, transport detection and write queue
│   │   ├── device.svelte.ts    Reactive device controller and demo state
│   │   ├── schemas.ts          Zod schemas for presets, settings, battery, device profiles, market
│   │   ├── data/devices.ts     Demo profiles, layout inference, capabilities for earbuds/headphones/speakers
│   │   ├── data/presets.ts     Seven official H3 Pro built-in EQ curves and the custom basis
│   │   ├── data/market-presets.ts  Ten bundled custom market curves
│   │   ├── data/market.ts      Bundled/remote market adapter
│   │   └── components/         Studio rail, curves, console panels, connect dialog, pre-connect hero, MotionGrid
│   └── app.css                 Studio-console tokens, warm surfaces, motion rules
├── src/lib/ble/protocol.test.ts
├── src/lib/ble/client.test.ts
├── src/lib/schemas.test.ts
└── src/lib/device.test.ts
```

## Protocol quick reference

### A001

- Service: `0000A001-0000-1000-8000-00805F9B34FB`
- Command write: `00001001-…`
- Notify/status: `00001002-…`
- Battery read/notify: `00000008-…`
- Version read: `00000007-…`
- Legacy EQ: `0000000B-…`

Outgoing frame:

```text
FF <payload length> <command> <data length> <data…>
```

The payload length counts every byte after the two-byte header. There is no checksum. Multiple command blocks may be concatenated in one frame.

### JL / A002

- Service: `0000A002-0000-1000-8000-00805F9B34FB`
- Command write: `00000001-…`
- Notify: `00000002-…`
- Battery / version: TLV commands `2F` / `30`; there are no raw battery or version characteristics
- EQ: multi-band command `22`; there is no legacy `0000000B` EQ characteristic

RCSP `CustomCmd` (opcode `FF`) frame:

```text
FE DC BA <flags> FF <lenHi> <lenLo> <seq> <QCY TLV…> EF
```

`flags` is `C0` for a command that expects a response, `80` for a command without one, and `00` for a response. `len` is `1 + payload length` (the sequence byte plus the QCY TLV payload), big-endian. Responses carry `[status][seq]` before the TLV payload. There is no checksum. Example battery request:

```text
FE DC BA C0 FF 00 04 00 FE 01 2F EF
```

Core TLV commands used by the app (both transports):

| Command (hex) | Purpose |
| --- | --- |
| `0x06` (6) | Wear / in-ear detection |
| `0x07` (7) | Noise level |
| `0x08` (8) | Volume |
| `0x0C` (12) | Noise mode (1 ANC, 2 Transparency, 3 Normal) |
| `0x3E` (62) | Sync local time (A001 only) |
| `0x17` (23) | ANC setting (mode, scene, level) |
| `0x22` (34) | Multi-band EQ (10 × 7-byte band records) |
| `0x23` (35) | LDAC enable / disable |
| `0x24` (36) | Multipoint enable / disable |
| `0x2D` (45) | Spatial audio enable / disable |
| `0x2F` (47) | Battery (left, right, case) on A002 |
| `0x30` (48) | Firmware version on A002 |
| `0xFE` (254) | Request a setting from the device |

The full reverse-engineering map, including command payloads, family quirks, server control-panel schema, and OTA notes, is in [`../docs/qcy-earbud-feature-map.md`](../docs/qcy-earbud-feature-map.md).

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Vite dev server |
| `bun run build` | Production build |
| `bun run preview` | Preview the build |
| `bun run check` | Svelte + TypeScript diagnostics |
| `bun run test` | Vitest unit tests |
| `bun run test:unit` | Vitest watch mode |

## Notes

This project is not affiliated with QCY. It was built by inspecting a publicly distributed APK for protocol interoperability. The seven built-in EQ curves come from the official H3 Pro panel (model 16759, firmware 1.0.0). The panel's `eqs` values are dB (not 0.1 dB): `SysEQSeted` stores them in `gainsFloat`, and the JL command-34 builder writes `round(gain × 100)` into the i16 field. The H3 Pro's documented −13 dB bass valley and −15 dB 8 kHz notch are preserved. Bundled market curves are original starting points, not QCY presets.
