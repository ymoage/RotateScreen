/**
 * RotateScreen Background Service Worker
 * メッセージング処理と設定管理
 */

import { MESSAGE_TYPES } from '../utils/constants.js';
import {
  getSettings,
  updateSettings,
  getVideoRotation,
  saveVideoRotation,
  clearAllVideoRotations
} from '../storage/settings-manager.js';

/**
 * メッセージリスナーを設定
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(response => sendResponse(response))
    .catch(error => {
      console.error('RotateScreen: Message handler error', error);
      sendResponse({
        success: false,
        error: {
          code: 'HANDLER_ERROR',
          message: error.message
        }
      });
    });

  // 非同期レスポンスのためtrueを返す
  return true;
});

/**
 * メッセージを処理
 * @param {object} message
 * @returns {Promise<object>}
 */
async function handleMessage(message) {
  const { type, payload } = message;

  switch (type) {
  case MESSAGE_TYPES.GET_SETTINGS:
    return handleGetSettings();

  case MESSAGE_TYPES.UPDATE_SETTINGS:
    return handleUpdateSettings(payload);

  case MESSAGE_TYPES.GET_ROTATION:
    return handleGetRotation(payload);

  case MESSAGE_TYPES.SAVE_ROTATION:
    return handleSaveRotation(payload);

  case MESSAGE_TYPES.CLEAR_ALL_ROTATIONS:
    return handleClearAllRotations();

  default:
    return {
      success: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: `Unknown message type: ${type}`
      }
    };
  }
}

/**
 * 設定を取得
 */
async function handleGetSettings() {
  try {
    const settings = await getSettings();
    return { success: true, data: settings };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'STORAGE_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 設定を更新
 */
async function handleUpdateSettings(payload) {
  try {
    await updateSettings(payload);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'STORAGE_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 動画の回転設定を取得
 */
async function handleGetRotation(payload) {
  try {
    const { videoId } = payload;
    if (!videoId) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'videoId is required'
        }
      };
    }

    const rotation = await getVideoRotation(videoId);
    return { success: true, data: rotation };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'STORAGE_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 動画の回転設定を保存
 */
async function handleSaveRotation(payload) {
  try {
    const { videoId, rotation } = payload;
    if (!videoId || rotation === undefined) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'videoId and rotation are required'
        }
      };
    }

    await saveVideoRotation(videoId, rotation);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'STORAGE_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * すべての回転設定を削除
 */
async function handleClearAllRotations() {
  try {
    const deletedCount = await clearAllVideoRotations();
    return { success: true, data: { deletedCount } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'STORAGE_ERROR',
        message: error.message
      }
    };
  }
}

// インストール時の初期化
chrome.runtime.onInstalled.addListener((details) => {
  console.log('RotateScreen: Extension installed/updated', details.reason);

  if (details.reason === 'install') {
    // 初回インストール時の処理
    console.log('RotateScreen: First install, initializing defaults');
  }
});

console.log('RotateScreen: Background service worker started');
