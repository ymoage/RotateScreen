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
    video: 'video.html5-main-video'
  };

  // ================== 状態 ==================
  let currentRotation = DEFAULT_ROTATION;
  let currentHotkeyPreset = HOTKEY_PRESETS.default;
  let rememberRotation = true;
  let rotateButton = null;

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

  // ================== オーバーレイUI ==================
  const ROTATE_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
    </svg>
  `;

  function createRotateButton() {
    const button = document.createElement('button');
    button.className = 'rotate-screen-btn';
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

  function injectOverlayUI() {
    if (document.querySelector('.rotate-screen-btn')) {
      return true;
    }

    const container = detectVideoContainer() || detectPlayer();
    if (!container) {
      console.warn('RotateScreen: Player container not found');
      return false;
    }

    const containerStyle = window.getComputedStyle(container);
    if (containerStyle.position === 'static') {
      container.style.position = 'relative';
    }

    rotateButton = createRotateButton();
    container.appendChild(rotateButton);
    return true;
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

  // ================== メインロジック ==================
  function handleRotate() {
    const newRotation = rotateNext();
    const videoId = getCurrentVideoId();
    if (videoId) {
      saveVideoRotation(videoId, newRotation);
    }
  }

  async function setupRotation() {
    injectOverlayUI();

    if (rememberRotation) {
      const videoId = getCurrentVideoId();
      if (videoId) {
        const savedRotation = await loadVideoRotation(videoId);
        if (savedRotation !== null) {
          setRotation(savedRotation);
        }
      }
    }
  }

  function observeVideoChange() {
    let lastVideoId = getCurrentVideoId();

    const observer = new MutationObserver(() => {
      const currentVideoId = getCurrentVideoId();
      if (currentVideoId && currentVideoId !== lastVideoId) {
        lastVideoId = currentVideoId;
        currentRotation = DEFAULT_ROTATION;
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
