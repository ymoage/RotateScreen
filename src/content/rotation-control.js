/**
 * Rotation Control
 * CSS transformを使用した動画回転ロジック
 */

import { detectVideo, detectVideoContainer } from './player-detector.js';
import { getNextRotation, isValidRotation, DEFAULT_ROTATION } from '../utils/constants.js';

// 現在の回転状態
let currentRotation = DEFAULT_ROTATION;

// 回転クラスのプレフィックス
const ROTATION_CLASS_PREFIX = 'rotate-screen-';

/**
 * 現在の回転角度を取得
 * @returns {number}
 */
export function getCurrentRotation() {
  return currentRotation;
}

/**
 * 回転角度を設定
 * @param {number} rotation - 回転角度 (0, 90, 180, 270)
 * @returns {boolean} 成功したかどうか
 */
export function setRotation(rotation) {
  if (!isValidRotation(rotation)) {
    console.error('RotateScreen: Invalid rotation angle:', rotation);
    return false;
  }

  const video = detectVideo();
  if (!video) {
    console.warn('RotateScreen: Video element not found');
    return false;
  }

  // 既存の回転クラスを削除
  removeRotationClasses(video);

  // 新しい回転クラスを追加
  if (rotation !== 0) {
    video.classList.add(`${ROTATION_CLASS_PREFIX}${rotation}`);
  }

  // スケール計算（90°/270°の場合）
  if (rotation === 90 || rotation === 270) {
    const scale = calculateScale(video);
    video.style.setProperty('--rotate-screen-scale', scale);
  }

  currentRotation = rotation;
  console.log('RotateScreen: Rotation set to', rotation);

  return true;
}

/**
 * 次の角度に回転
 * @returns {number} 新しい回転角度
 */
export function rotateNext() {
  const nextRotation = getNextRotation(currentRotation);
  setRotation(nextRotation);
  return nextRotation;
}

/**
 * 回転をリセット (0度に戻す)
 */
export function resetRotation() {
  setRotation(DEFAULT_ROTATION);
}

/**
 * 回転クラスを削除
 * @param {HTMLElement} element
 */
function removeRotationClasses(element) {
  const classesToRemove = [];
  element.classList.forEach(className => {
    if (className.startsWith(ROTATION_CLASS_PREFIX)) {
      classesToRemove.push(className);
    }
  });
  classesToRemove.forEach(className => {
    element.classList.remove(className);
  });
}

/**
 * 90°/270°回転時のスケールを計算
 * @param {HTMLVideoElement} video
 * @returns {number}
 */
function calculateScale(video) {
  const container = detectVideoContainer();
  if (!container) {
    return 0.5625; // 16:9のデフォルト
  }

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  // 回転後に収まるスケールを計算
  // 90°/270°回転時は幅と高さが入れ替わる
  const scaleByWidth = containerWidth / containerHeight;
  const scaleByHeight = containerHeight / containerWidth;

  return Math.min(scaleByWidth, scaleByHeight);
}

/**
 * フルスクリーン変更時の回転再適用
 */
export function handleFullscreenChange() {
  // 少し遅延させて再適用（DOM更新を待つ）
  setTimeout(() => {
    if (currentRotation !== 0) {
      setRotation(currentRotation);
    }
  }, 100);
}

/**
 * 回転状態を初期化
 * @param {number} initialRotation - 初期回転角度
 */
export function initRotation(initialRotation = DEFAULT_ROTATION) {
  currentRotation = DEFAULT_ROTATION;
  if (initialRotation !== DEFAULT_ROTATION) {
    setRotation(initialRotation);
  }
}

// フルスクリーンイベントリスナーを設定
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
