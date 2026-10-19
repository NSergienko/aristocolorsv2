/** AristoColors — non-destructive 2D lighting, sci-fi enhanced. */
export type BlendMode = 'screen' | 'multiply' | 'soft-light';

export interface LightingParams {
  x: number;
  y: number;
  angle: number;
  intensity: number;
  radius: number;
  softness: number;
  color: string;
  blendMode: BlendMode;
}

export class LightingEngine {
  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private static finite(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
  }

  private static smoothstep(t: number): number {
    const x = this.clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }

  private static parseColor(color: string): [number, number, number, number] {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [1, 1, 1, 1];
    ctx.fillStyle = '#ffffff';
    try {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const rgba = ctx.getImageData(0, 0, 1, 1).data;
      return [rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3] / 255];
    } catch {
      return [1, 1, 1, 1];
    }
  }

  private static blendChannel(base: number, light: number, mode: BlendMode): number {
    if (mode === 'screen') return 1 - (1 - base) * (1 - light);
    if (mode === 'multiply') return base * light;
    if (light <= 0.5) return base - (1 - 2 * light) * base * (1 - base);
    const d = base <= 0.25
      ? ((16 * base - 12) * base + 4) * base
      : Math.sqrt(base);
    return base + (2 * light - 1) * (d - base);
  }

  private static sampleMask(maskData: ImageData, u: number, v: number): number {
    const { width, height, data } = maskData;
    const x = this.clamp(u, 0, width - 1);
    const y = this.clamp(v, 0, height - 1);
    const x1 = Math.floor(x);
    const y1 = Math.floor(y);
    const x2 = Math.min(x1 + 1, width - 1);
    const y2 = Math.min(y1 + 1, height - 1);
    const fx = x - x1;
    const fy = y - y1;

    const getVal = (ix: number, iy: number) => {
      const idx = (iy * width + ix) * 4;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;
      const a = data[idx + 3] / 255;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) * a;
    };

    const v1 = getVal(x1, y1) * (1 - fx) + getVal(x2, y1) * fx;
    const v2 = getVal(x1, y2) * (1 - fx) + getVal(x2, y2) * fx;
    return v1 * (1 - fy) + v2 * fy;
  }

  private static getSourceDimensions(source: CanvasImageSource): { width: number; height: number } {
    let width = 0;
    let height = 0;

    if (source instanceof HTMLCanvasElement || (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas)) {
      width = source.width;
      height = source.height;
    } else if (source instanceof HTMLVideoElement) {
      width = source.videoWidth;
      height = source.videoHeight;
    } else if (source instanceof HTMLImageElement || (typeof SVGImageElement !== 'undefined' && source instanceof SVGImageElement)) {
      width = source.naturalWidth;
      height = source.naturalHeight;
    } else if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
      width = source.width;
      height = source.height;
    }

    if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error('LightingEngine: Invalid or unsupported mask dimensions.');
    }

    return { width, height };
  }

  public static render(
    source: HTMLCanvasElement,
    params: LightingParams,
    maskSource?: CanvasImageSource | null
  ): HTMLCanvasElement {
    const width = source.width;
    const height = source.height;
    const result = document.createElement('canvas');
    result.width = width;
    result.height = height;
    const resultCtx = result.getContext('2d', { willReadFrequently: true });
    if (!resultCtx) throw new Error('LightingEngine: Cannot create output context.');
    if (width === 0 || height === 0) return result;
    const sourceCtx = source.getContext('2d', { willReadFrequently: true });
    if (!sourceCtx) throw new Error('LightingEngine: Cannot read source context.');
    const original = sourceCtx.getImageData(0, 0, width, height);
    
    let maskData: ImageData | null = null;
    if (maskSource) {
      const { width: maskW, height: maskH } = this.getSourceDimensions(maskSource);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = maskW;
      tempCanvas.height = maskH;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempCtx) throw new Error('LightingEngine: Cannot create mask context.');
      try {
        tempCtx.drawImage(maskSource, 0, 0, maskW, maskH);
        maskData = tempCtx.getImageData(0, 0, maskW, maskH);
      } catch (e) {
        throw new Error('LightingEngine: Failed to rasterize mask: ' + (e as Error).message);
      }
    }

    const output = new ImageData(new Uint8ClampedArray(original.data), width, height);
    const intensity = this.clamp(this.finite(params.intensity, 0), 0, 1);
    const softness = this.clamp(this.finite(params.softness, 0.5), 0, 1);
    const radius = Math.max(1, this.finite(params.radius, 10));
    const x = this.finite(params.x, width / 2);
    const y = this.finite(params.y, height / 2);
    const angle = this.finite(params.angle, 0);
    const mode: BlendMode = params.blendMode === 'multiply' || params.blendMode === 'soft-light'
      ? params.blendMode : 'screen';
    const [lightR, lightG, lightB, lightAlpha] = this.parseColor(params.color);
    if (intensity <= 0 || lightAlpha <= 0) {
      resultCtx.putImageData(output, 0, 0);
      return result;
    }

    const radians = (angle * Math.PI) / 180;
    const cosA = Math.cos(radians);
    const sinA = Math.sin(radians);

    const sigmaMajor = radius;
    const sigmaMinor = radius * (0.2 + 0.6 * (1 - softness));

    const shadowX = x - cosA * radius * 0.5;
    const shadowY = y - sinA * radius * 0.5;
    const shadowSigmaMajor = sigmaMajor * 1.5;
    const shadowSigmaMinor = sigmaMinor * 1.5;

    const input = original.data;
    const target = output.data;
    const strengthScale = intensity * lightAlpha;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const index = (py * width + px) * 4;
        if (input[index + 3] === 0) continue;
        
        const dx = px - x;
        const dy = py - y;
        
        const u = dx * cosA + dy * sinA;
        const v = -dx * sinA + dy * cosA;
        const uAsym = u * (1 + 0.15 * this.clamp(u / radius, -1, 1));
        const field = Math.exp(-0.5 * ((uAsym / sigmaMajor) ** 2 + (v / sigmaMinor) ** 2));

        const baseR = input[index] / 255;
        const baseG = input[index + 1] / 255;
        const baseB = input[index + 2] / 255;

        const luminance = 0.2126 * baseR + 0.7152 * baseG + 0.0722 * baseB;
        const protect = 1 - this.smoothstep(this.clamp((luminance - 0.6) / 0.35, 0, 1));
        const influence = strengthScale * field * protect;
        
        let litR = baseR;
        let litG = baseG;
        let litB = baseB;
        
        if (mode === 'screen') {
          if (field > 0.001) {
            const screenInfluence = this.clamp(influence * 1.2, 0, 1);
            litR = baseR + (1 - baseR) * (screenInfluence * lightR);
            litG = baseG + (1 - baseG) * (screenInfluence * lightG);
            litB = baseB + (1 - baseB) * (screenInfluence * lightB);
          }
        } else if (mode === 'multiply') {
          const litR_m = baseR * (1 - influence * (1 - lightR));
          const litG_m = baseG * (1 - influence * (1 - lightG));
          const litB_m = baseB * (1 - influence * (1 - lightB));
          const dxSh = px - shadowX;
          const dySh = py - shadowY;
          const uSh = dxSh * cosA + dySh * sinA;
          const vSh = -dxSh * sinA + dySh * cosA;
          const shadowField = Math.exp(-0.5 * ((uSh / shadowSigmaMajor) ** 2 + (vSh / shadowSigmaMinor) ** 2));
          const shadowMask = this.smoothstep(this.clamp(-u / (radius * 0.5), 0, 1));
          const shadowStrength = this.clamp(strengthScale * shadowField * shadowMask * 0.2, 0, 0.2);
          litR = litR_m * (1 - shadowStrength);
          litG = litG_m * (1 - shadowStrength);
          litB = litB_m * (1 - shadowStrength);
        } else {
          if (field > 0.001) {
            const softInfluence = Math.pow(influence, 0.8);
            litR = baseR + (this.blendChannel(baseR, lightR, 'soft-light') - baseR) * softInfluence;
            litG = baseG + (this.blendChannel(baseG, lightG, 'soft-light') - baseG) * softInfluence;
            litB = baseB + (this.blendChannel(baseB, lightB, 'soft-light') - baseB) * softInfluence;
          }
        }
        
        const maskU = ((px + 0.5) * (maskData ? maskData.width : 1) / width) - 0.5;
        const maskV = ((py + 0.5) * (maskData ? maskData.height : 1) / height) - 0.5;
        const weight = maskData ? this.sampleMask(maskData, maskU, maskV) : 1;

        target[index] = Math.round(this.clamp(baseR + (litR - baseR) * weight, 0, 1) * 255);
        target[index + 1] = Math.round(this.clamp(baseG + (litG - baseG) * weight, 0, 1) * 255);
        target[index + 2] = Math.round(this.clamp(baseB + (litB - baseB) * weight, 0, 1) * 255);
      }
    }
    resultCtx.putImageData(output, 0, 0);
    return result;
  }
}
