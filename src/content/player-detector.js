/**
 * YouTube Player Detector
 * YouTubeの動画プレイヤーを検出する
 */

import { YOUTUBE_SELECTORS, SUPPORTED_SITES } from '../utils/youtube-selectors.js';

/**
 * 動画プレイヤーを検出
 * @returns {HTMLElement|null} プレイヤー要素
 */
export function detectPlayer() {
  return document.querySelector(YOUTUBE_SELECTORS.player);
}

/**
 * 動画コンテナを検出
 * @returns {HTMLElement|null} 動画コンテナ要素
 */
export function detectVideoContainer() {
  return document.querySelector(YOUTUBE_SELECTORS.videoContainer);
}

/**
 * 動画要素を検出
 * @returns {HTMLVideoElement|null} 動画要素
 */
export function detectVideo() {
  return document.querySelector(YOUTUBE_SELECTORS.video);
}

/**
 * 現在の動画IDを取得
 * @returns {string|null} 動画ID
 */
export function getCurrentVideoId() {
  return SUPPORTED_SITES.youtube.extractVideoId(window.location.href);
}

/**
 * プレイヤーが存在するかチェック
 * @returns {boolean}
 */
export function isPlayerReady() {
  const player = detectPlayer();
  const video = detectVideo();
  return !!(player && video);
}

/**
 * プレイヤーの準備を待つ
 * @param {number} timeout - タイムアウト(ms)
 * @param {number} interval - チェック間隔(ms)
 * @returns {Promise<boolean>} プレイヤーが見つかったかどうか
 */
export function waitForPlayer(timeout = 10000, interval = 500) {
  return new Promise((resolve) => {
    if (isPlayerReady()) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isPlayerReady()) {
        clearInterval(checkInterval);
        resolve(true);
        return;
      }

      if (Date.now() - startTime >= timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, interval);
  });
}

/**
 * URL変更を監視して動画ID変更を検出
 * @param {function} callback - 動画ID変更時のコールバック
 * @returns {function} 監視解除関数
 */
export function observeVideoChange(callback) {
  let lastVideoId = getCurrentVideoId();

  // URLの変更を監視（YouTube SPAナビゲーション対応）
  const observer = new MutationObserver(() => {
    const currentVideoId = getCurrentVideoId();
    if (currentVideoId && currentVideoId !== lastVideoId) {
      lastVideoId = currentVideoId;
      callback(currentVideoId);
    }
  });

  // title要素の変更を監視（YouTubeはSPA遷移時にtitleを更新）
  const titleElement = document.querySelector('title');
  if (titleElement) {
    observer.observe(titleElement, { childList: true });
  }

  // body全体も監視（フォールバック）
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  return () => observer.disconnect();
}
