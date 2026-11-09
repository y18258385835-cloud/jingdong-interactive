/**
 * 水印服务
 * 可见水印（文字/图片）+ 隐写水印（用户ID追溯）
 * 用于免费版导出强制加水印，以及所有导出的盗版追溯
 */

import {
  DEFAULT_WATERMARK,
  type WatermarkConfig,
  type WatermarkPosition,
  type SteganographyConfig,
} from './types';

class WatermarkService {
  private watermarkImage: HTMLImageElement | null = null;

  /**
   * 在 Canvas 上应用可见水印
   * @param canvas 目标 Canvas
   * @param config 水印配置
   */
  applyWatermark(canvas: HTMLCanvasElement, config: WatermarkConfig = DEFAULT_WATERMARK): void {
    if (!config.enabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    ctx.save();
    ctx.globalAlpha = config.opacity ?? 0.3;

    if (config.type === 'text' || config.type === 'both') {
      this.applyTextWatermark(ctx, width, height, config);
    }

    if (config.type === 'image' || config.type === 'both') {
      this.applyImageWatermark(ctx, width, height, config);
    }

    ctx.restore();
  }

  /**
   * 应用文字水印
   */
  private applyTextWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: WatermarkConfig
  ): void {
    const text = config.text || '鲸动交互平台';
    const fontSize = config.fontSize || 32;
    const fontFamily = config.fontFamily || 'Arial, sans-serif';
    const color = config.color || '#ffffff';
    const position = config.position || 'bottom-right';
    const margin = config.margin || 20;
    const rotation = config.rotation || 0;

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';

    if (position === 'tile') {
      // 平铺水印
      const spacing = config.tileSpacing || 200;
      const textWidth = ctx.measureText(text).width;
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      ctx.translate(width / 2, height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-width / 2, -height / 2);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * spacing - textWidth / 2;
          const y = row * spacing;
          ctx.fillText(text, x, y);
        }
      }
    } else {
      // 单个位置水印
      const pos = this.getPosition(position, width, height, margin);
      ctx.textAlign = this.getTextAlign(position);

      if (rotation !== 0) {
        ctx.translate(pos.x, pos.y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.fillText(text, 0, 0);
      } else {
        ctx.fillText(text, pos.x, pos.y);
      }
    }
  }

  /**
   * 应用图片水印
   */
  private async applyImageWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: WatermarkConfig
  ): Promise<void> {
    if (!config.imageUrl) return;

    try {
      if (!this.watermarkImage || this.watermarkImage.src !== config.imageUrl) {
        this.watermarkImage = await this.loadImage(config.imageUrl);
      }

      const img = this.watermarkImage;
      const imgWidth = config.imageWidth || 120;
      const imgHeight = (img.height / img.width) * imgWidth;
      const position = config.position || 'bottom-right';
      const margin = config.margin || 20;

      const pos = this.getPosition(position, width, height, margin);

      // 调整位置以适应图片尺寸
      let drawX = pos.x;
      let drawY = pos.y;
      if (position.includes('right')) drawX -= imgWidth;
      if (position.includes('bottom')) drawY -= imgHeight;
      if (position === 'center' || position.includes('center')) {
        drawX -= imgWidth / 2;
        drawY -= imgHeight / 2;
      }

      ctx.drawImage(img, drawX, drawY, imgWidth, imgHeight);
    } catch (e) {
      console.warn('图片水印加载失败:', e);
    }
  }

  /**
   * 计算水印位置坐标
   */
  private getPosition(
    position: WatermarkPosition,
    width: number,
    height: number,
    margin: number
  ): { x: number; y: number } {
    const positions: Record<WatermarkPosition, { x: number; y: number }> = {
      'top-left': { x: margin, y: margin },
      'top-center': { x: width / 2, y: margin },
      'top-right': { x: width - margin, y: margin },
      'center-left': { x: margin, y: height / 2 },
      'center': { x: width / 2, y: height / 2 },
      'center-right': { x: width - margin, y: height / 2 },
      'bottom-left': { x: margin, y: height - margin },
      'bottom-center': { x: width / 2, y: height - margin },
      'bottom-right': { x: width - margin, y: height - margin },
      'tile': { x: 0, y: 0 },
    };
    return positions[position] || positions['bottom-right'];
  }

  /**
   * 获取文字对齐方式
   */
  private getTextAlign(position: WatermarkPosition): CanvasTextAlign {
    if (position.includes('left')) return 'left';
    if (position.includes('right')) return 'right';
    return 'center';
  }

  /**
   * 加载图片
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = url;
    });
  }

  // ==================== 隐写水印（LSB 最低有效位） ====================

  /**
   * 嵌入隐写水印（将用户信息隐藏在图片像素的最低有效位）
   * 用于盗版追溯，肉眼不可见
   */
  embedSteganography(canvas: HTMLCanvasElement, config: SteganographyConfig): void {
    if (!config.enabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // 构建要嵌入的信息字符串
    const message = JSON.stringify({
      u: config.userId,
      p: config.projectId,
      t: config.timestamp,
    });

    // 将字符串转换为二进制
    const binaryMessage = this.stringToBinary(message);
    const messageLength = binaryMessage.length;

    // 先写入消息长度（32位）
    const lengthBinary = messageLength.toString(2).padStart(32, '0');

    let bitIndex = 0;
    const totalBits = 32 + messageLength;

    // 检查是否有足够的像素
    if (totalBits > data.length / 4) {
      console.warn('图片尺寸不足以嵌入隐写水印');
      return;
    }

    // 嵌入长度和消息到红色通道的最低有效位
    for (let i = 0; i < totalBits && bitIndex < data.length; i += 4) {
      const bit = i < 32 ? lengthBinary[i] : binaryMessage[i - 32];
      // 清除最低有效位，然后设置
      data[i] = (data[i] & 0xFE) | (bit === '1' ? 1 : 0);
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * 提取隐写水印
   */
  extractSteganography(canvas: HTMLCanvasElement): SteganographyConfig | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // 读取消息长度（前32位）
    let lengthBinary = '';
    for (let i = 0; i < 32 * 4; i += 4) {
      lengthBinary += (data[i] & 1).toString();
    }
    const messageLength = parseInt(lengthBinary, 2);

    // 验证长度是否合理
    if (messageLength <= 0 || messageLength > 10000) {
      return null;
    }

    // 读取消息内容
    let messageBinary = '';
    const startIndex = 32 * 4;
    for (let i = 0; i < messageLength; i++) {
      const pixelIndex = startIndex + i * 4;
      if (pixelIndex >= data.length) break;
      messageBinary += (data[pixelIndex] & 1).toString();
    }

    try {
      const message = this.binaryToString(messageBinary);
      const parsed = JSON.parse(message);
      return {
        enabled: true,
        userId: parsed.u,
        projectId: parsed.p,
        timestamp: parsed.t,
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * 字符串转二进制
   */
  private stringToBinary(str: string): string {
    let binary = '';
    for (let i = 0; i < str.length; i++) {
      binary += str.charCodeAt(i).toString(2).padStart(8, '0');
    }
    return binary;
  }

  /**
   * 二进制转字符串
   */
  private binaryToString(binary: string): string {
    let str = '';
    for (let i = 0; i < binary.length; i += 8) {
      const byte = binary.slice(i, i + 8);
      if (byte.length === 8) {
        str += String.fromCharCode(parseInt(byte, 2));
      }
    }
    return str;
  }

  // ==================== 视频水印 ====================

  /**
   * 为视频帧应用水印（在视频编码前对每一帧调用）
   */
  applyVideoFrameWatermark(
    canvas: HTMLCanvasElement,
    config: WatermarkConfig,
    frameIndex: number,
    totalFrames: number
  ): void {
    // 可以根据帧索引调整水印位置/透明度，防止被裁剪
    const animatedConfig = { ...config };

    // 可选：水印在视频中缓慢移动，防止被静态裁剪
    // if (config.position === 'tile') {
    //   animatedConfig.rotation = (frameIndex / totalFrames) * 360;
    // }

    this.applyWatermark(canvas, animatedConfig);
  }

  /**
   * 为 HTML 导出生成水印 CSS
   */
  generateHTMLWatermarkCSS(config: WatermarkConfig): string {
    if (!config.enabled) return '';

    const positionMap: Record<string, string> = {
      'top-left': 'top: 20px; left: 20px;',
      'top-center': 'top: 20px; left: 50%; transform: translateX(-50%);',
      'top-right': 'top: 20px; right: 20px;',
      'center-left': 'top: 50%; left: 20px; transform: translateY(-50%);',
      'center': 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
      'center-right': 'top: 50%; right: 20px; transform: translateY(-50%);',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'bottom-center': 'bottom: 20px; left: 50%; transform: translateX(-50%);',
      'bottom-right': 'bottom: 20px; right: 20px;',
      'tile': '',
    };

    if (config.position === 'tile') {
      return `
        .aether-watermark {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          z-index: 9999;
          background-image: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 200px,
            rgba(255,255,255,${config.opacity || 0.1}) 200px,
            rgba(255,255,255,${config.opacity || 0.1}) 201px
          );
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 200px;
        }
        .aether-watermark span {
          color: ${config.color || '#fff'};
          font-size: ${config.fontSize || 32}px;
          opacity: ${config.opacity || 0.3};
          transform: rotate(-30deg);
          font-family: ${config.fontFamily || 'Arial'};
        }
      `;
    }

    return `
      .aether-watermark {
        position: fixed;
        ${positionMap[config.position || 'bottom-right']}
        pointer-events: none;
        z-index: 9999;
        color: ${config.color || '#fff'};
        font-size: ${config.fontSize || 32}px;
        opacity: ${config.opacity || 0.3};
        font-family: ${config.fontFamily || 'Arial'};
        transform: rotate(${config.rotation || 0}deg);
      }
    `;
  }

  /**
   * 生成 HTML 水印元素
   */
  generateHTMLWatermarkElement(config: WatermarkConfig): string {
    if (!config.enabled) return '';

    if (config.position === 'tile') {
      const repeats = 20;
      let spans = '';
      for (let i = 0; i < repeats; i++) {
        spans += `<span>${config.text || '鲸动交互平台'}</span>`;
      }
      return `<div class="aether-watermark">${spans}</div>`;
    }

    return `<div class="aether-watermark">${config.text || '鲸动交互平台'}</div>`;
  }

  /**
   * 清除缓存的水印图片
   */
  clearCache(): void {
    this.watermarkImage = null;
  }
}

/** 单例导出 */
export const watermarkService = new WatermarkService();
