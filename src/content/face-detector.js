/**
 * Face Detector Module
 * 顔検出による動画の向き判定（実験機能）
 *
 * 検出方法:
 * 1. FaceDetector API（Chrome実験機能、利用可能な場合）
 * 2. 肌色分析によるフォールバック
 */

(function() {
  'use strict';

  // Face Detection APIが利用可能かチェック
  const isFaceDetectionSupported = typeof FaceDetector !== 'undefined';

  /**
   * 顔検出器を初期化
   * @returns {FaceDetector|null}
   */
  function createFaceDetector() {
    if (!isFaceDetectionSupported) {
      console.log('RotateScreen: FaceDetector API not supported, using fallback');
      return null;
    }
    try {
      return new FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
    } catch (e) {
      console.warn('RotateScreen: Failed to create FaceDetector', e);
      return null;
    }
  }

  /**
   * 肌色判定
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {boolean}
   */
  function isSkinColor(r, g, b) {
    // 明度が低すぎる/高すぎるは除外
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 60 || max > 250) return false;

    // 彩度が低すぎる（白/黒/グレー）は除外
    const diff = max - min;
    if (diff < 15) return false;

    // RGBの関係をチェック（肌色はR > G > Bの傾向）
    if (!(r > g && g > b)) return false;
    if ((r - b) < 15) return false;

    // 色相を計算
    let h;
    if (diff === 0) {
      h = 0;
    } else if (max === r) {
      h = 60 * (((g - b) / diff) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / diff + 2);
    } else {
      h = 60 * ((r - g) / diff + 4);
    }
    if (h < 0) h += 360;

    // 肌色の色相範囲（おおよそ0-50度、赤〜オレンジ〜黄色）
    return (h >= 0 && h <= 50) || (h >= 340 && h <= 360);
  }

  /**
   * 肌色分析による向き検出（フォールバック）
   * @param {HTMLVideoElement} video
   * @returns {Promise<{detected: boolean, rotation: number|null, confidence: number}>}
   */
  async function detectByColorAnalysis(video) {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // 分析用に小さいサイズで描画（高速化）
        const analysisSize = 100;
        canvas.width = analysisSize;
        canvas.height = analysisSize;

        ctx.drawImage(video, 0, 0, analysisSize, analysisSize);
        const imageData = ctx.getImageData(0, 0, analysisSize, analysisSize);
        const data = imageData.data;

        // 4分割して各領域の肌色比率を計算
        const regions = {
          top: { skinPixels: 0, total: 0 },
          bottom: { skinPixels: 0, total: 0 },
          left: { skinPixels: 0, total: 0 },
          right: { skinPixels: 0, total: 0 }
        };

        const halfSize = analysisSize / 2;

        for (let y = 0; y < analysisSize; y++) {
          for (let x = 0; x < analysisSize; x++) {
            const i = (y * analysisSize + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const isSkin = isSkinColor(r, g, b);

            // 上半分 / 下半分
            if (y < halfSize) {
              regions.top.total++;
              if (isSkin) regions.top.skinPixels++;
            } else {
              regions.bottom.total++;
              if (isSkin) regions.bottom.skinPixels++;
            }

            // 左半分 / 右半分
            if (x < halfSize) {
              regions.left.total++;
              if (isSkin) regions.left.skinPixels++;
            } else {
              regions.right.total++;
              if (isSkin) regions.right.skinPixels++;
            }
          }
        }

        // 各領域の肌色比率
        const topRatio = regions.top.skinPixels / regions.top.total;
        const bottomRatio = regions.bottom.skinPixels / regions.bottom.total;
        const leftRatio = regions.left.skinPixels / regions.left.total;
        const rightRatio = regions.right.skinPixels / regions.right.total;

        console.log('RotateScreen: Skin color ratios:', {
          top: (topRatio * 100).toFixed(1) + '%',
          bottom: (bottomRatio * 100).toFixed(1) + '%',
          left: (leftRatio * 100).toFixed(1) + '%',
          right: (rightRatio * 100).toFixed(1) + '%'
        });

        // 最低限の肌色が検出されなければ判定不可
        const minSkinThreshold = 0.03; // 3%
        const maxRatio = Math.max(topRatio, bottomRatio, leftRatio, rightRatio);

        if (maxRatio < minSkinThreshold) {
          resolve({ detected: false, rotation: null, confidence: 0 });
          return;
        }

        // 肌色が多い領域を頭部と推定
        const verticalDiff = topRatio - bottomRatio;
        const horizontalDiff = leftRatio - rightRatio;

        // 差の閾値
        const threshold = 0.015; // 1.5%

        // 縦方向の差が大きい場合
        if (Math.abs(verticalDiff) > Math.abs(horizontalDiff) && Math.abs(verticalDiff) > threshold) {
          if (verticalDiff > 0) {
            // 上に肌色が多い = 正立
            resolve({ detected: true, rotation: 0, confidence: 0.6 });
          } else {
            // 下に肌色が多い = 逆さま
            resolve({ detected: true, rotation: 180, confidence: 0.55 });
          }
          return;
        }

        // 横方向の差が大きい場合（動画が横になっている可能性）
        if (Math.abs(horizontalDiff) > threshold) {
          if (horizontalDiff > 0) {
            // 左に肌色が多い = 頭が左 = 90度回転で正立
            resolve({ detected: true, rotation: 90, confidence: 0.6 });
          } else {
            // 右に肌色が多い = 頭が右 = 270度回転で正立
            resolve({ detected: true, rotation: 270, confidence: 0.6 });
          }
          return;
        }

        resolve({ detected: false, rotation: null, confidence: 0 });

      } catch (e) {
        console.warn('RotateScreen: Color analysis failed', e);
        resolve({ detected: false, rotation: null, confidence: 0 });
      }
    });
  }

  /**
   * FaceDetector APIを使った顔検出
   * @param {FaceDetector} detector
   * @param {HTMLVideoElement} video
   * @returns {Promise<{detected: boolean, rotation: number|null, confidence: number}>}
   */
  async function detectByFaceAPI(detector, video) {
    try {
      const faces = await detector.detect(video);

      if (faces.length === 0) {
        return { detected: false, rotation: null, confidence: 0 };
      }

      // 最大の顔を基準にする
      let largestFace = faces[0];
      let maxArea = faces[0].boundingBox.width * faces[0].boundingBox.height;

      for (const face of faces) {
        const area = face.boundingBox.width * face.boundingBox.height;
        if (area > maxArea) {
          maxArea = area;
          largestFace = face;
        }
      }

      const box = largestFace.boundingBox;
      const landmarks = largestFace.landmarks || [];

      console.log('RotateScreen: Face detected, landmarks:', landmarks.length);

      // ランドマークがある場合は目と口の位置関係で判定
      if (landmarks.length >= 3) {
        const result = analyzeFromLandmarks(landmarks);
        if (result.detected) {
          return result;
        }
      }

      // ランドマークがない場合はバウンディングボックスのアスペクト比で判定
      const aspectRatio = box.width / box.height;
      console.log('RotateScreen: Face aspect ratio:', aspectRatio.toFixed(2));

      // 顔は通常縦長（約0.7〜0.9）
      if (aspectRatio >= 0.6 && aspectRatio <= 1.1) {
        return { detected: true, rotation: 0, confidence: 0.7 };
      }

      // 横になっていると横長になる
      if (aspectRatio > 1.2) {
        const centerX = box.x + box.width / 2;
        const videoCenter = video.videoWidth / 2;

        if (centerX < videoCenter) {
          return { detected: true, rotation: 90, confidence: 0.6 };
        } else {
          return { detected: true, rotation: 270, confidence: 0.6 };
        }
      }

      return { detected: true, rotation: 0, confidence: 0.5 };

    } catch (e) {
      console.warn('RotateScreen: Face detection failed', e);
      return { detected: false, rotation: null, confidence: 0 };
    }
  }

  /**
   * ランドマークから向きを分析
   * @param {Array} landmarks
   * @returns {{detected: boolean, rotation: number|null, confidence: number}}
   */
  function analyzeFromLandmarks(landmarks) {
    const eyes = landmarks.filter(l => l.type === 'eye');
    const mouth = landmarks.find(l => l.type === 'mouth');

    if (eyes.length < 2 || !mouth) {
      return { detected: false, rotation: null, confidence: 0 };
    }

    // 両目の中心
    const eyeCenter = {
      x: (eyes[0].locations[0].x + eyes[1].locations[0].x) / 2,
      y: (eyes[0].locations[0].y + eyes[1].locations[0].y) / 2
    };

    // 口の位置
    const mouthPos = mouth.locations[0];

    // 目から口へのベクトル
    const dx = mouthPos.x - eyeCenter.x;
    const dy = mouthPos.y - eyeCenter.y;

    // 角度を計算（正立なら約90度 = 下向き）
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    console.log('RotateScreen: Eye-to-mouth angle:', angle.toFixed(1));

    // 角度から回転を判定
    if (angle >= 45 && angle < 135) {
      return { detected: true, rotation: 0, confidence: 0.9 };
    } else if (angle >= -135 && angle < -45) {
      return { detected: true, rotation: 180, confidence: 0.8 };
    } else if (angle >= -45 && angle < 45) {
      return { detected: true, rotation: 270, confidence: 0.85 };
    } else {
      return { detected: true, rotation: 90, confidence: 0.85 };
    }
  }

  /**
   * 動画の向きを検出（メイン関数）
   * @param {HTMLVideoElement} video
   * @returns {Promise<{detected: boolean, rotation: number|null, method: string, confidence: number}>}
   */
  async function detectVideoOrientation(video) {
    if (!video || video.readyState < 2) {
      return { detected: false, rotation: null, method: 'none', confidence: 0 };
    }

    // まず FaceDetector APIを試す
    const detector = createFaceDetector();
    if (detector) {
      const result = await detectByFaceAPI(detector, video);
      if (result.detected && result.confidence >= 0.5) {
        console.log('RotateScreen: Using FaceDetector API result');
        return {
          detected: true,
          rotation: result.rotation,
          method: 'faceapi',
          confidence: result.confidence
        };
      }
    }

    // フォールバック: 肌色分析ベースの検出
    console.log('RotateScreen: Falling back to color analysis');
    const colorResult = await detectByColorAnalysis(video);
    if (colorResult.detected && colorResult.confidence >= 0.5) {
      return {
        detected: true,
        rotation: colorResult.rotation,
        method: 'color',
        confidence: colorResult.confidence
      };
    }

    return { detected: false, rotation: null, method: 'none', confidence: 0 };
  }

  /**
   * 縦動画かどうかを判定
   * @param {HTMLVideoElement} video
   * @returns {boolean}
   */
  function isPortraitVideo(video) {
    if (!video) return false;
    return video.videoHeight > video.videoWidth;
  }

  // グローバルに公開
  window.RotateScreenFaceDetector = {
    detectVideoOrientation,
    isPortraitVideo,
    isSupported: isFaceDetectionSupported
  };

})();
