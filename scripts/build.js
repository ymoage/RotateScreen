/**
 * RotateScreen Build Script
 * Chrome拡張機能のリリース用ZIPを生成
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// package.jsonからバージョンを取得
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
const VERSION = packageJson.version;

// コピーするファイル/フォルダ
const FILES_TO_COPY = [
  'manifest.json',
  'background',
  'content',
  'options',
  'popup',
  'storage',
  'styles',
  'utils',
  'assets'
];

function cleanDist() {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function copyFiles() {
  for (const file of FILES_TO_COPY) {
    const srcPath = path.join(SRC_DIR, file);
    const destPath = path.join(DIST_DIR, file);

    if (fs.existsSync(srcPath)) {
      copyRecursive(srcPath, destPath);
      console.log(`  ✓ ${file}`);
    }
  }
}

function createZip() {
  const zipName = `RotateScreen-v${VERSION}.zip`;
  const zipPath = path.join(ROOT_DIR, zipName);

  // 既存のZIPを削除
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  // プラットフォームに応じたZIP作成
  const isWindows = process.platform === 'win32';

  try {
    if (isWindows) {
      // PowerShellを使用
      execSync(
        `powershell -Command "Compress-Archive -Path '${DIST_DIR}\\*' -DestinationPath '${zipPath}'"`,
        { stdio: 'inherit' }
      );
    } else {
      // Unix系
      execSync(`cd "${DIST_DIR}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
    }
    console.log(`\n✓ Created: ${zipName}`);
    return zipPath;
  } catch (error) {
    console.error('ZIP creation failed:', error.message);
    return null;
  }
}

function build(createZipFile = false) {
  console.log(`\nBuilding RotateScreen v${VERSION}...\n`);

  // 1. distフォルダをクリーン
  console.log('Cleaning dist folder...');
  cleanDist();

  // 2. ファイルをコピー
  console.log('\nCopying files...');
  copyFiles();

  console.log('\n✓ Build complete!');
  console.log(`  Output: ${DIST_DIR}`);

  // 3. ZIPを作成（オプション）
  if (createZipFile) {
    console.log('\nCreating ZIP archive...');
    createZip();
  }

  console.log('\n--- Installation ---');
  console.log('1. Open chrome://extensions');
  console.log('2. Enable "Developer mode"');
  console.log('3. Click "Load unpacked"');
  console.log(`4. Select the "dist" folder`);
}

// コマンドライン引数をチェック
const args = process.argv.slice(2);
const shouldZip = args.includes('--zip');

build(shouldZip);
