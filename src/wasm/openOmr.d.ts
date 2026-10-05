// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
interface WasmModule {
}

export interface ClassHandle {
  isAliasOf(other: ClassHandle): boolean;
  delete(): void;
  deleteLater(): this;
  isDeleted(): boolean;
  // @ts-ignore - If targeting lower than ESNext, this symbol might not exist.
  [Symbol.dispose](): void;
  clone(): this;
}
export interface Vector_Bytes extends ClassHandle, Iterable<number> {
  push_back(_0: number): void;
  resize(_0: number, _1: number): void;
  size(): number;
  get(_0: number): number | undefined;
  set(_0: number, _1: number): boolean;
}

export interface PixelLayoutValue<T extends number> {
  value: T;
}
export type PixelLayout = PixelLayoutValue<0>|PixelLayoutValue<1>;

export interface ImageQualityValue<T extends number> {
  value: T;
}
export type ImageQuality = ImageQualityValue<0>|ImageQualityValue<1>|ImageQualityValue<2>;

export interface Vector_QrDetection extends ClassHandle, Iterable<QrDetection> {
  push_back(_0: QrDetection): void;
  resize(_0: number, _1: QrDetection): void;
  size(): number;
  get(_0: number): QrDetection | undefined;
  set(_0: number, _1: QrDetection): boolean;
}

export interface Vector_ArucoDetection extends ClassHandle, Iterable<ArucoDetection> {
  push_back(_0: ArucoDetection): void;
  resize(_0: number, _1: ArucoDetection): void;
  size(): number;
  get(_0: number): ArucoDetection | undefined;
  set(_0: number, _1: ArucoDetection): boolean;
}

export interface SheetGenerator extends ClassHandle {
  generate(): Image;
  initialize(size: Size, revisionId: Uint8Array): void;
  setFont(fontData: Uint8Array): boolean;
  addQuestion(questionNumber: number, subQuestionNumber: number, answerLabels: Uint8Array[]): boolean;
}

export interface SheetGrader extends ClassHandle {
  detectRevisionId(): RevisionDetection | undefined;
  normalize(_0: Size): boolean;
  gradeSheet(_0: Size, _1: Size): Vector_Bytes;
  detectAruco(_0: Image): Vector_ArucoDetection;
  normalizedImage(): Image;
}

export type Point = {
  x: number,
  y: number
};

export type QrDetection = {
  data: Vector_Bytes,
  tl: Point,
  tr: Point,
  bl: Point,
  br: Point
};

export type RevisionDetection = {
  revisionId: Vector_Bytes,
  tl: Point,
  tr: Point,
  bl: Point,
  br: Point
};

export type Size = {
  width: number,
  height: number
};

export type View = {
  x: number,
  y: number,
  width: number,
  height: number
};

export type Image = {
  data: Vector_Bytes,
  width: number,
  height: number,
  layout: PixelLayout
};

export type ArucoDetection = {
  id: number,
  tl: Point,
  tr: Point,
  bl: Point,
  br: Point
};

interface EmbindModule {
  Vector_Bytes: {
    new(): Vector_Bytes;
  };
  PixelLayout: {Gray: PixelLayoutValue<0>, RGBA: PixelLayoutValue<1>};
  ImageQuality: {Good: ImageQualityValue<0>, TooDark: ImageQualityValue<1>, TooBright: ImageQualityValue<2>};
  Vector_QrDetection: {
    new(): Vector_QrDetection;
  };
  Vector_ArucoDetection: {
    new(): Vector_ArucoDetection;
  };
  SheetGenerator: {
    new(): SheetGenerator;
  };
  SheetGrader: {
    new(): SheetGrader;
  };
  generateQr(_0: Vector_Bytes, _1: Size): Image;
  detectQrCode(_0: Image, _1?: View): Vector_QrDetection;
  checkImageQuality(_0: Image): ImageQuality;
  byteVectorView(bytes: Vector_Bytes): Uint8Array;
}

export type MainModule = WasmModule & EmbindModule;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
