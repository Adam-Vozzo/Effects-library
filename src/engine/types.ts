import type { Texture, UniformValue, TexFormat } from './gl';

export type Category = 'Blur' | 'Color' | 'Distort' | 'Effects' | 'Generate' | 'Custom' | 'Film';

export const CATEGORIES: Category[] = ['Blur', 'Color', 'Distort', 'Effects', 'Generate', 'Custom', 'Film'];

/** A point on a curve editor, both coordinates in [0,1] (x may wrap for periodic hue curves). */
export type CurvePoint = [number, number];

export interface GradientStop {
  pos: number; // 0..1
  color: string; // #rrggbb
  /** Interpolation midpoint between this stop and the next, 0..1 (0.5 = linear). */
  mid?: number;
}

export type ParamValue =
  | number
  | boolean
  | string
  | [number, number]
  | CurvePoint[]
  | GradientStop[]
  | string[]
  | TextureRef
  | null;

/** Reference to a user-provided image stored in the asset store (see state/assets.ts). */
export interface TextureRef {
  assetId: string;
}

export type ParamValues = Record<string, ParamValue>;

interface ParamBase {
  key: string;
  label: string;
  /** Collapsible group heading this param belongs to. */
  group?: string;
  /** Hide the control unless this returns true. */
  visibleIf?: (p: ParamValues) => boolean;
  /** Exclude from the randomize button. */
  noRandom?: boolean;
  hint?: string;
}

export interface FloatParam extends ParamBase {
  type: 'float' | 'int';
  min: number;
  max: number;
  step?: number;
  default: number;
  /** Soft range used by randomize (defaults to min..max). */
  randomRange?: [number, number];
  /** Value display suffix, e.g. '°' or 'px'. */
  unit?: string;
  /** Map the slider position non-linearly (exponent applied to 0..1 position). */
  curve?: number;
}

export interface EnumParam extends ParamBase {
  type: 'enum';
  options: string[];
  default: number;
  /** slider: discrete slider with the option name as value label (effect.app style). */
  ui?: 'slider' | 'switcher' | 'select';
}

export interface BoolParam extends ParamBase {
  type: 'bool';
  default: boolean;
}

export interface ColorParam extends ParamBase {
  type: 'color';
  default: string;
}

export interface Vec2Param extends ParamBase {
  type: 'vec2';
  default: [number, number];
  min?: [number, number];
  max?: [number, number];
  step?: number;
}

/** Two-handle range slider (e.g. levels input black/white). */
export interface RangeParam extends ParamBase {
  type: 'range';
  default: [number, number];
  min: number;
  max: number;
  step?: number;
}

export interface CurveParam extends ParamBase {
  type: 'curve';
  default: CurvePoint[];
  /** Hue curves wrap around horizontally. */
  periodic?: boolean;
  /** Color for the curve line in the editor. */
  color?: string;
  /** Draw a hue spectrum under the editor (hue curves). */
  hueBackground?: boolean;
}

export interface GradientParam extends ParamBase {
  type: 'gradient';
  default: GradientStop[];
  /** Custom interpolation (e.g. OKLCh); used for both the LUT and the editor preview. Default: sRGB. */
  evaluate?: (stops: GradientStop[], t: number) => [number, number, number];
}

export interface PaletteParam extends ParamBase {
  type: 'palette';
  default: string[];
  maxColors?: number;
}

/** Color wheel: [hue degrees, amount 0..1]. */
export interface WheelParam extends ParamBase {
  type: 'wheel';
  default: [number, number];
}

export interface TextureParam extends ParamBase {
  type: 'texture';
  default: null;
}

export interface TextParam extends ParamBase {
  type: 'text';
  default: string;
  multiline?: boolean;
}

export interface FontParam extends ParamBase {
  type: 'font';
  default: string;
}

/** Grid of selectable 8x8 bitmap patterns (MacPaint-style), value is a list of selected indices encoded as string[] */
export interface PatternsParam extends ParamBase {
  type: 'patterns';
  /** Each pattern is 8 rows of 8 bits, encoded as 8 numbers (0..255). */
  patterns: number[][];
  default: string[];
}

export type ParamDef =
  | FloatParam
  | EnumParam
  | BoolParam
  | ColorParam
  | Vec2Param
  | RangeParam
  | CurveParam
  | GradientParam
  | PaletteParam
  | WheelParam
  | TextureParam
  | TextParam
  | FontParam
  | PatternsParam;

export interface PassOptions {
  /** Sampler inputs, bound by uniform name. */
  inputs?: Record<string, Texture>;
  /** Extra uniforms (override auto param uniforms). */
  uniforms?: Record<string, UniformValue | undefined>;
  width?: number;
  height?: number;
  format?: TexFormat;
  /** Clear the target before drawing (default false: every pixel is written). */
  clear?: [number, number, number, number];
  /** Enable additive blending into an existing target instead of allocating one. */
  target?: Texture;
  blend?: 'add' | 'alpha';
}

