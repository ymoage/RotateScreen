/**
 * RotateScreen Options Page Logic
 */

import { MESSAGE_TYPES } from '../utils/constants.js';

// DOM要素
const buttonPositionSelect = document.getElementById('button-position');
const hotkeyPresetSelect = document.getElementById('hotkey-preset');
const autoDetectRotationCheckbox = document.getElementById('auto-detect-rotation');
// AI設定
const aiModeDirectRadio = document.getElementById('ai-mode-direct');
const aiModeWorkerRadio = document.getElementById('ai-mode-worker');
const aiGeminiApiKeyInput = document.getElementById('ai-gemini-api-key');
const aiGeminiModelSelect = document.getElementById('ai-gemini-model');
const refreshModelsBtn = document.getElementById('refresh-models');
const modelStatusText = document.getElementById('model-status');
const aiApiEndpointInput = document.getElementById('ai-api-endpoint');
const aiAccessTokenInput = document.getElementById('ai-access-token');
const aiDirectSettings = document.querySelectorAll('.ai-direct-settings');
const aiWorkerSettings = document.querySelectorAll('.ai-worker-settings');

// Gemini API URL
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const resetOnVideoChangeCheckbox = document.getElementById('reset-on-video-change');
const rememberRotationCheckbox = document.getElementById('remember-rotation');
const defaultRotationSelect = document.getElementById('default-rotation');
const clearRotationsBtn = document.getElementById('clear-rotations');
const saveNotification = document.getElementById('save-notification');

/**
 * 初期化
 */
async function initialize() {
  // 現在の設定を読み込む
  await loadSettings();

  // イベントリスナーを設定
  setupEventListeners();
}

/**
 * 設定を読み込む
 */
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS });
    if (response && response.success) {
      const settings = response.data;

      buttonPositionSelect.value = settings.buttonPosition || 'overlay';
      hotkeyPresetSelect.value = settings.hotkeyPreset;
      autoDetectRotationCheckbox.checked = settings.autoDetectRotation === true;

      // AI設定
      const aiMode = settings.aiMode || 'direct';
      if (aiMode === 'worker') {
        aiModeWorkerRadio.checked = true;
      } else {
        aiModeDirectRadio.checked = true;
      }
      updateAiSettingsVisibility(aiMode);

      aiGeminiApiKeyInput.value = settings.aiGeminiApiKey || '';

      // モデル選択の復元
      const savedModel = settings.aiGeminiModel || 'gemini-2.0-flash';
      if (aiGeminiModelSelect.querySelector(`option[value="${savedModel}"]`)) {
        aiGeminiModelSelect.value = savedModel;
      }

      aiApiEndpointInput.value = settings.aiApiEndpoint || '';
      aiAccessTokenInput.value = settings.aiAccessToken || '';

      resetOnVideoChangeCheckbox.checked = settings.resetOnVideoChange !== false;
      rememberRotationCheckbox.checked = settings.rememberRotation;
      defaultRotationSelect.value = settings.defaultRotation.toString();
    }
  } catch (error) {
    console.error('Failed to load settings', error);
  }
}

/**
 * AI設定の表示/非表示を切り替え
 * @param {string} mode - 'direct' or 'worker'
 */
function updateAiSettingsVisibility(mode) {
  if (mode === 'direct') {
    aiDirectSettings.forEach(el => el.classList.add('active'));
    aiWorkerSettings.forEach(el => el.classList.remove('active'));
  } else {
    aiDirectSettings.forEach(el => el.classList.remove('active'));
    aiWorkerSettings.forEach(el => el.classList.add('active'));
  }
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // ボタン表示位置変更
  buttonPositionSelect.addEventListener('change', () => {
    saveSettings({ buttonPosition: buttonPositionSelect.value });
  });

  // ホットキープリセット変更
  hotkeyPresetSelect.addEventListener('change', () => {
    saveSettings({ hotkeyPreset: hotkeyPresetSelect.value });
  });

  // 自動回転検出設定変更
  autoDetectRotationCheckbox.addEventListener('change', () => {
    saveSettings({ autoDetectRotation: autoDetectRotationCheckbox.checked });
  });

  // AI接続方式変更
  aiModeDirectRadio.addEventListener('change', () => {
    if (aiModeDirectRadio.checked) {
      updateAiSettingsVisibility('direct');
      saveSettings({ aiMode: 'direct' });
    }
  });

  aiModeWorkerRadio.addEventListener('change', () => {
    if (aiModeWorkerRadio.checked) {
      updateAiSettingsVisibility('worker');
      saveSettings({ aiMode: 'worker' });
    }
  });

  // Gemini APIキー変更
  aiGeminiApiKeyInput.addEventListener('change', () => {
    saveSettings({ aiGeminiApiKey: aiGeminiApiKeyInput.value.trim() });
  });

  // モデル選択変更
  aiGeminiModelSelect.addEventListener('change', () => {
    saveSettings({ aiGeminiModel: aiGeminiModelSelect.value });
  });

  // モデル一覧更新ボタン
  refreshModelsBtn.addEventListener('click', () => {
    fetchGeminiModels();
  });

  // AI APIエンドポイント変更
  aiApiEndpointInput.addEventListener('change', () => {
    saveSettings({ aiApiEndpoint: aiApiEndpointInput.value.trim() });
  });

  // AIアクセストークン変更
  aiAccessTokenInput.addEventListener('change', () => {
    saveSettings({ aiAccessToken: aiAccessTokenInput.value });
  });

  // 動画切り替え時リセット設定変更
  resetOnVideoChangeCheckbox.addEventListener('change', () => {
    saveSettings({ resetOnVideoChange: resetOnVideoChangeCheckbox.checked });
  });

  // 回転記憶設定変更
  rememberRotationCheckbox.addEventListener('change', () => {
    saveSettings({ rememberRotation: rememberRotationCheckbox.checked });
  });

  // デフォルト回転変更
  defaultRotationSelect.addEventListener('change', () => {
    saveSettings({ defaultRotation: parseInt(defaultRotationSelect.value, 10) });
  });

  // 回転設定クリア
  clearRotationsBtn.addEventListener('click', async () => {
    if (confirm('すべての動画の回転設定を削除しますか？')) {
      await clearAllRotations();
    }
  });
}

