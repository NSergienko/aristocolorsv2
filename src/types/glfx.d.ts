/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare module 'glfx' {
  export interface FXTexture {
    loadContentsOf(element: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): void;
    destroy(): void;
  }

  export interface FXCanvas extends HTMLCanvasElement {
    _?: {
      gl?: WebGLRenderingContext;
      isInitialized?: boolean;
    };
    texture(element: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): FXTexture;
    draw(texture: FXTexture, width?: number, height?: number): this;
    update(): this;
    replace(element: HTMLElement): this;
    contents(): FXTexture;
    getPixelArray(): Uint8Array;

    // Adjustments
    brightnessContrast(brightness: number, contrast: number): this;
    hueSaturation(hue: number, saturation: number): this;
    vibrance(amount: number): this;
    curves(
      red: [number, number][],
      green?: [number, number][],
      blue?: [number, number][]
    ): this;
    sepia(amount: number): this;
    unsharpMask(radius: number, strength: number): this;
    triangleBlur(radius: number): this;
    denoise(exponent: number): this;
    noise(amount: number): this;
    vignette(size: number, amount: number): this;
  }

  export function canvas(): FXCanvas;
  export function splineInterpolate(points: [number, number][]): number[];
}
