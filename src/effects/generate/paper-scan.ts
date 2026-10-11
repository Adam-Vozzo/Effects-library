import type { EffectDef } from '../../engine/types';
import { float, int } from '../helpers';
import { GRAIN_GLSL, PAPER_GLSL } from './shared';

/**
 * Scanned-paper overlay: a dark, warm procedural paper scan is screened over the image (lifts the blacks, grain and
 * fibres show in the shadows), and the paper's relief slightly jitters the printed image.
 */
export const paperScan: EffectDef = {
  id: 'paper-scan',
  name: 'Paper scan',
  category: 'Generate',
  keywords: 'analog grain media mixed paper scan scanned texture vintage',
  params: [
    int('textureMode', 'textureMode', 0, 1, 0),
    float('opacity', 'opacity', 0, 1, 1),
    float('texScale', 'texScale', 1, 3, 1),
    float('brightness', 'brightness', -1, 1, 0),
    float('contrast', 'contrast', 0, 3, 1),
    float('distortion', 'distortion', 0, 3, 1, 0.1),
    float('distortionScale', 'distorion scale', 300, 1000, 500, 1),
  ],
  shaders: {
    main: /* glsl */ `
${GRAIN_GLSL}
${PAPER_GLSL}
void main() {
  vec2 p = gl_FragCoord.xy / u_pxScale; // reference px
  int mode = int(u_textureMode + 0.5);
  // Paper relief displaces the scanned image by a fraction of a pixel (feature size = scale / 100 px).
  float fs = u_distortionScale / 100.0;
  vec2 warp = vec2(fbm(p / fs, 3), fbm(p / fs + 37.0, 3)) * u_distortion * 2.5 * u_pxScale;
  vec4 src = texture(u_input, v_uv + warp / u_resolution);
  float t = paperTexture(p / u_texScale, mode);
  vec3 tint = mode == 1 ? vec3(0.17, 0.145, 0.115) : vec3(0.15, 0.13, 0.13);
  vec3 paper = tint + t * (mode == 1 ? 0.045 : 0.035);
  paper = (paper - tint) * u_contrast + tint + u_brightness * 0.5;
  paper = saturate(paper);
  vec3 c = saturate(src.rgb);
  vec3 scanned = 1.0 - (1.0 - c) * (1.0 - paper);
  // Faint unevenness in the paper white itself.
  scanned *= 1.0 + t * 0.006 * u_contrast;
  fragColor = vec4(mix(src.rgb, scanned, u_opacity), src.a);
}`,
  },
};
