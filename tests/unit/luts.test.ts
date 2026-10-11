import { describe, expect, it } from 'vitest';
import { buildCurveLut, evalCurve, evalGradient, hexToRgb, rgbToHex } from '../../src/engine/luts';

describe('curves', () => {
  it('identity curve maps x to x', () => {
    const f = evalCurve([[0, 0], [1, 1]]);
    for (const x of [0, 0.1, 0.5, 0.93, 1]) expect(f(x)).toBeCloseTo(x, 6);
  });

  it('passes through control points and stays monotone without overshoot', () => {
    const pts: [number, number][] = [[0, 0], [0.25, 0.1], [0.5, 0.5], [0.75, 0.9], [1, 1]];
    const f = evalCurve(pts);
    for (const [x, y] of pts) expect(f(x)).toBeCloseTo(y, 6);
    let prev = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const v = f(i / 200);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(v).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
      prev = v;
    }
  });

  it('clamps outside the first/last point', () => {
    const f = evalCurve([[0.2, 0.3], [0.8, 0.6]]);
    expect(f(0)).toBeCloseTo(0.3);
    expect(f(1)).toBeCloseTo(0.6);
  });

  it('periodic curves wrap around', () => {
    const f = evalCurve([[0.1, 0.4], [0.9, 0.6]], true);
    expect(f(0)).toBeCloseTo(f(1), 6);
    expect(f(1.1)).toBeCloseTo(f(0.1), 6);
  });

  it('builds a 256-entry RGBA LUT', () => {
    const lut = buildCurveLut([[0, 1], [1, 0]]);
    expect(lut.length).toBe(256 * 4);
    expect(lut[0]).toBeCloseTo(1);
    expect(lut[255 * 4]).toBeCloseTo(0);
    expect(lut[3]).toBe(1);
  });
});

describe('gradients', () => {
  const stops = [
    { pos: 0, color: '#000000' },
    { pos: 1, color: '#ffffff' },
  ];
  it('interpolates linearly by default', () => {
    expect(evalGradient(stops, 0.5)[0]).toBeCloseTo(0.5, 5);
  });
  it('honours the midpoint', () => {
    const c = evalGradient([{ pos: 0, color: '#000000', mid: 0.25 }, { pos: 1, color: '#ffffff' }], 0.25);
    expect(c[0]).toBeCloseTo(0.5, 5);
  });
  it('clamps before the first and after the last stop', () => {
    const s = [
      { pos: 0.3, color: '#ff0000' },
      { pos: 0.7, color: '#0000ff' },
    ];
    expect(evalGradient(s, 0)).toEqual([1, 0, 0]);
    expect(evalGradient(s, 1)).toEqual([0, 0, 1]);
  });
});

describe('hex colors', () => {
  it('round-trips', () => {
    expect(rgbToHex(...hexToRgb('#12abef'))).toBe('#12abef');
    expect(hexToRgb('#fff')).toEqual([1, 1, 1]);
    expect(hexToRgb('nonsense')).toEqual([0, 0, 0]);
  });
});
