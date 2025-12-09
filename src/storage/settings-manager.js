/**
 * Settings Manager
 * Chrome Storage APIを使用した設定管理
 */

import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  isValidRotation
} from '../utils/constants.js';

/**
 * 設定を取得
 * @returns {Promise<object>} 設定オブジェクト
 */
export async function getSettings() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
  } catch (error) {
    console.error('RotateScreen: Failed to get settings', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * 設定を更新
 * @param {object} updates - 更新する設定
 * @returns {Promise<void>}
 */
export async function updateSettings(updates) {
  try {
    const currentSettings = await getSettings();
    const newSettings = { ...currentSettings, ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
  } catch (error) {
    console.error('RotateScreen: Failed to update settings', error);
    throw error;
  }
}

/**
 * 動画の回転設定を取得
 * @param {string} videoId - YouTube動画ID
 * @returns {Promise<object|null>} 回転設定 or null
 */
export async function getVideoRotation(videoId) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.VIDEO_ROTATIONS);
    const rotations = result[STORAGE_KEYS.VIDEO_ROTATIONS] || {};
    return rotations[videoId] || null;
  } catch (error) {
    console.error('RotateScreen: Failed to get video rotation', error);
    return null;
  }
}

/**
 * 動画の回転設定を保存
 * @param {string} videoId - YouTube動画ID
 * @param {number} rotation - 回転角度 (0, 90, 180, 270)
 * @returns {Promise<void>}
 */
export async function saveVideoRotation(videoId, rotation) {
  if (!videoId || !isValidRotation(rotation)) {
    throw new Error('Invalid videoId or rotation');
  }

  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.VIDEO_ROTATIONS);
    const rotations = result[STORAGE_KEYS.VIDEO_ROTATIONS] || {};

    rotations[videoId] = {
      rotation,
      savedAt: Date.now()
    };

    await chrome.storage.local.set({ [STORAGE_KEYS.VIDEO_ROTATIONS]: rotations });
  } catch (error) {
    console.error('RotateScreen: Failed to save video rotation', error);
    throw error;
  }
}

/**
 * 動画の回転設定を削除
 * @param {string} videoId - YouTube動画ID
 * @returns {Promise<void>}
 */
export async function deleteVideoRotation(videoId) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.VIDEO_ROTATIONS);
    const rotations = result[STORAGE_KEYS.VIDEO_ROTATIONS] || {};

    if (rotations[videoId]) {
      delete rotations[videoId];
      await chrome.storage.local.set({ [STORAGE_KEYS.VIDEO_ROTATIONS]: rotations });
    }
  } catch (error) {
    console.error('RotateScreen: Failed to delete video rotation', error);
    throw error;
  }
}

/**
 * すべての動画回転設定を削除
 * @returns {Promise<number>} 削除した件数
 */
export async function clearAllVideoRotations() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.VIDEO_ROTATIONS);
    const rotations = result[STORAGE_KEYS.VIDEO_ROTATIONS] || {};
    const count = Object.keys(rotations).length;

    await chrome.storage.local.set({ [STORAGE_KEYS.VIDEO_ROTATIONS]: {} });
    return count;
  } catch (error) {
    console.error('RotateScreen: Failed to clear all video rotations', error);
    throw error;
  }
}

/**
 * ストレージの全データを取得（デバッグ用）
 * @returns {Promise<object>}
 */
export async function getAllStorage() {
  try {
    return await chrome.storage.local.get(null);
  } catch (error) {
    console.error('RotateScreen: Failed to get all storage', error);
    return {};
  }
}
