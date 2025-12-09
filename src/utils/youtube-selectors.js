/**
 * YouTube DOM Selectors
 * YouTubeのUI変更時にこのファイルのみ更新すれば対応可能
 */

export const YOUTUBE_SELECTORS = {
  // メイン動画プレイヤー
  player: '#movie_player',

  // 動画コンテナ（回転適用対象）
  videoContainer: '.html5-video-container',

  // 動画要素
  video: 'video.html5-main-video',

  // プレイヤーコントロール（参考用）
  controls: '.ytp-chrome-bottom',

  // フルスクリーンボタン
  fullscreenButton: '.ytp-fullscreen-button',

  // プレイヤーのラッパー
  playerWrapper: '#player-container-outer'
};

// 対応サイト定義
export const SUPPORTED_SITES = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    hostPattern: '*://*.youtube.com/*',
    hostRegex: /^https?:\/\/(www\.)?youtube\.com/,
    selectors: YOUTUBE_SELECTORS,

    /**
     * URLからYouTube動画IDを抽出
     * @param {string} url - ページURL
     * @returns {string|null} 動画ID or null
     */
    extractVideoId(url) {
      try {
        const urlObj = new URL(url);
        // 標準の動画ページ: youtube.com/watch?v=xxxxx
        const vParam = urlObj.searchParams.get('v');
        if (vParam) {
          return vParam;
        }
        // 短縮URL: youtu.be/xxxxx
        if (urlObj.hostname === 'youtu.be') {
          return urlObj.pathname.slice(1);
        }
        // 埋め込み: youtube.com/embed/xxxxx
        const embedMatch = urlObj.pathname.match(/\/embed\/([^/?]+)/);
        if (embedMatch) {
          return embedMatch[1];
        }
        return null;
      } catch {
        return null;
      }
    }
  }
};

/**
 * 現在のサイトが対応サイトかチェック
 * @param {string} url - チェックするURL
 * @returns {object|null} 対応サイト定義 or null
 */
export function getSupportedSite(url) {
  for (const site of Object.values(SUPPORTED_SITES)) {
    if (site.hostRegex.test(url)) {
      return site;
    }
  }
  return null;
}

/**
 * 現在のページがYouTubeかチェック
 * @returns {boolean}
 */
export function isYouTube() {
  return SUPPORTED_SITES.youtube.hostRegex.test(window.location.href);
}
