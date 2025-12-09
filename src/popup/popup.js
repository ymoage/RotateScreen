/**
 * RotateScreen Popup Logic
 */

import { MESSAGE_TYPES, HOTKEY_PRESETS } from '../utils/constants.js';

// DOM要素
const currentRotationEl = document.getElementById('current-rotation');
const currentSiteEl = document.getElementById('current-site');
const rotationButtons = document.querySelectorAll('.rotation-btn');
const openOptionsLink = document.getElementById('open-options');

// 現在の状態
let currentTabId = null;

/**
 * 初期化
 */
async function initialize() {
  // 現在のタブを取得
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;

  // サイト情報を表示
  updateSiteInfo(tab.url);

  // 設定を読み込む
  await loadSettings();

  // イベントリスナーを設定
  setupEventListeners();
}

/**
 * サイト情報を更新
 * @param {string} url
 */
function updateSiteInfo(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (hostname.includes('youtube.com')) {
      currentSiteEl.textContent = 'YouTube';
      currentSiteEl.style.color = '#ff0000';
    } else {
      currentSiteEl.textContent = '未対応';
      currentSiteEl.style.color = '#999';
      showUnsupportedMessage();
    }
  } catch {
    currentSiteEl.textContent = '--';
  }
}

/**
 * 未対応サイトメッセージを表示
 */
function showUnsupportedMessage() {
  const mainEl = document.querySelector('.popup-main');
  mainEl.innerHTML = `
    <div class="unsupported-message">
      <p>このサイトは未対応です</p>
      <p class="site-name">対応サイト: YouTube</p>
    </div>
  `;
}

/**
 * 設定を読み込む
 */
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS });
    if (response && response.success) {
      updateHotkeyHint(response.data.hotkeyPreset);
    }
  } catch (error) {
    console.error('Failed to load settings', error);
  }
}

/**
 * ホットキーヒントを更新
 * @param {string} presetId
 */
function updateHotkeyHint(presetId) {
  const preset = HOTKEY_PRESETS[presetId];
  if (!preset) return;

  const hintEl = document.querySelector('.shortcut-hint');
  if (hintEl) {
    hintEl.innerHTML = `<span class="key">${preset.description}</span> で回転`;
  }
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // 回転ボタン
  rotationButtons.forEach(button => {
    button.addEventListener('click', () => {
      const rotation = parseInt(button.dataset.rotation, 10);
      setRotation(rotation);
    });
  });

  // 設定リンク
  openOptionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

/**
 * 回転を設定
 * @param {number} rotation
 */
async function setRotation(rotation) {
  try {
    // Content Scriptにメッセージを送信
    await chrome.tabs.sendMessage(currentTabId, {
      type: 'SET_ROTATION',
      payload: { rotation }
    });

    // UIを更新
    updateRotationUI(rotation);
  } catch (error) {
    console.error('Failed to set rotation', error);
  }
}

/**
 * 回転UIを更新
 * @param {number} rotation
 */
function updateRotationUI(rotation) {
  currentRotationEl.textContent = `${rotation}°`;

  rotationButtons.forEach(button => {
    const btnRotation = parseInt(button.dataset.rotation, 10);
    button.classList.toggle('active', btnRotation === rotation);
  });
}

// 初期化実行
initialize();