export interface RenderContext {
  readonly gl: WebGL2RenderingContext;
  /** Output of the previous layer (or the source image for the first layer). */
  readonly input: Texture;
  /** The cropped source image at the render resolution (allocated lazily). */
  readonly original: Texture;
  readonly width: number;
  readonly height: number;
  /** Render pixels per reference (source) pixel. Multiply pixel-unit params by this. */
  readonly pxScale: number;
  readonly time: number;
  readonly params: ParamValues;
  /** Intermediate texture format chosen for this render. */
  readonly format: TexFormat;
  /** True while rendering a high-resolution export (effects may raise quality). */
  readonly exporting: boolean;
  /** Run a fullscreen fragment pass with one of the effect's shaders. */
  pass(shader: string, opts?: PassOptions): Texture;
  /** Return a texture obtained from pass() to the pool once it is no longer needed. */
  release(t: Texture): void;
  /** Allocate an empty render target from the pool. */
  target(width: number, height: number, format?: TexFormat): Texture;
  /** Persistent per-layer texture (e.g. text raster, LUTs); recreated when key changes. */
  cached<T>(key: string, create: () => T, dispose?: (v: T) => void): T;
  /** Lookup a user texture asset (null if not loaded). */
  asset(ref: ParamValue): Texture | null;
  /** Shared helper: gaussian blur with sigma in render pixels (x, y). Returns a pooled texture. */
  blur(src: Texture, sigmaX: number, sigmaY?: number, format?: TexFormat): Texture;
  /** Built-in noise/paper textures shared across effects. */
  builtin(name: 'blueNoise' | 'paper' | 'fiber'): Texture;
  /**
   * Synchronously read back a (small!) texture as RGBA floats in 0..1, rows bottom-up.
   * Use for analysis (palettes, blob detection) on downsampled copies only.
   */
  read(t: Texture): Float32Array;
}

export interface EffectDef {
  id: string;
  name: string;
  category: Category;
  keywords?: string;
  description?: string;
  params: ParamDef[];
  /**
   * Fragment shader bodies keyed by name. Each gets the standard prelude (uniforms for params,
   * u_input, u_original, u_resolution, u_pxScale, u_time, and the shared GLSL library).
   * A single-pass effect only needs `main`.
   */
  shaders: Record<string, string>;
  /** Custom multi-pass pipeline; defaults to a single pass with shaders.main. */
  render?: (ctx: RenderContext) => Texture;
  /** Effect changes over time (enables the timeline / animated preview). */
  animated?: boolean;
  /** Effect samples u_original (the unprocessed source). */
  usesOriginal?: boolean;
  /** Hidden from the browser (kept for loading old projects). */
  hidden?: boolean;
  /** Extra JS-side uniforms derived from params (e.g. precomputed matrices). */
  uniforms?: (p: ParamValues, ctx: { width: number; height: number; pxScale: number; time: number }) => Record<string, UniformValue>;
}

export interface Layer {
  id: string;
  effectId: string;
  params: ParamValues;
  visible: boolean;
  /** Layer mix with the layer below (0..1). */
  opacity: number;
  blend: BlendMode;
  /** Optional custom name. */
  name?: string;
}

export const BLEND_MODES = [
  'normal',
  'darken',
  'multiply',
  'color-burn',
  'linear-burn',
  'lighten',
  'screen',
  'color-dodge',
  'linear-dodge',
  'overlay',
  'soft-light',
  'hard-light',
  'vivid-light',
  'linear-light',
  'pin-light',
  'hard-mix',
  'difference',
  'exclusion',
  'subtract',
  'divide',
  'hue',
  'saturation',
  'color',
  'luminosity',
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

/** Labels in effect.app / Photoshop order; the index is what blendMode() in GLSL expects. */
export const BLEND_LABELS: Record<BlendMode, string> = {
  normal: 'Normal',
  darken: 'Darken',
  multiply: 'Multiply',
  'color-burn': 'Color burn',
  'linear-burn': 'Linear burn',
  lighten: 'Lighten',
  screen: 'Screen',
  'color-dodge': 'Color dodge',
  'linear-dodge': 'Linear dodge (add)',
  overlay: 'Overlay',
  'soft-light': 'Soft light',
  'hard-light': 'Hard light',
  'vivid-light': 'Vivid light',
  'linear-light': 'Linear light',
  'pin-light': 'Pin light',
  'hard-mix': 'Hard mix',
  difference: 'Difference',
  exclusion: 'Exclusion',
  subtract: 'Subtract',
  divide: 'Divide',
  hue: 'Hue',
  saturation: 'Saturation',
  color: 'Color',
  luminosity: 'Luminosity',
};

/** Crop rectangle in normalized source coordinates (top-left origin). */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation in degrees around the crop center. */
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
}

export interface Project {
  layers: Layer[];
  crop: Crop | null;
  time: number;
}
