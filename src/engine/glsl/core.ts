// Engine-internal passes (crop/resample, layer mixing, blur building blocks, output).

export const CORE_SHADERS = {
  base: /* glsl */ `
uniform sampler2D u_src;
uniform vec4 u_crop;      // x, y (bottom-left origin), w, h in normalized source coords
uniform float u_rotation; // radians, around the crop center
uniform vec2 u_flip;
uniform bool u_srcTopDown;
uniform bool u_bicubic;
void main() {
  vec2 srcSize = vec2(textureSize(u_src, 0));
  vec2 px = (v_uv - 0.5) * u_flip * u_crop.zw * srcSize;
  px = rot2(u_rotation) * px;
  vec2 uv = u_crop.xy + 0.5 * u_crop.zw + px / srcSize;
  vec2 suv = u_srcTopDown ? vec2(uv.x, 1.0 - uv.y) : uv;
  // Catmull-Rom when magnifying (exports larger than the source), trilinear mips otherwise.
  vec4 c = u_bicubic ? clamp(textureBicubic(u_src, suv), 0.0, 1.0) : texture(u_src, suv);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) c = vec4(0.0);
  fragColor = c;
}`,
  copy: /* glsl */ `
uniform sampler2D u_src;
void main() { fragColor = texture(u_src, v_uv); }`,
  mix: /* glsl */ `
uniform sampler2D u_base;
uniform sampler2D u_top;
uniform float u_opacity;
uniform int u_mode;
void main() {
  vec4 b = texture(u_base, v_uv);
  vec4 t = texture(u_top, v_uv);
  float ta = t.a * u_opacity;
  vec3 blended = u_mode == 0 ? t.rgb : blendMode(u_mode, saturate(b.rgb), saturate(t.rgb));
  float oa = ta + b.a * (1.0 - ta);
  vec3 rgb = (blended * ta + b.rgb * b.a * (1.0 - ta)) / max(oa, 1e-5);
  fragColor = vec4(rgb, oa);
}`,
  downsample: /* glsl */ `
uniform sampler2D u_src;
uniform vec2 u_srcTexel;
void main() {
  vec2 o = u_srcTexel;
  vec4 c = texture(u_src, v_uv + vec2(-o.x, -o.y)) + texture(u_src, v_uv + vec2(o.x, -o.y))
         + texture(u_src, v_uv + vec2(-o.x, o.y)) + texture(u_src, v_uv + vec2(o.x, o.y));
  fragColor = c * 0.25;
}`,
  gauss: /* glsl */ `
uniform sampler2D u_src;
uniform vec2 u_dir;
uniform float u_sigma;
void main() {
  if (u_sigma < 0.05) { fragColor = texture(u_src, v_uv); return; }
  float inv = 1.0 / (2.0 * u_sigma * u_sigma);
  int r = int(ceil(u_sigma * 3.0));
  vec4 sum = texture(u_src, v_uv);
  float wsum = 1.0;
  for (int i = 1; i <= 63; i += 2) {
    if (i > r) break;
    float w1 = exp(-float(i * i) * inv);
    float w2 = exp(-float((i + 1) * (i + 1)) * inv);
    float w = w1 + w2;
    float o = (float(i) * w1 + float(i + 1) * w2) / w;
    sum += (texture(u_src, v_uv + u_dir * o) + texture(u_src, v_uv - u_dir * o)) * w;
    wsum += 2.0 * w;
  }
  fragColor = sum / wsum;
}`,
  upsample: /* glsl */ `
uniform sampler2D u_src;
void main() { fragColor = texture(u_src, v_uv); }`,
  present: /* glsl */ `
uniform sampler2D u_src;
void main() {
  vec4 c = texelFetch(u_src, ivec2(gl_FragCoord.xy), 0);
  c = clamp(c, 0.0, 1.0);
  c.rgb = clamp(c.rgb + (ign(gl_FragCoord.xy) - 0.5) / 255.0, 0.0, 1.0);
  fragColor = vec4(c.rgb * c.a, c.a);
}`,
  minAlpha: /* glsl */ `
uniform sampler2D u_src;
void main() {
  ivec2 sz = textureSize(u_src, 0);
  ivec2 p = ivec2(gl_FragCoord.xy) * 4;
  float a = 1.0;
  for (int y = 0; y < 4; y++)
    for (int x = 0; x < 4; x++) a = min(a, texelFetch(u_src, min(p + ivec2(x, y), sz - 1), 0).a);
  fragColor = vec4(a);
}`,
  quantize: /* glsl */ `
uniform sampler2D u_src;
uniform float u_dither;
void main() {
  vec4 c = texelFetch(u_src, ivec2(gl_FragCoord.xy), 0);
  if (u_dither > 0.5) c.rgb += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = clamp(c, 0.0, 1.0);
}`,
};
