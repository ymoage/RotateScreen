/**
 * RotateScreen - Cloudflare Worker
 * Gemini API経由で画像の向きを判定
 *
 * 環境変数（Cloudflare Dashboardで設定）:
 * - GEMINI_API_KEY: Gemini APIキー（必須）
 * - GEMINI_MODEL: 使用するモデル（オプション、デフォルト: gemini-2.0-flash）
 * - ACCESS_TOKEN: アクセストークン（オプション、設定すると認証が有効になる）
 * - ALLOWED_ORIGINS: 許可するオリジン（カンマ区切り、オプション）
 */

// デフォルトモデル
const DEFAULT_MODEL = 'gemini-2.0-flash';

// 向き判定用プロンプト
const ORIENTATION_PROMPT = `Image orientation check. Output ONLY a number.

Where should the TOP of this image be?
- Current top is correct → 0
- Left side should be top → 90
- Bottom should be top (upside down) → 180
- Right side should be top → 270

Output only: 0, 90, 180, or 270`;

// 有効な回転角度
const VALID_ROTATIONS = [0, 90, 180, 270];

// レート制限設定（1分あたりのリクエスト数）
const RATE_LIMIT_PER_MINUTE = 30;

/**
 * レート制限チェック（KVストレージ使用時）
 * @param {string} clientIP - クライアントIP
 * @param {KVNamespace} kv - KVストレージ
 * @returns {Promise<boolean>} 制限を超えていればtrue
 */
async function isRateLimited(clientIP, kv) {
  if (!kv) return false;

  const key = `rate:${clientIP}`;
  const now = Math.floor(Date.now() / 60000); // 分単位のタイムスタンプ
  const data = await kv.get(key, 'json');

  if (!data || data.minute !== now) {
    // 新しい分なのでカウントをリセット
    await kv.put(key, JSON.stringify({ minute: now, count: 1 }), { expirationTtl: 120 });
    return false;
  }

  if (data.count >= RATE_LIMIT_PER_MINUTE) {
    return true;
  }

  // カウントを増加
  await kv.put(key, JSON.stringify({ minute: now, count: data.count + 1 }), { expirationTtl: 120 });
  return false;
}

/**
 * CORSヘッダーを設定
 * @param {Headers} headers - レスポンスヘッダー
 * @param {string} origin - リクエスト元オリジン
 * @param {string} allowedOrigins - 許可するオリジン（カンマ区切り）
 */
function setCorsHeaders(headers, origin, allowedOrigins) {
  // 許可するオリジンのリスト
  const allowed = allowedOrigins
    ? allowedOrigins.split(',').map(o => o.trim())
    : ['chrome-extension://*', 'https://www.youtube.com'];

  // オリジンのチェック
  const isAllowed = allowed.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(origin);
    }
    return pattern === origin;
  });

  if (isAllowed || !origin) {
    headers.set('Access-Control-Allow-Origin', origin || '*');
  } else {
    // 許可されていないオリジンでもYouTubeとChrome拡張は許可
    if (origin.startsWith('chrome-extension://') || origin === 'https://www.youtube.com') {
      headers.set('Access-Control-Allow-Origin', origin);
    }
  }

  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Access-Token');
  headers.set('Access-Control-Max-Age', '86400');
}

/**
 * エラーレスポンスを生成
 * @param {string} message - エラーメッセージ
 * @param {number} status - HTTPステータスコード
 * @param {string} origin - リクエスト元オリジン
 * @param {object} env - 環境変数
 * @returns {Response}
 */
function errorResponse(message, status, origin, env) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  setCorsHeaders(headers, origin, env.ALLOWED_ORIGINS);

  return new Response(JSON.stringify({
    success: false,
    error: message
  }), { status, headers });
}

/**
 * Gemini APIで画像の向きを判定
 * @param {string} imageData - Base64エンコードされた画像データ
 * @param {string} apiKey - Gemini APIキー
 * @param {string} model - 使用するモデル名
 * @returns {Promise<object>} 判定結果
 */
