/**
 * RotateScreen Content Script
 * YouTubeページに回転機能を注入（単一ファイル版）
 */

(function() {
  'use strict';

  // ================== 定数 ==================
  const ROTATION_ANGLES = [0, 90, 180, 270];
  const DEFAULT_ROTATION = 0;
  const ROTATION_CLASS_PREFIX = 'rotate-screen-';

  const HOTKEY_PRESETS = {
    default: { key: 'r', ctrl: false, alt: false, shift: false },
    alt: { key: 'r', ctrl: false, alt: true, shift: false },
    ctrl: { key: 'r', ctrl: true, alt: false, shift: true }
  };

  const YOUTUBE_SELECTORS = {
    player: '#movie_player',
    videoContainer: '.html5-video-container',
    video: 'video.html5-main-video',
    rightControls: '.ytp-right-controls'
  };

  const BUTTON_POSITIONS = {
    overlay: 'overlay',
    controlbar: 'controlbar'
  };

  // ================== 状態 ==================
  let currentRotation = DEFAULT_ROTATION;
  let currentHotkeyPreset = HOTKEY_PRESETS.default;
  let rememberRotation = true;
  let resetOnVideoChange = true;
  let buttonPosition = BUTTON_POSITIONS.overlay;
  let autoDetectRotation = false; // 自動回転検出（実験機能、デフォルトOFF）
  let rotateButton = null;
  let autoDetectionDone = false; // 現在の動画で自動検出済みか

  // ================== ユーティリティ ==================
  function isValidRotation(rotation) {
    return ROTATION_ANGLES.includes(rotation);
  }

  function getNextRotation(current) {
    return (current + 90) % 360;
  }

  function extractVideoId(url) {
    try {
      const urlObj = new URL(url);
      const vParam = urlObj.searchParams.get('v');
      if (vParam) return vParam;
      if (urlObj.hostname === 'youtu.be') return urlObj.pathname.slice(1);
      const embedMatch = urlObj.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
      return null;
    } catch {
      return null;
    }
  }

  function isYouTube() {
    return /^https?:\/\/(www\.)?youtube\.com/.test(window.location.href);
  }

  /**
   * ライブ配信かどうかを判定
   * @returns {boolean}
   */
  function isLiveStream() {
    // URLに /live/ が含まれる
    if (window.location.pathname.includes('/live/')) {
      return true;
    }

    // ライブバッジの存在をチェック
    const liveBadge = document.querySelector('.ytp-live-badge');
    if (liveBadge) {
      // display: none でなければライブ
      const style = window.getComputedStyle(liveBadge);
      if (style.display !== 'none') {
        return true;
      }
    }

    // プレイヤーのクラスにliveが含まれる
    const player = detectPlayer();
    if (player && player.classList.contains('ytp-live')) {
      return true;
    }

    // ライブチャットの存在をチェック
    const liveChat = document.querySelector('ytd-live-chat-frame');
    if (liveChat) {
      return true;
    }

    return false;
  }

  // ================== プレイヤー検出 ==================
  function detectPlayer() {
    return document.querySelector(YOUTUBE_SELECTORS.player);
  }

  function detectVideoContainer() {
    return document.querySelector(YOUTUBE_SELECTORS.videoContainer);
  }

  function detectVideo() {
    return document.querySelector(YOUTUBE_SELECTORS.video);
  }

  function getCurrentVideoId() {
    return extractVideoId(window.location.href);
  }

  function isPlayerReady() {
    return !!(detectPlayer() && detectVideo());
  }

  function waitForPlayer(timeout = 10000, interval = 500) {
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

  // ================== 回転制御 ==================
  const ROTATION_CLASSES = ['rotate-screen-90', 'rotate-screen-180', 'rotate-screen-270'];

  function removeRotationClasses(video) {
    video.classList.remove('rotate-screen-active', ...ROTATION_CLASSES);
    video.style.removeProperty('--rotate-screen-scale');
  }

  function setRotation(rotation) {
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

    // 回転を適用（CSSクラスを使用）
    if (rotation === 0) {
      // 0度は何もしない
    } else if (rotation === 180) {
      video.classList.add('rotate-screen-active', 'rotate-screen-180');
    } else if (rotation === 90 || rotation === 270) {
      // スケール計算
      const videoWidth = video.offsetWidth || video.clientWidth || video.getBoundingClientRect().width;
      const videoHeight = video.offsetHeight || video.clientHeight || video.getBoundingClientRect().height;

      let scale = 0.5625; // デフォルト: 16:9
      if (videoWidth > 0 && videoHeight > 0) {
        scale = videoHeight / videoWidth;
      }

      // CSS変数でスケールを設定
      video.style.setProperty('--rotate-screen-scale', scale);
      video.classList.add('rotate-screen-active', `rotate-screen-${rotation}`);
    }

    currentRotation = rotation;
    updateButtonState(rotation);
    return true;
  }

  function rotateNext() {
    const nextRotation = getNextRotation(currentRotation);
    setRotation(nextRotation);
    return nextRotation;
  }

  function resetRotation() {
    setRotation(DEFAULT_ROTATION);
  }

  // ================== UI ==================
  const ROTATE_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
    </svg>
  `;

  function createRotateButton(isControlbar = false) {
    const button = document.createElement('button');
    button.className = isControlbar ? 'ytp-button rotate-screen-controlbar-btn' : 'rotate-screen-btn';
    button.title = '動画を回転 (Rキー)';
    button.innerHTML = ROTATE_ICON_SVG;
    button.setAttribute('data-rotation', '0°');

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleRotate();
    });

    button.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetRotation();
    });

    return button;
  }

  function updateButtonState(rotation) {
    if (rotateButton) {
      rotateButton.setAttribute('data-rotation', `${rotation}°`);
    }
  }

  function removeExistingButton() {
    const existingOverlay = document.querySelector('.rotate-screen-btn');
    const existingControlbar = document.querySelector('.rotate-screen-controlbar-btn');
    if (existingOverlay) existingOverlay.remove();
    if (existingControlbar) existingControlbar.remove();
    rotateButton = null;
  }

  function injectOverlayUI() {
    removeExistingButton();

    const container = detectVideoContainer() || detectPlayer();
    if (!container) {
      console.warn('RotateScreen: Player container not found');
      return false;
    }

    const containerStyle = window.getComputedStyle(container);
    if (containerStyle.position === 'static') {
      container.style.position = 'relative';
    }

    rotateButton = createRotateButton(false);
    container.appendChild(rotateButton);
    updateButtonState(currentRotation);
    return true;
  }

  function injectControlbarUI() {
    removeExistingButton();

    const rightControls = document.querySelector(YOUTUBE_SELECTORS.rightControls);
    if (!rightControls) {
      console.warn('RotateScreen: Right controls not found, falling back to overlay');
      return injectOverlayUI();
    }

    rotateButton = createRotateButton(true);
    // 右コントロールの最初に挿入（設定ボタンなどの左側）
    rightControls.insertBefore(rotateButton, rightControls.firstChild);
    updateButtonState(currentRotation);
    return true;
  }

  function injectUI() {
    if (buttonPosition === BUTTON_POSITIONS.controlbar) {
      return injectControlbarUI();
    } else {
      return injectOverlayUI();
    }
  }

  // ================== キーボードショートカット ==================
  function isInputFocused(target) {
    const tagName = target.tagName.toUpperCase();
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;
  }

  function matchesHotkey(event, preset) {
    return (
      event.key.toLowerCase() === preset.key.toLowerCase() &&
      event.ctrlKey === preset.ctrl &&
      event.altKey === preset.alt &&
      event.shiftKey === preset.shift
    );
  }

  function handleKeyDown(event) {
    if (isInputFocused(event.target)) return;

    if (matchesHotkey(event, currentHotkeyPreset)) {
      event.preventDefault();
      event.stopPropagation();
      handleRotate();
    }
  }

  // ================== ストレージ ==================
  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get('settings');
      if (result.settings) {
        const settings = result.settings;
        currentHotkeyPreset = HOTKEY_PRESETS[settings.hotkeyPreset] || HOTKEY_PRESETS.default;
        rememberRotation = settings.rememberRotation !== false;
        resetOnVideoChange = settings.resetOnVideoChange !== false;
        buttonPosition = settings.buttonPosition || BUTTON_POSITIONS.overlay;
        autoDetectRotation = settings.autoDetectRotation !== false;
      }
    } catch (error) {
      console.warn('RotateScreen: Failed to load settings', error);
    }
  }

  async function loadVideoRotation(videoId) {
    try {
      const result = await chrome.storage.local.get('videoRotations');
      const rotations = result.videoRotations || {};
      return rotations[videoId]?.rotation || null;
    } catch (error) {
      console.warn('RotateScreen: Failed to load video rotation', error);
      return null;
    }
  }

  async function saveVideoRotation(videoId, rotation) {
    if (!rememberRotation || !videoId) return;
    try {
      const result = await chrome.storage.local.get('videoRotations');
      const rotations = result.videoRotations || {};
      rotations[videoId] = { rotation, savedAt: Date.now() };
      await chrome.storage.local.set({ videoRotations: rotations });
    } catch (error) {
      console.warn('RotateScreen: Failed to save video rotation', error);
    }
  }

  // ================== 自動回転検出 ==================
  /**
   * 顔検出による自動回転
   * @param {HTMLVideoElement} video
   * @returns {Promise<boolean>} 自動回転が適用されたか
   */
  async function tryAutoRotation(video) {
    if (!autoDetectRotation || autoDetectionDone) {
      return false;
    }

    // ライブ配信では自動回転をスキップ
    if (isLiveStream()) {
      console.log('RotateScreen: Skipping auto-rotation for live stream');
      autoDetectionDone = true;
      return false;
    }

    // FaceDetectorモジュールが読み込まれているかチェック
    if (!window.RotateScreenFaceDetector) {
      console.log('RotateScreen: Face detector module not loaded');
      return false;
    }

    try {
      const detector = window.RotateScreenFaceDetector;

      // 動画のメタデータが読み込まれるのを待つ
      if (video.readyState < 2) {
        await new Promise((resolve) => {
          const onLoaded = () => {
            video.removeEventListener('loadeddata', onLoaded);
            resolve();
          };
          video.addEventListener('loadeddata', onLoaded);
          // タイムアウト
          setTimeout(resolve, 3000);
        });
      }

      // 少し再生してからフレームを取得（最初のフレームは黒い場合がある）
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('RotateScreen: Attempting auto rotation detection...');
      const result = await detector.detectVideoOrientation(video);

      autoDetectionDone = true;

      if (result.detected && result.rotation !== null && result.rotation !== 0) {
        console.log(`RotateScreen: Auto-detected rotation: ${result.rotation}° (method: ${result.method})`);
        setRotation(result.rotation);

        // 自動検出結果も保存
        const videoId = getCurrentVideoId();
        if (videoId && rememberRotation) {
          saveVideoRotation(videoId, result.rotation);
        }

        showAutoRotationNotification(result.rotation, result.method);
        return true;
      } else {
        console.log('RotateScreen: No rotation needed or detection failed');
      }
    } catch (error) {
      console.warn('RotateScreen: Auto rotation detection error', error);
    }

    return false;
  }

  /**
   * 自動回転通知を表示
   * @param {number} rotation
   * @param {string} method
   */
  function showAutoRotationNotification(rotation, method) {
    // 既存の通知を削除
    const existing = document.querySelector('.rotate-screen-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'rotate-screen-notification';
    notification.innerHTML = `
      <span>自動回転: ${rotation}°</span>
      <span class="rotate-screen-notification-hint">Rキーで調整可能</span>
    `;

    const player = detectPlayer();
    if (player) {
      player.appendChild(notification);

      // 3秒後に非表示
      setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }
  }

  // ================== メインロジック ==================
  function handleRotate() {
    const newRotation = rotateNext();
    const videoId = getCurrentVideoId();
    if (videoId) {
      saveVideoRotation(videoId, newRotation);
    }
  }

  async function setupRotation() {
    injectUI();

    const videoId = getCurrentVideoId();
    const video = detectVideo();

    // 1. まず保存済みの回転をチェック
    if (rememberRotation && videoId) {
      const savedRotation = await loadVideoRotation(videoId);
      if (savedRotation !== null) {
        setRotation(savedRotation);
        autoDetectionDone = true; // 保存済みなら自動検出はスキップ
        return;
      }
    }

    // 2. 保存がなければ自動検出を試行
    if (video && autoDetectRotation) {
      await tryAutoRotation(video);
    }
  }

  function observeVideoChange() {
    let lastVideoId = getCurrentVideoId();

    const observer = new MutationObserver(() => {
      const currentVideoId = getCurrentVideoId();
      if (currentVideoId && currentVideoId !== lastVideoId) {
        lastVideoId = currentVideoId;

        // 動画切り替え時に自動検出フラグをリセット
        autoDetectionDone = false;

        // 動画切り替え時に回転をリセット（設定に応じて）
        if (resetOnVideoChange) {
          currentRotation = DEFAULT_ROTATION;
          const video = detectVideo();
          if (video) {
            removeRotationClasses(video);
          }
        }

        setTimeout(async () => {
          const ready = await waitForPlayer(5000);
          if (ready) setupRotation();
        }, 500);
      }
    });

    const titleElement = document.querySelector('title');
    if (titleElement) {
      observer.observe(titleElement, { childList: true });
    }
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function handleFullscreenChange() {
    setTimeout(() => {
      if (currentRotation !== 0) {
        setRotation(currentRotation);
      }
    }, 100);
  }

  async function initialize() {
    if (!isYouTube()) {
      return;
    }

    await loadSettings();

    const playerReady = await waitForPlayer();
    if (playerReady) {
      await setupRotation();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    observeVideoChange();
  }

  // 初期化実行
  initialize();

})();
