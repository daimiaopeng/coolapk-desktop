<#
.SYNOPSIS
    【开发/本地测试工具】为酷安桌面客户端启用或停用 Windows 10 动态磁贴。

.DESCRIPTION
    这是一个**开发工具，不是最终用户的启用方式**。

    动态磁贴由系统外壳渲染，驱动它的 TileUpdateManager 要求调用方具有包标识。
    本脚本给 exe 嵌入 <msix> 身份元素，并注册一个**稀疏身份包**（仅含清单）
    指向应用安装目录 —— 应用本体不搬动、不重打包。

    正式发行方案应当把两件事都移出用户机器：
      - 嵌入 <msix>  →  构建阶段完成（含签名顺序：embed → sign → 打包）
      - 注册身份包    →  由 NSIS 安装器负责

    本脚本要求机器上装有 Windows SDK（提供 mt.exe），这本身就是它**不适合
    作为用户路径**的原因。

    脚本不会修改系统安全设置：不改开发者模式、不向证书存储导入证书。
    注册因策略被拒时，它会说明原因并由用户自行决定。

.PARAMETER InstallDir
    应用安装目录（含 coolapk_desktop.exe）。默认取本仓库的 release 产物目录。

.PARAMETER Unregister
    停用：注销身份包并把 exe 的清单还原为初始状态。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\dev-live-tile.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\dev-live-tile.ps1 -Unregister
#>
param(
    [string]$InstallDir = "",
    [switch]$Unregister
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path "$PSScriptRoot\.."
$PkgName  = "com.coolapk.desktop"
$ExeName  = "coolapk_desktop.exe"
$WorkDir  = Join-Path $env:TEMP "coolapk-live-tile"

if (-not $InstallDir) {
    $InstallDir = Join-Path $RepoRoot "src-tauri\target\release"
}
$InstallDir = [IO.Path]::GetFullPath($InstallDir)
$ExePath    = Join-Path $InstallDir $ExeName

function Write-Step($text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "    $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "    $text" -ForegroundColor Yellow }

# 定位 Windows SDK 的 mt.exe。必须定义在使用之前 —— PowerShell 按执行顺序绑定函数。
function Get-MtExe {
    $kits = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
    if (Test-Path $kits) {
        return Get-ChildItem $kits -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName "x64\mt.exe" } |
            Where-Object { Test-Path $_ } |
            Select-Object -First 1
    }
    return $null
}

# exe 的 Windows 清单在“无任何身份元素”时的初始形态。
# 用于停用与回滚 —— 与 Tauri 构建出的默认清单一致。
function New-BaselineManifest([string]$Path) {
    @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"></assemblyIdentity>
    </dependentAssembly>
  </dependency>
</assembly>
"@ | Set-Content -Path $Path -Encoding UTF8
}

# 含 <msix> 身份元素的清单。
function New-IdentityManifest([string]$Path) {
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
"@ | Set-Content -Path $Path -Encoding UTF8
}

function Set-ExeManifest([string]$MtPath, [string]$ManifestPath, [string]$TargetExe) {
    Get-Process coolapk_desktop -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    & $MtPath -nologo -manifest $ManifestPath "-outputresource:$TargetExe;#1" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "mt.exe 退出码 $LASTEXITCODE（写入 exe 清单失败）" }
}

New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

# 备份路径：回滚素材。内容是该 exe **当前**的清单，恢复它等于撤销本次修改。
$backupManifest = Join-Path $WorkDir "exe-manifest.backup.xml"

# ---------------------------------------------------------------- 停用

if ($Unregister) {
    Write-Step "停用动态磁贴"

    Get-Process coolapk_desktop -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2

    $pkg = Get-AppxPackage -Name $PkgName
    if ($pkg) {
        Remove-AppxPackage -Package $pkg.PackageFullName
        Write-Ok "身份包已注销：$($pkg.PackageFullName)"
    } else {
        Write-Warn "身份包未安装，跳过"
    }

    if (Test-Path $ExePath) {
        $mt = Get-MtExe
        if ($mt) {
            $baseline = Join-Path $WorkDir "exe-manifest.baseline.xml"
            New-BaselineManifest $baseline
            Set-ExeManifest $mt $baseline $ExePath
            Write-Ok "exe 清单已还原为初始状态（已移除 <msix>）"
        } else {
            Write-Warn "未找到 mt.exe，exe 中的 <msix> 元素未移除（不影响正常使用）"
        }
    }

    Write-Host ""
    Write-Host "动态磁贴已停用。exe 本身未受影响，可继续正常使用。" -ForegroundColor Green
    exit 0
}