async function detectOrientation(imageData, apiKey, model) {
  // data:image/jpeg;base64, プレフィックスを除去
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

  // MIMEタイプを取得
  const mimeMatch = imageData.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  // Gemini API リクエスト
  console.log('Using model:', model);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: ORIENTATION_PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();

  // デバッグ: レスポンス構造を確認
  console.log('Gemini full response:', JSON.stringify(result, null, 2));

  // 候補の状態をチェック
  const candidate = result.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const safetyRatings = candidate?.safetyRatings;

  // コンテンツブロックの確認
  if (finishReason === 'SAFETY') {
    console.log('Gemini blocked due to safety:', safetyRatings);
    return {
      success: false,
      rotation: null,
      confidence: 0,
      reason: 'コンテンツがブロックされました（安全性フィルター）',
      debug: { finishReason, safetyRatings }
    };
  }

  // レスポンスから回転角度を抽出
  // Gemini 2.5では応答構造が異なる可能性があるため複数パスをチェック
  let text = '';
  if (candidate?.content?.parts?.[0]?.text) {
    text = candidate.content.parts[0].text;
  } else if (result.text) {
    text = result.text;
  } else if (typeof result === 'string') {
    text = result;
  }

  // テキストが空の場合の詳細デバッグ
  if (!text) {
    console.log('Empty response. Candidate:', JSON.stringify(candidate, null, 2));
  }

  // 数字を抽出（前後の空白や改行も考慮）
  const cleanText = text.trim();

  // まず正しい度数（0, 90, 180, 270）をチェック
  const degreeMatch = cleanText.match(/\b(0|90|180|270)\b/);
  if (degreeMatch) {
    const rotation = parseInt(degreeMatch[1], 10);
    return {
      success: true,
      rotation,
      confidence: 0.9,
      reason: rotation === 0
        ? 'AI判定: 回転不要（正しい向き）'
        : `AI判定: ${rotation}度回転が必要`
    };
  }

  // Geminiが選択肢番号（1, 2, 3, 4）で回答した場合のフォールバック
  const optionMatch = cleanText.match(/\b([1-4])\b/);
  if (optionMatch) {
    const optionMap = { '1': 0, '2': 90, '3': 180, '4': 270 };
    const rotation = optionMap[optionMatch[1]];
    return {
      success: true,
      rotation,
      confidence: 0.8, // 選択肢番号からの変換なので少し低め
      reason: rotation === 0
        ? 'AI判定: 回転不要（正しい向き）'
        : `AI判定: ${rotation}度回転が必要`
    };
  }

  // 有効な角度が見つからない場合 - デバッグ情報を含める
  console.log('Gemini response text:', text);
  console.log('Gemini result structure:', Object.keys(result));
  console.log('Finish reason:', finishReason);
  return {
    success: false,
    rotation: null,
    confidence: 0,
    reason: `回転角度を判定できませんでした`,
    debug: {
      rawText: text.substring(0, 200),
      finishReason: finishReason,
      hasContent: !!candidate?.content,
      partsCount: candidate?.content?.parts?.length || 0
    }
  };
}

/**
 * メインハンドラー
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // OPTIONSリクエスト（CORS preflight）
    if (request.method === 'OPTIONS') {
      const headers = new Headers();
      setCorsHeaders(headers, origin, env.ALLOWED_ORIGINS);
      return new Response(null, { status: 204, headers });
    }

    // ヘルスチェック
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'RotateScreen Orientation Detector',
        version: '1.0.0'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 向き判定エンドポイント
    if (url.pathname === '/detect-orientation' && request.method === 'POST') {
      // APIキーのチェック
      if (!env.GEMINI_API_KEY) {
        return errorResponse('Gemini API key not configured', 500, origin, env);
      }

      // アクセストークンのチェック（設定されている場合のみ）
      if (env.ACCESS_TOKEN) {
        const token = request.headers.get('X-Access-Token');
        if (token !== env.ACCESS_TOKEN) {
          return errorResponse('Invalid access token', 401, origin, env);
        }
      }

      // レート制限チェック（KVが設定されている場合）
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (env.RATE_LIMIT_KV) {
        const limited = await isRateLimited(clientIP, env.RATE_LIMIT_KV);
        if (limited) {
          return errorResponse('Rate limit exceeded', 429, origin, env);
        }
      }

      // リクエストボディをパース
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return errorResponse('Invalid JSON body', 400, origin, env);
      }

      // 画像データのチェック
      if (!body.image) {
        return errorResponse('Missing image data', 400, origin, env);
      }

      // 画像サイズのチェック（Base64で約1.5MBまで = 元画像約1MB）
      if (body.image.length > 1500000) {
        return errorResponse('Image too large (max 1MB)', 400, origin, env);
      }

      try {
        // モデルを決定（優先順位: リクエスト > 環境変数 > デフォルト）
        const model = body.model || env.GEMINI_MODEL || DEFAULT_MODEL;

        // Gemini APIで判定
        const result = await detectOrientation(body.image, env.GEMINI_API_KEY, model);

        const headers = new Headers({ 'Content-Type': 'application/json' });
        setCorsHeaders(headers, origin, env.ALLOWED_ORIGINS);

        return new Response(JSON.stringify(result), { headers });
      } catch (error) {
        console.error('Detection error:', error);
        return errorResponse(`Detection failed: ${error.message}`, 500, origin, env);
      }
    }

    // 404
    return errorResponse('Not found', 404, origin, env);
  }
};
