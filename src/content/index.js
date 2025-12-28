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

  // ミラー（左右反転）用ホットキープリセット
  const MIRROR_HOTKEY_PRESETS = {
    default: { key: 'h', ctrl: false, alt: false, shift: false },
    alt: { key: 'h', ctrl: false, alt: true, shift: false },
    ctrl: { key: 'h', ctrl: true, alt: false, shift: true },
    disabled: { key: null, ctrl: false, alt: false, shift: false }
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

  // 検出方法
  const DETECTION_METHODS = {
    none: 'none',
    face: 'face',
    ai: 'ai'
  };

  // AI判定タイムアウト（ミリ秒）
  const AI_DETECTION_TIMEOUT = 10000;

  // フリー回転設定
  const FREE_ROTATION_INTERVAL = 50; // 回転更新間隔（ミリ秒）
  const FREE_ROTATION_SPEED = 3; // 1回あたりの回転角度（度）

  // ================== 状態 ==================
  let currentRotation = DEFAULT_ROTATION;
  let currentFreeRotation = 0; // フリー回転の現在角度
  let isFreeRotationMode = false; // フリー回転モードかどうか
  let isMirrored = false; // ミラー（左右反転）状態
  let currentHotkeyPreset = HOTKEY_PRESETS.default;
  let currentMirrorHotkeyPreset = MIRROR_HOTKEY_PRESETS.default;
  let rememberRotation = true;
  let resetOnVideoChange = true;
  let buttonPosition = BUTTON_POSITIONS.overlay;
  let autoDetectRotation = false; // 自動回転検出（実験機能、デフォルトOFF）
  let detectionMethod = DETECTION_METHODS.face; // 検出方法
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
  const ROTATION_CLASSES = ['rotate-screen-90', 'rotate-screen-180', 'rotate-screen-270', 'rotate-screen-free'];
  const MIRROR_CLASS = 'rotate-screen-mirror';

  function removeRotationClasses(video) {
    video.classList.remove('rotate-screen-active', ...ROTATION_CLASSES);
    video.style.removeProperty('--rotate-screen-scale');
    video.style.removeProperty('--rotate-screen-free-angle');
    video.style.removeProperty('--rotate-screen-free-scale');
    // ミラークラスは残す（回転とミラーは独立）
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
    // フリー回転もリセット
    currentFreeRotation = 0;
    isFreeRotationMode = false;
    // ミラーもリセット
    setMirror(false);
  }

  // ================== フリー回転 ==================
  /**
   * フリー回転を設定（任意の角度）
   * @param {number} angle - 回転角度（0-360の範囲外も可）
   */
  function setFreeRotation(angle) {
    const video = detectVideo();
    if (!video) {
      console.warn('RotateScreen: Video element not found');
      return false;
    }

    // 既存の回転クラスを削除
    removeRotationClasses(video);

    // 正規化（0-360の範囲に収める）
    const normalizedAngle = ((angle % 360) + 360) % 360;

    // フリー回転用のCSS変数を設定
    const videoWidth = video.offsetWidth || video.clientWidth || video.getBoundingClientRect().width;
    const videoHeight = video.offsetHeight || video.clientHeight || video.getBoundingClientRect().height;

    let scale = 1;
    if (videoWidth > 0 && videoHeight > 0) {
      // 回転角度に応じてスケールを計算
      const radians = (normalizedAngle * Math.PI) / 180;
      const sin = Math.abs(Math.sin(radians));
      const cos = Math.abs(Math.cos(radians));

      // 回転後のバウンディングボックスがコンテナに収まるようにスケール
      const newWidth = videoWidth * cos + videoHeight * sin;
      const newHeight = videoWidth * sin + videoHeight * cos;

      const scaleX = videoWidth / newWidth;
      const scaleY = videoHeight / newHeight;
      scale = Math.min(scaleX, scaleY);
    }

    video.style.setProperty('--rotate-screen-free-angle', `${normalizedAngle}deg`);
    video.style.setProperty('--rotate-screen-free-scale', scale);
    video.classList.add('rotate-screen-active', 'rotate-screen-free');

    currentFreeRotation = normalizedAngle;
    isFreeRotationMode = true;
    updateButtonState(Math.round(normalizedAngle));
    return true;
  }

  /**
   * フリー回転をクリア
   */
  function clearFreeRotation() {
    const video = detectVideo();
    if (video) {
      video.classList.remove('rotate-screen-free');
      video.style.removeProperty('--rotate-screen-free-angle');
      video.style.removeProperty('--rotate-screen-free-scale');
    }
    isFreeRotationMode = false;
  }

  // ================== ミラー（左右反転） ==================
  /**
   * ミラー状態を設定
   * @param {boolean} mirrored - ミラー状態
   */
  function setMirror(mirrored) {
    const video = detectVideo();
    if (!video) {
      console.warn('RotateScreen: Video element not found');
      return false;
    }

    if (mirrored) {
      video.classList.add(MIRROR_CLASS);
    } else {
      video.classList.remove(MIRROR_CLASS);
    }

    isMirrored = mirrored;
    updateButtonState(isFreeRotationMode ? currentFreeRotation : currentRotation);
    return true;
  }

  /**
   * ミラー状態をトグル
   */
  function toggleMirror() {
    const newState = !isMirrored;
    setMirror(newState);
    showNotification(newState ? '左右反転: ON' : '左右反転: OFF', 'info');
    return newState;
  }

  // ================== UI ==================
  const ROTATE_ICON_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
    </svg>
  `;

  /**
   * AI判定が利用可能かチェック
   * detectionMethodが'none'の場合はAI判定を使用しない
   */
  function isAIDetectionAvailable() {
    // 検出方法が'none'の場合はAI判定を使用しない
    if (detectionMethod === DETECTION_METHODS.none) {
      return false;
    }
    if (!window.RotateScreenAIDetector) {
      return false;
    }
    return window.RotateScreenAIDetector.isConfigured();
  }

  function createRotateButton(isControlbar = false) {
    const button = document.createElement('button');
    button.className = isControlbar ? 'ytp-button rotate-screen-controlbar-btn' : 'rotate-screen-btn';
    button.title = '動画を回転 (Rキー)\n長押し: フリー回転\n右クリック: AI判定\nHキー: 左右反転';
    button.innerHTML = ROTATE_ICON_SVG;
    button.setAttribute('data-rotation', '0°');

    // 長押し検出用
    let pressTimer = null;
    let freeRotationTimer = null;
    let isLongPress = false;
    let isFreeRotating = false;
    const LONG_PRESS_DURATION = 300; // 300msで長押し開始

    /**
     * フリー回転を開始
     */
    const startFreeRotation = () => {
      isLongPress = true;
      isFreeRotating = true;

      // 現在の回転角度から開始
      let startAngle = currentFreeRotation;
      if (!isFreeRotationMode) {
        startAngle = currentRotation;
      }

      // 回転中の通知を表示
      showFreeRotationIndicator(startAngle);

      // 一定間隔で回転
      freeRotationTimer = setInterval(() => {
        startAngle = (startAngle + FREE_ROTATION_SPEED) % 360;
        setFreeRotation(startAngle);
        updateFreeRotationIndicator(startAngle);
      }, FREE_ROTATION_INTERVAL);
    };

    /**
     * フリー回転を停止
     */
    const stopFreeRotation = () => {
      if (freeRotationTimer) {
        clearInterval(freeRotationTimer);
        freeRotationTimer = null;
      }
      isFreeRotating = false;

      // インジケータを非表示
      hideFreeRotationIndicator();

      // 保存
      if (isFreeRotationMode) {
        const videoId = getCurrentVideoId();
        if (videoId && rememberRotation) {
          saveFreeVideoRotation(videoId, currentFreeRotation);
        }
      }
    };

    const startLongPress = (e) => {
      // 右クリックの場合は長押しを開始しない（contextmenuで処理）
      if (e.button === 2) return;

      isLongPress = false;
      pressTimer = setTimeout(() => {
        // 左クリック長押しは常にフリー回転
        startFreeRotation();
      }, LONG_PRESS_DURATION);
    };

    const cancelLongPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      if (isFreeRotating) {
        stopFreeRotation();
      }
    };

    // マウスイベント
    button.addEventListener('mousedown', startLongPress);
    button.addEventListener('mouseup', cancelLongPress);
    button.addEventListener('mouseleave', cancelLongPress);

    // タッチイベント（モバイル対応）
    button.addEventListener('touchstart', startLongPress);
    button.addEventListener('touchend', cancelLongPress);
    button.addEventListener('touchcancel', cancelLongPress);

    // クリック（長押しでなければ通常の回転）
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isLongPress) {
        // フリー回転モードの場合はクリアして通常回転に戻る
        if (isFreeRotationMode) {
          clearFreeRotation();
        }
        handleRotate();
      }
      isLongPress = false;
    });

    // ダブルクリックでリセット
    button.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetRotation();
    });

    // 右クリックでAI判定
    button.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleManualAIDetection();
    });

    return button;
  }

  // ================== フリー回転インジケータ ==================
  let freeRotationIndicator = null;

  function showFreeRotationIndicator(angle) {
    hideFreeRotationIndicator();

    const player = detectPlayer();
    if (!player) return;

    freeRotationIndicator = document.createElement('div');
    freeRotationIndicator.className = 'rotate-screen-free-indicator';
    freeRotationIndicator.innerHTML = `
      <div class="rotate-screen-free-indicator-angle">${Math.round(angle)}°</div>
      <div class="rotate-screen-free-indicator-hint">離すと停止</div>
    `;
    player.appendChild(freeRotationIndicator);
  }

  function updateFreeRotationIndicator(angle) {
    if (freeRotationIndicator) {
      const angleEl = freeRotationIndicator.querySelector('.rotate-screen-free-indicator-angle');
      if (angleEl) {
        angleEl.textContent = `${Math.round(angle)}°`;
      }
    }
  }

  function hideFreeRotationIndicator() {
    if (freeRotationIndicator) {
      freeRotationIndicator.classList.add('fade-out');
      setTimeout(() => {
        if (freeRotationIndicator) {
          freeRotationIndicator.remove();
          freeRotationIndicator = null;
        }
      }, 300);
    }
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

    // 回転ショートカット
    if (matchesHotkey(event, currentHotkeyPreset)) {
      event.preventDefault();
      event.stopPropagation();
      handleRotate();
      return;
    }

    // ミラーショートカット（無効でなければ）
    if (currentMirrorHotkeyPreset.key !== null && matchesHotkey(event, currentMirrorHotkeyPreset)) {
      event.preventDefault();
      event.stopPropagation();
      toggleMirror();
      return;
    }
  }

  // ================== ストレージ ==================
  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get('settings');
      console.log('RotateScreen: Loaded settings', result.settings);
      if (result.settings) {
        const settings = result.settings;
        currentHotkeyPreset = HOTKEY_PRESETS[settings.hotkeyPreset] || HOTKEY_PRESETS.default;
        currentMirrorHotkeyPreset = MIRROR_HOTKEY_PRESETS[settings.mirrorHotkeyPreset] || MIRROR_HOTKEY_PRESETS.default;
        rememberRotation = settings.rememberRotation !== false;
        resetOnVideoChange = settings.resetOnVideoChange !== false;
        buttonPosition = settings.buttonPosition || BUTTON_POSITIONS.overlay;
        autoDetectRotation = settings.autoDetectRotation === true;
        detectionMethod = settings.detectionMethod || DETECTION_METHODS.face;
        console.log('RotateScreen: Applied settings', {
          autoDetectRotation,
          detectionMethod,
          mirrorHotkeyPreset: settings.mirrorHotkeyPreset
        });
      }
    } catch (error) {
      console.warn('RotateScreen: Failed to load settings', error);
    }
  }

  async function loadVideoRotation(videoId) {
    try {
      const result = await chrome.storage.local.get('videoRotations');
      const rotations = result.videoRotations || {};
      const saved = rotations[videoId];
      if (!saved) return null;

      // フリー回転が保存されている場合
      if (saved.freeRotation !== undefined) {
        return { type: 'free', angle: saved.freeRotation };
      }
      // 通常回転が保存されている場合
      if (saved.rotation !== undefined) {
        return { type: 'normal', angle: saved.rotation };
      }
      return null;
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

  async function saveFreeVideoRotation(videoId, freeRotation) {
    if (!rememberRotation || !videoId) return;
    try {
      const result = await chrome.storage.local.get('videoRotations');
      const rotations = result.videoRotations || {};
      rotations[videoId] = { freeRotation, savedAt: Date.now() };
      await chrome.storage.local.set({ videoRotations: rotations });
    } catch (error) {
      console.warn('RotateScreen: Failed to save free rotation', error);
    }
  }

  // ================== 自動回転検出 ==================
  /**
   * AI判定による向き検出
   * @param {HTMLVideoElement} video
   * @returns {Promise<object>} 検出結果
   */
  async function tryAIDetection(video) {
    console.log('RotateScreen: tryAIDetection called');

    // AI Detectorモジュールが読み込まれているかチェック
    if (!window.RotateScreenAIDetector) {
      console.log('RotateScreen: AI detector module not loaded');
      return { detected: false, rotation: null, method: 'ai', error: 'Module not loaded' };
    }

    const aiDetector = window.RotateScreenAIDetector;
    console.log('RotateScreen: AI detector config', aiDetector.getConfig());

    // APIが設定されているかチェック
    if (!aiDetector.isConfigured()) {
      console.log('RotateScreen: AI detector API endpoint not configured');
      return { detected: false, rotation: null, method: 'ai', error: 'API not configured' };
    }

    try {
      console.log('RotateScreen: Attempting AI detection...');
      const result = await aiDetector.detectVideoOrientation(video, {
        timeout: AI_DETECTION_TIMEOUT
      });
      return result;
    } catch (error) {
      console.warn('RotateScreen: AI detection error', error);
      return { detected: false, rotation: null, method: 'ai', error: error.message };
    }
  }

  /**
   * 顔検出による向き検出
   * @param {HTMLVideoElement} video
   * @returns {Promise<object>} 検出結果
   */
  async function tryFaceDetection(video) {
    // FaceDetectorモジュールが読み込まれているかチェック
    if (!window.RotateScreenFaceDetector) {
      console.log('RotateScreen: Face detector module not loaded');
      return { detected: false, rotation: null, method: 'face', error: 'Module not loaded' };
    }

    try {
      console.log('RotateScreen: Attempting face detection...');
      const result = await window.RotateScreenFaceDetector.detectVideoOrientation(video);
      return result;
    } catch (error) {
      console.warn('RotateScreen: Face detection error', error);
      return { detected: false, rotation: null, method: 'face', error: error.message };
    }
  }

  /**
   * 自動回転検出を実行
   * @param {HTMLVideoElement} video
   * @returns {Promise<boolean>} 自動回転が適用されたか
   */
  async function tryAutoRotation(video) {
    console.log('RotateScreen: tryAutoRotation called', {
      autoDetectRotation,
      autoDetectionDone,
      detectionMethod
    });

    if (!autoDetectRotation || autoDetectionDone) {
      console.log('RotateScreen: Auto rotation skipped', { autoDetectRotation, autoDetectionDone });
      return false;
    }

    // ライブ配信では自動回転をスキップ
    if (isLiveStream()) {
      console.log('RotateScreen: Skipping auto-rotation for live stream');
      autoDetectionDone = true;
      return false;
    }

    // 動画のメタデータが読み込まれるのを待つ
    if (video.readyState < 2) {
      console.log('RotateScreen: Waiting for video to load, readyState:', video.readyState);
      await new Promise((resolve) => {
        const onLoaded = () => {
          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('canplay', onLoaded);
          resolve();
        };
        video.addEventListener('loadeddata', onLoaded);
        video.addEventListener('canplay', onLoaded);
        // タイムアウト
        setTimeout(resolve, 5000);
      });
      console.log('RotateScreen: Video loaded, readyState:', video.readyState);
    }

    // 動画サイズが取得できるまで待つ
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('RotateScreen: Waiting for video dimensions...');
      await new Promise((resolve) => {
        const checkDimensions = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            resolve();
          } else {
            setTimeout(checkDimensions, 100);
          }
        };
        checkDimensions();
        setTimeout(resolve, 3000); // 最大3秒待つ
      });
    }

    // 少し再生してからフレームを取得（最初のフレームは黒い場合がある）
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('RotateScreen: Attempting auto rotation detection (face detection)...');

    // 顔検出を試行（自動検出は顔検出のみ）
    const result = await tryFaceDetection(video);

    autoDetectionDone = true;

    if (result && result.detected && result.rotation !== null && result.rotation !== 0) {
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

    const methodLabel = method === 'ai' ? 'AI判定' : '顔検出';

    const notification = document.createElement('div');
    notification.className = 'rotate-screen-notification';
    notification.innerHTML = `
      <span>自動回転: ${rotation}° (${methodLabel})</span>
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

  /**
   * 手動でAI判定を実行
   */
  async function handleManualAIDetection() {
    const video = detectVideo();
    if (!video) {
      showNotification('動画が見つかりません', 'error');
      return;
    }

    // 検出方法がnoneの場合はAI判定を実行しない
    if (detectionMethod === DETECTION_METHODS.none) {
      showNotification('AI判定は無効に設定されています\n長押しでフリー回転が使えます', 'info');
      return;
    }

    // AI Detectorモジュールが読み込まれているかチェック
    if (!window.RotateScreenAIDetector) {
      showNotification('AI判定モジュールが読み込まれていません\n長押しでフリー回転が使えます', 'info');
      return;
    }

    const aiDetector = window.RotateScreenAIDetector;

    // APIが設定されているかチェック
    if (!aiDetector.isConfigured()) {
      showNotification('AI判定のAPIが設定されていません\n長押しでフリー回転が使えます', 'info');
      return;
    }

    // 実行中通知
    showNotification('AI判定を実行中...', 'loading');

    // 動画の準備を待つ
    if (video.readyState < 2 || video.videoWidth === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      console.log('RotateScreen: Manual AI detection started');
      const result = await aiDetector.detectVideoOrientation(video, {
        timeout: AI_DETECTION_TIMEOUT
      });

      if (result.detected && result.rotation !== null) {
        console.log(`RotateScreen: AI detected rotation=${result.rotation}°, currentRotation=${currentRotation}°`);

        // AIの結果を直接適用（元動画に対する絶対的な回転角度）
        const applied = setRotation(result.rotation);
        console.log(`RotateScreen: setRotation(${result.rotation}) returned ${applied}`);

        // 結果を保存
        const videoId = getCurrentVideoId();
        if (videoId && rememberRotation) {
          saveVideoRotation(videoId, result.rotation);
        }

        if (result.rotation === 0) {
          showNotification('AI判定: 正しい向きです（回転不要）', 'success');
        } else {
          showNotification(`AI判定: ${result.rotation}°に回転しました`, 'success');
        }
      } else {
        const errorMsg = result.error || '回転が必要ないか判定できませんでした';
        showNotification(`AI判定: ${errorMsg}`, 'warning');
      }
    } catch (error) {
      console.error('RotateScreen: Manual AI detection error', error);
      showNotification(`AI判定エラー: ${error.message}`, 'error');
    }
  }

  /**
   * 通知を表示
   * @param {string} message
   * @param {string} type - 'success' | 'error' | 'warning' | 'loading'
   */
  function showNotification(message, type = 'info') {
    // 既存の通知を削除
    const existing = document.querySelector('.rotate-screen-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `rotate-screen-notification rotate-screen-notification-${type}`;
    notification.innerHTML = `<span>${message}</span>`;

    const player = detectPlayer();
    if (player) {
      player.appendChild(notification);

      // loading以外は3秒後に非表示
      if (type !== 'loading') {
        setTimeout(() => {
          notification.classList.add('fade-out');
          setTimeout(() => notification.remove(), 300);
        }, 3000);
      }
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
        if (savedRotation.type === 'free') {
          // フリー回転を復元
          setFreeRotation(savedRotation.angle);
        } else {
          // 通常回転を復元
          setRotation(savedRotation.angle);
        }
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
          currentFreeRotation = 0;
          isFreeRotationMode = false;
          isMirrored = false;
          const video = detectVideo();
          if (video) {
            removeRotationClasses(video);
            video.classList.remove(MIRROR_CLASS);
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
      if (isFreeRotationMode) {
        // フリー回転モードの場合はフリー回転を復元
        setFreeRotation(currentFreeRotation);
      } else if (currentRotation !== 0) {
        setRotation(currentRotation);
      }
      // ミラー状態を復元
      if (isMirrored) {
        setMirror(true);
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
