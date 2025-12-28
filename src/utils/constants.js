/**
 * RotateScreen Constants
 * 回転角度とホットキープリセットの定義
 */

// 有効な回転角度
export const ROTATION_ANGLES = [0, 90, 180, 270];

// デフォルト回転角度
export const DEFAULT_ROTATION = 0;

// ホットキープリセット定義
export const HOTKEY_PRESETS = {
  default: {
    id: 'default',
    key: 'r',
    ctrl: false,
    alt: false,
    shift: false,
    description: 'Rキーのみ'
  },
  alt: {
    id: 'alt',
    key: 'r',
    ctrl: false,
    alt: true,
    shift: false,
    description: 'Alt + R'
  },
  ctrl: {
    id: 'ctrl',
    key: 'r',
    ctrl: true,
    alt: false,
    shift: true,
    description: 'Ctrl + Shift + R'
  }
};

// デフォルトのホットキープリセット
export const DEFAULT_HOTKEY_PRESET = 'default';

// ミラー（左右反転）用ホットキープリセット定義
export const MIRROR_HOTKEY_PRESETS = {
  default: {
    id: 'default',
    key: 'h',
    ctrl: false,
    alt: false,
    shift: false,
    description: 'Hキーのみ'
  },
  alt: {
    id: 'alt',
    key: 'h',
    ctrl: false,
    alt: true,
    shift: false,
    description: 'Alt + H'
  },
  ctrl: {
    id: 'ctrl',
    key: 'h',
    ctrl: true,
    alt: false,
    shift: true,
    description: 'Ctrl + Shift + H'
  },
  disabled: {
    id: 'disabled',
    key: null,
    ctrl: false,
    alt: false,
    shift: false,
    description: '無効'
  }
};

// デフォルトのミラーホットキープリセット
export const DEFAULT_MIRROR_HOTKEY_PRESET = 'default';

// ストレージキー
export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  VIDEO_ROTATIONS: 'videoRotations'
};

// ボタン表示位置
export const BUTTON_POSITIONS = {
  overlay: 'overlay',       // オーバーレイ（動画左上）
  controlbar: 'controlbar'  // コントロールバー（YouTube UIに統合）
};

// 自動回転検出方法
export const DETECTION_METHODS = {
  none: 'none',             // 自動検出なし
  face: 'face',             // 顔検出（ローカル処理）
  ai: 'ai'                  // AI判定（Gemini API経由）
};

// AI判定タイムアウト（ミリ秒）
export const AI_DETECTION_TIMEOUT = 10000;  // 10秒

// デフォルト設定
export const DEFAULT_SETTINGS = {
  hotkeyPreset: DEFAULT_HOTKEY_PRESET,
  mirrorHotkeyPreset: DEFAULT_MIRROR_HOTKEY_PRESET,  // ミラー用ショートカット
  rememberRotation: true,
  defaultRotation: DEFAULT_ROTATION,
  resetOnVideoChange: true,  // 別の動画に切り替えたときに回転をリセット
  buttonPosition: BUTTON_POSITIONS.overlay,  // ボタン表示位置
  autoDetectRotation: false,  // 自動回転を有効にするか（実験機能、デフォルトOFF）
  detectionMethod: DETECTION_METHODS.face  // 検出方法（face: 顔検出, ai: AI判定）
};

// メッセージタイプ（Content Script ↔ Background通信）
export const MESSAGE_TYPES = {
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  SAVE_ROTATION: 'SAVE_ROTATION',
  GET_ROTATION: 'GET_ROTATION',
  CLEAR_ALL_ROTATIONS: 'CLEAR_ALL_ROTATIONS'
};

/**
 * 次の回転角度を計算
 * @param {number} currentRotation - 現在の回転角度
 * @returns {number} 次の回転角度
 */
export function getNextRotation(currentRotation) {
  return (currentRotation + 90) % 360;
}

/**
 * 回転角度が有効かチェック
 * @param {number} rotation - チェックする角度
 * @returns {boolean} 有効な角度かどうか
 */
export function isValidRotation(rotation) {
  return ROTATION_ANGLES.includes(rotation);
}
