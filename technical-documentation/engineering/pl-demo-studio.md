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
- Full unit run: 214 files passed; seven files initially failed. All failures were fixed, then eight affected files passed 277 tests. The final PL suite passed nine tests.
- Windows native capture/audio helpers built; 18 audio tests passed. Screen capture and full screen/system-audio/microphone/webcam backend smoke tests passed.
- Rebuilt compositor: 22 Rust region tests passed.
- CPU Whisper transcribed the sample. Its GPU-only assertion was skipped as unsupported; no GPU transcription claim is made.
- Actual Electron renderer interaction verified manual target drawing, Undo/Redo, caption spelling correction without video deletion, save/reopen, and native 1080p export. The sample exported 360 frames over 12 seconds with three chyrons.
- The NSIS installer built. Its packaged native addon hash matches the rebuilt addon. All five font files are in the app archive. The installer is unsigned and was not installed.

Local evidence lives in ignored `artifacts/pl-studio`. It contains an explicitly fictional dashboard, placeholder presenter, synthetic narration and synthetic cursor telemetry. Private hardware capture files must not be published. Electron page screenshots show editor chrome; the native preview plane is absent from CDP screenshots. Exported frames are the evidence for rendered graphics.

## Unfinished or unverified

- Per-scene screen/camera layout overrides, imported embedded-audio sync offset, and click sounds are not implemented.
- Saved feature defaults require Apply; they are not automatically loaded into every new project.
- The glossary is an editable reference, not an automatic recognition correction engine. Label Section opens the editable library; it does not yet derive a suggested title from a selected passage.
- Chyron pointer association is not implemented; existing arrow annotations remain separate. Collision guidance is geometric, not semantic recognition of table content.
- AI uses the existing provider path, but no credential-backed AI pass was run. Provider failures and cancellation still need live verification.
- Native OS input/HUD/tray interaction could not run: the native computer-use surface was unavailable. Backend capture tests do not replace that check. Further app launches were stopped at the user's request.
- Portrait/square/4:5, 4K, macOS, Linux, installer launch, and post-install recording/export require further verification. New PL-specific prose is English.

No release was published or merged.
