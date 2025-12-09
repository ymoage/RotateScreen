/**
 * Overlay UI
 * 動画プレイヤー上にオーバーレイボタンを注入
 */

import { detectVideoContainer, detectPlayer } from './player-detector.js';
import { rotateNext, getCurrentRotation, resetRotation } from './rotation-control.js';

// ボタン要素の参照
let rotateButton = null;

// SVGアイコン
const ROTATE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
  <path d="M21 3v5h-5"/>
</svg>
`;

/**
 * 回転ボタンを作成
 * @returns {HTMLButtonElement}
 */
function createRotateButton() {
  const button = document.createElement('button');
  button.className = 'rotate-screen-btn';
  button.title = '動画を回転 (Rキー)';
  button.innerHTML = ROTATE_ICON_SVG;
  button.setAttribute('data-rotation', '0°');

  // クリックイベント
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleRotateClick();
  });

  // ダブルクリックでリセット
  button.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleResetClick();
  });

  return button;
}

/**
 * 回転ボタンクリックハンドラ
 */
function handleRotateClick() {
  const newRotation = rotateNext();
  updateButtonState(newRotation);
}

/**
 * リセットクリックハンドラ
 */
function handleResetClick() {
  resetRotation();
  updateButtonState(0);
}

/**
 * ボタンの状態を更新
 * @param {number} rotation
 */
export function updateButtonState(rotation) {
  if (rotateButton) {
    rotateButton.setAttribute('data-rotation', `${rotation}°`);
  }
}

/**
 * オーバーレイUIを注入
 * @returns {boolean} 成功したかどうか
 */
export function injectOverlayUI() {
  // 既に存在する場合はスキップ
  if (document.querySelector('.rotate-screen-btn')) {
    console.log('RotateScreen: Overlay UI already exists');
    return true;
  }

  // プレイヤーコンテナを取得
  const container = detectVideoContainer() || detectPlayer();
  if (!container) {
    console.warn('RotateScreen: Player container not found');
    return false;
  }

  // コンテナにposition: relativeを確保
  const containerStyle = window.getComputedStyle(container);
  if (containerStyle.position === 'static') {
    container.style.position = 'relative';
  }

  // ボタンを作成して挿入
  rotateButton = createRotateButton();
  container.appendChild(rotateButton);

  console.log('RotateScreen: Overlay UI injected');
  return true;
}

/**
 * オーバーレイUIを削除
 */
export function removeOverlayUI() {
  if (rotateButton && rotateButton.parentNode) {
    rotateButton.parentNode.removeChild(rotateButton);
    rotateButton = null;
    console.log('RotateScreen: Overlay UI removed');
  }
}

/**
 * オーバーレイUIが存在するかチェック
 * @returns {boolean}
 */
export function isOverlayUIInjected() {
  return !!document.querySelector('.rotate-screen-btn');
}

/**
 * 回転角度でボタン状態を更新（外部から呼び出し用）
 * @param {number} rotation
 */
export function syncButtonState(rotation) {
  updateButtonState(rotation);
}
