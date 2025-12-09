# RotateScreen Build Script
# Chrome拡張機能のリリース用ZIPを生成

param(
    [switch]$Zip
)

$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$SRC_DIR = Join-Path $ROOT_DIR "src"
$DIST_DIR = Join-Path $ROOT_DIR "dist"

# package.jsonからバージョンを取得
$packageJsonPath = Join-Path $ROOT_DIR "package.json"
$packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
$VERSION = $packageJson.version

# コピーするファイル/フォルダ
$FILES_TO_COPY = @(
    "manifest.json",
    "background",
    "content",
    "options",
    "popup",
    "storage",
    "styles",
    "utils",
    "assets"
)

function Clean-Dist {
    if (Test-Path $DIST_DIR) {
        Remove-Item -Path $DIST_DIR -Recurse -Force
    }
    New-Item -ItemType Directory -Path $DIST_DIR -Force | Out-Null
}

function Copy-Files {
    foreach ($file in $FILES_TO_COPY) {
        $srcPath = Join-Path $SRC_DIR $file
        $destPath = Join-Path $DIST_DIR $file

        if (Test-Path $srcPath) {
            if (Test-Path $srcPath -PathType Container) {
                Copy-Item -Path $srcPath -Destination $destPath -Recurse
            } else {
                Copy-Item -Path $srcPath -Destination $destPath
            }
            Write-Host "  + $file" -ForegroundColor Green
        }
    }
}

function Create-Zip {
    $zipName = "RotateScreen-v$VERSION.zip"
    $zipPath = Join-Path $ROOT_DIR $zipName

    # 既存のZIPを削除
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }

    # ZIP作成
    Compress-Archive -Path "$DIST_DIR\*" -DestinationPath $zipPath
    Write-Host "`n+ Created: $zipName" -ForegroundColor Cyan
    return $zipPath
}

# メイン処理
Write-Host "`nBuilding RotateScreen v$VERSION...`n" -ForegroundColor Cyan

# 1. distフォルダをクリーン
Write-Host "Cleaning dist folder..."
Clean-Dist

# 2. ファイルをコピー
Write-Host "`nCopying files..."
Copy-Files

Write-Host "`n+ Build complete!" -ForegroundColor Green
Write-Host "  Output: $DIST_DIR"

# 3. ZIPを作成（オプション）
if ($Zip) {
    Write-Host "`nCreating ZIP archive..."
    Create-Zip
}

Write-Host "`n--- Installation ---" -ForegroundColor Yellow
Write-Host "1. Open chrome://extensions"
Write-Host "2. Enable 'Developer mode'"
Write-Host "3. Click 'Load unpacked'"
Write-Host "4. Select the 'dist' folder"
