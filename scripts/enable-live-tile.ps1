<#
.SYNOPSIS
    为酷安桌面客户端启用 Windows 10 动态磁贴。

.DESCRIPTION
    动态磁贴由系统外壳渲染，驱动它的 TileUpdateManager 要求调用方具有
    **包标识（package identity）**。未打包的 Win32 exe 调用只会得到
    0x80070490，因此本脚本做两件事：

      1. 给 exe 嵌入 <msix> 身份元素（用 Windows SDK 的 mt.exe）
      2. 注册一个**稀疏身份包**（仅含清单，几 KB）指向 exe 所在目录

    应用本体不搬动、不重打包 —— exe 仍是常规安装形态，磁贴只是叠加一层身份。

    **本脚本不会修改你的系统安全设置。** 它不改动开发者模式开关、
    不向证书存储导入任何证书。如果注册因策略被拒，脚本会告诉你怎么回事，
    由你自己决定要不要开。

.PARAMETER InstallDir
    应用安装目录（含 coolapk_desktop.exe）。默认取本仓库的 release 产物目录。

.PARAMETER Unregister
    卸载身份包并移除 exe 中的 <msix> 元素，恢复原状。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\enable-live-tile.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\enable-live-tile.ps1 -Unregister
#>
param(
    [string]$InstallDir = "",
    [switch]$Unregister
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path "$PSScriptRoot\.."
$PkgName  = "com.coolapk.desktop"
$ExeName  = "coolapk_desktop.exe"

if (-not $InstallDir) {
    $InstallDir = Join-Path $RepoRoot "src-tauri\target\release"
}
$InstallDir = [IO.Path]::GetFullPath($InstallDir)
$ExePath    = Join-Path $InstallDir $ExeName

function Write-Step($text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "    $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "    $text" -ForegroundColor Yellow }

# 定位 Windows SDK 的 mt.exe（用于给 exe 嵌入 <msix> 身份元素）。
# 必须定义在使用之前 —— PowerShell 按执行顺序绑定函数。
function Get-MtExe {
    $kits = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
    if (Test-Path $kits) {
        $found = Get-ChildItem $kits -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName "x64\mt.exe" } |
            Where-Object { Test-Path $_ } |
            Select-Object -First 1
        if ($found) { return $found }
    }
    return $null
}

# ---------------------------------------------------------------- 反注册

if ($Unregister) {
    Write-Step "卸载动态磁贴支持"

    Get-Process coolapk_desktop -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2

    $pkg = Get-AppxPackage -Name $PkgName
    if ($pkg) {
        Remove-AppxPackage -Package $pkg.PackageFullName
        Write-Ok "身份包已卸载：$($pkg.PackageFullName)"
    } else {
        Write-Warn "身份包未安装，跳过"
    }

    if (Test-Path $ExePath) {
        $mt = Get-MtExe
        if ($mt) {
            $tmp = Join-Path $env:TEMP "coolapk-restore.manifest"
            # 还原为只含 Common-Controls 依赖的最小清单
            @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"></assemblyIdentity>
    </dependentAssembly>
  </dependency>
</assembly>
"@ | Set-Content -Path $tmp -Encoding UTF8
            & $mt -nologo -manifest $tmp "-outputresource:$ExePath;#1" | Out-Null
            Remove-Item $tmp -Force -ErrorAction SilentlyContinue
            Write-Ok "已移除 exe 中的 <msix> 身份元素"
        }
    }
    Write-Host ""
    Write-Host "动态磁贴已停用。exe 本身未受影响，可继续正常使用。" -ForegroundColor Green
    exit 0
}

# ---------------------------------------------------------------- 前置检查

Write-Step "检查前置条件"

if (-not (Test-Path $ExePath)) {
    throw "找不到 $ExePath。请先构建（npm run tauri build -- --no-bundle），或用 -InstallDir 指定安装目录。"
}
Write-Ok "应用：$ExePath"

$mt = Get-MtExe
if (-not $mt) { throw "找不到 mt.exe。需要安装 Windows SDK（含 Windows Kits\10\bin）。" }
Write-Ok "mt.exe：$mt"

# 磁贴资源必须与 exe 部署在一起 —— 稀疏包不含内容，外壳从外部位置取图。
$assetSource = Join-Path $RepoRoot "msix\Assets"
$assetTarget = Join-Path $InstallDir "Assets"
if (-not (Test-Path $assetSource)) { throw "找不到磁贴资源目录：$assetSource" }
New-Item -ItemType Directory -Force -Path $assetTarget | Out-Null
Copy-Item "$assetSource\*.png" $assetTarget -Force
Write-Ok "磁贴资源已就位：$assetTarget"

# 系统版本：AllowExternalContent 需要 Windows 10 2004（19041）及以上
$build = [int](Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion").CurrentBuildNumber
if ($build -lt 19041) {
    throw "当前系统版本 $build 过低。稀疏身份包（外部位置）需要 Windows 10 2004（19041）或更高。"
}
Write-Ok "系统版本：$build"

# ---------------------------------------------------------------- 嵌入 <msix>

Write-Step "为 exe 嵌入身份元素"

$manifest = Join-Path $env:TEMP "coolapk-msix-identity.manifest"
@"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"></assemblyIdentity>
    </dependentAssembly>
  </dependency>
  <msix xmlns="urn:schemas-microsoft-com:msix.v1"
        publisher="CN=coolapk-desktop-dev"
        packageName="com.coolapk.desktop"
        applicationId="CoolapkDesktop" />
</assembly>
"@ | Set-Content -Path $manifest -Encoding UTF8

Get-Process coolapk_desktop -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

& $mt -nologo -manifest $manifest "-outputresource:$ExePath;#1"
if ($LASTEXITCODE -ne 0) { throw "嵌入身份元素失败（mt.exe 退出码 $LASTEXITCODE）" }
Remove-Item $manifest -Force -ErrorAction SilentlyContinue
Write-Ok "已嵌入 <msix>（packageName=com.coolapk.desktop, applicationId=CoolapkDesktop）"

# ---------------------------------------------------------------- 注册

Write-Step "注册稀疏身份包"

# 身份包的 Version 必须与应用当前版本一致，否则升级应用后会注册出
# 一个版本号与二进制不符的包。清单里的是基准值，这里按 tauri.conf.json 戳写。
$tauriConf = Join-Path $RepoRoot "src-tauri\tauri.conf.json"
$appVersion = (Get-Content $tauriConf -Raw | ConvertFrom-Json).version
if ($appVersion -notmatch '^\d+\.\d+(\.\d+)?$') {
    throw "无法从 tauri.conf.json 解析版本号：'$appVersion'"
}
$parts = @($appVersion.Split('.') + @('0', '0', '0'))[0..3]
$pkgVersion = ($parts -join '.')

$sourceManifest = Join-Path $RepoRoot "msix\AppxManifest.xml"
$stampDir = Join-Path $env:TEMP "coolapk-sparse-identity"
New-Item -ItemType Directory -Force -Path $stampDir | Out-Null
$pkgManifest = Join-Path $stampDir "AppxManifest.xml"

(Get-Content $sourceManifest -Raw -Encoding UTF8) `
    -replace '(<Identity[^>]*?Version=")[^"]*(")', "`${1}$pkgVersion`${2}" `
    | Set-Content -Path $pkgManifest -Encoding UTF8

Write-Ok "身份包版本已戳为 $pkgVersion（取自 tauri.conf.json 的 $appVersion）"
$existing = Get-AppxPackage -Name $PkgName
if ($existing) {
    Write-Warn "已存在注册，先卸载：$($existing.PackageFullName)"
    Remove-AppxPackage -Package $existing.PackageFullName
    Start-Sleep -Seconds 3
}

try {
    Add-AppxPackage -Register $pkgManifest -ExternalLocation $InstallDir -ErrorAction Stop
} catch {
    Write-Host ""
    Write-Host "注册失败。" -ForegroundColor Red
    Write-Host ""
    Write-Host "  原因：$($_.Exception.Message)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "最可能的情况是**未启用开发者模式**。未签名的包需要它才能注册。" -ForegroundColor Yellow
    Write-Host "本脚本刻意不替你修改这个系统设置 —— 它会影响整台机器的安装策略。" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "如果你接受，可以自己开启：" -ForegroundColor Yellow
    Write-Host "  设置 → 更新和安全 → 开发者选项 → 开发人员模式" -ForegroundColor White
    Write-Host "  或按 Win+R 粘贴： ms-settings:developers" -ForegroundColor White
    Write-Host ""
    Write-Host "开启后重新运行本脚本即可。它是可逆的开关，关掉即恢复。" -ForegroundColor Gray
    Write-Host "完成后可再跑一次本脚本，多余步骤会自动跳过。" -ForegroundColor Gray
    exit 1
}

$pkg = Get-AppxPackage -Name $PkgName
Write-Ok "已注册：$($pkg.PackageFullName)"

Write-Host ""
Write-Host "动态磁贴已启用。" -ForegroundColor Green
Write-Host ""
Write-Host "接下来：" -ForegroundColor Cyan
Write-Host "  1. 打开开始菜单，搜索「酷安」" -ForegroundColor White
Write-Host "  2. 找到条目并在开始屏幕上固定（右键 → 固定到开始屏幕）" -ForegroundColor White
Write-Host "  3. 磁贴会显示真实酷安内容，最多 5 条自动轮播" -ForegroundColor White
Write-Host ""
Write-Host "数据源可在 设置 → 启动 → 磁贴数据源 中切换。" -ForegroundColor Gray
Write-Host "卸载：本脚本加 -Unregister。" -ForegroundColor Gray
