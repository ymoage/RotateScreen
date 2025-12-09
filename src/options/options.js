/**
 * RotateScreen Options Page Logic
 */

import { MESSAGE_TYPES } from '../utils/constants.js';

// DOM要素
const hotkeyPresetSelect = document.getElementById('hotkey-preset');
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

      hotkeyPresetSelect.value = settings.hotkeyPreset;
      rememberRotationCheckbox.checked = settings.rememberRotation;
      defaultRotationSelect.value = settings.defaultRotation.toString();
    }
  } catch (error) {
    console.error('Failed to load settings', error);
  }
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // ホットキープリセット変更
  hotkeyPresetSelect.addEventListener('change', () => {
    saveSettings({ hotkeyPreset: hotkeyPresetSelect.value });
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

// 初期化実行
initialize();
