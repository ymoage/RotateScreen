// AI Detection Module for RotateScreen
// Gemini API経由で動画の上下方向を判定する

(function() {
  'use strict';

  // Gemini API ベースURL
  const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

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

  // タイムアウト設定（ミリ秒）
  const DEFAULT_TIMEOUT = 10000; // 10秒

  // 設定（chrome.storageから読み込み）
  let aiMode = 'direct'; // 'direct' or 'worker'
  let geminiApiKey = '';
  let geminiModel = DEFAULT_MODEL;
  let apiEndpoint = '';
  let accessToken = '';

  /**
   * 動画から元フレームをそのままキャプチャ（回転なし）
   * @param {HTMLVideoElement} video - 動画要素
   * @param {number} maxSize - 最大サイズ（ピクセル）
   * @returns {string|null} Base64エンコードされた画像データ
   */
  function captureFrameRaw(video, maxSize = 512) {
    if (!video) {
      console.log('RotateScreen AI: Video element not found');
      return null;
    }

    if (video.readyState < 2) {
      console.log('RotateScreen AI: Video not ready for capture, readyState:', video.readyState);
      return null;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('RotateScreen AI: Video dimensions not available');
      return null;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // アスペクト比を維持してリサイズ
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > height) {
      if (width > maxSize) {
        height = Math.round(height * maxSize / width);
        width = maxSize;
      }
    } else {
      if (height > maxSize) {
        width = Math.round(width * maxSize / height);
        height = maxSize;
      }
    }

    canvas.width = width;
    canvas.height = height;

    try {
      // 元動画をそのまま描画（回転なし）
      ctx.drawImage(video, 0, 0, width, height);
      console.log(`RotateScreen AI: Captured raw frame ${width}x${height}`);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) {
      console.error('RotateScreen AI: Failed to capture frame:', e);
      return null;
    }
  }

  /**
   * 動画からフレームをキャプチャしてBase64画像を生成（回転適用版）
   * @param {HTMLVideoElement} video - 動画要素
   * @param {number} maxSize - 最大サイズ（ピクセル）
   * @param {number} currentRotation - 現在適用されている回転角度（0, 90, 180, 270）
   * @returns {string|null} Base64エンコードされた画像データ
   */
  function captureFrame(video, maxSize = 512, currentRotation = 0) {
    if (!video) {
      console.log('RotateScreen AI: Video element not found');
      return null;
    }

    if (video.readyState < 2) {
      console.log('RotateScreen AI: Video not ready for capture, readyState:', video.readyState);
      return null;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('RotateScreen AI: Video dimensions not available');
      return null;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // アスペクト比を維持してリサイズ
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > height) {
      if (width > maxSize) {
        height = Math.round(height * maxSize / width);
        width = maxSize;
      }
    } else {
      if (height > maxSize) {
        width = Math.round(width * maxSize / height);
        height = maxSize;
      }
    }

    // 90°または270°回転の場合、キャンバスの幅と高さを入れ替え
    const isRotated90or270 = currentRotation === 90 || currentRotation === 270;
    if (isRotated90or270) {
      canvas.width = height;
      canvas.height = width;
    } else {
      canvas.width = width;
      canvas.height = height;
    }

    try {
      // 現在の回転を適用してからキャプチャ
      ctx.save();

      // キャンバスの中心に移動
      ctx.translate(canvas.width / 2, canvas.height / 2);

      // 回転を適用
      ctx.rotate((currentRotation * Math.PI) / 180);

      // 動画を中心に描画
      ctx.drawImage(video, -width / 2, -height / 2, width, height);

      ctx.restore();

      console.log(`RotateScreen AI: Captured frame with rotation ${currentRotation}°`);
      // JPEG形式で品質80%
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) {
      console.error('RotateScreen AI: Failed to capture frame:', e);
      return null;
    }
  }

  /**
   * タイムアウト付きのfetch
   * @param {string} url - URL
   * @param {object} options - fetchオプション
   * @param {number} timeout - タイムアウト（ミリ秒）
   * @returns {Promise<Response>}
   */
  async function fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * 設定を読み込む
   */
  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get('settings');
      console.log('RotateScreen AI: Loading settings', result.settings);
      if (result.settings) {
        aiMode = result.settings.aiMode || 'direct';
        geminiApiKey = result.settings.aiGeminiApiKey || '';
        geminiModel = result.settings.aiGeminiModel || DEFAULT_MODEL;
        apiEndpoint = result.settings.aiApiEndpoint || '';
        accessToken = result.settings.aiAccessToken || '';
        console.log('RotateScreen AI: Mode:', aiMode, 'Model:', geminiModel, 'Configured:', isConfigured());
      }
    } catch (error) {
      console.warn('RotateScreen AI: Failed to load settings', error);
    }
  }

  // 初期化時に設定を読み込む
  loadSettings();

  // 設定変更を監視
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings) {
          aiMode = newSettings.aiMode || 'direct';
          geminiApiKey = newSettings.aiGeminiApiKey || '';
          geminiModel = newSettings.aiGeminiModel || DEFAULT_MODEL;
          apiEndpoint = newSettings.aiApiEndpoint || '';
          accessToken = newSettings.aiAccessToken || '';
          console.log('RotateScreen AI: Settings updated, Model:', geminiModel);
        }
      }
    });
  }

  /**
   * 直接Gemini APIを呼び出して向きを判定
   * @param {string} imageData - Base64エンコードされた画像データ
   * @param {number} timeout - タイムアウト（ミリ秒）
   * @returns {Promise<object>} 判定結果
   */
  async function detectOrientationDirect(imageData, timeout = DEFAULT_TIMEOUT) {
    try {
      // data:image/jpeg;base64, プレフィックスを除去
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

      // MIMEタイプを取得
      const mimeMatch = imageData.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      const apiUrl = `${GEMINI_API_BASE}/${geminiModel}:generateContent`;
      console.log('RotateScreen AI: Sending direct request to Gemini API, model:', geminiModel);

      const response = await fetchWithTimeout(
        `${apiUrl}?key=${geminiApiKey}`,
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
        },
        timeout
      );

      console.log('RotateScreen AI: Response status', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('RotateScreen AI: Error response body:', errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const result = await response.json();

      // レスポンスから回転角度を抽出
      const candidate = result.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || '';
      const cleanText = text.trim();

      // まず正しい度数（0, 90, 180, 270）をチェック
      const degreeMatch = cleanText.match(/\b(0|90|180|270)\b/);
      if (degreeMatch) {
        const rotation = parseInt(degreeMatch[1], 10);
        return {
          detected: true,
          rotation,
          confidence: 0.9,
          reason: rotation === 0
            ? 'AI判定: 回転不要（正しい向き）'
            : `AI判定: ${rotation}度回転が必要`,
          method: 'ai-direct'
        };
      }

      // Geminiが選択肢番号（1, 2, 3, 4）で回答した場合のフォールバック
      const optionMatch = cleanText.match(/\b([1-4])\b/);
      if (optionMatch) {
        const optionMap = { '1': 0, '2': 90, '3': 180, '4': 270 };
        const rotation = optionMap[optionMatch[1]];
        return {
          detected: true,
          rotation,
          confidence: 0.8,
          reason: rotation === 0
            ? 'AI判定: 回転不要（正しい向き）'
            : `AI判定: ${rotation}度回転が必要`,
          method: 'ai-direct'
        };
      }

      // 判定できなかった場合
      console.log('RotateScreen AI: Could not parse response:', cleanText);
      return {
        detected: false,
        rotation: null,
        confidence: 0,
        reason: '回転角度を判定できませんでした',
        method: 'ai-direct'
      };
    } catch (error) {
      console.error('RotateScreen AI: Direct detection failed:', error);
      return {
        detected: false,
        rotation: null,
        confidence: 0,
        error: error.message,
        method: 'ai-direct'
      };
    }
  }

  /**
   * Cloudflare Worker経由でGemini APIに画像を送信して向きを判定
   * @param {string} imageData - Base64エンコードされた画像データ
   * @param {number} timeout - タイムアウト（ミリ秒）
   * @returns {Promise<object>} 判定結果
   */
  async function detectOrientationByWorker(imageData, timeout = DEFAULT_TIMEOUT) {
    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      // アクセストークンがあれば追加
      if (accessToken) {
        headers['X-Access-Token'] = accessToken;
      }

      // エンドポイントURLを正規化（/detect-orientationがなければ追加）
      let endpoint = apiEndpoint;
      if (!endpoint.endsWith('/detect-orientation')) {
        endpoint = endpoint.replace(/\/$/, '') + '/detect-orientation';
      }

      console.log('RotateScreen AI: Sending request to', endpoint, 'model:', geminiModel);

      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            image: imageData,
            model: geminiModel
          })
        },
        timeout
      );

      console.log('RotateScreen AI: Response status', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('RotateScreen AI: Error response body:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('RotateScreen AI: Response result', result);

      // 期待されるレスポンス形式:
      // {
      //   success: boolean,
      //   rotation: 0 | 90 | 180 | 270,
      //   confidence: number (0-1),
      //   reason: string
      // }

      return {
        detected: result.success && result.rotation !== undefined,
        rotation: result.rotation !== undefined ? result.rotation : null,
        confidence: result.confidence || 0,
        reason: result.reason || '',
        method: 'ai'
      };
    } catch (error) {
      console.error('RotateScreen AI: Detection failed:', error);
      console.error('RotateScreen AI: Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        apiEndpoint: apiEndpoint
      });
      return {
        detected: false,
        rotation: null,
        confidence: 0,
        error: error.message,
        method: 'ai'
      };
    }
  }

  /**
   * 動画の向きをAI判定するメイン関数
   * @param {HTMLVideoElement} video - 動画要素
   * @param {object} options - オプション
   * @param {number} options.timeout - タイムアウト（ミリ秒）
   * @param {number} options.maxSize - 画像の最大サイズ
   * @returns {Promise<object>} 判定結果（元動画に対する絶対的な回転角度）
   */
  async function detectVideoOrientation(video, options = {}) {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const maxSize = options.maxSize || 512;

    console.log('RotateScreen AI: Starting AI detection... (analyzing raw video)');
    const startTime = Date.now();

    // 動画フレームをキャプチャ（回転なし - 元動画をそのまま）
    console.log('RotateScreen AI: Capturing raw video frame (rotation=0)');
    const imageData = captureFrameRaw(video, maxSize);
    if (!imageData) {
      return {
        detected: false,
        rotation: null,
        confidence: 0,
        error: 'Failed to capture video frame',
        method: 'ai'
      };
    }

    // AI判定を実行（元動画に必要な絶対的な回転角度を取得）
    const result = await detectOrientationByAI(imageData, timeout);

    const elapsed = Date.now() - startTime;
    console.log(`RotateScreen AI: Detection completed in ${elapsed}ms`, result);

    return result;
  }

  /**
   * モードに応じてAI判定を実行
   * @param {string} imageData - Base64エンコードされた画像データ
   * @param {number} timeout - タイムアウト（ミリ秒）
   * @returns {Promise<object>} 判定結果
   */
  async function detectOrientationByAI(imageData, timeout = DEFAULT_TIMEOUT) {
    if (aiMode === 'direct') {
      return detectOrientationDirect(imageData, timeout);
    } else {
      return detectOrientationByWorker(imageData, timeout);
    }
  }

  /**
   * APIが設定されているかチェック
   * @returns {boolean}
   */
  function isConfigured() {
    if (aiMode === 'direct') {
      return geminiApiKey && geminiApiKey.length > 0;
    } else {
      return apiEndpoint && apiEndpoint.length > 0;
    }
  }

  /**
   * 現在の設定を取得
   * @returns {object}
   */
  function getConfig() {
    return {
      aiMode,
      geminiModel,
      apiEndpoint,
      hasGeminiApiKey: !!geminiApiKey,
      hasAccessToken: !!accessToken
    };
  }

  // グローバルに公開
  window.RotateScreenAIDetector = {
    detectVideoOrientation,
    captureFrame,
    isConfigured,
    getConfig,
    DEFAULT_TIMEOUT
  };

  console.log('RotateScreen AI Detector module loaded');
})();