/**
 * 設定を保存
 * @param {object} updates
 */
async function saveSettings(updates) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: updates
    });

    if (response && response.success) {
      showSaveNotification();
    }
  } catch (error) {
    console.error('Failed to save settings', error);
  }
}

/**
 * すべての回転設定をクリア
 */
async function clearAllRotations() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.CLEAR_ALL_ROTATIONS
    });

    if (response && response.success) {
      const count = response.data.deletedCount;
      alert(`${count}件の回転設定を削除しました`);
    }
  } catch (error) {
    console.error('Failed to clear rotations', error);
    alert('回転設定の削除に失敗しました');
  }
}

/**
 * 保存通知を表示
 */
function showSaveNotification() {
  saveNotification.classList.remove('hidden');

  setTimeout(() => {
    saveNotification.classList.add('hidden');
  }, 2000);
}

/**
 * Gemini APIからモデル一覧を取得
 */
async function fetchGeminiModels() {
  const apiKey = aiGeminiApiKeyInput.value.trim();

  if (!apiKey) {
    modelStatusText.textContent = 'APIキーを入力してください。';
    modelStatusText.style.color = '#dc3545';
    return;
  }

  // ボタンを無効化してローディング表示
  refreshModelsBtn.disabled = true;
  refreshModelsBtn.classList.add('loading');
  modelStatusText.textContent = 'モデル一覧を取得中...';
  modelStatusText.style.color = '#666';

  try {
    const response = await fetch(`${GEMINI_API_BASE}/models?key=${apiKey}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.models || [];

    // 画像入力をサポートするモデルのみフィルタリング
    const visionModels = models.filter(model => {
      const methods = model.supportedGenerationMethods || [];
      return methods.includes('generateContent') &&
             model.name &&
             !model.name.includes('embedding') &&
             !model.name.includes('aqa');
    });

    if (visionModels.length === 0) {
      modelStatusText.textContent = '利用可能なモデルが見つかりませんでした。';
      modelStatusText.style.color = '#dc3545';
      return;
    }

    // 現在選択されているモデルを保存
    const currentModel = aiGeminiModelSelect.value;

    // セレクトボックスを更新
    aiGeminiModelSelect.innerHTML = '';

    visionModels
      .sort((a, b) => {
        // flashモデルを優先、その後名前でソート
        const aIsFlash = a.name.includes('flash');
        const bIsFlash = b.name.includes('flash');
        if (aIsFlash && !bIsFlash) return -1;
        if (!aIsFlash && bIsFlash) return 1;
        return a.name.localeCompare(b.name);
      })
      .forEach(model => {
        const modelId = model.name.replace('models/', '');
        const option = document.createElement('option');
        option.value = modelId;
        option.textContent = modelId;
        aiGeminiModelSelect.appendChild(option);
      });

    // 以前選択されていたモデルがあれば復元
    if (aiGeminiModelSelect.querySelector(`option[value="${currentModel}"]`)) {
      aiGeminiModelSelect.value = currentModel;
    }

    // 選択したモデルを保存
    saveSettings({ aiGeminiModel: aiGeminiModelSelect.value });

    modelStatusText.textContent = `${visionModels.length}個のモデルが見つかりました。`;
    modelStatusText.style.color = '#28a745';

  } catch (error) {
    console.error('Failed to fetch models:', error);
    modelStatusText.textContent = `モデル取得エラー: ${error.message}`;
    modelStatusText.style.color = '#dc3545';
  } finally {
    refreshModelsBtn.disabled = false;
    refreshModelsBtn.classList.remove('loading');
  }
}

// 初期化実行
initialize();
