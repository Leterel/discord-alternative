# Windows installer verification

## Fresh SofaFunk 0.1.3 verified on 7 October 2026

`SofaFunk Setup 0.1.3-fresh-20261007.exe` completed a real per-user install,
installed application check and native uninstall on Windows 11. This is the
fresh build without the rejected automatic GPU relaunch.

SHA-256: `9aa360b50509f1c295c4befd10d7cc9061052d0caa4df86841227d79d5f0b302`

The guarded test ran 12:38:54–12:39:09 UTC. Both processes exited 0; installed
ASAR, version 0.1.3, isolated profile, preload bridge and renderer security
checks passed. No test shortcuts, installation directory or installation
records remained. The hash-verified installer cache copy was removed.
The existing profile's 68 entries retained identical metadata. No media was
requested. The executable remains unsigned. Upgrade and interactive-wizard
tests are still outside the verified scope.

Run `test/windows-installer.ps1` as below, with this artifact path and explicit
`-ExpectedVersion '0.1.3' -ExpectedSHA256 '<hash above>'`. Evidence is under
`outputs/discord-alternative/20261007-complete/installer` in the workspace.
The original `0x80000003` crash remains unreproduced; this successful run does
not establish that its cause has been fixed.

## SofaFunk 0.1.3 verified on 28 September 2026

The new 0.1.3 installer completed the same real per-user install, isolated
application launch and native uninstall described below. Runtime version 0.1.3,
the installed ASAR, preload bridge and all three renderer security settings
were checked. Installer and uninstaller both exited with code 0. Test shortcuts,
installation records, installation directory and the exact installer cache
were removed. The original user profile's 68 entries retained identical metadata.

Installer SHA-256:
`0e1f02b7a89b77581407ec432acf93e21ac7f15bb959c8b32919fa9a0098eb46`

The successful run was 2026-09-28 15:26:58–15:27:20 UTC. No media was requested.
Evidence is included in the 0.1.3 verification archive under `installer/`.
The same limits below apply: this is not an upgrade or interactive-wizard test.

## Verified on 27 September 2026

The released **SofaFunk 0.1.2 Windows x64 NSIS installer** completed a real
per-user install, application launch and uninstall on Windows 11.

Installer SHA-256:
`079c17bfa96ac24f4237168d8ef2d51c7e9236456a420cf1bc6ceb9bebc11737`

### Results

- Preflight found no existing installation records in either registry view of
  HKCU/HKLM, standard install directories, conflicting shortcuts, updater cache
  or running SofaFunk process.
- Silent installation into a newly created workspace test directory exited with
  code 0. The installation registry entry pointed to that directory.
- Desktop and Start Menu shortcuts both pointed to the installed executable.
- Playwright launched that installed executable using a separate test profile.
  The application loaded its installed `resources/app.asar`, reported version
  0.1.2 and displayed the main UI with the desktop preload bridge present.
- The renderer had Node integration disabled, context isolation enabled and its
  sandbox enabled. `window.require` was unavailable.
- Native silent uninstallation exited with code 0. The installed directory,
  installation/uninstallation registry records and both shortcuts were absent
  afterward. The exact installer cache copy was removed after its hash matched.
- The existing `%APPDATA%/SofaFunk` profile was preserved: metadata for all 68
  entries matched before and after. Profile contents were not inspected. No
  SofaFunk process remained after the test.

No camera, microphone, display capture or remote connection was requested.
The isolated test profile remains in the workspace for inspection. It is not
included in verification archives.

## Reproduce

Run from the repository with PowerShell 7 and dependencies installed:

```powershell
./test/windows-installer.ps1 `
  -Workspace 'C:/path/to/workspace' `
  -Installer 'C:/path/to/SofaFunk Setup 0.1.2.exe' `
  -Node 'C:/Program Files/nodejs/node.exe' `
  -Evidence 'C:/path/to/workspace/outputs/installer-verification'
```

By default the script checks the exact 0.1.2 version and installer hash. For a
later build, pass both `-ExpectedVersion 'major.minor.patch'` and
`-ExpectedSHA256 '<64 hexadecimal characters>'` using that build's independently
recorded checksum. The expected version is restricted to numeric version parts
before being used in the test directory name. The application must report that
same version at runtime.

The script refuses to run when it finds
an existing installation, shortcut, updater cache or SofaFunk process. It uses
a new timestamped directory under `work/install`, never an existing profile.
Installing creates temporary Desktop/Start Menu shortcuts and registry records;
the installed program's own uninstaller removes them at the end.

Evidence: `installer.json` contains installation and cleanup results;
`smoke.json` contains checks performed against the installed application.
The successful run was 2026-09-27 10:41:03–10:41:25 UTC.

## Scope

This verifies the released 0.1.2 installer and per-user installation on this
Windows 11 machine. It does not verify upgrade/migration from a user installation,
per-machine installation, SmartScreen behavior on a fresh machine, or an
interactive installer wizard. The unsuccessful 25 September smoke-test attempt
is retained separately; the passing result above is a fresh run.

Calls across two home networks and native CachyOS/Wayland screensharing still
need their separate end-to-end tests. They are not inferred from an installer
smoke test.
