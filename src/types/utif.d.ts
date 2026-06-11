declare module 'utif' {
  export interface TiffIfd {
    width?: number;
    height?: number;
    data?: unknown;
    t256?: number[];
    t257?: number[];
  }

  export function decode(buffer: ArrayBuffer): TiffIfd[];
  export function decodeImage(buffer: ArrayBuffer, ifd: TiffIfd): void;
  export function toRGBA8(ifd: TiffIfd): Uint8Array;
  export function encodeImage(rgba: ArrayBuffer, width: number, height: number, metadata?: TiffIfd): ArrayBuffer;
}
