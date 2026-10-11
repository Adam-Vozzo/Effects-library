import { describe, expect, it } from 'vitest';
import { exportSize, estimateGpuBytes } from '../../src/export/exporter';
import type { ExportSettings } from '../../src/state/store';

const base: ExportSettings = { format: 'png', quality: 0.9, bitDepth: 8, sizeMode: 'original', scale: 2, longSide: 16384, customW: 0, customH: 0 };

describe('exportSize', () => {
  it('keeps the cropped source size for "original"', () => {
    expect(exportSize(base, 1800, 1196)).toEqual({ w: 1800, h: 1196 });
  });
  it('scales by a factor', () => {
    expect(exportSize({ ...base, sizeMode: 'scale', scale: 4 }, 1800, 1196)).toEqual({ w: 7200, h: 4784 });
  });
  it('fits the long side (16K) preserving aspect for landscape and portrait', () => {
    expect(exportSize({ ...base, sizeMode: 'long' }, 1800, 1196)).toEqual({ w: 16384, h: 10886 });
    expect(exportSize({ ...base, sizeMode: 'long' }, 1200, 1800)).toEqual({ w: 10923, h: 16384 });
  });
  it('uses custom dimensions', () => {
    expect(exportSize({ ...base, sizeMode: 'custom', customW: 5000, customH: 4000 }, 10, 10)).toEqual({ w: 5000, h: 4000 });
  });
  it('estimates GPU memory', () => {
    expect(estimateGpuBytes(1000, 1000, 'rgba8')).toBe(16_000_000);
    expect(estimateGpuBytes(1000, 1000, 'rgba16f')).toBe(28_000_000);
  });
});