# ---------------------------------------------------------------- 前置检查
# 全部只读。任一项不满足都在**修改任何东西之前**中止。

Write-Step "检查前置条件"

if (-not (Test-Path $ExePath)) {
    throw "找不到 $ExePath。请先构建（npm run tauri build -- --no-bundle），或用 -InstallDir 指定安装目录。"
}
Write-Ok "应用：$ExePath"

$mt = Get-MtExe
if (-not $mt) { throw "找不到 mt.exe。需要安装 Windows SDK（含 Windows Kits\10\bin）。" }
Write-Ok "mt.exe：$mt"

$assetSource = Join-Path $RepoRoot "msix\Assets"
if (-not (Test-Path $assetSource)) { throw "找不到磁贴资源目录：$assetSource" }

# 系统版本：稀疏身份包需要 Windows 10 2004（19041）及以上。
# **Windows 11（22000+）也一并拒绝** —— Win11 已移除动态磁贴，
# 注册了身份包也不会有磁贴可显示，只会产生无用请求与永不停止的定时刷新。
$build = [int](Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion").CurrentBuildNumber
if ($build -lt 19041) {
    throw "当前系统版本 $build 过低。稀疏身份包需要 Windows 10 2004（19041）或更高。"
}
if ($build -ge 22000) {
    Write-Host ""
    Write-Host "当前系统为 Windows 11（版本 $build），已移除动态磁贴。" -ForegroundColor Yellow
    Write-Host "本功能在 Windows 11 上无意义：即使注册成功也不会有磁贴可显示。" -ForegroundColor Yellow
    Write-Host "应用本身不受影响，可正常使用。" -ForegroundColor Gray
    exit 0
}
Write-Ok "系统版本：$build（Windows 10）"

# 身份包清单：从 tauri.conf.json 取版本戳写。
# 清单里的是基准值，实际注册必须用应用当前版本 ——
# 否则升级应用后会注册出一个版本号与二进制不符的包。
$tauriConf = Join-Path $RepoRoot "src-tauri\tauri.conf.json"
$appVersion = (Get-Content $tauriConf -Raw | ConvertFrom-Json).version
if ($appVersion -notmatch '^\d+\.\d+(\.\d+)?$') {
    throw "无法从 tauri.conf.json 解析版本号：'$appVersion'"
}
$parts = @($appVersion.Split('.') + @('0', '0', '0'))[0..3]
$pkgVersion = ($parts -join '.')

$stampDir = Join-Path $WorkDir "identity"
New-Item -ItemType Directory -Force -Path $stampDir | Out-Null
$pkgManifest = Join-Path $stampDir "AppxManifest.xml"
(Get-Content (Join-Path $RepoRoot "msix\AppxManifest.xml") -Raw -Encoding UTF8) `
    -replace '(<Identity[^>]*?Version=")[^"]*(")', "`${1}$pkgVersion`${2}" `
    | Set-Content -Path $pkgManifest -Encoding UTF8

# 验证戳写后的清单是合法 XML —— 在动 exe 之前就发现问题。
try { [xml]$null = Get-Content $pkgManifest -Raw -Encoding UTF8 }
catch { throw "身份包清单不是合法 XML（$pkgManifest）：$($_.Exception.Message)" }

Write-Ok "身份包清单已就绪，版本 $pkgVersion（取自 tauri.conf.json 的 $appVersion）"

# ---------------------------------------------------------------- 磁贴资源
# 刻意排在修改 exe **之前**：稀疏包不含内容，外壳从外部位置取图，
# 资源缺失会让磁贴无图。这一步失败应当在任何改动发生前中止，
# 而不是等 exe 已经改完、注册也做完之后才发现。

$assetTarget = Join-Path $InstallDir "Assets"
$expectedAssets = @(
    "Square44x44Logo.png", "Square71x71Logo.png", "Square150x150Logo.png",
    "Wide310x150Logo.png", "Square310x310Logo.png", "StoreLogo.png"
)

New-Item -ItemType Directory -Force -Path $assetTarget | Out-Null
foreach ($name in $expectedAssets) {
    $src = Join-Path $assetSource $name
    if (-not (Test-Path $src)) { throw "磁贴资源缺失：$src" }
    # 不用 -ErrorAction SilentlyContinue：复制失败必须中止
    Copy-Item $src (Join-Path $assetTarget $name) -Force
}

# 复制后逐个校验 —— 目录存在不代表六张图都在（例如被占用导致部分失败）
$missing = @($expectedAssets | Where-Object { -not (Test-Path (Join-Path $assetTarget $_)) })
if ($missing.Count -gt 0) {
    throw "磁贴资源复制后校验失败，缺失：$($missing -join ', ')"
}
Write-Ok "磁贴资源已就位并通过校验（$($expectedAssets.Count) 个文件）"

# ---------------------------------------------------------------- 备份
# 到这一步为止什么都没改。备份当前清单，作为后续任一步失败的回滚素材。

if (Test-Path $ExePath) {
    & $mt -nologo "-inputresource:${ExePath};#1" "-out:$backupManifest" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "无法导出当前 exe 清单，改为写入基准清单作为回滚素材"
        New-BaselineManifest $backupManifest
    }
}

