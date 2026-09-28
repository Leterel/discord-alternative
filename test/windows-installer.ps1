param(
  [Parameter(Mandatory)][string]$Workspace,
  [Parameter(Mandatory)][string]$Installer,
  [Parameter(Mandatory)][string]$Node,
  [Parameter(Mandatory)][string]$Evidence,
  [ValidateLength(5, 32)]
  [ValidatePattern('\A(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\z')]
  [string]$ExpectedVersion = '0.1.2',
  [ValidatePattern('\A[0-9a-fA-F]{64}\z')]
  [string]$ExpectedSHA256 = '079C17BFA96AC24F4237168D8EF2D51C7E9236456A420CF1BC6CEB9BEBC11737'
)
$ErrorActionPreference = 'Stop'
$guid = 'b7058521-1215-5ac4-a496-ec813e7ac205'
$expectedHash = $ExpectedSHA256.ToUpperInvariant()
$workspaceRoot = [IO.Path]::GetFullPath($Workspace).TrimEnd('\')
$runName = "sofafunk-$ExpectedVersion-verification-" + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')
$ownedRoot = [IO.Path]::GetFullPath((Join-Path $workspaceRoot "work\install\$runName"))
$installRoot = Join-Path $ownedRoot 'SofaFunk'
$profile = Join-Path $ownedRoot 'profile'
$Installer = (Resolve-Path -LiteralPath $Installer).Path
$Evidence = [IO.Path]::GetFullPath($Evidence)
foreach ($owned in @($ownedRoot, $Evidence)) {
  if (-not $owned.StartsWith($workspaceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Test paths must stay inside the workspace.' }
}
if ((Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Installer checksum mismatch.' }
if (Test-Path -LiteralPath $ownedRoot) { throw 'Owned test directory already exists. Refusing reuse.' }

function Get-InstallRecords {
  $records = @()
  foreach ($hive in @('CurrentUser', 'LocalMachine')) {
    foreach ($view in @('Registry64', 'Registry32')) {
      $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::$hive, [Microsoft.Win32.RegistryView]::$view)
      try {
        foreach ($keyName in @("Software\$guid", "Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid")) {
          $key = $base.OpenSubKey($keyName)
          if ($key) {
            try { $records += [ordered]@{ hive=$hive; view=$view; key=$keyName; installLocation=$key.GetValue('InstallLocation'); uninstallString=$key.GetValue('UninstallString') } }
            finally { $key.Dispose() }
          }
        }
        $uninstall = $base.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Uninstall')
        if ($uninstall) {
          try { foreach ($name in $uninstall.GetSubKeyNames()) {
            if ($name -eq $guid) { continue }
            $key = $uninstall.OpenSubKey($name)
            if ($key) { try {
              if ($key.GetValue('DisplayName') -match '(?i)sofa.?funk' -or $key.GetValue('InstallLocation') -match '(?i)sofa.?funk') {
                $records += [ordered]@{hive=$hive; view=$view; key="Uninstall\$name"; installLocation=$key.GetValue('InstallLocation')}
              }
            } finally {$key.Dispose()} }
          } } finally { $uninstall.Dispose() }
        }
      } finally { $base.Dispose() }
    }
  }
  return $records
}

$shortcutPaths = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'SofaFunk.lnk'),
  (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'SofaFunk.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'SofaFunk.lnk'),
  (Join-Path ([Environment]::GetFolderPath('CommonPrograms')) 'SofaFunk.lnk')
)
$cacheRoot = Join-Path $env:LOCALAPPDATA 'sofa-funk-updater'
$collisionPaths = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\SofaFunk'), (Join-Path $env:LOCALAPPDATA 'Programs\sofa-funk'),
  (Join-Path $env:ProgramFiles 'SofaFunk'), (Join-Path ${env:ProgramFiles(x86)} 'SofaFunk'), $cacheRoot
) + $shortcutPaths
if (@(Get-InstallRecords).Count) { throw 'Existing SofaFunk installation registry metadata found. No install attempted.' }
foreach ($candidate in $collisionPaths) { if (Test-Path -LiteralPath $candidate) { throw "Existing install/shortcut/cache found: $candidate. No install attempted." } }
if (Get-Process -Name SofaFunk -ErrorAction SilentlyContinue) { throw 'A SofaFunk process already exists. Refusing to risk its termination by NSIS.' }

function Get-UserProfileMetadata {
  $summary = @()
  foreach ($name in @('SofaFunk', 'sofa-funk')) {
    $root = Join-Path $env:APPDATA $name
    if (Test-Path -LiteralPath $root) {
      $entries = @(Get-ChildItem -LiteralPath $root -Recurse -Force | Sort-Object FullName | ForEach-Object {
        # File contents are never opened. No profile filenames are written to evidence.
        "$(($_.FullName).Substring($root.Length))|$($_.PSIsContainer)|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)"
      })
      $bytes = [Text.Encoding]::UTF8.GetBytes(($entries -join "`n"))
      $summary += [ordered]@{ name=$name; exists=$true; entries=$entries.Count; metadataSHA256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)) }
    } else { $summary += [ordered]@{name=$name; exists=$false} }
  }
  return $summary
}
$profileBefore = @(Get-UserProfileMetadata)
New-Item -ItemType Directory -Path $Evidence -Force | Out-Null
New-Item -ItemType Directory -Path $ownedRoot | Out-Null
$report = [ordered]@{
  version=$ExpectedVersion; installerSHA256=$expectedHash; appGuid=$guid; startedUtc=[DateTime]::UtcNow.ToString('o');
  preflight='No existing installation metadata, shortcuts, cache, standard install paths or running app.';
  installDirectory=$installRoot; profileDirectory=$profile; profileBefore=$profileBefore;
  status='started'; installerExitCode=$null; uninstallerExitCode=$null
}
$installed = $false
try {
  # NSIS /D must be last and unquoted, including when the path contains spaces.
  # Assisted /S skips the finish-page launcher; --force-run is deliberately absent.
  $process = Start-Process -FilePath $Installer -ArgumentList "/S /currentuser /D=$installRoot" -WindowStyle Hidden -PassThru
  if (-not $process.WaitForExit(60000)) { throw "Installer did not exit within 60 seconds (PID $($process.Id)). No process was killed." }
  $report.installerExitCode = $process.ExitCode
  $exe = Join-Path $installRoot 'SofaFunk.exe'
  $uninstaller = Join-Path $installRoot 'Uninstall SofaFunk.exe'
  $installed = (Test-Path -LiteralPath $uninstaller)
  if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $exe) -or -not $installed) { throw 'Installer did not produce a successful complete installation.' }
  $records = @(Get-InstallRecords)
  $report.installedRecords = $records
  if (-not ($records | Where-Object { $_.installLocation -eq $installRoot })) { throw 'Install registry does not match the isolated destination.' }
  $shell = New-Object -ComObject WScript.Shell
  $links = @()
  foreach ($link in $shortcutPaths) { if (Test-Path -LiteralPath $link) {
    $target = $shell.CreateShortcut($link).TargetPath
    if ($target -ne $exe) { throw "New shortcut points outside the test install: $link" }
    $links += [ordered]@{path=$link; target=$target}
  } }
  $report.createdShortcuts = $links
  if ($links.Count -ne 2) { throw 'Expected exactly the user Desktop and Start Menu shortcuts.' }
  if (Get-Process -Name SofaFunk -ErrorAction SilentlyContinue) { throw 'Installer unexpectedly launched SofaFunk before the isolated test.' }
  & $Node (Join-Path $PSScriptRoot 'installed-smoke.mjs') $exe $profile $Evidence $ExpectedVersion
  if ($LASTEXITCODE -ne 0) { throw 'Installed application smoke test failed.' }
  $report.status = 'smoke-passed'
} catch {
  $report.status = 'failed'
  $report.error = $_.Exception.Message
} finally {
  if ($installed) {
    # The native uninstaller recursively removes only the test installation.
    $resolvedInstall = (Resolve-Path -LiteralPath $installRoot).Path
    if ($resolvedInstall -ne $installRoot -or -not $resolvedInstall.StartsWith($ownedRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe uninstall target.' }
    if (Get-Process -Name SofaFunk -ErrorAction SilentlyContinue) { throw 'An app process is still running. Uninstall stopped to preserve it.' }
    $uninstall = Start-Process -FilePath $uninstaller -ArgumentList '/S /currentuser' -WindowStyle Hidden -PassThru
    if (-not $uninstall.WaitForExit(60000)) { throw "Uninstaller did not exit within 60 seconds (PID $($uninstall.Id))." }
    $report.uninstallerExitCode = $uninstall.ExitCode
    # NSIS may hand off to a copied temporary uninstaller before removing itself.
    $until = [DateTime]::UtcNow.AddSeconds(30)
    do {
      $pending = (Test-Path -LiteralPath $installRoot) -or @(Get-InstallRecords).Count -or @($shortcutPaths | Where-Object { Test-Path -LiteralPath $_ }).Count
      if ($pending) { Start-Sleep -Milliseconds 250 }
    } while ($pending -and [DateTime]::UtcNow -lt $until)
  }
  $report.remainingInstall = Test-Path -LiteralPath $installRoot
  $report.remainingRecords = @(Get-InstallRecords)
  $report.remainingShortcuts = @($shortcutPaths | Where-Object { Test-Path -LiteralPath $_ })
  # NSIS leaves its installer download cache behind. Remove only the exact new
  # installer copy after checksum validation; never recursively remove this folder.
  $cacheInstaller = Join-Path $cacheRoot 'installer.exe'
  if (Test-Path -LiteralPath $cacheInstaller) {
    if ((Get-FileHash -LiteralPath $cacheInstaller -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Unexpected cache content; preserving it.' }
    Remove-Item -LiteralPath $cacheInstaller
    if (-not @(Get-ChildItem -LiteralPath $cacheRoot -Force).Count) { Remove-Item -LiteralPath $cacheRoot }
    $report.ownedInstallerCacheRemoved = $true
  }
  $report.profileAfter = @(Get-UserProfileMetadata)
  $report.originalProfileUnchanged = ($profileBefore | ConvertTo-Json -Compress -Depth 5) -eq ($report.profileAfter | ConvertTo-Json -Compress -Depth 5)
  if ($report.status -eq 'smoke-passed' -and $report.uninstallerExitCode -eq 0 -and -not $report.remainingInstall -and -not $report.remainingRecords.Count -and -not $report.remainingShortcuts.Count -and $report.originalProfileUnchanged) { $report.status = 'passed' }
  $report.finishedUtc = [DateTime]::UtcNow.ToString('o')
  $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Evidence 'installer.json') -Encoding utf8
}
$report | ConvertTo-Json -Depth 8
if ($report.status -ne 'passed') { exit 1 }
