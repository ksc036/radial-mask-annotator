declare module 'utif' {
  export interface TiffIfd {
    width?: number;
    height?: number;
    data?: Uint8Array;
    t262?: number[];
    t256?: number[];
    t257?: number[];
    t258?: number[];
  }

  export function decode(buffer: ArrayBuffer): TiffIfd[];
  export function decodeImage(buffer: ArrayBuffer, ifd: TiffIfd): void;
  export function toRGBA8(ifd: TiffIfd): Uint8Array;
  export function encodeImage(rgba: ArrayBuffer, width: number, height: number, metadata?: TiffIfd): ArrayBuffer;
}