# ---------------------------------------------------------------- 修改 exe

Write-Step "为 exe 嵌入身份元素"

$identityManifest = Join-Path $WorkDir "identity.manifest"
New-IdentityManifest $identityManifest

try {
    Set-ExeManifest $mt $identityManifest $ExePath
} catch {
    # exe 写入失败，用备份还原后中止。此时尚未触碰任何注册。
    & $mt -nologo -manifest $backupManifest "-outputresource:${ExePath};#1" | Out-Null
    throw "嵌入身份元素失败，exe 清单已回滚：$($_.Exception.Message)"
}
Write-Ok "已嵌入 <msix>（packageName=com.coolapk.desktop, applicationId=CoolapkDesktop）"

# ---------------------------------------------------------------- 注册

Write-Step "注册稀疏身份包"

# 刻意**不先卸载旧的注册**。
# 实测：对已注册的同一个包再次 -Register 会原地更新成功，无需先移除。
# 这样注册失败时旧注册仍然完好，不会出现“旧的没了、新的也没成”。
try {
    Add-AppxPackage -Register $pkgManifest -ExternalLocation $InstallDir -ErrorAction Stop
} catch {
    Write-Host ""
    Write-Host "注册失败，正在回滚 exe 清单…" -ForegroundColor Yellow
    & $mt -nologo -manifest $backupManifest "-outputresource:${ExePath};#1" | Out-Null
    Write-Host "exe 清单已恢复；原有注册未被改动。" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  原因：$($_.Exception.Message)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "最可能的情况是未启用开发者模式 —— 未签名的包需要它才能注册。" -ForegroundColor Yellow
    Write-Host "本脚本刻意不替你修改这个系统设置，它会影响整台机器的安装策略。" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "如果你接受，可以自己开启：" -ForegroundColor Yellow
    Write-Host "  设置 → 更新和安全 → 开发者选项 → 开发人员模式" -ForegroundColor White
    Write-Host "  或按 Win+R 粘贴： ms-settings:developers" -ForegroundColor White
    Write-Host ""
    Write-Host "开启后重新运行本脚本即可。该开关可逆，关掉即恢复。" -ForegroundColor Gray
    exit 1
}

$pkg = Get-AppxPackage -Name $PkgName
Write-Ok "已注册：$($pkg.PackageFullName)"

Write-Host ""
Write-Host "动态磁贴已启用。" -ForegroundColor Green
Write-Host ""
Write-Host "接下来：" -ForegroundColor Cyan
Write-Host "  1. 打开开始菜单，搜索「酷安」" -ForegroundColor White
Write-Host "  2. 右键条目 → 固定到开始屏幕" -ForegroundColor White
Write-Host "  3. 磁贴会显示真实酷安内容，最多 5 条自动轮播" -ForegroundColor White
Write-Host ""
Write-Host "数据源可在 设置 → 启动 → 磁贴数据源 中切换。" -ForegroundColor Gray
Write-Host "停用：本脚本加 -Unregister。" -ForegroundColor Gray
