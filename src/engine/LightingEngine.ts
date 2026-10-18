/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AristoColors — Non-destructive 2D Lighting Engine
 *
 * CONTRACT:
 * - Never modifies the source canvas.
 * - Returns a new canvas containing the lighting result.
 * - Preserves source alpha values exactly.
 * - Preserves source geometry and image dimensions.
 * - Does not generate or replace image content.
 * - Uses native Canvas 2D only.
 */

export type BlendMode = 'screen' | 'multiply' | 'soft-light';

export interface LightingParams {
  x: number;
  y: number;
  angle: number; // Degrees: 0 = right, 90 = down
  intensity: number; // 0..1
  radius: number; // Pixels
  softness: number; // 0..1
  color: string; // CSS color
  blendMode: BlendMode;
}

export class LightingEngine {
  private static clamp(
    value: number,
    min: number,
    max: number
  ): number {
    return Math.max(min, Math.min(max, value));
  }

  private static finite(
    value: number,
    fallback: number
  ): number {
    return Number.isFinite(value) ? value : fallback;
  }

  private static smoothstep(t: number): number {
    const x = this.clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }

  /**
   * Resolve a CSS color using the browser's Canvas parser.
   * Returns normalized RGBA values.
   */
  private static parseColor(
    color: string
  ): [number, number, number, number] {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true
    });

    if (!ctx) {
      return [1, 1, 1, 1];
    }

    ctx.clearRect(0, 0, 1, 1);

    try {
      ctx.fillStyle = '#ffffff';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);

      const data = ctx.getImageData(0, 0, 1, 1).data;
      const alpha = data[3] / 255;

      if (alpha <= 0) {
        return [1, 1, 1, 0];
      }

      // Canvas returns premultiplied RGB for translucent
      // fills, converted back into byte channels by
      // getImageData. Normalize these values.
      return [
        data[0] / 255,
        data[1] / 255,
        data[2] / 255,
        alpha
      ];
    } catch {
      return [1, 1, 1, 1];
    }
  }

  /**
   * Blend one normalized RGB channel.
   */
  private static blendChannel(
    base: number,
    light: number,
    mode: BlendMode
  ): number {
    switch (mode) {
      case 'screen':
        return 1 - (1 - base) * (1 - light);

      case 'multiply':
        return base * light;

      case 'soft-light': {
        if (light <= 0.5) {
          return base -
            (1 - 2 * light) * base * (1 - base);
        }

        const d =
          base <= 0.25
            ? ((16 * base - 12) * base + 4) * base
            : Math.sqrt(base);

        return base + (2 * light - 1) * (d - base);
      }

      default:
        return base;
    }
  }

  /**
   * Calculate light influence at a pixel.
   *
   * The light is represented by a directional,
   * soft-edged 2D field.
   *
   * Direction is simulated by shifting the
   * illumination center along the chosen angle.
   *
   * This is a 2D approximation, not physically
   * accurate 3D relighting.
   */
  private static calculateFalloff(
    px: number,
    py: number,
    x: number,
    y: number,
    angle: number,
    radius: number,
    softness: number
  ): number {
    if (radius <= 0) {
      return 0;
    }

    const radians = angle * Math.PI / 180;

    // Shift illumination toward the selected direction.
    const offset = radius * 0.25;

    const centerX = x + Math.cos(radians) * offset;
    const centerY = y + Math.sin(radians) * offset;

    const dx = px - centerX;
    const dy = py - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= radius) {
      return 0;
    }

    const normalizedDistance = distance / radius;

    // Softness controls how far the solid core extends.
    const core = 1 - softness;

    if (normalizedDistance <= core) {
      return 1;
    }

    // At softness = 0, create a hard boundary.
    if (softness <= 0) {
      return 1;
    }

    const t =
      (normalizedDistance - core) /
      (1 - core);

    return 1 - this.smoothstep(t);
  }

  /**
   * Render lighting into a NEW canvas.
   *
   * The source canvas is never modified.
   *
   * @param source Original canvas
   * @param params Lighting parameters
   * @returns New canvas containing the result
   */
  public static render(
    source: HTMLCanvasElement,
    params: LightingParams
  ): HTMLCanvasElement {
    const width = source.width;
    const height = source.height;

    const result = document.createElement('canvas');
    result.width = width;
    result.height = height;

    const resultCtx = result.getContext('2d', {
      willReadFrequently: true
    });

    if (!resultCtx) {
      throw new Error(
        'LightingEngine: Cannot create output context.'
      );
    }

    if (width === 0 || height === 0) {
      return result;
    }

    const sourceCtx = source.getContext('2d', {
      willReadFrequently: true
    });

    if (!sourceCtx) {
      throw new Error(
        'LightingEngine: Cannot read source context.'
      );
    }

    const original = sourceCtx.getImageData(
      0,
      0,
      width,
      height
    );

    // Create independent output pixel data.
    const output = new ImageData(
      new Uint8ClampedArray(original.data),
      width,
      height
    );

    const intensity = this.clamp(
      this.finite(params.intensity, 0),
      0,
      1
    );

    const softness = this.clamp(
      this.finite(params.softness, 0.5),
      0,
      1
    );

    const radius = Math.max(
      0,
      this.finite(params.radius, 0)
    );

    const x = this.finite(params.x, width / 2);
    const y = this.finite(params.y, height / 2);
    const angle = this.finite(params.angle, 0);

    const mode: BlendMode =
      params.blendMode === 'multiply' ||
      params.blendMode === 'soft-light'
        ? params.blendMode
        : 'screen';

    if (intensity <= 0 || radius <= 0) {
      resultCtx.putImageData(output, 0, 0);
      return result;
    }

    const [lightR, lightG, lightB, lightAlpha] =
      this.parseColor(params.color);

    if (lightAlpha <= 0) {
      resultCtx.putImageData(output, 0, 0);
      return result;
    }

    const sourcePixels = original.data;
    const targetPixels = output.data;

    // Calculate only pixels inside the light's bounds.
    const radians = angle * Math.PI / 180;
    const offset = radius * 0.25;

    const centerX = x + Math.cos(radians) * offset;
    const centerY = y + Math.sin(radians) * offset;

    const minX = Math.max(
      0,
      Math.floor(centerX - radius)
    );

    const maxX = Math.min(
      width - 1,
      Math.ceil(centerX + radius)
    );

    const minY = Math.max(
      0,
      Math.floor(centerY - radius)
    );

    const maxY = Math.min(
      height - 1,
      Math.ceil(centerY + radius)
    );

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const index = (py * width + px) * 4;

        const originalAlpha = sourcePixels[index + 3];

        // Fully transparent pixels stay unchanged.
        if (originalAlpha === 0) {
          continue;
        }

        const falloff = this.calculateFalloff(
          px + 0.5,
          py + 0.5,
          x,
          y,
          angle,
          radius,
          softness
        );

        const strength =
          falloff * intensity * lightAlpha;

        if (strength <= 0) {
          continue;
        }

        const baseR = sourcePixels[index] / 255;
        const baseG = sourcePixels[index + 1] / 255;
        const baseB = sourcePixels[index + 2] / 255;

        const blendedR = this.blendChannel(
          baseR,
          lightR,
          mode
        );

        const blendedG = this.blendChannel(
          baseG,
          lightG,
          mode
        );

        const blendedB = this.blendChannel(
          baseB,
          lightB,
          mode
        );

        targetPixels[index] = Math.round(
          this.clamp(
            baseR + (blendedR - baseR) * strength,
            0,
            1
          ) * 255
        );

        targetPixels[index + 1] = Math.round(
          this.clamp(
            baseG + (blendedG - baseG) * strength,
            0,
            1
          ) * 255
        );

        targetPixels[index + 2] = Math.round(
          this.clamp(
            baseB + (blendedB - baseB) * strength,
            0,
            1
          ) * 255
        );

        // Preserve the exact original alpha byte.
        targetPixels[index + 3] = originalAlpha;
      }
    }

    resultCtx.putImageData(output, 0, 0);

    return result;
  }
}
