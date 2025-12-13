# RotateScreen - AI判定機能セットアップガイド（Cloudflare Worker編）

このガイドでは、Cloudflare Worker経由でAI判定機能を使う方法を説明します。

> **簡単に使いたい場合**: Cloudflare Workerのデプロイが不要な「**Gemini API直接**」モードもあります。
> オプション画面で「Gemini API直接」を選択し、[Google AI Studio](https://aistudio.google.com/apikey)で取得したAPIキーを入力するだけで利用できます。

## Cloudflare Worker経由のメリット

- APIキーをローカル（ブラウザ拡張機能）に保存しない
- アクセストークンによる利用制限が可能
- 複数デバイスで同じWorkerを共有可能

## 概要

AI判定機能は以下の仕組みで動作します：

```
[拡張機能] → [Cloudflare Worker] → [Gemini API]
     ↑              ↓
     └──── 回転角度 ←┘
```

1. 拡張機能が動画のフレームをキャプチャ
2. Cloudflare Worker経由でGemini APIに送信
3. AIが画像を分析して必要な回転角度を判定
4. 結果を拡張機能に返す

## 必要なもの

- Googleアカウント（Gemini API用）
- Cloudflareアカウント（無料）
- Node.js（v16以上）

---

## Step 1: Gemini APIキーの取得

### 1-1. Google AI Studioにアクセス

1. [Google AI Studio](https://aistudio.google.com/) にアクセス
2. Googleアカウントでログイン

### 1-2. APIキーを作成

1. 左側メニューから「**Get API key**」をクリック
2. 「**Create API key**」ボタンをクリック
3. プロジェクトを選択（なければ「Create API key in new project」）
4. 生成されたAPIキーをコピーして安全な場所に保存

> **重要**: APIキーは他人に見せないでください。漏洩した場合は再生成してください。

### 1-3. 無料枠について

Gemini APIには無料枠があります（2024年時点）：
- **gemini-2.5-flash**: 無料で利用可能（レート制限あり）

詳細は [Google AI 料金ページ](https://ai.google.dev/pricing) を確認してください。

---

## Step 2: Cloudflareアカウントの作成

### 2-1. アカウント登録

1. [Cloudflare](https://dash.cloudflare.com/sign-up) にアクセス
2. メールアドレスとパスワードを入力
3. メール認証を完了

### 2-2. 無料プランについて

Cloudflare Workersの無料プラン：
- **1日10万リクエスト**まで無料
- 通常の使用では十分な量です

---

## Step 3: Cloudflare Workerのデプロイ

### 3-1. Node.jsの確認

コマンドプロンプト（Windows）またはターミナル（Mac/Linux）を開き、以下を実行：

```bash
node --version
```

`v16.0.0` 以上が表示されればOKです。インストールされていない場合は [Node.js公式サイト](https://nodejs.org/) からダウンロード。

### 3-2. プロジェクトフォルダに移動

```bash
cd cloudflare-worker
```

### 3-3. Wranglerにログイン

```bash
npx wrangler login
```

ブラウザが開くので、Cloudflareアカウントでログインして許可します。

### 3-4. デプロイ実行

```bash
npx wrangler deploy
```

成功すると以下のような出力が表示されます：

```
Uploaded rotate-screen-api
Deployed rotate-screen-api triggers
  https://rotate-screen-api.xxxxx.workers.dev
```

この **URL** をメモしておいてください（後で拡張機能の設定に使います）。

---

## Step 4: Gemini APIキーの設定

### 4-1. Cloudflare Dashboardにアクセス

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. 左側メニューから「**Workers & Pages**」をクリック

### 4-2. Workerを選択

デプロイしたWorker（`rotate-screen-api`）をクリック

### 4-3. 環境変数を設定

1. 上部の「**Settings**」タブをクリック
2. 左側メニューから「**Variables**」をクリック
3. 「**Environment Variables**」セクションで「**Add variable**」をクリック

### 4-4. GEMINI_API_KEYを追加

| 項目 | 入力値 |
|------|--------|
| Variable name | `GEMINI_API_KEY` |
| Value | Step 1で取得したAPIキー |

4. 「**Encrypt**」ボタンをクリック（APIキーを暗号化）
5. 「**Save and deploy**」をクリック

> **Encryptを有効にすると**、APIキーがダッシュボード上で表示されなくなり、セキュリティが向上します。

---

## Step 5: 拡張機能の設定

### 5-1. 設定画面を開く

1. Chromeで拡張機能アイコンを右クリック
2. 「**オプション**」を選択

### 5-2. APIエンドポイントを入力

「**AI判定設定**」セクションで：

| 項目 | 入力値 |
|------|--------|
| APIエンドポイント | `https://rotate-screen-api.xxxxx.workers.dev` |

> **注意**: URLの末尾に `/detect-orientation` は不要です（自動で追加されます）

### 5-3. 保存

設定は自動保存されます。

---

## Step 6: 動作確認

1. YouTubeで動画を開く
2. 動画プレイヤー上で右クリック → 「**AI判定**」を選択
3. 判定結果が表示され、必要に応じて回転が適用されます

---

## オプション設定

### アクセストークン（セキュリティ強化）

自分のWorkerを他人に使われたくない場合：

#### Cloudflare側

1. 環境変数に `ACCESS_TOKEN` を追加
2. 任意の文字列（パスワードのようなもの）を設定

#### 拡張機能側

1. オプション画面で「**アクセストークン**」欄に同じ文字列を入力

---

## トラブルシューティング

### 「API not configured」と表示される

→ 拡張機能のオプションでAPIエンドポイントが設定されているか確認

### 「Gemini API key not configured」エラー

→ Cloudflare Dashboardで `GEMINI_API_KEY` が正しく設定されているか確認

### 「Gemini API error: 429」エラー

→ レート制限に達しました。しばらく待ってから再試行してください

### 「Invalid access token」エラー

→ 拡張機能とCloudflareの `ACCESS_TOKEN` が一致しているか確認

### 判定結果が不安定

→ Gemini APIの応答は完全に一定ではありません。何度か試してみてください

---

## コスト目安

| サービス | 無料枠 | 備考 |
|----------|--------|------|
| Cloudflare Workers | 10万リクエスト/日 | 通常使用では十分 |
| Gemini API | あり | レート制限あり |

通常の個人使用であれば、**完全無料**で運用できます。

---

## 参考リンク

- [Google AI Studio](https://aistudio.google.com/)
- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [Gemini API 料金](https://ai.google.dev/pricing)
