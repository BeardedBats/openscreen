# PL Demo Studio engineering notes

This fork adds a working PL editor and native graphics pipeline. It is a review build, not completion of every requested feature.

## Implementation

- `src/lib/pl-studio` owns the shared palette, real font loading, semantic chyron schema, canvas textures, subtitle serialization, and pause edits.
- Chyrons extend existing clip-anchored annotations. The nested payload has version 1. Existing version 7 projects remain readable.
- Camera and manual zoom motion use project time in both TypeScript and Rust. All three native platform renderers consume chyron motion and click-ring textures. Only Windows was built here.
- Edits use the existing document store and Undo history. AI commands validate arguments and protect manual locks. Each AI pass retains a durable prior document.
- Fork identity is `com.pitcherlist.pldemostudio`; storage is `%APPDATA%/PL Demo Studio`. Automatic update checks, downloads, and installs are disabled. Upstream credits remain.
- Instrument Sans comes from Google Fonts' official repository with its OFL notice. SF Pro Text comes from the supplied archive, with embedded notices and its README retained.

## Windows build

Use Node 22.22.1 and npm 10.9.4, Visual Studio 2022 C++ Build Tools, Rust, CMake, and libclang. Follow the existing pinned FFmpeg SDK instructions. Run `npm ci`, then `npm run build:win`. For packaging without publishing, use `npx electron-builder --win --publish never --config.npmRebuild=false` after building renderer and native helpers.

The local build also stages the CPU Whisper helper and its DLLs. Build it with CMake from `electron/native/whisper-stt`, using `-DOSC_ENABLE_VULKAN=OFF`, then copy the Release helper and backend DLLs into `electron/native/bin/win32-x64`. The normal model download remains required on a fresh installation. The verification profile used the pinned small-q8_0 model.

`npm run dev` opens the app. Set `NO_ELECTRON=1` before that command to run only the development server. Do not launch interactive tests during the user's work without notice.

## Evidence from this iteration

- Both application and test TypeScript checks passed.
- Biome passed with 24 existing warnings. Localization keys passed across 12 non-English locales and seven namespaces.
- Full unit run: 214 files passed; seven files initially failed. All failures were fixed, then eight affected files passed 277 tests. The final PL suite passed eleven tests; the follow-up document-write audit passed. Project-store tests also passed.
- Windows native capture/audio helpers built; 18 audio tests passed. Screen capture and full screen/system-audio/microphone/webcam backend smoke tests passed.
- Rebuilt compositor: 22 Rust region tests passed.
- CPU Whisper transcribed the sample. Its GPU-only assertion was skipped as unsupported; no GPU transcription claim is made.
- Actual Electron renderer interaction verified manual target drawing, Undo/Redo, caption spelling correction without video deletion, save/reopen, and native 1080p export. The sample exported 360 frames over 12 seconds with three chyrons.
- The CLI now accepts current document projects without flattening or migrating away their semantic graphics.
- The NSIS installer built. Its packaged native addon hash matches the rebuilt addon. All five font files are in the app archive. The installer is unsigned and was not installed.

Local evidence lives in ignored `artifacts/pl-studio`. It contains an explicitly fictional dashboard, placeholder presenter, synthetic narration and synthetic cursor telemetry. Private hardware capture files must not be published. Electron page screenshots show editor chrome; the native preview plane is absent from CDP screenshots. Exported frames are the evidence for rendered graphics.

## Unfinished or unverified

- Per-scene screen/camera layout overrides, imported embedded-audio sync offset, and click sounds are not implemented.
- New projects apply the saved Composition default. Feature-specific defaults remain scoped Apply actions.
- The glossary is an editable reference, not an automatic recognition correction engine. Label Section can use the transcript phrase at the playhead. A semantic title suggestion from a multi-phrase selection is not implemented.
- Chyron pointer association is not implemented; existing arrow annotations remain separate. Collision guidance is geometric, not semantic recognition of table content.
- AI uses the existing provider path, but no credential-backed AI pass was run. Provider failures and cancellation still need live verification.
- Native OS input/HUD/tray interaction could not run: the native computer-use surface was unavailable. Backend capture tests do not replace that check. Further app launches were stopped at the user's request.
- Hidden CLI exports passed at 1920×1080, 1080×1920, 1080×1080, and 1080×1350. Portrait review led to a shared short-edge font scaling fix. 4K, macOS, Linux, installer UI, and post-install recording still require verification. New PL-specific prose is English.

No release was published or merged.

## Webpage area recording (Windows)

Select a window, choose **Choose webpage area**, draw around the page, choose **Use this area**, then Share and Record. Numeric percentage fields allow adjustment. This is a manual rectangle, not automatic browser toolbar detection. Keep the window size and toolbar layout unchanged during capture.

The rebuilt WGC helper copies only the selected pixels into the encoder texture. Tabs, address bar, and bookmarks outside that rectangle are excluded before encoding and saving. An inward, even-pixel crop avoids including pixels beyond the selected boundary. Cursor telemetry uses the helper's exact applied rectangle; excluded cursor samples cannot generate click feedback. An old helper fails the capability check instead of recording the whole window. Window resizing stops capture and uses the existing stop/save recovery path.

Verification for this change: both TypeScript checks, lint (24 existing warnings), localization keys, 223 unit test files (2702 passed, four skipped), renderer build, rebuilt Windows helper, 18 audio tests, and a native D3D11 GPU pixel-exclusion test passed. A hidden browser exercised the built picker with a clearly labeled sample image, including drawing and selection payload; no page errors or overflow occurred at 640 by 680. No visible windows were opened. Live browser WGC capture, resize recovery, and cursor alignment during real recording remain unverified: native desktop interaction is unavailable, and visible app launches are paused at the user's request. The native GPU test is not a substitute for that end-to-end pass.
