# RotateScreen

YouTube動画を任意の角度に回転表示するChrome拡張機能です。

横向きで撮影された動画を正しい向きで視聴できます。

## 機能

- 動画を90度、180度、270度に回転
- キーボードショートカット（Rキー）で素早く回転
- 動画プレイヤー上のボタンで操作
- ボタン表示位置を選択可能（オーバーレイ / YouTubeコントロールバー）
- 動画ごとの回転設定を記憶
- 動画切り替え時の回転リセット設定

## インストール方法

### 方法1: Releasesからダウンロード（推奨）

1. [Releases](https://github.com/ymoage/RotateScreen/releases)から最新の`RotateScreen-vX.X.X.zip`をダウンロード
2. ZIPファイルを解凍
3. Chromeで `chrome://extensions` を開く
4. 右上の「デベロッパーモード」をONにする
5. 「パッケージ化されていない拡張機能を読み込む」をクリック
6. 解凍したフォルダを選択

### 方法2: ソースコードから直接インストール

1. このリポジトリをクローンまたはダウンロード
2. Chromeで `chrome://extensions` を開く
3. 右上の「デベロッパーモード」をONにする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. **`src`フォルダ**を選択（リポジトリのルートではなく`src`フォルダを選んでください）

### 方法3: ビルドして使用

**PowerShell (Windows):**
```powershell
# リポジトリをクローン
git clone https://github.com/ymoage/RotateScreen.git
cd RotateScreen

# ビルド（distフォルダに出力）
.\scripts\build.ps1

# ZIP作成も含める場合
.\scripts\build.ps1 -Zip
```

**Node.js:**
```bash
npm run build      # distフォルダに出力
npm run package    # ZIP作成も含める
```

ビルド後、`dist`フォルダまたは生成された`RotateScreen-vX.X.X.zip`を使用してインストールできます。

## 使い方

1. YouTubeで動画を開く
2. 動画プレイヤーの左上に表示される回転ボタンをクリック、または**Rキー**を押す
3. クリックするたびに90度ずつ回転します
4. ダブルクリックで回転をリセット

## 設定

拡張機能アイコンを右クリック → 「オプション」で設定画面を開けます。

- **ボタンの表示位置**: オーバーレイ（動画左上）またはコントロールバー（YouTube UIに統合）
- **ショートカットキー**: Rキー / Alt+R / Ctrl+Shift+R から選択
- **別の動画に切り替えたときに回転をリセット**: オン/オフ
- **動画ごとの回転設定を記憶**: オン/オフ

## ライセンス

MIT License
