(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=new Map,t=new Map,n=[];function r(t){for(let r of t)try{if(!r||!r.id)throw Error(`Effect without id`);if(e.has(r.id))throw Error(`Duplicate effect id `+r.id);d(r),e.set(r.id,r)}catch(e){let t=`Effect registration failed: ${e.message}`;n.push(t),console.error(t)}}function i(e,n){t.set(e,n)}function a(n){return e.get(n)??e.get(t.get(n)??``)}function o(){return[...e.values()]}function s(e){return typeof e!=`object`||!e?e:JSON.parse(JSON.stringify(e))}function c(e){let t={};for(let n of e.params)t[n.key]=s(n.default);return t}function l(e,t){let n=c(e);if(!t)return n;for(let r of e.params)r.key in t&&t[r.key]!==void 0&&(n[r.key]=u(r,t[r.key]));return n}function u(e,t){switch(e.type){case`float`:case`int`:case`enum`:{let n=Number(t);return Number.isFinite(n)?e.type===`enum`?Math.max(0,Math.min(e.options.length-1,Math.round(n))):n:e.default}case`bool`:return!!t;default:return s(t)}}function d(e){if(!e.shaders||!e.render&&!e.shaders.main)throw Error(`Effect ${e.id} needs shaders.main or render()`);let t=new Set;for(let n of e.params){if(t.has(n.key))throw Error(`Effect ${e.id}: duplicate param ${n.key}`);if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(n.key))throw Error(`Effect ${e.id}: invalid param key ${n.key}`);t.add(n.key)}}var f=[`Blur`,`Color`,`Distort`,`Effects`,`Generate`,`Custom`,`Film`],p=[`normal`,`darken`,`multiply`,`color-burn`,`linear-burn`,`lighten`,`screen`,`color-dodge`,`linear-dodge`,`overlay`,`soft-light`,`hard-light`,`vivid-light`,`linear-light`,`pin-light`,`hard-mix`,`difference`,`exclusion`,`subtract`,`divide`,`hue`,`saturation`,`color`,`luminosity`],m=[1,5,9,16,20],h={normal:`Normal`,darken:`Darken`,multiply:`Multiply`,"color-burn":`Color burn`,"linear-burn":`Linear burn`,lighten:`Lighten`,screen:`Screen`,"color-dodge":`Color dodge`,"linear-dodge":`Linear dodge (add)`,overlay:`Overlay`,"soft-light":`Soft light`,"hard-light":`Hard light`,"vivid-light":`Vivid light`,"linear-light":`Linear light`,"pin-light":`Pin light`,"hard-mix":`Hard mix`,difference:`Difference`,exclusion:`Exclusion`,subtract:`Subtract`,divide:`Divide`,hue:`Hue`,saturation:`Saturation`,color:`Color`,luminosity:`Luminosity`};function g(e,t,n,r,i,a=.01,o={}){return{type:`float`,key:e,label:t,min:n,max:r,step:a,default:i,...o}}function _(e,t,n,r,i,a={}){return{type:`int`,key:e,label:t,min:n,max:r,step:1,default:i,...a}}function v(e,t,n,r,i,a={}){return{type:`float`,key:e,label:t,min:n,max:r,step:1,default:i,unit:`°`,...a}}function y(e,t,n,r={}){return{type:`bool`,key:e,label:t,default:n,...r}}function b(e,t,n,r={}){return{type:`color`,key:e,label:t,default:n,...r}}function x(e,t,n,r=0,i=`slider`,a={}){return{type:`enum`,key:e,label:t,options:n,default:r,ui:i,...a}}function S(e,t,n,r={}){return{type:`vec2`,key:e,label:t,default:n,min:[-1,-1],max:[1,1],step:.01,...r}}function C(e,t,n,r,i,a=.01,o={}){return{type:`range`,key:e,label:t,min:n,max:r,step:a,default:i,...o}}function w(e,t,n=[[0,0],[1,1]],r={}){return{type:`curve`,key:e,label:t,default:n,...r}}function T(e,t,n,r={}){return{type:`gradient`,key:e,label:t,default:n,...r}}function ee(e,t,n=[0,0],r={}){return{type:`wheel`,key:e,label:t,default:n,...r}}function te(e,t,n,r={}){return{type:`palette`,key:e,label:t,default:n,...r}}function E(e,t,n={}){return{type:`texture`,key:e,label:t,default:null,...n}}var ne=p.map(e=>h[e]);function D(e=`blendMode`,t=`Blend mode`,n=0,r={}){return{type:`enum`,key:e,label:t,options:ne,default:n,ui:`select`,groups:m,livePreview:!0,...r}}var O=(e,t)=>Number(e[t]),re=(e,t)=>!!e[t],ie=1,k={id:`blur-sharpen`,name:`Blur/sharp`,category:`Blur`,keywords:`blur sharp`,params:[g(`blurriness`,`blurriness`,-5,1,-5),g(`threshold`,`threshold`,0,1,1,.001),g(`ringing`,`ringing`,0,1,.2)],shaders:{main:`
uniform sampler2D u_blurred;
uniform float u_spacing; // neighbourhood spacing for the ringing clamp (px)
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = src.rgb;
  vec3 d = texture(u_blurred, v_uv).rgb - c;
  // Threshold: limit the change at strong edges (1 = no limit).
  float mag = max(max(abs(d.r), abs(d.g)), abs(d.b));
  if (u_threshold < 1.0) d *= min(1.0, u_threshold / max(mag, 1e-5));
  float k = u_blurriness < 0.0 ? 0.6 * u_blurriness : u_blurriness;
  vec3 o = c + k * d;
  if (k < 0.0) {
    vec2 st = u_spacing / u_resolution;
    vec3 lo = c, hi = c;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec3 s = texture(u_input, v_uv + vec2(x, y) * st).rgb;
        lo = min(lo, s);
        hi = max(hi, s);
      }
    vec3 r = (hi - lo) * u_ringing;
    o = clamp(o, lo - r, hi + r);
  }
  fragColor = vec4(o, src.a);
}`},render(e){let t=O(e.params,`blurriness`),n=Math.max(.5,ie*(1+2*Math.max(0,t))*e.pxScale),r=e.blur(e.input,n),i=e.pass(`main`,{inputs:{u_blurred:r},uniforms:{u_spacing:Math.max(1,n)}});return e.release(r),i}},ae=64,oe=.03,se=.07,ce=.1,le=1/15;function ue(e,t){let n=Math.imul(e^Math.imul(t+40503,2246822507),3266489909)>>>0;return n^=n>>>16,n=Math.imul(n,2146121005)>>>0,n^=n>>>15,n=Math.imul(n,2221713035)>>>0,n^=n>>>16,(n>>>0)/4294967296}function de(e,t){let n=Math.floor(e),r=e-n,i=ue(n,t)*2-1,a=ue(n+1,t)*2-1,o=r*r*r*(r*(r*6-15)+10);return 2*(i*r*(1-o)+a*(r-1)*o)}function fe(e,t){return de(e,t)*.65+de(e*2.13+17.1,t+101)*.25+de(e*4.37+3.7,t+211)*.1}var pe=e=>e*e*e-.5*e*e*e*e;function me(e,t,n){let r=Math.max(1,O(t,`pauseInterval`)),i=Math.min(1,Math.max(0,O(t,`pauseLength`))),a=O(t,`pauseRandomness`);if(i<=0||e<=0)return e;let o=Math.min(1e5,Math.floor(e/r)),s=0;for(let t=0;t<=o;t++){let o=Math.min(r,r*i*(1+(ue(t,n+7)-.5)*a)),c=t*r+(r-o)*Math.min(1,Math.max(0,.5+(ue(t,n+13)-.5)*2*a)),l=.3*o,u=Math.min(e-c,o);if(u<=0||o<=0)continue;let d;d=u<l?l*pe(u/l):u<o-l?l/2+(u-l):o-l-l*pe((o-u)/l),s+=d}return e-s}function he(e,t){let n=Math.round(O(t,`seed`))*7919,r=me(e*O(t,`speedScale`),t,n),i=O(t,`motionScale`),a=O(t,`randomnessScale`),o=r*O(t,`randomnessSpeed`),s=2*Math.PI*(O(t,`ptrSpeed`)*r+O(t,`phase`)),c=2*Math.PI*(O(t,`zoomSpeed`)*r+O(t,`phase`)),l=O(t,`panAmplitude`)*(Math.sin(s)+a*fe(o,n+1)),u=O(t,`tiltAmplitude`)*(Math.sin(2*s+1.1)+a*fe(o+31.7,n+2)),d=O(t,`rotationAmplitude`)*(Math.sin(s+.4)+a*fe(o+63.1,n+3)),f=O(t,`zoomAmplitude`)*(Math.sin(c)+a*fe(o+95.3,n+4));return[l*i*oe,u*i*oe,d*i*se,Math.exp(f*i*ce)]}var ge={id:`camera-shake`,name:`Camera shake`,category:`Blur`,keywords:`camera shake motion blur pan tilt rotation zoom`,animated:!0,params:[g(`motionScale`,`Motion Scale`,0,4,2),g(`speedScale`,`Speed Scale`,0,4,.899,.001),g(`motionBlur`,`Motion Blur`,0,1,1),g(`panAmplitude`,`Pan Amplitude`,0,1,.597,.001),g(`tiltAmplitude`,`Tilt Amplitude`,0,1,.023,.001),g(`rotationAmplitude`,`Rotation Amplitude`,0,1,.1,.001),g(`ptrSpeed`,`PTR Speed`,0,4,.5,.001),g(`zoomAmplitude`,`Zoom Amplitude`,0,1,0,.001),g(`zoomSpeed`,`Zoom Speed`,0,4,0,.001),g(`phase`,`Phase`,0,1,.75,.001),g(`randomnessScale`,`Randomness Scale`,0,2,1,.001),g(`randomnessSpeed`,`Randomness Speed`,0,4,1.457,.001),g(`pauseLength`,`Pause Length`,0,1,.419,.001,{hint:`Fraction of each pause interval the camera holds still`}),_(`pauseInterval`,`Pause Interval`,1,60,18,{hint:`Seconds between pauses (scaled by Speed Scale)`}),g(`pauseRandomness`,`Pause Randomness`,0,1,.155,.001),_(`seed`,`Random Seed`,0,100,8)],shaders:{main:`
uniform vec4 u_xf[${ae}]; // per shutter sample: offset (image heights), rotation, zoom
uniform float u_count;
void main() {
  vec2 res = u_resolution;
  vec2 p = centered(v_uv, res);
  int n = int(u_count + 0.5);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < ${ae}; i++) {
    if (i >= n) break;
    vec4 xf = u_xf[i];
    // Inverse of: content -> rotate(xf.z) * zoom(xf.w) about the centre, then translate(xf.xy).
    vec2 q = rot2(-xf.z) * (p - xf.xy) / xf.w;
    vec4 s = texture(u_input, mirrorUv(uncentered(q, res)));
    acc += vec4(srgbToLinear(s.rgb) * s.a, s.a);
  }
  fragColor = acc.a > 1e-6 ? vec4(linearToSrgb(acc.rgb / acc.a), acc.a / float(n)) : vec4(0.0);
}`},render(e){let t=e.params,n=e.time,r=le*Math.max(0,O(t,`motionBlur`)),i=e.height,a=e.width,o=.5*Math.hypot(a/i,1),s=he(n-r/2,t),c=he(n,t),l=he(n+r/2,t),u=(e,t)=>Math.hypot(e[0]-t[0],e[1]-t[1])+Math.abs(e[2]-t[2])*o+Math.abs(Math.log(e[3]/t[3]))*o,d=(u(s,c)+u(c,l))*i,f=e.exporting?ae:32,p=r>0?Math.max(1,Math.min(f,Math.ceil(d/1.5))):1,m=new Float32Array(256);for(let e=0;e<p;e++){let i=p>1?n+r*(e/(p-1)-.5):n;m.set(he(i,t),e*4)}return e.pass(`main`,{uniforms:{u_xf:m,u_count:p}})}},_e={id:`circular-blur`,name:`Circular blur`,category:`Blur`,keywords:`blur circular depth field focus radial`,params:[g(`radius`,`radius`,0,100,54),_(`repetitions`,`repetitions`,3,23,8),_(`passes`,`passes`,1,4,1),g(`decay`,`decay`,0,1,.4)],shaders:{ring:`
uniform sampler2D u_src;
uniform float u_ringRadius; // px
uniform float u_ringRot;    // radians
void main() {
  int n = int(u_repetitions + 0.5);
  vec2 texel = 1.0 / u_resolution;
  vec4 acc = vec4(0.0);
  for (int k = 0; k < 23; k++) {
    if (k >= n) break;
    float a = u_ringRot + TAU * float(k) / float(n);
    vec4 s = texture(u_src, v_uv + vec2(cos(a), sin(a)) * u_ringRadius * texel);
    acc += vec4(s.rgb * s.a, s.a);
  }
  fragColor = acc.a > 1e-6 ? vec4(acc.rgb / acc.a, acc.a / float(n)) : vec4(0.0);
}`},render(e){let t=e.params,n=Math.round(O(t,`repetitions`)),r=Math.round(O(t,`passes`)),i=O(t,`decay`),a=O(t,`radius`)*e.pxScale,o=e.input;for(let t=0;t<r&&!(a<.05);t++){let r=e.pass(`ring`,{inputs:{u_src:o},uniforms:{u_ringRadius:a,u_ringRot:t*Math.PI/n}});o!==e.input&&e.release(o),o=r,a*=1-i}return o}},ve=`
uniform sampler2D u_src;
uniform vec2 u_dirPx;    // blur direction (unit vector, px space)
uniform float u_start;   // first tap offset along the direction (px)
uniform float u_step;    // tap spacing (px)
uniform float u_count;   // number of taps
uniform float u_sigma;   // gaussian sigma (px); 0 = box weights
uniform bool u_toLinear; // input is straight sRGB: convert to premultiplied linear
void main() {
  vec2 texel = 1.0 / vec2(textureSize(u_src, 0));
  int n = int(u_count + 0.5);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 512; i++) {
    if (i >= n) break;
    float o = u_start + float(i) * u_step;
    float w = u_sigma > 0.0 ? exp(-0.5 * o * o / (u_sigma * u_sigma)) : 1.0;
    vec4 c = texture(u_src, v_uv + u_dirPx * o * texel);
    if (u_toLinear) c = vec4(srgbToLinear(c.rgb) * c.a, c.a);
    acc += c * w;
    wsum += w;
  }
  fragColor = acc / max(wsum, 1e-6);
}`,ye=`
float focusMask(vec2 uv, vec2 res, vec2 centerUv, float radius, float falloff, float stretch, float rotDeg) {
  vec2 p = centered(uv, res) - centered(centerUv, res);
  p = rot2(radians(rotDeg)) * p;
  p.x /= 1.0 + stretch;
  float r0 = radius * 0.5;
  float k = 1.0 + 0.5 * falloff;
  return 1.0 - smoothstep(r0 / k, r0 * k, length(p));
}
`;function be(e){return[S(`maskCenter`,`mask center`,[0,0],{visibleIf:e}),g(`maskRadius`,`mask radius`,.01,4,.35,.01,{visibleIf:e}),g(`maskFalloff`,`mask falloff`,.5,6,2,.1,{visibleIf:e}),g(`maskStretch`,`mask aspect stretch`,0,5,0,.05,{visibleIf:e}),v(`maskRotation`,`mask rotation`,-180,180,0,{visibleIf:e}),y(`maskInvert`,`invert mask`,!1,{visibleIf:e}),y(`maskDebug`,`debug mask`,!1,{visibleIf:e,noRandom:!0})]}var xe=`
${ye}
#define GOLDEN 2.39996323
const float BOOST_T = 0.6; // linear luminance where the highlight boost starts
const float BOOST_G = 20.0; // boost gain (white ends up ~4.2x brighter during the gather)
vec3 boostHighlights(vec3 c) {
  float l = luma(c);
  float x = max(l - BOOST_T, 0.0);
  return c * ((l + BOOST_G * x * x) / max(l, 1e-6));
}
vec3 unboostHighlights(vec3 c) {
  float lb = luma(c);
  if (lb <= BOOST_T) return c;
  float x = (sqrt(1.0 + 4.0 * BOOST_G * (lb - BOOST_T)) - 1.0) / (2.0 * BOOST_G);
  return c * ((BOOST_T + x) / lb);
}
// Blur amount (0 = in focus, 1 = full blur) from the elliptical focus mask.
float blurAmount(vec2 uv, vec2 res) {
  float m = focusMask(uv, res, pointToUv(u_center), u_radius, u_falloff, u_stretch, u_maskRotation);
  return u_invert ? m : 1.0 - m;
}
// Distance from the aperture centre to its edge along direction th (circumradius 1).
float apertureEdge(float th) {
  float n = floor(u_blades + 0.5);
  float seg = TAU / n;
  float phi = mod(th - radians(u_apertureRotation) - PI * 0.5, seg) - seg * 0.5;
  float poly = cos(PI / n) / cos(phi);
  return mix(poly, 1.0, u_bladeRoundness);
}
// Aperture transmission at normalized radius r (1 = edge): feathered rim, catadioptric hole.
float apertureTransmission(float r) {
  float f = u_apertureFeather;
  float t = 1.0 - smoothstep(1.0 - f, 1.0 + 1e-4, r);
  float c = u_catadioptric;
  if (c > 0.0) t *= smoothstep(c - 1e-4, c + f * c + 1e-4, r);
  return t;
}
`,Se={id:`depth-of-field`,name:`Depth of field`,category:`Blur`,keywords:`aperture background blur bokeh cinematic depth field focus`,params:[S(`center`,`center`,[0,0]),g(`radius`,`radius`,.01,4,.35),g(`stretch`,`aspect stretch`,0,5,0,.05),v(`maskRotation`,`mask rotation`,-180,180,0),g(`falloff`,`falloff`,.5,6,2,.1),g(`blurStrength`,`blur strength`,0,.1,.01,.001),_(`samples`,`samples`,10,1e3,150,{step:10}),_(`blades`,`blades`,3,10,6),g(`bladeRoundness`,`blade roundness`,0,1,0),v(`apertureRotation`,`aperture rotation`,-180,180,0),g(`apertureFeather`,`aperture feather`,0,.9,0),g(`anamorphic`,`anamorphic stretch`,1,3,1),g(`catadioptric`,`catadioptric`,0,.7,0),y(`invert`,`invert mask`,!1),y(`debugMask`,`debug mask`,!1,{noRandom:!0}),y(`debugAperture`,`debug aperture`,!1,{noRandom:!0})],shaders:{prep:`
${xe}
uniform sampler2D u_src;
uniform vec2 u_factor;  // source px per target texel
uniform float u_taps;   // taps per axis
uniform float u_store;  // scale keeping boosted values in range for 8-bit targets
uniform bool u_convert;
void main() {
  vec2 srcSize = vec2(textureSize(u_src, 0));
  int n = int(u_taps + 0.5);
  vec2 st = u_factor / srcSize / float(n);
  vec4 acc = vec4(0.0);
  for (int y = 0; y < 16; y++) {
    if (y >= n) break;
    for (int x = 0; x < 16; x++) {
      if (x >= n) break;
      vec4 s = texture(u_src, v_uv + (vec2(x, y) - 0.5 * float(n - 1)) * st);
      acc += u_convert ? vec4(boostHighlights(srgbToLinear(s.rgb)) * s.a * u_store, s.a) : s;
    }
  }
  fragColor = acc / float(n * n);
}`,gather:`
${xe}
uniform sampler2D u_prep;
uniform float u_cocScale; // CoC radius at full blur, in work texels
uniform float u_cocMax;   // largest CoC this level handles (work texels)
uniform float u_count;    // samples at u_cocMax
void main() {
  float coc = min(u_cocScale * blurAmount(v_uv, u_resolution), u_cocMax);
  if (coc < 0.5) { fragColor = texture(u_prep, v_uv); return; }
  float rel = coc / u_cocMax;
  // Fewer samples for smaller discs keeps the sample spacing (and look) constant.
  int n = int(clamp(ceil(u_count * rel * rel), min(u_count, 12.0), u_count));
  float c2 = u_catadioptric * u_catadioptric;
  float jitter = ign(gl_FragCoord.xy) * GOLDEN;
  vec2 texel = 1.0 / u_resolution;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 1000; i++) {
    if (i >= n) break;
    float u = (float(i) + 0.5) / float(n);
    float r = sqrt(c2 + (1.0 - c2) * u);
    float th = float(i) * GOLDEN + jitter;
    float e = apertureEdge(th);
    // e^2 compensates the density change of the radial warp.
    float w = e * e * apertureTransmission(r);
    vec2 off = vec2(cos(th), sin(th)) * (r * e * coc);
    off.y *= u_anamorphic;
    // Explicit LOD: the trip count varies per pixel, so avoid implicit-derivative fetches.
    acc += textureLod(u_prep, v_uv + off * texel, 0.0) * w;
    wsum += w;
  }
  fragColor = acc / max(wsum, 1e-6);
}`,main:`
${xe}
uniform sampler2D u_bokeh;  // coarse level
uniform sampler2D u_mid;    // finer level for small CoCs (when u_hasMid)
uniform float u_cocMaxPx;   // max CoC radius in full-res px
uniform float u_factor;     // full-res px per coarse texel
uniform float u_midFactor;  // full-res px per mid texel
uniform float u_store;
uniform bool u_hasBokeh;
uniform bool u_hasMid;
vec4 bokeh(sampler2D t, float factor) {
  vec4 b = factor > 1.01 ? textureBicubic(t, v_uv) : texture(t, v_uv);
  return b.a > 1e-5 ? vec4(unboostHighlights(max(b.rgb / (b.a * u_store), 0.0)), saturate(b.a)) : vec4(0.0);
}
void main() {
  vec4 base = texture(u_input, v_uv);
  if (u_debugAperture) {
    // Aperture kernel, filling ~80% of the image height.
    vec2 p = centered(v_uv, u_resolution) * u_anamorphic / 0.4;
    p.y /= u_anamorphic;
    float th = atan(p.y, p.x);
    float r = length(p) / apertureEdge(th);
    float aa = fwidth(r) + 1e-4;
    float t = apertureTransmission(r);
    t *= 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
    fragColor = vec4(vec3(t), 1.0);
    return;
  }
  float amt = blurAmount(v_uv, u_resolution);
  if (u_debugMask) { fragColor = vec4(vec3(amt), 1.0); return; }
  if (!u_hasBokeh) { fragColor = base; return; }
  float coc = u_cocMaxPx * amt;
  vec4 b = bokeh(u_bokeh, u_factor);
  // Fade sharp -> (mid ->) coarse; each level takes over once the CoC spans about one of its texels.
  float t = saturate(coc / u_factor);
  if (u_hasMid) {
    b = mix(bokeh(u_mid, u_midFactor), b, saturate((coc - u_factor) / (0.5 * u_factor)));
    t = saturate(coc / u_midFactor);
  }
  vec3 col = b.a > 0.0 ? linearToSrgb(b.rgb) : base.rgb;
  fragColor = vec4(mix(base.rgb, col, t), mix(base.a, b.a, t));
}`},render(e){let t=e.params,n=e.width,r=e.height,i=O(t,`blurStrength`)*r,a=re(t,`debugMask`)||re(t,`debugAperture`);if(i<.5)return a?e.pass(`main`,{uniforms:{u_hasBokeh:!1,u_hasMid:!1,u_factor:1,u_midFactor:1,u_cocMaxPx:0,u_store:1}}):e.input;let o=Math.round(O(t,`samples`)),s=Math.PI*i*i*Math.max(1,O(t,`anamorphic`)),c=e.exporting?1:1.5,l=Math.max(1,Math.sqrt(s/o)/c),u=e=>Math.min(o,Math.ceil(s/(e*e*c*c)));if(!e.exporting)for(;u(l)*(n*r/(l*l))>3e8&&l<64;)l*=1.15;let d=Math.max(1,u(l)),f=Math.max(1,Math.round(n/l)),p=Math.max(1,Math.round(r/l)),m=n/f,h=e.format===`rgba8`?.2:1,g=(t,n,r,i)=>{let a=t.width/n,o=t.height/r,s=Math.min(16,Math.max(1,Math.ceil(Math.max(a,o)/2)));return e.pass(`prep`,{width:n,height:r,inputs:{u_src:t},uniforms:{u_factor:[a,o],u_taps:s,u_store:h,u_convert:i}})},_=(t,i)=>{let a=n/t;if(a<=32)return g(e.input,t,i,!0);let o=Math.sqrt(a),s=g(e.input,Math.max(t,Math.round(n/o)),Math.max(i,Math.round(r/o)),!0),c=g(s,t,i,!1);return e.release(s),c},v=(t,n,r,i,a)=>{let o=_(t,n),s=e.pass(`gather`,{width:t,height:n,inputs:{u_prep:o},uniforms:{u_cocScale:r,u_cocMax:i,u_count:a}});return e.release(o),s},y=v(f,p,i/m,i/m,d),b=null,x=1;if(l>=4){let e=Math.max(1,Math.round(n/(l/4))),t=Math.max(1,Math.round(r/(l/4)));x=n/e;let a=Math.min(i,1.5*m);b=v(e,t,i/x,a/x,Math.max(1,Math.min(o,Math.ceil(s*(a/i)**2/(x*x*c*c)))))}let S=e.pass(`main`,{inputs:{u_bokeh:y,u_mid:b??y},uniforms:{u_hasBokeh:!0,u_hasMid:!!b,u_cocMaxPx:i,u_factor:m,u_midFactor:x,u_store:h}});return e.release(y),b&&e.release(b),S}},Ce={id:`gaussian-blur`,name:`Gaussian blur`,category:`Blur`,keywords:`background blur filter gaussian noise reduction soft`,params:[g(`strength`,`strength`,.3,50,14),g(`aspect`,`aspect`,-2,2,0),g(`opacity`,`opacity`,0,1,1),D()],shaders:{main:`
uniform sampler2D u_blurred;
void main() {
  vec4 base = texture(u_input, v_uv);
  vec4 b = texture(u_blurred, v_uv);
  vec3 c = blendMode(u_blendMode, base.rgb, b.rgb);
  fragColor = vec4(mix(base.rgb, c, u_opacity), mix(base.a, b.a, u_opacity));
}`},render(e){let t=O(e.params,`strength`)*e.pxScale,n=O(e.params,`aspect`),r=e.blur(e.input,t*2**n,t*2**-n),i=e.pass(`main`,{inputs:{u_blurred:r}});return e.release(r),i}},we=e=>!!e.maskEnable;function Te(e,t,n,r,i,a,o){let s=i-r,c=e.format;if(s<=48){let l=Math.max(1,Math.ceil(s)+1);return e.pass(`line`,{inputs:{u_src:t},uniforms:{u_dirPx:n,u_start:l>1?r:(r+i)/2,u_step:l>1?s/(l-1):0,u_count:l,u_sigma:a,u_toLinear:o},format:c})}let l=Math.max(2,Math.min(400,Math.round(Math.sqrt(s)))),u=s/l,d=a>0?2*u:u,f=Math.min(400,Math.ceil(d)),p=e.pass(`line`,{inputs:{u_src:t},uniforms:{u_dirPx:n,u_start:-d/2+d/f/2,u_step:d/f,u_count:f,u_sigma:0,u_toLinear:o},format:c}),m=e.pass(`line`,{inputs:{u_src:p},uniforms:{u_dirPx:n,u_start:r+u/2,u_step:u,u_count:l,u_sigma:a,u_toLinear:!1},format:c});return e.release(p),m}var Ee=[Se,_e,Ce,{id:`motion-blur`,name:`Motion blur`,category:`Blur`,keywords:`action blur camera motion movement speed`,params:[g(`strength`,`strength`,.3,50,20),v(`angle`,`angle`,0,360,0),y(`box`,`box`,!1),y(`bothDirections`,`both directions`,!0),D(),g(`opacity`,`opacity`,0,1,1),y(`maskEnable`,`enable mask`,!1),...be(we)],shaders:{line:ve,main:`
${ye}
uniform sampler2D u_blurred; // premultiplied linear
void main() {
  vec4 base = texture(u_input, v_uv);
  float amt = 1.0;
  if (u_maskEnable) {
    float m = focusMask(v_uv, u_resolution, pointToUv(u_maskCenter), u_maskRadius, u_maskFalloff, u_maskStretch, u_maskRotation);
    amt = u_maskInvert ? m : 1.0 - m;
    if (u_maskDebug) { fragColor = vec4(vec3(amt), 1.0); return; }
  }
  vec4 b = texture(u_blurred, v_uv);
  vec3 bc = b.a > 1e-6 ? linearToSrgb(b.rgb / b.a) : base.rgb;
  vec3 c = u_blendMode == 0 ? bc : blendMode(u_blendMode, saturate(base.rgb), saturate(bc));
  float k = u_opacity * amt;
  fragColor = vec4(mix(base.rgb, c, k), mix(base.a, b.a, k));
}`},render(e){let t=e.params,n=Math.max(.05,O(t,`strength`)*e.pxScale),r=2.4*n,i=O(t,`angle`)*Math.PI/180,a=[Math.cos(i),Math.sin(i)],[o,s]=re(t,`bothDirections`)?[-r,r]:[-r,0],c=Te(e,e.input,a,o,s,re(t,`box`)?0:n,!0),l=e.pass(`main`,{inputs:{u_blurred:c}});return e.release(c),l}},{id:`radial-blur`,name:`Radial blur`,category:`Blur`,keywords:`blur motion radial spin swirl zoom`,params:[S(`center`,`center`,[0,.5],{min:[-2,-2],max:[2,2]}),v(`angle`,`angle`,0,90,16),_(`samples`,`samples`,1,100,45),y(`box`,`box`,!1)],shaders:{main:`
void main() {
  vec2 res = u_resolution;
  vec2 c = pointToUv(u_center) * res;
  vec2 p = v_uv * res - c;
  int n = int(u_samples + 0.5);
  float ang = radians(u_angle);
  // Box: uniform over +-angle/2. Gaussian: same spread (sigma = 0.29 angle), tails out to +-0.64 angle.
  float span = u_box ? 0.5 * ang : 0.64 * ang;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 100; i++) {
    if (i >= n) break;
    float t = n > 1 ? float(i) / float(n - 1) * 2.0 - 1.0 : 0.0;
    float z = t * 0.64 / 0.29;
    float w = u_box ? 1.0 : exp(-0.5 * z * z);
    vec4 s = texture(u_input, (c + rot2(t * span) * p) / res);
    acc += vec4(s.rgb * s.a, s.a) * w;
    wsum += w;
  }
  fragColor = acc.a > 1e-6 ? vec4(acc.rgb / acc.a, acc.a / wsum) : vec4(0.0);
}`}},k,{id:`zoom-blur`,name:`Zoom blur`,category:`Blur`,keywords:`blur zoom`,params:[S(`center`,`center`,[0,0],{min:[-2,-2],max:[2,2]}),g(`strength`,`strength`,0,1,.2),_(`samples`,`samples`,1,100,45),y(`box`,`box`,!1)],shaders:{main:`
void main() {
  vec2 c = pointToUv(u_center);
  vec2 d = v_uv - c;
  int n = int(u_samples + 0.5);
  // Scale offsets: box uniform over +-0.35 s, gaussian sigma 0.2 s with tails to +-0.42 s (same spread).
  float span = (u_box ? 0.35 : 0.42) * u_strength;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 100; i++) {
    if (i >= n) break;
    float t = n > 1 ? float(i) / float(n - 1) * 2.0 - 1.0 : 0.0;
    float z = t * 2.1;
    float w = u_box ? 1.0 : exp(-0.5 * z * z);
    vec4 s = texture(u_input, c + d * max(1.0 + t * span, 0.0));
    acc += vec4(s.rgb * s.a, s.a) * w;
    wsum += w;
  }
  fragColor = acc.a > 1e-6 ? vec4(acc.rgb / acc.a, acc.a / wsum) : vec4(0.0);
}`}},ge];i(`radial-blur-v2`,`radial-blur`),i(`zoom-blur-v2`,`zoom-blur`);var De=[`Black`,`Shadow`,`Light`,`Highlight`,`Specular`],Oe={Black:`wB`,Shadow:`wS`,Light:`wL`,Highlight:`wH`,Specular:`wP`};function ke(e){let t=e.toLowerCase();return[ee(`${t}Tint`,`${e} tint`,[0,0],{group:e}),g(`${t}Exposure`,`${e} Exposure`,-4,4,0,.01,{group:e}),g(`${t}Saturation`,`${e} Saturation`,0,2,1,.01,{group:e})]}var Ae=De.map(e=>{let t=e.toLowerCase();return`${Oe[e]} * tintStops(u_${t}Tint, u_${t}TintColor)`}).join(` + `),je=e=>De.map(t=>`${Oe[t]} * u_${t.toLowerCase()}${e}`).join(` + `),Me={id:`color-grading`,name:`Color grading`,category:`Color`,keywords:`hdr color wheels grade, grading`,params:[ee(`globalTint`,`Global tint`,[0,0]),g(`globalExposure`,`Global Exposure`,-4,4,0,.01),g(`globalSaturation`,`Global Saturation`,0,2,1,.1),...De.flatMap(ke),g(`blackShadow`,`Black | Shadow`,-8,-1,-4,.05,{group:`Zones`,unit:` EV`}),g(`shadowLight`,`Shadow | Light`,-3,1.5,0,.05,{group:`Zones`,unit:` EV`}),g(`lightHighlight`,`Light | Highlight`,0,2.4,1.2,.05,{group:`Zones`,unit:` EV`}),g(`highlightSpecular`,`Highlight | Specular`,.5,2.5,2,.05,{group:`Zones`,unit:` EV`}),g(`zoneFalloff`,`Zone Falloff`,.25,2.5,1,.01,{group:`Zones`}),y(`showZones`,`Show zones`,!1,{group:`Zones`}),g(`strength`,`Strength`,0,1,1,.01,{group:`Zones`})],shaders:{main:`
// Wheel → per-channel log2 gain: push toward the wheel hue, luminance-neutral, up to ~1.5 stops.
vec3 tintStops(vec3 w, vec3 hueColor) {
  return (hueColor - luma(hueColor)) * (1.5 * w.z);
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 lin = srgbToLinear(src.rgb);
  float ev = log2(max(luma(lin), 1e-7) / 0.18);
  float b1 = u_blackShadow;
  float b2 = max(u_shadowLight, b1);
  float b3 = max(u_lightHighlight, b2);
  float b4 = max(u_highlightSpecular, b3);
  float f = 0.5 * u_zoneFalloff;
  float s1 = smoothstep(b1 - f, b1 + f, ev);
  float s2 = smoothstep(b2 - f, b2 + f, ev);
  float s3 = smoothstep(b3 - f, b3 + f, ev);
  float s4 = smoothstep(b4 - f, b4 + f, ev);
  float wB = 1.0 - s1, wS = s1 - s2, wL = s2 - s3, wH = s3 - s4, wP = s4;
  if (u_showZones) {
    vec3 zc = wB * vec3(0.16, 0.1, 0.45) + wS * vec3(0.15, 0.45, 1.0) + wL * vec3(0.25, 0.85, 0.35)
            + wH * vec3(1.0, 0.82, 0.2) + wP * vec3(1.0, 0.3, 0.25);
    fragColor = vec4(zc * (0.55 + 0.45 * saturate(luma(src.rgb))), src.a);
    return;
  }
  float stops = u_globalExposure + ${je(`Exposure`)};
  vec3 tint = tintStops(u_globalTint, u_globalTintColor) + ${Ae};
  float sat = u_globalSaturation * (${je(`Saturation`)});
  vec3 g = lin * exp2(stops + tint);
  float gy = luma(g);
  g = max(gy + (g - gy) * sat, 0.0);
  fragColor = vec4(mix(src.rgb, linearToSrgb(g), u_strength), src.a);
}`}};function Ne(e){let t=!!e.getExtension(`EXT_color_buffer_float`),n=!!e.getExtension(`OES_texture_float_linear`),r=!!e.getExtension(`KHR_parallel_shader_compile`),i=e.getExtension(`WEBGL_debug_renderer_info`),a=String(i?e.getParameter(i.UNMASKED_RENDERER_WEBGL):e.getParameter(e.RENDERER)),o=e.getParameter(e.MAX_VIEWPORT_DIMS);return{maxTextureSize:e.getParameter(e.MAX_TEXTURE_SIZE),maxRenderbufferSize:e.getParameter(e.MAX_RENDERBUFFER_SIZE),maxViewport:[o[0],o[1]],floatTargets:t,floatLinear:n,parallelCompile:r,renderer:a}}var A=class{gl;width;height;format;tex;fbo=null;inUse=!1;lastUsed=0;levels;constructor(e,t,n,r,i={}){this.gl=e,this.width=t,this.height=n,this.format=r;let a=e.createTexture();if(!a)throw Error(`Failed to create texture`);if(this.tex=a,this.levels=i.levels??1,e.bindTexture(e.TEXTURE_2D,a),e.texStorage2D(e.TEXTURE_2D,this.levels,r===`rgba16f`?e.RGBA16F:e.RGBA8,t,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,this.levels>1?e.LINEAR_MIPMAP_LINEAR:e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),i.renderable){let i=e.createFramebuffer();if(!i)throw Error(`Failed to create framebuffer`);e.bindFramebuffer(e.FRAMEBUFFER,i),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,a,0);let o=e.checkFramebufferStatus(e.FRAMEBUFFER);if(e.bindFramebuffer(e.FRAMEBUFFER,null),o!==e.FRAMEBUFFER_COMPLETE)throw e.deleteFramebuffer(i),e.deleteTexture(a),Error(`Framebuffer incomplete (0x${o.toString(16)}) for ${t}x${n} ${r}`);this.fbo=i}}get bytes(){return Math.round(this.width*this.height*(this.format===`rgba16f`?8:4)*(this.levels>1?4/3:1))}setFilter(e){let t=this.gl;t.bindTexture(t.TEXTURE_2D,this.tex);let n=e?this.levels>1?t.NEAREST_MIPMAP_NEAREST:t.NEAREST:this.levels>1?t.LINEAR_MIPMAP_LINEAR:t.LINEAR;t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,n),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,e?t.NEAREST:t.LINEAR)}setWrap(e,t=!1){let n=this.gl;n.bindTexture(n.TEXTURE_2D,this.tex);let r=t?n.MIRRORED_REPEAT:e?n.REPEAT:n.CLAMP_TO_EDGE;n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,r),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,r)}dispose(){let e=this.gl;this.fbo&&e.deleteFramebuffer(this.fbo),e.deleteTexture(this.tex),this.fbo=null}};function Pe(e,t){return Math.floor(Math.log2(Math.max(e,t)))+1}function Fe(e,t,n,r,i={}){let a=new A(e,n,r,`rgba8`,{levels:i.mipmaps?Pe(n,r):1});return e.bindTexture(e.TEXTURE_2D,a.tex),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!0),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.NONE),e.texSubImage2D(e.TEXTURE_2D,0,0,0,n,r,e.RGBA,e.UNSIGNED_BYTE,t),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),i.mipmaps&&e.generateMipmap(e.TEXTURE_2D),a.setFilter(!!i.nearest),a.setWrap(!!i.repeat),a}function j(e,t,n,r,i={}){let a=new A(e,n,r,`rgba8`);return Le(a,t),a.setFilter(!!i.nearest),a.setWrap(!!i.repeat),a}function Ie(e,t,n,r,i={}){let a=new A(e,n,r,`rgba16f`);return e.bindTexture(e.TEXTURE_2D,a.tex),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.texSubImage2D(e.TEXTURE_2D,0,0,0,n,r,e.RGBA,e.FLOAT,t),a.setFilter(!!i.nearest),a.setWrap(!!i.repeat),a}function Le(e,t){let n=e.gl;n.bindTexture(n.TEXTURE_2D,e.tex),n.pixelStorei(n.UNPACK_ALIGNMENT,1),n.texSubImage2D(n.TEXTURE_2D,0,0,0,e.width,e.height,n.RGBA,n.UNSIGNED_BYTE,t),n.pixelStorei(n.UNPACK_ALIGNMENT,4)}var Re=class{gl;free=[];all=new Set;constructor(e){this.gl=e}acquire(e,t,n){e=Math.max(1,Math.round(e)),t=Math.max(1,Math.round(t));let r=this.free.findIndex(r=>r.width===e&&r.height===t&&r.format===n),i;return r>=0?(i=this.free[r],this.free.splice(r,1)):(i=new A(this.gl,e,t,n,{renderable:!0}),this.all.add(i)),i.inUse=!0,i.lastUsed=performance.now(),i}release(e){e&&e.inUse&&this.all.has(e)&&(e.inUse=!1,this.free.push(e))}trim(e){this.free=this.free.filter(t=>e&&e(t)?!0:(t.dispose(),this.all.delete(t),!1))}trimOlderThan(e){let t=performance.now()-e;this.trim(e=>e.lastUsed>=t)}get allocatedBytes(){let e=0;for(let t of this.all)e+=t.bytes;return e}disposeAll(){for(let e of this.all)e.dispose();this.all.clear(),this.free=[]}},ze=`#version 300 es
out vec2 v_uv;
void main() {
  // Single oversized triangle covering the viewport.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,Be=class{gl;name;fragSource;program;uniforms=new Map;linked=!1;vs;fs;constructor(e,t,n){this.gl=e,this.name=t,this.fragSource=n,this.vs=Ue(e,e.VERTEX_SHADER,ze,t+` (vertex)`),this.fs=Ue(e,e.FRAGMENT_SHADER,n,t);let r=e.createProgram();if(!r)throw Error(`Failed to create program`);e.attachShader(r,this.vs),e.attachShader(r,this.fs),e.linkProgram(r),this.program=r}isReady(e){return this.linked||!e?!0:!!this.gl.getProgramParameter(this.program,37297)}finalize(){if(this.linked)return;let e=this.gl;if(!e.getProgramParameter(this.program,e.LINK_STATUS)){let t=e.getShaderInfoLog(this.fs)||``,n=e.getProgramInfoLog(this.program)||``;throw new Ve(this.name,(t+`
`+n).trim(),this.fragSource)}let t=e.getProgramParameter(this.program,e.ACTIVE_UNIFORMS);for(let n=0;n<t;n++){let t=e.getActiveUniform(this.program,n);if(!t)continue;let r=e.getUniformLocation(this.program,t.name);if(!r)continue;let i=t.name.replace(/\[0\]$/,``);this.uniforms.set(i,{loc:r,type:t.type,size:t.size})}e.detachShader(this.program,this.vs),e.detachShader(this.program,this.fs),e.deleteShader(this.vs),e.deleteShader(this.fs),this.linked=!0}dispose(){this.gl.deleteProgram(this.program)}},Ve=class extends Error{shaderName;log;source;constructor(e,t,n){super(`Shader "${e}" failed to compile:\n${He(t,n)}`),this.shaderName=e,this.log=t,this.source=n}};function He(e,t){let n=t.split(`
`),r=n.indexOf(`#line 1`);r>=0&&(n=n.slice(r+1));let i=[e],a=/ERROR:\s*\d+:(\d+)/g,o,s=new Set;for(;o=a.exec(e);){let e=parseInt(o[1],10);if(!s.has(e)){s.add(e);for(let t=Math.max(1,e-2);t<=Math.min(n.length,e+2);t++)i.push(`${t===e?`>`:` `}${String(t).padStart(5)}| ${n[t-1]}`)}}return i.join(`
`)}function Ue(e,t,n,r){let i=e.createShader(t);if(!i)throw Error(`Failed to create shader `+r);return e.shaderSource(i,n),e.compileShader(i),i}function We(e,t,n=0){let r=e.gl,i=n;for(let n in t){let a=t[n];if(a===void 0)continue;let o=e.uniforms.get(n);o&&(a instanceof A?(r.activeTexture(r.TEXTURE0+i),r.bindTexture(r.TEXTURE_2D,a.tex),r.uniform1i(o.loc,i),i++):Ge(r,o,a))}return i}function Ge(e,t,n){let r=typeof n==`boolean`?+!!n:n;switch(t.type){case e.FLOAT:typeof r==`number`?e.uniform1f(t.loc,r):e.uniform1fv(t.loc,Ke(r));break;case e.INT:case e.BOOL:case e.SAMPLER_2D:typeof r==`number`?e.uniform1i(t.loc,Math.round(r)):e.uniform1iv(t.loc,Int32Array.from(r,e=>Math.round(e)));break;case e.FLOAT_VEC2:e.uniform2fv(t.loc,Ke(r));break;case e.FLOAT_VEC3:e.uniform3fv(t.loc,Ke(r));break;case e.FLOAT_VEC4:e.uniform4fv(t.loc,Ke(r));break;case e.INT_VEC2:case e.BOOL_VEC2:e.uniform2iv(t.loc,Int32Array.from(r));break;case e.INT_VEC3:case e.BOOL_VEC3:e.uniform3iv(t.loc,Int32Array.from(r));break;case e.INT_VEC4:case e.BOOL_VEC4:e.uniform4iv(t.loc,Int32Array.from(r));break;case e.FLOAT_MAT3:e.uniformMatrix3fv(t.loc,!1,Ke(r));break;case e.FLOAT_MAT4:e.uniformMatrix4fv(t.loc,!1,Ke(r));break;case e.FLOAT_MAT2:e.uniformMatrix2fv(t.loc,!1,Ke(r))}}function Ke(e){return typeof e==`number`?new Float32Array([e]):e instanceof Float32Array?e:Float32Array.from(e)}function M(e){let t=(e||`#000000`).trim().replace(`#`,``);t.length===3&&(t=t.split(``).map(e=>e+e).join(``));let n=parseInt(t.slice(0,6),16);return Number.isNaN(n)?[0,0,0]:[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}function qe(e,t,n){let r=e=>Math.round(Math.min(1,Math.max(0,e))*255).toString(16).padStart(2,`0`);return`#`+r(e)+r(t)+r(n)}function Je(e,t=!1){let n=[...e].filter(e=>Number.isFinite(e[0])&&Number.isFinite(e[1])).sort((e,t)=>e[0]-t[0]);if(n.length===0)return e=>e;if(n.length===1){let e=n[0][1];return()=>e}if(t){let e=n[0],t=n[n.length-1];n=[[t[0]-1,t[1]],...n,[e[0]+1,e[1]]]}let r=n.length,i=n.map(e=>e[0]),a=n.map(e=>e[1]),o=[],s=Array(r).fill(0);for(let e=0;e<r-1;e++){let t=i[e+1]-i[e];o.push(t>1e-9?(a[e+1]-a[e])/t:0)}s[0]=o[0],s[r-1]=o[r-2];for(let e=1;e<r-1;e++)s[e]=o[e-1]*o[e]<=0?0:(o[e-1]+o[e])/2;for(let e=0;e<r-1;e++){if(o[e]===0){s[e]=0,s[e+1]=0;continue}let t=s[e]/o[e],n=s[e+1]/o[e],r=t*t+n*n;if(r>9){let i=3/Math.sqrt(r);s[e]=i*t*o[e],s[e+1]=i*n*o[e]}}return e=>{if(t&&(e-=Math.floor(e)),e<=i[0])return a[0];if(e>=i[r-1])return a[r-1];let n=0;for(;n<r-2&&e>i[n+1];)n++;let o=i[n+1]-i[n];if(o<1e-9)return a[n+1];let c=(e-i[n])/o,l=c*c,u=l*c;return(2*u-3*l+1)*a[n]+(u-2*l+c)*o*s[n]+(-2*u+3*l)*a[n+1]+(u-l)*o*s[n+1]}}function Ye(e,t=!1){let n=Je(e,t),r=new Float32Array(1024);for(let e=0;e<256;e++){let t=n(e/255);r[e*4]=r[e*4+1]=r[e*4+2]=t,r[e*4+3]=1}return r}function Xe(e,t){let n=[...e].sort((e,t)=>e.pos-t.pos);if(!n.length)return[t,t,t];if(t<=n[0].pos)return M(n[0].color);let r=n[n.length-1];if(t>=r.pos)return M(r.color);let i=0;for(;i<n.length-2&&t>n[i+1].pos;)i++;let a=n[i],o=n[i+1],s=(t-a.pos)/Math.max(1e-6,o.pos-a.pos),c=Math.min(.98,Math.max(.02,a.mid??.5));Math.abs(c-.5)>.001&&(s**=+(Math.log(.5)/Math.log(c)));let l=M(a.color),u=M(o.color);return[l[0]+(u[0]-l[0])*s,l[1]+(u[1]-l[1])*s,l[2]+(u[2]-l[2])*s]}function Ze(e,t=Xe){let n=new Float32Array(1024);for(let r=0;r<256;r++){let i=t(e,r/255);n.set([i[0],i[1],i[2],1],r*4)}return n}function Qe(e,t){let n=t.map(e=>parseInt(e,10)).filter(t=>t>=0&&t<e.length),r=n.length?n:[0],i=8*r.length,a=new Uint8Array(i*8*4);return r.forEach((t,n)=>{let r=e[t];for(let e=0;e<8;e++){let t=r[e]??0;for(let r=0;r<8;r++){let o=t>>7-r&1,s=((7-e)*i+n*8+r)*4,c=o?0:255;a[s]=a[s+1]=a[s+2]=c,a[s+3]=255}}}),{data:a,width:i,height:8,count:r.length}}var N=e=>e<=.04045?e/12.92:((Math.max(e,0)+.055)/1.055)**2.4,$e=e=>(e=Math.max(e,0),e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055);function et(e,t,n){let r=Math.cbrt(.4122214708*e+.5363325363*t+.0514459929*n),i=Math.cbrt(.2119034982*e+.6806995451*t+.1073969566*n),a=Math.cbrt(.0883024619*e+.2817188376*t+.6299787005*n);return[.2104542553*r+.793617785*i-.0040720468*a,1.9779984951*r-2.428592205*i+.4505937099*a,.0259040371*r+.7827717662*i-.808675766*a]}function tt(e,t,n){let r=(e+.3963377774*t+.2158037573*n)**3,i=(e-.1055613458*t-.0638541728*n)**3,a=(e-.0894841775*t-1.291485548*n)**3;return[4.0767416621*r-3.3077115913*i+.2309699292*a,-1.2684380046*r+2.6097574011*i-.3413193965*a,-.0041960863*r-.7034186147*i+1.707614701*a]}var nt=e=>et(N(e[0]),N(e[1]),N(e[2]));function rt(e){let t=tt(e[0],e[1],e[2]);return[$e(t[0]),$e(t[1]),$e(t[2])]}function it(e){let[t,n,r]=nt(e),i=Math.hypot(n,r);return[t,i,i<1e-4?0:Math.atan2(r,n)]}function at(e,t){let n=[...e].sort((e,t)=>e.pos-t.pos);if(!n.length)return[t,t,t];if(t<=n[0].pos)return M(n[0].color);let r=n[n.length-1];if(t>=r.pos)return M(r.color);let i=0;for(;i<n.length-2&&t>n[i+1].pos;)i++;let a=n[i],o=n[i+1],s=(t-a.pos)/Math.max(1e-6,o.pos-a.pos),c=Math.min(.98,Math.max(.02,a.mid??.5));Math.abs(c-.5)>.001&&(s**=+(Math.log(.5)/Math.log(c)));let l=it(M(a.color)),u=it(M(o.color)),d=u[2]-l[2];d=((d+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;let f=l[0]+(u[0]-l[0])*s,p=l[1]+(u[1]-l[1])*s,m=l[2]+d*s,h=rt([f,p*Math.cos(m),p*Math.sin(m)]);return[P(h[0]),P(h[1]),P(h[2])]}var P=e=>Math.min(1,Math.max(0,e));function ot(e,t=256){let n=new Float32Array(t*4);for(let r=0;r<t;r++){let i=e(r/(t-1));n[r*4]=i[0],n[r*4+1]=i[1],n[r*4+2]=i[2],n[r*4+3]=1}return n}function st(e,t){let n=e.map(M);if(n.length===1)return n[0];let r=P(t)*(n.length-1),i=Math.min(n.length-2,Math.floor(r)),a=r-i,o=n[i],s=n[i+1];return[o[0]+(s[0]-o[0])*a,o[1]+(s[1]-o[1])*a,o[2]+(s[2]-o[2])*a]}var ct=[[`#000000`,`#1c0a4a`,`#4f0c86`,`#931a8c`,`#cf3a5c`,`#f06c2b`,`#fba71b`,`#fde35e`,`#ffffff`],[`#000000`,`#1b0a6e`,`#0035ff`,`#00b4ff`,`#00f0a0`,`#7dff00`,`#fff000`,`#ff8a00`,`#ff0000`,`#ffffff`],[`#000000`,`#ffffff`],[`#000080`,`#0080ff`,`#00ff80`,`#ffff00`],[`#ffffff`,`#000000`],[`#000000`,`#3d0000`,`#8e0000`,`#d42400`,`#ff7000`,`#ffc000`,`#ffff9a`],[`#03052a`,`#13307f`,`#3c64c8`,`#8eb3ea`,`#f5e7a6`,`#ffbf3a`,`#ff7a12`],[`#000000`,`#003300`,`#007a10`,`#25d43a`,`#a8ff8c`,`#f0ffe8`],[`#0a0a5c`,`#1240ff`,`#00d0ff`,`#00ff4c`,`#ffff00`,`#ff5a00`,`#ff0060`,`#ffffff`],[`#000004`,`#2c115f`,`#721f81`,`#b73779`,`#f1605d`,`#feaf78`,`#fcfdbf`]],lt={id:`thermal`,name:`Thermal`,category:`Color`,keywords:`filter heat infrared map night scifi surveillance thermal vision visuals`,params:[y(`invert`,`invert`,!0),g(`shadows`,`shadows`,-.5,.5,-.5),g(`midtones`,`midtones`,-.5,.5,-.22),g(`highlights`,`highlights`,-.5,.5,-.05),_(`gradientType`,`gradient type`,0,9,3,{hint:`0 ironbow · 1 rainbow · 2 white hot · 3 arctic blue · 4 black hot · 5 lava · 6 arctic · 7 night vision · 8 predator · 9 magma`}),g(`gradientShift`,`gradient shift`,0,1,0),g(`gradientRepeat`,`gradient repeat`,.1,10,.7,.1),y(`showEdges`,`show edges`,!0),g(`edgeRange`,`edge range`,.15,2,.5,.01,{visibleIf:e=>!!e.showEdges})],shaders:{main:`
uniform sampler2D u_palette;
uniform sampler2D u_soft;
// Heat value: (inverted) luma through a 3-point tone curve (0, 0.5, 1) offset by shadows/midtones/highlights.
float heat(vec3 c) {
  float x = saturate(luma(c));
  if (u_invert) x = 1.0 - x;
  float y = x < 0.5
    ? mix(u_shadows, 0.5 + u_midtones, x * 2.0)
    : mix(0.5 + u_midtones, 1.0 + u_highlights, x * 2.0 - 1.0);
  return saturate(y);
}
void main() {
  vec4 src = texture(u_input, v_uv);
  // Slightly softened like a thermal sensor.
  float x = heat(texture(u_soft, v_uv).rgb) * u_gradientRepeat + u_gradientShift;
  float t = x > 0.0 ? x - ceil(x) + 1.0 : 0.0;
  vec3 col = lut3(u_palette, t);
  if (u_showEdges) {
    // Visible-light edge overlay (MSX style): gradient magnitude of the softened luma.
    vec2 d = texel() * max(u_edgeRange * 4.0 * u_pxScale, 0.75);
    float tl = luma(texture(u_soft, v_uv + vec2(-d.x, d.y)).rgb);
    float tc = luma(texture(u_soft, v_uv + vec2(0.0, d.y)).rgb);
    float tr = luma(texture(u_soft, v_uv + vec2(d.x, d.y)).rgb);
    float ml = luma(texture(u_soft, v_uv + vec2(-d.x, 0.0)).rgb);
    float mr = luma(texture(u_soft, v_uv + vec2(d.x, 0.0)).rgb);
    float bl = luma(texture(u_soft, v_uv + vec2(-d.x, -d.y)).rgb);
    float bc = luma(texture(u_soft, v_uv + vec2(0.0, -d.y)).rgb);
    float br = luma(texture(u_soft, v_uv + vec2(d.x, -d.y)).rgb);
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
    float e = smoothstep(0.1, 0.9, length(vec2(gx, gy)));
    col = mix(col, vec3(1.0), e * 0.25);
  }
  fragColor = vec4(col, src.a);
}`},render(e){let t=Math.max(0,Math.min(ct.length-1,Math.round(O(e.params,`gradientType`)))),n=e.cached(`thermal-palette:`+t,()=>Ie(e.gl,ot(e=>st(ct[t],e)),256,1),e=>e.dispose()),r=e.blur(e.input,1.6*e.pxScale),i=e.pass(`main`,{inputs:{u_palette:n,u_soft:r}});return e.release(r),i}},ut={id:`curves`,name:`Curves`,category:`Color`,keywords:`color contrast control curve curves grading highlight rgb shadow tone`,params:[x(`applyMode`,`apply mode`,[`Normal`,`Color`,`Luminosity`],0,`switcher`),w(`rgbCurve`,`RGB curve`,[[0,0],[1,1]],{color:`#e6e6e6`}),w(`redCurve`,`Red channel`,[[0,0],[1,1]],{color:`#ff5a5a`}),w(`greenCurve`,`Green channel`,[[0,0],[1,1]],{color:`#4fd16b`}),w(`blueCurve`,`Blue channel`,[[0,0],[1,1]],{color:`#4f8dff`})],shaders:{main:`
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = saturate(src.rgb);
  vec3 m = vec3(lut1(u_rgbCurve, c.r), lut1(u_rgbCurve, c.g), lut1(u_rgbCurve, c.b));
  vec3 o = vec3(lut1(u_redCurve, m.r), lut1(u_greenCurve, m.g), lut1(u_blueCurve, m.b));
  if (u_applyMode == 1) o = setLum(o, luma601(c));
  else if (u_applyMode == 2) o = setLum(c, luma601(o));
  fragColor = vec4(saturate(o), src.a);
}`}},dt={id:`color-balance`,name:`Color balance`,category:`Color`,keywords:`balance color`,params:[g(`red`,`red`,-1,1,.4),g(`green`,`green`,-1,1,-.7),g(`blue`,`blue`,-1,1,-1),y(`keepLuma`,`keep luma`,!1),g(`gamma`,`gamma`,.2,5,2)],shaders:{main:`
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = pow(max(src.rgb, 0.0), vec3(u_gamma));
  vec3 g = c * max(1.0 + vec3(u_red, u_green, u_blue), 0.0);
  if (u_keepLuma) {
    float a = luma(c), b = luma(g);
    g = b > 1e-5 ? g * (a / b) : g;
  }
  fragColor = vec4(pow(max(g, 0.0), vec3(1.0 / u_gamma)), src.a);
}`}},ft={id:`gradient-map`,name:`Gradient map`,category:`Color`,keywords:`gradient gradient map`,params:[T(`gradientMap`,`Gradient map`,[{pos:0,color:`#ff0000`,mid:.5},{pos:.5,color:`#000000`,mid:.5},{pos:1,color:`#0080ff`,mid:.5}],{evaluate:at}),g(`gradientShift`,`Gradient shift`,-1,1,0),_(`gradientRepeat`,`Gradient repeat`,1,8,1)],shaders:{main:`
void main() {
  vec4 src = texture(u_input, v_uv);
  float x = saturate(luma(src.rgb)) * u_gradientRepeat + u_gradientShift;
  // Wrap into (0, 1] for positive values so pure white keeps the last stop.
  float t = x > 0.0 ? x - ceil(x) + 1.0 : x - floor(x);
  fragColor = vec4(lut3(u_gradientMap, t), src.a);
}`}},pt={id:`color-temperature`,name:`Color temperature`,category:`Color`,keywords:`color temperature`,params:[g(`shadowTemperature`,`shadow temperature`,2e3,1e4,9249,1,{unit:`K`}),g(`highlightTemperature`,`highlight temperature`,2e3,1e4,8026,1,{unit:`K`}),g(`gamma`,`gamma`,.5,10,2.2)],shaders:{main:`
vec3 wbGain(float k) {
  vec3 g = kelvinToRgb(6500.0) / max(kelvinToRgb(k), vec3(1e-3));
  return g / dot(g, vec3(1.0 / 3.0));
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 lin = pow(max(src.rgb, 0.0), vec3(u_gamma));
  float w = saturate(luma(lin));
  vec3 g = mix(wbGain(u_shadowTemperature), wbGain(u_highlightTemperature), w);
  fragColor = vec4(pow(lin * g, vec3(1.0 / u_gamma)), src.a);
}`}},mt=new Map;function ht(e,t,n){let r=mt.get(n);if(!r){let e=1<<n;r=Array(e*e);for(let t=0;t<e;t++)for(let i=0;i<e;i++){let a=0;for(let e=0;e<n;e++){let r=i>>e&1,o=t>>e&1;a|=((r^o)<<1|o)<<2*(n-1-e)}r[t*e+i]=a}mt.set(n,r)}let i=1<<n;return r[t%i*i+e%i]}var F=(e,t)=>ht(e,t,3)/64,gt=[12,5,6,13,4,0,1,7,11,3,2,8,15,10,9,14],_t=[24,10,12,26,35,47,49,37,8,0,2,14,45,59,61,51,22,6,4,16,43,57,63,53,30,20,18,28,33,41,55,39,34,46,48,36,25,11,13,27,44,58,60,50,9,1,3,15,42,56,62,52,23,7,5,17,32,40,54,38,31,21,19,29],I=(e,t)=>(e%t+t)%t,L=(e,t)=>Math.abs(I(e,t)-t/2);function vt(e,t,n,r){let i=n[0]*r[1]-n[1]*r[0],a=Math.floor((e*r[1]-t*r[0])/i),o=Math.floor((n[0]*t-n[1]*e)/i),s=1/0;for(let i=a-2;i<=a+2;i++)for(let a=o-2;a<=o+2;a++){let o=i*n[0]+a*r[0],c=i*n[1]+a*r[1];s=Math.min(s,Math.hypot(e-o,t-c))}return s}var yt=(()=>{let e=1234567,t=()=>(e=Math.imul(e,1103515245)+12345>>>0)/4294967296,n=[];for(let e=0;e<8;e++)for(let r=0;r<8;r++)n.push([r*6+.8+t()*4.4,e*6+.8+t()*4.4]);return n})(),bt=[{name:`White noise`,src:{kind:`hash`}},{name:`Bayer 2x2`,src:{kind:`tile`,w:2,h:2,f:(e,t)=>ht(e,t,1)}},{name:`Bayer 4x4`,src:{kind:`tile`,w:4,h:4,f:(e,t)=>ht(e,t,2)}},{name:`Bayer 8x8`,src:{kind:`tile`,w:8,h:8,f:(e,t)=>ht(e,t,3)}},{name:`Bayer 16x16`,src:{kind:`tile`,w:16,h:16,f:(e,t)=>ht(e,t,4)}},{name:`Blue noise`,src:{kind:`blue`}},{name:`Interleaved gradient noise`,src:{kind:`ign`}},{name:`Cluster dot 4x4`,src:{kind:`tile`,w:4,h:4,f:(e,t)=>gt[t%4*4+e%4]}},{name:`Cluster dot 8x8`,src:{kind:`tile`,w:8,h:8,f:(e,t)=>_t[t%8*8+e%8]}},{name:`Halftone dots 45°`,src:{kind:`tile`,w:8,h:8,f:(e,t)=>vt(e+.5,t+.5,[4,4],[4,-4])+.01*F(e,t)}},{name:`Horizontal lines`,src:{kind:`tile`,w:8,h:24,f:(e,t)=>L(t+.5,6)+.99*F(e,t)}},{name:`Vertical lines`,src:{kind:`tile`,w:24,h:8,f:(e,t)=>L(e+.5,6)+.99*F(e,t)}},{name:`Diagonal lines /`,src:{kind:`tile`,w:24,h:24,f:(e,t)=>L(e-t,6)+.99*F(e,t)}},{name:`Diagonal lines \\`,src:{kind:`tile`,w:24,h:24,f:(e,t)=>L(e+t+1,6)+.99*F(e,t)}},{name:`Grid`,src:{kind:`tile`,w:6,h:6,f:(e,t)=>Math.min(L(e+.5,6),L(t+.5,6))+.5*Math.max(L(e+.5,6),L(t+.5,6))/3}},{name:`Crosshatch`,src:{kind:`tile`,w:24,h:24,f:(e,t)=>Math.min(L(e-t,6),L(e+t+1,6))+.99*F(e,t)}},{name:`Diamonds`,src:{kind:`tile`,w:8,h:8,f:(e,t)=>Math.abs(I(e,8)+.5-4)+Math.abs(I(t,8)+.5-4)+.01*F(e,t)}},{name:`Squares`,src:{kind:`tile`,w:8,h:8,f:(e,t)=>Math.max(Math.abs(I(e,8)+.5-4),Math.abs(I(t,8)+.5-4))+.99*F(e,t)}},{name:`Checker`,src:{kind:`tile`,w:8,h:8,f:(e,t)=>(Math.floor(e/4)+Math.floor(t/4))%2*8+Math.max(Math.abs(I(e,4)+.5-2),Math.abs(I(t,4)+.5-2))+.1*F(e,t)}},{name:`Waves`,src:{kind:`tile`,w:24,h:24,f:(e,t)=>L(t+.5-1.6*Math.sin((e+.5)/24*Math.PI*2),6)+.2*F(e,t)}},{name:`Bricks`,src:{kind:`tile`,w:8,h:8,f:(e,t)=>{let n=I(e+Math.floor(t/4)%2*4,8);return Math.max(Math.abs(n+.5-4)/4,Math.abs(I(t,4)+.5-2)/2)+.05*F(e,t)}}},{name:`Hex dots`,src:{kind:`tile`,w:8,h:14,f:(e,t)=>vt(e+.5,t+.5,[8,0],[4,7])}},{name:`Stipple`,src:{kind:`tile`,w:48,h:48,f:(e,t)=>{let n=1/0;for(let[r,i]of yt){let a=Math.abs(e+.5-r),o=Math.abs(t+.5-i);n=Math.min(n,Math.hypot(Math.min(a,48-a),Math.min(o,48-o)))}return n}}}];function xt(e){let t=e.map((e,t)=>t).sort((t,n)=>e[t]-e[n]),n=Array(e.length),r=0;for(;r<t.length;){let i=r;for(;i+1<t.length&&Math.abs(e[t[i+1]]-e[t[r]])<1e-9;)i++;let a=(r+i)/2;for(let o=r;o<=i;o++)n[t[o]]=(a+.5)/e.length;r=i+1}return n}function St(){let e=[],t=0,n=1;for(let r of bt)e.push(t),r.src.kind===`tile`&&(t+=r.src.w,n=Math.max(n,r.src.h));let r=new Float32Array(t*n*4);return bt.forEach((n,i)=>{if(n.src.kind!==`tile`)return;let{w:a,h:o,f:s}=n.src,c=[];for(let e=0;e<o;e++)for(let t=0;t<a;t++)c.push(s(t,e));let l=xt(c);for(let n=0;n<o;n++)for(let o=0;o<a;o++){let s=(n*t+e[i]+o)*4;r[s]=r[s+1]=r[s+2]=l[n*a+o],r[s+3]=1}}),{data:r,width:t,height:n,offsets:e}}var Ct=e=>Array.from({length:e},(t,n)=>{let r=Math.round(n/(e-1)*255).toString(16).padStart(2,`0`);return`#`+r+r+r}),wt=[`Elevate`,`Primaries`,`Imperial`,`Galaxy`,`Ocean`,`Sepia`,`Neon`,`Monochrome`,`Wildberry`,`Crystals`,`Faded`,`Sunny`],Tt={Elevate:[`#1b1530`,`#2f2a5c`,`#3f5f9c`,`#2f8f9d`,`#5cc6b0`,`#a6e3c0`,`#f4f1d0`,`#f7c59f`,`#ef8a62`,`#d6505e`,`#8e2f5e`,`#ffffff`],Primaries:[`#000000`,`#ffffff`,`#ff0000`,`#00ff00`,`#0000ff`,`#00ffff`,`#ff00ff`,`#ffff00`],Imperial:[`#0d0a14`,`#2b1b3d`,`#4b1f5c`,`#1d2c55`,`#7a1f2b`,`#b3202a`,`#355c4b`,`#c9a227`,`#e8cf7a`,`#f3ead2`],Galaxy:[`#05030f`,`#140c33`,`#2a1460`,`#4b1d8f`,`#7b2cbf`,`#c03fbf`,`#ff5ca8`,`#ff9ec7`,`#3a86ff`,`#7fd8ff`,`#e0f7ff`,`#ffffff`],Ocean:[`#021526`,`#03346e`,`#0b5394`,`#0f6b5c`,`#1c7cb0`,`#2aa1c2`,`#4fc3c8`,`#8de0d6`,`#c9f2ea`,`#e6d7b0`,`#f3fbf8`],Sepia:[`#1a120b`,`#2e2014`,`#45301e`,`#5c4129`,`#755436`,`#8f6a46`,`#a98258`,`#c19c70`,`#d6b78d`,`#e8d2ad`,`#f5e9d0`,`#fffaf0`],Neon:[`#05010d`,`#7b2ff7`,`#ff00a0`,`#ff2a6d`,`#00b4ff`,`#ffb800`,`#00f5d4`,`#39ff14`,`#f9f871`,`#ffffff`],Monochrome:Ct(18),Wildberry:[`#14051c`,`#2d0a35`,`#4a0d4f`,`#6b1364`,`#2e3a87`,`#8e1a6e`,`#2f5a3a`,`#b5245f`,`#5866c4`,`#d63f6a`,`#6f9a4f`,`#f06e8c`,`#f7a8c0`,`#fde0ea`],Crystals:[`#0b1026`,`#1d2b64`,`#3c4fa8`,`#6d7fd8`,`#c9a7ff`,`#7fdbff`,`#a5b4fc`,`#b8f2ff`,`#d6dcff`,`#ffd6f5`,`#f5f7ff`,`#ffffff`],Faded:[`#2b2b2e`,`#45474d`,`#5f6b73`,`#6b7f99`,`#a07f78`,`#7d8d8f`,`#8fb3b0`,`#9aa8a0`,`#c9a99a`,`#c2c5b5`,`#e3dfcf`,`#f2ece0`],Sunny:[`#2b1406`,`#5a2a0a`,`#8c3f0e`,`#3b8bc2`,`#6aa84f`,`#c45f12`,`#7ec8e3`,`#ec8a1c`,`#f7b733`,`#fcd667`,`#fff2b2`,`#fffbe8`]},Et=[`#000000`,`#1d2b53`,`#7e2553`,`#008751`,`#ab5236`,`#5f574f`,`#c2c3c7`,`#fff1e8`,`#ff004d`,`#ffa300`,`#ffec27`,`#00e436`,`#29adff`,`#83769c`,`#ff77a8`,`#ffccaa`],Dt=e=>.2126*e[0]+.7152*e[1]+.0722*e[2],Ot=e=>[...e].sort((e,t)=>Dt(e)-Dt(t));function kt(e,t){let n=Ot(e.map(M));if(t>=n.length)return n;let r=[];for(let e=0;e<t;e++)r.push(n[Math.round(e*(n.length-1)/Math.max(1,t-1))]);return r}function At(e,t){let n=[];for(let t=0;t<e.length;t+=4)e[t+3]<.5||n.push(et(N(P(e[t])),N(P(e[t+1])),N(P(e[t+2]))));if(!n.length)return[[0,0,0],[1,1,1]];let r=[n],i=e=>{let t=jt(e),n=0;for(let r of e)n+=(r[0]-t[0])**2+(r[1]-t[1])**2+(r[2]-t[2])**2;return n};for(;r.length<t;){let e=-1,t=1e-9;if(r.forEach((n,r)=>{if(n.length<2)return;let a=i(n);a>t&&(t=a,e=r)}),e<0)break;let n=r[e],a=0,o=-1;for(let e=0;e<3;e++){let t=1/0,r=-1/0;for(let i of n)t=Math.min(t,i[e]),r=Math.max(r,i[e]);r-t>o&&(o=r-t,a=e)}let s=[...n].sort((e,t)=>e[a]-t[a]),c=s.length>>1;r=[...r.slice(0,e),s.slice(0,c),s.slice(c),...r.slice(e+1)]}let a=r.map(jt);for(let e=0;e<6;e++){let e=a.map(()=>[0,0,0,0]);for(let t of n){let n=0,r=1/0;for(let e=0;e<a.length;e++){let i=(t[0]-a[e][0])**2+(t[1]-a[e][1])**2+(t[2]-a[e][2])**2;i<r&&(r=i,n=e)}let i=e[n];i[0]+=t[0],i[1]+=t[1],i[2]+=t[2],i[3]++}a=a.map((t,n)=>e[n][3]?[e[n][0]/e[n][3],e[n][1]/e[n][3],e[n][2]/e[n][3]]:t)}return Ot(a.map(e=>rt(e).map(P)))}function jt(e){let t=[0,0,0];for(let n of e)t[0]+=n[0],t[1]+=n[1],t[2]+=n[2];let n=Math.max(1,e.length);return[t[0]/n,t[1]/n,t[2]/n]}var Mt=18,Nt=[`Adaptive`,...wt,`Custom`],Pt=Nt.length-1;function Ft(e,t){let n=e.params,r=Math.round(O(n,`palettePreset`));if(r===Pt)return kt((n.palette?.length?n.palette:Et).slice(0,Mt),t);if(r>=1&&r<Pt)return kt(Tt[wt[r-1]],t);let i=64/Math.max(e.width,e.height),a=Math.max(1,Math.round(e.width*i)),o=Math.max(1,Math.round(e.height*i)),s=e.blur(e.input,.5/i),c=e.pass(`reduce`,{width:a,height:o,inputs:{u_src:s}});e.release(s);let l=e.read(c);e.release(c);let u=2166136261;for(let e=0;e<l.length;e++)u=Math.imul(u^Math.round(l[e]*63),16777619);return e.cached(`adaptive:${t}:${a}x${o}:${u>>>0}`,()=>At(l,t))}var It={id:`dither`,name:`Dither`,category:`Color`,keywords:`art color dither dithering halftone pixel print reduction retro vintage palette adaptive`,params:[_(`patternType`,`pattern type`,0,bt.length-1,0,{hint:bt.map((e,t)=>`${t} ${e.name}`).join(` · `)}),x(`palettePreset`,`palette preset`,Nt,0,`slider`),te(`palette`,`Palette`,Et,{maxColors:Mt,visibleIf:e=>Number(e.palettePreset)===Pt}),_(`colorCount`,`color count`,2,Mt,Mt),_(`distanceMode`,`distance mode`,0,2,2,{hint:`0 = RGB, 1 = weighted RGB, 2 = OKLab`}),g(`ditherStrength`,`dither strength`,0,2,2,.1),g(`gamma`,`gamma`,.5,5,1.6,.1),_(`pixelStep`,`pixelStep`,1,4,2)],shaders:{reduce:`
uniform sampler2D u_src;
void main() {
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 6; j++)
    for (int i = 0; i < 6; i++) {
      vec2 uv = (gl_FragCoord.xy - 0.5 + (vec2(i, j) + 0.5) / 6.0) / u_resolution;
      acc += saturate(texture(u_src, uv));
    }
  fragColor = acc / 36.0;
}`,quantize:`
#define MAXC ${Mt}
uniform sampler2D u_src;
uniform sampler2D u_atlas;
uniform sampler2D u_blue;
uniform vec2 u_full;
uniform float u_block;
uniform float u_amp;
uniform int u_patMode;
uniform int u_patOffset;
uniform ivec2 u_patSize;
uniform vec3 u_pal[MAXC];
uniform vec3 u_palLab[MAXC];
uniform int u_palCount;

float threshold(ivec2 p) {
  if (u_patMode == 0) return hash12(vec2(p));
  if (u_patMode == 1) return texelFetch(u_blue, p & 127, 0).r;
  if (u_patMode == 2) return ign(vec2(p));
  ivec2 q = ivec2(p.x % u_patSize.x, p.y % u_patSize.y);
  return texelFetch(u_atlas, ivec2(u_patOffset + q.x, q.y), 0).r;
}
int nearest(vec3 c) {
  vec3 lab = u_distanceMode > 1.5 ? linearToOklab(srgbToLinear(c)) : c;
  float best = 1e20;
  int bi = 0;
  for (int k = 0; k < MAXC; k++) {
    if (k >= u_palCount) break;
    vec3 e = c - u_pal[k];
    float d;
    if (u_distanceMode < 0.5) {
      d = dot(e, e);
    } else if (u_distanceMode < 1.5) {
      float rm = 0.5 * (c.r + u_pal[k].r);
      d = (2.0 + rm) * e.r * e.r + 4.0 * e.g * e.g + (3.0 - rm) * e.b * e.b;
    } else {
      vec3 el = lab - u_palLab[k];
      d = dot(el, el);
    }
    if (d < best) { best = d; bi = k; }
  }
  return bi;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 4; j++)
    for (int i = 0; i < 4; i++) {
      vec2 px = (vec2(p) + (vec2(i, j) + 0.5) / 4.0) * u_block;
      acc += texture(u_src, min(px, u_full - 0.5) / u_full).rgb;
    }
  vec3 c = pow(saturate(acc / 16.0), vec3(1.0 / u_gamma));
  c = saturate(c + (threshold(p) - 0.5) * u_amp);
  fragColor = vec4(u_pal[nearest(c)], 1.0);
}`,main:`
uniform sampler2D u_small;
uniform float u_block;
void main() {
  vec3 c = texelFetch(u_small, ivec2(floor(gl_FragCoord.xy / u_block)), 0).rgb;
  fragColor = vec4(c, texture(u_input, v_uv).a);
}`},render(e){let t=e.params,n=Ot(Ft(e,Math.max(2,Math.min(Mt,Math.round(O(t,`colorCount`)))))),r=new Float32Array(54),i=new Float32Array(54);n.slice(0,Mt).forEach((e,t)=>{r.set(e,t*3),i.set(et(N(e[0]),N(e[1]),N(e[2])),t*3)});let a=0;for(let e of n){let t=1/0;for(let r of n)e!==r&&(t=Math.min(t,Math.hypot(e[0]-r[0],e[1]-r[1],e[2]-r[2])));a+=Number.isFinite(t)?t:0}let o=a/Math.max(1,n.length)/Math.sqrt(3),s=O(t,`ditherStrength`)*Math.max(.1,.5*o),c=e.cached(`dither-atlas`,()=>{let t=St();return{tex:Ie(e.gl,t.data,t.width,t.height,{nearest:!0}),offsets:t.offsets}},e=>e.tex.dispose()),l=Math.max(0,Math.min(bt.length-1,Math.round(O(t,`patternType`)))),u=bt[l].src,d=u.kind===`hash`?0:u.kind===`blue`?1:u.kind===`ign`?2:3,f=u.kind===`tile`?[u.w,u.h]:[1,1],p=Math.max(1,Math.round(O(t,`pixelStep`)*e.pxScale*1.125)),m=Math.ceil(e.width/p),h=Math.ceil(e.height/p),g=p>=6?e.blur(e.input,p*.25):null,_=e.pass(`quantize`,{width:m,height:h,inputs:{u_src:g??e.input,u_atlas:c.tex,u_blue:e.builtin(`blueNoise`)},uniforms:{u_full:[e.width,e.height],u_block:p,u_amp:s,u_patMode:d,u_patOffset:c.offsets[l],u_patSize:f,u_pal:r,u_palLab:i,u_palCount:n.length}});g&&e.release(g);let v=e.pass(`main`,{inputs:{u_small:_},uniforms:{u_block:p}});return e.release(_),v}},Lt=[[0,.5],[1,.5]],Rt=(e,t)=>w(e,t,Lt,{periodic:!0,hueBackground:!0}),zt=[Me,lt,ut,dt,ft,pt,It,{id:`hue-curves`,name:`Hue curves`,category:`Color`,keywords:`color curves hue hue-curves hue-saturation`,params:[x(`model`,`Model`,[`HSV`,`OKLAB`],0,`switcher`),Rt(`hueVsHue`,`Hue vs Hue`),Rt(`hueVsSaturation`,`Hue vs Saturation`),Rt(`hueVsLuminance`,`Hue vs Luminance`),g(`hueSoftness`,`Hue softness`,0,.25,.025,.005),g(`lumaSoftness`,`Luma softness`,0,.35,.08,.005),g(`amount`,`Amount`,0,1,1)],shaders:{main:`
float softCurve(sampler2D t, float h) {
  if (u_hueSoftness < 1e-4) return lut1Periodic(t, h);
  float s = 0.0, ws = 0.0;
  for (int i = -4; i <= 4; i++) {
    float o = float(i) / 4.0;
    float w = exp(-2.5 * o * o);
    s += w * lut1Periodic(t, h + o * u_hueSoftness);
    ws += w;
  }
  return s / ws;
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = saturate(src.rgb);
  vec3 hsv = rgb2hsv(c);
  float dh = softCurve(u_hueVsHue, hsv.x) - 0.5;
  float sm = 2.0 * softCurve(u_hueVsSaturation, hsv.x);
  float dl = softCurve(u_hueVsLuminance, hsv.x) - 0.5;
  float ls = max(u_lumaSoftness, 1e-4);
  float y = luma(c);
  float w = u_amount * smoothstep(0.0, ls, y) * smoothstep(0.0, ls, 1.0 - y);
  vec3 o;
  if (u_model == 0) {
    float cw = smoothstep(0.0, 0.08, hsv.y * hsv.z);
    hsv.x = fract(hsv.x + dh * w);
    hsv.y = saturate(hsv.y * mix(1.0, sm, w));
    hsv.z *= exp2(2.0 * dl * w * cw);
    o = hsv2rgb(hsv);
  } else {
    vec3 lch = srgbToOklch(c);
    float cw = smoothstep(0.0, 0.04, lch.y);
    lch.z += dh * w * TAU;
    lch.y *= mix(1.0, sm, w);
    lch.x = max(lch.x + dl * 0.5 * w * cw, 0.0);
    o = oklchToSrgb(lch);
  }
  fragColor = vec4(saturate(o), src.a);
}`}},{id:`duotone`,name:`Duotone`,category:`Color`,keywords:`color colorization colors glitch gradient map mapping poster`,params:[b(`startColor`,`start color`,`#e63217`),b(`endColor`,`end color`,`#f4b642`),g(`redGamma`,`red gamma`,.3,3,1),g(`greenGamma`,`green gamma`,.3,3,1),g(`blueGamma`,`blue gamma`,.3,3,1)],shaders:{main:`
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 t = pow(saturate(src.rgb), vec3(u_redGamma, u_greenGamma, u_blueGamma));
  fragColor = vec4(mix(u_startColor, u_endColor, t), src.a);
}`}},{id:`hue-saturation`,name:`Hue/saturation`,category:`Color`,keywords:`adjustment color control correction editing grading hue saturation`,params:[v(`hue`,`hue rotation`,0,360,262),g(`saturation`,`saturation`,0,5,1),y(`invert`,`invert colors`,!1),y(`preserveLightness`,`preserve lightness`,!0)],shaders:{main:`
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = saturate(src.rgb);
  if (u_invert) c = 1.0 - c;
  vec3 hsv = rgb2hsv(c);
  hsv.x = fract(hsv.x - u_hue / 360.0);
  hsv.y = saturate(hsv.y * u_saturation);
  vec3 o = hsv2rgb(hsv);
  if (u_preserveLightness) o += dot(c - o, vec3(1.0 / 3.0));
  fragColor = vec4(saturate(o), src.a);
}`}},{id:`levels`,name:`Levels`,category:`Color`,keywords:`levels`,params:[C(`inputLevels`,`input levels`,0,1,[0,1]),g(`midpoint`,`midpoint`,.2,5,1),C(`outputLevels`,`output levels`,0,1,[0,1]),y(`affectLumaOnly`,`affect luma only`,!1)],shaders:{main:`
vec3 levelsMap(vec3 x) {
  float lo = u_inputLevels.x;
  float hi = max(u_inputLevels.y, lo + 1e-4);
  x = saturate((x - lo) / (hi - lo));
  x = pow(x, vec3(1.0 / u_midpoint));
  return mix(vec3(u_outputLevels.x), vec3(u_outputLevels.y), x);
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 o;
  if (u_affectLumaOnly) {
    float l = luma(src.rgb);
    o = saturate(src.rgb + (levelsMap(vec3(l)).x - l));
  } else {
    o = levelsMap(src.rgb);
  }
  fragColor = vec4(o, src.a);
}`}},{id:`exposure`,name:`Exposure`,category:`Color`,keywords:`exposure`,params:[g(`exposure`,`exposure`,-5,5,0),g(`gamma`,`gamma`,.5,10,2.2),g(`gamutMapping`,`gamut mapping`,0,1,0),y(`reinhard`,`reinhard`,!1),y(`showClipping`,`show clipping`,!1)],shaders:{main:`
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 lin = pow(max(src.rgb, 0.0), vec3(u_gamma)) * exp2(u_exposure);
  if (u_reinhard) {
    float lw = max(1.0, exp2(u_exposure));
    float y = luma(lin);
    float yt = y * (1.0 + y / (lw * lw)) / (1.0 + y);
    lin *= y > 1e-6 ? yt / y : 1.0;
  }
  if (u_gamutMapping > 0.0) {
    float y = luma(lin);
    float mx = max(lin.r, max(lin.g, lin.b));
    vec3 mapped = lin;
    if (y >= 1.0) mapped = vec3(1.0);
    else if (mx > 1.0) mapped = y + (lin - y) * (1.0 - y) / (mx - y);
    // Negative channels (from wide-gamut math) pull toward luminance too.
    float mn = min(lin.r, min(lin.g, lin.b));
    if (mn < 0.0 && y > 0.0) mapped = y + (mapped - y) * y / (y - mn);
    lin = mix(lin, max(mapped, 0.0), u_gamutMapping);
  }
  vec3 o = pow(max(lin, 0.0), vec3(1.0 / u_gamma));
  if (u_showClipping) {
    float mx = max(lin.r, max(lin.g, lin.b));
    float period = max(12.0 * u_pxScale, 6.0);
    float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / period));
    if (mx > 1.0 + 1e-3) o = mix(vec3(1.0, 0.1, 0.1), vec3(1.0), stripe);
    else if (max(o.r, max(o.g, o.b)) < 0.5 / 255.0) o = vec3(0.1, 0.3, 1.0);
  }
  fragColor = vec4(o, src.a);
}`}},{id:`monochrome`,name:`Monochrome`,category:`Color`,keywords:`monochrome`,params:[g(`redWeight`,`red weight`,-1,2,.683,.001),g(`greenWeight`,`green weight`,-1,2,1.155,.001),g(`blueWeight`,`blue weight`,-1,2,.199,.001),y(`normalizeWeights`,`normalize weights`,!0),b(`tintColor`,`tint color`,`#ffffff`)],shaders:{main:`
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 w = vec3(u_redWeight, u_greenWeight, u_blueWeight);
  if (u_normalizeWeights) {
    float s = w.r + w.g + w.b;
    if (abs(s) > 1e-4) w /= s;
  }
  float y = max(dot(src.rgb, w), 0.0);
  fragColor = vec4(vec3(y) * u_tintColor, src.a);
}`}},{id:`color-matrix`,name:`Color matrix`,category:`Color`,keywords:`cinematic color grading manipulation matrix transform`,params:[g(`redFromRed`,`Red from Red`,-2,2,-.5),g(`redFromGreen`,`Red from Green`,-2,2,1.6),g(`redFromBlue`,`Red from Blue`,-2,2,.33),g(`greenFromRed`,`Green from Red`,-2,2,-.75),g(`greenFromGreen`,`Green from Green`,-2,2,-1.4),g(`greenFromBlue`,`Green from Blue`,-2,2,1.8),g(`blueFromRed`,`Blue from Red`,-2,2,.8),g(`blueFromGreen`,`Blue from Green`,-2,2,-1),g(`blueFromBlue`,`Blue from Blue`,-2,2,1),g(`redOffset`,`Red Offset`,-2,2,1.35),g(`greenOffset`,`Green Offset`,-2,2,1.3),g(`blueOffset`,`Blue Offset`,-2,2,-.2)],shaders:{main:`
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = src.rgb;
  vec3 o = vec3(
    dot(c, vec3(u_redFromRed, u_redFromGreen, u_redFromBlue)),
    dot(c, vec3(u_greenFromRed, u_greenFromGreen, u_greenFromBlue)),
    dot(c, vec3(u_blueFromRed, u_blueFromGreen, u_blueFromBlue))) + vec3(u_redOffset, u_greenOffset, u_blueOffset);
  fragColor = vec4(saturate(o), src.a);
}`}},{id:`rgb-gain`,name:`RGB Gain`,category:`Color`,keywords:`gain rgb`,params:[g(`redMidpoint`,`red midpoint`,0,1,0),g(`greenMidpoint`,`green midpoint`,0,1,0),g(`blueMidpoint`,`blue midpoint`,0,1,0),g(`redGain`,`red gain`,0,5,1),g(`greenGain`,`green gain`,0,5,1),g(`blueGain`,`blue gain`,0,5,1),g(`redGamma`,`red gamma`,.2,5,1),g(`greenGamma`,`green gamma`,.2,5,1),g(`blueGamma`,`blue gamma`,.2,5,1)],shaders:{main:`
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 mid = vec3(u_redMidpoint, u_greenMidpoint, u_blueMidpoint);
  vec3 c = (src.rgb - mid) * vec3(u_redGain, u_greenGain, u_blueGain) + mid;
  c = pow(max(c, 0.0), 1.0 / vec3(u_redGamma, u_greenGamma, u_blueGamma));
  fragColor = vec4(c, src.a);
}`}},{id:`contrast`,name:`Contrast`,category:`Color`,keywords:`contrast`,params:[g(`strength`,`contrast strength`,-2,2,.2,.1),g(`pivot`,`pivot point`,0,1,.5),g(`outputMapping`,`output mapping`,0,1,1),g(`gamma`,`gamma`,.2,5,2.2)],shaders:{main:`
// Smoothstep S-curve with its fixed point (slope 1.5) at the pivot p; values above 1 pass through.
vec3 contrastCurve(vec3 x, float p) {
  vec3 xc = clamp(x, 0.0, 1.0);
  vec3 lo = 2.0 * p * smoothstep(0.0, 1.0, 0.5 * xc / p);
  vec3 hi = p + (1.0 - p) * 2.0 * (smoothstep(0.0, 1.0, 0.5 + 0.5 * (xc - p) / (1.0 - p)) - 0.5);
  vec3 s = mix(lo, hi, step(p, xc));
  return mix(xc, s, u_strength) + (x - xc);
}
void main() {
  vec4 src = texture(u_input, v_uv);
  float p = clamp(u_pivot, 0.001, 0.999);
  vec3 x = pow(max(src.rgb, 0.0), vec3(u_gamma));
  float y = luma(x);
  float yc = contrastCurve(vec3(y), p).x;
  vec3 viaLuma = x * (y > 1e-6 ? max(yc, 0.0) / y : 1.0);
  vec3 perChannel = contrastCurve(x, p);
  vec3 o = mix(perChannel, viaLuma, u_outputMapping);
  fragColor = vec4(pow(max(o, 0.0), vec3(1.0 / u_gamma)), src.a);
}`}}],R=`
float shortSide() { return min(u_resolution.x, u_resolution.y); }
vec2 unitScale() { return u_resolution / min(u_resolution.x, u_resolution.y); }
vec2 uvToUnit(vec2 uv) { return (uv - 0.5) * 2.0 * unitScale(); }
vec2 unitToUv(vec2 p) { return p * 0.5 / unitScale() + 0.5; }

// Catmull-Rom bicubic (9 bilinear taps) with explicit LOD, safe in non-uniform control flow.
vec4 bicubicLod(sampler2D tex, vec2 uv) {
  vec2 size = vec2(textureSize(tex, 0));
  vec2 sp = uv * size;
  vec2 t1 = floor(sp - 0.5) + 0.5;
  vec2 f = sp - t1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 p0 = (t1 - 1.0) / size, p3 = (t1 + 2.0) / size, p12 = (t1 + w2 / w12) / size;
  vec4 r = (textureLod(tex, vec2(p0.x, p0.y), 0.0) * w0.x + textureLod(tex, vec2(p12.x, p0.y), 0.0) * w12.x + textureLod(tex, vec2(p3.x, p0.y), 0.0) * w3.x) * w0.y;
  r += (textureLod(tex, vec2(p0.x, p12.y), 0.0) * w0.x + textureLod(tex, vec2(p12.x, p12.y), 0.0) * w12.x + textureLod(tex, vec2(p3.x, p12.y), 0.0) * w3.x) * w12.y;
  r += (textureLod(tex, vec2(p0.x, p3.y), 0.0) * w0.x + textureLod(tex, vec2(p12.x, p3.y), 0.0) * w12.x + textureLod(tex, vec2(p3.x, p3.y), 0.0) * w3.x) * w3.y;
  return max(r, vec4(0.0));
}

// Resample a texture at a warped uv. dx/dy are the uv derivatives (computed by the caller in
// uniform control flow). Strong magnification uses Catmull-Rom; minification is box filtered over
// the pixel footprint (pooled render targets have no mipmaps). Huge derivatives (seams/folds of the
// mapping) fall back to a single tap instead of smearing across the discontinuity.
vec4 sampleWarp(sampler2D tex, vec2 uv, vec2 dx, vec2 dy) {
  vec2 sz = vec2(textureSize(tex, 0));
  float lx = length(dx * sz), ly = length(dy * sz);
  float lm = max(lx, ly);
  if (lm > 48.0) return textureLod(tex, uv, 0.0);
  if (lm < 0.75) return bicubicLod(tex, uv);
  int nx = int(clamp(ceil(lx - 0.25), 1.0, 4.0));
  int ny = int(clamp(ceil(ly - 0.25), 1.0, 4.0));
  if (nx * ny == 1) return textureLod(tex, uv, 0.0);
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 4; j++) {
    if (j >= ny) break;
    for (int i = 0; i < 4; i++) {
      if (i >= nx) break;
      vec2 o = (vec2(float(i), float(j)) + 0.5) / vec2(float(nx), float(ny)) - 0.5;
      acc += textureLod(tex, uv + dx * o.x + dy * o.y, 0.0);
    }
  }
  return acc / float(nx * ny);
}

// Antialiased coverage of the [0,1]^2 image rectangle at uv (1 inside, 0 outside).
float uvCoverage(vec2 uv, vec2 dx, vec2 dy) {
  vec2 w = max(abs(dx) + abs(dy), vec2(1e-7));
  vec2 d = min(uv, 1.0 - uv) / w;
  return saturate(min(d.x, d.y) + 0.5);
}

// Straight-alpha "over".
vec4 overStraight(vec4 top, vec4 bottom) {
  float a = top.a + bottom.a * (1.0 - top.a);
  vec3 c = (top.rgb * top.a + bottom.rgb * bottom.a * (1.0 - top.a)) / max(a, 1e-6);
  return vec4(c, a);
}

// 3D gradient noise whose z axis repeats every \`period\` lattice units (period <= 0: no repeat).
// Used for animations that loop seamlessly over a number of seconds.
vec3 gradDirP(vec3 i, float period) {
  if (period > 0.5) i.z = mod(i.z, period);
  return gradDir3(i);
}
float loopNoise(vec3 p, float period) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(gradDirP(i, period), f);
  float n100 = dot(gradDirP(i + vec3(1, 0, 0), period), f - vec3(1, 0, 0));
  float n010 = dot(gradDirP(i + vec3(0, 1, 0), period), f - vec3(0, 1, 0));
  float n110 = dot(gradDirP(i + vec3(1, 1, 0), period), f - vec3(1, 1, 0));
  float n001 = dot(gradDirP(i + vec3(0, 0, 1), period), f - vec3(0, 0, 1));
  float n101 = dot(gradDirP(i + vec3(1, 0, 1), period), f - vec3(1, 0, 1));
  float n011 = dot(gradDirP(i + vec3(0, 1, 1), period), f - vec3(0, 1, 1));
  float n111 = dot(gradDirP(i + vec3(1, 1, 1), period), f - vec3(1, 1, 1));
  return 1.2 * mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
`;function Bt(e,t,n){if(t<=0)return[0,0];if(n<=0)return[e*t,0];let r=Math.max(1,Math.round(t*n));return[e/n%1*r,r]}var Vt={id:`cubify`,name:`Cubify`,category:`Distort`,keywords:`abstract art blocky cubify distortion lowfi pixel pixelation visuals`,animated:!0,params:[g(`size`,`cube size`,0,8,1.1),g(`stretch`,`cube stretch`,-1,1,0),g(`depth`,`depth distortion`,0,5,1.8),y(`hardEdges`,`hard edges`,!1),v(`rotation`,`rotation angle`,0,90,0),S(`offset`,`position offset`,[0,0]),S(`speed`,`animation speed`,[.1,0],{min:[-5,-5],max:[5,5]}),g(`dispersion`,`dispersion`,0,1,0,.001)],uniforms:(e,t)=>{let n=e.offset??[0,0],r=e.speed??[0,0];return{u_gridOffset:[n[0]+r[0]*t.time,n[1]+r[1]*t.time]}},shaders:{main:`
${R}
uniform vec2 u_gridOffset;

// Displacement in cells for grid coordinate g (per axis).
vec2 cellWarp(vec2 g, float c) {
  // Hard edges: every cell zooms out around its own center, leaving crisp seams between cubes.
  if (u_hardEdges) return (fract(g) - 0.5) * c;
  return -c * sin(TAU * g) / TAU;
}

void main() {
  vec2 p = uvToUnit(v_uv);
  vec2 flipY = vec2(1.0, -1.0);
  vec2 corner = unitScale() * vec2(-1.0, 1.0); // top-left corner
  vec2 cell = max(u_size, 0.01) * 0.3 * vec2(exp2(u_stretch), exp2(-u_stretch));
  mat2 R = rot2(radians(u_rotation));
  // Grid space in cells, y running down from the top-left corner like image rows.
  vec2 g = (transpose(R) * (p - corner) + u_gridOffset) * flipY / cell;
  float c = 0.56 * u_depth;
  vec2 d = R * (cellWarp(g, c) * cell * flipY);
  vec4 col = textureLod(u_input, mirrorUv(unitToUv(p + d)), 0.0);
  if (u_dispersion > 0.0) {
    vec2 dr = R * (cellWarp(g, c * (1.0 - 0.35 * u_dispersion)) * cell * flipY);
    vec2 db = R * (cellWarp(g, c * (1.0 + 0.35 * u_dispersion)) * cell * flipY);
    col.r = textureLod(u_input, mirrorUv(unitToUv(p + dr)), 0.0).r;
    col.b = textureLod(u_input, mirrorUv(unitToUv(p + db)), 0.0).b;
  }
  fragColor = col;
}`}},Ht={id:`elastic-grid`,name:`Elastic grid`,category:`Distort`,keywords:`distortion elastic grid organic pull push warp`,animated:!0,params:[_(`gridX`,`grid X divisions`,1,64,8),_(`gridY`,`grid Y divisions`,1,64,8),S(`dot`,`dot position`,[0,0]),g(`stretch`,`stretch amount`,-1,1,-.7),g(`radius`,`effect radius`,.01,1,.5),g(`noiseSize`,`noise size`,.1,32,4),g(`noiseSpeed`,`noise speed`,.2,5,.5),g(`noiseBlend`,`noise blend`,0,1,.5),g(`noiseLoop`,`noise loop (sec)`,0,20,5)],uniforms:(e,t)=>{let[n,r]=Bt(t.time,O(e,`noiseSpeed`),O(e,`noiseLoop`));return{u_noiseZ:n,u_noisePeriod:r}},shaders:{main:`
${R}
uniform float u_noiseZ;
uniform float u_noisePeriod;

// Source position (unit space) of grid vertex v (in cells).
vec2 vertexSource(vec2 v, vec2 grid, vec2 dotP) {
  vec2 p = uvToUnit(v / grid);
  vec2 d = p - dotP;
  float r = length(d) / max(u_radius * 2.0, 1e-3);
  float w = exp(-2.0 * r * r);
  vec2 s = dotP + d * exp2(1.2 * u_stretch * w);
  vec2 q = p * u_noiseSize * 0.5;
  vec2 n = vec2(loopNoise(vec3(q, u_noiseZ), u_noisePeriod), loopNoise(vec3(q + vec2(31.7, -17.3), u_noiseZ + 0.5 * u_noisePeriod), u_noisePeriod));
  return s + n * u_noiseBlend * 0.25;
}

void main() {
  vec2 grid = max(floor(vec2(u_gridX, u_gridY) + 0.5), vec2(1.0));
  vec2 dotP = uvToUnit(pointToUv(u_dot));
  vec2 c = v_uv * grid;
  vec2 i = min(floor(c), grid - 1.0);
  vec2 f = c - i;
  vec2 s00 = vertexSource(i, grid, dotP);
  vec2 s10 = vertexSource(i + vec2(1.0, 0.0), grid, dotP);
  vec2 s01 = vertexSource(i + vec2(0.0, 1.0), grid, dotP);
  vec2 s11 = vertexSource(i + vec2(1.0, 1.0), grid, dotP);
  vec2 s = mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  vec2 uv = unitToUv(s);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  fragColor = sampleWarp(u_input, mirrorUv(uv), dx, dy);
}`}},Ut={id:`glitch`,name:`Glitch`,category:`Distort`,keywords:`aberration broken chromatic digital distortion glitch retro signal vhs`,params:[g(`glitchScale`,`glitch scale`,0,5,.38),g(`offsetScale`,`offset scale`,0,5,3.44),v(`angle`,`angle`,0,180,34),g(`redStrength`,`red shift strength`,0,1,.29),g(`greenStrength`,`green shift strength`,0,1,.29),g(`blueStrength`,`blue shift strength`,0,1,.25),g(`redThreshold`,`red threshold`,0,1,.76),g(`greenThreshold`,`green threshold`,0,1,.9),g(`blueThreshold`,`bleu threshold`,0,1,.66),g(`seed`,`random seed`,0,1,.365,.001)],shaders:{main:`
${R}
void main() {
  vec2 px = v_uv * u_resolution / u_pxScale; // reference pixels
  float ang = radians(u_angle);
  vec2 dir = vec2(cos(ang), -sin(ang));
  vec2 perp = vec2(-dir.y, dir.x);
  // Thin lines across the streak direction; along each line the glitch value drifts smoothly
  // (value noise), giving dashes rather than isolated speckles.
  float w = max(u_glitchScale * 2.6, 0.5);
  float s = floor(u_seed * 1000.0 + 0.5);
  float row = floor(dot(px, perp) / w);
  float a = dot(px, dir) / (w * 8.0) + hash12(vec2(row, s * 7.0 + 3.0)) * 64.0;
  vec2 cell = vec2(floor(a), row + s * 131.0);
  float f = smoothstep(0.0, 1.0, fract(a));
  vec2 h = mix(hash22(cell), hash22(cell + vec2(1.0, 0.0)), f);
  float reach = u_offsetScale * 0.15 * shortSide() / u_pxScale * h.y * h.y;
  vec3 thr = vec3(u_redThreshold, u_greenThreshold, u_blueThreshold);
  vec3 k = (1.0 - smoothstep(thr - 0.02, thr + 0.02, vec3(h.x))) * vec3(u_redStrength, u_greenStrength, u_blueStrength) * reach;
  // Channels mostly travel together; threshold differences leave softer colored fringes.
  k = mix(vec3((k.r + k.g + k.b) / 3.0), k, 0.45);
  vec2 toUv = u_pxScale / u_resolution;
  vec4 col = texture(u_input, v_uv + dir * k.g * toUv);
  col.r = texture(u_input, v_uv + dir * k.r * toUv).r;
  col.b = texture(u_input, v_uv + dir * k.b * toUv).b;
  fragColor = col;
}`}},Wt=8,Gt=[`Lightness`,`Saturation`,`Edges`],Kt={id:`grid-split`,name:`Grid split`,category:`Distort`,keywords:`grid split tiles sections table irregular adaptive merge deconstruction cutout mosaic uv shift stretch rotate reactive threshold marker`,animated:!0,params:[_(`density`,`Grid density`,1,64,8),g(`gridAspect`,`Grid aspect`,-1,1,0),_(`seed`,`Seed`,0,1e3,1),S(`irrStrength`,`Strength`,[0,0],{min:[0,0],max:[1,1],group:`Irregularity`}),x(`irrSource`,`irregularity source`,Gt,0,`slider`,{group:`Irregularity`}),y(`irrInvert`,`Invert`,!1,{group:`Irregularity`}),g(`irrLevel`,`Activation level`,0,1,.3,.01,{group:`Irregularity`}),g(`irrSoftness`,`Softness`,0,1,.5,.01,{group:`Irregularity`}),g(`irrNoise`,`Noise`,0,1,1,.01,{group:`Irregularity`}),g(`irrNoiseSize`,`Noise size`,.02,2,.25,.01,{group:`Irregularity`}),g(`irrNoiseSpeed`,`Noise speed`,0,4,.5,.01,{group:`Irregularity`}),g(`mergeCutoff`,`Merge cutoff`,0,1,0),x(`mergeSource`,`merge source`,Gt,0,`slider`),y(`mergeInvert`,`Invert`,!1),_(`mergeDepth`,`Merge depth`,0,8,5),S(`uvShift`,`UV shift`,[.47,0],{min:[-2,-2],max:[2,2],group:`Tile transforms`}),S(`uvStretch`,`UV stretch`,[1.49,-.76],{min:[-3,-3],max:[3,3],group:`Tile transforms`}),v(`tileRotation`,`Tile rotation`,-360,360,0,{group:`Tile transforms`}),g(`tileVariation`,`Tile variation`,0,1,1,.01,{group:`Tile transforms`}),x(`tileSource`,`tile transform source`,Gt,0,`slider`,{group:`Tile transforms`}),g(`tileNoise`,`Noise`,0,1,1,.01,{group:`Tile transforms`}),g(`tileNoiseSize`,`Noise size`,.02,2,.25,.01,{group:`Tile transforms`}),g(`tileNoiseSpeed`,`Noise speed`,0,4,.5,.01,{group:`Tile transforms`}),g(`strokes`,`Grid strokes`,0,20,1.5,.1,{group:`Grid guides`}),x(`strokeMode`,`stroke mode`,[`Lattice`,`Frames`],0,`slider`,{group:`Grid guides`}),g(`tileGap`,`Tile gap`,0,40,6,.5,{group:`Grid guides`}),b(`strokeColor`,`Grid stroke color`,`#0f0f12`,{group:`Grid guides`}),g(`marker`,`Tile center marker`,0,20,5.1,.1,{group:`Grid guides`}),x(`markerShape`,`marker shape`,[`Dot`,`Ring`,`Plus`,`Cross`,`Square`,`Diamond`],2,`slider`,{group:`Grid guides`}),g(`markerStroke`,`Marker stroke`,.5,6,1.5,.1,{group:`Grid guides`}),b(`markerColor`,`Center marker color`,`#75ff38`,{group:`Grid guides`}),y(`guidesHidden`,`Guides on hidden tiles`,!0,{group:`Grid guides`}),y(`guidesRevealed`,`Guides on revealed tiles`,!1,{group:`Grid guides`}),g(`hide`,`Hide tiles`,0,1,0,.01,{group:`Hide tiles`}),x(`hideSource`,`hide source`,[...Gt,`Tile size`],0,`slider`,{group:`Hide tiles`}),y(`hideInvert`,`Invert`,!1,{group:`Hide tiles`}),g(`hideNoise`,`Noise`,0,1,1,.01,{group:`Hide tiles`}),g(`hideNoiseSize`,`Noise size`,.02,2,.25,.01,{group:`Hide tiles`}),g(`hideNoiseSpeed`,`Noise speed`,0,4,.5,.01,{group:`Hide tiles`}),b(`bgColor`,`Background color`,`#09090b`,{group:`Hide tiles`}),g(`bgCutoff`,`Background cutoff`,0,1,0,.01,{group:`Background`}),x(`bgSource`,`background source`,[`Color`,...Gt],0,`slider`,{group:`Background`}),y(`bgInvert`,`Invert`,!1,{group:`Background`}),x(`bgBlend`,`background blend`,ne,0,`slider`,{group:`Background`}),g(`bgNoise`,`Noise`,0,1,0,.01,{group:`Background`}),g(`bgNoiseSize`,`Noise size`,.02,2,.25,.01,{group:`Background`}),g(`bgNoiseSpeed`,`Noise speed`,0,4,.5,.01,{group:`Background`}),b(`bgKey`,`Background key color`,`#ffffff`,{group:`Background`})],shaders:{metrics:`
uniform vec2 u_cells;
uniform vec2 u_srcRes;
void main() {
  vec2 cell = floor(vec2(v_uv.x, 1.0 - v_uv.y) * u_cells);
  vec2 texel = 1.0 / u_srcRes;
  vec2 e = texel * max(1.5 * u_pxScale, 1.0);
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 8; j++) {
    for (int i = 0; i < 8; i++) {
      vec2 uv = (cell + (vec2(float(i), float(j)) + 0.5) / 8.0) / u_cells;
      uv.y = 1.0 - uv.y;
      vec3 c = saturate(texture(u_input, uv).rgb);
      float l0 = luma(saturate(texture(u_input, uv + vec2(e.x, 0.0)).rgb)) - luma(saturate(texture(u_input, uv - vec2(e.x, 0.0)).rgb));
      float l1 = luma(saturate(texture(u_input, uv + vec2(0.0, e.y)).rgb)) - luma(saturate(texture(u_input, uv - vec2(0.0, e.y)).rgb));
      float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
      acc += vec3(luma(c), mx > 1e-4 ? (mx - mn) / mx : 0.0, saturate(length(vec2(l0, l1)) * 10.0));
    }
  }
  acc /= 64.0;
  float m = u_mergeSource == 0 ? acc.r : (u_mergeSource == 1 ? acc.g : acc.b);
  fragColor = vec4(acc, u_mergeInvert ? 1.0 - m : m);
}`,reduce:`
uniform sampler2D u_prev;
void main() {
  ivec2 sz = textureSize(u_prev, 0);
  ivec2 p = ivec2(gl_FragCoord.xy) * 2;
  vec3 acc = vec3(0.0);
  float mx = 0.0, n = 0.0;
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      ivec2 q = p + ivec2(i, j);
      if (q.x < sz.x && q.y < sz.y) {
        vec4 t = texelFetch(u_prev, q, 0);
        acc += t.rgb;
        mx = max(mx, t.a);
        n += 1.0;
      }
    }
  }
  fragColor = vec4(acc / max(n, 1.0), mx);
}`,main:`
${R}
uniform vec2 u_cells;      // grid size in cells (x, y)
uniform int u_levels;      // quadtree levels above the cells
uniform sampler2D u_lv0;
uniform sampler2D u_lv1;
uniform sampler2D u_lv2;
uniform sampler2D u_lv3;
uniform sampler2D u_lv4;
uniform sampler2D u_lv5;
uniform sampler2D u_lv6;
uniform sampler2D u_lv7;
uniform sampler2D u_lv8;

// Block averages at quadtree level L (texel rows count from the top, like the quadtree).
vec4 blockMetric(int L, vec2 b) {
  ivec2 sz;
  vec4 m;
  #define FETCH(S) sz = textureSize(S, 0); m = texelFetch(S, clamp(ivec2(b), ivec2(0), sz - 1), 0)
  if (L <= 0) { FETCH(u_lv0); }
  else if (L == 1) { FETCH(u_lv1); }
  else if (L == 2) { FETCH(u_lv2); }
  else if (L == 3) { FETCH(u_lv3); }
  else if (L == 4) { FETCH(u_lv4); }
  else if (L == 5) { FETCH(u_lv5); }
  else if (L == 6) { FETCH(u_lv6); }
  else if (L == 7) { FETCH(u_lv7); }
  else { FETCH(u_lv8); }
  #undef FETCH
  return m;
}

float pick(vec4 m, int src) { return src == 0 ? m.r : (src == 1 ? m.g : m.b); }

// Smooth animated noise in [0, 1] at a unit-space position.
float noise01(vec2 p, float size, float speed, float salt) {
  float n = gradientNoise3(vec3(p / max(size, 0.01) + salt * 17.31, u_time * speed + salt * 3.7));
  return saturate(0.5 + 1.4 * n);
}

// Unit-space position of a point given in cell units (x from the left, y from the top).
vec2 cellToUnit(vec2 c) { return uvToUnit(vec2(c.x / u_cells.x, 1.0 - c.y / u_cells.y)); }

float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

// Signed distance (reference px) of the tile center marker.
float markerSdf(vec2 p, float r, float t) {
  int shape = u_markerShape;
  if (shape == 0) return length(p) - r;
  if (shape == 1) return abs(length(p) - r) - 0.5 * t;
  if (shape == 3) p = rot2(0.25 * PI) * p;
  if (shape == 2 || shape == 3) return min(sdBox(p, vec2(r, 0.5 * t)), sdBox(p, vec2(0.5 * t, r)));
  if (shape == 4) return abs(sdBox(p, vec2(r))) - 0.5 * t;
  return abs((abs(p.x) + abs(p.y) - r) * 0.70710678) - 0.5 * t;
}

void main() {
  vec2 cellPx = u_resolution / u_cells;
  vec2 pc = vec2(v_uv.x, 1.0 - v_uv.y) * u_cells; // pixel in cell units, y down
  float seed = u_seed;
  vec2 strength = vec2(u_irrStrength.x, u_irrStrength.y);
  // Quadtree roots of 2^levels cells tile the grid (levels is capped, so there may be several).
  float top = exp2(float(u_levels));
  vec2 b = floor(pc / top);
  vec2 lo = b * top, hi = lo + top;
  int leaf = 0;
  for (int L = ${Wt}; L >= 1; L--) {
    if (L > u_levels) continue;
    vec4 m = blockMetric(L, b);
    if (L <= int(u_mergeDepth + 0.5) && m.a < u_mergeCutoff) { leaf = L; break; }
    vec2 split = 0.5 * (lo + hi);
    if (strength.x + strength.y > 0.0) {
      float a = pick(m, u_irrSource);
      a = mix(a, noise01(cellToUnit(split), u_irrNoiseSize, u_irrNoiseSpeed, 1.0 + seed), u_irrNoise);
      if (u_irrInvert) a = 1.0 - a;
      float soft = 0.5 * u_irrSoftness + 1e-3;
      float act = smoothstep(u_irrLevel - soft, u_irrLevel + soft, a);
      vec2 rnd = hash22(b * vec2(1.0, 7.0) + vec2(float(L) * 131.0, seed * 17.0)) - 0.5;
      // Regular split positions (in cells) that fall on or outside the grid stay fixed.
      vec2 reg = (2.0 * b + 1.0) * exp2(float(L - 1));
      vec2 inside = step(reg, u_cells - 0.5);
      split += (hi - lo) * rnd * 0.8 * strength * act * inside;
    }
    vec2 side = step(split, pc);
    lo = mix(lo, split, side);
    hi = mix(split, hi, side);
    b = b * 2.0 + side;
  }
  hi = min(hi, u_cells);
  vec2 tileC = 0.5 * (lo + hi);
  vec2 tileSize = hi - lo;
  vec4 tm = blockMetric(leaf, b);
  vec2 cu = cellToUnit(tileC);

  // Hide tiles.
  float hv = u_hideSource == 3 ? saturate(log2(max(tileSize.x * tileSize.y, 1.0)) / 8.0) : pick(tm, u_hideSource);
  hv = mix(hv, noise01(cu, u_hideNoiseSize, u_hideNoiseSpeed, 5.0 + seed), u_hideNoise);
  if (u_hideInvert) hv = 1.0 - hv;
  bool hidden = hv < u_hide;

  // Tile transform: weight in [-1, 1] from the tile metric / noise.
  float r = mix(pick(tm, u_tileSource), noise01(cu, u_tileNoiseSize, u_tileNoiseSpeed, 9.0 + seed), u_tileNoise);
  float w = mix(1.0, 2.0 * r - 1.0, u_tileVariation);
  // In output pixels (y up) so rotation stays isotropic; shift/stretch are relative to the tile.
  vec2 flipY = vec2(1.0, -1.0);
  vec2 tilePx = tileSize * cellPx;
  vec2 q = (pc - tileC) * cellPx * flipY;
  q *= exp2(-u_uvStretch * w);
  q = rot2(-radians(u_tileRotation) * w) * q;
  q += u_uvShift * w * tilePx;
  vec2 src = tileC + q * flipY / cellPx;
  vec2 uv = vec2(src.x / u_cells.x, 1.0 - src.y / u_cells.y);
  vec4 col = textureLod(u_input, mirrorUv(uv), 0.0);

  // Background keying.
  if (u_bgCutoff > 0.0) {
    vec3 c = saturate(col.rgb);
    float k;
    if (u_bgSource == 0) k = 1.0 - length(c - u_bgKey) / 1.7320508;
    else if (u_bgSource == 1) k = luma(c);
    else if (u_bgSource == 2) { float mx = max(c.r, max(c.g, c.b)); k = mx > 1e-4 ? (mx - min(c.r, min(c.g, c.b))) / mx : 0.0; }
    else {
      vec2 e = vec2(max(u_pxScale, 1.0)) / u_resolution;
      float gx = luma(textureLod(u_input, mirrorUv(uv + vec2(e.x, 0.0)), 0.0).rgb) - luma(textureLod(u_input, mirrorUv(uv - vec2(e.x, 0.0)), 0.0).rgb);
      float gy = luma(textureLod(u_input, mirrorUv(uv + vec2(0.0, e.y)), 0.0).rgb) - luma(textureLod(u_input, mirrorUv(uv - vec2(0.0, e.y)), 0.0).rgb);
      k = saturate(length(vec2(gx, gy)) * 10.0);
    }
    k = mix(k, noise01(uvToUnit(v_uv), u_bgNoiseSize, u_bgNoiseSpeed, 13.0 + seed), u_bgNoise);
    if (u_bgInvert) k = 1.0 - k;
    float keyed = smoothstep(1.0 - u_bgCutoff - 0.01, 1.0 - u_bgCutoff + 0.01, k);
    col.rgb = mix(col.rgb, blendMode(u_bgBlend, c, u_bgColor), keyed);
  }

  // Distances (output px) from the pixel to the tile edges.
  vec2 dLo = (pc - lo) * cellPx, dHi = (hi - pc) * cellPx;
  bool frames = u_strokeMode == 1;
  float gap = frames ? 0.5 * u_tileGap * u_pxScale : 0.0;
  float inner = min(min(dLo.x, dHi.x), min(dLo.y, dHi.y)) - gap; // inside the (inset) tile
  if (hidden) col = vec4(u_bgColor, 1.0);
  if (frames && inner < 0.0) col = vec4(u_bgColor, 1.0);
  else if (frames && gap > 0.0) col.rgb = mix(u_bgColor, col.rgb, saturate(inner + 0.5));

  if (hidden ? u_guidesRevealed : u_guidesHidden) {
    float sw = u_strokes * u_pxScale;
    if (sw > 0.0) {
      float line;
      if (frames) {
        line = (1.0 - smoothstep(sw - 0.5, sw + 0.5, inner)) * saturate(inner + 0.5);
      } else {
        // Lattice: half the stroke on each side of internal boundaries only.
        vec2 bl = mix(dLo, vec2(1e6), step(lo, vec2(1e-4)));
        vec2 bh = mix(dHi, vec2(1e6), step(u_cells - 1e-4, hi));
        float d = min(min(bl.x, bh.x), min(bl.y, bh.y));
        line = 1.0 - smoothstep(0.5 * sw - 0.5, 0.5 * sw + 0.5, d);
      }
      col.rgb = mix(col.rgb, u_strokeColor, line);
    }
    if (u_marker > 0.0) {
      vec2 mp = (pc - tileC) * cellPx * vec2(1.0, -1.0) / u_pxScale;
      float sd = markerSdf(mp, u_marker, u_markerStroke) * u_pxScale;
      col.rgb = mix(col.rgb, u_markerColor, 1.0 - smoothstep(-0.5, 0.5, sd));
    }
  }
  fragColor = col;
}`},render(e){let t=e.params,[n,r]=qt(t,e.width,e.height),i=Math.min(Wt,Math.max(0,Math.ceil(Math.log2(Math.max(n,r))))),a=[];a.push(e.pass(`metrics`,{width:n,height:r,uniforms:{u_cells:[n,r],u_srcRes:[e.width,e.height]}}));for(let t=1;t<=i;t++){let n=a[t-1];a.push(e.pass(`reduce`,{width:Math.ceil(n.width/2),height:Math.ceil(n.height/2),inputs:{u_prev:n}}))}let o={};for(let e=0;e<=Wt;e++)o[`u_lv`+e]=a[Math.min(e,a.length-1)];let s=e.pass(`main`,{inputs:o,uniforms:{u_cells:[n,r],u_levels:i}});for(let t of a)e.release(t);return s}};function qt(e,t,n){let r=Math.max(1,Math.round(O(e,`density`))),i=O(e,`gridAspect`),a=Math.min(t,n)/r;return[Math.max(1,Math.round(t/(a*2**i))),Math.max(1,Math.round(n/(a*2**-i)))]}var Jt={id:`perspective`,name:`Perspective`,category:`Distort`,keywords:`distortion geometric perspective photo transform warp`,params:[g(`zoom`,`camera zoom`,-5,5,.17),g(`fov`,`field of view`,10,170,60,.01,{unit:`°`}),S(`camera`,`camera position`,[0,0],{min:[-2,-2],max:[2,2]}),g(`rotateX`,`rotate X`,-90,90,-25,.01,{unit:`°`}),g(`rotateY`,`rotate Y`,-90,90,0,.01,{unit:`°`}),g(`rotateZ`,`rotate Z`,-90,90,0,.01,{unit:`°`}),b(`bgColor`,`background color`,`#000000`),g(`bgOpacity`,`background opacity`,0,1,0),y(`depthAlpha`,`depth-based alpha`,!1),g(`depthKey`,`depth key value`,-3,3,-.79,.01,{visibleIf:e=>!!e.depthAlpha}),g(`depthRange`,`depth range`,0,3,1.89,.01,{visibleIf:e=>!!e.depthAlpha}),y(`depthInvert`,`invert depth`,!0,{visibleIf:e=>!!e.depthAlpha})],uniforms:e=>{let t=t=>Number(e[t])*Math.PI/180,[n,r,i,a,o,s]=[Math.cos(t(`rotateX`)),Math.sin(t(`rotateX`)),Math.cos(t(`rotateY`)),Math.sin(t(`rotateY`)),Math.cos(t(`rotateZ`)),Math.sin(t(`rotateZ`))];return{u_basis:[i*o,n*s+r*a*o,r*s-n*a*o,-i*s,n*o-r*a*s,r*o+n*a*s,a,-r*i,n*i]}},shaders:{main:`
${R}
uniform mat3 u_basis;
void main() {
  vec2 s = uvToUnit(v_uv);
  float f = 1.0 / tan(radians(clamp(u_fov, 1.0, 179.0)) * 0.5);
  vec3 ro = vec3(u_camera, exp(-u_zoom));
  vec3 rd = normalize(vec3(s, -f));
  vec3 n = u_basis[2];
  float den = dot(rd, n);
  float t = abs(den) > 1e-6 ? -dot(ro, n) / den : -1.0;
  vec3 hit = ro + rd * t;
  vec2 local = vec2(dot(hit, u_basis[0]), dot(hit, u_basis[1]));
  vec2 uv = unitToUv(local);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  // Sample unconditionally (uniform control flow for the bicubic path), then mask.
  vec4 col = sampleWarp(u_input, uv, dx, dy);
  col.a *= uvCoverage(uv, dx, dy) * step(0.0, t);
  if (u_depthAlpha) {
    float a = saturate((-hit.z - u_depthKey) / max(u_depthRange, 1e-4));
    col.a *= u_depthInvert ? 1.0 - a : a;
  }
  fragColor = overStraight(col, vec4(u_bgColor, u_bgOpacity));
}`}},Yt={id:`pinch`,name:`Pinch`,category:`Distort`,keywords:`pinch`,params:[g(`strength`,`strength`,-1,1,.4),g(`radius`,`radius`,.01,2,1.5),S(`center`,`center`,[.1,0],{min:[-2,-2],max:[2,2]})],shaders:{main:`
${R}
void main() {
  vec2 c = uvToUnit(pointToUv(u_center));
  vec2 d = uvToUnit(v_uv) - c;
  float t = min(length(d) / max(u_radius, 1e-4), 1.0);
  float k = 1.0 - u_strength * (1.0 - t) * (1.0 - t);
  vec2 uv = unitToUv(c + d * k);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  fragColor = sampleWarp(u_input, uv, dx, dy);
}`}},Xt={id:`polar-to-rectangular`,name:`Polar to rectangular`,category:`Distort`,keywords:`360 circular distortion flat panorama polar radial rectangular transform unwrap`,params:[S(`center`,`center`,[0,0],{min:[-2,-2],max:[2,2]}),v(`angle`,`angle`,0,360,0),g(`radius`,`radius`,0,3,1),g(`distortion`,`distortion`,-1,1,0)],shaders:{main:`
${R}
void main() {
  vec2 c = uvToUnit(pointToUv(u_center));
  float phi = radians(90.0 - u_angle) - TAU * v_uv.x;
  float r = u_radius * pow(max(v_uv.y, 0.0), exp(-u_distortion));
  vec2 uv = unitToUv(c + r * vec2(cos(phi), sin(phi)));
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  fragColor = sampleWarp(u_input, uv, dx, dy);
}`}},Zt={id:`rectangular-to-polar`,name:`Rectangular to polar`,category:`Distort`,keywords:`circular distortion polar radial rectangular swirl transform tunnel warp`,params:[S(`center`,`center`,[0,0],{min:[-2,-2],max:[2,2]}),v(`angle`,`angle`,0,360,0),g(`radius`,`radius`,0,3,1),g(`distortion`,`distortion`,-1,1,.2),g(`overlap`,`overlap`,0,.5,0)],shaders:{main:`
${R}
void main() {
  vec2 d = uvToUnit(v_uv) - uvToUnit(pointToUv(u_center));
  float r = length(d);
  float a = fract((radians(90.0 - u_angle) - atan(d.y, d.x)) / TAU);
  float v = pow(r / max(u_radius, 1e-4), exp(u_distortion));
  float o = clamp(u_overlap, 0.0, 0.5);
  float x = a * (1.0 - o);
  vec2 uv = vec2(x, min(v, 1.0));
  // Analytic angular derivatives (dFdx of the wrapped angle would explode at the seam).
  vec2 ddx = dFdx(d), ddy = dFdy(d);
  float k = -(1.0 - o) / (TAU * max(r * r, 1e-8));
  vec2 dx = vec2((d.x * ddx.y - d.y * ddx.x) * k, dFdx(v));
  vec2 dy = vec2((d.x * ddy.y - d.y * ddy.x) * k, dFdy(v));
  vec4 col = sampleWarp(u_input, uv, dx, dy);
  if (o > 0.0) {
    // Fade the start of the source into its end (x + 1 - o) so the 12 o'clock seam disappears.
    vec4 wrap = sampleWarp(u_input, vec2(x + 1.0 - o, uv.y), dx, dy);
    col = mix(wrap, col, smoothstep(0.0, 1.0, min(x / o, 1.0)));
  }
  fragColor = col;
}`}},Qt={id:`reeded-glass`,name:`Reeded glass`,category:`Distort`,keywords:`analog distortion fluted glass reeded refraction ribbed`,animated:!0,params:[g(`amount`,`amount`,0,10,1),g(`dispersion`,`dispersion`,0,.5,.3,.001),g(`reflection`,`reflection`,0,1,0),g(`reflectionScale`,`reflection scale`,.1,2,1,.05),_(`patternType`,`pattern type`,0,3,0),_(`repeats`,`pattern repeats`,1,64,7),v(`patternAngle`,`pattern angle`,0,360,0),g(`contrast`,`pattern contrast`,.1,5,4,.05),g(`shiftSpeed`,`shift speed`,0,2,1,.1),g(`shiftLoop`,`shift loop (sec)`,0,10,5,.5),g(`imperfections`,`imperfections`,0,1,.3),g(`imperfectionsScale`,`imperfections scale`,.2,25,10,.1)],uniforms:(e,t)=>({u_shift:Bt(t.time,O(e,`shiftSpeed`),O(e,`shiftLoop`))[0]}),shaders:{main:`
${R}
uniform float u_shift;

// Signed power keeping the sign of x.
float spow(float x, float e) { return sign(x) * pow(abs(x), e); }

// Glass thickness profile T(u) (one period per unit u, roughly in [-1, 1]); returns (T, dT/du).
vec2 profile(float u) {
  float c = max(u_contrast, 0.1);
  int type = int(u_patternType + 0.5);
  if (type == 1) {
    // Round flutes: bumps (1 - x^2)^(c/4), x in [-1, 1] across each flute.
    float x = fract(u) * 2.0 - 1.0;
    float e = 0.25 * c;
    float b = max(1.0 - x * x, 1e-4);
    return vec2(2.0 * pow(b, e) - 1.0, 2.0 * e * pow(b, e - 1.0) * (-2.0 * x) * 2.0);
  }
  if (type == 2) {
    // Prisms: V grooves with contrast-shaped flanks.
    float x = fract(u) * 2.0 - 1.0;
    float e = 0.25 * c + 0.25;
    float ax = max(abs(x), 1e-4);
    return vec2(1.0 - 2.0 * pow(ax, e), -2.0 * e * pow(ax, e - 1.0) * sign(x) * 2.0);
  }
  if (type == 3) {
    // Sawtooth steps: a ramp per reed, eased by the contrast.
    float x = fract(u);
    float e = 0.5 * c + 0.5;
    float xs = max(x, 1e-4);
    return vec2(4.0 * pow(xs, e) - 2.0, 4.0 * e * pow(xs, e - 1.0));
  }
  // Contrast-shaped wave: T = -sign(cos)|cos|^c (c = 1 is a plain sine profile).
  float a = TAU * u;
  float cs = cos(a), sn = sin(a);
  return vec2(-spow(cs, c), TAU * c * pow(max(abs(cs), 1e-5), c - 1.0) * sn);
}

void main() {
  vec2 p = uvToUnit(v_uv);
  float ang = radians(u_patternAngle);
  vec2 dir = vec2(cos(ang), sin(ang));
  float reps = max(u_repeats, 1.0);
  float period = 2.0 / reps; // unit space (short side = 2)
  // Imperfections: low-amplitude smooth wobble of the glass (static, in screen space).
  vec2 q = p * u_imperfectionsScale;
  vec2 wob = vec2(gradientNoise(q + 13.1), gradientNoise(q.yx - 7.7)) + 0.5 * vec2(gradientNoise(q * 2.7 + 3.3), gradientNoise(q.yx * 2.7 - 1.9));
  float u = dot(p, dir) / period + u_shift + u_imperfections * 0.025 * wob.x;
  vec2 prof = profile(u);
  prof.y = clamp(prof.y, -60.0, 60.0);
  float d = u_amount * 0.2 * period * prof.y / TAU;
  vec2 disp = dir * d + wob * u_imperfections * 0.002;
  vec2 uv = unitToUv(p + disp);
  vec4 col = textureLod(u_input, mirrorUv(uv), 0.0);
  if (u_dispersion > 0.0) {
    vec2 spread = dir * d * u_dispersion * 0.35;
    col.r = textureLod(u_input, mirrorUv(unitToUv(p + disp - spread)), 0.0).r;
    col.b = textureLod(u_input, mirrorUv(unitToUv(p + disp + spread)), 0.0).b;
  }
  if (u_reflection > 0.0) {
    // Surface normal of the reed (tilts across the pattern direction with the profile slope).
    float slope = prof.y * 0.08 * u_amount / max(u_reflectionScale, 0.1);
    vec3 n = normalize(vec3(-dir * slope, 1.0));
    vec3 l = normalize(vec3(-0.55, 0.65, 0.9));
    vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, h), 0.0), 18.0 / (u_reflectionScale * u_reflectionScale));
    float fres = pow(1.0 - n.z, 1.5);
    // Environment sheen: a mirrored glimpse of the image, offset along the normal.
    vec2 ruv = mirrorUv(unitToUv(-p * 0.6 + n.xy * 1.5 * u_reflectionScale));
    vec3 env = textureLod(u_input, ruv, 0.0).rgb;
    vec3 add = vec3(spec) * 0.9 + env * fres * 1.6;
    col.rgb = mix(col.rgb, 1.0 - (1.0 - col.rgb) * (1.0 - saturate(add)), u_reflection);
  }
  fragColor = col;
}`}},$t={id:`ripple`,name:`Ripple`,category:`Distort`,keywords:`distortion liquid motion ripple water wave`,animated:!0,params:[g(`amplitude`,`amplitude`,0,.2,.035,.001),g(`frequency`,`frequency`,0,200,50),v(`phase`,`phase`,0,360,0),S(`center`,`center`,[0,0],{min:[-2,-2],max:[2,2]}),g(`speed`,`animation speed`,-10,10,.8),g(`dispersion`,`dispersion`,0,1,0,.001)],shaders:{main:`
${R}
void main() {
  vec2 c = uvToUnit(pointToUv(u_center));
  vec2 d = uvToUnit(v_uv) - c;
  float r = length(d);
  vec2 dir = r > 1e-6 ? d / r : vec2(0.0);
  float w = u_amplitude * sin(u_frequency * r - radians(u_phase) - TAU * u_speed * u_time);
  vec2 uv = unitToUv(c + d + dir * w);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec4 col = sampleWarp(u_input, uv, dx, dy);
  if (u_dispersion > 0.0) {
    // Red refracts least, blue most.
    vec2 off = (unitToUv(c + d + dir * w * (1.0 + 0.6 * u_dispersion)) - uv);
    col.r = sampleWarp(u_input, uv - off, dx, dy).r;
    col.b = sampleWarp(u_input, uv + off, dx, dy).b;
  }
  fragColor = col;
}`}},en={id:`swirl`,name:`Swirl`,category:`Distort`,keywords:`swirl`,params:[g(`strength`,`strength`,-5,5,.66),g(`frequency`,`frequency`,1,100,41.4,.1),g(`amplitude`,`amplitude`,0,1.5,0),v(`phase`,`phase`,0,360,0),S(`center`,`center`,[0,0],{min:[-2,-2],max:[2,2]})],shaders:{main:`
${R}
void main() {
  vec2 c = uvToUnit(pointToUv(u_center));
  vec2 d = uvToUnit(v_uv) - c;
  float r = length(d);
  float a = u_strength * r + u_amplitude * sin(u_frequency * r + radians(u_phase));
  vec2 uv = unitToUv(c + rot2(a) * d);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  fragColor = sampleWarp(u_input, uv, dx, dy);
}`}},tn=[Ht,Kt,Qt,Vt,Ut,Jt,Yt,Xt,Zt,$t,{id:`transform`,name:`Transform`,category:`Distort`,keywords:`flip mirror rotate scale transform`,params:[S(`inputCenter`,`input center`,[0,0]),S(`outputCenter`,`output center`,[0,0]),g(`scale`,`scale amount`,-3,3,.39),v(`rotation`,`rotation`,0,360,0),_(`axes`,`symmetry axes`,0,16,5),v(`axisAngle`,`axis angle`,0,360,0),b(`bgColor`,`background color`,`#000000`),g(`bgOpacity`,`background opacity`,0,1,0)],shaders:{main:`
${R}
void main() {
  vec2 p = uvToUnit(v_uv) - uvToUnit(pointToUv(u_outputCenter));
  float n = floor(u_axes + 0.5);
  if (n > 0.5) {
    float seg = TAU / n;
    float base = radians(u_axisAngle) - 0.5 * PI;
    float a = mod(atan(p.y, p.x) - base, seg);
    a = a > 0.5 * seg ? seg - a : a;
    p = length(p) * vec2(cos(a + base), sin(a + base));
  }
  p = rot2(-radians(u_rotation)) * p * exp2(-u_scale);
  vec2 uv = unitToUv(p + uvToUnit(pointToUv(u_inputCenter)));
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec4 col = sampleWarp(u_input, uv, dx, dy);
  col.a *= uvCoverage(uv, dx, dy);
  fragColor = overStraight(col, vec4(u_bgColor, u_bgOpacity));
}`}},en];function nn(e){let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}var rn=e=>{let[t,n,r]=M(e);return`vec3(${t.toFixed(4)}, ${n.toFixed(4)}, ${r.toFixed(4)})`},an=`
uniform sampler2D u_src;
void main() {
  vec2 o = 1.0 / vec2(textureSize(u_src, 0));
  fragColor = 0.25 * (texture(u_src, v_uv + vec2(-o.x, -o.y)) + texture(u_src, v_uv + vec2(o.x, -o.y))
                    + texture(u_src, v_uv + vec2(-o.x, o.y)) + texture(u_src, v_uv + vec2(o.x, o.y)));
}`;function on(e,t,n,r){let i=t;for(;i.width>n*1.5&&i.height>r*1.5&&i.width>2&&i.height>2;){let n=e.pass(`down2`,{width:Math.ceil(i.width/2),height:Math.ceil(i.height/2),inputs:{u_src:i}});i!==t&&e.release(i),i=n}return i}var sn=[[`Black`,`#1b1b1d`],[`Black Simulated`,`#3a3a3f`],[`Risofederal Blue`,`#3d5588`],[`Medium Blue`,`#3255a4`],[`Blue`,`#0078bf`],[`Cornflower`,`#62a8e5`],[`Aqua`,`#5ec8e5`],[`Mint`,`#82d8d5`],[`Teal`,`#00838a`],[`Hunter Green`,`#407060`],[`Green`,`#00a95c`],[`Kelly Green`,`#67b346`],[`Moss`,`#68724d`],[`Yellow`,`#ffe800`],[`Sunflower`,`#ffb511`],[`Melon`,`#ffae3b`],[`Apricot`,`#f6a04d`],[`Orange`,`#ff6c2f`],[`Red`,`#ff665e`],[`Coral`,`#ff8e91`],[`Bright Red`,`#f15060`],[`Marine Red`,`#d2515e`],[`Burgundy`,`#914e72`],[`Violet`,`#9d7ad2`],[`Grape`,`#6c5d80`],[`Purple`,`#765ba7`],[`Brown`,`#925f52`],[`Light Grey`,`#88898a`],[`Flat Gold`,`#bb8b41`],[`Metallic Gold`,`#ac936e`],[`Fluorescent Pink`,`#ff48b0`],[`Fluorescent Orange`,`#ff7477`],[`Fluorescent Red`,`#ff4c65`],[`Fluorescent Yellow`,`#ffe916`],[`Fluorescent Green`,`#44d62c`]],cn=sn.map(e=>e[0]),ln=`
const vec3 RISO_INKS[${sn.length}] = vec3[](
  ${sn.map(e=>rn(e[1])).join(`,
  `)}
);
vec3 risoInk(int i) { return RISO_INKS[clamp(i, 0, ${sn.length-1})]; }
`,un=`
float kneeWeight(float br, float threshold, float knee) {
  float k = max(knee, 1e-4);
  float rq = clamp(br - threshold + k, 0.0, 2.0 * k);
  rq = rq * rq / (4.0 * k);
  return max(max(rq, br - threshold) / max(br, 1e-4), 0.0);
}
vec3 kneeThreshold(vec3 c, float threshold, float knee) {
  float br = max(max(c.r, c.g), c.b);
  float k = max(knee, 1e-4);
  float rq = clamp(br - threshold + k, 0.0, 2.0 * k);
  rq = rq * rq / (4.0 * k);
  float w = max(rq, br - threshold) / max(br, 1e-4);
  return c * max(w, 0.0);
}
`,z=[{base:`#9a9da3`,lit:`#f4f6fa`,shade:`#2a2c31`,spec:`#ffffff`,shininess:60,metal:.8},{base:`#8d929b`,lit:`#ffffff`,shade:`#121318`,spec:`#ffffff`,shininess:120,metal:1},{base:`#7e848c`,lit:`#e9eef8`,shade:`#23262d`,spec:`#ffffff`,shininess:70,metal:.85},{base:`#b8913c`,lit:`#fff1b8`,shade:`#3e2a08`,spec:`#fff6d0`,shininess:70,metal:.85},{base:`#c4917f`,lit:`#ffe4d8`,shade:`#4a2a22`,spec:`#fff0ea`,shininess:60,metal:.8},{base:`#b06a45`,lit:`#ffcfae`,shade:`#3a1a0c`,spec:`#ffe0cc`,shininess:60,metal:.8},{base:`#8f6a3c`,lit:`#e9c58e`,shade:`#2c1c0a`,spec:`#f5dcae`,shininess:40,metal:.7},{base:`#b39a52`,lit:`#fbeaa8`,shade:`#3a2f10`,spec:`#fff4c8`,shininess:60,metal:.8},{base:`#5d5f63`,lit:`#b9bcc2`,shade:`#141518`,spec:`#d8dce4`,shininess:30,metal:.5},{base:`#8a8a86`,lit:`#e2e0d8`,shade:`#2b2a28`,spec:`#f4f2ea`,shininess:50,metal:.7},{base:`#4c5056`,lit:`#a7adb6`,shade:`#0e0f12`,spec:`#e6ebf2`,shininess:80,metal:.9},{base:`#e3ddd3`,lit:`#ffffff`,shade:`#8f8678`,spec:`#ffffff`,shininess:40,metal:.25},{base:`#dcdcdc`,lit:`#ffffff`,shade:`#7c7c80`,spec:`#ffffff`,shininess:30,metal:0},{base:`#262628`,lit:`#5c5c62`,shade:`#050506`,spec:`#ffffff`,shininess:40,metal:0},{base:`#c0302a`,lit:`#ff8a7a`,shade:`#4a0806`,spec:`#ffffff`,shininess:40,metal:0},{base:`#2e5fbf`,lit:`#8fb6ff`,shade:`#0a1840`,spec:`#ffffff`,shininess:40,metal:0},{base:`#3a9a4a`,lit:`#9fe6a6`,shade:`#0b3012`,spec:`#ffffff`,shininess:40,metal:0},{base:`#e2c22a`,lit:`#fff3a0`,shade:`#5a4a04`,spec:`#ffffff`,shininess:40,metal:0},{base:`#e2722a`,lit:`#ffc08a`,shade:`#5a2404`,spec:`#ffffff`,shininess:40,metal:0},{base:`#7c46b8`,lit:`#c9a2ff`,shade:`#240b44`,spec:`#ffffff`,shininess:40,metal:0},{base:`#e07aa8`,lit:`#ffd0e4`,shade:`#5a1a36`,spec:`#ffffff`,shininess:40,metal:0},{base:`#b49a84`,lit:`#ead8c6`,shade:`#4a3a2c`,spec:`#f0e6dc`,shininess:6,metal:0},{base:`#b5653f`,lit:`#e9a682`,shade:`#4a2010`,spec:`#f0c8b0`,shininess:6,metal:0},{base:`#4f9a7a`,lit:`#a8e6c8`,shade:`#123a2a`,spec:`#e8fff4`,shininess:50,metal:.2},{base:`#e6e4df`,lit:`#ffffff`,shade:`#9a968e`,spec:`#ffffff`,shininess:25,metal:.1},{base:`#1c1b22`,lit:`#5b5868`,shade:`#030305`,spec:`#e8e4ff`,shininess:90,metal:.6},{base:`#bfe0ee`,lit:`#ffffff`,shade:`#5a8aa2`,spec:`#ffffff`,shininess:80,metal:.5},{base:`#6fb8c4`,lit:`#e0fbff`,shade:`#174a54`,spec:`#ffffff`,shininess:100,metal:.6},{base:`#3a3a3c`,lit:`#77777b`,shade:`#101011`,spec:`#9a9aa0`,shininess:8,metal:0},{base:`#9c9a96`,lit:`#d6d4d0`,shade:`#4a4946`,spec:`#d0cec8`,shininess:4,metal:0},{base:`#5c5e61`,lit:`#c4cad3`,shade:`#16171a`,spec:`#e2e8f0`,shininess:30,metal:.4},{base:`#d2b98c`,lit:`#f6e8c8`,shade:`#6e5a38`,spec:`#fff4dc`,shininess:6,metal:0},{base:`#9a6a40`,lit:`#dcae80`,shade:`#3a2210`,spec:`#f0d0b0`,shininess:12,metal:0},{base:`#a8a0c8`,lit:`#c8fff4`,shade:`#3a2060`,spec:`#ffffff`,shininess:60,metal:.9},{base:`#18b8c8`,lit:`#b8ffff`,shade:`#003a44`,spec:`#ffffff`,shininess:60,metal:.3},{base:`#c83cb0`,lit:`#ffb8f0`,shade:`#44083a`,spec:`#ffffff`,shininess:60,metal:.3}],dn=z.length,fn=`
const vec3 MAT_BASE[${z.length}] = vec3[](${z.map(e=>rn(e.base)).join(`, `)});
const vec3 MAT_LIT[${z.length}] = vec3[](${z.map(e=>rn(e.lit)).join(`, `)});
const vec3 MAT_SHADE[${z.length}] = vec3[](${z.map(e=>rn(e.shade)).join(`, `)});
const vec3 MAT_SPEC[${z.length}] = vec3[](${z.map(e=>rn(e.spec)).join(`, `)});
const vec2 MAT_PARAM[${z.length}] = vec2[](${z.map(e=>`vec2(${e.shininess.toFixed(1)}, ${e.metal.toFixed(2)})`).join(`, `)});
vec3 shadeMaterial(int id, vec3 n, vec3 l) {
  id = clamp(id, 0, ${z.length-1});
  vec3 base = srgbToLinear(MAT_BASE[id]);
  vec3 lit = srgbToLinear(MAT_LIT[id]);
  vec3 shade = srgbToLinear(MAT_SHADE[id]);
  vec2 prm = MAT_PARAM[id];
  n = normalize(n);
  const vec3 V = vec3(0.0, 0.0, 1.0);
  // Diffuse relative to a flat surface, so flat areas keep the base color exactly.
  float d0 = max(l.z, 0.0);
  float d = max(dot(n, l), 0.0);
  float rel = (d - d0) / max(1.0 - d0, 0.15);
  float relS = rel < 0.0 ? -rel / max(d0, 0.15) * max(1.0 - d0, 0.15) : 0.0;
  vec3 c = rel >= 0.0 ? mix(base, lit, saturate(rel)) : mix(base, shade, saturate(relS) * 0.72);
  // Specular lobe (relative to the flat response).
  vec3 h = normalize(l + V);
  float s = pow(max(dot(n, h), 0.0), prm.x) - pow(max(h.z, 0.0), prm.x);
  c += srgbToLinear(MAT_SPEC[id]) * max(s, 0.0) * (0.35 + 0.65 * prm.y);
  // Metals reflect a horizon-banded environment: tilted surfaces pick up dark ground / bright sky bands.
  vec3 r = reflect(-V, n);
  float tilt = 1.0 - n.z;
  float band = smoothstep(-0.15, 0.25, r.y) - 0.55 * smoothstep(0.55, 0.95, r.y) - 0.35 * (1.0 - smoothstep(-0.7, -0.2, r.y));
  c = mix(c, c * (0.55 + 0.8 * band) + lit * 0.12 * max(band, 0.0), prm.y * saturate(tilt * 2.5));
  if (id == 33) c *= 0.6 + 0.6 * hue2rgb(fract(r.x * 0.6 + r.y * 0.4 + 0.5));
  return linearToSrgb(max(c, 0.0));
}
`,pn=[16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,14,17,22,29,51,87,80,62,18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99],mn=[17,18,24,47,99,99,99,99,18,21,26,66,99,99,99,99,24,26,56,99,99,99,99,99,47,66,99,99,99,99,99,99,...Array(32).fill(99)],hn=[0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63],gn=(()=>{let e=Array(64);return hn.forEach((t,n)=>e[t]=n),e})(),_n=24;function vn(e,t,n){let r=Math.min(100,Math.max(1,t)),i=r<50?5e3/r:200-2*r;return e.map(e=>Math.min(255,Math.max(1,Math.floor((e*i+50)/100*n))))}function yn(e){let t=100-O(e,`compression`),n=O(e,`chromaLuma`),r=vn(pn,t,2**(2*n)),i=vn(mn,t,2**(-2*n)),a=r.slice(),o=i.slice(),s=O(e,`qtTarget`),c=s===0?[a]:s===1?[o]:[a,o],l=nn(O(e,`seed`)*7919+17),u=O(e,`mismatch`)/100;if(u>0)for(let e of c)for(let t=0;t<64;t++){let n=.4+.6*(gn[t]/63);e[t]=Math.min(255,Math.max(1,Math.round(e[t]*2**((l()*2-1)*2.2*u*n))))}let d=Math.round(O(e,`breakingBytes`));if(d>0){let t=Array.from({length:64},(e,t)=>t+l()*40),n=Array.from({length:64},(e,t)=>t).sort((e,n)=>t[e]-t[n]),r=Math.max(1,O(e,`maxRandom`));for(let e of c)for(let t=0;t<Math.min(64,d);t++)e[hn[n[t]]]=1+Math.floor(l()*r)}let f=Math.round(O(e,`qtcPosition`));if(f>=0&&f<64)for(let t of c)t[hn[f]]=Math.max(1,O(e,`qtcValue`));let p=new Float32Array(256);for(let e=0;e<64;e++)p.set([r[e],i[e],a[e],o[e]],e*4);return p}function bn(e){let t=O(e,`corruption`)/100,n=t>0?Math.max(1,Math.round(t*_n)):0,r=new Float32Array(96),i=new Float32Array(96),a=nn(O(e,`seed`)*104729+3),o=Math.min(O(e,`start`),O(e,`end`))/100,s=Math.max(O(e,`start`),O(e,`end`))/100;for(let e=0;e<n;e++){let t=o+(s-o)*a(),n=a()<.3?2:1;r.set([t,(a()*2-1)*26*n,(a()*2-1)*20*n,(a()*2-1)*20*n],e*4);let c=a()<.55?Math.round((a()*2-1)*4):0;i.set([c,a()*1e3,0,0],e*4)}return{ev:r,ev2:i,count:n}}var xn=`
uniform vec4 u_qtab[64];
uniform float u_jp;      // render px per JPEG px
uniform vec2 u_jsize;    // padded JPEG plane size (multiple of 8)
uniform vec2 u_outSize;  // render size
// Intermediate planes are stored top-down (row 0 = top), like a JPEG scan.
`,Sn={id:`jpeg-glitch`,name:`JPEG glitch`,category:`Effects`,keywords:`jpeg glitch compression`,params:[_(`compression`,`Compression`,0,100,96),_(`blockSize`,`Block size`,1,16,1),g(`acGain`,`AC gain`,-2,2,1),_(`corruption`,`Corruption`,0,100,0,{group:`Corruption`}),_(`detailLoss`,`Detail loss`,0,100,100,{group:`Corruption`}),g(`start`,`Start`,0,100,0,.1,{group:`Corruption`}),g(`end`,`End`,0,100,100,.1,{group:`Corruption`}),_(`seed`,`Seed`,1,9999,1,{group:`Corruption`}),_(`breakingBytes`,`Breaking bytes`,0,64,0,{group:`Quantization table`}),_(`maxRandom`,`Max random value`,1,255,255,{group:`Quantization table`}),g(`chromaLuma`,`Chroma / luma`,-1,1,0,.01,{group:`Quantization table`}),_(`mismatch`,`Decoder mismatch`,0,100,0,{group:`Quantization table`}),_(`qtcPosition`,`QTC position`,-1,63,-1,{group:`Quantization table`}),_(`qtcValue`,`QTC value`,1,255,16,{group:`Quantization table`}),x(`qtTarget`,`Table`,[`Luma`,`Chroma`,`Both`],2,`slider`,{group:`Quantization table`}),y(`stageIdct`,`Inverse DCT`,!0,{group:`Decode stages`}),y(`stageYcc`,`YCbCr to RGB`,!0,{group:`Decode stages`}),y(`stageDequant`,`Dequantize`,!0,{group:`Decode stages`})],shaders:{down:`${xn}
void main() {
  vec2 p = floor(gl_FragCoord.xy);
  int n = int(clamp(ceil(u_jp * 0.5), 1.0, 4.0));
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    if (j >= n) break;
    for (int i = 0; i < 4; i++) {
      if (i >= n) break;
      vec2 q = (p + (vec2(i, j) + 0.5) / float(n)) * u_jp; // render px, y from the top
      acc += texture(u_input, vec2(q.x, u_outSize.y - q.y) / u_outSize).rgb;
    }
  }
  fragColor = vec4(rgb2ycbcr(saturate(acc / float(n * n))) * 255.0 - 128.0, 1.0);
}`,dctH:`
uniform sampler2D u_src;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int u = p.x & 7;
  vec3 s = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    s += texelFetch(u_src, ivec2(p.x - u + i, p.y), 0).rgb * cos((2.0 * float(i) + 1.0) * float(u) * PI / 16.0);
  }
  fragColor = vec4(0.5 * (u == 0 ? 0.70710678 : 1.0) * s, 1.0);
}`,dctV:`${xn}
uniform sampler2D u_src;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int v = p.y & 7;
  vec3 s = vec3(0.0);
  for (int j = 0; j < 8; j++) {
    s += texelFetch(u_src, ivec2(p.x, p.y - v + j), 0).rgb * cos((2.0 * float(j) + 1.0) * float(v) * PI / 16.0);
  }
  vec3 F = 0.5 * (v == 0 ? 0.70710678 : 1.0) * s;
  vec4 q = u_qtab[v * 8 + (p.x & 7)];
  fragColor = vec4(round(F / q.xyy), 1.0);
}`,coef:`${xn}
uniform sampler2D u_src;
uniform vec4 u_ev[${_n}];   // scan position (0..1), DC drift Y/Cb/Cr (levels)
uniform vec4 u_ev2[${_n}];  // block shift, seed
uniform int u_evCount;
uniform vec2 u_region;
uniform float u_keepAc;
uniform float u_garbage;
uniform float u_shiftMul; // blocks per MCU column in this plane (luma 2, 4:2:0 chroma 1)
const int ZZ[64] = int[](${gn.join(`, `)});
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 nb = ivec2(u_jsize) / 8;
  ivec2 b = p / 8;
  ivec2 uv = p - b * 8;
  int ridx = uv.y * 8 + uv.x;
  int total = nb.x * nb.y;
  int k = b.y * nb.x + b.x;
  float fk = (float(k) + 0.5) / float(total);
  vec3 dc = vec3(0.0);
  int shift = 0;
  float hitSeed = -1.0;
  if (fk >= u_region.x && fk <= u_region.y) {
    for (int e = 0; e < ${_n}; e++) {
      if (e >= u_evCount) break;
      if (u_ev[e].x <= fk) {
        dc += u_ev[e].yzw;
        shift += int(u_ev2[e].x * u_shiftMul);
        hitSeed = max(hitSeed, u_ev2[e].y);
      }
    }
  }
  int ks = ((k + shift) % total + total) % total;
  ivec2 sb = ivec2(ks % nb.x, ks / nb.x);
  vec3 q = texelFetch(u_src, sb * 8 + uv, 0).rgb;
  vec4 t = u_qtab[ridx];
  if (hitSeed >= 0.0) {
    // DC drift (DPCM decoding keeps adding the error), soft-limited so colors don't run away.
    if (ridx == 0) q += round(70.0 * tanh(dc / 70.0) * 8.0 / t.xyy);
    else if (float(ZZ[ridx]) >= u_keepAc) q = vec3(0.0);
    // Garbage blocks: a few low-frequency coefficients decoded from the wrong bits.
    float blk = hash13(vec3(vec2(sb), hitSeed));
    vec4 h = vec4(hash33(vec3(vec2(p), hitSeed + 1.0)), hash12(vec2(p) * 1.7 + hitSeed));
    if (blk < u_garbage && ZZ[ridx] > 0 && ZZ[ridx] < 21 && h.w < 0.35) q += round((h.xyz - 0.5) * 9.0);
  }
  vec3 F = u_stageDequant ? q * t.zww : q;
  if (ridx != 0) F *= u_acGain;
  fragColor = vec4(F, 1.0);
}`,idctH:`${xn}
uniform sampler2D u_src;
uniform float u_rowScale; // render px per column of this pass (1, or more for huge exports)
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float xj = (float(p.x) + 0.5) * u_rowScale / u_jp;
  float bx = floor(xj / 8.0);
  float xl = xj - bx * 8.0 - 0.5;
  vec3 s = vec3(0.0);
  for (int u = 0; u < 8; u++) {
    vec3 F = texelFetch(u_src, ivec2(int(bx) * 8 + u, p.y), 0).rgb;
    s += (u == 0 ? 0.70710678 : 1.0) * F * cos((2.0 * xl + 1.0) * float(u) * PI / 16.0);
  }
  fragColor = vec4(0.5 * s, 1.0);
}`,main:`${xn}
uniform sampler2D u_rows;   // luma, W × Hp
uniform sampler2D u_rowsC;  // chroma, W × Hc
uniform sampler2D u_coef;
uniform sampler2D u_coefC;
uniform vec2 u_csize;       // chroma plane size
vec3 idctCol(sampler2D rows, float jp) {
  float yj = (u_outSize.y - gl_FragCoord.y) / jp;
  float by = floor(yj / 8.0);
  float yl = yj - by * 8.0 - 0.5;
  // Row results are sampled at exact row centers; horizontally exact (or interpolated if reduced).
  vec2 rs = vec2(textureSize(rows, 0));
  float u = gl_FragCoord.x / u_outSize.x;
  vec3 s = vec3(0.0);
  for (int v = 0; v < 8; v++) {
    vec3 R = texture(rows, vec2(u, (by * 8.0 + float(v) + 0.5) / rs.y)).rgb;
    s += (v == 0 ? 0.70710678 : 1.0) * R * cos((2.0 * yl + 1.0) * float(v) * PI / 16.0);
  }
  return 0.5 * s;
}
// Raw coefficient planes (DC shows the block average, AC around mid gray).
vec3 rawCoef(sampler2D coef, float jp, vec2 size) {
  vec2 j = floor(vec2(gl_FragCoord.x, u_outSize.y - gl_FragCoord.y) / jp);
  return texelFetch(coef, ivec2(min(j, size - 1.0)), 0).rgb / 8.0;
}
void main() {
  vec3 ycc;
  if (u_stageIdct) {
    ycc = vec3(idctCol(u_rows, u_jp).r, idctCol(u_rowsC, u_jp * 2.0).gb);
  } else {
    ycc = vec3(rawCoef(u_coef, u_jp, u_jsize).r, rawCoef(u_coefC, u_jp * 2.0, u_csize).gb);
  }
  ycc = (ycc + 128.0) / 255.0;
  vec3 rgb = u_stageYcc ? ycbcr2rgb(ycc) : ycc;
  fragColor = vec4(saturate(rgb), texture(u_input, v_uv).a);
}`,downC:`
uniform sampler2D u_src;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * 2;
  ivec2 m = textureSize(u_src, 0) - 1;
  vec3 c = texelFetch(u_src, min(p, m), 0).rgb + texelFetch(u_src, min(p + ivec2(1, 0), m), 0).rgb
         + texelFetch(u_src, min(p + ivec2(0, 1), m), 0).rgb + texelFetch(u_src, min(p + ivec2(1, 1), m), 0).rgb;
  fragColor = vec4(c * 0.25, 1.0);
}`,fallback:`${xn}
void main() {
  vec2 px = vec2(gl_FragCoord.x, u_outSize.y - gl_FragCoord.y);
  vec2 blk = (floor(px / (8.0 * u_jp)) + 0.5) * 8.0 * u_jp;
  vec3 ycc = rgb2ycbcr(texture(u_input, vec2(blk.x, u_outSize.y - blk.y) / u_outSize).rgb) * 255.0 - 128.0;
  vec4 t = u_qtab[0];
  ycc = round(ycc * 8.0 / t.xyy) * t.zww / 8.0;
  fragColor = vec4(saturate(ycbcr2rgb((ycc + 128.0) / 255.0)), texture(u_input, v_uv).a);
}`},render(e){let t=e.params,n=e.width,r=e.height,i=Math.max(.25,O(t,`blockSize`)*e.pxScale);i=Math.max(i,Math.max(n,r)/4096);let a=Math.ceil(n/i/8)*8,o=Math.ceil(r/i/8)*8,s=bn(t),c=Math.min(O(t,`start`),O(t,`end`))/100,l=Math.max(O(t,`start`),O(t,`end`))/100,u={u_qtab:yn(t),u_jp:i,u_jsize:[a,o],u_outSize:[n,r],u_ev:s.ev,u_ev2:s.ev2,u_evCount:s.count,u_region:[c,l],u_keepAc:Math.round(64*(1-O(t,`detailLoss`)/100)),u_garbage:O(t,`corruption`)/100*.08};if(e.format!==`rgba16f`)return e.pass(`fallback`,{uniforms:u});let d=`rgba16f`,f=Math.min(n,Math.max(Math.ceil(4*n/i),1),8192),p=(t,r,i,a,o)=>{let s={...u,u_jsize:[r,i],u_jp:a,u_shiftMul:o,u_rowScale:n/f},c=e.pass(`dctH`,{width:r,height:i,format:d,inputs:{u_src:t},uniforms:s}),l=e.pass(`dctV`,{width:r,height:i,format:d,inputs:{u_src:c},uniforms:s});e.release(c);let p=e.pass(`coef`,{width:r,height:i,format:d,inputs:{u_src:l},uniforms:s});return e.release(l),{coef:p,idrows:e.pass(`idctH`,{width:f,height:i,format:d,inputs:{u_src:p},uniforms:s})}},m=e.pass(`down`,{width:a,height:o,format:d,uniforms:u}),h=Math.ceil(a/16)*8,g=Math.ceil(o/16)*8,_=e.pass(`downC`,{width:h,height:g,format:d,inputs:{u_src:m}}),v=p(m,a,o,i,2);e.release(m);let y=p(_,h,g,i*2,1);e.release(_);let b=e.pass(`main`,{inputs:{u_rows:v.idrows,u_rowsC:y.idrows,u_coef:v.coef,u_coefC:y.coef},uniforms:{...u,u_csize:[h,g]}});for(let t of[v.coef,v.idrows,y.coef,y.idrows])e.release(t);return b}},Cn=4,wn=.8,Tn={id:`scatter`,name:`Scatter`,category:`Effects`,keywords:`scatter`,params:[x(`shape`,`Shape`,[`Circle`,`Quad`,`Star`,`Crescent`,`Mix`,`Custom`],0,`slider`),E(`spriteTexture`,`Sprite Texture`),g(`size`,`Size`,.05,10,.52),g(`minSize`,`Min Size`,0,3,3),g(`maxSize`,`Max Size`,0,3,3),g(`widthVariance`,`Width Variance`,0,.5,0),g(`rotationVariance`,`Rotation Variance`,0,1,1),x(`colorMode`,`Color mode`,[`Single`,`Original`,`Texture`],2,`slider`,{group:`Color`}),b(`spriteColor`,`Sprite Color`,`#ffffff`,{group:`Color`}),g(`colorVariation`,`Color variation`,0,1,1,.01,{group:`Color`}),x(`background`,`Background`,[`Original`,`Multiply`,`Screen`,`Overlay`,`Soft light`,`Hidden`],0,`slider`,{group:`Color`}),b(`backgroundColor`,`Background Color`,`#000000`,{group:`Color`}),g(`threshold`,`Threshold`,0,1,.7,.01,{group:`Selection`}),b(`keyColor`,`Key Color`,`#ffffff`,{group:`Selection`}),_(`density`,`Density`,2,300,60,{group:`Grid`}),_(`gridAngle`,`Grid Angle`,-90,90,0,{group:`Grid`,unit:`°`}),g(`spread`,`Spread`,0,1,1,.01,{group:`Grid`}),_(`seed`,`Seed`,0,100,0,{group:`Grid`}),y(`maskEnable`,`Enable`,!1,{group:`Mask`}),y(`maskInvert`,`Invert`,!1,{group:`Mask`,visibleIf:e=>!!e.maskEnable}),S(`maskCenter`,`Center`,[0,0],{group:`Mask`,visibleIf:e=>!!e.maskEnable}),g(`maskSize`,`Size`,0,2,.5,.01,{group:`Mask`,visibleIf:e=>!!e.maskEnable}),g(`maskSoftness`,`Softness`,0,1,.5,.01,{group:`Mask`,visibleIf:e=>!!e.maskEnable}),g(`shadowOpacity`,`Opacity`,0,1,0,.01,{group:`Drop Shadow`}),b(`shadowColor`,`Shadow Color`,`#000000`,{group:`Drop Shadow`}),_(`shadowAngle`,`Angle`,-180,180,-45,{group:`Drop Shadow`,unit:`°`}),g(`shadowDistance`,`Distance`,0,1,.15,.01,{group:`Drop Shadow`}),g(`shadowSpread`,`Spread`,0,1,0,.01,{group:`Drop Shadow`}),g(`shadowBlur`,`Blur`,0,4,.3,.01,{group:`Drop Shadow`}),x(`shadowMode`,`Draw per`,[`Element`,`Layer`],0,`switcher`,{group:`Drop Shadow`})],uniforms(e,{width:t}){let n=t/Math.max(2,O(e,`density`)),r=wn*O(e,`size`)*Math.max(O(e,`minSize`),O(e,`maxSize`))*(1+O(e,`widthVariance`)),i=O(e,`shadowOpacity`)>0?O(e,`shadowDistance`)+.5*O(e,`shadowSpread`)+.5*O(e,`shadowBlur`):0,a=.75*O(e,`spread`),o=.575*(1+O(e,`widthVariance`))+i,s=Math.max(.1,(Cn-a)/o),c=Math.min(r,s)*o+a;return{u_cellPx:n,u_search:Math.min(Cn,Math.ceil(c+.01)),u_maxDiam:s}},render(e){let t=Math.max(2,O(e.params,`density`)),n=on(e,e.input,t*2,t*2*e.height/e.width),r=e.pass(`main`,{inputs:{u_cells:n}});return n!==e.input&&e.release(n),r},shaders:{down2:an,main:`
uniform sampler2D u_cells; // input reduced to ~2 texels per cell: per-sprite color / selection samples
uniform float u_cellPx;
uniform float u_search;
uniform float u_maxDiam;

struct Sprite { vec2 pos; float diam; float rot; float sx; int shape; float z; vec2 src; float vary; };

float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

// Explicit mip level for the (mipmapped) sprite texture: it is sampled in divergent loops.
float spriteLod(float diamPx) {
  return max(0.0, log2(max(u_spriteTextureSize.x, u_spriteTextureSize.y) / max(diamPx, 1.0)));
}

// Signed distance (in sprite radii) of local point q to the sprite shape; negative inside.
float shapeSdf(int shape, vec2 q, float lod) {
  if (shape == 1) { vec2 d = abs(q) - vec2(0.886); return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  if (shape == 2) return sdStar5(q * vec2(1.0, -1.0) + vec2(0.0, 0.12), 1.08, 0.45);
  if (shape == 3) return max(length(q) - 1.0, -(length(q - vec2(0.42, 0.18)) - 0.86));
  if (shape == 5) {
    if (!u_spriteTextureLoaded) return length(q) - 1.0;
    vec2 tuv = q * 0.5 + 0.5;
    if (any(lessThan(tuv, vec2(0.0))) || any(greaterThan(tuv, vec2(1.0)))) return 1.0;
    vec4 t = textureLod(u_spriteTexture, tuv, lod);
    float a = t.a < 0.999 ? t.a : luma(t.rgb);
    return (0.5 - a) * 0.25;
  }
  return length(q) - 1.0;
}

// Straight-alpha "over".
vec4 over(vec4 top, vec4 base) {
  float a = top.a + base.a * (1.0 - top.a);
  return vec4((top.rgb * top.a + base.rgb * base.a * (1.0 - top.a)) / max(a, 1e-5), a);
}

vec2 gridToPx(vec2 g) { return rot2(radians(float(u_gridAngle))) * (g * u_cellPx) + u_resolution * 0.5; }

float maskAt(vec2 px) {
  if (!u_maskEnable) return 1.0;
  vec2 uv = px / u_resolution;
  float d = length(centered(uv, u_resolution) - centered(pointToUv(u_maskCenter), u_resolution));
  float r = u_maskSize * 0.5;
  float m = 1.0 - smoothstep(r * (1.0 - u_maskSoftness) - 1e-4, r + 1e-4, d);
  return u_maskInvert ? 1.0 - m : m;
}

Sprite makeSprite(vec2 c) {
  Sprite s;
  vec4 h = vec4(hash33(vec3(c, float(u_seed) * 13.0 + 1.0)), hash12(c * 1.37 + float(u_seed) * 7.0 + 3.0));
  vec4 h2 = vec4(hash33(vec3(c, float(u_seed) * 13.0 + 5.0)), 0.0);
  s.src = c + 0.5;
  s.pos = s.src + (h.xy - 0.5) * 1.5 * u_spread;
  vec2 srcPx = gridToPx(s.src);
  vec3 col = texture(u_cells, srcPx / u_resolution).rgb;
  float sim = 1.0 - length(col - u_keyColor) / 1.7320508;
  float f = saturate((sim - (1.0 - u_threshold)) / max(u_threshold, 1e-3));
  s.diam = min(${wn} * u_size * mix(u_minSize, u_maxSize, f), u_maxDiam) * maskAt(srcPx);
  s.rot = (h.z - 0.5) * TAU * u_rotationVariance;
  s.sx = 1.0 + (h.w - 0.5) * 2.0 * u_widthVariance;
  s.shape = u_shape == 4 ? int(h2.x * 4.0) : u_shape;
  s.z = h2.y;
  s.vary = h2.z;
  return s;
}

// Local sprite coordinates (unit radius) of grid-space point g.
vec2 spriteLocal(Sprite s, vec2 g) {
  vec2 q = rot2(-s.rot) * (g - s.pos) / max(s.diam * 0.5, 1e-4);
  q.x /= s.sx;
  return q;
}

vec3 spriteColor(Sprite s, vec2 g) {
  vec3 base = texture(u_cells, gridToPx(s.src) / u_resolution).rgb;
  if (u_colorMode == 2) {
    // Texture: the sprite image, or the picture itself rotated with the sprite around its source cell;
    // color variation blends from the plain source color to the full texture detail.
    vec3 t;
    if (u_spriteTextureLoaded) t = textureLod(u_spriteTexture, spriteLocal(s, g) * 0.5 + 0.5, spriteLod(s.diam * u_cellPx)).rgb;
    else t = texture(u_input, gridToPx(s.src + rot2(-s.rot) * (g - s.pos)) / u_resolution).rgb;
    return mix(base, t, u_colorVariation);
  }
  vec3 c = u_colorMode == 0 ? u_spriteColor : base;
  float v = (s.vary - 0.5) * u_colorVariation;
  return saturate(c * (1.0 + 0.35 * v) + 0.05 * v);
}

void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 g = rot2(-radians(float(u_gridAngle))) * (gl_FragCoord.xy - u_resolution * 0.5) / u_cellPx;
  vec2 cell = floor(g);
  float aa = 1.0 / u_cellPx; // one render pixel in grid units
  int R = int(u_search);
  // Shadow offset in grid space (screen angle, +y up).
  float sa = radians(float(u_shadowAngle));
  vec2 sdir = rot2(-radians(float(u_gridAngle))) * vec2(cos(sa), sin(sa));
  bool shadows = u_shadowOpacity > 0.0;

  // Top two sprites by z (z, coverage, cell.xy).
  vec4 top0 = vec4(-1.0), top1 = vec4(-1.0);
  // Shadow casters: union for the background, plus the two highest casters (z, alpha) for stacking.
  float shadowAll = 0.0;
  vec4 casters = vec4(-1.0);
  for (int j = -${Cn}; j <= ${Cn}; j++) {
    if (abs(j) > R) continue;
    for (int i = -${Cn}; i <= ${Cn}; i++) {
      if (abs(i) > R) continue;
      vec2 c = cell + vec2(i, j);
      Sprite s = makeSprite(c);
      if (s.diam <= 1e-4) continue;
      float rpx = s.diam * 0.5;
      float lod = spriteLod(s.diam * u_cellPx);
      float d = shapeSdf(s.shape, spriteLocal(s, g), lod) * rpx; // grid units
      float cov = saturate(0.5 - d / aa);
      if (cov > 0.0) {
        vec4 e = vec4(s.z, cov, c);
        if (e.x > top0.x) { top1 = top0; top0 = e; }
        else if (e.x > top1.x) top1 = e;
      }
      if (shadows) {
        vec2 gs = g - sdir * u_shadowDistance * s.diam;
        float ds = shapeSdf(s.shape, spriteLocal(s, gs), lod) * rpx - u_shadowSpread * rpx;
        float soft = max(u_shadowBlur * rpx, aa);
        float a = saturate(0.5 - ds / soft);
        if (a > 0.0) {
          shadowAll = 1.0 - (1.0 - shadowAll) * (1.0 - a);
          if (s.z > casters.x) { casters.zw = casters.xy; casters.xy = vec2(s.z, a); }
          else if (s.z > casters.z) casters.zw = vec2(s.z, a);
        }
      }
    }
  }

  // Background.
  vec4 bg;
  vec3 img = src.rgb;
  if (u_background == 0) bg = vec4(img, src.a);
  else if (u_background == 1) bg = vec4(img * u_backgroundColor, src.a);
  else if (u_background == 2) bg = vec4(1.0 - (1.0 - img) * (1.0 - u_backgroundColor), src.a);
  else if (u_background == 3) bg = vec4(blendOverlay(img, u_backgroundColor), src.a);
  else if (u_background == 4) bg = vec4(blendSoftLight(img, u_backgroundColor), src.a);
  else bg = vec4(0.0);
  float sop = u_shadowOpacity;
  vec4 outc = shadows ? over(vec4(u_shadowColor, shadowAll * sop), bg) : bg;
  // Composite kept sprites back to front.
  for (int k = 1; k >= 0; k--) {
    vec4 e = k == 0 ? top0 : top1;
    if (e.x < 0.0) continue;
    Sprite s = makeSprite(e.zw);
    vec3 c = spriteColor(s, g);
    if (shadows && u_shadowMode == 0) {
      // Shadows of sprites stacked above this one.
      float a = 0.0;
      if (casters.x > e.x) a = 1.0 - (1.0 - a) * (1.0 - casters.y);
      if (casters.z > e.x) a = 1.0 - (1.0 - a) * (1.0 - casters.w);
      c = mix(c, u_shadowColor, a * sop);
    }
    outc = over(vec4(c, e.y), outc);
  }
  fragColor = outc;
}`}},En=[`reds`,`yellows`,`greens`,`cyans`,`blues`,`magentas`],Dn=[`Reds`,`Yellows`,`Greens`,`Cyans`,`Blues`,`Magentas`],On=[{on:!0,ink:20,w:[-.78,1.9,3,3,3,3],shift:[0,0]},{on:!0,ink:4,w:[2.08,1.5,-2,-.5,.96,-2],shift:[0,.2]},{on:!0,ink:13,w:[.44,-2,3,3,3,3],shift:[.3,.1]},{on:!1,ink:0,w:[.4,.6,.4,.6,.2,.8],shift:[0,0]}];function kn(e,t){let n=e+1,r=e=>!!e[`ink${n}`];return[y(`ink${n}`,`Ink ${n}`,t.on),x(`ink${n}Color`,`Ink ${n} color`,cn,t.ink,`slider`,{visibleIf:r}),...En.map((e,i)=>g(`ink${n}${Dn[i]}`,`Ink ${n} ${e}`,-2,3,t.w[i],.01,{visibleIf:r})),S(`ink${n}Shift`,`Ink ${n} shift`,t.shift,{visibleIf:r})]}var An=e=>`
  if (u_ink${e}) {
    vec2 uv = v_uv - u_ink${e}Shift * 0.01;
    vec3 c = texture(u_soft, uv).rgb;
    float g = bwMix(c, u_ink${e}Reds, u_ink${e}Yellows, u_ink${e}Greens, u_ink${e}Cyans, u_ink${e}Blues, u_ink${e}Magentas);
    float cov = inkCoverage(saturate(1.0 - g), ${e}.0);
    col *= mix(vec3(1.0), risoInk(u_ink${e}Color), cov);
  }`,jn={id:`risograph`,name:`Risograph`,category:`Effects`,keywords:`color separation duotone fluoro grain ink overprint print riso risograph screen print spot color`,params:[b(`paperColor`,`Paper color`,`#f5f1e8`),g(`grainScale`,`Grain scale`,.1,3,.18),g(`grainOpacity`,`Grain opacity`,0,1,.85),g(`grainSoftness`,`Grain softness`,0,.5,.5),g(`grainContrast`,`Grain contrast`,.5,3,1),...On.flatMap((e,t)=>kn(t,e))],shaders:{main:`
${ln}
uniform sampler2D u_soft; // source with a little ink spread
// Photoshop "Black & White": gray = min + (mid - min) * secondary weight + (max - mid) * primary weight.
float bwMix(vec3 c, float wr, float wy, float wg, float wc, float wb, float wm) {
  float r = c.r, g = c.g, b = c.b;
  float mx = max(r, max(g, b)), mn = min(r, min(g, b));
  float mid = r + g + b - mx - mn;
  float wPrim, wSec;
  if (mx == r) { wPrim = wr; wSec = g >= b ? wy : wm; }
  else if (mx == g) { wPrim = wg; wSec = r >= b ? wy : wc; }
  else { wPrim = wb; wSec = r >= g ? wm : wc; }
  return mn + (mid - mn) * wSec + (mx - mid) * wPrim;
}

// Grain field in [0,1] per drum: two octaves of value noise, cell size from the grain scale (reference px).
float grainField(vec2 px, float seed) {
  float s = max(u_grainScale * 8.5 * u_pxScale, 0.75);
  vec2 p = px / s + seed * vec2(37.1, 91.7);
  float n = 0.62 * valueNoise(p) + 0.38 * valueNoise(mat2(0.8, 0.6, -0.6, 0.8) * p * 2.31 + 11.0);
  n = (n - 0.5) * 1.6 + 0.5; // normalize the 2-octave sum back toward a uniform-ish spread
  return saturate((n - 0.5) * u_grainContrast + 0.5);
}

// Ink lay-down through the grain: soft grain is a mean-preserving density perturbation (strongest in the
// mid-tones), hard grain thresholds the density against the field (binary specks); softness blends them.
float inkCoverage(float density, float seed) {
  float n = grainField(gl_FragCoord.xy, seed);
  float soft = saturate(density + (n - 0.5) * sqrt(saturate(density * (1.0 - density))) * 0.7);
  float hard = smoothstep(n - 0.04, n + 0.04, density);
  float g = mix(hard, soft, saturate(u_grainSoftness * 2.0));
  // Drum toning: sparse ink specks even where the drum should stay clean.
  vec2 cell = gl_FragCoord.xy / max(u_grainScale * 6.4 * u_pxScale, 0.75);
  float speck = smoothstep(0.88, 0.98, valueNoise(cell + seed * 53.0)) * 0.3;
  g = g + speck * (1.0 - g);
  return mix(density, g, u_grainOpacity);
}

void main() {
  vec4 src = texture(u_input, v_uv);
  // Paper with a faint fiber grain.
  float pg = grainField(gl_FragCoord.xy * 0.7, 9.0) - 0.5;
  vec3 col = u_paperColor * (1.0 + 0.05 * u_grainOpacity * pg);
${[1,2,3,4].map(An).join(`
`)}
  fragColor = vec4(saturate(col), src.a);
}`},render(e){let t=e.blur(e.input,.6*e.pxScale),n=e.pass(`main`,{inputs:{u_soft:t}});return e.release(t),n}},Mn=`
const float LINES = 480.0;
// Vertical jump: the picture is pushed down, exposing the head-switching band at the top.
float vhsJump() {
  float k = floor(u_time * 0.37);
  float burst = smoothstep(0.88, 0.94, fract(u_time * 0.37)) * (1.0 - smoothstep(0.96, 1.0, fract(u_time * 0.37)));
  // Resting offset saturates at 6 % of the frame; bursts make the picture jump further for a moment.
  return 0.06 * (1.0 - exp(-u_verticalJump * 4.7)) + u_verticalJump * 0.12 * burst * hash11(k + 0.5);
}
float trackingCenter() { return fract(0.5 + u_time * 0.071); }
float creaseCenter() { return fract(0.965 + u_time * 0.043); }
// Weight of a soft horizontal band (y from the top, wrapping).
float bandWeight(float y, float c, float h) {
  float d = abs(y - c);
  d = min(d, 1.0 - d);
  return 1.0 - smoothstep(h * 0.35, h, d);
}
`,Nn={id:`vhs`,name:`VHS`,category:`Effects`,keywords:`analog distortion filter ntsc retro scanlines vhs tv`,animated:!0,params:[_(`samples`,`resolution`,128,1024,320),g(`distortion`,`distortion`,0,2.5,.23),g(`colorFringing`,`color fringing`,0,2,2),g(`wobble`,`wobble`,0,2,2),g(`tapeCrease`,`tape crease`,0,2,.5),g(`trackingNoise`,`tracking noise`,0,2,2),g(`verticalJump`,`vertical jump`,0,2,.05),g(`sparkle`,`sparkle`,0,2,1),g(`flicker`,`flicker`,0,2,.06),g(`grain`,`grain`,0,2,.75),g(`saturation`,`saturation`,0,2.5,2),g(`colorShift`,`color shift`,0,2,.1),g(`colorBlend`,`color blend`,0,1,1),g(`softness`,`softness`,.4,2,.5),g(`colorDelay`,`color delay`,0,8,5.8,.1),g(`sharpening`,`sharpening`,0,2,.25)],shaders:{geom:`
${Mn}
void main() {
  float yTop = 1.0 - v_uv.y;
  float L = floor(yTop * LINES);
  float t = u_time;
  float jump = vhsJump();
  float ySrc = yTop - jump;
  // Wobble: fast per-line jitter riding on a slower wave.
  float dx = (valueNoise(vec2(L * 0.11, t * 4.0)) - 0.5) * 0.002 * u_wobble;
  dx += (hash12(vec2(L, floor(t * 29.97))) - 0.5) * 0.0005 * u_wobble;
  // Distortion: slow bending of the whole frame plus head-switching skew in the last lines.
  dx += (valueNoise(vec2(yTop * 2.5, t * 0.6 + 3.0)) - 0.5) * 0.02 * u_distortion;
  float hs = saturate((yTop - 0.955) / 0.045);
  dx += hs * hs * 0.06 * u_distortion * (0.6 + 0.4 * valueNoise(vec2(L * 0.5, t * 8.0)));
  // Tape crease: a narrow band of strongly displaced lines.
  float cw = bandWeight(yTop, creaseCenter(), 0.012 + 0.01 * u_tapeCrease);
  dx += cw * (valueNoise(vec2(L * 0.7, t * 13.0)) - 0.35) * 0.05 * u_tapeCrease;
  // Tracking band: jittery lines.
  float tw = bandWeight(yTop, trackingCenter(), 0.09);
  dx += tw * (hash12(vec2(L * 3.1, floor(t * 29.97) + 7.0)) - 0.5) * 0.0016 * u_trackingNoise;
  vec2 uv = vec2(v_uv.x - dx, 1.0 - ySrc);
  vec4 c = texture(u_input, clamp(uv, 0.0, 1.0));
  vec3 yiq = rgb2yiq(c.rgb);
  if (ySrc < 0.0) yiq = vec3(0.04 + 0.03 * hash12(vec2(floor(v_uv.x * 400.0), L)), 0.0, 0.0);
  fragColor = vec4(yiq + vec3(0.0, 0.5, 0.5), c.a);
}`,main:`
${Mn}
uniform sampler2D u_geo;
uniform sampler2D u_lumaB;
uniform sampler2D u_chromaB;
uniform sampler2D u_chromaW;
void main() {
  vec2 res = u_resolution;
  float samp = res.x / u_samples;
  float yTop = 1.0 - v_uv.y;
  float L = floor(yTop * LINES);
  float t = u_time;
  float frame = floor(t * 29.97);
  float jump = vhsJump();

  vec4 geo = texture(u_geo, v_uv);
  float Yb = texture(u_lumaB, v_uv).x;
  float Yw = texture(u_chromaW, v_uv).x;
  // Deck sharpening: unsharp mask against the wide blur (halos).
  float Y = Yb + u_sharpening * 1.6 * (Yb - Yw);
  // Chroma: delayed (smeared to the right) with I/Q fringing.
  float d = u_colorDelay * samp * 0.55 / res.x;
  float f = u_colorFringing * samp * 0.45 / res.x;
  float I = texture(u_chromaB, v_uv - vec2(d + f, 0.0)).y - 0.5;
  float Q = texture(u_chromaB, v_uv - vec2(d - f, 0.0)).z - 0.5;
  vec2 iqSharp = texture(u_geo, v_uv - vec2(d, 0.0)).yz - 0.5;
  vec2 iq = mix(iqSharp, vec2(I, Q), u_colorBlend);
  iq = rot2(u_colorShift * 2.5) * iq * u_saturation;

  // Black level up, white level down.
  Y = 0.05 + 0.9 * Y;

  // Grain: horizontally stretched luma noise + streaky chroma noise.
  vec2 gp = vec2(gl_FragCoord.x / max(samp * 0.6, 1.0), L);
  Y += (hash12(gp + frame * 17.0) - 0.5) * 0.05 * u_grain;
  vec2 cp = vec2(gl_FragCoord.x / max(samp * 2.5, 1.0), L * 0.5 + frame * 3.0);
  iq += (vec2(valueNoise(cp), valueNoise(cp + 41.0)) - 0.5) * 0.08 * u_grain;

  // Tape crease: bright noisy streak.
  float cw = bandWeight(yTop, creaseCenter(), 0.006 + 0.004 * u_tapeCrease);
  Y += cw * u_tapeCrease * 0.2 * (hash12(vec2(gl_FragCoord.x / max(samp, 1.0), L + frame)) - 0.4);

  // Tracking noise band + sparkles: short bright horizontal dashes.
  float tw = bandWeight(yTop, trackingCenter(), 0.1);
  float p = 0.0012 * u_sparkle + tw * (0.006 * u_sparkle + 0.009 * u_trackingNoise);
  float segs = 22.0;
  float xs = v_uv.x * segs + hash12(vec2(L, frame + 3.0)) * 7.0;
  float seg = floor(xs);
  vec4 h = vec4(hash33(vec3(seg, L, frame)), hash12(vec2(seg * 1.3 + L, frame + 11.0)));
  if (h.x < p) {
    float fx = fract(xs);
    float a = h.y * 0.5, b = a + 0.25 + h.z * 0.5;
    float dash = smoothstep(a, a + 0.05, fx) * (1.0 - smoothstep(b - 0.15, b, fx));
    Y += dash * (0.18 + 0.3 * h.w);
    iq += dash * vec2(0.13, 0.1);
  }
  Y += tw * u_trackingNoise * 0.05 * (hash12(vec2(gl_FragCoord.x / max(samp * 0.5, 1.0), L + frame * 5.0)) - 0.5);

  // Head-switching band exposed by the vertical jump: dark with a bright line at its edge.
  float ySrc = yTop - jump;
  if (ySrc < 0.0) {
    float edge = smoothstep(-0.006, 0.0, ySrc);
    Y = mix(Y, 0.06, 1.0 - edge * 0.3);
    iq = mix(iq, vec2(-0.15, 0.12), edge);
    Y += edge * 0.25;
  }
  // Unstable chroma at the start of each line (left edge).
  float lw = 0.0075 * res.x;
  if (gl_FragCoord.x < lw) {
    vec3 r = hash33(vec3(L, frame, 5.0));
    iq = mix(iq, (r.xy - 0.5) * 0.5, 0.85 * (1.0 - gl_FragCoord.x / lw * 0.5));
    Y += (r.z - 0.3) * 0.12;
  }

  // Flicker.
  Y *= 1.0 + u_flicker * 0.5 * (valueNoise(vec2(t * 11.0, 0.5)) - 0.5) * 2.0;

  vec3 rgb = yiq2rgb(vec3(Y, iq));
  fragColor = vec4(saturate(rgb), geo.a);
}`},render(e){let t=e.params,n=e.width,r=e.height,i=Math.max(16,O(t,`samples`)),a=n/i,o=Math.min(n,Math.round(i*4)),s=Math.min(r,960),c=o/n,l=s/r,u=e.pass(`geom`,{width:o,height:s}),d=O(t,`softness`)*a*1.4,f=a*(2.2+1.5*O(t,`softness`)),p=e.blur(u,d*c,0),m=e.blur(u,f*c,f*.12*l),h=e.blur(u,a*2.5*c,0),g=e.pass(`main`,{inputs:{u_geo:u,u_lumaB:p,u_chromaB:m,u_chromaW:h}});return e.release(u),e.release(p),e.release(m),e.release(h),g}},Pn=[` .'\`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$`,` .:-=+*#%@`,` ░▒▓█`,` ·:•oO0●`,` 01`],Fn={"░":.25,"▒":.5,"▓":.75,"█":1},B=40,V=64,In=16;function Ln(e,t){let n=Array.from(t),r=new OffscreenCanvas(B,V).getContext(`2d`,{willReadFrequently:!0}),i=`${Math.round(V*.72)}px ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace`,a=(e,t,n,r)=>{let a=Fn[t];if(a!==void 0){e.fillStyle=`#fff`;let t=B/5;for(let i=0;i<V/t;i++)for(let o=0;o<5;o++){let s=(o&1)+2*(i&1);(a>=1||a>=.75&&s!==3||a>=.5&&(s===0||s===3)||a>=.25&&s===0)&&e.fillRect(n+o*t,r+i*t,t,t)}return}e.font=i,e.textAlign=`center`,e.textBaseline=`middle`,e.fillStyle=`#fff`;let o=e.measureText(t),s=o.width>B?B/o.width:1;e.save(),e.translate(n+B/2,r+V/2+V*.04),e.scale(s,1),e.fillText(t,0,0),e.restore()},o=n.map(e=>{r.clearRect(0,0,B,V),a(r,e,0,0);let t=r.getImageData(0,0,B,V).data,n=0;for(let e=3;e<t.length;e+=4)n+=t[e];return n}),s=n.map((e,t)=>t).sort((e,t)=>o[e]-o[t]||e-t),c=Math.max(1,o[s[s.length-1]]),l=[];s.forEach((e,t)=>l.push(Math.max(o[e]/c,t>0?l[t-1]+1e-4:0)));let u=new Uint8Array(1024);for(let e=0;e<256;e++){let t=e/255,n=0;for(;n<l.length-1&&l[n+1]<=t;)n++;let r=n<l.length-1?(t-l[n])/(l[n+1]-l[n]):0;u.set([n,Math.round(Math.min(1,Math.max(0,r))*255),0,255],e*4)}let d=j(e,u,256,1,{nearest:!0}),f=Math.ceil(s.length/In),p=new OffscreenCanvas(640,f*V),m=p.getContext(`2d`);return m.fillStyle=`#000`,m.fillRect(0,0,p.width,p.height),s.forEach((e,t)=>a(m,n[e],t%In*B,Math.floor(t/In)*V)),{tex:Fe(e,p,p.width,p.height,{mipmaps:!0}),lut:d,rows:f}}var Rn={id:`ascii`,name:`ASCII`,category:`Effects`,keywords:`art ascii pixel retro style terminal text`,params:[_(`charSet`,`charSet`,0,4,0),_(`density`,`density`,14,70,60),g(`tileAspect`,`tile aspect`,.55,1.5,.6),b(`charColor`,`character color`,`#ffffff`),b(`bgColor`,`background color`,`#000000`),y(`invert`,`invert`,!1),g(`contrast`,`contrast`,0,3,1),g(`cutDarks`,`cut darks`,0,.5,.02),g(`cutLights`,`cut lights`,0,.5,0),y(`overlay`,`overlay on image`,!1)],shaders:{down2:an,main:`
uniform sampler2D u_atlas;
uniform sampler2D u_lut;
uniform sampler2D u_small; // input reduced to ~4 texels per cell (cell averages stay exact at any size)
uniform float u_atlasRows;
const float COLS = ${In}.0;
const vec2 CELL = vec2(${B}.0, ${V}.0);
void main() {
  vec4 src = texture(u_input, v_uv);
  float cellH = u_resolution.y / u_density;
  vec2 cellPx = vec2(cellH * u_tileAspect, cellH);
  // Grid anchored at the top-left corner.
  vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 cell = floor(p / cellPx);
  vec2 local = (p - cell * cellPx) / cellPx; // 0..1, y down
  // Average luminance of the cell (4x4 bilinear taps).
  float l = 0.0;
  vec3 avg = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      vec2 q = (cell + (vec2(i, j) + 0.5) / 4.0) * cellPx;
      vec3 c = texture(u_small, vec2(q.x, u_resolution.y - q.y) / u_resolution).rgb;
      avg += c;
    }
  }
  avg /= 16.0;
  l = luma(saturate(avg));
  if (u_invert) l = 1.0 - l;
  l = saturate((l - 0.5) * u_contrast + 0.5);
  // Wanted ink coverage relative to the densest glyph → the glyph with the nearest coverage.
  vec2 lk = texelFetch(u_lut, ivec2(int(l * l * l * 255.0 + 0.5), 0), 0).rg * 255.0;
  float k = floor(lk.x + 0.5) + (lk.y > 127.5 ? 1.0 : 0.0);
  if (l < u_cutDarks || l > 1.0 - u_cutLights) k = 0.0;
  // Atlas lookup (atlas rows are stored top-down in the canvas, flipped on upload).
  vec2 slot = vec2(mod(k, COLS), floor(k / COLS));
  vec2 atlasSize = vec2(COLS, u_atlasRows) * CELL;
  // Slightly under-filtered and re-thresholded so tiny glyphs stay crisp instead of turning gray.
  float lod = max(0.0, log2(CELL.y / max(cellH, 1.0)) - 1.0);
  // Keep the filter footprint inside the glyph's own atlas slot (no bleeding from neighbours).
  vec2 margin = (0.5 * exp2(ceil(lod)) + 0.5) / CELL;
  vec2 apx = (slot + clamp(local, margin, 1.0 - margin)) * CELL;
  vec2 auv = vec2(apx.x, atlasSize.y - apx.y) / atlasSize;
  float g = textureLod(u_atlas, auv, lod).r;
  float crisp = saturate(8.0 / cellH);
  g = mix(g, smoothstep(0.2, 0.6, g), crisp);
  vec3 base = u_overlay ? src.rgb : u_bgColor;
  fragColor = vec4(mix(base, u_charColor, g), src.a);
}`},render(e){let t=Math.max(0,Math.min(Pn.length-1,Math.round(O(e.params,`charSet`)))),n=e.cached(`atlas:${t}`,()=>Ln(e.gl,Pn[t]),e=>(e.tex.dispose(),e.lut.dispose())),r=Math.max(1,O(e.params,`density`)),i=e.height/r*O(e.params,`tileAspect`),a=on(e,e.input,e.width/i*4,r*4),o=e.pass(`main`,{inputs:{u_atlas:n.tex,u_lut:n.lut,u_small:a},uniforms:{u_atlasRows:n.rows}});return a!==e.input&&e.release(a),o}},H=[[0,0,0,0,0,0,0,0],[128,0,0,0,0,0,0,0],[128,0,8,0,128,0,8,0],[128,64,32,0,2,4,8,0],[64,160,0,0,4,10,0,0],[128,16,2,32,1,8,64,4],[136,0,34,0,136,0,34,0],[1,2,4,8,16,32,64,128],[170,0,128,0,136,0,128,0],[8,28,34,193,128,1,2,4],[3,132,72,48,12,2,1,1],[32,80,136,136,136,136,5,2],[136,20,34,65,136,0,170,0],[130,68,57,68,130,1,1,1],[255,128,128,128,128,128,128,128],[136,136,136,136,136,136,136,136],[85,160,64,64,85,10,4,4],[136,34,136,34,136,34,136,34],[170,0,170,0,170,0,170,0],[17,34,68,136,17,34,68,136],[255,0,0,0,255,0,0,0],[0,8,20,42,85,42,20,8],[128,128,65,62,8,8,20,227],[16,32,84,170,255,2,4,8],[255,128,128,128,255,8,8,8],[177,48,3,27,216,192,12,141],[255,136,136,136,255,136,136,136],[248,116,34,71,143,23,34,113],[170,85,170,85,170,85,170,85],[170,170,170,170,170,170,170,170],[255,0,255,0,255,0,255,0],[191,0,191,191,176,176,176,176],[119,137,143,143,119,152,248,248],[221,119,221,119,221,119,221,119],[85,255,85,255,85,255,85,255],[238,221,187,119,238,221,187,119],[221,255,119,255,221,255,119,255],[255,255,255,255,255,255,255,255]],zn={type:`patterns`,key:`patterns`,label:`Patterns`,patterns:H,default:[0,2,6,17,28,33,36,37].map(String)},Bn=e=>e.reduce((e,t)=>e+((t&255).toString(2).split(`1`).length-1),0);function Vn(e,t){let n=(t.patterns??[]).map(e=>parseInt(e,10)).filter((e,t,n)=>e>=0&&e<H.length&&n.indexOf(e)===t).sort((e,t)=>Bn(H[e])-Bn(H[t])||e-t),r=[H[0],...n.map(e=>H[e]),H[H.length-1]],i=r.length,a=new Uint8Array(8*i*8*4);r.forEach((e,t)=>{for(let n=0;n<8;n++)for(let r=0;r<8;r++){let o=e[n]>>7-r&1,s=((7-n)*8*i+t*8+r)*4;a[s]=a[s+1]=a[s+2]=o?255:0,a[s+3]=255}});let o=r.map(e=>Bn(e)/64),s=[...new Set(o)].sort((e,t)=>e-t),c=new Uint8Array(1024);for(let e=0;e<256;e++){let t=e/255,n=0;for(let e=1;e<s.length;e++)Math.abs(s[e]-t)<Math.abs(s[n]-t)&&(n=e);let r=n>0?(s[n-1]+s[n])/2:0,i=n<s.length-1?(s[n]+s[n+1])/2:1,a=o.map((e,t)=>e===s[n]?t:-1).filter(e=>e>=0),l=i>r?(t-r)/(i-r):0,u=a[Math.min(a.length-1,Math.floor(l*a.length))];c[e*4]=u,c[e*4+3]=255}return{tex:j(e,a,8*i,8,{nearest:!0}),lut:j(e,c,256,1,{nearest:!0}),levels:i}}var Hn={id:`macpaint`,name:`MacPaint`,category:`Effects`,keywords:`macpaint pixel retro style terminal text`,params:[zn,_(`bitmapWidth`,`Bitmap width`,32,4096,342),g(`threshold`,`Threshold`,0,1,.354,.001),g(`contrast`,`Contrast`,.1,4,2.5),g(`grain`,`Grain`,0,1,0),_(`smooth`,`Smooth`,0,3,1),g(`sharpen`,`Sharpen`,-1,2,-.83),g(`radius`,`Radius`,.5,5,1.2,.1),x(`edgeMode`,`Edges`,[`Off`,`Ink`,`Shade`],1,`slider`),g(`edgeThreshold`,`Edge threshold`,.01,1,.1),g(`edgeWidth`,`Edge width`,.5,3,1.1,.1),b(`ink`,`Ink`,`#0f0f12`),b(`paper`,`Paper`,`#f7f5eb`),g(`blend`,`Blend`,0,1,1)],shaders:{down:`
uniform vec2 u_outSize;
void main() {
  vec2 cell = u_outSize / u_resolution; // render px per bitmap px
  vec2 p0 = floor(gl_FragCoord.xy) * cell;
  int n = int(clamp(ceil(max(cell.x, cell.y) * 0.5), 1.0, 4.0));
  float acc = 0.0;
  for (int j = 0; j < 4; j++) {
    if (j >= n) break;
    for (int i = 0; i < 4; i++) {
      if (i >= n) break;
      acc += luma(texture(u_input, (p0 + (vec2(i, j) + 0.5) / float(n) * cell) / u_outSize).rgb);
    }
  }
  fragColor = vec4(vec3(saturate(acc / float(n * n))), 1.0);
}`,tone:`
uniform sampler2D u_soft;
uniform sampler2D u_wide;
float L(vec2 o) { return texture(u_soft, (gl_FragCoord.xy + o) / u_resolution).r; }
void main() {
  float s = L(vec2(0.0));
  float w = texture(u_wide, v_uv).r;
  float l = s + u_sharpen * (s - w);
  float t = (l - u_threshold) * u_contrast + 0.5;
  if (u_grain > 0.0) t += (hash12(gl_FragCoord.xy + 17.0) - 0.5) * u_grain;
  float gx = L(vec2(1, -1)) + 2.0 * L(vec2(1, 0)) + L(vec2(1, 1)) - L(vec2(-1, -1)) - 2.0 * L(vec2(-1, 0)) - L(vec2(-1, 1));
  float gy = L(vec2(-1, 1)) + 2.0 * L(vec2(0, 1)) + L(vec2(1, 1)) - L(vec2(-1, -1)) - 2.0 * L(vec2(0, -1)) - L(vec2(1, -1));
  float e = length(vec2(gx, gy)) * 0.25;
  fragColor = vec4(t, e, 0.0, 1.0);
}`,bits:`
uniform sampler2D u_tone;
uniform sampler2D u_pat;
uniform sampler2D u_lut;
uniform float u_levels; // tone levels in the atlas, 8 px each
float levelFor(float coverage) {
  float i = floor(saturate(coverage) * 255.0 + 0.5);
  return floor(texture(u_lut, vec2((i + 0.5) / 256.0, 0.5)).r * 255.0 + 0.5);
}
vec2 toneAt(vec2 px) { return texture(u_tone, (px + 0.5) / u_resolution).rg; }
void main() {
  vec2 p = floor(gl_FragCoord.xy);
  float cover = 1.0 - toneAt(p).x;
  float k = levelFor(cover);
  // Edges: dilate the thresholded edge map by the edge width.
  bool edge = false;
  if (u_edgeMode > 0) {
    float r2 = (u_edgeWidth - 0.5) * (u_edgeWidth - 0.5) + 0.01;
    for (int j = -3; j <= 3; j++) {
      for (int i = -3; i <= 3; i++) {
        vec2 o = vec2(i, j);
        if (dot(o, o) <= r2 && toneAt(clamp(p + o, vec2(0.0), u_resolution - 1.0)).g > u_edgeThreshold) edge = true;
      }
    }
  }
  if (edge) k = u_edgeMode == 1 ? u_levels - 1.0 : levelFor(cover + 0.35);
  // Patterns are anchored to the bitmap's top-left corner.
  vec2 tp = vec2(p.x, u_resolution.y - 1.0 - p.y);
  vec2 texel = vec2(k * 8.0 + mod(tp.x, 8.0), 7.0 - mod(tp.y, 8.0));
  float ink = texture(u_pat, (texel + 0.5) / vec2(u_levels * 8.0, 8.0)).r;
  fragColor = vec4(ink, 0.0, 0.0, 1.0);
}`,main:`
uniform sampler2D u_bits;
uniform vec2 u_bitsSize;
void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 size = u_bitsSize;
  vec2 s = u_resolution / size; // render px per bitmap px
  float ink;
  if (min(s.x, s.y) >= 1.0) {
    // Sharp-bilinear upscale: crisp bitmap pixels with a one-pixel anti-aliased edge.
    vec2 f = v_uv * size - 0.5;
    vec2 fr = saturate((fract(f) - 0.5) * s + 0.5);
    ink = texture(u_bits, (floor(f) + fr + 0.5) / size).r;
  } else {
    // Bitmap finer than the render: box-filter the footprint (up to 8×8 bilinear taps).
    vec2 foot = 1.0 / u_resolution;
    int n = int(clamp(ceil(0.5 / min(s.x, s.y)), 1.0, 8.0));
    ink = 0.0;
    for (int j = 0; j < 8; j++) {
      if (j >= n) break;
      for (int i = 0; i < 8; i++) {
        if (i >= n) break;
        ink += texture(u_bits, v_uv + ((vec2(i, j) + 0.5) / float(n) - 0.5) * foot).r;
      }
    }
    ink /= float(n * n);
  }
  vec3 c = mix(u_paper, u_ink, ink);
  fragColor = vec4(mix(src.rgb, c, u_blend), src.a);
}`},render(e){let t=e.params,n=e.width,r=e.height,i=Math.max(8,Math.round(O(t,`bitmapWidth`))),a=Math.max(8,Math.round(r*i/n)),o=`pat:`+(t.patterns??[]).join(`,`),s=e.cached(o,()=>Vn(e.gl,t),e=>(e.tex.dispose(),e.lut.dispose())),c=e.pass(`down`,{width:i,height:a,uniforms:{u_outSize:[n,r]}}),l=e.blur(c,O(t,`smooth`)*.6);e.release(c);let u=e.blur(l,O(t,`radius`)),d=e.pass(`tone`,{width:i,height:a,inputs:{u_soft:l,u_wide:u}});e.release(l),e.release(u);let f=e.pass(`bits`,{width:i,height:a,inputs:{u_tone:d,u_pat:s.tex,u_lut:s.lut},uniforms:{u_levels:s.levels}});e.release(d);let p=e.pass(`main`,{inputs:{u_bits:f},uniforms:{u_bitsSize:[i,a]}});return e.release(f),p}},Un=[`Round`,`Euclidean`,`Elliptical`,`Square`,`Diamond`,`Lines`,`Cross-hatch`];function Wn(e,t,n){let r=Math.abs(t),i=Math.abs(n);switch(e){case 1:return(1-(r+i<=1?1-(r*r+i*i):(r-1)*(r-1)+(i-1)*(i-1)-1))/2;case 2:return Math.min(1,Math.sqrt(.62*r*r+1.38*i*i)/Math.SQRT2);case 3:return Math.max(r,i);case 4:return(r+i)/2;case 5:return i;case 6:return Math.min(r,i);default:return Math.sqrt(r*r+i*i)/Math.SQRT2}}function Gn(){let e=new Float32Array(256*Un.length*4);for(let t=0;t<Un.length;t++){let n=new Float64Array(256);for(let e=0;e<256;e++)for(let r=0;r<256;r++){let i=Wn(t,(r+.5)/256*2-1,(e+.5)/256*2-1);n[Math.min(255,Math.floor(i*256))]++}let r=0;for(let i=0;i<256;i++){let a=(r+n[i]*.5)/65536;r+=n[i],e.set([a,a,a,1],(t*256+i)*4)}}return e}var Kn=[{ink:4,angle:15},{ink:30,angle:75},{ink:13,angle:0},{ink:0,angle:45}];function qn(e,t){let n=`Ink ${e+1}`,r=`ink${e+1}`,i=e=>!!e[`${r}Enable`];return[y(`${r}Enable`,`Enable`,!0,{group:n}),x(`${r}Color`,`Ink`,cn,t.ink,`slider`,{group:n,visibleIf:i}),g(`${r}Angle`,`Angle`,-90,90,t.angle,.5,{group:n,unit:`°`,visibleIf:i}),S(`${r}Shift`,`Shift`,[0,0],{group:n,visibleIf:i})]}var Jn=(e,t)=>`
  if (u_ink${e}Enable) {
    vec2 sh = u_ink${e}Shift * 1.5 * cell;
    vec4 cmyk = separate(texture(u_tone, (gl_FragCoord.xy - sh) / u_resolution).rgb);
    float a = screen(gl_FragCoord.xy - sh, radians(u_ink${e}Angle), cell, cmyk.${t}, ${e}.0);
    col *= mix(vec3(1.0), risoInk(u_ink${e}Color), a * u_inkDensity);
  }`,Yn={id:`halftone-screen`,name:`Halftone screen`,category:`Effects`,keywords:`dot filter halftone pattern photo print retro screen cmyk offset rosette ink`,params:[x(`dotShape`,`Dot shape`,Un,0,`slider`),_(`frequency`,`Frequency`,10,300,80),b(`paperColor`,`Paper color`,`#eff1f5`),g(`blackGeneration`,`Black generation`,0,1,.5,.01,{group:`Separation`}),g(`totalInk`,`Total ink`,200,400,300,5,{group:`Separation`,unit:`%`}),g(`dotGain`,`Dot gain`,0,.4,.05,.01,{group:`Press`}),g(`inkDensity`,`Ink density`,0,1,1,.01,{group:`Press`}),g(`edgeRoughness`,`Edge roughness`,0,1,.3,.01,{group:`Press`}),_(`seed`,`Seed`,0,100,0,{group:`Press`}),...Kn.flatMap((e,t)=>qn(t,e))],shaders:{down2:an,main:`
${ln}
uniform sampler2D u_tone; // slightly blurred source (tone per dot, not per pixel)
uniform sampler2D u_cdf;  // spot value → area fraction, one row per shape

float spotValue(int shape, vec2 f) {
  float a = abs(f.x), b = abs(f.y);
  if (shape == 1) {
    float ps = a + b <= 1.0 ? 1.0 - (a * a + b * b) : (a - 1.0) * (a - 1.0) + (b - 1.0) * (b - 1.0) - 1.0;
    return (1.0 - ps) * 0.5;
  }
  if (shape == 2) return min(1.0, sqrt(0.62 * a * a + 1.38 * b * b) / 1.41421356);
  if (shape == 3) return max(a, b);
  if (shape == 4) return (a + b) * 0.5;
  if (shape == 5) return b;
  if (shape == 6) return min(a, b);
  return length(f) / 1.41421356;
}

// C, M, Y, K with gray component replacement and a total ink limit.
vec4 separate(vec3 rgb) {
  vec3 cmy = 1.0 - pow(saturate(rgb), vec3(1.2));
  float k = u_blackGeneration * min(cmy.x, min(cmy.y, cmy.z));
  cmy = (cmy - k) / max(1.0 - k, 1e-4);
  float lim = u_totalInk / 100.0;
  float sum = cmy.x + cmy.y + cmy.z;
  if (sum + k > lim) cmy *= max(lim - k, 0.0) / max(sum, 1e-4);
  return vec4(cmy, k);
}

float plateThreshold(vec2 px, float ang, float cell, float seed) {
  vec2 p = rot2(-ang) * px / cell;
  vec2 f = fract(p) * 2.0 - 1.0;
  float s = spotValue(u_dotShape, f);
  float thr = texture(u_cdf, vec2((s * 255.0 + 0.5) / 256.0, (float(u_dotShape) + 0.5) / 7.0)).r;
  // Press: ragged dot edges.
  vec2 q = px / max(cell * 0.3, 1.5) + seed * 19.7 + float(u_seed) * 7.31;
  return thr + (valueNoise(q) + 0.5 * valueNoise(q * 2.3) - 0.75) * u_edgeRoughness * 0.12;
}

// Ink coverage (0..1) of one screened plate at pixel px, 4× supersampled (rotated grid).
float screen(vec2 px, float ang, float cell, float tone, float seed) {
  // Dot gain: mid-tones grow most.
  float t = saturate(tone + u_dotGain * 4.0 * tone * (1.0 - tone));
  float w = clamp(fwidth(plateThreshold(px, ang, cell, seed)), 1e-3, 0.25);
  float a = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(i == 0 ? 0.125 : i == 1 ? 0.375 : i == 2 ? -0.125 : -0.375, i == 0 ? 0.375 : i == 1 ? -0.125 : i == 2 ? -0.375 : 0.125);
    float thr = plateThreshold(px + o, ang, cell, seed);
    a += smoothstep(thr - w * 0.35, thr + w * 0.35, t);
  }
  a *= 0.25;
  // Cells smaller than ~2 px can't hold a dot: fade to the flat tint.
  return mix(t, a, smoothstep(1.2, 2.5, cell));
}

void main() {
  vec4 src = texture(u_input, v_uv);
  float cell = u_resolution.y / u_frequency;
  vec3 col = u_paperColor;
${Jn(1,`x`)}
${Jn(2,`y`)}
${Jn(3,`z`)}
${Jn(4,`w`)}
  fragColor = vec4(col, src.a);
}`},render(e){let t=e.cached(`cdf`,()=>Ie(e.gl,Gn(),256,Un.length),e=>e.dispose()),n=Math.max(1,O(e.params,`frequency`)),r=e.height/n,i=on(e,e.input,e.width*n*6/e.height,n*6),a=e.blur(i,r*.22*i.height/e.height);i!==e.input&&e.release(i);let o=e.pass(`main`,{inputs:{u_tone:a,u_cdf:t}});return e.release(a),o}},Xn={id:`emboss`,name:`Emboss`,category:`Effects`,keywords:`detection edge emboss metallic relief texture`,animated:!0,params:[g(`scale`,`scale`,0,10,4,.1),_(`material`,`color`,0,dn-1,30),S(`lightDirection`,`light direction`,[0,0]),S(`lightAnimation`,`light animation`,[0,0]),S(`shadowDirection`,`shadow direction`,[.15,-.15]),y(`lockShadow`,`lock shadow`,!1),g(`shadowIntensity`,`shadow intensity`,0,2,.5,.1),g(`shadowBlur`,`shadow blur`,0,10,0,.5),g(`highlightIntensity`,`highlight intensity`,0,2,.3,.1),g(`highlightDistance`,`highlight distance`,0,20,2,.5),g(`gradientStrength`,`gradient strength`,0,1,.2),g(`depthDarkening`,`depth darkening`,0,1,.3)],shaders:{main:`
${fn}
uniform sampler2D u_relief; // input, prefiltered to the reference scale on large renders
uniform sampler2D u_soft;   // blurred input for the cast shadow
// Height: dark = raised (like ink pressed into the surface), which is how effect.app's relief reads.
float H(vec2 uv) { return 1.0 - luma(texture(u_relief, uv).rgb); }
float Hs(vec2 uv) { return 1.0 - luma(texture(u_soft, uv).rgb); }
void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 tx = 1.0 / u_resolution;
  float t = u_time;
  // Light: azimuth / elevation offsets from a 135° (top-left), 45° light; animation spins / bobs it.
  float az = radians(135.0) + u_lightDirection.x * PI + u_lightAnimation.x * t * 2.0;
  float el = radians(45.0) + u_lightDirection.y * radians(44.0) + u_lightAnimation.y * sin(t * 1.7) * radians(35.0);
  el = clamp(el, radians(2.0), radians(90.0));
  vec3 L = vec3(cos(el) * cos(az), cos(el) * sin(az), sin(el));
  vec2 L2 = normalize(vec2(cos(az), sin(az)));

  // Relief normal from the luminance gradient over ±1 reference px.
  float d = u_pxScale;
  float h = H(v_uv);
  float hx = H(v_uv + vec2(d, 0.0) * tx) - H(v_uv - vec2(d, 0.0) * tx);
  float hy = H(v_uv + vec2(0.0, d) * tx) - H(v_uv - vec2(0.0, d) * tx);
  vec3 n = normalize(vec3(-vec2(hx, hy) * u_scale * 0.45, 1.0));
  int id = int(u_material + 0.5);
  vec3 col = srgbToLinear(shadeMaterial(id, n, L));

  // Cast shadow: higher ground toward the light occludes this point.
  vec2 sdir = u_lockShadow ? -L2 * max(length(u_shadowDirection), 0.05) : u_shadowDirection;
  vec2 so = sdir * 20.0 * u_pxScale * tx;
  float sh = saturate((Hs(v_uv - so) - Hs(v_uv)) * 2.5);
  col *= 1.0 - saturate(u_shadowIntensity * sh);

  // Rim highlight: this point is higher than its neighbour toward the light.
  vec2 ho = L2 * u_highlightDistance * u_pxScale * tx;
  float hl = saturate((h - H(v_uv + ho)) * 2.5);
  col += u_highlightIntensity * hl * srgbToLinear(MAT_LIT[clamp(id, 0, ${dn-1})]) * 0.5;

  // Broad lighting gradient across the surface and darker low areas.
  // (The surface is lit "through" the relief, so the broad gradient brightens away from the light.)
  col *= 1.0 + u_gradientStrength * 0.7 * saturate(0.5 - dot(centered(v_uv, u_resolution), L2));
  col *= 1.0 - u_depthDarkening * h * 0.6;
  fragColor = vec4(linearToSrgb(max(col, 0.0)), src.a);
}`},render(e){let t=.5*Math.sqrt(Math.max(e.pxScale*e.pxScale-1,0)),n=t>=.35?e.blur(e.input,t):e.input,r=Math.hypot(O(e.params,`shadowBlur`)*e.pxScale,t),i=r>=.35?e.blur(e.input,r):e.input,a=e.pass(`main`,{inputs:{u_relief:n,u_soft:i}});return n!==e.input&&e.release(n),i!==e.input&&e.release(i),a}},Zn=[`Round`,`Linear`,`Smooth`,`Cove`,`Ridge`,`Dome`,`Bulge`,`Scoop`,`Silk`,`Cone`,`Shelf`,`Bump`,`Rings`,`Steps`,`Ripple`,`Waves`,`Teeth`,`Scales`,`Flat`],Qn=[`Normal`,`Multiply`,`Screen`,`Overlay`,`Soft light`,`Hard light`,`Vivid light`,`Linear light`,`Color dodge`,`Color burn`,`Lighten`,`Darken`,`Emboss`],$n=[0,2,6,9,10,11,12,13,7,3,5,1,-1],er=384,tr={id:`bevel`,name:`Bevel`,category:`Effects`,keywords:`bevel emboss metallic relief texture`,params:[x(`shapeFrom`,`shape from`,[`Luma`,`Alpha`],0,`switcher`),g(`threshold`,`threshold`,.01,.99,.01),y(`invertMask`,`invert mask`,!1),_(`size`,`size`,1,1e3,40,{unit:`px`}),_(`procResolution`,`resolution`,256,4096,4096,{step:32}),g(`depth`,`depth`,0,4,4,.05),x(`direction`,`direction`,[`Inner`,`Outer`,`Both`],2,`switcher`),x(`profile`,`Profile`,Zn,0,`slider`),_(`material`,`material`,0,dn-1,2,{group:`Surface`}),S(`lightDirection`,`light direction`,[0,0],{group:`Surface`}),x(`blend`,`Blend`,Qn,0,`slider`,{group:`Surface`}),g(`opacity`,`opacity`,0,1,1,.01,{group:`Surface`}),g(`innerFill`,`inner fill`,0,1,1,.01,{group:`Surface`}),g(`outerFill`,`outer fill`,0,1,0,.01,{group:`Surface`})],shaders:{down2:an,mask:`
void main() {
  vec2 o = 0.25 / u_resolution;
  vec4 c = (texture(u_input, v_uv + vec2(-o.x, -o.y)) + texture(u_input, v_uv + vec2(o.x, -o.y))
          + texture(u_input, v_uv + vec2(-o.x, o.y)) + texture(u_input, v_uv + vec2(o.x, o.y))) * 0.25;
  float v = u_shapeFrom == 0 ? luma(c.rgb) * (c.a > 0.0 ? 1.0 : 0.0) : c.a;
  float m = smoothstep(u_threshold - 0.01, u_threshold + 0.01, v);
  if (u_invertMask) m = 1.0 - m;
  fragColor = vec4(m, 0.0, 0.0, 1.0);
}`,seed:`
uniform sampler2D u_mask;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(u_mask, 0);
  float m = texelFetch(u_mask, p, 0).r;
  bool inside = m >= 0.5;
  vec2 best = vec2(1e4);
  for (int k = 0; k < 4; k++) {
    ivec2 d = k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1);
    ivec2 q = p + d;
    if (any(lessThan(q, ivec2(0))) || any(greaterThanEqual(q, size))) continue;
    float mq = texelFetch(u_mask, q, 0).r;
    if ((mq >= 0.5) != inside) {
      float f = clamp((m - 0.5) / (m - mq), 0.0, 1.0);
      vec2 off = vec2(d) * f;
      if (dot(off, off) < dot(best, best)) best = off;
    }
  }
  fragColor = vec4(best, m, 1.0);
}`,jfa:`
uniform sampler2D u_src;
uniform float u_step;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(u_src, 0);
  vec4 self = texelFetch(u_src, p, 0);
  vec2 best = self.xy;
  float bd = dot(best, best);
  int s = int(u_step);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) continue;
      ivec2 q = p + ivec2(i, j) * s;
      if (any(lessThan(q, ivec2(0))) || any(greaterThanEqual(q, size))) continue;
      vec2 o = texelFetch(u_src, q, 0).xy;
      if (o.x > 9000.0) continue;
      vec2 c = o + vec2(q - p);
      float dd = dot(c, c);
      if (dd < bd) { bd = dd; best = c; }
    }
  }
  fragColor = vec4(best, self.z, 1.0);
}`,height:`
uniform sampler2D u_src;
uniform float u_sizeP;
float profile(int k, float t) {
  t = saturate(t);
  if (k == 0) return sqrt(max(0.0, 1.0 - (1.0 - t) * (1.0 - t)));                // Round
  if (k == 1) return t;                                                          // Linear
  if (k == 2) return t * t * (3.0 - 2.0 * t);                                    // Smooth
  if (k == 3) return 1.0 - sqrt(max(0.0, 1.0 - t * t));                          // Cove
  if (k == 4) return t < 0.5 ? smoothstep(0.0, 0.5, t) : 1.0 - 0.45 * smoothstep(0.5, 1.0, t); // Ridge
  if (k == 5) return pow(sin(t * PI * 0.5), 0.6);                                // Dome
  if (k == 6) return t + 0.45 * sin(t * PI);                                     // Bulge
  if (k == 7) return t * t;                                                      // Scoop
  if (k == 8) { float s = t * t * (3.0 - 2.0 * t); return s * s * (3.0 - 2.0 * s); } // Silk
  if (k == 9) return 1.0 - abs(1.0 - 2.0 * t);                                   // Cone
  if (k == 10) return 0.5 * smoothstep(0.0, 0.3, t) + 0.5 * smoothstep(0.65, 0.95, t); // Shelf
  if (k == 11) return t * t * (3.0 - 2.0 * t) + 0.3 * sin(t * PI) * sin(t * PI); // Bump
  if (k == 12) return t + 0.12 * sin(t * PI * 6.0) * (1.0 - t);                  // Rings
  if (k == 13) return (floor(t * 4.0) + smoothstep(0.3, 0.7, fract(t * 4.0))) / 4.0; // Steps
  if (k == 14) return t + 0.08 * sin(t * PI * 10.0);                             // Ripple
  if (k == 15) return 0.5 - 0.5 * cos(t * PI * 3.0);                             // Waves
  if (k == 16) return t >= 1.0 ? 1.0 : fract(t * 3.0);                         // Teeth
  if (k == 17) return abs(sin(t * PI * 2.5));                                    // Scales
  return 1.0;                                                                    // Flat
}
uniform float u_fromBlur; // 1: u_src is a gaussian-blurred mask (no float targets), sigma = u_sigma
uniform float u_sigma;
void main() {
  vec4 j = texelFetch(u_src, ivec2(gl_FragCoord.xy), 0);
  float sd;
  if (u_fromBlur > 0.5) {
    // Blurred straight edge = normal CDF of the distance: invert it (logistic approximation).
    float v = clamp(j.r, 1e-3, 1.0 - 1e-3);
    sd = u_sigma * log(v / (1.0 - v)) / 1.702;
  } else {
    float d = j.x > 9000.0 ? 1e4 : length(j.xy);
    sd = j.z >= 0.5 ? d : -d;
  }
  float t;
  if (u_direction == 0) t = sd / u_sizeP;
  else if (u_direction == 1) t = (sd + u_sizeP) / u_sizeP;
  else t = (sd + 0.5 * u_sizeP) / u_sizeP;
  float h = (u_direction == 0 && sd < 0.0) ? 0.0 : profile(u_profile, t);
  // Normalized so it also fits 8-bit targets: profile height, signed distance in ±2 bevel sizes.
  fragColor = vec4(h, saturate(sd / (4.0 * u_sizeP) + 0.5), 0.0, 1.0);
}`,normal:`
uniform sampler2D u_height;
uniform float u_sizeP;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 m = textureSize(u_height, 0) - 1;
  float k = u_sizeP * u_depth * 0.3; // profile units → processing px of height
  float gx = (texelFetch(u_height, min(p + ivec2(1, 0), m), 0).r - texelFetch(u_height, max(p - ivec2(1, 0), 0), 0).r) * 0.5 * k;
  float gy = (texelFetch(u_height, min(p + ivec2(0, 1), m), 0).r - texelFetch(u_height, max(p - ivec2(0, 1), 0), 0).r) * 0.5 * k;
  vec3 n = normalize(vec3(-gx, -gy, 1.0));
  fragColor = vec4(n.xy * 0.5 + 0.5, texelFetch(u_height, p, 0).g, 1.0);
}`,main:`
${fn}
uniform sampler2D u_normal;
uniform float u_sizeP;
const int BLEND_MAP[${$n.length}] = int[](${$n.join(`, `)});
void main() {
  vec4 src = texture(u_input, v_uv);
  vec4 nc = texture(u_normal, v_uv);
  vec2 nxy = nc.xy * 2.0 - 1.0;
  vec3 n = vec3(nxy, sqrt(max(1.0 - dot(nxy, nxy), 0.0)));
  float az = radians(135.0) + u_lightDirection.x * PI;
  float el = clamp(radians(50.0) + u_lightDirection.y * radians(45.0), radians(3.0), radians(90.0));
  vec3 L = vec3(cos(el) * cos(az), cos(el) * sin(az), sin(el));
  int id = int(u_material + 0.5);
  vec3 shaded = shadeMaterial(id, n, L);

  // Coverage: the bevel band is always drawn, flat interior / exterior use the fill amounts.
  float sd = (nc.z - 0.5) * 4.0 * u_sizeP;
  float s = u_sizeP;
  float band, a;
  float aaw = max(1.0, 0.02 * s);
  if (u_direction == 0) {
    band = smoothstep(-aaw, 0.0, sd) * (1.0 - smoothstep(s - aaw, s, sd));
    a = sd < s * 0.5 ? mix(u_outerFill, 1.0, band) : mix(u_innerFill, 1.0, band);
  } else if (u_direction == 1) {
    band = smoothstep(-s, -s + aaw, sd) * (1.0 - smoothstep(0.0, aaw, sd));
    a = sd > -s * 0.5 ? mix(u_innerFill, 1.0, band) : mix(u_outerFill, 1.0, band);
  } else {
    band = smoothstep(-0.5 * s, -0.5 * s + aaw, sd) * (1.0 - smoothstep(0.5 * s - aaw, 0.5 * s, sd));
    a = sd > 0.0 ? mix(u_innerFill, 1.0, band) : mix(u_outerFill, 1.0, band);
  }
  if (u_profile == 18) a = sd > 0.0 ? u_innerFill : u_outerFill;
  a *= u_opacity;

  vec3 base = src.rgb;
  int mode = BLEND_MAP[clamp(u_blend, 0, ${$n.length-1})];
  vec3 top;
  if (mode < 0) top = saturate(base + (shaded - shadeMaterial(id, vec3(0.0, 0.0, 1.0), L)) * 1.5);
  else top = mode == 0 ? shaded : blendMode(mode, saturate(base), shaded);
  vec3 rgb = mix(base, top, a);
  float alpha = max(src.a, u_direction != 0 ? a * band : 0.0);
  fragColor = vec4(rgb, alpha);
}`},render(e){let t=e.params,n=e.width,r=e.height,i=Math.max(n,r),a=Math.min(1,Math.max(256,O(t,`procResolution`))/i),o=Math.max(1,O(t,`size`)*e.pxScale*a);o>er&&(a*=er/o,o=er);let s=Math.max(8,Math.round(n*a)),c=Math.max(8,Math.round(r*a)),l=e.format===`rgba16f`,u=on(e,e.input,s,c),d=e.pass(`mask`,{width:s,height:c,inputs:{u_input:u}});u!==e.input&&e.release(u);let f=o*(O(t,`direction`)===2?.5:1)+2,p;if(l){let t=e.pass(`seed`,{width:s,height:c,inputs:{u_mask:d}});e.release(d);let n=1;for(;n<f;)n*=2;let r=[];for(let e=n;e>=1;e=Math.floor(e/2))r.push(e);r.push(1);for(let n of r){let r=e.pass(`jfa`,{width:s,height:c,inputs:{u_src:t},uniforms:{u_step:n}});e.release(t),t=r}p=e.pass(`height`,{width:s,height:c,inputs:{u_src:t},uniforms:{u_sizeP:o,u_fromBlur:0}}),e.release(t)}else{let t=Math.max(1,f*.4),n=e.blur(d,t);e.release(d),p=e.pass(`height`,{width:s,height:c,inputs:{u_src:n},uniforms:{u_sizeP:o,u_fromBlur:1,u_sigma:t}}),e.release(n)}let m=e.blur(p,Math.max(1,o*.06));e.release(p);let h=e.pass(`normal`,{width:s,height:c,inputs:{u_height:m},uniforms:{u_sizeP:o}});e.release(m);let g=e.pass(`main`,{inputs:{u_normal:h},uniforms:{u_sizeP:o}});return e.release(h),g}},nr=6,rr=6,ir={id:`bloom`,name:`Bloom`,category:`Effects`,keywords:`bleed bloom cinematic dreamy glow highlights light soft`,params:[g(`threshold`,`threshold`,.1,2,.8),g(`intensity`,`intensity`,0,5,1.5),g(`knee`,`knee`,0,2,.4),g(`bloomFactor`,`bloom factor`,0,1,.6),_(`blendMode`,`blend mode`,0,1,0),_(`tonemapper`,`tonemapper`,0,7,0)],shaders:{down2:an,prefilter:`
${un}
void main() {
  vec2 o = 0.5 / u_resolution;
  vec3 c = srgbToLinear(texture(u_input, v_uv + vec2(-o.x, -o.y)).rgb) + srgbToLinear(texture(u_input, v_uv + vec2(o.x, -o.y)).rgb)
         + srgbToLinear(texture(u_input, v_uv + vec2(-o.x, o.y)).rgb) + srgbToLinear(texture(u_input, v_uv + vec2(o.x, o.y)).rgb);
  fragColor = vec4(kneeThreshold(c * 0.25, u_threshold, u_knee), 1.0);
}`,main:`

vec3 tonemap(int k, vec3 x) {
  x = max(x, 0.0);
  if (k == 1) return x / (1.0 + x);                                                     // Reinhard
  if (k == 2) { float l = luma(x); return x * (1.0 + l / 16.0) / (1.0 + l); }            // Reinhard (luminance, white 4)
  if (k == 3) return saturate((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)); // ACES (Narkowicz)
  if (k == 4) {                                                                          // ACES fitted (Hill)
    const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    vec3 v = I * x;
    v = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
    return saturate(O * v);
  }
  if (k == 5) {                                                                          // Filmic (Hable)
    vec3 a = ((x * 2.0) * (0.15 * x * 2.0 + 0.05) + 0.004) / ((x * 2.0) * (0.15 * x * 2.0 + 0.5) + 0.06) - 0.0667;
    const float W = 11.2;
    float w = ((W * (0.15 * W + 0.05) + 0.004) / (W * (0.15 * W + 0.5) + 0.06)) - 0.0667;
    return saturate(a / w);
  }
  if (k == 6) {                                                                          // AgX (base contrast)
    const mat3 A = mat3(0.842479, 0.0423282, 0.0423757, 0.0784336, 0.878469, 0.0784336, 0.0792237, 0.0791661, 0.879143);
    const mat3 Ai = mat3(1.196879, -0.0528969, -0.0529716, -0.0980209, 1.151903, -0.0980435, -0.0990297, -0.0989612, 1.151074);
    vec3 l = clamp(log2(max(A * x, 1e-10)), -12.47393, 4.026069);
    l = (l + 12.47393) / 16.499999;
    vec3 l2 = l * l, l4 = l2 * l2;
    vec3 y = 15.5 * l4 * l2 - 40.14 * l4 * l + 31.96 * l4 - 6.868 * l2 * l + 0.4298 * l2 + 0.1191 * l - 0.00232;
    return pow(max(Ai * y, 0.0), vec3(2.2));
  }
  if (k == 7) {                                                                          // Khronos PBR Neutral
    const float s0 = 0.76, d = 0.24, desat = 0.15;
    float m = min(x.r, min(x.g, x.b));
    x -= m < 0.08 ? m - 6.25 * m * m : 0.04;
    float p = max(x.r, max(x.g, x.b));
    if (p < s0) return x;
    float np = 1.0 - d * d / (p + d - s0);
    x *= np / p;
    float g = 1.0 - 1.0 / (desat * (p - np) + 1.0);
    return mix(x, vec3(np), g);
  }
  return x;
}

uniform sampler2D u_b0;
uniform sampler2D u_b1;
uniform sampler2D u_b2;
uniform sampler2D u_b3;
uniform sampler2D u_b4;
uniform sampler2D u_b5;
void main() {
  vec4 src = texture(u_input, v_uv);
  // Level weights: geometric, tilting from the tight levels (factor 0) to the wide ones (factor 1).
  float r = mix(0.35, 2.2, u_bloomFactor);
  float w0 = 1.0, w1 = r, w2 = r * r, w3 = w2 * r, w4 = w3 * r, w5 = w4 * r;
  vec3 b = texture(u_b0, v_uv).rgb * w0 + texture(u_b1, v_uv).rgb * w1 + texture(u_b2, v_uv).rgb * w2
         + texture(u_b3, v_uv).rgb * w3 + texture(u_b4, v_uv).rgb * w4 + texture(u_b5, v_uv).rgb * w5;
  b *= u_intensity * 0.3 / (w0 + w1 + w2 + w3 + w4 + w5);
  vec3 c = srgbToLinear(src.rgb);
  c = u_blendMode < 0.5 ? c + b : 1.0 - (1.0 - saturate(c)) * (1.0 - saturate(b));
  c = tonemap(int(u_tonemapper + 0.5), c);
  fragColor = vec4(linearToSrgb(c), src.a);
}`},render(e){let t=Math.max(1,Math.round(e.width/2)),n=Math.max(1,Math.round(e.height/2)),r=e.pass(`prefilter`,{width:t,height:n}),i=rr*e.pxScale,a=Math.max(2,i/2.5),o=on(e,r,e.width/a,e.height/a);o!==r&&e.release(r);let s=e.width/o.width,c=[];for(let t=0;t<nr;t++)c.push(e.blur(o,i*2**t/s));e.release(o);let l={};c.forEach((e,t)=>l[`u_b${t}`]=e);let u=e.pass(`main`,{inputs:l});for(let t of c)e.release(t);return u}},ar=60,or=[Sn,Tn,jn,Nn,Rn,Hn,Yn,Xn,tr,ir,{id:`star-glow`,name:`Star glow`,category:`Effects`,keywords:`anamorphic flare glare lens star streaks`,params:[g(`threshold`,`threshold`,0,4,.5),g(`knee`,`knee`,0,2,.05),g(`intensity`,`intensity`,0,4,.5),g(`highlightBoost`,`highlight boost`,0,1,0),_(`streaks`,`streaks`,1,8,3),_(`sampleCount`,`sample count`,10,ar,30),g(`length`,`length`,.5,200,80,.1),g(`alternate`,`alternate`,.1,1,1),g(`falloff`,`falloff`,.1,1.5,.45),_(`angleDeg`,`angle deg`,-180,180,0,{unit:`°`}),g(`colorize`,`Colorize`,0,1,1),T(`gradientMap`,`Gradient map`,[{pos:0,color:`#f4f8ff`},{pos:1,color:`#79adff`}]),g(`gradientShift`,`Gradient shift`,-1,1,0)],shaders:{down2:an,prefilter:`
${un}
void main() {
  vec2 o = 0.5 / u_resolution;
  vec3 c = srgbToLinear(texture(u_input, v_uv + vec2(-o.x, -o.y)).rgb) + srgbToLinear(texture(u_input, v_uv + vec2(o.x, -o.y)).rgb)
         + srgbToLinear(texture(u_input, v_uv + vec2(-o.x, o.y)).rgb) + srgbToLinear(texture(u_input, v_uv + vec2(o.x, o.y)).rgb);
  c *= 0.25;
  vec3 b = c * kneeWeight(luma(c), u_threshold, u_knee);
  // Highlight boost: hot spots grow faster than the rest of the bright pass.
  float m = max(b.r, max(b.g, b.b));
  b *= 1.0 + u_highlightBoost * 4.0 * m;
  fragColor = vec4(b, 1.0);
}`,streak:`
uniform sampler2D u_bright;
uniform vec2 u_dir;     // streak direction in uv per sample step
// Nothing beyond the frame (clamped edge texels would smear into streaks).
float inImage(vec2 uv) { return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0); }
void main() {
  int n = int(u_sampleCount);
  float jitter = ign(gl_FragCoord.xy) - 0.5;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float k = u_falloff * 6.0;
  for (int i = 1; i <= ${ar}; i++) {
    if (i > n) break;
    float x = (float(i) + jitter * 0.5) / float(n);
    float w = exp(-x * k);
    vec2 o = u_dir * (float(i) + jitter * 0.5);
    vec3 a = texture(u_bright, v_uv + o).rgb * inImage(v_uv + o) + texture(u_bright, v_uv - o).rgb * inImage(v_uv - o);
    vec3 tint = srgbToLinear(lut3(u_gradientMap, saturate(x + u_gradientShift)));
    vec3 c = mix(a, luma(a) * tint / max(luma(tint), 0.05), u_colorize);
    acc += c * w;
    wsum += w;
  }
  fragColor = vec4(acc / max(wsum, 1e-4) * 0.5, 1.0);
}`,main:`
uniform sampler2D u_streakAcc;
uniform sampler2D u_bright;
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = srgbToLinear(src.rgb);
  vec3 s = texture(u_streakAcc, v_uv).rgb;
  c += s * u_intensity * 1.2;
  // The boosted cores also glow a little on their own.
  c += texture(u_bright, v_uv).rgb * u_highlightBoost * u_intensity;
  fragColor = vec4(linearToSrgb(c), src.a);
}`},render(e){let t=e.params,n=Math.max(1,Math.round(e.width/2)),r=Math.max(1,Math.round(e.height/2)),i=e.pass(`prefilter`,{width:n,height:r}),a=Math.max(1,Math.round(O(t,`sampleCount`))),o=O(t,`length`)*e.pxScale/a,s=Math.min(8,Math.max(2,o/1.5)),c=on(e,i,e.width/s,e.height/s);c!==i&&e.release(i);let l=e.width/c.width,u=e.blur(c,Math.max(.5,o/l*.25));e.release(c);let d=e.target(u.width,u.height),f=Math.max(1,Math.round(O(t,`streaks`))),p=O(t,`angleDeg`)*Math.PI/180;for(let n=0;n<f;n++){let r=p+n*Math.PI/f,i=o*(n%2==1?O(t,`alternate`):1);e.pass(`streak`,{target:d,blend:`add`,clear:n===0?[0,0,0,0]:void 0,inputs:{u_bright:u},uniforms:{u_dir:[Math.cos(r)*i/e.width,Math.sin(r)*i/e.height]}})}let m=e.pass(`main`,{inputs:{u_streakAcc:d,u_bright:u}});return e.release(d),e.release(u),m}}],sr=12,cr={id:`motion-trails`,name:`Motion trails`,category:`Effects`,keywords:`accumulation feedback highlights light trails threshold knee overlay motion trails`,animated:!0,params:[g(`threshold`,`threshold`,0,4,.75),g(`knee`,`knee`,0,2,.12),g(`dimming`,`dimming`,0,.5,.06,.001),S(`direction`,`direction`,[0,.5]),g(`shake`,`shake`,0,5,.15),g(`shakeSpeed`,`shake speed`,0,10,5),g(`intensity`,`intensity`,0,3,1),g(`sourceDim`,`source dim`,0,1,.75),D(`blendMode`,`Blend mode`,6)],shaders:{bright:`
void main() {
  vec3 c = srgbToLinear(texture(u_input, v_uv).rgb);
  float l = luma(c);
  float w = smoothstep(u_threshold, u_threshold + max(u_knee, 1e-3), l);
  fragColor = vec4(c * w, 1.0);
}`,accum:`
uniform sampler2D u_prev;
uniform vec2 u_shift;   // uv offset of this doubling step (2^i frames back)
uniform vec2 u_jitter;  // uv shake spread of this step (two symmetric taps)
uniform float u_gain;   // a^(2^i)
vec3 tap(vec2 q) {
  float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  return inside * texture(u_prev, q).rgb;
}
void main() {
  vec3 s = texture(u_prev, v_uv).rgb;
  vec2 q = v_uv - u_shift;
  s += u_gain * 0.5 * (tap(q + u_jitter) + tap(q - u_jitter));
  fragColor = vec4(s, 1.0);
}`,main:`
uniform sampler2D u_trail;
uniform float u_norm;
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 base = linearToSrgb(srgbToLinear(src.rgb) * u_sourceDim);
  vec3 t = texture(u_trail, v_uv).rgb * u_norm;
  vec3 glow = linearToSrgb(1.0 - exp(-0.64 * u_intensity * t));
  vec3 c = blendMode(u_blendMode, saturate(base), saturate(glow));
  fragColor = vec4(c, src.a);
}`},render(e){let t=e.params,n=t.direction??[0,.5],r=Math.min(1,Math.max(0,1-O(t,`dimming`))),i=[n[0]*3*e.pxScale,n[1]*3*e.pxScale],a=Math.hypot(i[0],i[1]),o=Math.hypot(e.width,e.height),s=r<1?Math.log(.005)/Math.log(Math.max(r,1e-6)):1e9;a>.001&&(s=Math.min(s,1.5*o/a)),s=Math.max(1,s);let c=Math.min(sr,Math.ceil(Math.log2(s))),l=2**c,u=O(t,`shake`)*e.pxScale,d=e.time*O(t,`shakeSpeed`),f=e.pass(`bright`);for(let t=0;t<c;t++){let n=2**t,a=u*Math.sqrt(n),o=ur(d+t*17.3)*Math.PI*4,s=a*Math.cos(o),c=a*Math.sin(o),l=e.pass(`accum`,{inputs:{u_prev:f},uniforms:{u_shift:[i[0]*n/e.width,i[1]*n/e.height],u_jitter:[s/e.width,c/e.height],u_gain:r**n}});e.release(f),f=l}let p=r<1?(1-r)/Math.max(1e-6,1-r**l):1/l,m=e.pass(`main`,{inputs:{u_trail:f},uniforms:{u_norm:p}});return e.release(f),m}};function lr(e){let t=Math.sin(e*127.1+311.7)*43758.5453;return t-Math.floor(t)}function ur(e){let t=Math.floor(e),n=e-t,r=n*n*(3-2*n);return lr(t)*(1-r)+lr(t+1)*r}var dr={id:`led-screen`,name:`LED screen`,category:`Effects`,keywords:`billboard digital display grid led matrix pixel screen`,params:[g(`pixelSize`,`pixel size`,0,10,2.82),g(`gap`,`gap`,0,.2,0),g(`pixelBlur`,`pixel blur`,0,5,.6),y(`rgbMode`,`RGB mode`,!0),y(`transparent`,`transparent`,!1)],shaders:{main:`
// Soft indicator of [a, b] with edge width s (adjacent intervals sum to 1).
float band(float x, float a, float b, float s) {
  return smoothstep(a - 0.5 * s, a + 0.5 * s, x) - smoothstep(b - 0.5 * s, b + 0.5 * s, x);
}
// Same, repeated with period 1 (tails of the neighbouring cells, which reach 2 cells at max blur).
float bandP(float x, float a, float b, float s) {
  float m = 0.0;
  for (int k = -2; k <= 2; k++) m += band(x, a + float(k), b + float(k), s);
  return m;
}
// Rounded square LED (corner radius r) covering [g, 1 - g], soft edge width s.
float roundMask(vec2 f, float g, float r, float s) {
  vec2 q = abs(f - 0.5) - (0.5 - g - r);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  return 1.0 - smoothstep(-0.5 * s, 0.5 * s, d);
}
uniform sampler2D u_soft;  // input pre-blurred by ~cell/6 so 16 taps give a stable cell mean
float cellSize(vec2 res) { return max(u_pixelSize * 0.01055 * min(res.x, res.y), 3.0); }
void main() {
  vec2 res = u_resolution;
  float cell = cellSize(res);
  vec2 g = (v_uv - 0.5) * res / cell;
  vec2 id = floor(g);
  vec2 f = g - id;
  // Cell average (4x4 taps, identical for every pixel of the cell).
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 4; j++)
    for (int i = 0; i < 4; i++) {
      vec2 q = (id + (vec2(i, j) + 0.5) * 0.25) * cell / res + 0.5;
      acc += texture(u_soft, clamp(q, 0.0, 1.0));
    }
  vec4 col = acc / 16.0;
  float px = 1.0 / cell;  // one output pixel in cell units
  float s = max(u_pixelBlur * 0.36, px);
  float gp = 0.5 * u_gap;
  vec3 c;
  float cover;
  if (u_rgbMode) {
    float w = (1.0 - 2.0 * gp) / 3.0;
    float row = bandP(f.y, gp + 0.04, 1.0 - gp - 0.04, s);
    float mr = bandP(f.x, gp, gp + w, s);
    float mb = bandP(f.x, gp + w, gp + 2.0 * w, s);
    float mg = bandP(f.x, gp + 2.0 * w, 1.0 - gp, s);
    c = vec3(mr, mg, mb) * row * col.rgb;
    cover = saturate(mr + mg + mb) * row;
  } else {
    float m = roundMask(f, gp + 0.04, 0.12, s);
    c = col.rgb * m;
    cover = m;
  }
  if (u_transparent) fragColor = vec4(cover > 1e-4 ? c / cover : vec3(0.0), cover * col.a);
  else fragColor = vec4(c, col.a);
}`},render(e){let t=Math.max(O(e.params,`pixelSize`)*.01055*Math.min(e.width,e.height),3),n=e.blur(e.input,t/6),r=e.pass(`main`,{inputs:{u_soft:n}});return e.release(n),r}};function fr(e,t){return Math.max(e,t)/720}var pr=4096,mr=.148,hr=`
uniform float u_unit;      // working pixels per reference pixel
uniform vec2 u_work;       // working texture size
float lineIndex(float row) { return floor((row + 0.5) / u_work.y * 480.0); }
float frameIndex() { return floor(u_time * 29.97); }
// Subcarrier phase at working column x (pixel center). Same on every line (vertically coherent
// cross-color, as on effect.app), advancing a quarter turn per frame (dot crawl).
float carrierPhase(float x) {
  return TAU * ${mr} * (x + 0.5) / u_unit + PI * (1.0 + 0.5 * mod(frameIndex(), 4.0));
}
`,gr={id:`ntsc`,name:`NTSC`,category:`Effects`,keywords:`analog bleed color distortion filter ntsc retro scanlines vhs tv`,animated:!0,params:[_(`ringing`,`ringing`,5,30,20),g(`encoding`,`encoding`,.5,5,1,.1),g(`noise`,`noise`,0,1,.01),g(`saturation`,`saturation`,0,5,2,.1),g(`smear`,`smear`,-.2,.2,0),g(`fringes`,`fringes`,1,20,1,.5),g(`color1`,`color 1`,1,20,8,.5),g(`color2`,`color 2`,1,20,11,.5)],shaders:{encode:`
${hr}
uniform sampler2D u_src;  // input, pre-blurred when the working res is lower
void main() {
  vec2 ij = floor(gl_FragCoord.xy);
  float v = (ij.y + 0.5) / u_work.y;
  // Box-filter the input over this working pixel's horizontal footprint.
  vec3 rgb = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float u = (ij.x + (float(k) + 0.5) / 3.0) / u_work.x;
    rgb += texture(u_src, vec2(u, v)).rgb;
  }
  vec3 yiq = rgb2yiq(saturate(rgb / 3.0));
  float ph = carrierPhase(ij.x);
  float comp = yiq.x + yiq.y * cos(ph) + yiq.z * sin(ph);
  // Composite noise on a fixed raster (1 reference px × 1/480 of the height, so it looks the same at any
  // output size): white per sample plus a little per-line level noise.
  float f = frameIndex();
  float L = lineIndex(ij.y);
  float n = (hash13(vec3(floor((ij.x + 0.5) / u_unit), L, f)) - 0.5) * 6.0 + (hash12(vec2(L, f + 7.0)) - 0.5) * 1.5;
  n *= u_noise;
  comp += n;
  // Stored range-safe for 8-bit targets: composite and luma scaled, I/Q offset.
  fragColor = vec4(comp * 0.5 + 0.25, (yiq.x + n) * 0.5 + 0.25, yiq.y * 0.8 + 0.5, yiq.z * 0.9 + 0.5);
}`,decode:`
${hr}
uniform sampler2D u_enc;
uniform sampler2D u_taps;  // per-tap weights: luma, I, Q, smear (each normalized)
uniform int u_radius;      // taps on each side
uniform float u_smearMix;
const vec2 EDGE_TINT = vec2(0.0, 0.2);
void main() {
  ivec2 ij = ivec2(gl_FragCoord.xy);
  int W = int(u_work.x);
  float yd = 0.0, yc = 0.0, ys = 0.0;
  vec2 cd = vec2(0.0), cc = vec2(0.0);
  // Subcarrier at the first tap, then rotated one working pixel per tap.
  float ph0 = carrierPhase(float(ij.x - u_radius));
  vec2 rot = vec2(cos(ph0), sin(ph0));
  float dph = TAU * ${mr} / u_unit;
  vec2 step1 = vec2(cos(dph), sin(dph));
  for (int i = 0; i < 257; i++) {
    if (i > 2 * u_radius) break;
    int x = ij.x - u_radius + i;
    float comp, yClean;
    vec2 iqClean, demod;
    if (x >= 0 && x < W) {
      vec4 e = texelFetch(u_enc, ivec2(x, ij.y), 0);
      comp = (e.x - 0.25) * 2.0;
      yClean = (e.y - 0.25) * 2.0;
      iqClean = vec2((e.z - 0.5) / 0.8, (e.w - 0.5) / 0.9);
      demod = comp * 2.0 * rot;      // demodulate (I with cos, Q with sin)
    } else {
      // Outside the active line: super-white luma (bright, ringing picture edges as on effect.app);
      // the chroma path sees the edge pixel re-modulated (no luma leak from the cut-off window) plus a
      // faint magenta, so edges look the same whatever the picture width.
      vec4 e = texelFetch(u_enc, ivec2(clamp(x, 0, W - 1), ij.y), 0);
      float ye = (e.y - 0.25) * 2.0;
      vec2 iqe = vec2((e.z - 0.5) / 0.8, (e.w - 0.5) / 0.9);
      comp = 1.25;
      yClean = 1.25;
      iqClean = iqe + EDGE_TINT;
      demod = 2.0 * (ye + dot(iqe, rot)) * rot + EDGE_TINT;
    }
    vec4 w = texelFetch(u_taps, ivec2(i, 0), 0);
    yd += w.x * comp;
    yc += w.x * yClean;
    cd += w.yz * demod;
    cc += w.yz * iqClean;
    ys += w.w * yClean;
    rot = vec2(rot.x * step1.x - rot.y * step1.y, rot.y * step1.x + rot.x * step1.y);
  }
  float y = yc + u_fringes * (yd - yc);
  vec2 iq = cc + u_encoding * (cd - cc);
  y = mix(y, ys, u_smearMix);
  fragColor = vec4(y * 0.5 + 0.25, iq.x * 0.8 + 0.5, iq.y * 0.9 + 0.5, 1.0);
}`,main:`
uniform sampler2D u_dec;
void main() {
  vec4 src = texture(u_input, v_uv);
  vec4 d = texture(u_dec, v_uv);
  float y = (d.x - 0.25) * 2.0;
  vec2 iq = vec2((d.y - 0.5) / 0.8, (d.z - 0.5) / 0.9) * (u_saturation * 0.5);
  fragColor = vec4(saturate(yiq2rgb(vec3(y, iq))), src.a);
}`},render(e){let t=e.params,n=Math.max(e.width,e.height),r=Math.min(n,1440),i=r/720,a=Math.max(8,Math.round(e.width*r/n)),o=Math.max(8,Math.min(e.height,pr)),s={u_unit:i,u_work:[a,o]},c=e.width/a,l=e.height/o,u=c>1.5||l>1.5?e.blur(e.input,c>1.5?c*.4:0,l>1.5?l*.4:0):e.input,d=e.pass(`encode`,{width:a,height:o,inputs:{u_src:u},uniforms:s});u!==e.input&&e.release(u);let f=vr(O(t,`ringing`),O(t,`color1`),O(t,`color2`),O(t,`smear`),i),p=e.cached(`ntsc-taps:${f.key}`,()=>Ie(e.gl,f.data,f.data.length/4,1,{nearest:!0}),e=>e.dispose()),m=e.pass(`decode`,{width:a,height:o,inputs:{u_enc:d,u_taps:p},uniforms:{...s,u_radius:f.radius,u_smearMix:f.smearMix}});e.release(d);let h=e.pass(`main`,{inputs:{u_dec:m}});return e.release(m),h}},_r=e=>Math.abs(e)<1e-6?1:Math.sin(Math.PI*e)/(Math.PI*e);function vr(e,t,n,r,i){let a=Math.max(1,e*i),o=mr*.75/i,s=Math.max(.3,40/Math.max(.5,t)*i),c=Math.max(.3,40/Math.max(.5,n)*i),l=r*40*i,u=Math.min(128,Math.ceil(Math.max(a,3*Math.max(s,c),Math.abs(l)*3))),d=2*u+1,f=new Float32Array(d*4),p=[0,0,0,0];for(let e=0;e<d;e++){let t=e-u,n=[Math.abs(t)<=a?2*o*_r(2*o*t)*_r(t/(a+1)):0,Math.exp(-t*t/(2*s*s)),Math.exp(-t*t/(2*c*c)),l!==0&&t*l<=0?Math.exp(-Math.abs(t)/Math.abs(l)):0];for(let t=0;t<4;t++)f[e*4+t]=n[t],p[t]+=n[t]}for(let e=0;e<d;e++)for(let t=0;t<4;t++)p[t]!==0&&(f[e*4+t]/=p[t]);let m=[e,t,n,r,i.toFixed(4)].join(`,`);return{data:f,radius:u,smearMix:Math.min(1,Math.abs(r)/.2),key:m}}var yr={id:`rgb-shift`,name:`RGB Shift`,category:`Effects`,keywords:`aberration channel chromatic color glitch look retro rgb shift vhs tv`,params:[g(`redOffset`,`red offset`,-.2,.2,.2,.001),g(`blueOffset`,`blue offset`,-.2,.2,.2,.001),g(`stretch`,`stretch ratio`,-2,2,1.3),S(`center`,`aberration center`,[-1,0])],shaders:{main:`
void main() {
  vec2 c = pointToUv(u_center);
  vec2 k = 0.1 * vec2(exp(u_stretch), exp(-u_stretch));
  vec2 d = v_uv - c;
  vec4 g = texture(u_input, v_uv);
  float r = texture(u_input, c + d * (1.0 + u_redOffset * k)).r;
  float b = texture(u_input, c + d * (1.0 + u_blueOffset * k)).b;
  fragColor = vec4(r, g.g, b, g.a);
}`}},br={id:`crt-screen`,name:`CRT screen`,category:`Effects`,keywords:`crt look monitor old retro scanlines screen vhs tv`,params:[g(`distance`,`distance`,1.5,10,2),g(`curvature`,`curvature`,.01,.7,.2),g(`bezel`,`bezel`,0,1,.02),g(`vignette`,`vignette`,0,10,6),b(`bg`,`bg`,`#000000`),g(`bgOpacity`,`bgOpacity`,0,1,1),y(`phosphorDots`,`phosphor dots`,!0),g(`density`,`density`,0,10,4.5),g(`size`,`size`,0,.5,.4),g(`dotSoftness`,`dot softness`,.001,.5,.101),g(`gamma`,`gamma correction`,.1,10,2.8),g(`brightness`,`brightness gain`,0,10,1)],shaders:{main:`
const float SQ3 = 1.7320508;

// Output pixel -> picture coordinates (same units: long half side = 1). Returns false if the ray misses.
bool tubeMap(vec2 p, out vec2 s) {
  float R = 1.0 / u_curvature;
  float D = u_distance;
  vec3 ro = vec3(0.0, 0.0, -D);
  vec3 rd = normalize(vec3(p, D));
  vec3 oc = ro - vec3(0.0, 0.0, R);
  float b = dot(oc, rd);
  float h = b * b - (dot(oc, oc) - R * R);
  if (h < 0.0) return false;
  vec3 hit = ro + (-b - sqrt(h)) * rd;
  float r = length(hit.xy);
  s = r > 1e-6 ? hit.xy * (R * asin(min(r / R, 1.0)) / r) : hit.xy;
  return true;
}

// Sum of the dots of one channel around q (lattice units: neighbouring dots are 1 apart).
vec3 phosphor(vec2 q, float aa) {
  // Lattice basis e1 = (1, 0), e2 = (1/2, sqrt3/2); the dot at i e1 + j e2 has color (i - j) mod 3.
  float jf = q.y / (0.5 * SQ3);
  float j0 = floor(jf);
  float i0 = floor(q.x - 0.5 * jf);
  vec3 m = vec3(0.0);
  float r0 = u_size - 0.5 * u_dotSoftness - aa;
  float r1 = u_size + 0.5 * u_dotSoftness + aa;
  for (int dj = -1; dj <= 2; dj++)
    for (int di = -1; di <= 2; di++) {
      float i = i0 + float(di), j = j0 + float(dj);
      vec2 c = vec2(i + 0.5 * j, 0.5 * SQ3 * j);
      float w = 1.0 - smoothstep(r0, r1, length(q - c));
      int k = int(mod(i - j + 0.5, 3.0));
      if (k == 0) m.r += w; else if (k == 1) m.g += w; else m.b += w;
    }
  return min(m, 1.0);
}

void main() {
  vec2 res = u_resolution;
  float L = max(res.x, res.y);
  vec2 ext = res / L;                       // picture half extents
  vec2 p = (v_uv - 0.5) * 2.0 * ext;
  vec2 s;
  bool hitTube = tubeMap(p, s);
  // Rounded-rectangle screen mask in picture space.
  float px = 2.0 / L;                        // one output pixel in these units
  float cr = min(u_bezel * 1.8, min(ext.x, ext.y));
  vec2 qd = abs(s) - (ext - cr);
  float sd = length(max(qd, 0.0)) + min(max(qd.x, qd.y), 0.0) - cr;
  float inside = hitTube ? 1.0 - smoothstep(-px, px, sd) : 0.0;

  vec2 suv = clamp(s / ext * 0.5 + 0.5, 0.0, 1.0);
  vec4 src = texture(u_input, suv);
  // Beam in linear light (tube gamma), gain, re-encoded with the default tube gamma 2.8.
  vec3 beam = pow(saturate(src.rgb), vec3(u_gamma)) * u_brightness;
  vec3 c = pow(beam, vec3(1.0 / 2.8));
  float vig = 16.0 * suv.x * (1.0 - suv.x) * suv.y * (1.0 - suv.y);
  c *= pow(max(vig, 1e-6), u_vignette * 0.016);
  if (u_phosphorDots && u_density > 0.0) {
    // Dot coverage is applied to the encoded value so small (sub-pixel) dots keep effect.app's
    // average brightness instead of being brightened by the gamma curve.
    float sc = 40.0 * u_density / min(ext.x, ext.y) * 0.5;  // dots per picture unit (short side = 2 min(ext))
    vec2 q = s * sc;
    float aa = px * sc * 0.7;
    c *= phosphor(q, aa);
  }
  // Composite over the background in premultiplied space (bg may be transparent).
  float a = mix(u_bgOpacity, src.a, inside);
  vec3 pm = mix(u_bg * u_bgOpacity, c * src.a, inside);
  fragColor = vec4(a > 1e-5 ? pm / a : vec3(0.0), a);
}`}},xr=e=>p.indexOf(e),Sr=[`Normal`,`Add`,`Subtract`,`Difference`,`Multiply`,`Screen`,`Overlay`,`Hard light`,`Softlight`,`Darken`],Cr=[`normal`,`linear-dodge`,`subtract`,`difference`,`multiply`,`screen`,`overlay`,`hard-light`,`soft-light`,`darken`].map(xr),wr=[`Normal`,`Add`,`Subtract`,`Difference`,`Screen`,`Multiply`,`Overlay`],Tr=[`normal`,`linear-dodge`,`subtract`,`difference`,`screen`,`multiply`,`overlay`].map(xr);function Er(e,t){return e[Math.max(0,Math.min(e.length-1,Math.round(t)||0))]}var Dr=e=>e.map((e,t)=>`${t} ${e}`).join(`, `),Or=`
vec2 shortCentered(vec2 uv, vec2 res) { return (uv - 0.5) * res / min(res.x, res.y); }
`,kr=[`Left to right`,`Top to bottom`,`Right to left`,`Bottom to top`],Ar=4096,jr=`
uniform sampler2D u_src;   // input, pre-blurred when a sample/row covers several pixels
uniform vec2 u_scanSize;   // (samples along the scan, rows across it)
uniform float u_scanLenPx; // scan length in output pixels
uniform float u_minPx;     // short side in output pixels
// Scan coordinates (t along the scan, c across it, both 0..1) to image uv.
vec2 scanToUv(float t, float c) {
  if (u_waveDirection < 0.5) return vec2(t, c);
  if (u_waveDirection < 1.5) return vec2(c, 1.0 - t);
  if (u_waveDirection < 2.5) return vec2(1.0 - t, c);
  return vec2(c, t);
}
vec2 uvToScan(vec2 uv) {
  if (u_waveDirection < 0.5) return uv;
  if (u_waveDirection < 1.5) return vec2(1.0 - uv.y, uv.x);
  if (u_waveDirection < 2.5) return vec2(1.0 - uv.x, uv.y);
  return vec2(uv.y, uv.x);
}
// Mean channel values over sample j of row c (4 taps along the scan).
vec3 sampleSignal(float j, float c) {
  vec3 s = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    float t = (j + (float(k) + 0.5) * 0.25) / u_scanSize.x;
    s += texture(u_src, scanToUv(t, c)).rgb;
  }
  return saturate(s * 0.25);
}
// Phase increment per sample (cycles) for channel values s.
vec3 increment(vec3 s) {
  vec3 perShort = u_waveScale * (0.0366 * u_signalStrength + 0.45 * u_fmSensitivity * s);
  return perShort * (u_scanLenPx / u_minPx) / u_scanSize.x;
}
`,Mr=[cr,dr,gr,yr,br,{id:`modulation`,name:`Modulation`,category:`Effects`,keywords:`abstract analog distortion experimental glitch modulation signal visuals wave`,params:[_(`samples`,`resolution`,256,2048,1024,{step:16}),_(`waveScale`,`wave scale`,10,500,420,{step:5}),g(`fmSensitivity`,`FM sensitivity`,.1,1,.25,.05),g(`signalStrength`,`signal strength`,.1,20,.2,.1),_(`waveDirection`,`wave direction`,0,3,0,{hint:Dr(kr)}),g(`phase`,`phase`,0,10,0),g(`lineWidth`,`line width`,1.05,10,1.05,.05),y(`redChannel`,`red channel`,!0),y(`greenChannel`,`green channel`,!0),y(`blueChannel`,`blue channel`,!0)],shaders:{signal:`
${jr}
void main() {
  vec2 ij = floor(gl_FragCoord.xy);
  vec3 s = sampleSignal(ij.x, (ij.y + 0.5) / u_scanSize.y);
  fragColor = vec4(fract(increment(s)), 1.0);
}`,scan:`
uniform sampler2D u_prev;
uniform int u_stride;
void main() {
  ivec2 ij = ivec2(gl_FragCoord.xy);
  vec3 v = texelFetch(u_prev, ij, 0).rgb;
  if (ij.x >= u_stride) v += texelFetch(u_prev, ij - ivec2(u_stride, 0), 0).rgb;
  fragColor = vec4(fract(v), 1.0);
}`,main:`
${jr}
uniform sampler2D u_sum;  // inclusive prefix sums of the increments, modulo 1
float lineCov(float ph, float f, float wPx) {
  // Distance to the nearest phase wrap, in pixels along the scan.
  float cyclesPerPx = max(f * u_scanSize.x / u_scanLenPx, 1e-6);
  float d = abs(fract(ph + 0.5) - 0.5) / cyclesPerPx;
  return saturate(min(wPx, 0.5 * wPx + 0.5 - d));
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 sc = uvToScan(v_uv);
  float tS = sc.x * u_scanSize.x;
  float j = min(floor(tS), u_scanSize.x - 1.0);
  float row = min(floor(sc.y * u_scanSize.y), u_scanSize.y - 1.0);
  vec3 f = increment(sampleSignal(j, (row + 0.5) / u_scanSize.y));
  vec3 incl = texelFetch(u_sum, ivec2(int(j), int(row)), 0).rgb;
  // Phase at this point: exclusive prefix + partial sample, plus the global phase offset.
  vec3 ph = incl - f + f * (tS - j) + u_phase / TAU;
  float w = u_lineWidth * u_pxScale;
  vec3 c = vec3(
    u_redChannel ? lineCov(ph.r, f.r, w) : 0.0,
    u_greenChannel ? lineCov(ph.g, f.g, w) : 0.0,
    u_blueChannel ? lineCov(ph.b, f.b, w) : 0.0);
  fragColor = vec4(c, src.a);
}`},render(e){let t=e.params,n=Math.round(O(t,`waveDirection`)),r=n===0||n===2,i=r?e.width:e.height,a=r?e.height:e.width,o=Math.max(16,Math.round(O(t,`samples`))),s=Math.min(a,Ar),c={u_scanSize:[o,s],u_scanLenPx:i,u_minPx:Math.min(e.width,e.height)},l=i/o*.4,u=a/s*.4,d=l>.6||u>.6,f=d?e.blur(e.input,r?l:u,r?u:l):e.input,p=e.pass(`signal`,{width:o,height:s,inputs:{u_src:f},uniforms:c});for(let t=1;t<o;t*=2){let n=e.pass(`scan`,{width:o,height:s,inputs:{u_prev:p},uniforms:{u_stride:t}});e.release(p),p=n}let m=e.pass(`main`,{inputs:{u_sum:p,u_src:f},uniforms:c});return e.release(p),d&&e.release(f),m}},{id:`threshold`,name:`Threshold`,category:`Effects`,keywords:`black contrast detection edge graphic high posterization threshold white`,params:[_(`threshold`,`threshold`,0,255,128),y(`edgeMode`,`edge mode`,!1),_(`offsetAmount`,`offset amount`,0,10,0),_(`distance`,`distance`,1,50,1),_(`outline`,`outline`,0,10,0),g(`outlineStrength`,`outline strength`,0,1,1),_(`outlineType`,`outline type`,0,2,0,{hint:Dr([`Outer`,`Inner`,`Center`])}),g(`blendStrength`,`blend strength`,0,1,1),_(`blendMode`,`blend mode`,0,6,5,{hint:Dr(wr)}),b(`color`,`color`,`#000000`)],uniforms:e=>({u_libMode:Er(Tr,O(e,`blendMode`))}),shaders:{luma:`
void main() {
  float l = luma601(saturate(texture(u_input, v_uv).rgb));
  fragColor = vec4(l, l, l, 1.0);
}`,mask:`
uniform sampler2D u_luma;
uniform sampler2D u_mean;
uniform bool u_adaptive;
void main() {
  float l = texture(u_luma, v_uv).r;
  float t = u_threshold / 255.0;
  float ink;
  if (u_adaptive) {
    float m = texture(u_mean, v_uv).r;
    float hp = (l - m) * 4.0 + 0.5 + u_offsetAmount * 0.02;
    ink = step(hp, t - 1e-4);
  } else {
    ink = step(l, t - 1e-4);
  }
  fragColor = vec4(ink, ink, ink, 1.0);
}`,main:`
uniform sampler2D u_mask;
uniform sampler2D u_maskBlur;
uniform bool u_hasOutline;
uniform int u_libMode;
void main() {
  vec4 src = texture(u_input, v_uv);
  float ink = texture(u_mask, v_uv).r;
  if (u_hasOutline) {
    // Blurred binary mask: level set b = Phi(d / sigma) for signed distance d into the ink, sigma = r / 2.
    float b = texture(u_maskBlur, v_uv).r;
    float band;
    if (u_outlineType < 0.5) band = smoothstep(0.012, 0.035, b) * (1.0 - ink);            // 0..r outside
    else if (u_outlineType < 1.5) band = (1.0 - smoothstep(0.965, 0.988, b)) * ink;       // 0..r inside
    else band = smoothstep(0.13, 0.19, b) * (1.0 - smoothstep(0.81, 0.87, b));            // r/2 each side
    ink = max(band, ink * (1.0 - u_outlineStrength));
  }
  vec3 art = mix(vec3(1.0), u_color, ink);
  vec3 c = blendMode(u_libMode, saturate(src.rgb), art);
  fragColor = vec4(mix(src.rgb, c, u_blendStrength), src.a);
}`},render(e){let t=e.params,n=re(t,`edgeMode`),r=e.pass(`luma`),i=r;n&&(i=e.blur(r,Math.max(.5,O(t,`distance`)*e.pxScale)));let a=e.pass(`mask`,{inputs:{u_luma:r,u_mean:i},uniforms:{u_adaptive:n}});i!==r&&e.release(i),e.release(r);let o=O(t,`outline`)*e.pxScale,s=o>.25,c=s?e.blur(a,o*.5):a,l=e.pass(`main`,{inputs:{u_mask:a,u_maskBlur:c},uniforms:{u_hasOutline:s}});return c!==a&&e.release(c),e.release(a),l}},{id:`vignette`,name:`Vignette`,category:`Effects`,keywords:`vignette shape oval triangle diamond rectangle hexagon octagon linear dither`,params:[x(`shape`,`shape`,[`Oval`,`Triangle`,`Diamond`,`Rectangle`,`Hexagon`,`Octagon`],0,`slider`),g(`size`,`size`,.05,2,.65),g(`anamorphism`,`anamorphism`,.25,4,1),g(`rotation`,`rotation`,-180,180,0,.1,{unit:`°`}),S(`center`,`center X`,[0,0],{step:.001}),g(`softness`,`softness`,0,1,1),g(`transparency`,`transparency`,0,1,1),b(`color`,`color`,`#000000`),x(`blendMode`,`blend mode`,Sr,0,`slider`),g(`blend`,`blend`,0,1,1),y(`dithering`,`dithering`,!0)],uniforms:e=>({u_libMode:Er(Cr,O(e,`blendMode`))}),shaders:{main:`
uniform int u_libMode;

// Gauge of a regular n-gon with edge normals at rot + k * 2pi/n, scaled so that its
// mid-radius ((inradius + circumradius) / 2) is 1. The max over the edge distances is a p-norm so
// the falloff has no creases along the corner directions (corners are rounded by ~4%).
float polyGauge(vec2 p, float n, float rot) {
  float seg = TAU / n;
  float s = 0.0;
  float m = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= n) break;
    float a = rot + seg * float(i);
    m = max(m, dot(p, vec2(cos(a), sin(a))));
  }
  for (int i = 0; i < 8; i++) {
    if (float(i) >= n) break;
    float a = rot + seg * float(i);
    s += pow(max(dot(p, vec2(cos(a), sin(a))), 0.0) / max(m, 1e-6), 16.0);
  }
  float c = cos(PI / n);
  return m * pow(s, 1.0 / 16.0) * (1.0 + c) / (2.0 * c);
}

float shapeGauge(vec2 p) {
  if (u_shape == 0) return length(p);
  if (u_shape == 1) return polyGauge(p, 3.0, PI / 6.0);  // apex up
  if (u_shape == 2) return polyGauge(p, 4.0, PI / 4.0);  // vertices on the axes
  if (u_shape == 3) return polyGauge(p, 4.0, 0.0);       // axis-aligned square
  if (u_shape == 4) return polyGauge(p, 6.0, PI / 6.0);  // flat top
  return polyGauge(p, 8.0, 0.0);
}

void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 res = u_resolution;
  vec2 p = (v_uv - pointToUv(u_center)) * res / min(res.x, res.y);
  p = rot2(radians(u_rotation)) * p;
  p.x /= u_anamorphism;
  float d = shapeGauge(p) / u_size;
  float s = max(u_softness, 1e-3);
  float t = saturate((d - (1.0 - s)) / s);
  // Keep a hard edge anti-aliased.
  float aa = fwidth(d);
  float inside = u_softness < 1e-3 ? 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d) : 1.0 - t * t;
  float amount = (1.0 - inside) * u_transparency;
  vec3 top = blendMode(u_libMode, saturate(src.rgb), u_color);
  vec3 c = mix(src.rgb, top, amount);
  c = mix(src.rgb, c, u_blend);
  if (u_dithering) c += (hash12(gl_FragCoord.xy) - 0.5) * (4.0 / 255.0) * amount * u_blend;
  fragColor = vec4(c, src.a);
}`}},{id:`stripe`,name:`Stripe`,category:`Effects`,keywords:`abstract distortion halftone illusion optical pattern scanline scanlines stripe stripes`,animated:!0,params:[_(`repetitions`,`repetitions`,5,60,33),g(`minThickness`,`minimum thickness`,.001,.1,.001,.001),g(`maxThickness`,`maximum thickness`,.1,1,1),v(`angle`,`angle`,0,360,90),g(`edgeSoftness`,`edge softness`,0,1,.5),_(`patternType`,`pattern type`,0,1,1,{hint:Dr([`Lines`,`Circles`])}),g(`animationSpeed`,`animation speed`,-5,5,0),y(`colorMode`,`color mode`,!0),g(`redShift`,`red shift`,0,1,.1),g(`greenShift`,`green shift`,0,1,0),g(`blueShift`,`blue shift`,0,1,0),y(`shift`,`shift`,!1),_(`rowShiftFreq`,`row shift freq`,1,50,8)],shaders:{main:`
${Or}
// Dark-band coverage at phase ph for a band of width th (fraction of a period) with soft edges of
// half-width s. Bands are centered at fract = 0.5; the neighbouring band is added so th = 1 is solid.
// Like effect.app, very thin bands still show as faint soft lines.
float ink(float ph, float th, float s) {
  float d = abs(fract(ph) - 0.5);
  float h = 0.5 * th;
  return saturate(2.0 - smoothstep(h - s, h + s, d) - smoothstep(h - s, h + s, 1.0 - d));
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 p = shortCentered(v_uv, u_resolution);
  float ph;
  if (u_patternType < 0.5) {
    float a = radians(u_angle);
    ph = dot(p, vec2(cos(a), sin(a)));
  } else {
    ph = length(p);
  }
  ph = ph * 2.0 * u_repetitions - u_time * u_animationSpeed;
  // Edge half-width: softness plus the pixel footprint (measured before the row shift's phase jumps).
  float w = 0.29 * u_edgeSoftness + 0.5 * fwidth(ph) + 1e-4;
  if (u_shift) ph += 0.5 * mod(floor((1.0 - v_uv.y) * u_rowShiftFreq), 2.0);
  vec3 v = saturate(src.rgb);
  vec3 th = mix(vec3(u_minThickness), vec3(u_maxThickness), 1.0 - v);
  vec3 c;
  if (u_colorMode) {
    c = 1.0 - vec3(
      ink(ph + u_redShift, th.r, w),
      ink(ph + u_greenShift, th.g, w),
      ink(ph + u_blueShift, th.b, w));
  } else {
    float tl = mix(u_minThickness, u_maxThickness, 1.0 - luma(v));
    c = vec3(1.0 - ink(ph, tl, w));
  }
  fragColor = vec4(c, src.a);
}`}},{id:`frame-drop`,name:`Frame drop`,category:`Effects`,keywords:`drop frame hold frame fps judder freeze Stutter`,params:[_(`fps`,`FPS`,1,30,8),g(`irregularity`,`Irregularity`,0,1,.35),g(`opacity`,`Opacity`,0,1,0)],shaders:{main:`
void main() { fragColor = texture(u_input, v_uv); }`},render:e=>e.input}],Nr=[...or,...Mr],Pr=[{name:`Inter`,google:!0},{name:`Helvetica`},{name:`Arial`},{name:`Georgia`},{name:`Times New Roman`},{name:`Courier New`},{name:`Impact`},{name:`Archivo Black`,google:!0},{name:`Anton`,google:!0},{name:`Bebas Neue`,google:!0},{name:`Oswald`,google:!0},{name:`Montserrat`,google:!0},{name:`Unbounded`,google:!0},{name:`Syne`,google:!0},{name:`Playfair Display`,google:!0},{name:`DM Serif Display`,google:!0},{name:`Abril Fatface`,google:!0},{name:`Instrument Serif`,google:!0},{name:`Space Grotesk`,google:!0},{name:`Space Mono`,google:!0},{name:`IBM Plex Mono`,google:!0},{name:`JetBrains Mono`,google:!0},{name:`VT323`,google:!0},{name:`Press Start 2P`,google:!0},{name:`Silkscreen`,google:!0},{name:`Pixelify Sans`,google:!0},{name:`Major Mono Display`,google:!0},{name:`Monoton`,google:!0},{name:`Bungee`,google:!0},{name:`Rubik Mono One`,google:!0},{name:`Permanent Marker`,google:!0},{name:`Pacifico`,google:!0},{name:`Lobster`,google:!0},{name:`UnifrakturMaguntia`,google:!0}],Fr=new Map;function Ir(e){let t=Pr.find(t=>t.name===e);if(!t||!t.google)return Promise.resolve();let n=Fr.get(e);return n||(n=new Promise(t=>{let n=document.createElement(`link`);n.rel=`stylesheet`,n.href=`https://fonts.googleapis.com/css2?family=${encodeURIComponent(e).replace(/%20/g,`+`)}:wght@400;700&display=block`,n.onload=()=>{Promise.all([document.fonts.load(`400 64px "${e}"`),document.fonts.load(`700 64px "${e}"`)]).catch(()=>void 0).then(()=>{document.dispatchEvent(new CustomEvent(`fontloaded`,{detail:e})),t()})},n.onerror=()=>t(),document.head.append(n)}),Fr.set(e,n)),n}function Lr(e){return!Pr.find(t=>t.name===e)?.google||document.fonts.check(`64px "${e}"`)}var Rr=[`Thin`,`Extra Light`,`Light`,`Regular`,`Medium`,`Semi Bold`,`Bold`,`Extra Bold`,`Black`],zr=64e6,Br=0;typeof document<`u`&&document.addEventListener(`fontloaded`,()=>Br++);function Vr(e){return/mono|courier|vt323|press start|silkscreen|code/i.test(e)?`monospace`:/serif|georgia|times|playfair|abril|fraktur|bodoni/i.test(e)&&!/sans/i.test(e)?`serif`:`sans-serif`}function Hr(e,t,n,r,i){let a=String(t.text??``);if(!a.trim()||n<.5)return null;let o=String(t.font||`Instrument Serif`),s=(O(t,`weight`)+1)*100,c=re(t,`italic`)?`italic `:``,l=a.split(`
`),u=Math.min(e.getParameter(e.MAX_TEXTURE_SIZE),16384),d=new OffscreenCanvas(1,1).getContext(`2d`),f=(e,r)=>{e.font=`${c}${s} ${n*r}px "${o}", ${Vr(o)}`,e.textBaseline=`alphabetic`,e.textAlign=`left`;let i=O(t,`letterSpacing`)*n*r;return`letterSpacing`in e&&(e.letterSpacing=`${i}px`),i},p=f(d,1),m=`letterSpacing`in d,h=d.measureText(`Hxgjy`).fontBoundingBoxDescent??n*.25,g=d.measureText(`H`).actualBoundingBoxAscent||n*.7,_=O(t,`lineHeight`)*n,v=l.map(e=>{let t=d.measureText(e),n=m?0:p*e.length;return{m:t,width:Math.max(0,t.width+n-(e.length?p:0))}}),y=Math.max(...v.map(e=>e.width),0),b=O(t,`align`),x=r+2+n*.05,S=1/0,C=1/0,w=-1/0,T=-1/0,ee=v.map(({m:e,width:t},n)=>{let r=b===0?0:b===1?(y-t)/2:y-t,i=g+n*_;return S=Math.min(S,r-e.actualBoundingBoxLeft),w=Math.max(w,r+Math.max(e.actualBoundingBoxRight,t)),C=Math.min(C,i-Math.max(e.actualBoundingBoxAscent,g)),T=Math.max(T,i+Math.max(e.actualBoundingBoxDescent,h*.5)),{lx:r,base:i}});if(!(w>S&&T>C))return null;let te=[(S+w)/2,(C+T)/2];S=Math.floor(i[0]+S-x)-i[0],C=Math.floor(i[1]+C-x)-i[1],w+=x,T+=x;let E=Math.min(1,u/(w-S),u/(T-C),Math.sqrt(zr/((w-S)*(T-C)))),ne=Math.min(u,Math.max(1,Math.ceil((w-S)*E))),D=Math.min(u,Math.max(1,Math.ceil((T-C)*E))),ie=new OffscreenCanvas(ne,D),k=ie.getContext(`2d`);k.fillStyle=`#000`,k.fillRect(0,0,ne,D);let ae=f(k,E);k.globalCompositeOperation=`lighter`;let oe=e=>{l.forEach((t,n)=>{let r=(ee[n].lx-S)*E,i=(ee[n].base-C)*E;if(m)e(t,r,i);else{let n=r;for(let r of t)e(r,n,i),n+=k.measureText(r).width+ae}})};return r>0&&(k.strokeStyle=`rgb(0,255,0)`,k.lineWidth=2*r*E,k.lineJoin=`round`,k.miterLimit=2,oe((e,t,n)=>k.strokeText(e,t,n))),k.fillStyle=`rgb(255,0,0)`,oe((e,t,n)=>k.fillText(e,t,n)),{tex:Fe(e,ie,ne,D),origin:[S,C],size:[ne/E,D/E],pivot:te}}var Ur={id:`text`,name:`Text`,category:`Generate`,keywords:`text font style letter line`,params:[{type:`text`,key:`text`,label:`Text`,default:`Type`,multiline:!0},{type:`font`,key:`font`,label:`Font`,default:`Instrument Serif`},x(`weight`,`Weight`,Rr,3,`select`),y(`italic`,`Italic`,!1),x(`align`,`Align`,[`Left`,`Center`,`Right`],1,`switcher`),S(`position`,`Position`,[-.2,.2],{min:[-3,-3],max:[3,3]}),g(`size`,`Size`,.01,.6,.12,.005),v(`rotation`,`Rotation`,-360,360,0),g(`lineHeight`,`Line Height`,.5,3,1.2,.05),g(`letterSpacing`,`Letter Spacing`,-.1,.6,0,.005),b(`textColor`,`Text Color`,`#ffffff`),g(`opacity`,`Opacity`,0,1,1),g(`strokeWidth`,`Stroke Width`,0,30,0,.5),b(`strokeColor`,`Stroke Color`,`#000000`),x(`blendMode`,`blend mode`,ne,0,`slider`)],shaders:{main:`
uniform sampler2D u_textTex;
uniform vec2 u_rasterOrigin; // raster top-left in block coords (render px, y down, origin = Position)
uniform vec2 u_rasterSize;   // raster extent in render px
uniform vec2 u_pivot;        // rotation center in block coords
void main() {
  vec4 base = texture(u_input, v_uv);
  vec2 d = v_uv * u_resolution - pointToUv(u_position) * u_resolution;
  vec2 b = vec2(d.x, -d.y);
  // Positive rotation turns the text clockwise around the center of its ink box.
  b = u_pivot + rot2(-radians(u_rotation)) * (b - u_pivot);
  vec2 r = (b - u_rasterOrigin) / u_rasterSize;
  vec2 cov = vec2(0.0);
  if (all(greaterThanEqual(r, vec2(0.0))) && all(lessThanEqual(r, vec2(1.0)))) {
    cov = textureLod(u_textTex, vec2(r.x, 1.0 - r.y), 0.0).rg;
  }
  float fillA = cov.r;
  float strokeA = cov.g;
  float a = max(fillA, strokeA) * u_opacity;
  vec3 col = mix(u_strokeColor, u_textColor, fillA);
  vec3 blended = blendMode(u_blendMode, saturate(base.rgb), col);
  fragColor = vec4(mix(base.rgb, blended, a), max(base.a, a));
}`},render(e){let t=e.params,n=String(t.font||`Instrument Serif`);typeof document<`u`&&Ir(n);let r=typeof document>`u`||Lr(n),i=O(t,`size`)*e.height,a=O(t,`strokeWidth`)*e.pxScale,o=t.position??[0,0],s=(o[0]*.5+.5)*e.width,c=(.5-o[1]*.5)*e.height,l=[Math.round((s-Math.floor(s))*16)/16,Math.round((c-Math.floor(c))*16)/16],u=JSON.stringify([`text`,t.text,n,t.weight,t.italic,t.align,Math.round(i*100),t.lineHeight,t.letterSpacing,Math.round(a*100),r,Br,l]),d=e.cached(u,()=>typeof OffscreenCanvas>`u`?null:Hr(e.gl,t,i,a,l),e=>e?.tex.dispose());return d?e.pass(`main`,{inputs:{u_textTex:d.tex},uniforms:{u_rasterOrigin:d.origin,u_rasterSize:d.size,u_pivot:d.pivot}}):e.input}},Wr=`
float gaussHash(vec2 cell, float seed) {
  vec3 u = vec3(pcg3d(uvec3(ivec3(ivec2(floor(cell)) + 32768, int(seed) + 4096)))) / 4294967295.0;
  return (u.x + u.y + u.z - 1.5) * 2.0;
}
float grainOctave(vec2 p, float seed) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = gaussHash(i, seed), b = gaussHash(i + vec2(1.0, 0.0), seed);
  float c = gaussHash(i + vec2(0.0, 1.0), seed), d = gaussHash(i + vec2(1.0, 1.0), seed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float grainNoise(vec2 p, float seed) {
  float n = grainOctave(p, seed) * 0.8 + grainOctave(mat2(0.8, 0.6, -0.6, 0.8) * p * 1.6 + 13.7, seed + 7.0) * 0.6;
  return n * 1.35;
}
`,Gr=`
// Thin fibres: ridges of stretched gradient noise. The orientation drifts slowly across the sheet; it is blended
// from four fixed orientations (rotating the coordinates themselves would shear the pattern far from the origin).
float paperFibres(vec2 p, float seed) {
  float th = gradientNoise(p * 0.004 + seed) * 2.5;
  float f = 0.0, wsum = 0.0;
  for (int k = 0; k < 4; k++) {
    float phi = float(k) * 0.7853982;
    float w = max(cos(2.0 * (th - phi)), 0.0);
    w *= w;
    if (w < 1e-3) continue;
    vec2 q = rot2(phi) * p;
    float r = 1.0 - abs(gradientNoise(q * vec2(0.035, 0.42) + seed * 3.1 + float(k) * 17.0));
    f += pow(r, 10.0) * w;
    wsum += w;
  }
  return f / max(wsum, 1e-4);
}
float paperTexture(vec2 p, int mode) {
  float rough = mode == 1 ? 1.0 : 0.0;
  // Fine grain (~1.5 px) and medium tooth (~5 px).
  float grain = grainNoise(p / mix(1.4, 2.2, rough), 3.0);
  float tooth = gradientNoise(p / mix(5.0, 9.0, rough) + 7.3);
  // Fibres in two populations.
  float fib = paperFibres(p, 1.7) + paperFibres(p * 1.3 + 91.0, 5.3) * 0.8;
  // Low-frequency mottling (pulp density) and blotches.
  float mottle = fbm(p / mix(60.0, 35.0, rough) + 3.1, 4);
  // Scanner: faint horizontal streaks that vary slowly along x.
  float streak = gradientNoise(vec2(p.x * 0.002, p.y * 0.7)) * (0.6 + 0.4 * gradientNoise(vec2(p.x * 0.01, 3.0)));
  float t = grain * mix(0.55, 0.7, rough) + tooth * mix(0.35, 0.6, rough) + (fib - 0.12) * mix(1.6, 2.4, rough)
    + mottle * mix(0.9, 1.6, rough) + streak * 0.25;
  return t;
}
`,Kr={id:`noise`,name:`Noise`,category:`Generate`,keywords:`analog film generator grain noise overlay texture`,animated:!0,params:[g(`amount`,`amount`,0,3,.9),g(`size`,`size`,.5,3,1),g(`floor`,`floor`,0,.3,.02),g(`chroma`,`chroma`,0,1,.8),g(`shadow`,`shadow`,0,1,1),g(`midTone`,`mid-tone`,0,1,.5),g(`highlight`,`highlight`,0,1,.8),g(`speed`,`speed`,0,60,0,1)],shaders:{main:`
${Wr}
void main() {
  vec4 src = texture(u_input, v_uv);
  // Grain frame: static when speed = 0, otherwise a new pattern 'speed' times per second.
  float frame = u_speed > 0.0 ? floor(u_time * u_speed) : 0.0;
  // Grain cells smaller than a pixel average out: shrink the amplitude instead of aliasing.
  float cellPx = u_size * 1.6 * u_pxScale;
  vec2 p = gl_FragCoord.xy / max(cellPx, 1.0) - 0.5;
  float aa = min(cellPx, 1.0);
  vec3 seed = vec3(17.0, 5.0, 11.0) * mod(frame, 997.0);
  float nl = grainNoise(p, seed.x + 1.0);
  vec3 nc = vec3(grainNoise(p, seed.y + 31.0), grainNoise(p, seed.z + 57.0), grainNoise(p, seed.x + 83.0));
  // Chroma grain keeps its own variance but is decorrelated from luma.
  vec3 n = mix(vec3(nl), nc, u_chroma);
  float L = saturate(luma(src.rgb));
  // Tonal response: quadratic Bezier through shadow / mid-tone / highlight weights, plus a floor.
  float w = u_shadow * (1.0 - L) * (1.0 - L) + u_midTone * 2.0 * L * (1.0 - L) + u_highlight * L * L;
  w = u_floor + (1.0 - u_floor) * w;
  // Grain fades out in channels approaching white, so clipped highlights stay clean.
  vec3 roll = saturate((1.0 - src.rgb) * 8.0);
  vec3 c = src.rgb + n * roll * (u_amount * w * 0.036 * aa);
  fragColor = vec4(max(c, 0.0), src.a);
}`}},qr=480,Jr=10,Yr={id:`ink-bleed`,name:`Ink bleed`,category:`Generate`,keywords:`bleed ink spread`,animated:!0,params:[g(`spread`,`spread`,0,30,5,.5),g(`decay`,`decay`,0,.2,0,.001),g(`intensity`,`intensity`,0,1,.15),S(`direction`,`direction`,[0,0]),_(`noiseSize`,`noise size`,4,120,90),g(`grain`,`grain`,0,1,.4),g(`grainSize`,`grain size`,.5,3,1,.1),E(`customMask`,`custom mask`),w(`maskContrast`,`mask contrast`),g(`maskStrength`,`mask strength`,0,1,1),y(`showMask`,`show mask`,!1),_(`inkReset`,`Ink reset (sec)`,0,10,0)],shaders:{down:`
uniform sampler2D u_src;
uniform vec2 u_srcTexel;
void main() {
  vec2 o = u_srcTexel;
  fragColor = 0.25 * (texture(u_src, v_uv - o) + texture(u_src, v_uv + vec2(o.x, -o.y))
    + texture(u_src, v_uv + vec2(-o.x, o.y)) + texture(u_src, v_uv + o));
}`,seed:`
uniform sampler2D u_src;
float inkMask(vec3 c, vec2 uv) {
  float m = u_customMaskLoaded ? luma(texture(u_customMask, uv).rgb) : 1.0 - luma(saturate(c));
  m = lut1(u_maskContrast, m);
  return mix(1.0, m, u_maskStrength);
}
void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  fragColor = vec4(srgbToLinear(c), inkMask(c, v_uv));
}`,spread:`
uniform sampler2D u_src;  // rgb linear colour, a = ink
uniform float u_r;        // pass radius (sim px)
uniform float u_pass;
uniform float u_rate;     // how strongly an inkier neighbour takes over per pass
void main() {
  vec2 res = vec2(textureSize(u_src, 0));
  vec2 px = 1.0 / res;
  vec2 p = v_uv * res;
  vec4 c0 = texture(u_src, v_uv);
  // Reference-px coordinates for the paper noise (independent of the sim grid size).
  vec2 rp = p * (1000.0 / max(res.x, res.y));
  // Paper absorbency: blotchy at the noise size; the radius jitter makes the fronts irregular.
  float absorb = saturate(fbm(rp / u_noiseSize, 4) * 1.2 + 0.5);
  float jit = valueNoise(rp / 2.5 + u_pass * 7.0);
  float a0 = hash12(p + u_pass * 131.0) * TAU;
  vec2 bias = u_direction * 0.9;
  float rr = u_r * (0.4 + 0.9 * absorb) * (0.6 + 0.6 * jit);
  vec4 best = c0;
  for (int i = 0; i < 8; i++) {
    float ang = a0 + float(i) * (TAU / 8.0);
    vec2 q = p - (vec2(cos(ang), sin(ang)) + bias) * rr;
    vec4 s = texture(u_src, q / res);
    if (s.a > best.a) best = s;
  }
  float gain = smoothstep(0.0, 0.12, best.a - c0.a) * u_rate;
  // Feathered fronts: fibres stretched along the direction the ink travels (the ink gradient).
  vec2 g = vec2(texture(u_src, v_uv + vec2(px.x, 0.0)).a - texture(u_src, v_uv - vec2(px.x, 0.0)).a,
                texture(u_src, v_uv + vec2(0.0, px.y)).a - texture(u_src, v_uv - vec2(0.0, px.y)).a);
  float gl = length(g);
  vec2 dn = gl > 1e-4 ? g / gl : vec2(0.0, 1.0);
  vec2 pp = vec2(dot(rp, vec2(-dn.y, dn.x)), dot(rp, dn));
  float streak = valueNoise(pp * vec2(0.28, 0.025));
  gain *= mix(1.0, smoothstep(0.2, 0.75, streak) * 1.4, smoothstep(0.0, 0.04, gl));
  // Pigment-weighted mixing: ink flooding bare paper keeps its full colour, inks of similar strength blend
  // (blue over pink turns violet). Ink thins with decay as it travels.
  gain = saturate(gain);
  float w0 = c0.a * (1.0 - gain) + 1e-3, w1 = best.a * gain;
  vec3 rgb = (c0.rgb * w0 + best.rgb * w1) / (w0 + w1);
  fragColor = vec4(rgb, mix(c0.a, best.a * (1.0 - u_decay * 2.0), gain));
}`,main:`
uniform sampler2D u_ink;   // settled simulation (linear rgb, a = ink)
uniform sampler2D u_orig;  // seed (unspread) on the same grid
uniform float u_strength;
uniform float u_fringe;    // fringe fibre length (render px)
uniform sampler2D u_inkSoft;  // slightly blurred simulation (soft fronts)
uniform sampler2D u_inkWide;  // widely blurred simulation (water wash beyond the fronts)
uniform sampler2D u_seedWide; // seed blurred the same way
vec4 textureBSpline(sampler2D t, vec2 uv) {
  vec2 size = vec2(textureSize(t, 0));
  vec2 st = uv * size - 0.5;
  vec2 i = floor(st), f = st - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 0.5 + w1 / g0) / size;
  vec2 h1 = (i + 1.5 + w3 / g1) / size;
  return (texture(t, vec2(h0.x, h0.y)) * g0.x + texture(t, vec2(h1.x, h0.y)) * g1.x) * g0.y
       + (texture(t, vec2(h0.x, h1.y)) * g0.x + texture(t, vec2(h1.x, h1.y)) * g1.x) * g1.y;
}
void main() {
  vec4 src = texture(u_input, v_uv);
  if (u_showMask) {
    float m = u_customMaskLoaded ? luma(texture(u_customMask, v_uv).rgb) : 1.0 - luma(saturate(src.rgb));
    m = mix(1.0, lut1(u_maskContrast, m), u_maskStrength);
    fragColor = vec4(vec3(m), 1.0);
    return;
  }
  // Hairy fringe: near ink fronts the ink is looked up displaced along its gradient by streak noise. The streaks
  // come from line-integral convolution of fine noise along the gradient, so they stay perpendicular to the
  // front on any curvature (fibres reach out of every blob and the paper shows between them).
  vec2 e = 1.5 / vec2(textureSize(u_ink, 0));
  vec2 g = vec2(texture(u_ink, v_uv + vec2(e.x, 0.0)).a - texture(u_ink, v_uv - vec2(e.x, 0.0)).a,
                texture(u_ink, v_uv + vec2(0.0, e.y)).a - texture(u_ink, v_uv - vec2(0.0, e.y)).a);
  float gl = length(g);
  float edge = smoothstep(0.0, 0.08, gl);
  vec2 fuv = v_uv;
  if (edge > 0.0 && u_fringe > 0.0) {
    vec2 dn = g / gl;
    // Relative px (720 per long side) so the fibres look the same at any render size.
    float k = 720.0 / max(u_resolution.x, u_resolution.y);
    vec2 rp0 = v_uv * u_resolution * k;
    float L = u_fringe * k;
    float acc = 0.0;
    for (int i = 0; i < 10; i++) {
      float t = (float(i) / 9.0 - 0.5) * L;
      acc += valueNoise((rp0 + dn * t) / 1.1);
    }
    float fn = (acc / 10.0 - 0.5) * 1.1;
    fuv += dn * fn * u_fringe * edge / u_resolution;
  }
  vec4 inkS = textureBSpline(u_ink, fuv);
  vec4 inkB = texture(u_inkSoft, fuv);
  vec3 bled = linearToSrgb(inkS.rgb);
  vec3 low = linearToSrgb(textureBSpline(u_orig, v_uv).rgb);
  // Where the ink changed the picture its soft colour replaces the detail; untouched paper keeps it.
  float change = saturate(length(bled - low) * 20.0);
  vec3 inkCol = linearToSrgb(mix(inkS.rgb, inkB.rgb, 0.8));
  vec3 c = mix(src.rgb + (bled - low), inkCol, change);
  // Ink pigment: denser and more saturated than the source colour.
  float L = luma(c);
  c = mix(c, mix(vec3(L), c, 1.45) * 0.93, saturate(change * inkS.a * 1.3));
  // Water wash: a pale, greyish stain of the ink colour just beyond the fronts.
  vec4 inkW = texture(u_inkWide, v_uv);
  float wash = saturate((inkW.a - texture(u_seedWide, v_uv).a) * 4.0) * (1.0 - change);
  vec3 washCol = linearToSrgb(inkW.rgb);
  washCol = mix(washCol, vec3(luma(washCol)), 0.35);
  c = mix(c, washCol, wash * 0.6);
  // Fibre grain in the ink: thin streaks that modulate its density.
  vec2 rp = gl_FragCoord.xy / u_pxScale / max(u_grainSize, 0.1);
  float a = gradientNoise(rp * 0.01) * 2.0;
  vec2 q = rot2(a) * rp;
  float streak = gradientNoise(q * vec2(0.08, 0.9)) * 0.7 + gradientNoise(rp * 0.5) * 0.3;
  c *= 1.0 + u_grain * 0.15 * streak * max(change, wash) * (0.4 + inkS.a);
  fragColor = vec4(mix(src.rgb, c, u_strength), src.a);
}`},render(e){let t=e.params,n=Math.max(e.width,e.height),r=Math.max(1,Math.round(e.width/n*qr)),i=Math.max(1,Math.round(e.height/n*qr)),a=O(t,`inkReset`),o=a>0?e.time%a/a:1,s=e.input,c=[];for(;s.width>r*3||s.height>i*3;){let t=e.pass(`down`,{width:Math.ceil(s.width/2),height:Math.ceil(s.height/2),inputs:{u_src:s},uniforms:{u_srcTexel:[.5/s.width,.5/s.height]}});c.push(t),s=t}let l=e.pass(`seed`,{width:r,height:i,inputs:{u_src:s}});for(let t of c)e.release(t);let u=O(t,`spread`)*.0036*qr*Math.sqrt(o),d=1-(1-Math.min(1,O(t,`intensity`)))**5,f=l;if(u>.3)for(let t=0;t<Jr;t++){let n=Math.max(.7,u*.72**t),a=e.pass(`spread`,{width:r,height:i,inputs:{u_src:f},uniforms:{u_r:n,u_pass:t,u_rate:d}});f!==l&&e.release(f),f=a}let p=1-(1-Math.min(1,O(t,`intensity`)))**20,m=O(t,`spread`)*.0032*n*Math.sqrt(o),h=qr/480,g=e.blur(f,2.2*h),_=e.blur(f,7),v=e.blur(l,7),y=e.pass(`main`,{inputs:{u_ink:f,u_orig:l,u_inkSoft:g,u_inkWide:_,u_seedWide:v},uniforms:{u_strength:p,u_fringe:m}});for(let t of[g,_,v])e.release(t);return f!==l&&e.release(f),e.release(l),y}},Xr={id:`paper-scan`,name:`Paper scan`,category:`Generate`,keywords:`analog grain media mixed paper scan scanned texture vintage`,params:[_(`textureMode`,`textureMode`,0,1,0),g(`opacity`,`opacity`,0,1,1),g(`texScale`,`texScale`,1,3,1),g(`brightness`,`brightness`,-1,1,0),g(`contrast`,`contrast`,0,3,1),g(`distortion`,`distortion`,0,3,1,.1),g(`distortionScale`,`distorion scale`,300,1e3,500,1)],shaders:{main:`
${Wr}
${Gr}
void main() {
  vec2 p = gl_FragCoord.xy / u_pxScale; // reference px
  int mode = int(u_textureMode + 0.5);
  // Paper relief displaces the scanned image by a fraction of a pixel (feature size = scale / 100 px).
  float fs = u_distortionScale / 100.0;
  vec2 warp = vec2(fbm(p / fs, 3), fbm(p / fs + 37.0, 3)) * u_distortion * 1.1 * u_pxScale;
  vec4 src = texture(u_input, v_uv + warp / u_resolution);
  float t = paperTexture(p / u_texScale, mode);
  vec3 tint = mode == 1 ? vec3(0.16, 0.14, 0.115) : vec3(0.14, 0.125, 0.125);
  vec3 paper = tint + t * (mode == 1 ? 0.03 : 0.022);
  paper = (paper - tint) * u_contrast + tint + u_brightness * 0.5;
  paper = saturate(paper);
  vec3 c = saturate(src.rgb);
  vec3 scanned = 1.0 - (1.0 - c) * (1.0 - paper);
  // Faint unevenness in the paper white itself.
  scanned *= 1.0 + t * 0.0025 * u_contrast;
  fragColor = vec4(mix(src.rgb, scanned, u_opacity), src.a);
}`}},Zr=32,Qr=.07,$r=256,ei=`0123456789 `,ti=[`Default`,`Add`,`Screen`,`Multiply`,`Overlay`,`Difference`,`Exclusion`,`Invert`],ni=[[`#00f2ff`,`#39ff14`,`#ff2bd6`,`#fff200`,`#ff6a00`,`#8a5cff`],[`#ff3b30`,`#ff9500`,`#ffd60a`,`#ff2d55`,`#ff7eb6`,`#ffffff`],[`#a0e7e5`,`#b4f8c8`,`#fbe7c6`,`#ffaebc`,`#cdb4db`,`#bde0fe`],[`#ffffff`,`#00ff66`,`#b8b8b8`,`#ff0044`,`#00b3ff`,`#ffe600`]];function ri(e,t,n){let r=new Int32Array(t*n).fill(-1),i=e=>{for(;r[e]!==e;)r[e]=r[r[e]],e=r[e];return e};for(let a=0;a<n;a++)for(let n=0;n<t;n++){let o=a*t+n;if(e[o]&&(r[o]=o,n>0&&e[o-1]&&(r[i(o)]=i(o-1)),a>0&&e[o-t])){let e=i(o),n=i(o-t);e!==n&&(r[e]=n)}}let a=new Map;for(let r=0;r<n;r++)for(let n=0;n<t;n++){let o=r*t+n;if(!e[o])continue;let s=i(o),c=a.get(s);c||a.set(s,c={x0:n,y0:r,x1:n+1,y1:r+1,cx:0,cy:0,area:0}),c.x0=Math.min(c.x0,n),c.y0=Math.min(c.y0,r),c.x1=Math.max(c.x1,n+1),c.y1=Math.max(c.y1,r+1),c.cx+=n+.5,c.cy+=r+.5,c.area++}return[...a.values()].map(e=>({x0:e.x0/t,y0:e.y0/n,x1:e.x1/t,y1:e.y1/n,cx:e.cx/e.area/t,cy:e.cy/e.area/n,area:e.area/(t*n)}))}function ii(e,t,n,r){let i=new Uint8Array(t*n),a=10/(t*n),o=[],s=(e,t)=>{let n=Math.max(0,Math.min(e.x1,t.x1)-Math.max(e.x0,t.x0))*Math.max(0,Math.min(e.y1,t.y1)-Math.max(e.y0,t.y0));return n/((e.x1-e.x0)*(e.y1-e.y0)+(t.x1-t.x0)*(t.y1-t.y0)-n)};for(let c=0;c<4;c++){let l=r+c*.07;if(c>0&&l>.995)break;for(let r=0;r<t*n;r++)i[r]=+(e[r]>=l);for(let e of ri(i,t,n))e.area<a||e.area>.3||(e.x1-e.x0)*(e.y1-e.y0)>.35||o.some(t=>s(t,e)>.6)||o.push(e)}o.sort((e,t)=>t.area-e.area);let c=t/n,l=[];for(let e of o){if(l.length>=Zr)break;l.some(t=>Math.hypot((t.cx-e.cx)*c,t.cy-e.cy)<Qr)||l.push(e)}return l}function ai(e,t){if(typeof OffscreenCanvas>`u`)return null;let n=`600 ${Math.round(t*.8)}px ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace`,r=new OffscreenCanvas(1,1).getContext(`2d`);r.font=n;let i=Math.ceil(r.measureText(`0`).width+t*.04),a=new OffscreenCanvas(i*11,t),o=a.getContext(`2d`);o.font=n,o.fillStyle=`#fff`,o.textAlign=`center`,o.textBaseline=`middle`;for(let e=0;e<11;e++)o.fillText(ei[e],(e+.5)*i,t*.54);return{tex:Fe(e,a,a.width,a.height,{mipmaps:!0}),aspect:i/t}}function oi(e){let t=parseInt(e.slice(1),16);return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]}function si(e,t){let n=e.map(()=>-1);if(t===1)for(let t=0;t+1<e.length;t++)n[t]=t+1;else if(t===2)e.forEach((t,r)=>{let i=-1,a=1/0;e.forEach((e,n)=>{let o=(t.cx-e.cx)**2+(t.cy-e.cy)**2;n!==r&&o<a&&(a=o,i=n)}),n[r]=i}),n.forEach((e,t)=>{e>=0&&e<t&&n[e]===t&&(n[t]=-1)});else if(t===3)for(let t=1;t<e.length;t++)n[t]=0;return n}var ci=[Ur,Kr,Yr,Xr,{id:`blob-tracker`,name:`Blob Tracker`,category:`Generate`,keywords:`blob bounding box detection lightness motion tracking`,params:[b(`keyColor`,`key color`,`#ffffff`),g(`threshold`,`threshold`,0,1,.55,.001),g(`persistence`,`persistence`,.5,.99,.82),y(`debugMask`,`debug mask`,!1),y(`randomPalette`,`random palette`,!0),b(`boxColor`,`box color`,`#00f2ff`),_(`paletteSet`,`palette set`,0,3,0),_(`boxType`,`box type`,0,3,1),x(`boxBlend`,`box blend`,ti,0,`select`),g(`boxThickness`,`box thickness px`,.5,8,1.5,.5),g(`boxOutlineOpacity`,`box outline opacity`,0,1,1,.05),g(`boxFillOpacity`,`box fill opacity`,0,1,.12,.02),_(`centerType`,`center type`,0,4,4),g(`centerSize`,`center size px`,1,16,3,.5),_(`captionPosition`,`caption position`,0,8,1),g(`captionSize`,`caption size px`,6,48,22,1),g(`captionBgOpacity`,`caption bg opacity`,0,1,.45,.05),_(`lineType`,`line type`,0,3,1),_(`lineStyle`,`line style`,0,3,2)],shaders:{down:`
uniform sampler2D u_src;
uniform vec2 u_srcTexel;
void main() {
  vec2 o = u_srcTexel;
  fragColor = 0.25 * (texture(u_src, v_uv - o) + texture(u_src, v_uv + vec2(o.x, -o.y))
    + texture(u_src, v_uv + vec2(-o.x, o.y)) + texture(u_src, v_uv + o));
}`,mask:`
uniform sampler2D u_src;
float keySimilarity(vec3 c) {
  vec3 a = linearToOklab(srgbToLinear(saturate(c)));
  vec3 k = linearToOklab(srgbToLinear(u_keyColor));
  return 1.0 - length(a - k) / 0.4;
}
void main() {
  fragColor = vec4(saturate(keySimilarity(texture(u_src, v_uv).rgb)), 0.0, 0.0, 1.0);
}`,main:`
uniform vec4 u_blobBox[${Zr}];  // x0, y0, x1, y1 (uv)
uniform vec4 u_blobInfo[${Zr}]; // cx, cy (uv), palette index, linked blob (-1 none)
uniform int u_blobCount;
uniform vec3 u_pal[6];
uniform sampler2D u_atlas;
uniform float u_glyphAspect;
float keySimilarity(vec3 c) {
  vec3 a = linearToOklab(srgbToLinear(saturate(c)));
  vec3 k = linearToOklab(srgbToLinear(u_keyColor));
  return 1.0 - length(a - k) / 0.4;
}
// Coverage of a horizontal/vertical band |d| < w/2 with ~1px anti-aliasing.
float band(float d, float w) { return saturate(w * 0.5 + 0.5 - abs(d)); }
float sdSegment(vec2 p, vec2 a, vec2 b, out float t) {
  vec2 pa = p - a, ba = b - a;
  t = saturate(dot(pa, ba) / max(dot(ba, ba), 1e-6));
  return length(pa - ba * t);
}
// Distance to a quadratic Bezier (A, B control, C) and the curve parameter of the closest point (after IQ).
vec2 sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
  vec2 a = B - A, b = A - 2.0 * B + C, c = a * 2.0, d = A - pos;
  float kk = 1.0 / max(dot(b, b), 1e-6);
  float kx = kk * dot(a, b);
  float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
  float kz = kk * dot(d, a);
  float p = ky - kx * kx, q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
  float h = q * q + 4.0 * p * p * p;
  if (h >= 0.0) {
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - q) / 2.0;
    vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    float t = saturate(uv.x + uv.y - kx);
    vec2 e = d + (c + b * t) * t;
    return vec2(length(e), t);
  }
  float z = sqrt(-p);
  float v = acos(clamp(q / (p * z * 2.0), -1.0, 1.0)) / 3.0;
  float m = cos(v), n = sin(v) * 1.732050808;
  vec2 t = saturate(vec2(m + m, -n - m) * z - kx);
  vec2 e1 = d + (c + b * t.x) * t.x, e2 = d + (c + b * t.y) * t.y;
  return dot(e1, e1) < dot(e2, e2) ? vec2(length(e1), t.x) : vec2(length(e2), t.y);
}
// g in [0,1]^2 inside the glyph cell (y up); lod picks the atlas mip for the drawn caption size (explicit,
// since this runs in non-uniform control flow).
float glyph(int ch, vec2 g, float lod) {
  if (g.x < 0.0 || g.y < 0.0 || g.x > 1.0 || g.y > 1.0) return 0.0;
  return textureLod(u_atlas, vec2((float(ch) + g.x) / 11.0, g.y), lod).a;
}
// Caption "NN XXX YYY": blob number and centre in thousandths of the image.
int captionChar(int i, int id, vec2 c) {
  if (i == 2 || i == 6) return 10;
  int v = i < 2 ? id : i < 6 ? int(clamp(c.x, 0.0, 0.999) * 1000.0) : int(clamp(1.0 - c.y, 0.0, 0.999) * 1000.0);
  int k = i < 2 ? 1 - i : i < 6 ? 5 - i : 9 - i;
  for (int n = 0; n < 3; n++) { if (n >= k) break; v /= 10; }
  return v - (v / 10) * 10;
}
void over(inout vec4 acc, vec3 c, float a) {
  acc.rgb = mix(acc.rgb, c, a);
  acc.a = a + acc.a * (1.0 - a);
}
void main() {
  vec4 base = texture(u_input, v_uv);
  if (u_debugMask) {
    float m = step(u_threshold, keySimilarity(base.rgb));
    fragColor = vec4(vec3(m), 1.0);
    return;
  }
  vec2 px = v_uv * u_resolution;
  float s = u_pxScale;
  float th = max(u_boxThickness * s, 0.5);
  vec4 acc = vec4(0.0); // overlay colour (straight) + alpha
  int lt = int(u_lineType + 0.5), ls = int(u_lineStyle + 0.5);
  // Connection lines first (underneath the boxes). Styles: straight, straight dashed, arc, arc dashed.
  if (lt > 0) {
    float lw = max(th * 0.7, 0.6);
    for (int i = 0; i < ${Zr}; i++) {
      if (i >= u_blobCount) break;
      int j = int(u_blobInfo[i].w);
      if (j < 0) continue;
      vec2 a = u_blobInfo[i].xy * u_resolution, b = u_blobInfo[j].xy * u_resolution;
      vec2 dt;
      if (ls >= 2) {
        // Arc: quadratic Bezier bowed sideways by a quarter of the span, alternating sides.
        vec2 n = vec2(a.y - b.y, b.x - a.x) * (mod(float(i), 2.0) < 1.0 ? 0.25 : -0.25);
        vec2 c = (a + b) * 0.5 + n;
        vec2 lo = min(min(a, b), c) - lw - 2.0, hi = max(max(a, b), c) + lw + 2.0;
        if (any(lessThan(px, lo)) || any(greaterThan(px, hi))) continue;
        dt = sdBezier(px, a, c, b);
        dt.y *= length(b - a) * 1.15;
      } else {
        float t;
        dt.x = sdSegment(px, a, b, t);
        dt.y = t * length(b - a);
      }
      if (dt.x > lw + 2.0) continue;
      float on = (ls == 1 || ls == 3) ? step(fract(dt.y / (10.0 * s)), 0.55) : 1.0;
      int ci = int(u_blobInfo[i].z);
      over(acc, u_randomPalette ? u_pal[ci] : u_boxColor, band(dt.x, lw) * on * u_boxOutlineOpacity * 0.85);
    }
  }
  int bt = int(u_boxType + 0.5), ct = int(u_centerType + 0.5), cp = int(u_captionPosition + 0.5);
  float capH = u_captionSize * s;
  float capW = capH * u_glyphAspect; // glyph advance
  float capPad = capH * 0.2;
  float glyphLod = max(0.0, log2(float(textureSize(u_atlas, 0).y) / max(capH, 1.0)));
  for (int i = 0; i < ${Zr}; i++) {
    if (i >= u_blobCount) break;
    vec4 bb = u_blobBox[i] * u_resolution.xyxy;
    vec2 bc = u_blobInfo[i].xy;
    vec3 col = u_randomPalette ? u_pal[int(u_blobInfo[i].z)] : u_boxColor;
    // Caption rectangle (9 placements; 0 = off).
    float cw = capW * 10.0 + capPad * 2.0, chh = capH;
    vec2 cmin = vec2(-1e9);
    if (cp == 1) cmin = vec2(bb.x - th * 0.5, bb.w + th * 0.5);
    else if (cp == 2) cmin = vec2(bb.z + th * 0.5 - cw, bb.w + th * 0.5);
    else if (cp == 3) cmin = vec2(bb.x - th * 0.5, bb.y - th * 0.5 - chh);
    else if (cp == 4) cmin = vec2(bb.z + th * 0.5 - cw, bb.y - th * 0.5 - chh);
    else if (cp == 5) cmin = vec2(bb.x + th, bb.w - th - chh);
    else if (cp == 6) cmin = vec2(bb.z - th - cw, bb.w - th - chh);
    else if (cp == 7) cmin = vec2(bb.x + th, bb.y + th);
    else if (cp == 8) cmin = vec2((bb.x + bb.z - cw) * 0.5, (bb.y + bb.w - chh) * 0.5);
    // Keep captions on the canvas.
    if (cp > 0) cmin = clamp(cmin, vec2(0.0), max(u_resolution - vec2(cw, chh), vec2(0.0)));
    float pad = th + u_centerSize * s * 2.0 + 2.0;
    bool nearBox = px.x > bb.x - pad && px.x < bb.z + pad && px.y > bb.y - pad && px.y < bb.w + pad;
    bool inCap = cp > 0 && px.x >= cmin.x && px.x <= cmin.x + cw && px.y >= cmin.y && px.y <= cmin.y + chh;
    if (!nearBox && !inCap) continue;
    if (nearBox) {
      // Fill.
      float inside = saturate(min(min(px.x - bb.x, bb.z - px.x), min(px.y - bb.y, bb.w - px.y)) + 0.5);
      over(acc, col, inside * u_boxFillOpacity);
      // Outline: distance to the rectangle border.
      vec2 hc = (bb.xy + bb.zw) * 0.5, hs = (bb.zw - bb.xy) * 0.5;
      vec2 q = abs(px - hc) - hs;
      float edge = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      float line = band(edge, th);
      if (bt == 1) {
        // Corner brackets: arms of half the shorter side from each corner.
        float arm = min(hs.x, hs.y) * 0.5 + th;
        vec2 fromCorner = hs - abs(px - hc);
        line *= step(max(fromCorner.x, fromCorner.y), arm);
      } else if (bt == 2) {
        float per = (px.x - bb.x) + (px.y - bb.y);
        line *= step(fract(per / (10.0 * s)), 0.55);
      } else if (bt == 3) {
        float r = min(min(hs.x, hs.y), 8.0 * s);
        vec2 qr = abs(px - hc) - hs + r;
        float er = length(max(qr, 0.0)) + min(max(qr.x, qr.y), 0.0) - r;
        line = band(er, th);
      }
      over(acc, col, line * u_boxOutlineOpacity);
      // Centre marker.
      vec2 cpx = bc * u_resolution;
      vec2 dc = px - cpx;
      float cs = u_centerSize * s;
      float mk = 0.0;
      float lw = max(th * 0.75, 0.75);
      if (ct == 1) mk = saturate(cs - length(dc) + 0.5);
      else if (ct == 2) mk = max(band(dc.x, lw) * step(abs(dc.y), cs * 1.6), band(dc.y, lw) * step(abs(dc.x), cs * 1.6));
      else if (ct == 3) mk = band(length(dc) - cs, lw);
      else if (ct == 4) {
        mk = band(length(dc) - cs, lw);
        mk = max(mk, band(dc.x, lw) * step(cs * 0.4, abs(dc.y)) * step(abs(dc.y), cs * 2.2));
        mk = max(mk, band(dc.y, lw) * step(cs * 0.4, abs(dc.x)) * step(abs(dc.x), cs * 2.2));
      }
      over(acc, col, saturate(mk) * u_boxOutlineOpacity);
    }
    if (inCap) {
      over(acc, col, u_captionBgOpacity);
      vec2 l = (px - cmin - vec2(capPad, 0.0)) / vec2(capW, chh);
      int ci = int(floor(l.x));
      float a = ci >= 0 && ci < 10 ? glyph(captionChar(ci, i + 1, bc), vec2(fract(l.x), l.y), glyphLod) : 0.0;
      vec3 tc = mix(col, vec3(0.0), smoothstep(0.2, 0.5, u_captionBgOpacity));
      over(acc, tc, a);
    }
  }
  // Composite the overlay with the chosen blend.
  vec3 b = saturate(base.rgb);
  int mode = u_boxBlend;
  vec3 o = acc.rgb;
  vec3 r;
  if (mode == 1) r = b + o;
  else if (mode == 2) r = 1.0 - (1.0 - b) * (1.0 - o);
  else if (mode == 3) r = b * o;
  else if (mode == 4) r = blendOverlay(b, o);
  else if (mode == 5) r = abs(b - o);
  else if (mode == 6) r = b + o - 2.0 * b * o;
  else if (mode == 7) r = 1.0 - b;
  else r = o;
  fragColor = vec4(mix(base.rgb, r, acc.a), base.a);
}`},render(e){let t=e.params,n=Math.max(e.width,e.height),r=Math.max(1,Math.round(e.width/n*$r)),i=Math.max(1,Math.round(e.height/n*$r)),a=e.input,o=[];for(;a.width>r*2*1.5||a.height>i*2*1.5;){let t=Math.max(r*2,Math.ceil(a.width/2)),n=Math.max(i*2,Math.ceil(a.height/2)),s=e.pass(`down`,{width:t,height:n,inputs:{u_src:a},uniforms:{u_srcTexel:[.5/a.width,.5/a.height]}});o.push(s),a=s}let s=e.pass(`mask`,{width:r,height:i,format:`rgba8`,inputs:{u_src:a}});for(let t of o)e.release(t);let c=e.read(s);e.release(s);let l=new Float32Array(r*i);for(let e=0;e<r*i;e++)l[e]=c[e*4];let u=ii(l,r,i,O(t,`threshold`)),d=si(u,Math.round(O(t,`lineType`))),f=new Float32Array(128),p=new Float32Array(128),m=ni[Math.max(0,Math.min(3,Math.round(O(t,`paletteSet`))))];u.forEach((e,t)=>{f.set([e.x0,e.y0,e.x1,e.y1],t*4);let n=Math.imul(t+1,2654435761)>>>0;p.set([e.cx,e.cy,(n>>>7)%m.length,d[t]],t*4)});let h=new Float32Array(18);m.forEach((e,t)=>h.set(oi(e),t*3));let g=O(t,`captionSize`)*e.pxScale,_=Math.min(256,Math.max(16,2**Math.ceil(Math.log2(g*1.25)))),v=e.cached(`atlas:`+_,()=>ai(e.gl,_),e=>e?.tex.dispose());return e.pass(`main`,{inputs:v?{u_atlas:v.tex}:{},uniforms:{u_blobBox:f,u_blobInfo:p,u_blobCount:u.length,u_pal:h,u_glyphAspect:v?.aspect??.6}})}},{id:`paper-cutout`,name:`Paper cutout`,category:`Generate`,keywords:`paper cutout texture tear`,params:[_(`columns`,`Columns`,1,16,4),_(`rows`,`Rows`,1,16,4),_(`missing`,`Missing pieces`,0,100,0),_(`seed`,`Seed`,0,100,0),g(`rotation`,`Rotation`,0,180,4,.1,{group:`variation`}),g(`sizeVariation`,`Size variation`,0,2,0,.01,{group:`variation`}),g(`widthVariation`,`Width variation`,0,2,0,.01,{group:`variation`}),g(`heightVariation`,`Height variation`,0,2,0,.01,{group:`variation`}),g(`uvShift`,`UV shift`,0,1,.15,.01,{group:`variation`}),g(`colorVariation`,`Color variation`,0,1,.3,.01,{group:`variation`}),g(`tearSize`,`Tear size`,0,1,.65,.01,{group:`edges`}),g(`chunkSize`,`Chunk size`,0,1,.7,.01,{group:`edges`}),g(`roughness`,`Roughness`,0,5,.7,.01,{group:`edges`}),g(`whiteEdge`,`White edge`,0,1,.25,.01,{group:`edges`}),g(`unevenness`,`Unevenness`,0,1,.5,.01,{group:`edges`}),g(`shadow`,`Shadow`,0,1,.5,.01,{group:`background`}),y(`backgroundImage`,`Background image`,!0,{group:`background`}),b(`backgroundColor`,`Background color`,`#000000`,{group:`background`})],shaders:{main:`
${Wr}
uniform int u_reach; // neighbour cells to search on each side
struct Piece {
  vec2 c;      // centre (render px)
  vec2 hs;     // half size (render px)
  float ang;   // radians
  float z;     // stacking order
  vec4 rnd;    // colour variation randoms
  float sd;    // per-piece noise seed
  bool missing;
};
Piece piece(ivec2 cell, vec2 cs) {
  Piece P;
  uint s = uint(u_seed) * 2654435761u;
  vec3 a = vec3(pcg3d(uvec3(uvec2(cell + 4096), s))) / 4294967295.0;
  vec3 b = vec3(pcg3d(uvec3(uvec2(cell + 4096), s + 1013904223u))) / 4294967295.0;
  vec3 d = vec3(pcg3d(uvec3(uvec2(cell + 4096), s + 374761393u))) / 4294967295.0;
  vec3 e = vec3(pcg3d(uvec3(uvec2(cell + 4096), s + 668265263u))) / 4294967295.0;
  // UV shift jitters where each piece is cut; pieces grow with it so neighbours always overlap.
  P.c = (vec2(cell) + 0.5 + (d.xy * 2.0 - 1.0) * u_uvShift) * cs;
  float sz = max(0.05, 1.0 + u_sizeVariation * (a.x - 0.5));
  vec2 wh = vec2(max(0.05, 1.0 + u_widthVariation * (a.y - 0.5)), max(0.05, 1.0 + u_heightVariation * (a.z - 0.5)));
  P.hs = cs * 0.5 * (1.06 + 2.0 * u_uvShift) * sz * wh;
  P.ang = radians((b.x * 2.0 - 1.0) * 0.5 * u_rotation);
  P.z = b.y;
  P.missing = b.z < u_missing / 100.0;
  P.rnd = vec4(d.z, e);
  P.sd = e.x * 97.0;
  return P;
}
float sdBox(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
// Torn edge: box distance displaced by multi-scale noise in piece-local reference px.
float tornDist(vec2 l, Piece P) {
  vec2 lr = l / u_pxScale;
  float fs = mix(3.0, 45.0, u_chunkSize);
  vec2 q = lr / fs + P.sd;
  float r = u_roughness;
  float n = gradientNoise(q) + r * 0.4 * gradientNoise(q * 3.3 + 7.0) + r * 0.2 * gradientNoise(lr / 1.6 + 3.0)
    + r * 0.15 * (valueNoise(lr / 0.7 + P.sd) - 0.5);
  n /= 1.0 + r * 0.6;
  float amp = u_tearSize * 7.0 * (1.0 + u_unevenness * gradientNoise(lr / 140.0 + P.sd + 31.0));
  return sdBox(l, P.hs) + amp * n * u_pxScale;
}
vec2 localOf(vec2 p, Piece P) {
  return rot2(-P.ang) * (p - P.c);
}
vec3 pieceColor(vec2 p, Piece P, float dist) {
  vec2 l = localOf(p, P);
  // The piece carries the image region it was cut from (rotated with it).
  vec2 uv = (P.c + l) / u_resolution;
  vec3 col = texture(u_input, mirrorUv(uv)).rgb;
  // Colour variation: exposure, warmth and saturation per piece.
  float cv = u_colorVariation;
  col = mix(vec3(luma(col)), col, 1.0 + (P.rnd.x - 0.5) * 0.9 * cv);
  col *= 1.0 + (P.rnd.y - 0.5) * 0.5 * cv;
  col += (P.rnd.z - 0.5) * 0.14 * cv * vec3(1.0, 0.25, -0.7);
  col = mix(col, vec3(0.97, 0.96, 0.93), smoothstep(0.55, 1.0, P.rnd.w) * 0.55 * cv);
  vec2 lr = l / u_pxScale;
  // Paper tooth.
  col *= 1.0 + grainNoise(lr / 1.5, 5.0) * 0.018;
  // White torn rim: width varies along the edge, inner boundary is fibrous.
  float seg = smoothstep(-0.35, 0.55, gradientNoise(lr / 70.0 + P.sd + 13.0));
  float fib = 0.4 + 0.7 * valueNoise(lr / 3.0 + P.sd) + 0.5 * valueNoise(lr / 1.1 + P.sd + 17.0);
  float ww = u_whiteEdge * 22.0 * (0.15 + 1.1 * seg) * fib * u_pxScale;
  float rim = smoothstep(-ww - 0.6, -ww + 0.6, dist);
  vec3 paper = vec3(0.97, 0.965, 0.94) * (1.0 - 0.06 * valueNoise(lr / 2.0 + 5.0));
  return mix(col, paper, rim * step(0.001, u_whiteEdge));
}
void main() {
  vec2 cs = u_resolution / vec2(u_columns, u_rows);
  vec2 p = v_uv * u_resolution;
  ivec2 cell = ivec2(floor(p / cs));
  float aa = 0.75;
  // Topmost and second piece covering this pixel.
  Piece top = piece(cell, cs);
  Piece second = top;
  float zt = -1.0, zs = -1.0, at = 0.0, dt = 0.0, ds = 0.0;
  for (int j = -3; j <= 3; j++) {
    if (abs(j) > u_reach) continue;
    for (int i = -3; i <= 3; i++) {
      if (abs(i) > u_reach) continue;
      ivec2 cc = cell + ivec2(i, j);
      if (cc.x < 0 || cc.y < 0 || cc.x >= int(u_columns) || cc.y >= int(u_rows)) continue;
      Piece P = piece(cc, cs);
      if (P.missing) continue;
      vec2 l = localOf(p, P);
      if (sdBox(l, P.hs) > u_tearSize * 18.0 * u_pxScale + 2.0) continue;
      float d = tornDist(l, P);
      float a = 1.0 - smoothstep(-aa, aa, d);
      if (a <= 0.0) continue;
      if (P.z > zt) {
        if (at > 0.5) { second = top; zs = zt; ds = dt; }
        top = P; zt = P.z; at = a; dt = d;
      } else if (a > 0.5 && P.z > zs) {
        second = P; zs = P.z; ds = d;
      }
    }
  }
  vec3 bg = u_backgroundImage ? texture(u_input, v_uv).rgb : u_backgroundColor;
  vec3 below = zs >= 0.0 ? pieceColor(p, second, ds) : bg;
  vec3 col = zt >= 0.0 ? mix(below, pieceColor(p, top, dt), at) : bg;
  // Drop shadows from pieces stacked above the visible surface (soft, offset down-right).
  float surfaceZ = at > 0.5 ? zt : zs;
  vec2 off = vec2(2.0, -3.0) * u_pxScale;
  float soft = 6.0 * u_pxScale;
  float sh = 0.0;
  if (u_shadow > 0.0) {
    for (int j = -3; j <= 3; j++) {
      if (abs(j) > u_reach) continue;
      for (int i = -3; i <= 3; i++) {
        if (abs(i) > u_reach) continue;
        ivec2 cc = cell + ivec2(i, j);
        if (cc.x < 0 || cc.y < 0 || cc.x >= int(u_columns) || cc.y >= int(u_rows)) continue;
        Piece P = piece(cc, cs);
        if (P.missing || P.z <= surfaceZ) continue;
        float d = sdBox(localOf(p - off, P), P.hs);
        sh = max(sh, 1.0 - smoothstep(-soft, soft, d));
      }
    }
  }
  col *= 1.0 - u_shadow * 0.65 * sh;
  fragColor = vec4(col, texture(u_input, v_uv).a);
}`},render(e){let t=e.params,n=Math.max(1,O(t,`columns`)),r=Math.max(1,O(t,`rows`)),i=O(t,`uvShift`),a=(1.06+2*i)*(1+O(t,`sizeVariation`)*.5)*(1+Math.max(O(t,`widthVariation`),O(t,`heightVariation`))*.5),o=Math.min(O(t,`rotation`)*.5,45)*(Math.PI/180),s=O(t,`tearSize`)*14*e.pxScale/Math.min(e.width/n,e.height/r),c=.5*a*(Math.cos(o)+Math.sin(o))+i+s,l=Math.min(3,Math.max(1,Math.ceil(c-.5)));return e.pass(`main`,{uniforms:{u_reach:l}})}}],li=[`Fill`,`Stretch`,`Tile`],ui=1024,di=`
// Output uv -> texture uv. fit: 0 Fill (cover), 1 Stretch, 2 Tile (contain, repeated).
// zoom > 1 enlarges the texture, reps > 1 repeats it more often; rotation in degrees (clockwise).
vec2 fitTexUv(vec2 uv, vec2 res, vec2 texSize, int fit, float zoom, float reps, float rotDeg) {
  vec2 p = (uv - 0.5) * res;
  p = rot2(radians(rotDeg)) * p;
  p *= reps / max(zoom, 1e-4);
  if (fit == 1) return p / res + 0.5;
  vec2 r = res / texSize;
  float s = fit == 0 ? max(r.x, r.y) : min(r.x, r.y);
  return p / (texSize * s) + 0.5;
}
// Sample a user texture at an unwrapped texture uv. Tile repeats (sampler wrap = REPEAT); Fill/Stretch either
// mirror (seamless maps) or return transparent outside the texture (layers).
vec4 sampleFitted(sampler2D t, vec2 tuv, int fit, bool clampToClear) {
  vec2 dx = dFdx(tuv), dy = dFdy(tuv);
  if (fit == 2) return textureGrad(t, tuv, dx, dy);
  if (clampToClear) {
    if (any(lessThan(tuv, vec2(0.0))) || any(greaterThan(tuv, vec2(1.0)))) return vec4(0.0);
    return textureGrad(t, tuv, dx, dy);
  }
  return textureGrad(t, mirrorUv(tuv), dx, dy);
}
// Distance from p to the nearest Voronoi cell border (cell units) and the cell id (two-pass, IQ-style).
vec2 voronoiBorder(vec2 p) {
  vec2 n = floor(p), f = fract(p);
  vec2 mg, mr;
  float md = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + hash22(n + g) * 0.9 + 0.05 - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; id = hash12(n + g + 0.5); }
    }
  md = 8.0;
  for (int j = -2; j <= 2; j++)
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 r = g + hash22(n + g) * 0.9 + 0.05 - f;
      if (dot(mr - r, mr - r) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
    }
  return vec2(md, id);
}
`,fi=`
vec4 crackleTexture(vec2 tuv) {
  vec2 p = tuv * vec2(24.0, 21.0);
  // Gentle large warp keeps cells irregular; a fine warp makes the borders jagged but still angular.
  vec2 q = p + vec2(fbm(p * 0.25 + 1.3, 3), fbm(p * 0.25 + 7.1, 3)) * 0.5;
  q += vec2(gradientNoise(q * 3.1 + 2.0), gradientNoise(q * 3.1 + 8.0)) * 0.06;
  // Screen-space footprint in cell units for anti-aliasing.
  float aa = max(length(fwidth(q)), 1e-4) * 0.75;
  vec2 b1 = voronoiBorder(q);
  vec2 q2 = q * 2.2 + 11.0;
  vec2 b2 = voronoiBorder(q2);
  float wob = gradientNoise(q * 2.0) * 0.5 + 0.5;
  float region = fbm(p * 0.12 + 5.0, 3);
  // Main cracks vary in width and darkness along the network; secondary cracks split only some cells
  // and fade out partway.
  float w1 = 0.008 + 0.045 * wob * wob * (0.7 + region);
  float c1 = 1.0 - smoothstep(w1 - aa, w1 + aa, b1.x);
  float split = smoothstep(0.45, 0.6, fract(b1.y * 7.31) * 0.5 + gradientNoise(q * 0.6 + 3.0) * 0.5 + 0.25);
  split *= smoothstep(0.25, 0.55, gradientNoise(q2 * 0.9 + 17.0) * 0.5 + 0.5);
  float aa2 = aa * 2.2;
  float w2 = (0.008 + 0.025 * wob) * 2.2;
  float c2 = (1.0 - smoothstep(w2 - aa2, w2 + aa2, b2.x)) * split;
  // Base: light warm grey with mottling, fine pits, darker grime patches and grime along the cracks.
  float mott = fbm(p * 0.9 + 4.0, 4);
  float fine = valueNoise(p * 11.0) - 0.5;
  float pits = smoothstep(0.8, 0.95, valueNoise(p * 7.0 + 31.0)) * smoothstep(0.0, 0.5, mott + 0.2);
  float grime = smoothstep(0.05, 0.5, region) * (0.5 + 0.5 * fbm(p * 2.5, 3));
  vec3 base = vec3(0.9, 0.9, 0.89) + mott * 0.08 + fine * 0.05 - pits * 0.25 - grime * 0.16;
  base *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.1, b1.x)) * wob;
  vec3 crack = vec3(0.17, 0.17, 0.16) + 0.24 * (1.0 - wob) * (1.0 - region);
  vec3 c = mix(base, crack, max(c1, c2 * 0.75));
  return vec4(saturate(c), 1.0);
}
`,pi=`
vec4 speckleTexture(vec2 tuv) {
  vec2 p = tuv * 40.0;
  float m = fbm(p * 0.22 + 2.0, 4);
  float leaf = valueNoise(p * 2.7) - 0.5;
  vec3 c = vec3(0.13, 0.17, 0.13) + m * vec3(0.06, 0.08, 0.05) + leaf * 0.05;
  vec3 wv = worley(p + vec2(fbm(p * 0.5, 2), fbm(p * 0.5 + 9.0, 2)) * 0.6);
  float speck = (1.0 - smoothstep(0.06, 0.22, wv.x)) * step(0.8, wv.z);
  c = mix(c, vec3(0.46, 0.45, 0.22), speck * (0.5 + 0.5 * fract(wv.z * 13.0)));
  return vec4(saturate(c), 1.0);
}
`,mi=`
vec4 veinsTexture(vec2 tuv) {
  vec2 p = tuv * 8.0;
  vec2 w = vec2(fbm(p * 0.45 + 3.0, 3), fbm(p * 0.45 + 9.0, 3));
  vec3 v = worley(p + w * 0.9);
  float veins = 1.0 - smoothstep(0.0, 0.45, v.y - v.x);
  vec3 v2 = worley(p * 2.3 + w * 1.5 + 4.0);
  float veins2 = 1.0 - smoothstep(0.0, 0.3, v2.y - v2.x);
  float lump = smoothstep(0.0, 0.8, v.x);
  float soft = fbm(p * 0.8 + 1.0, 4);
  float g = 0.42 + 0.34 * veins * veins + 0.18 * veins2 - 0.18 * lump + 0.3 * soft;
  return vec4(vec3(saturate(g)), 1.0);
}
`,hi=e=>!!e.key,gi={id:`layer-mix`,name:`Layer Mix`,category:`Custom`,keywords:`blend blend-if curve lut mask mix modes ramp texture`,params:[E(`texture`,`Texture`),x(`fitType`,`Fit type`,li,0,`switcher`),D(`blendMode`,`Blend mode`,2),g(`opacity`,`opacity`,0,1,1),g(`scale`,`scale`,.1,5,1,.01,{group:`Edit`}),v(`rotation`,`rotation`,-180,180,0,{group:`Edit`}),w(`rgbCurve`,`RGB curve`,[[0,0],[1,1]],{group:`Edit`}),x(`channel`,`Channel`,[`Gray`,`Red`,`Green`,`Blue`],0,`select`,{group:`Blend`}),w(`thisLayer`,`This layer`,[[0,1],[1,1]],{group:`Blend`}),w(`underlyingLayer`,`Underlying layer`,[[0,1],[1,1]],{group:`Blend`}),y(`key`,`Key`,!1,{group:`Key`}),b(`keyColor`,`key color`,`#00c745`,{group:`Key`,visibleIf:hi}),g(`tolerance`,`tolerance`,0,1,.05,.01,{group:`Key`,visibleIf:hi}),g(`softness`,`softness`,0,.5,.1,.01,{group:`Key`,visibleIf:hi}),g(`despill`,`despill`,0,1,1,.01,{group:`Key`,visibleIf:hi}),x(`matte`,`Matte`,[`None`,`Alpha`,`Luma`],0,`select`,{group:`Matte`}),y(`invertMatte`,`Invert matte`,!1,{group:`Matte`})],shaders:{main:`
${di}
${fi}
float channelOf(vec3 c, int ch) {
  return ch == 1 ? c.r : ch == 2 ? c.g : ch == 3 ? c.b : luma(c);
}
void main() {
  vec4 base = texture(u_input, v_uv);
  vec2 texSize = u_textureLoaded ? u_textureSize : vec2(${ui}.0);
  vec2 tuv = fitTexUv(v_uv, u_resolution, texSize, u_fitType, u_scale, 1.0, u_rotation);
  vec4 tex;
  if (u_textureLoaded) {
    tex = sampleFitted(u_texture, tuv, u_fitType, true);
  } else {
    tex = crackleTexture(tuv);
    if (u_fitType != 2 && (any(lessThan(tuv, vec2(0.0))) || any(greaterThan(tuv, vec2(1.0))))) tex = vec4(0.0);
  }
  // Edit: tone curve on the layer.
  tex.rgb = vec3(lut1(u_rgbCurve, tex.r), lut1(u_rgbCurve, tex.g), lut1(u_rgbCurve, tex.b));
  float a = tex.a;
  if (u_key) {
    // Chroma key in CbCr (luma-independent), then remove the key colour's spill from what remains.
    vec3 t = rgb2ycbcr(saturate(tex.rgb));
    vec2 kc = rgb2ycbcr(u_keyColor).yz - 0.5;
    vec2 cc = t.yz - 0.5;
    float d = length(cc - kc) * 1.6;
    float k = smoothstep(u_tolerance, u_tolerance + u_softness + 1e-4, d);
    a *= k;
    float kl = length(kc);
    if (kl > 1e-4) {
      vec2 kd = kc / kl;
      float s = max(dot(cc, kd), 0.0);
      cc -= kd * min(s, kl) * u_despill;
      tex.rgb = ycbcr2rgb(vec3(t.x, cc + 0.5));
    }
  }
  // Blend if: ramps over this layer's and the underlying layer's channel value.
  float w = lut1(u_thisLayer, channelOf(saturate(tex.rgb), u_channel)) * lut1(u_underlyingLayer, channelOf(saturate(base.rgb), u_channel));
  vec3 blended = blendMode(u_blendMode, saturate(base.rgb), saturate(tex.rgb));
  vec3 rgb = mix(base.rgb, blended, saturate(u_opacity * a * w));
  float outA = base.a;
  if (u_matte > 0) {
    // Track matte: the layer's alpha or luma sets the visibility of the result.
    float m = u_matte == 1 ? a : luma(saturate(tex.rgb)) * a;
    if (u_invertMatte) m = 1.0 - m;
    outA *= m;
  }
  fragColor = vec4(rgb, outA);
}`}},_i=10,vi=72,yi=.9,bi=Array.from({length:_i},(e,t)=>`uniform sampler2D u_l${t+1};`).join(`
`),xi=Array.from({length:_i},(e,t)=>`  if (k == ${t+1}) return textureBSpline(u_l${t+1}, uv);`).join(`
`),Si={id:`texture-blur`,name:`Texture Blur`,category:`Custom`,params:[E(`texture`,`Texture`),x(`fitType`,`Fit type`,li,0,`switcher`),g(`textureScale`,`texture scale`,1,5,1),g(`blurStrength`,`blur strength`,0,.5,.5,.001),g(`highlightBoost`,`highlight boost`,0,1,0),g(`textureInfluence`,`texture influence`,0,1,1,.1),w(`strengthCurve`,`Strength curve`),y(`previewTexture`,`Preview texture`,!1)],shaders:{prep:`
uniform vec2 u_srcTexel;
vec4 weighted(vec2 uv) {
  vec3 c = srgbToLinear(texture(u_input, uv).rgb);
  float h = smoothstep(0.5, 1.0, luma(c));
  float w = 1.0 + u_highlightBoost * 8.0 * h * h;
  return vec4(c * w, w);
}
void main() {
  vec2 o = u_srcTexel;
  fragColor = 0.25 * (weighted(v_uv + vec2(-o.x, -o.y)) + weighted(v_uv + vec2(o.x, -o.y)) + weighted(v_uv + vec2(-o.x, o.y)) + weighted(v_uv + o));
}`,down:`
uniform sampler2D u_src;
uniform vec2 u_srcTexel;
void main() {
  vec2 o = u_srcTexel;
  vec4 c = texture(u_src, v_uv + vec2(-o.x, -o.y)) + texture(u_src, v_uv + vec2(o.x, -o.y))
         + texture(u_src, v_uv + vec2(-o.x, o.y)) + texture(u_src, v_uv + o);
  fragColor = c * 0.25;
}`,main:`
${di}
${pi}
${bi}
uniform int u_levels;
uniform float u_levelSigma;
// Cubic B-spline (smooth, no ringing) reconstruction from 4 bilinear taps.
vec4 textureBSpline(sampler2D t, vec2 uv) {
  vec2 size = vec2(textureSize(t, 0));
  vec2 st = uv * size - 0.5;
  vec2 i = floor(st), f = st - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 0.5 + w1 / g0) / size;
  vec2 h1 = (i + 1.5 + w3 / g1) / size;
  return (textureLod(t, vec2(h0.x, h0.y), 0.0) * g0.x + textureLod(t, vec2(h1.x, h0.y), 0.0) * g1.x) * g0.y
       + (textureLod(t, vec2(h0.x, h1.y), 0.0) * g0.x + textureLod(t, vec2(h1.x, h1.y), 0.0) * g1.x) * g1.y;
}
vec4 level(int k, vec2 uv) {
${xi}
  return textureBSpline(u_l1, uv);
}
vec4 weightedInput(vec2 uv) {
  vec3 c = srgbToLinear(texture(u_input, uv).rgb);
  float h = smoothstep(0.5, 1.0, luma(c));
  float w = 1.0 + u_highlightBoost * 8.0 * h * h;
  return vec4(c * w, w);
}
void main() {
  vec2 texSize = u_textureLoaded ? u_textureSize : vec2(${ui}.0);
  vec2 tuv = fitTexUv(v_uv, u_resolution, texSize, u_fitType, 1.0, u_textureScale, 0.0);
  vec3 tc = u_textureLoaded ? sampleFitted(u_texture, tuv, u_fitType, false).rgb : speckleTexture(tuv).rgb;
  if (u_previewTexture) {
    fragColor = vec4(tc, 1.0);
    return;
  }
  float s = mix(1.0, lut1(u_strengthCurve, luma(saturate(tc))), u_textureInfluence);
  float sigma = u_blurStrength * s * ${vi}.0 * u_pxScale;
  // Pyramid level with the matching sigma; below level 1 fade from the sharp input.
  float f = log2(max(sigma, 1e-4) / u_levelSigma);
  vec4 src = texture(u_input, v_uv);
  vec4 acc;
  if (f < 1.0) {
    float t = saturate(sigma / (u_levelSigma * 2.0));
    acc = mix(weightedInput(v_uv), level(1, v_uv), t);
  } else {
    float lf = min(f, float(u_levels));
    int k = int(floor(lf));
    vec4 a = level(k, v_uv);
    vec4 b = k < u_levels ? level(k + 1, v_uv) : a;
    acc = mix(a, b, lf - float(k));
  }
  vec3 c = linearToSrgb(acc.rgb / max(acc.a, 1e-4));
  fragColor = vec4(c, src.a);
}`},render(e){let t=e.params,n=O(t,`blurStrength`)*vi*e.pxScale,r=1;for(;r<_i&&yi*2**r<n&&Math.min(e.width,e.height)/2**(r+1)>=2;)r++;let i=[],a=Math.max(1,Math.ceil(e.width/2)),o=Math.max(1,Math.ceil(e.height/2));i.push(e.pass(`prep`,{width:a,height:o,uniforms:{u_srcTexel:[1/e.width,1/e.height]}}));for(let t=1;t<r;t++){let n=i[t-1];a=Math.max(1,Math.ceil(a/2)),o=Math.max(1,Math.ceil(o/2)),i.push(e.pass(`down`,{width:a,height:o,inputs:{u_src:n},uniforms:{u_srcTexel:[1/n.width,1/n.height]}}))}let s={};for(let e=0;e<_i;e++)s[`u_l${e+1}`]=i[Math.min(e,i.length-1)];let c=e.pass(`main`,{inputs:s,uniforms:{u_levels:i.length,u_levelSigma:yi}});for(let t of i)e.release(t);return c}},Ci=2048,wi=[gi,Si,{id:`texture-displacement`,name:`Displacement`,category:`Custom`,keywords:`displace distort map offset texture warp`,params:[E(`texture`,`Texture`),x(`fitType`,`Fit type`,li,0,`switcher`),g(`textureScale`,`texture scale`,1,5,1),w(`mapCurve`,`map curve`),x(`direction`,`Direction`,[`XY`,`X`,`Y`],0,`switcher`),g(`mapBlur`,`map blur`,0,50,0,.1),g(`amount`,`amount`,0,10,1),y(`debugMap`,`debug map`,!1)],shaders:{map:`
${di}
${mi}
void main() {
  vec2 texSize = u_textureLoaded ? u_textureSize : vec2(${ui}.0);
  vec2 tuv = fitTexUv(v_uv, u_resolution, texSize, u_fitType, 1.0, u_textureScale, 0.0);
  vec3 m = u_textureLoaded ? sampleFitted(u_texture, tuv, u_fitType, false).rgb : veinsTexture(tuv).rgb;
  fragColor = vec4(lut1(u_mapCurve, m.r), lut1(u_mapCurve, m.g), lut1(u_mapCurve, m.b), 1.0);
}`,main:`
uniform sampler2D u_map;
void main() {
  vec3 m = textureBicubic(u_map, v_uv).rgb;
  if (u_debugMap) {
    fragColor = vec4(saturate(m), 1.0);
    return;
  }
  // Map in image orientation: red pushes along +x, green along -y (down), as in top-left-origin maps.
  vec2 d = (m.rg - 0.5) * vec2(1.0, -1.0);
  if (u_direction == 1) d.y = 0.0;
  if (u_direction == 2) d.x = 0.0;
  // amount 1 shifts up to ~21 reference px at the map extremes.
  vec2 off = d * u_amount * 42.0 * u_pxScale / u_resolution;
  fragColor = texture(u_input, mirrorUv(v_uv - off));
}`},render(e){let t=Math.min(1,Ci/Math.max(e.width,e.height)),n=Math.max(1,Math.round(e.width*t)),r=Math.max(1,Math.round(e.height*t)),i=e.pass(`map`,{width:n,height:r}),a=O(e.params,`mapBlur`)*e.pxScale*t,o=i;a>.3&&(o=e.blur(i,a),e.release(i));let s=e.pass(`main`,{inputs:{u_map:o}});return e.release(o),s}}];i(`layer-mix-curve`,`layer-mix`),i(`displacement`,`texture-displacement`);var Ti=[`red`,`orange`,`yellow`,`green`,`aqua`,`blue`,`purple`,`magenta`],Ei=[.2126,.7152,.0722],Di=e=>e??[0,0,0];function Oi(e){let t=e.wb??[1,1,1],n=t[0]*Ei[0]+t[1]*Ei[1]+t[2]*Ei[2],r=2**(e.exposure??0),i=t.map(e=>e/n*r),a=e.matrix??[1,0,0,0,1,0,0,0,1],o=[0,1,2].map(e=>{let t=a.slice(e*3,e*3+3),n=t[0]+t[1]+t[2]||1;return t.map(e=>e/n)}),s=e.saturation??1,c=[0,1,2].map(e=>[0,1,2].map(t=>{let n=0;for(let r=0;r<3;r++)n+=((1-s)*Ei[r]+(e===r?s:0))*o[r][t];return n})),l=[c[0][0],c[1][0],c[2][0],c[0][1],c[1][1],c[2][1],c[0][2],c[1][2],c[2][2]],u=Di(e.blackRGB).map(t=>(e.black??0)+t),d=Di(e.whiteRGB).map(t=>(e.white??1)+t),f=Di(e.gammaRGB).map(t=>Math.max(.05,(e.gamma??1)*Math.exp(t))),p=Di(e.contrastRGB).map(t=>Math.max(-1,Math.min(1,(e.contrast??0)+t))),m=new Float32Array(24);Ti.forEach((t,n)=>{let r=e.hue?.[t];r&&(m[n*3]=r[0]*Math.PI/180,m[n*3+1]=r[1]-1,m[n*3+2]=r[2])});let h=e=>e?[e[1]*Math.cos(e[0]*Math.PI/180),e[1]*Math.sin(e[0]*Math.PI/180)]:[0,0],g=e.sat??1;return{u_fGain:i,u_fMat:l,u_fBlack:u,u_fWhite:d,u_fGamma:f,u_fContrast:p,u_fBand:m,u_fSat:[g*(e.satShadows??1),g,g*(e.satHighlights??1)],u_fSplit:[...h(e.shadows),...h(e.highlights)]}}function ki(e=`x: color strength, y: tone strength (center = 1×, edges 0× … 2×)`){return S(`amount`,`Amount`,[0,0],{hint:e})}function Ai(e){let t=e.amount??[0,0],n=e=>Math.max(0,Math.min(2,1+(Number.isFinite(e)?e:0)));return[n(t[0]),n(t[1])]}function ji(e,t){let n=Math.round(Number(t));return e[Math.max(0,Math.min(e.length-1,Number.isFinite(n)?n:0))]}var Mi=`
uniform vec3 u_fGain;
uniform mat3 u_fMat;
uniform vec3 u_fBlack;
uniform vec3 u_fWhite;
uniform vec3 u_fGamma;
uniform vec3 u_fContrast;
uniform vec3 u_fBand[8];
uniform vec3 u_fSat;
uniform vec4 u_fSplit;
uniform vec2 u_fAmt;

// OKLCh hue centres (radians) of the per-hue bands: red, orange, yellow, green, aqua, blue, purple, magenta.
const float F_BAND_HUE[8] = float[8](0.50615, 1.01229, 1.74533, 2.47837, 3.40339, 4.45059, 5.14872, 5.75959);

// Characteristic curve: power (midtone placement) -> smoothstep-blend S-curve -> black/white points.
vec3 filmTone(vec3 x) {
  vec3 xg = pow(clamp(x, 0.0, 1.0), u_fGamma);
  vec3 s = xg + u_fContrast * (xg * xg * (3.0 - 2.0 * xg) - xg);
  return u_fBlack + (u_fWhite - u_fBlack) * s;
}

// Per-hue tweaks, luminance-dependent saturation and split toning in OKLab.
vec3 filmColor(vec3 lab) {
  float C = length(lab.yz);
  float h = C > 1e-7 ? atan(lab.z, lab.y) : 0.0; // atan(0, 0) is undefined in GLSL
  vec3 adj = vec3(0.0);
  float wsum = 1e-5;
  for (int i = 0; i < 8; i++) {
    float d = abs(mod(h - F_BAND_HUE[i] + PI, TAU) - PI);
    float w = exp(-2.8495 * d * d); // gaussian, sigma = 24 deg
    adj += w * u_fBand[i];
    wsum += w;
  }
  adj /= wsum;
  float cw = smoothstep(0.0, 0.08, C);
  h += adj.x * cw;
  C *= max(1.0 + adj.y * cw, 0.0);
  float L = lab.x + adj.z * cw;
  float sh = 1.0 - smoothstep(0.0, 0.65, L);
  float hi = smoothstep(0.55, 1.0, L);
  C *= max(u_fSat.y + (u_fSat.x - u_fSat.y) * sh + (u_fSat.z - u_fSat.y) * hi, 0.0);
  vec2 ab = C * vec2(cos(h), sin(h)) + u_fSplit.xy * sh + u_fSplit.zw * hi;
  return vec3(L, ab);
}

// Out-of-gamut linear RGB is pulled toward its luminance instead of clipping channels (keeps hue).
vec3 filmGamut(vec3 lin) {
  float y = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  float mn = min(lin.r, min(lin.g, lin.b));
  if (mn < 0.0 && y > 0.0) lin = y + (lin - y) * (y / (y - mn));
  float mx = max(lin.r, max(lin.g, lin.b));
  if (mx > 1.0 && y < 1.0) lin = y + (lin - y) * ((1.0 - y) / (mx - y));
  return clamp(lin, 0.0, 1.0);
}

vec3 filmGradeLinear(vec3 lin) {
  lin = clamp(u_fMat * (lin * u_fGain), 0.0, 1.0);
  vec3 d = filmTone(linearToSrgb(lin));
  vec3 lab = filmColor(linearToOklab(srgbToLinear(clamp(d, 0.0, 1.0))));
  return linearToSrgb(filmGamut(oklabToLinear(lab)));
}

// Blend the graded result with the source: lightness by the tone amount, chroma by the color amount.
vec3 filmAmount(vec3 orig, vec3 graded) {
  if (u_fAmt == vec2(1.0)) return graded;
  vec3 a = linearToOklab(srgbToLinear(clamp(orig, 0.0, 1.0)));
  vec3 b = linearToOklab(srgbToLinear(graded));
  vec3 lab = vec3(mix(a.x, b.x, u_fAmt.y), mix(a.yz, b.yz, u_fAmt.x));
  return linearToSrgb(filmGamut(oklabToLinear(lab)));
}
`;function Ni(e=``,t=``){return`
${Mi}
${e}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 lin = srgbToLinear(clamp(src.rgb, 0.0, 1.0));
  ${t}
  vec3 graded = filmGradeLinear(lin);
  fragColor = vec4(filmAmount(src.rgb, graded), src.a);
}`}var Pi=[{name:`Kodak Portra 160`,black:.03,white:.92,gamma:.68,contrast:.45,blackRGB:[0,-.01,.01],whiteRGB:[.02,.01,-.03],gammaRGB:[0,.03,-.05],sat:.8,satShadows:1.05,satHighlights:1.2,hue:{orange:[2,.95,.01],green:[-6,.8,0],aqua:[0,.85,0],blue:[-4,.85,0]},shadows:[255,.012],highlights:[80,.012]},{name:`Kodak Portra 400`,black:.035,white:.93,gamma:.72,contrast:.5,blackRGB:[0,-.01,.01],whiteRGB:[.02,.005,-.04],gammaRGB:[-.02,.02,-.04],sat:.88,satShadows:.95,satHighlights:1.1,hue:{orange:[3,1,.01],yellow:[-4,.9,0],green:[-10,.8,0],blue:[-6,.9,0]},shadows:[220,.012],highlights:[75,.016]},{name:`Kodak Portra 800`,black:.04,white:.93,gamma:.74,contrast:.55,whiteRGB:[.02,0,-.04],gammaRGB:[-.04,0,.03],sat:.95,satShadows:.9,hue:{red:[2,1.03,0],orange:[2,1.04,0],green:[-8,.85,-.01],blue:[-8,.92,0]},shadows:[200,.015],highlights:[65,.018]},{name:`Kodak Ektar 100`,black:.02,white:.96,gamma:.85,contrast:.6,sat:1.15,satShadows:.85,hue:{red:[-2,1.12,-.01],orange:[-2,1.08,0],yellow:[-2,1.05,0],green:[3,1,-.01],aqua:[4,1.05,0],blue:[2,1.08,-.02]},shadows:[250,.01],highlights:[60,.006]},{name:`Kodak Gold 200`,wb:[1.03,1,.94],black:.03,white:.94,gamma:.78,contrast:.5,whiteRGB:[.015,.005,-.04],gammaRGB:[-.02,0,.04],sat:1.02,satShadows:.9,hue:{orange:[-2,1.04,.01],yellow:[-5,1.1,.01],green:[-10,.9,0],aqua:[-5,.9,0],blue:[-6,.9,0]},shadows:[40,.008],highlights:[80,.018]},{name:`Kodak Gold 800`,wb:[1.04,1,.92],black:.045,white:.93,gamma:.8,contrast:.6,whiteRGB:[.015,0,-.05],gammaRGB:[-.03,0,.05],sat:1.03,satShadows:.85,hue:{orange:[-1,1.05,0],yellow:[-5,1.08,0],green:[-10,.85,-.01],blue:[-5,.85,0]},shadows:[150,.015],highlights:[70,.022]},{name:`Kodak Ultramax 400`,wb:[1.02,1,.96],black:.025,white:.95,gamma:.8,contrast:.58,sat:1.05,satShadows:.9,hue:{red:[0,1.08,0],orange:[0,1.03,0],yellow:[-4,1.08,0],green:[-6,.95,0],blue:[-2,1,-.01]},shadows:[230,.01],highlights:[50,.012]},{name:`Fuji Pro 160NS`,wb:[.97,1,1.03],black:.035,white:.94,gamma:.72,contrast:.35,sat:.78,hue:{orange:[-3,.92,.01],yellow:[4,.85,0],green:[10,.85,0],aqua:[-3,.9,0],blue:[0,.85,0]},shadows:[200,.018],highlights:[150,.008]},{name:`Fuji Pro 400H`,wb:[.96,1,1],black:.05,white:.95,gamma:.68,contrast:.25,gammaRGB:[.03,-.02,0],sat:.78,hue:{orange:[-4,.9,.015],yellow:[8,.8,.01],green:[14,.85,.01],aqua:[-6,.95,0],blue:[-8,.85,0]},shadows:[210,.02],highlights:[165,.016]},{name:`Fuji Superia 200`,wb:[.97,1.02,1],black:.03,white:.95,gamma:.8,contrast:.55,sat:1,satShadows:.85,hue:{red:[-4,1.05,0],orange:[-3,.98,0],green:[6,1.08,-.01],aqua:[0,1.03,0],blue:[-6,.95,0]},shadows:[165,.018],highlights:[330,.005]},{name:`Fuji Superia 400`,wb:[.96,1.02,1.02],black:.035,white:.95,gamma:.8,contrast:.58,sat:1.03,satShadows:.85,hue:{red:[-5,1.04,0],orange:[-4,.98,0],yellow:[5,1,0],green:[8,1.1,-.01],aqua:[-4,1.05,0],blue:[-8,.95,0]},shadows:[175,.025],highlights:[100,.006]},{name:`Fuji Superia 800`,wb:[.96,1.03,1],black:.04,white:.94,gamma:.82,contrast:.62,sat:1,satShadows:.85,hue:{red:[-5,1,0],green:[8,1.05,-.01],blue:[-6,.95,0]},shadows:[160,.03],highlights:[90,.01]},{name:`Fuji Natura 1600`,wb:[.95,1.02,1.05],black:.06,white:.93,gamma:.82,contrast:.55,sat:.88,hue:{red:[-6,.85,0],orange:[-4,.9,0],green:[6,.95,0],aqua:[0,1.05,0],blue:[-4,1,0]},shadows:[185,.035],highlights:[110,.01]},{name:`Agfa Vista 100`,wb:[1.02,1,.98],black:.025,white:.95,gamma:.82,contrast:.62,sat:1.08,satShadows:.85,hue:{red:[2,1.15,-.01],orange:[0,1.04,0],yellow:[-3,1.04,0],green:[2,1,0],aqua:[4,1.1,0],blue:[-6,1.05,-.02]},shadows:[240,.012],highlights:[55,.01]},{name:`Agfa Optima 200`,wb:[1.02,1,.97],black:.03,white:.95,gamma:.78,contrast:.5,sat:1,satShadows:.9,hue:{red:[1,1.08,0],orange:[0,1,.005],green:[-4,.9,0],blue:[-3,.95,0]},shadows:[260,.01],highlights:[70,.01]}],Fi={id:`film-classic`,name:`Classic Film`,category:`Film`,keywords:`classic film filter color negative analog kodak portra ektar gold fuji superia pro 400h agfa film LUT color grading`,params:[x(`stock`,`Film stock`,Pi.map(e=>e.name),0,`slider`),ki()],uniforms:e=>({...Oi(ji(Pi,e.stock)),u_fAmt:Ai(e)}),shaders:{main:Ni()}},Ii=[{name:`Agfacolor 40s`,black:.06,white:.9,gamma:1.02,contrast:.65,blackRGB:[-.02,.01,.01],whiteRGB:[.015,.015,-.03],gammaRGB:[.09,-.05,-.04],sat:.62,hue:{yellow:[-2,.9,-.03],blue:[-10,1.05,-.01]},shadows:[140,.035],highlights:[300,.03]},{name:`Agfacolor 50s`,black:.05,white:.92,gamma:.95,contrast:.55,gammaRGB:[.03,-.02,-.02],sat:.75,hue:{red:[-6,1.05,0],orange:[-3,.95,0],yellow:[-4,.85,-.02],green:[10,.8,0],blue:[-12,.95,0]},shadows:[170,.03],highlights:[60,.02]},{name:`Agfacolor 60s`,black:.04,white:.94,gamma:.95,contrast:.7,sat:.9,hue:{red:[-4,1.1,-.01],orange:[-2,1.02,0],yellow:[-6,.95,0],green:[8,.85,-.01],blue:[-14,1,-.01]},shadows:[190,.025],highlights:[45,.02]},{name:`Autochrome`,wb:[1.05,1,.85],black:.08,white:.86,gamma:1.05,contrast:.2,sat:.6,hue:{red:[10,.9,0],green:[-10,1,-.02],blue:[15,.8,0],purple:[0,.9,0]},shadows:[70,.03],highlights:[80,.03]},{name:`Kodachrome 1958`,wb:[1.04,1,.92],black:0,white:.96,gamma:.95,contrast:.75,sat:1.05,hue:{red:[-2,1.15,-.02],orange:[2,1.05,0],yellow:[-6,1.1,0],green:[-8,.85,-.02],aqua:[-5,.9,0],blue:[-6,.88,-.03]},shadows:[30,.012],highlights:[75,.02]},{name:`Kodachrome 70s`,wb:[1.05,.98,.92],black:.07,white:.92,gamma:.92,contrast:.45,sat:.8,hue:{red:[0,1.05,0],yellow:[-8,.9,0],green:[-10,.75,0],blue:[-8,.75,0]},shadows:[340,.02],highlights:[55,.03]},{name:`Kodachrome Classic`,black:0,white:.97,gamma:.92,contrast:.8,sat:1.06,satShadows:.88,hue:{red:[-2,1.12,-.02],orange:[0,1.05,0],yellow:[-4,1.1,0],green:[-4,.95,-.02],blue:[-2,1.08,-.04]},shadows:[240,.008],highlights:[70,.01]},{name:`Technicolor 2`,matrix:[1,0,0,.05,.75,.2,0,.75,.25],black:.03,white:.94,gamma:.95,contrast:.55,hue:{red:[8,1,0],aqua:[-15,.9,0]},shadows:[200,.015],highlights:[50,.02]},{name:`Technicolor 2 v2`,matrix:[1,0,0,.1,.7,.2,.05,.55,.4],black:.02,white:.95,gamma:.92,contrast:.65,hue:{red:[-6,1.05,0],aqua:[10,1,0]},shadows:[210,.012],highlights:[20,.015]}],Li={id:`film-vintage`,name:`Vintage Film`,category:`Film`,keywords:`vintage film filter retro photo old film analog kodachrome technicolor agfacolor color grading`,params:[x(`stock`,`Film stock`,Ii.map(e=>e.name),0,`slider`),ki()],uniforms:e=>({...Oi(ji(Ii,e.stock)),u_fAmt:Ai(e)}),shaders:{main:Ni()}},Ri=[.66,.33,.01],zi=[{name:`Agfa Scala 200`,weights:[.236,.716,.048],look:{black:-.028,white:.965,gamma:1.035,contrast:.17}},{name:`Ilford Delta 100`,weights:[.27,.62,.11],look:{black:0,white:.98,gamma:1,contrast:.3}},{name:`Ilford Delta 400`,weights:[.28,.6,.12],look:{black:.02,white:.97,gamma:.97,contrast:.22}},{name:`Ilford Delta 3200`,weights:[.3,.58,.12],look:{black:.07,white:.94,gamma:.92,contrast:.05,shadows:[250,.004]}},{name:`Ilford FP4`,weights:[.18,.65,.17],look:{black:0,white:.97,gamma:1,contrast:.35}},{name:`Ilford HP5`,weights:[.24,.62,.14],look:{black:.03,white:.96,gamma:.95,contrast:.18}},{name:`Kodak Tri-X 200`,weights:[.32,.58,.1],look:{black:-.02,white:.98,gamma:1.05,contrast:.55,shadows:[70,.005],highlights:[80,.004]}}],Bi={id:`film-bw`,name:`Black & White`,category:`Film`,keywords:`black white bw monochrome lut film fuji ilford kodak`,params:[x(`stock`,`Film stock`,zi.map(e=>e.name),0,`slider`),ki(`x: color (left = original color, center = B&W, right = red contrast filter), y: tone strength`)],uniforms:e=>{let t=ji(zi,e.stock),[n,r]=Ai(e),i=Math.max(0,n-1),a=t.weights.map((e,t)=>e+(Ri[t]-e)*i),o=a[0]+a[1]+a[2]||1,s=a.map(e=>e/o);return{...Oi({name:t.name,...t.look,matrix:[...s,...s,...s]}),u_fAmt:[Math.min(1,n),r]}},shaders:{main:Ni()}},Vi=[{name:`Infrared Classic`,ir:{weights:[.4,.6,0],foliage:1.5,mix:1},black:.03,white:1,gamma:.88,contrast:.35,blackRGB:[.05,0,0],sat:1.15,satHighlights:.7,hue:{red:[10,1,0],orange:[-55,1.2,.02],yellow:[-75,.5,.02],aqua:[10,1,0],blue:[-45,.45,-.02],purple:[-75,.8,0],magenta:[-45,.9,0]},shadows:[200,.02],highlights:[215,.022]},{name:`Infrared Pastel`,ir:{weights:[.4,.6,0],foliage:1.3,mix:1,blue:[.25,0,.75]},black:.09,white:.96,gamma:.78,contrast:0,sat:.72,satHighlights:.6,hue:{red:[0,.9,.02],orange:[-50,.9,.03],yellow:[-80,.5,.02],aqua:[5,.9,.02],blue:[-40,.8,.02],purple:[-40,.9,.02],magenta:[-20,1,.03]},shadows:[285,.025],highlights:[210,.02]},{name:`Infrared Muted`,ir:{weights:[.4,.6,0],foliage:1.2,mix:.85},black:.06,white:.92,gamma:.92,contrast:.25,sat:.6,satHighlights:.6,hue:{orange:[-45,.9,.01],yellow:[-70,.5,0],blue:[-45,.8,-.01],purple:[-45,.85,0],magenta:[-20,.9,0]},shadows:[210,.02],highlights:[60,.012]},{name:`Infrared Rust`,ir:{weights:[.45,.55,0],foliage:1.4,mix:1,green:[.3,.7,0],blue:[0,.75,.25]},black:.03,white:.95,gamma:.95,contrast:.5,sat:1.2,satHighlights:.8,hue:{red:[12,1.05,0],orange:[-6,1.1,-.01],yellow:[-35,.9,0],aqua:[0,.9,0],blue:[-35,.85,-.02],purple:[-30,.85,0]},shadows:[50,.02],highlights:[60,.02]},{name:`Infrared Deep`,ir:{weights:[.4,.6,0],foliage:1.4,mix:1},black:0,white:.97,gamma:1.05,contrast:.7,sat:1.25,satHighlights:.7,hue:{red:[5,1.05,-.02],orange:[-55,1.1,0],yellow:[-75,.7,-.02],aqua:[8,1.05,-.03],blue:[-55,1,-.06],purple:[-55,1,-.04],magenta:[-30,1.05,-.03]},shadows:[215,.035],highlights:[200,.02]}],Hi={id:`film-infrared`,name:`Infrared Film`,category:`Film`,keywords:`infrared filter aerochrome false color IR red foliage surreal film LUT color grading`,params:[x(`stock`,`Style`,Vi.map(e=>e.name),0,`slider`),ki()],uniforms:e=>{let t=ji(Vi,e.stock);return{...Oi(t),u_irW:t.ir.weights,u_irP:[t.ir.foliage,t.ir.mix],u_irG:t.ir.green??[0,1,0],u_irB:t.ir.blue??[0,0,1],u_fAmt:Ai(e)}},shaders:{main:Ni(`
uniform vec3 u_irW;
uniform vec2 u_irP;   // x: vegetation IR boost, y: false-color mix
uniform vec3 u_irG;   // output green from (IR, R, G)
uniform vec3 u_irB;   // output blue from (IR, R, G)

// Vegetation heuristic: yellow-green..green hues with some saturation, not black.
float foliageMask(vec3 s) {
  vec3 hsv = rgb2hsv(clamp(s, 0.0, 1.0));
  float d = abs(fract(hsv.x - 0.31 + 0.5) - 0.5);
  return (1.0 - smoothstep(0.10, 0.20, d)) * smoothstep(0.05, 0.3, hsv.y) * smoothstep(0.02, 0.15, hsv.z);
}

vec3 irStage(vec3 lin) {
  float fol = foliageMask(linearToSrgb(lin));
  float lum = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  float ir = dot(lin, u_irW) + u_irP.x * fol * (0.1 + lum);
  vec3 src3 = vec3(ir, lin.r, lin.g);
  vec3 cir = vec3(ir, dot(src3, u_irG), dot(src3, u_irB));
  return clamp(mix(lin, cir, u_irP.y * fol), 0.0, 1.0);
}
`,`lin = irStage(lin);`)}},Ui=[{name:`Polaroid 600`,black:0,white:.88,gamma:.83,contrast:.18,blackRGB:[-.035,.025,.01],whiteRGB:[-.015,-.025,.04],gammaRGB:[.05,-.02,-.04],sat:.69,satShadows:1.08,satHighlights:.9,hue:{orange:[4,1,-.035],yellow:[0,1,-.05],blue:[-10,1.15,.01],purple:[-12,.97,.03]},shadows:[225,.05],highlights:[55,.005]},{name:`Polaroid 600 Golden`,wb:[1.05,1,.9],black:.01,white:.9,gamma:.82,contrast:.2,blackRGB:[-.03,.015,.01],whiteRGB:[.02,0,-.06],gammaRGB:[0,-.01,.03],sat:.78,satShadows:1.05,hue:{orange:[2,1,-.02],yellow:[-4,1.08,-.02],green:[-10,.85,0],blue:[-8,1,0]},shadows:[240,.03],highlights:[75,.035]},{name:`Polaroid 600 Expired`,wb:[1.1,.95,.85],black:.1,white:.82,gamma:.85,contrast:-.1,blackRGB:[.01,-.02,.02],gammaRGB:[-.05,0,.08],sat:.55,hue:{green:[-15,.6,0],blue:[-20,.7,0]},shadows:[330,.04],highlights:[70,.05]},{name:`Polaroid 669`,wb:[.92,1,1.08],black:.06,white:.9,gamma:.9,contrast:.15,sat:.7,hue:{orange:[-5,.85,0],green:[10,.8,0],blue:[-10,.95,0]},shadows:[220,.04],highlights:[180,.015]},{name:`Polaroid 669 Expired`,wb:[.9,1,1.05],black:.12,white:.85,gamma:.88,contrast:-.15,sat:.55,hue:{orange:[-15,.8,0],blue:[-12,.8,0]},shadows:[190,.05],highlights:[350,.035]},{name:`Polaroid 690`,wb:[1.03,1,.97],black:.03,white:.92,gamma:.88,contrast:.35,sat:.9,hue:{red:[0,1.05,0],orange:[2,1,0],blue:[-8,1,0]},shadows:[230,.035],highlights:[60,.015]},{name:`Polaroid 690 Expired`,wb:[1.08,.94,.98],black:.1,white:.86,gamma:.86,contrast:-.05,sat:.62,hue:{orange:[-8,.9,0],green:[-10,.7,0],blue:[-15,.8,0]},shadows:[300,.04],highlights:[20,.04]},{name:`Instax Mini`,wb:[.97,1.01,1.02],black:.02,white:.97,gamma:.85,contrast:.45,sat:.95,hue:{orange:[-4,.95,.02],green:[6,1,0],blue:[-6,1,0]},shadows:[190,.025],highlights:[150,.012]},{name:`Instax Mini Deep`,wb:[.98,1,1.02],black:0,white:.96,gamma:.95,contrast:.6,sat:1,satShadows:.85,hue:{orange:[-3,1,0],green:[6,1.05,-.01],blue:[-6,1.05,-.02]},shadows:[210,.03],highlights:[80,.01]},{name:`Fuji FP-100C`,wb:[.95,1,1.06],black:.06,white:.95,gamma:.85,contrast:.25,sat:.85,hue:{orange:[-8,.9,.01],yellow:[5,.85,0],green:[10,.9,0],blue:[-5,1.05,0]},shadows:[235,.04],highlights:[200,.012]},{name:`Fuji FP-100C Warm`,wb:[1.04,1,.95],black:.06,white:.95,gamma:.85,contrast:.25,sat:.88,hue:{orange:[-4,.95,.01],yellow:[0,.95,0],green:[6,.9,0],blue:[-5,1,0]},shadows:[250,.025],highlights:[60,.025]},{name:`Fuji FP-100C Cool`,wb:[.9,1,1.1],black:.06,white:.95,gamma:.85,contrast:.25,sat:.82,hue:{orange:[-8,.88,.01],yellow:[6,.8,0],green:[12,.9,0],blue:[-6,1.05,0]},shadows:[215,.05],highlights:[195,.025]},{name:`Fuji FP-100C Expired`,wb:[.97,.98,1.06],black:.12,white:.88,gamma:.85,contrast:-.1,sat:.6,hue:{orange:[-12,.8,0],green:[10,.75,0],blue:[-10,.85,0]},shadows:[290,.045],highlights:[170,.03]}],Wi={id:`film-instant`,name:`Instant Film`,category:`Film`,keywords:`instant film filter polaroid instax fuji fp-100c expired retro snapshot film LUT color grading`,params:[x(`stock`,`Film stock`,Ui.map(e=>e.name),0,`slider`),ki()],uniforms:e=>({...Oi(ji(Ui,e.stock)),u_fAmt:Ai(e)}),shaders:{main:Ni()}},U=[1,.85,1.25],Gi=[{name:`Agfa APX 400`,size:5,strength:1,chroma:0,rough:.6,clump:.5},{name:`Agfa HDC 100`,size:3.6,strength:.55,chroma:.5,rough:.5,clump:.35,rgb:U},{name:`Agfa HDC 400`,size:4.7,strength:.85,chroma:.55,rough:.55,clump:.45,rgb:U},{name:`Fuji Pro 160S`,size:3.2,strength:.45,chroma:.4,rough:.45,clump:.3,rgb:U},{name:`Fuji Pro 400H`,size:4,strength:.65,chroma:.45,rough:.5,clump:.4,rgb:U},{name:`Fuji Provia 100F`,size:2.9,strength:.35,chroma:.35,rough:.4,clump:.25,rgb:U},{name:`Fuji Superia 200 I`,size:4,strength:.7,chroma:.55,rough:.55,clump:.4,rgb:U},{name:`Fuji Superia 200 II`,size:4.3,strength:.8,chroma:.6,rough:.6,clump:.45,rgb:U},{name:`Fuji Superia Reala 100`,size:3.2,strength:.5,chroma:.45,rough:.45,clump:.3,rgb:U},{name:`Ilford Delta 3200`,size:7.2,strength:1.6,chroma:0,rough:.7,clump:.6},{name:`Ilford HP5 400`,size:5.4,strength:1.05,chroma:0,rough:.6,clump:.5},{name:`Ilford Kentmere 400`,size:5.8,strength:1.2,chroma:0,rough:.65,clump:.55},{name:`Ilford XP2 400`,size:4.3,strength:.6,chroma:0,rough:.3,clump:.4},{name:`Kodak Ektachrome E100`,size:2.9,strength:.35,chroma:.35,rough:.4,clump:.25,rgb:U},{name:`Kodak Portra 800`,size:4.7,strength:.85,chroma:.45,rough:.5,clump:.45,rgb:U},{name:`Kodak T-Max 3200`,size:6.8,strength:1.5,chroma:0,rough:.7,clump:.55},{name:`Kodak Tri-X 400`,size:5.4,strength:1.15,chroma:0,rough:.75,clump:.5},{name:`Rollei R3 200`,size:4.3,strength:.8,chroma:0,rough:.55,clump:.45}],Ki=24,qi=[Fi,Li,Bi,Hi,Wi,{id:`film-grain`,name:`Film Grain`,category:`Film`,keywords:`analog emulsion film grain noise scan texture vintage`,animated:!0,params:[x(`stock`,`Film stock`,Gi.map(e=>e.name),0,`slider`),g(`amount`,`Amount`,0,1,.5),g(`highlights`,`Highlights`,0,1,.5),g(`midtones`,`Midtones`,0,1,1),g(`shadows`,`Shadows`,0,1,.5),_(`frameInterval`,`Frame Interval`,0,60,0,{hint:`Frames (24 fps) between grain changes; 0 = static grain`})],uniforms:(e,t)=>{let n=ji(Gi,e.stock),r=Math.round(O(e,`frameInterval`)),i=r>0?Math.floor(t.time*Ki/r+1e-4):0,a=n.rough,o=n.clump;return{u_gShape:[n.size,a,o,1/Math.sqrt(1+a*a+o*o)],u_gAmp:[n.strength*.03,n.chroma],u_gRGB:n.rgb??[1,1,1],u_gSeed:i*.6180339887%1*997}},shaders:{main:`
uniform vec4 u_gShape;  // cell size (ref px), fine weight, coarse weight, normalisation
uniform vec2 u_gAmp;    // amplitude at Amount = 1 (display units, std), chroma
uniform vec3 u_gRGB;
uniform float u_gSeed;

// Zero-mean, roughly unit-variance grain field (p in noise cells): base + fine + coarse octaves of
// gradient noise, each rotated so the lattices never line up.
float grainField(vec2 p, float k) {
  vec2 o = vec2(k * 131.7 + u_gSeed, k * 71.3 - u_gSeed * 0.7);
  float n = gradientNoise(p + o);
  n += u_gShape.y * gradientNoise(mat2(0.454, 0.891, -0.891, 0.454) * p * 2.07 + o.yx + 19.1);
  n += u_gShape.z * gradientNoise(mat2(0.878, -0.479, 0.479, 0.878) * p * 0.47 + o + 47.9);
  return n * u_gShape.w * 3.27;
}

void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = src.rgb;
  // Grain lives in reference pixels; below ~2 render px per cell it is evaluated at 2 px and
  // attenuated like an area average, so downscaled previews keep the same overall texture.
  vec2 px = v_uv * u_resolution;
  float cellPx = u_gShape.x * u_pxScale;
  float cell = max(cellPx, 2.0);
  float atten = cellPx / cell;
  vec2 p = px / cell;

  float l = luma(clamp(c, 0.0, 1.0));
  float sh = 1.0 - smoothstep(0.0, 0.5, l);
  float hi = smoothstep(0.5, 1.0, l);
  float resp = u_shadows * sh + u_midtones * (1.0 - sh - hi) + u_highlights * hi;
  // Grain fades into paper white and slightly into maximum black (print toe / shoulder).
  resp *= (1.0 - 0.95 * smoothstep(0.55, 1.0, l)) * (0.25 + 0.75 * smoothstep(0.0, 0.12, l));
  float amp = u_amount * u_gAmp.x * resp * atten;

  float mono = grainField(p, 0.0);
  vec3 g = vec3(mono);
  if (u_gAmp.y > 0.0) {
    vec3 col = vec3(grainField(p, 1.0), grainField(p, 2.0), grainField(p, 3.0));
    float ch = u_gAmp.y;
    g = (mono * (1.0 - ch) + col * ch) / sqrt((1.0 - ch) * (1.0 - ch) + ch * ch) * u_gRGB;
  }
  fragColor = vec4(max(c + g * amp, 0.0), src.a);
}`}},{id:`halation`,name:`Halation`,category:`Film`,keywords:`analog film halation glow bloom highlight halo lens vintage`,params:[g(`threshold`,`Threshold`,0,1,.6),g(`knee`,`Knee`,.01,.8,.25),g(`boost`,`Boost`,0,1,.5),g(`localDiffusion`,`Local Diffusion`,.005,.2,.04,.005,{hint:`Radius of the tight halo, relative to the image size`}),g(`globalDiffusion`,`Global Diffusion`,0,.4,.12,.005,{hint:`Radius of the wide glow, relative to the image size`}),g(`intensity`,`Intensity`,0,1,.7),g(`hue`,`Hue`,0,1,.5,.01,{hint:`0.5 = red; lower toward magenta, higher toward orange/yellow`}),g(`backgroundGain`,`Background Gain`,0,1,.85,.01,{hint:`Strength of the wide glow`}),g(`compensation`,`Compensation`,0,1,.5,.01,{hint:`Holds the halo back on already bright pixels (0 = plain add, 1 = screen)`})],shaders:{extract:`
void main() {
  float l = luma(max(texture(u_input, v_uv).rgb, 0.0));
  float k = max(u_knee, 1e-3);
  float x = l - u_threshold;
  float soft = clamp(x + k, 0.0, 2.0 * k);
  float e = max(soft * soft / (4.0 * k), x); // soft-knee excess above the threshold
  // Linear-light energy of the part above the threshold; Boost expands the brightest highlights.
  float energy = srgbToLinear(vec3(l)).x * (e / max(l, 1e-4)) * (1.0 + 8.0 * u_boost * min(e, 1.0));
  fragColor = vec4(vec3(max(energy, 0.0)), 1.0);
}`,composite:`
uniform sampler2D u_local;
uniform sampler2D u_global;
uniform float u_globalW;
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 lin = srgbToLinear(max(src.rgb, 0.0));
  float h = 1.35 * texture(u_local, v_uv).r + u_globalW * texture(u_global, v_uv).r;
  vec3 tint = srgbToLinear(hue2rgb(fract(u_hue + 0.5)));
  vec3 add = tint * h * u_intensity * 0.29;
  lin += add * (1.0 - u_compensation * clamp(lin, 0.0, 1.0));
  fragColor = vec4(linearToSrgb(lin), src.a);
}`},render(e){let t=Math.max(e.width,e.height),n=e.pass(`extract`),r=e.blur(n,.19*O(e.params,`localDiffusion`)*t),i=O(e.params,`globalDiffusion`),a=i>0?e.blur(n,.28*i*t):null;e.release(n);let o=e.pass(`composite`,{inputs:{u_local:r,u_global:a??r},uniforms:{u_globalW:a?1.57*O(e.params,`backgroundGain`):0}});return e.release(r),a&&e.release(a),o}}];i(`classic-film`,`film-classic`),i(`vintage-film`,`film-vintage`),i(`black-white`,`film-bw`),i(`infrared-film`,`film-infrared`),i(`instant-film`,`film-instant`),r([...Ee,...zt,...tn,...Nr,...ci,...wi,...qi]);var Ji=`
#define PI 3.14159265359
#define TAU 6.28318530718
#define saturate(x) clamp(x, 0.0, 1.0)

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float luma601(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec3 srgbToLinear(vec3 c) {
  c = max(c, 0.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 gammaDecode(vec3 c, float g) { return pow(max(c, 0.0), vec3(g)); }
vec3 gammaEncode(vec3 c, float g) { return pow(max(c, 0.0), vec3(1.0 / g)); }

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 hue2rgb(float h) {
  return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
}
vec3 rgb2hsl(vec3 c) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5;
  float d = mx - mn;
  if (d < 1e-6) return vec3(0.0, 0.0, l);
  float s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
  float h;
  if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return vec3(h / 6.0, s, l);
}
vec3 hsl2rgb(vec3 hsl) {
  vec3 rgb = hue2rgb(hsl.x);
  float c = (1.0 - abs(2.0 * hsl.z - 1.0)) * hsl.y;
  return (rgb - 0.5) * c + hsl.z;
}

// OKLab (Björn Ottosson), input/output linear sRGB.
vec3 linearToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = sign(l) * pow(abs(l), 1.0 / 3.0);
  m = sign(m) * pow(abs(m), 1.0 / 3.0);
  s = sign(s) * pow(abs(s), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 oklabToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 srgbToOklch(vec3 c) {
  vec3 lab = linearToOklab(srgbToLinear(c));
  return vec3(lab.x, length(lab.yz), atan(lab.z, lab.y));
}
vec3 oklchToSrgb(vec3 lch) {
  return linearToSrgb(oklabToLinear(vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z))));
}

vec3 rgb2ycbcr(vec3 c) {
  return vec3(
    0.299 * c.r + 0.587 * c.g + 0.114 * c.b,
    -0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b + 0.5,
    0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b + 0.5);
}
vec3 ycbcr2rgb(vec3 c) {
  float y = c.x, cb = c.y - 0.5, cr = c.z - 0.5;
  return vec3(y + 1.402 * cr, y - 0.344136 * cb - 0.714136 * cr, y + 1.772 * cb);
}
vec3 rgb2yiq(vec3 c) {
  return mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * c;
}
vec3 yiq2rgb(vec3 c) {
  return mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * c;
}

// Approximate blackbody color (Tanner Helland fit), kelvin 1000..40000, returns sRGB 0..1.
vec3 kelvinToRgb(float k) {
  float t = k / 100.0;
  vec3 c;
  if (t <= 66.0) {
    c.r = 1.0;
    c.g = clamp(0.39008157876 * log(t) - 0.63184144378, 0.0, 1.0);
    c.b = t <= 19.0 ? 0.0 : clamp(0.54320678911 * log(t - 10.0) - 1.19625408914, 0.0, 1.0);
  } else {
    c.r = clamp(1.29293618606 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
    c.g = clamp(1.12989086089 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
    c.b = 1.0;
  }
  return c;
}

// ---------- hashing & noise (integer hashes are stable across GPUs) ----------
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
uvec2 pcg2d(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v = v ^ (v >> 16u);
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v = v ^ (v >> 16u);
  return v;
}
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
float hash11(float p) { return float(pcg(floatBitsToUint(p))) / 4294967295.0; }
float hash12(vec2 p) { uvec2 q = pcg2d(uvec2(ivec2(floor(p)) + 32768)); return float(q.x ^ q.y) / 4294967295.0; }
vec2 hash22(vec2 p) { return vec2(pcg2d(uvec2(ivec2(floor(p)) + 32768))) / 4294967295.0; }
vec3 hash32(vec2 p) { return vec3(pcg3d(uvec3(ivec2(floor(p)) + 32768, 7u))) / 4294967295.0; }
vec3 hash33(vec3 p) { return vec3(pcg3d(uvec3(ivec3(floor(p)) + 32768))) / 4294967295.0; }
float hash13(vec3 p) { return hash33(p).x; }
// Continuous-input hash (for non-integer coordinates, e.g. seeds).
float hashf(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }

float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float valueNoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1, 0, 0)), n010 = hash13(i + vec3(0, 1, 0)), n110 = hash13(i + vec3(1, 1, 0));
  float n001 = hash13(i + vec3(0, 0, 1)), n101 = hash13(i + vec3(1, 0, 1)), n011 = hash13(i + vec3(0, 1, 1)), n111 = hash13(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
vec2 gradDir(vec2 p) { float a = hash12(p) * TAU; return vec2(cos(a), sin(a)); }
// Gradient (Perlin-style) noise in roughly [-1, 1].
float gradientNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(gradDir(i), f), b = dot(gradDir(i + vec2(1, 0)), f - vec2(1, 0));
  float c = dot(gradDir(i + vec2(0, 1)), f - vec2(0, 1)), d = dot(gradDir(i + vec2(1, 1)), f - vec2(1, 1));
  return 1.4142 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec3 gradDir3(vec3 p) {
  vec3 h = hash33(p) * 2.0 - 1.0;
  return normalize(h + 1e-5);
}
float gradientNoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(gradDir3(i), f);
  float n100 = dot(gradDir3(i + vec3(1, 0, 0)), f - vec3(1, 0, 0));
  float n010 = dot(gradDir3(i + vec3(0, 1, 0)), f - vec3(0, 1, 0));
  float n110 = dot(gradDir3(i + vec3(1, 1, 0)), f - vec3(1, 1, 0));
  float n001 = dot(gradDir3(i + vec3(0, 0, 1)), f - vec3(0, 0, 1));
  float n101 = dot(gradDir3(i + vec3(1, 0, 1)), f - vec3(1, 0, 1));
  float n011 = dot(gradDir3(i + vec3(0, 1, 1)), f - vec3(0, 1, 1));
  float n111 = dot(gradDir3(i + vec3(1, 1, 1)), f - vec3(1, 1, 1));
  return 1.2 * mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm(vec2 p, int octaves) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    s += a * gradientNoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.0;
    a *= 0.5;
  }
  return s;
}
float fbm3(vec3 p, int octaves) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    s += a * gradientNoise3(p);
    p = p * 2.03 + vec3(17.0, 31.0, 7.0);
    a *= 0.5;
  }
  return s;
}
// Cellular (Worley) noise: x = distance to nearest, y = second nearest, z = cell id hash.
vec3 worley(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(x, y);
      vec2 o = hash22(i + g);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; id = hash12(i + g + 0.5); }
      else if (d < d2) d2 = d;
    }
  return vec3(d1, d2, id);
}
// Interleaved gradient noise: cheap screen-space dither in [0,1).
float ign(vec2 px) { return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)))); }

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// ---------- blend modes (base = below, blend = above), all in [0,1] sRGB ----------
vec3 blendOverlay(vec3 b, vec3 s) { return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b)); }
vec3 blendSoftLight(vec3 b, vec3 s) {
  vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
  return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
}
vec3 blendColorDodge(vec3 b, vec3 s) { return mix(min(vec3(1.0), b / max(1.0 - s, 1e-5)), vec3(1.0), step(1.0, s)) * step(1e-6, b); }
vec3 blendColorBurn(vec3 b, vec3 s) { return mix(1.0 - min(vec3(1.0), (1.0 - b) / max(s, 1e-5)), vec3(0.0), step(s, vec3(0.0))) * (1.0 - step(1.0, b)) + step(1.0, b); }
vec3 setLum(vec3 c, float l) {
  c += l - luma601(c);
  float L = luma601(c);
  float n = min(min(c.r, c.g), c.b), x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = L + (c - L) * L / max(L - n, 1e-5);
  if (x > 1.0) c = L + (c - L) * (1.0 - L) / max(x - L, 1e-5);
  return c;
}
float satOf(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 setSat(vec3 c, float s) {
  float mx = max(max(c.r, c.g), c.b), mn = min(min(c.r, c.g), c.b);
  float d = mx - mn;
  return d > 1e-6 ? (c - mn) * s / d : vec3(0.0);
}
vec3 blendVividLight(vec3 b, vec3 s) {
  return mix(blendColorBurn(b, 2.0 * s), blendColorDodge(b, 2.0 * (s - 0.5)), step(0.5, s));
}
// Index order matches BLEND_MODES in engine/types.ts (Photoshop order).
vec3 blendMode(int mode, vec3 b, vec3 s) {
  switch (mode) {
    case 0: return s;
    case 1: return min(b, s);
    case 2: return b * s;
    case 3: return blendColorBurn(b, s);
    case 4: return max(b + s - 1.0, 0.0);
    case 5: return max(b, s);
    case 6: return 1.0 - (1.0 - b) * (1.0 - s);
    case 7: return blendColorDodge(b, s);
    case 8: return b + s;
    case 9: return blendOverlay(b, s);
    case 10: return blendSoftLight(b, s);
    case 11: return blendOverlay(s, b);
    case 12: return blendVividLight(b, s);
    case 13: return b + 2.0 * s - 1.0;
    case 14: return mix(min(b, 2.0 * s), max(b, 2.0 * (s - 0.5)), step(0.5, s));
    case 15: return step(0.5, blendVividLight(b, s));
    case 16: return abs(b - s);
    case 17: return b + s - 2.0 * b * s;
    case 18: return max(b - s, 0.0);
    case 19: return b / max(s, 1e-4);
    case 20: return setLum(setSat(s, satOf(b)), luma601(b));
    case 21: return setLum(setSat(b, satOf(s)), luma601(b));
    case 22: return setLum(s, luma601(b));
    case 23: return setLum(b, luma601(s));
  }
  return s;
}

// Composite an effect result over its input with a blend mode and opacity (straight alpha).
vec4 blendOver(vec4 base, vec4 top, int mode, float opacity) {
  vec3 c = mode == 0 ? top.rgb : blendMode(mode, saturate(base.rgb), saturate(top.rgb));
  return vec4(mix(base.rgb, c, opacity * top.a), max(base.a, top.a * opacity));
}

// ---------- geometry helpers ----------
// Aspect-corrected centered coordinates: x in [-aspect, aspect] * 0.5, y in [-0.5, 0.5].
vec2 centered(vec2 uv, vec2 res) { return (uv - 0.5) * vec2(res.x / res.y, 1.0); }
vec2 uncentered(vec2 p, vec2 res) { return p / vec2(res.x / res.y, 1.0) + 0.5; }
// Param-space point ([-1,1], +y up, 0 = image center) to uv.
vec2 pointToUv(vec2 p) { return p * 0.5 + 0.5; }

// Elliptical radial mask used by depth-of-field / masked blurs. Returns 1 inside, 0 outside.
float ellipseMask(vec2 uv, vec2 res, vec2 centerUv, float radius, float falloff, float stretch, float rotDeg) {
  vec2 p = centered(uv, res) - centered(centerUv, res);
  p = rot2(radians(rotDeg)) * p;
  p.x /= (1.0 + stretch);
  float d = length(p) / max(radius * 0.5, 1e-4);
  return 1.0 - smoothstep(1.0, 1.0 + falloff * 0.5, d);
}

// Bicubic (Catmull-Rom, 9-tap) texture sample for sharper resampling.
vec4 textureBicubic(sampler2D tex, vec2 uv) {
  vec2 size = vec2(textureSize(tex, 0));
  vec2 samplePos = uv * size;
  vec2 texPos1 = floor(samplePos - 0.5) + 0.5;
  vec2 f = samplePos - texPos1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 offset12 = w2 / w12;
  vec2 texPos0 = (texPos1 - 1.0) / size;
  vec2 texPos3 = (texPos1 + 2.0) / size;
  vec2 texPos12 = (texPos1 + offset12) / size;
  vec4 r = vec4(0.0);
  r += texture(tex, vec2(texPos0.x, texPos0.y)) * w0.x * w0.y;
  r += texture(tex, vec2(texPos12.x, texPos0.y)) * w12.x * w0.y;
  r += texture(tex, vec2(texPos3.x, texPos0.y)) * w3.x * w0.y;
  r += texture(tex, vec2(texPos0.x, texPos12.y)) * w0.x * w12.y;
  r += texture(tex, vec2(texPos12.x, texPos12.y)) * w12.x * w12.y;
  r += texture(tex, vec2(texPos3.x, texPos12.y)) * w3.x * w12.y;
  r += texture(tex, vec2(texPos0.x, texPos3.y)) * w0.x * w3.y;
  r += texture(tex, vec2(texPos12.x, texPos3.y)) * w12.x * w3.y;
  r += texture(tex, vec2(texPos3.x, texPos3.y)) * w3.x * w3.y;
  return r;
}

// 256-entry LUT lookups (curves, gradients).
float lut1(sampler2D t, float x) { return texture(t, vec2((saturate(x) * 255.0 + 0.5) / 256.0, 0.5)).r; }
vec3 lut3(sampler2D t, float x) { return texture(t, vec2((saturate(x) * 255.0 + 0.5) / 256.0, 0.5)).rgb; }
float lut1Periodic(sampler2D t, float x) { return texture(t, vec2((fract(x) * 255.0 + 0.5) / 256.0, 0.5)).r; }

// Mirror-repeat a uv so out-of-range lookups reflect instead of smearing edge pixels.
vec2 mirrorUv(vec2 uv) { return 1.0 - abs(1.0 - mod(uv, 2.0)); }
`;function Yi(e){let t=[];for(let n of e){let e=`u_`+n.key;switch(n.type){case`float`:case`int`:t.push(`uniform float ${e};`);break;case`enum`:t.push(`uniform int ${e};`);break;case`bool`:t.push(`uniform bool ${e};`);break;case`color`:t.push(`uniform vec3 ${e};`);break;case`vec2`:case`range`:t.push(`uniform vec2 ${e};`);break;case`wheel`:t.push(`uniform vec3 ${e};`,`uniform vec3 ${e}Color;`);break;case`curve`:case`gradient`:t.push(`uniform sampler2D ${e};`);break;case`palette`:t.push(`uniform vec3 ${e}[32];`,`uniform int ${e}Count;`);break;case`texture`:t.push(`uniform sampler2D ${e};`,`uniform bool ${e}Loaded;`,`uniform vec2 ${e}Size;`);break;case`patterns`:t.push(`uniform sampler2D ${e};`,`uniform int ${e}Count;`)}}return t.join(`
`)}function Xi(e,t){return`#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_input;
uniform sampler2D u_original;
uniform vec2 u_resolution;
uniform float u_pxScale;
uniform float u_time;
${Yi(e.params)}
${Ji}
vec4 sampleInput(vec2 uv) { return texture(u_input, uv); }
vec2 texel() { return 1.0 / u_resolution; }
#line 1
${t}
`}var Zi={base:`
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
}`,copy:`
uniform sampler2D u_src;
void main() { fragColor = texture(u_src, v_uv); }`,mix:`
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
}`,downsample:`
uniform sampler2D u_src;
uniform vec2 u_srcTexel;
void main() {
  vec2 o = u_srcTexel;
  vec4 c = texture(u_src, v_uv + vec2(-o.x, -o.y)) + texture(u_src, v_uv + vec2(o.x, -o.y))
         + texture(u_src, v_uv + vec2(-o.x, o.y)) + texture(u_src, v_uv + vec2(o.x, o.y));
  fragColor = c * 0.25;
}`,gauss:`
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
}`,upsample:`
uniform sampler2D u_src;
void main() { fragColor = texture(u_src, v_uv); }`,present:`
uniform sampler2D u_src;
void main() {
  vec4 c = texelFetch(u_src, ivec2(gl_FragCoord.xy), 0);
  c = clamp(c, 0.0, 1.0);
  c.rgb = clamp(c.rgb + (ign(gl_FragCoord.xy) - 0.5) / 255.0, 0.0, 1.0);
  fragColor = vec4(c.rgb * c.a, c.a);
}`,minAlpha:`
uniform sampler2D u_src;
void main() {
  ivec2 sz = textureSize(u_src, 0);
  ivec2 p = ivec2(gl_FragCoord.xy) * 4;
  float a = 1.0;
  for (int y = 0; y < 4; y++)
    for (int x = 0; x < 4; x++) a = min(a, texelFetch(u_src, min(p + ivec2(x, y), sz - 1), 0).a);
  fragColor = vec4(a);
}`,quantize:`
uniform sampler2D u_src;
uniform float u_dither;
void main() {
  vec4 c = texelFetch(u_src, ivec2(gl_FragCoord.xy), 0);
  if (u_dither > 0.5) c.rgb += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = clamp(c, 0.0, 1.0);
}`};function Qi(e){let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function $i(e,t,n){let r=new Float32Array(t*t),i=new Float32Array(t*t),a=1/(2*n+1);for(let i=0;i<t;i++)for(let o=0;o<t;o++){let s=0;for(let r=-n;r<=n;r++)s+=e[i*t+(o+r+t)%t];r[i*t+o]=s*a}for(let e=0;e<t;e++)for(let o=0;o<t;o++){let s=0;for(let i=-n;i<=n;i++)s+=r[(e+i+t)%t*t+o];i[e*t+o]=s*a}return i}function ea(e){let t=Array.from(e.keys()).sort((t,n)=>e[t]-e[n]),n=new Float32Array(e.length),r=e.length-1;return t.forEach((e,t)=>n[e]=t/r),n}function ta(e){let t=Qi(1337),n=[];for(let r=0;r<4;r++){let r=new Float32Array(e*e);for(let e=0;e<r.length;e++)r[e]=t();for(let t=0;t<3;t++){let t=$i(r,e,2);for(let e=0;e<r.length;e++)r[e]=r[e]-t[e];r=ea(r)}n.push(r)}let r=new Uint8Array(e*e*4);for(let t=0;t<e*e;t++)for(let e=0;e<4;e++)r[t*4+e]=Math.round(n[e][t]*255);return{data:r,size:e}}function na(e,t,n){let r=new Float32Array(t*t);for(let e=0;e<r.length;e++)r[e]=n();let i=new Float32Array(e*e);for(let n=0;n<e;n++){let a=n/e*t,o=Math.floor(a),s=a-o,c=s*s*(3-2*s);for(let a=0;a<e;a++){let s=a/e*t,l=Math.floor(s),u=s-l,d=u*u*(3-2*u),f=r[o%t*t+l%t],p=r[o%t*t+(l+1)%t],m=r[(o+1)%t*t+l%t],h=r[(o+1)%t*t+(l+1)%t];i[n*e+a]=(f+(p-f)*d)*(1-c)+(m+(h-m)*d)*c}}return i}function ra(e){let t=Qi(42),n=[4,8,16,32,64,128],r=new Float32Array(e*e),i=.5,a=0;for(let o of n){let n=na(e,o,t);for(let e=0;e<r.length;e++)r[e]+=n[e]*i;a+=i,i*=.6}let o=new Float32Array(e*e);for(let e=0;e<o.length;e++)o[e]=t();let s=$i(o,e,1),c=na(e,3,t),l=new Uint8Array(e*e*4);for(let t=0;t<e*e;t++)l[t*4]=Math.round(r[t]/a*255),l[t*4+1]=Math.round(Math.min(1,Math.max(0,(s[t]-.5)*3+.5))*255),l[t*4+2]=Math.round(c[t]*255),l[t*4+3]=255;return{data:l,size:e}}function ia(e){let t=Qi(7),n=new Float32Array(e*e),r=Math.round(e*1.5);for(let i=0;i<r;i++){let r=t()*e,i=t()*e,a=t()*Math.PI*2,o=8+t()*40,s=.15+t()*.35;for(let c=0;c<o;c++){a+=(t()-.5)*.25,r+=Math.cos(a),i+=Math.sin(a);let o=(Math.round(r)%e+e)%e,c=(Math.round(i)%e+e)%e;n[c*e+o]+=s}}let i=$i(n,e,1),a=new Uint8Array(e*e*4);for(let t=0;t<e*e;t++){let e=Math.min(1,n[t]*.6+i[t]*.8);a[t*4]=a[t*4+1]=a[t*4+2]=Math.round(e*255),a[t*4+3]=255}return{data:a,size:e}}var aa=Object.fromEntries(p.map((e,t)=>[e,t])),oa=class{canvas;gl;caps;pool;programs=new Map;pending=new Set;source=null;sourceVersion=0;sourceTopDown=!1;dummy;layerCaches=new Map;builtins=new Map;frame=0;tileSize=0;assets={get:()=>null};onProgramReady=null;lastError=null;constructor(e){this.canvas=e;let t=e.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!0,powerPreference:`high-performance`});if(!t)throw Error(`WebGL 2 is not available in this browser.`);this.gl=t,this.caps=Ne(t),this.pool=new Re(t),this.dummy=j(t,new Uint8Array([0,0,0,0]),1,1)}get defaultFormat(){return this.caps.floatTargets?`rgba16f`:`rgba8`}get hasSource(){return!!this.source}get sourceSize(){return this.source?[this.source.width,this.source.height]:[0,0]}setSource(e){let t=this.gl,n=e,r=e.width,i=e.height,a=this.caps.maxTextureSize;if(r>a||i>a){let t=a/Math.max(r,i),o=new OffscreenCanvas(Math.floor(r*t),Math.floor(i*t)),s=o.getContext(`2d`);s.imageSmoothingQuality=`high`,s.drawImage(e,0,0,o.width,o.height),n=o,r=o.width,i=o.height}this.source?.dispose(),this.sourceTopDown=typeof ImageBitmap<`u`&&n instanceof ImageBitmap;let o=new A(t,r,i,`rgba8`,{levels:Pe(r,i)});t.bindTexture(t.TEXTURE_2D,o.tex),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!0),t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),t.pixelStorei(t.UNPACK_COLORSPACE_CONVERSION_WEBGL,t.NONE),t.texSubImage2D(t.TEXTURE_2D,0,0,0,r,i,t.RGBA,t.UNSIGNED_BYTE,n),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!1),t.generateMipmap(t.TEXTURE_2D),this.source=o,this.sourceVersion++}programFor(e,t){let n=e.id+`:`+t,r=this.programs.get(n);if(!r){let i=e.shaders[t];if(i===void 0)throw Error(`Effect ${e.id} has no shader "${t}"`);r=new Be(this.gl,n,Xi(e,i)),this.programs.set(n,r),this.caps.parallelCompile&&this.pending.add(r)}return r}coreProgram(e){return this.programFor(ua,e)}prepare(e){let t=!0;for(let n of Object.keys(e.shaders))this.programFor(e,n).isReady(this.caps.parallelCompile)||(t=!1);return t}ready(e){let t=!0;for(let n of e)this.prepare(n)||(t=!1);for(let e of Object.keys(Zi))this.coreProgram(e).isReady(this.caps.parallelCompile)||(t=!1);return t}pollPrograms(){if(!this.pending.size)return!1;let e=!1;for(let t of this.pending)t.isReady(!0)&&(this.pending.delete(t),e=!0);return e&&this.onProgramReady?.(),this.pending.size>0}draw(e,t,n,r,i,a={}){let o=this.gl;e.finalize(),o.bindFramebuffer(o.FRAMEBUFFER,t?t.fbo:null),o.viewport(0,0,n,r),o.useProgram(e.program),We(e,i),a.clear&&(o.clearColor(...a.clear),o.clear(o.COLOR_BUFFER_BIT)),a.blend===`add`?(o.enable(o.BLEND),o.blendFunc(o.ONE,o.ONE)):a.blend===`alpha`&&(o.enable(o.BLEND),o.blendFuncSeparate(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA,o.ONE,o.ONE_MINUS_SRC_ALPHA));let s=this.tileSize;if(s>0&&(n>s||r>s)){o.enable(o.SCISSOR_TEST);for(let e=0;e<r;e+=s)for(let t=0;t<n;t+=s)o.scissor(t,e,Math.min(s,n-t),Math.min(s,r-e)),o.drawArrays(o.TRIANGLES,0,3),o.flush();o.disable(o.SCISSOR_TEST)}else o.drawArrays(o.TRIANGLES,0,3);a.blend&&o.disable(o.BLEND)}renderBase(e,t,n,r){let i=this.pool.acquire(e,t,r),a=n??{x:0,y:0,w:1,h:1},[o,s]=this.sourceSize,c=e>a.w*o*1.01||t>a.h*s*1.01;return this.draw(this.coreProgram(`base`),i,e,t,{u_src:this.source??this.dummy,u_crop:[a.x,1-a.y-a.h,a.w,a.h],u_rotation:-(a.rotation??0)*Math.PI/180,u_flip:[a.flipX?-1:1,a.flipY?-1:1],u_srcTopDown:this.sourceTopDown,u_bicubic:c}),i}renderChain(e,t){let n=this.renderChainSteps(e,t),r=n.next();for(;!r.done;)r=n.next();return r.value}async renderChainAsync(e,t,n){let r=this.renderChainSteps(e,t),i=r.next();for(;!i.done;){if(n?.aborted){for(;!i.done;)i=r.next();throw this.pool.release(i.value),new DOMException(`Export cancelled`,`AbortError`)}await this.gpuIdle(),await i.value,i=r.next()}return i.value}*renderChainSteps(e,t){this.frame++;let n=this.tileSize;this.tileSize=t.tileSize??0;let{width:r,height:i,format:o}=t,s=t.limit??e.length,c=t.start?.index??0,l=[];e.forEach((e,t)=>{t<s&&t>=c&&e.visible&&a(e.effectId)&&l.push({layer:e,index:t})});let u=l.map(e=>!!a(e.layer.effectId)?.usesOriginal),d=e=>u.slice(e).some(Boolean),f=t.start?.tex??null,p=f?null:this.renderBase(r,i,t.crop,o),m=f??p,h=t.capture===void 0,g=()=>{h=!0;let e=this.pool.acquire(r,i,o);this.draw(this.coreProgram(`copy`),e,r,i,{u_src:m}),t.onCapture?.(e)};try{for(let e=0;e<l.length;e++){let{layer:n,index:s}=l[e];!h&&s>=t.capture&&g();let c=a(n.effectId),u=this.applyEffect(c,n.id,n.params,m,p,t),_=u;u!==m&&(n.opacity<1||n.blend!==`normal`)&&(_=this.pool.acquire(r,i,o),this.draw(this.coreProgram(`mix`),_,r,i,{u_base:m,u_top:u,u_opacity:n.opacity,u_mode:aa[n.blend]??0}),this.pool.release(u)),_!==m&&(m!==p&&m!==f&&this.pool.release(m),m=_),p&&p!==m&&!d(e+1)&&(this.pool.release(p),p=null),yield t.onLayer?.(e,l.length)??void 0}h||g()}finally{this.tileSize=n}if(p&&p!==m&&this.pool.release(p),this.gcCaches(l.map(e=>e.layer.id)),m===f){let e=this.pool.acquire(r,i,o);return this.draw(this.coreProgram(`copy`),e,r,i,{u_src:m}),e}return m}applyEffect(e,t,n,r,i,a){let o=r.width,s=r.height,c=this.paramUniforms(e,t,n),l=e.uniforms?.(n,{width:o,height:s,pxScale:a.pxScale,time:a.time})??{},u=i,d=new Set,f=this,p={u_resolution:[o,s],u_pxScale:a.pxScale,u_time:a.time,...c,...l},m={gl:this.gl,input:r,get original(){return u||(u=f.renderBase(o,s,a.crop,a.format),d.add(u)),u},width:o,height:s,pxScale:a.pxScale,time:a.time,params:n,format:a.format,exporting:!!a.exporting,pass:(t,n={})=>{let i=this.programFor(e,t),c=Math.max(1,Math.round(n.width??o)),l=Math.max(1,Math.round(n.height??s)),u=n.target??this.pool.acquire(c,l,n.format??a.format),d={...p,u_resolution:[u.width,u.height],u_input:r,u_original:e.usesOriginal?m.original:void 0,...n.inputs,...n.uniforms};return this.draw(i,u,u.width,u.height,d,n),u},release:e=>{e!==r&&e!==i&&this.pool.release(e)},target:(e,t,n)=>this.pool.acquire(e,t,n??a.format),cached:(e,n,r)=>this.cached(t,e,n,r),asset:e=>this.assetTexture(e),blur:(e,t,n,r)=>this.blur(e,t,n??t,r??a.format),builtin:e=>this.builtin(e),read:e=>this.readTexture(e)},h;h=e.render?e.render(m):m.pass(`main`);for(let e of d)e!==h&&this.pool.release(e);return h}paramUniforms(e,t,n){let r={};for(let i of e.params){let e=n[i.key]??i.default,a=`u_`+i.key;switch(i.type){case`float`:case`int`:case`enum`:r[a]=Number(e);break;case`bool`:r[a]=!!e;break;case`color`:r[a]=M(String(e));break;case`vec2`:case`range`:r[a]=e??i.default;break;case`wheel`:{let[t,n]=e??i.default,o=t*Math.PI/180;r[a]=[Math.cos(o)*n,Math.sin(o)*n,n],r[a+`Color`]=sa(t);break}case`curve`:{let n=e,o=`curve:`+i.key+`:`+JSON.stringify(n);r[a]=this.cached(t,o,()=>Ie(this.gl,Ye(n,!!i.periodic),256,1),e=>e.dispose());break}case`gradient`:{let n=`grad:`+i.key+`:`+JSON.stringify(e);r[a]=this.cached(t,n,()=>Ie(this.gl,Ze(e,i.evaluate),256,1),e=>e.dispose());break}case`palette`:{let t=e??[],n=new Float32Array(96);t.slice(0,32).forEach((e,t)=>n.set(M(e),t*3)),r[a]=n,r[a+`Count`]=Math.min(t.length,32);break}case`texture`:{let t=this.assetTexture(e);r[a]=t??this.dummy,r[a+`Loaded`]=!!t,r[a+`Size`]=t?[t.width,t.height]:[1,1];break}case`patterns`:{let n=e??[],o=`pat:`+i.key+`:`+n.join(`,`),{data:s,width:c,height:l,count:u}=Qe(i.patterns,n);r[a]=this.cached(t,o,()=>j(this.gl,s,c,l,{nearest:!0,repeat:!1}),e=>e.dispose()),r[a+`Count`]=u;break}}}return r}assetTexture(e){return e&&typeof e==`object`&&`assetId`in e?this.assets.get(e.assetId):null}cached(e,t,n,r){let i=this.layerCaches.get(e);i||this.layerCaches.set(e,i=new Map);let a=i.get(t);return a||(a={value:n(),dispose:r,frame:this.frame},i.set(t,a)),a.frame=this.frame,a.value}gcCaches(e){for(let t of e){let e=this.layerCaches.get(t);if(e)for(let[t,n]of e)n.frame<this.frame&&(n.dispose?.(n.value),e.delete(t))}}pruneLayers(e){for(let[t,n]of this.layerCaches)if(!(e.has(t)||t.startsWith(`thumb:`))){for(let e of n.values())e.dispose?.(e.value);this.layerCaches.delete(t)}}builtin(e){let t=this.builtins.get(e);if(!t){let n=this.gl;if(e===`blueNoise`){let{data:e,size:r}=ta(128);t=j(n,e,r,r,{nearest:!0,repeat:!0})}else if(e===`paper`){let{data:e,size:r}=ra(512);t=j(n,e,r,r,{repeat:!0})}else{let{data:e,size:r}=ia(512);t=j(n,e,r,r,{repeat:!0})}this.builtins.set(e,t)}return t}blur(e,t,n,r){let i=e.width,a=e.height;t=Math.max(0,t),n=Math.max(0,n);let o=Math.max(t,n);if(o<.35){let t=this.pool.acquire(i,a,r);return this.draw(this.coreProgram(`copy`),t,i,a,{u_src:e}),t}let s=0;for(;o/2**s>6&&Math.min(i,a)/2**(s+1)>=4;)s++;let c=e,l=[],u=i,d=a;for(let e=0;e<s;e++){u=Math.max(1,Math.ceil(u/2)),d=Math.max(1,Math.ceil(d/2));let e=this.pool.acquire(u,d,r);this.draw(this.coreProgram(`downsample`),e,u,d,{u_src:c,u_srcTexel:[1/c.width,1/c.height]}),l.push(e),c=e}let f=2**s,p=s>0?Math.sqrt((1-4**-s)/3)*.9:0,m=Math.sqrt(Math.max(0,(t/f)**2-p*p)),h=Math.sqrt(Math.max(0,(n/f)**2-p*p)),g=this.pool.acquire(u,d,r);this.draw(this.coreProgram(`gauss`),g,u,d,{u_src:c,u_dir:[1/u,0],u_sigma:m});let _=this.pool.acquire(u,d,r);this.draw(this.coreProgram(`gauss`),_,u,d,{u_src:g,u_dir:[0,1/d],u_sigma:h}),this.pool.release(g);for(let e of l)this.pool.release(e);if(s===0)return _;let v=this.pool.acquire(i,a,r);return this.draw(this.coreProgram(`upsample`),v,i,a,{u_src:_}),this.pool.release(_),v}present(e,t={}){let n=this.canvas;(n.width!==e.width||n.height!==e.height)&&(n.width=e.width,n.height=e.height),this.draw(this.coreProgram(`present`),null,e.width,e.height,{u_src:e})}toRGBA8(e,t=!0){let n=this.pool.acquire(e.width,e.height,`rgba8`),r=this.tileSize;return this.tileSize=4096,this.draw(this.coreProgram(`quantize`),n,e.width,e.height,{u_src:e,u_dither:+!!t}),this.tileSize=r,n}minAlpha(e){let t=e,n=[];for(;t.width>1||t.height>1;){let e=Math.max(1,Math.ceil(t.width/4)),r=Math.max(1,Math.ceil(t.height/4)),i=this.pool.acquire(e,r,`rgba8`);this.draw(this.coreProgram(`minAlpha`),i,e,r,{u_src:t}),n.push(i),t=i}let r=this.readTexture(t);for(let e of n)this.pool.release(e);return r[3]}renderToPixels(e,t){let n=this.renderChain(e,t),r=n.format===`rgba8`?n:this.toRGBA8(n),i=this.readRowsRGBA8(r,0,r.height);return r!==n&&this.pool.release(r),this.pool.release(n),i}async renderToPixelsAsync(e,t){let n=this.gl,r=this.renderChain(e,t),i=r.format===`rgba8`?r:this.toRGBA8(r),a=i.width,o=i.height,s=n.createBuffer();n.bindBuffer(n.PIXEL_PACK_BUFFER,s),n.bufferData(n.PIXEL_PACK_BUFFER,a*o*4,n.STREAM_READ),n.bindFramebuffer(n.FRAMEBUFFER,i.fbo),n.readPixels(0,0,a,o,n.RGBA,n.UNSIGNED_BYTE,0),n.bindBuffer(n.PIXEL_PACK_BUFFER,null),i!==r&&this.pool.release(i),this.pool.release(r),await this.gpuIdle();let c=new Uint8Array(a*o*4);return n.isContextLost()||(n.bindBuffer(n.PIXEL_PACK_BUFFER,s),n.getBufferSubData(n.PIXEL_PACK_BUFFER,0,c),n.bindBuffer(n.PIXEL_PACK_BUFFER,null)),n.deleteBuffer(s),ca(c,a*4,o),c}readRowsRGBA8(e,t,n,r){let i=this.gl,a=e.width,o=r??new Uint8Array(a*n*4);i.bindFramebuffer(i.FRAMEBUFFER,e.fbo);let s=e.height-t-n;return i.readPixels(0,s,a,n,i.RGBA,i.UNSIGNED_BYTE,o),ca(o,a*4,n),o}readRowsFloat(e,t,n,r){let i=this.gl,a=e.width,o=r??new Float32Array(a*n*4);i.bindFramebuffer(i.FRAMEBUFFER,e.fbo);let s=e.height-t-n;return i.readPixels(0,s,a,n,i.RGBA,i.FLOAT,o),la(o,a*4,n),o}readTexture(e){let t=this.gl,n=e.width*e.height*4,r=e.fbo,i=null;r||=(i=t.createFramebuffer(),t.bindFramebuffer(t.FRAMEBUFFER,i),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,e.tex,0),i),t.bindFramebuffer(t.FRAMEBUFFER,r);let a;if(e.format===`rgba16f`)a=new Float32Array(n),t.readPixels(0,0,e.width,e.height,t.RGBA,t.FLOAT,a);else{let r=new Uint8Array(n);t.readPixels(0,0,e.width,e.height,t.RGBA,t.UNSIGNED_BYTE,r),a=new Float32Array(n);for(let e=0;e<n;e++)a[e]=r[e]/255}return i&&t.deleteFramebuffer(i),t.bindFramebuffer(t.FRAMEBUFFER,null),a}gpuIdle(){let e=this.gl,t=e.fenceSync(e.SYNC_GPU_COMMANDS_COMPLETE,0);return e.flush(),t?new Promise(n=>{let r=()=>{let i=e.clientWaitSync(t,0,0);i===e.WAIT_FAILED||i===e.ALREADY_SIGNALED||i===e.CONDITION_SATISFIED?(e.deleteSync(t),n()):setTimeout(r,4)};r()}):Promise.resolve()}handleContextRestored(){this.programs.clear(),this.pending.clear(),this.pool=new Re(this.gl),this.builtins.clear(),this.layerCaches.clear(),this.source=null,this.dummy=j(this.gl,new Uint8Array([0,0,0,0]),1,1)}isContextLost(){return this.gl.isContextLost()}dispose(){this.pool.disposeAll();for(let e of this.programs.values())e.dispose();this.programs.clear(),this.source?.dispose();for(let e of this.builtins.values())e.dispose();for(let e of this.layerCaches.values())for(let t of e.values())t.dispose?.(t.value);this.layerCaches.clear()}};function sa(e){let t=(e%360+360)%360/360,n=e=>Math.min(1,Math.max(0,Math.abs((t+e)%1*6-3)-1));return[n(0),n(2/3),n(1/3)]}function ca(e,t,n){let r=new Uint8Array(t);for(let i=0,a=n-1;i<a;i++,a--){let n=i*t,o=a*t;r.set(e.subarray(n,n+t)),e.copyWithin(n,o,o+t),e.set(r,o)}}function la(e,t,n){let r=new Float32Array(t);for(let i=0,a=n-1;i<a;i++,a--){let n=i*t,o=a*t;r.set(e.subarray(n,n+t)),e.copyWithin(n,o,o+t),e.set(r,o)}}var ua={id:`core`,params:[],shaders:Zi},da=`
uniform float u_emitScale;
void emit(vec4 v) { fragColor = v * u_emitScale; }
`;function fa(e){let t=e.gl,n=e.caps.floatTargets,r=[`Effects Library GPU diagnostics`,`Browser: ${navigator.userAgent}`],i=t.getExtension(`WEBGL_debug_renderer_info`),a=i?t.getParameter(i.UNMASKED_VENDOR_WEBGL):t.getParameter(t.VENDOR);r.push(`GPU: ${e.caps.renderer} (${a})`),r.push(`GL: ${t.getParameter(t.VERSION)} / ${t.getParameter(t.SHADING_LANGUAGE_VERSION)}`),r.push(`Limits: texture ${e.caps.maxTextureSize}, fragment uniform vectors ${t.getParameter(t.MAX_FRAGMENT_UNIFORM_VECTORS)}, texture units ${t.getParameter(t.MAX_TEXTURE_IMAGE_UNITS)}`),r.push(`Float targets: ${n?`yes`:`no`} · float linear: ${e.caps.floatLinear?`yes`:`no`} · parallel compile: ${e.caps.parallelCompile?`yes`:`no`}`),r.push(``);let o=[],s=(e,n,r)=>{let i=new Uint8Array(e*n*4);for(let t=0;t<n;t++)for(let n=0;n<e;n++)i.set([r(n,t),0,0,255],(t*e+n)*4);let a=j(t,i,e,n,{nearest:!0});return o.push(a),a},c=s(256,1,e=>e),l=s(80,8,(e,t)=>e*3+t&255),u=null;if(n)try{u=new A(t,342,342,`rgba16f`,{renderable:!0}),o.push(u),pa(t,`diag-field`,`void main() { emit(vec4(floor(gl_FragCoord.xy) - vec2(3.25, 0.0), 0.5, 1.0)); }`,{},u,1)}catch(e){r.push(`[FAIL] render to RGBA16F target: ${e.message.split(`
`)[0]}`),u=null}let d=[{name:`texelFetch, RGBA8 data texture`,body:`uniform sampler2D u_t; void main() { emit(vec4(texelFetch(u_t, ivec2(200, 0), 0).r * 255.0, 0.0, 0.0, 1.0)); }`,inputs:{u_t:c},expect:[200,0,0,1]},{name:`texture(), RGBA8 data texture`,body:`uniform sampler2D u_t; void main() { emit(vec4(texture(u_t, vec2(200.5 / 256.0, 0.5)).r * 255.0, 0.0, 0.0, 1.0)); }`,inputs:{u_t:c},expect:[200,0,0,1]},{name:`texelFetch, 80x8 atlas`,body:`uniform sampler2D u_t; void main() { emit(vec4(texelFetch(u_t, ivec2(37, 5), 0).r * 255.0, 0.0, 0.0, 1.0)); }`,inputs:{u_t:l},expect:[116,0,0,1]},{name:`textureSize`,body:`uniform sampler2D u_t; void main() { emit(vec4(vec2(textureSize(u_t, 0)), 0.0, 1.0)); }`,inputs:{u_t:l},expect:[80,8,0,1]},{name:`texelFetch, RGBA16F target`,body:`uniform sampler2D u_f; void main() { emit(texelFetch(u_f, ivec2(5, 7), 0)); }`,inputs:u?{u_f:u}:{},expect:[1.75,7,.5,1],needsFloat:!0},{name:`texture(), RGBA16F target`,body:`uniform sampler2D u_f; void main() { emit(texture(u_f, (vec2(5.0, 7.0) + 0.5) / 342.0)); }`,inputs:u?{u_f:u}:{},expect:[1.75,7,.5,1],needsFloat:!0},{name:`int & % abs`,body:`uniform float u_a; void main() { int i = int(u_a); emit(vec4(float(i & 7), float(7 - (i & 7)), float(i % 8), float(abs(-i)))); }`,inputs:{u_a:141},expect:[5,2,5,141]},{name:`loop with continue`,body:`uniform float u_a; void main() { int c = 0; for (int j = -3; j <= 3; j++) { if (abs(j) > int(u_a) - 140) continue; c++; } emit(vec4(float(c), 0.0, 0.0, 1.0)); }`,inputs:{u_a:141},expect:[3,0,0,1]},{name:`NaN: saturate, clamp, isnan`,body:`uniform float u_a; void main() { float z = u_a - 141.0; float n = z / z; emit(vec4(saturate(n), clamp(n, 0.0, 1.0), isnan(n) ? 1.0 : 0.0, 1.0)); }`,inputs:{u_a:141}}];for(let e of d)e.needsFloat&&!u?r.push(`[skip] ${e.name}: no float targets`):r.push(ha(t,e,n));u&&r.push(ga(t,u)),r.push(``),r.push(_a(e)),e.lastError&&r.push(`Last render error: ${e.lastError.message.split(`
`)[0]}`);for(let e of o)e.dispose();return r.join(`
`)}function pa(e,t,n,r,i,a){let o=new Be(e,t,Xi({params:[]},da+n));try{o.finalize(),e.bindFramebuffer(e.FRAMEBUFFER,i.fbo),e.viewport(0,0,i.width,i.height),e.useProgram(o.program),We(o,{u_resolution:[i.width,i.height],u_emitScale:a,...r}),e.drawArrays(e.TRIANGLES,0,3)}finally{e.bindFramebuffer(e.FRAMEBUFFER,null),o.dispose()}}function ma(e,t){e.bindFramebuffer(e.FRAMEBUFFER,t.fbo);let n=t.width*t.height*4,r;if(t.format===`rgba16f`)r=new Float32Array(n),e.readPixels(0,0,t.width,t.height,e.RGBA,e.FLOAT,r);else{let i=new Uint8Array(n);e.readPixels(0,0,t.width,t.height,e.RGBA,e.UNSIGNED_BYTE,i),r=Float32Array.from(i)}return e.bindFramebuffer(e.FRAMEBUFFER,null),r}function ha(e,t,n){let r=new A(e,1,1,n?`rgba16f`:`rgba8`,{renderable:!0});try{for(;e.getError()!==e.NO_ERROR;);pa(e,`diag`,t.body,t.inputs??{},r,n?1:1/255);let i=Array.from(ma(e,r)),a=e.getError(),o=i.map(e=>Number.isNaN(e)?`NaN`:String(Math.round(e*1e3)/1e3)).join(`, `),s=a?` · GL error 0x${a.toString(16)}`:``;if(!t.expect)return`[info] ${t.name}: ${o}${s}`;let c=!a&&t.expect.every((e,t)=>Number.isNaN(e)||Math.abs(i[t]-e)<.01+Math.abs(e)*.002);return`[${c?`ok`:`FAIL`}] ${t.name}: ${o}${c?``:` (expected ${t.expect.join(`, `)})`}${s}`}catch(e){return`[FAIL] ${t.name}: ${e.message.split(`
`).slice(0,2).join(` `)}`}finally{r.dispose()}}function ga(e,t){let n=new A(e,t.width,t.height,`rgba16f`,{renderable:!0});try{pa(e,`diag-roundtrip`,`uniform sampler2D u_f; void main() { vec2 p = floor(gl_FragCoord.xy); vec4 v = texelFetch(u_f, ivec2(p), 0); emit(vec4(abs(v.x - (p.x - 3.25)) + abs(v.y - p.y), 0.0, 0.0, 1.0)); }`,{u_f:t},n,1);let r=ma(e,n),i=0;for(let e=0;e<r.length;e+=4)r[e]<.01||i++;let a=t.width*t.height;return`[${i?`FAIL`:`ok`}] texelFetch at gl_FragCoord, ${t.width}x${t.height} float: ${i} of ${a} texels wrong`}catch(e){return`[FAIL] texelFetch at gl_FragCoord: ${e.message.split(`
`)[0]}`}finally{n.dispose()}}function _a(e){let t=a(`macpaint`);if(!t||!e.hasSource)return`MacPaint: no image loaded`;let[n,r]=e.sourceSize,i=256/Math.max(n,r),o=Math.max(8,Math.round(n*i)),s=Math.max(8,Math.round(r*i));try{let i={id:`diag:macpaint`,effectId:`macpaint`,params:c(t),visible:!0,opacity:1,blend:`normal`},a=e.renderToPixels([i],{width:o,height:s,pxScale:fr(o,s),time:0,format:e.defaultFormat,crop:null}),l=0,u=0;for(let e=0;e<a.length;e+=4){let t=a[e]+a[e+1]+a[e+2];t<120?l++:t>660&&u++}let d=a.length/4,f=e=>`${Math.round(e/d*100)}%`;return`MacPaint on current image (${o}x${s}, ${n}x${r} source): ink ${f(l)}, paper ${f(u)}, other ${f(d-l-u)}`}catch(e){return`MacPaint: ${e.message.split(`
`)[0]}`}}function W(e,t=null,...n){let r=document.createElement(e);return t&&va(r,t),ya(r,n),r}function va(e,t){for(let n in t){let r=t[n];if(r!=null){if(n===`class`)e.className=Array.isArray(r)?r.filter(Boolean).join(` `):String(r);else if(n===`style`)for(let[t,n]of Object.entries(r))t.startsWith(`--`)?e.style.setProperty(t,n):e.style[t]=n;else if(n===`dataset`)Object.assign(e.dataset,r);else if(n===`attrs`)for(let[t,n]of Object.entries(r))n!==!1&&n!==void 0&&e.setAttribute(t,n===!0?``:String(n));else n.startsWith(`on`)&&typeof r==`function`?e.addEventListener(n.slice(2).toLowerCase(),r):e[n]=r}}}function ya(e,t){for(let n of t)n!=null&&n!==!1&&(Array.isArray(n)?ya(e,n):n instanceof Node?e.appendChild(n):e.appendChild(document.createTextNode(String(n))))}function ba(e){for(;e.firstChild;)e.removeChild(e.firstChild)}var xa=`http://www.w3.org/2000/svg`;function G(e,t={},...n){let r=document.createElementNS(xa,e);for(let[e,n]of Object.entries(t))r.setAttribute(e,String(n));for(let e of n)e&&r.appendChild(e);return r}function K(e,t=.01){if(!Number.isFinite(e))return`0`;let n=t>=1?0:Math.min(4,Math.max(0,Math.ceil(-Math.log10(t)-1e-9)));return e.toFixed(n)}function q(e,t,n){return Math.min(n,Math.max(t,e))}function J(e,t){let n=n=>{if(n.button!==0&&n.pointerType===`mouse`||t.start&&t.start(n)===!1)return;n.preventDefault(),e.setPointerCapture(n.pointerId);let r=e=>t.move(e),i=n=>{e.removeEventListener(`pointermove`,r),e.removeEventListener(`pointerup`,i),e.removeEventListener(`pointercancel`,i),t.end?.(n)};e.addEventListener(`pointermove`,r),e.addEventListener(`pointerup`,i),e.addEventListener(`pointercancel`,i),t.move(n)};return e.addEventListener(`pointerdown`,n),()=>e.removeEventListener(`pointerdown`,n)}function Sa(e,t){let n;return(...r)=>{n&&clearTimeout(n),n=setTimeout(()=>e(...r),t)}}function Ca(e=`l`){return e+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3)}var wa=200,Ta=class{s;listeners=new Set;undoStack=[];redoStack=[];coalesceKey=null;coalesceTime=0;constructor(e){this.s=e}get state(){return this.s}subscribe(e){return this.listeners.add(e),()=>this.listeners.delete(e)}set(e){let t=this.s;this.s={...t,...e};for(let e of this.listeners)e(this.s,t)}updateProject(e,t={}){let n=this.s.project,r=e(n);if(r!==n){if(t.history!==!1){let e=performance.now();t.coalesce&&t.coalesce===this.coalesceKey&&e-this.coalesceTime<1500||(this.undoStack.push(n),this.undoStack.length>wa&&this.undoStack.shift()),this.redoStack=[],this.coalesceKey=t.coalesce??null,this.coalesceTime=e}this.set({project:r})}}commit(){this.coalesceKey=null}get canUndo(){return this.undoStack.length>0}get canRedo(){return this.redoStack.length>0}undo(){let e=this.undoStack.pop();e&&(this.redoStack.push(this.s.project),this.coalesceKey=null,this.set({project:e,selectedLayerId:this.keepSelection(e)}))}redo(){let e=this.redoStack.pop();e&&(this.undoStack.push(this.s.project),this.coalesceKey=null,this.set({project:e,selectedLayerId:this.keepSelection(e)}))}resetHistory(){this.undoStack=[],this.redoStack=[]}keepSelection(e){let t=this.s.selectedLayerId;return t&&e.layers.some(e=>e.id===t)?t:e.layers.length?e.layers[e.layers.length-1].id:null}get selectedLayer(){return this.s.project.layers.find(e=>e.id===this.s.selectedLayerId)??null}addLayer(e,t,n={}){let r=a(e);if(!r)return null;let i={id:Ca(),effectId:r.id,params:t?l(r,t):c(r),visible:!0,opacity:1,blend:`normal`,...n};return this.updateProject(e=>({...e,layers:[...e.layers,i]})),this.set({selectedLayerId:i.id,mode:`effect`}),i}setLayers(e,t=!1){let n=e.filter(e=>a(e.effectId)).map(e=>({...e,id:Ca(),params:l(a(e.effectId),e.params)}));this.updateProject(e=>({...e,layers:t?[...e.layers,...n]:n})),this.set({selectedLayerId:n.length?n[n.length-1].id:null,mode:`effect`})}removeLayer(e){let t=this.s.project.layers.findIndex(t=>t.id===e);if(!(t<0)&&(this.updateProject(t=>({...t,layers:t.layers.filter(t=>t.id!==e)})),this.s.selectedLayerId===e)){let e=this.s.project.layers,n=e[Math.min(t,e.length-1)]??null;this.set({selectedLayerId:n?n.id:null})}}duplicateLayer(e){let t=this.s.project.layers,n=t.findIndex(t=>t.id===e);if(n<0)return;let r={...t[n],id:Ca(),params:s(t[n].params)};this.updateProject(e=>({...e,layers:[...e.layers.slice(0,n+1),r,...e.layers.slice(n+1)]})),this.set({selectedLayerId:r.id})}moveLayer(e,t){this.updateProject(n=>{let r=n.layers.findIndex(t=>t.id===e);if(r<0)return n;let i=Math.max(0,Math.min(n.layers.length-1,t));if(r===i)return n;let a=[...n.layers],[o]=a.splice(r,1);return a.splice(i,0,o),{...n,layers:a}})}patchLayer(e,t,n){this.updateProject(n=>({...n,layers:n.layers.map(n=>n.id===e?{...n,...t}:n)}),{coalesce:n})}setParam(e,t,n,r=!0){this.updateProject(r=>({...r,layers:r.layers.map(r=>r.id===e?{...r,params:{...r.params,[t]:n}}:r)}),{coalesce:r?`param:${e}:${t}`:void 0})}setParams(e,t){this.updateProject(n=>({...n,layers:n.layers.map(n=>n.id===e?{...n,params:t}:n)}))}setCrop(e,t){this.updateProject(t=>({...t,crop:e}),{coalesce:t})}setBlend(e,t){this.patchLayer(e,{blend:t})}},Ea=class{renderer;assets=new Map;textures=new Map;listeners=new Set;constructor(e){this.renderer=e,e.assets={get:e=>this.texture(e)}}onChange(e){return this.listeners.add(e),()=>this.listeners.delete(e)}emit(){for(let e of this.listeners)e()}get(e){return this.assets.get(e)}all(){return[...this.assets.values()]}async add(e,t,n){let r=await createImageBitmap(e,{imageOrientation:`flipY`,premultiplyAlpha:`none`}),i={id:n??`a`+Math.random().toString(36).slice(2,10),name:t,blob:e,width:r.width,height:r.height,url:URL.createObjectURL(e),bitmap:r};return this.assets.set(i.id,i),this.emit(),i}remove(e){let t=this.assets.get(e);t&&(URL.revokeObjectURL(t.url),t.bitmap?.close(),this.assets.delete(e),this.textures.get(e)?.dispose(),this.textures.delete(e),this.emit())}texture(e){let t=this.textures.get(e);if(t)return t;let n=this.assets.get(e);if(!n||!n.bitmap)return null;let r=this.renderer.gl,i=this.renderer.caps.maxTextureSize,a=n.width,o=n.height,s=n.bitmap;if(a>i||o>i){let e=i/Math.max(a,o),t=new OffscreenCanvas(Math.floor(a*e),Math.floor(o*e));t.getContext(`2d`).drawImage(n.bitmap,0,0,t.width,t.height),s=t,a=t.width,o=t.height}let c=new A(r,a,o,`rgba8`,{levels:Pe(a,o)});return r.bindTexture(r.TEXTURE_2D,c.tex),r.texSubImage2D(r.TEXTURE_2D,0,0,0,a,o,r.RGBA,r.UNSIGNED_BYTE,s),r.generateMipmap(r.TEXTURE_2D),c.setWrap(!0),this.textures.set(e,c),c}dropTextures(){this.textures.clear()}clear(){for(let e of[...this.assets.keys()])this.remove(e)}},Da=[{id:`b-portra-glow`,name:`Portra glow`,layers:[{effectId:`film-classic`,params:{stock:1}},{effectId:`halation`,params:{}},{effectId:`film-grain`,params:{}}]},{id:`b-tilt-shift`,name:`Tilt shift`,layers:[{effectId:`depth-of-field`,params:{center:[0,-.1],radius:.5,stretch:4,blurStrength:.02,falloff:1.2}},{effectId:`hue-saturation`,params:{hue:0,saturation:1.35}},{effectId:`contrast`,params:{strength:.3}}]},{id:`b-gameboy`,name:`Pocket camera`,layers:[{effectId:`dither`,params:{patternType:1,palettePreset:13,palette:[`#0f380f`,`#306230`,`#8bac0f`,`#9bbc0f`],colorCount:4,pixelStep:3,ditherStrength:1}}]},{id:`b-heat`,name:`Heat signature`,layers:[{effectId:`thermal`,params:{}}]},{id:`b-riso-zine`,name:`Riso zine`,layers:[{effectId:`risograph`,params:{}},{effectId:`paper-scan`,params:{opacity:.6}}]},{id:`b-tape`,name:`Rental tape`,layers:[{effectId:`vhs`,params:{}},{effectId:`noise`,params:{amount:.4}}]},{id:`b-terminal`,name:`Green terminal`,layers:[{effectId:`ascii`,params:{charColor:`#39ff7a`,bgColor:`#020a04`,density:70,contrast:1.6}}]},{id:`b-kaleido`,name:`Kaleidoscope`,layers:[{effectId:`transform`,params:{axes:6,scale:.2}},{effectId:`hue-saturation`,params:{hue:40,saturation:1.3}}]},{id:`b-crushed-jpeg`,name:`Crushed JPEG`,layers:[{effectId:`jpeg-glitch`,params:{compression:10,blockSize:1,corruption:12,seed:7}}]},{id:`b-spin`,name:`Spin cycle`,layers:[{effectId:`swirl`,params:{strength:1.4}},{effectId:`radial-blur`,params:{angle:10}}]},{id:`b-blue-hour`,name:`Blue hour`,layers:[{effectId:`color-temperature`,params:{shadowTemperature:9800,highlightTemperature:6500}},{effectId:`gradient-map`,params:{gradientMap:[{pos:0,color:`#05070f`},{pos:.55,color:`#2b4a8c`},{pos:1,color:`#e9f0ff`}]}}]},{id:`b-torn-collage`,name:`Torn collage`,layers:[{effectId:`paper-cutout`,params:{columns:3,rows:3,missing:12,rotation:8,seed:4}}]},{id:`b-broadcast`,name:`Broadcast 1987`,layers:[{effectId:`ntsc`,params:{}},{effectId:`crt-screen`,params:{curvature:.15,vignette:3,brightness:1.6}}]},{id:`b-dreamy`,name:`Dreamy bloom`,layers:[{effectId:`bloom`,params:{threshold:.6,intensity:1.2}},{effectId:`halation`,params:{intensity:.5}},{effectId:`vignette`,params:{size:.85,transparency:.6}}]},{id:`b-newsprint`,name:`Newsprint`,layers:[{effectId:`halftone-screen`,params:{frequency:60}},{effectId:`paper-scan`,params:{opacity:.7}}]},{id:`b-billboard`,name:`LED billboard`,layers:[{effectId:`led-screen`,params:{pixelSize:1.6}}]},{id:`b-mac`,name:`1-bit Mac`,layers:[{effectId:`macpaint`,params:{}}]},{id:`b-star-filter`,name:`Star filter`,layers:[{effectId:`star-glow`,params:{threshold:.45,intensity:.7}},{effectId:`bloom`,params:{threshold:.75,intensity:.8}}]},{id:`b-noir`,name:`Noir`,layers:[{effectId:`film-bw`,params:{}},{effectId:`contrast`,params:{strength:.4}},{effectId:`vignette`,params:{size:.75}},{effectId:`film-grain`,params:{amount:.7}}]},{id:`b-chromatic`,name:`Chromatic stripes`,layers:[{effectId:`rgb-shift`,params:{redOffset:.35,blueOffset:.35}},{effectId:`stripe`,params:{patternType:0,repetitions:60}}]}],Oa=`fxlib.presets.v1`,ka=`fxlib.favorites.v1`;function Aa(e,t){try{let n=localStorage.getItem(e);return n?JSON.parse(n):t}catch{return t}}function ja(e,t){try{localStorage.setItem(e,JSON.stringify(t))}catch{}}var Ma=class{user=Aa(Oa,[]);favs=new Set(Aa(ka,[]));listeners=new Set;onChange(e){return this.listeners.add(e),()=>this.listeners.delete(e)}emit(){for(let e of this.listeners)e()}get presets(){return[...this.user.slice().reverse(),...Da.map(e=>({...e,builtin:!0}))]}get userPresets(){return this.user}savePreset(e,t){let n={id:`u`+Date.now().toString(36),name:e.trim()||`Untitled preset`,created:Date.now(),layers:t.map(e=>({effectId:e.effectId,params:e.params,visible:e.visible,opacity:e.opacity,blend:e.blend,name:e.name}))};return this.user.push(n),ja(Oa,this.user),this.emit(),n}renamePreset(e,t){let n=this.user.find(t=>t.id===e);n&&(n.name=t,ja(Oa,this.user),this.emit())}deletePreset(e){this.user=this.user.filter(t=>t.id!==e),ja(Oa,this.user),this.emit()}importPresets(e){let t=0;for(let n of e)n&&Array.isArray(n.layers)&&n.layers.length&&(this.user.push({id:`u`+Date.now().toString(36)+t,name:String(n.name||`Imported preset`),layers:n.layers,created:Date.now()}),t++);return ja(Oa,this.user),this.emit(),t}isFavorite(e){return this.favs.has(e)}toggleFavorite(e){this.favs.has(e)?this.favs.delete(e):this.favs.add(e),ja(ka,[...this.favs]),this.emit()}get favorites(){return[...this.favs]}};function Na(e){return e.layers.map(e=>({effectId:e.effectId,params:e.params,visible:e.visible??!0,opacity:e.opacity??1,blend:e.blend??`normal`,name:e.name}))}var Pa=`effects-library`,Fa=`session`;function Ia(){return new Promise((e,t)=>{let n=indexedDB.open(Pa,1);n.onupgradeneeded=()=>n.result.createObjectStore(Fa),n.onsuccess=()=>e(n.result),n.onerror=()=>t(n.error)})}async function La(e,t){let n=await Ia();await new Promise((r,i)=>{let a=n.transaction(Fa,`readwrite`);a.objectStore(Fa).put(t,e),a.oncomplete=()=>r(),a.onerror=()=>i(a.error)}),n.close()}async function Ra(e){let t=await Ia(),n=await new Promise((n,r)=>{let i=t.transaction(Fa,`readonly`).objectStore(Fa).get(e);i.onsuccess=()=>n(i.result),i.onerror=()=>r(i.error)});return t.close(),n}async function za(e){try{await La(`current`,e)}catch(e){console.warn(`Autosave failed`,e)}}async function Ba(){try{return await Ra(`current`)}catch{return}}async function Va(){try{await La(`current`,void 0)}catch{}}function Ha(e,t){return JSON.stringify({app:`effects-library`,version:1,source:t??null,project:e},null,2)}var Ua={search:`<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>`,plus:`<path d="M12 5v14M5 12h14"/>`,minus:`<path d="M5 12h14"/>`,trash:`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>`,eye:`<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,eyeOff:`<path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.7-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2"/>`,shuffle:`<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>`,reset:`<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>`,star:`<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>`,bookmark:`<path d="M6 3h12v18l-6-4-6 4z"/>`,crop:`<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>`,chevronDown:`<path d="M6 9l6 6 6-6"/>`,chevronRight:`<path d="M9 6l6 6-6 6"/>`,x:`<path d="M18 6L6 18M6 6l12 12"/>`,upload:`<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>`,download:`<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>`,image:`<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>`,dice:`<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>`,link:`<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,play:`<path d="M7 4l13 8-13 8z"/>`,pause:`<path d="M8 5v14M16 5v14"/>`,loop:`<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>`,undo:`<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>`,redo:`<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>`,menu:`<path d="M4 7h16M4 12h16M4 17h16"/>`,sun:`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,moon:`<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>`,grip:`<circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/>`,copy:`<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>`,compare:`<path d="M12 3v18"/><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-5 4 4"/>`,fit:`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,settings:`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,folder:`<path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,save:`<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8M7 21v-7h10v7"/>`,collapse:`<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>`,expand:`<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>`,flipH:`<path d="M12 3v18M8 7l-5 5 5 5V7zM16 7l5 5-5 5V7z"/>`,flipV:`<path d="M3 12h18M7 8l5-5 5 5H7zM7 16l5 5 5-5H7z"/>`,rotate:`<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>`,check:`<path d="M5 12l5 5L20 7"/>`,layers:`<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>`,sparkles:`<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>`,more:`<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>`,keyframe:`<path d="M12 4l8 8-8 8-8-8z"/>`,info:`<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>`,file:`<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>`};function Y(e,t=18,n=``){let r=document.createElementNS(`http://www.w3.org/2000/svg`,`svg`);return r.setAttribute(`viewBox`,`0 0 24 24`),r.setAttribute(`width`,String(t)),r.setAttribute(`height`,String(t)),r.setAttribute(`fill`,`none`),r.setAttribute(`stroke`,`currentColor`),r.setAttribute(`stroke-width`,`2`),r.setAttribute(`stroke-linecap`,`round`),r.setAttribute(`stroke-linejoin`,`round`),r.setAttribute(`aria-hidden`,`true`),r.setAttribute(`class`,(`icon `+n).trim()),r.innerHTML=Ua[e]??``,r}var Wa=null,Ga=null;function Ka(){Ga?.()}function X(e,t,n={}){Ka();let r=W(`div`,{class:`menu`,role:`menu`}),i=!1,a=null;for(let e of t){if(e.separator){r.append(W(`div`,{class:`menu__sep`}));continue}if(e.heading){r.append(W(`div`,{class:`menu__heading`},e.label??``));continue}let t=W(`button`,{class:[`menu__item`,e.checked&&`is-checked`,e.disabled&&`is-disabled`],type:`button`,role:`menuitem`,disabled:!!e.disabled,onclick:t=>{t.stopPropagation(),!e.disabled&&(e.keepOpen||Ka(),e.action?.())}},W(`span`,{class:`menu__check`},e.checked?Y(`check`,14):e.icon?Y(e.icon,14):null),W(`span`,{class:`menu__label`},e.label??``),e.shortcut?W(`span`,{class:`menu__shortcut`},e.shortcut):null);if(e.preview&&!e.disabled){let n=e.preview;t.addEventListener(`pointerenter`,()=>{document.activeElement===t?n():t.focus({preventScroll:!0})}),t.addEventListener(`focus`,()=>{i&&n()})}e.checked&&!e.disabled&&!a&&(a=t),r.append(t)}n.onPreviewEnd&&r.addEventListener(`pointerleave`,n.onPreviewEnd),document.body.append(r);let o=r.getBoundingClientRect(),s,c;if(e instanceof HTMLElement){let t=e.getBoundingClientRect();n.align===`stretch`&&(r.style.minWidth=t.width+`px`);let i=Math.max(o.width,n.align===`stretch`?t.width:0);s=n.align===`end`?t.right-i:t.left,c=n.placement===`above`||n.placement!==`below`&&t.bottom+o.height+8>window.innerHeight&&t.top-o.height-8>0?t.top-o.height-6:t.bottom+6}else s=e.x,c=e.y;s=Math.max(8,Math.min(window.innerWidth-r.offsetWidth-8,s)),c=Math.max(8,Math.min(window.innerHeight-r.offsetHeight-8,c)),r.style.left=s+`px`,r.style.top=c+`px`;let l=t=>{!r.contains(t.target)&&!(e instanceof HTMLElement&&e.contains(t.target))&&Ka()},u=e=>{if(e.key===`Escape`){Ka();return}let t={ArrowDown:1,ArrowUp:-1,Home:-1/0,End:1/0}[e.key];if(t===void 0)return;e.preventDefault(),e.stopPropagation();let n=[...r.querySelectorAll(`.menu__item:not(.is-disabled)`)];if(!n.length)return;let i=n.indexOf(document.activeElement),a=t===-1/0?0:t===1/0?n.length-1:i<0?0:(i+t+n.length)%n.length;n[a].focus({preventScroll:!0}),n[a].scrollIntoView({block:`nearest`})};setTimeout(()=>{document.addEventListener(`pointerdown`,l,!0),document.addEventListener(`keydown`,u,!0)}),Wa=r,Ga=()=>{document.removeEventListener(`pointerdown`,l,!0),document.removeEventListener(`keydown`,u,!0),Wa?.remove(),Wa=null,Ga=null,n.onPreviewEnd?.()};let d=a??r.querySelector(`.menu__item:not(.is-disabled)`);return d?.focus({preventScroll:!0}),d&&d===a&&d.scrollIntoView({block:`nearest`}),i=!0,r}function qa(e,t,n={}){Ka();let r=W(`div`,{class:`popover`},t);document.body.append(r);let i=()=>{let t=e.getBoundingClientRect(),i=r.getBoundingClientRect(),a=n.align===`end`?t.right-i.width:n.align===`center`?t.left+t.width/2-i.width/2:t.left,o=n.placement===`below`?t.bottom+8:t.top-i.height-8;o<8&&(o=t.bottom+8),a=Math.max(8,Math.min(window.innerWidth-i.width-8,a)),o=Math.max(8,Math.min(window.innerHeight-i.height-8,o)),r.style.left=a+`px`,r.style.top=o+`px`};i();let a=new ResizeObserver(i);a.observe(r);let o=t=>{let n=t.target;!r.contains(n)&&!e.contains(n)&&!n.closest?.(`.menu`)&&l()},s=e=>{e.key===`Escape`&&l()};setTimeout(()=>{document.addEventListener(`pointerdown`,o,!0),document.addEventListener(`keydown`,s)});let c=!1,l=()=>{c||(c=!0,a.disconnect(),document.removeEventListener(`pointerdown`,o,!0),document.removeEventListener(`keydown`,s),r.remove(),n.onClose?.())};return l}var Ja=null;function Z(e,t=`info`,n=3200){Ja||(Ja=W(`div`,{class:`toasts`,attrs:{"aria-live":`polite`}}),document.body.append(Ja));let r=W(`div`,{class:`toast toast--${t}`},e);Ja.append(r),setTimeout(()=>{r.classList.add(`is-leaving`),setTimeout(()=>r.remove(),300)},n)}function Ya(e,t,n={}){let r=n.dismissable===!1?null:W(`button`,{class:`icon-button`,type:`button`,attrs:{"aria-label":`Close`},onclick:()=>c()},Y(`x`,18)),i=W(`div`,{class:[`modal`,n.wide&&`modal--wide`],role:`dialog`,attrs:{"aria-modal":`true`}},W(`div`,{class:`modal__header`},W(`h2`,{class:`modal__title`},e),r),t),a=W(`div`,{class:`modal-backdrop`},i);n.dismissable!==!1&&a.addEventListener(`pointerdown`,e=>{e.target===a&&c()});let o=e=>{e.key===`Escape`&&n.dismissable!==!1&&c()};document.addEventListener(`keydown`,o),document.body.append(a);let s=!1,c=()=>{s||(s=!0,document.removeEventListener(`keydown`,o),a.remove(),n.onClose?.())};return{el:i,close:c}}function Xa(e,t,n=``,r=`OK`){return new Promise(i=>{let a=W(`input`,{class:`input`,type:`text`,value:n}),o=null,s=Ya(e,W(`form`,{class:`modal__body`,onsubmit:e=>{e.preventDefault(),o=a.value,s.close()}},W(`label`,{class:`field`},W(`span`,{class:`field__label`},t),a),W(`div`,{class:`modal__actions`},W(`button`,{class:`button`,type:`button`,onclick:()=>s.close()},`Cancel`),W(`button`,{class:`button button--primary`,type:`submit`},r))),{onClose:()=>i(o)});setTimeout(()=>{a.focus(),a.select()})})}var Za={Blur:`Blur`,Color:`Color`,Distort:`Distort`,Effects:`Effects`,Generate:`Generate`,Custom:`Custom`,Film:`Film`},Qa=class{store;library;thumbs;onCollapse;el;content;search;tab=`explore`;tabButtons;canvases=[];constructor(e,t,n,r){this.store=e,this.library=t,this.thumbs=n,this.onCollapse=r,this.search=W(`input`,{class:`search__input`,type:`search`,placeholder:`Search`,spellcheck:!1,attrs:{"aria-label":`Search effects`}}),this.search.addEventListener(`input`,()=>this.render()),this.search.addEventListener(`keydown`,e=>{if(e.key===`Enter`){let e=this.filtered()[0];e&&this.add(e)}else e.key===`Escape`&&(this.search.value=``,this.render(),this.search.blur())});let i=W(`button`,{class:`icon-button`,type:`button`,title:`Collapse panel`,onclick:()=>this.onCollapse()},Y(`collapse`,18)),a=(e,t)=>W(`button`,{class:`tabs__item`,type:`button`,onclick:()=>{this.tab=e,this.render()}},t);this.tabButtons={explore:a(`explore`,`Explore`),favorites:a(`favorites`,`Favorites`),presets:a(`presets`,`Presets`)},this.content=W(`div`,{class:`panel__scroll browser__content`}),this.el=W(`aside`,{class:`panel panel--browser`,attrs:{"aria-label":`Effect library`}},W(`div`,{class:`browser__head`},W(`label`,{class:`search`},Y(`search`,18),this.search),i),W(`div`,{class:`tabs`},this.tabButtons.explore,this.tabButtons.favorites,this.tabButtons.presets),this.content),t.onChange(()=>this.render()),this.render()}focusSearch(){this.search.focus(),this.search.select()}filtered(){let e=this.search.value.trim().toLowerCase(),t=o().filter(e=>!e.hidden);if(!e)return t;let n=e.split(/\s+/);return t.filter(e=>{let t=(e.name+` `+(e.keywords??``)+` `+e.category).toLowerCase();return n.every(e=>t.includes(e))})}add(e){this.store.addLayer(e.id)}render(){for(let e of this.canvases)this.thumbs.unobserve(e);this.canvases=[];for(let[e,t]of Object.entries(this.tabButtons))t.classList.toggle(`is-active`,e===this.tab);ba(this.content);let e=this.search.value.trim();if(e){let t=this.filtered();this.content.append(this.section(`Results (${t.length})`,t.map(e=>this.effectCard(e)))),t.length||this.content.append(W(`div`,{class:`empty`},`No effects match “`+e+`”.`));let n=this.library.presets.filter(t=>t.name.toLowerCase().includes(e.toLowerCase()));n.length&&this.content.append(this.section(`Presets`,n.map(e=>this.presetCard(e))))}else if(this.tab===`explore`){let e=o().filter(e=>!e.hidden),t=this.library.presets.slice(0,6);t.length&&this.content.append(this.section(`Presets`,t.map(e=>this.presetCard(e)),()=>this.switchTab(`presets`)));for(let t of f){let n=e.filter(e=>e.category===t);n.length&&this.content.append(this.section(Za[t],n.map(e=>this.effectCard(e))))}}else if(this.tab===`favorites`){let e=this.library.favorites.map(e=>a(e)).filter(e=>!!e);e.length?this.content.append(this.section(`Favorites`,e.map(e=>this.effectCard(e)))):this.content.append(W(`div`,{class:`empty`},W(`p`,null,`No favorites yet.`),W(`p`,null,`Hover an effect and click ★ to pin it here.`)))}else{let e=W(`div`,{class:`browser__actions`},W(`button`,{class:`button button--small`,type:`button`,onclick:()=>this.saveCurrent()},Y(`bookmark`,14),`Save current`),W(`button`,{class:`button button--small`,type:`button`,onclick:()=>this.importPresets()},Y(`upload`,14),`Import`),W(`button`,{class:`button button--small`,type:`button`,onclick:()=>this.exportPresets()},Y(`download`,14),`Export`));this.content.append(e);let t=this.library.presets.filter(e=>!e.builtin),n=this.library.presets.filter(e=>e.builtin);t.length&&this.content.append(this.section(`My presets`,t.map(e=>this.presetCard(e)))),n.length&&this.content.append(this.section(`Built-in`,n.map(e=>this.presetCard(e)))),!t.length&&!n.length&&this.content.append(W(`div`,{class:`empty`},`No presets yet.`))}}switchTab(e){this.tab=e,this.render(),this.content.scrollTop=0}section(e,t,n){return W(`section`,{class:`browser__section`},W(`h3`,{class:`browser__title`},e,n?W(`button`,{class:`link-button`,type:`button`,onclick:n},`See all`):null),W(`div`,{class:`cards`},...t))}thumbCanvas(e,t){let n=W(`canvas`,{class:`card__thumb`});return this.canvases.push(n),this.thumbs.observe(n,()=>({key:e,layers:t(),canvas:n})),n}effectCard(e){let t=this.library.isFavorite(e.id),n=W(`button`,{class:[`card__fav`,t&&`is-on`],type:`button`,title:t?`Remove from favorites`:`Add to favorites`,onclick:t=>{t.stopPropagation(),this.library.toggleFavorite(e.id)}},Y(`star`,16)),r=this.thumbCanvas(`fx:`+e.id,()=>[{id:`thumb:`+e.id,effectId:e.id,params:c(e),visible:!0,opacity:1,blend:`normal`}]);return W(`button`,{class:`card`,type:`button`,title:e.description??e.name,onclick:()=>this.add(e)},W(`div`,{class:`card__media`},r,n),W(`span`,{class:`card__name`},e.name))}presetCard(e){let t=this.thumbCanvas(`preset:`+e.id+`:`+JSON.stringify(e.layers).length,()=>Na(e).filter(e=>a(e.effectId)).map((t,n)=>({...t,id:`thumb:preset:${e.id}:${n}`,params:l(a(t.effectId),t.params)}))),n=e.builtin?null:W(`button`,{class:`card__fav card__more`,type:`button`,title:`Preset options`,onclick:t=>{t.stopPropagation(),X(t.currentTarget,[{label:`Apply`,action:()=>this.applyPreset(e)},{label:`Add on top`,action:()=>this.applyPreset(e,!0)},{label:`Rename…`,action:async()=>{let t=await Xa(`Rename preset`,`Name`,e.name,`Rename`);t&&this.library.renamePreset(e.id,t)}},{separator:!0},{label:`Delete`,action:()=>this.library.deletePreset(e.id)}])}},Y(`more`,16));return W(`button`,{class:`card card--preset`,type:`button`,title:e.layers.map(e=>a(e.effectId)?.name??e.effectId).join(` → `),onclick:t=>this.applyPreset(e,t.shiftKey)},W(`div`,{class:`card__media`},t,n),W(`span`,{class:`card__name`},e.name))}applyPreset(e,t=!1){let n=Na(e),r=n.filter(e=>!a(e.effectId)).length;this.store.setLayers(n,t),r&&Z(`${r} effect(s) in this preset are not available`,`error`)}async saveCurrent(){let e=this.store.state.project.layers;if(!e.length)return Z(`Add some effects first`);let t=await Xa(`Save preset`,`Preset name`,`My look`,`Save`);t!==null&&(this.library.savePreset(t,e),Z(`Preset saved`,`success`))}exportPresets(){let e=this.library.userPresets;if(!e.length)return Z(`No saved presets to export`);let t=new Blob([JSON.stringify({app:`effects-library`,version:1,presets:e},null,2)],{type:`application/json`}),n=W(`a`,{href:URL.createObjectURL(t),download:`effects-presets.json`});n.click(),setTimeout(()=>URL.revokeObjectURL(n.href),2e3)}importPresets(){let e=W(`input`,{type:`file`,accept:`application/json,.json`});e.addEventListener(`change`,async()=>{let t=e.files?.[0];if(t)try{let e=JSON.parse(await t.text()),n=Array.isArray(e)?e:e.presets,r=this.library.importPresets(n??[]);Z(r?`Imported ${r} preset(s)`:`No presets found in file`,r?`success`:`error`)}catch{Z(`Could not read that preset file`,`error`)}}),e.click()}},$a=[`portrait`,`coffee`,`bokeh`,`grapes`,`street`],eo=class{store;actions;el;list;media;renderedProject=null;renderedSel=null;constructor(e,t){this.store=e,this.actions=t;let n=W(`button`,{class:`button button--primary button--small`,type:`button`,onclick:e=>this.openAddMenu(e.currentTarget)},Y(`plus`,14),`Add`),r=W(`button`,{class:`icon-button`,type:`button`,title:`Save stack as preset`,onclick:()=>t.savePreset()},Y(`bookmark`,18));this.media=W(`div`,{class:`media`}),this.list=W(`ol`,{class:`layers`,attrs:{"aria-label":`Layer stack`}}),this.el=W(`aside`,{class:`panel panel--layers`,attrs:{"aria-label":`Layers`}},W(`div`,{class:`panel__header`},W(`span`,{class:`panel__title`},`Layers`),W(`div`,{class:`panel__actions`},r,n)),this.media,W(`div`,{class:`panel__scroll`},this.list)),e.subscribe((e,t)=>{e.source!==t.source&&this.renderMedia(),(e.project!==this.renderedProject||e.selectedLayerId!==this.renderedSel)&&this.renderList()}),this.renderMedia(),this.renderList()}renderMedia(){ba(this.media);let e=this.store.state.source,t=W(`button`,{class:`icon-button`,type:`button`,title:`Sample images`,onclick:e=>X(e.currentTarget,$a.map(e=>({label:e[0].toUpperCase()+e.slice(1),action:()=>this.actions.sample(e)})))},Y(`image`,18)),n=W(`div`,{class:`media__buttons`},W(`button`,{class:`media__upload`,type:`button`,onclick:()=>this.actions.upload()},Y(`upload`,18),W(`span`,null,`Upload`)),W(`div`,{class:`media__actions`},W(`button`,{class:`icon-button`,type:`button`,title:`Random image (picsum.photos)`,onclick:()=>this.actions.random()},Y(`dice`,18)),W(`button`,{class:`icon-button`,type:`button`,title:`Add from URL`,onclick:()=>this.actions.fromUrl()},Y(`link`,18)),t));if(e){let t=W(`img`,{class:`media__img`,src:e.url,alt:e.name,draggable:!1}),r=W(`div`,{class:`media__meta`},W(`span`,{class:`media__name`,title:e.name},e.name),W(`span`,{class:`media__size`},`${e.width} × ${e.height}`));this.media.append(W(`div`,{class:`media__preview`},t,n),r)}else this.media.append(W(`div`,{class:`media__preview media__preview--empty`},n))}renderList(){let{project:e,selectedLayerId:t}=this.store.state;this.renderedProject=e,this.renderedSel=t,ba(this.list);let n=[...e.layers].reverse();if(!n.length)this.list.append(W(`li`,{class:`layers__empty`},`No effects yet. Pick one from the library or press Add.`));else for(let e of n)this.list.append(this.row(e,e.id===t))}row(e,t){let n=a(e.effectId),r=e.name||n?.name||e.effectId,i=W(`button`,{class:[`icon-button icon-button--tiny layers__eye`,!e.visible&&`is-off`],type:`button`,title:e.visible?`Hide layer`:`Show layer`,onclick:t=>{t.stopPropagation(),this.store.patchLayer(e.id,{visible:!e.visible})}},Y(e.visible?`eye`:`eyeOff`,16)),o=W(`button`,{class:`icon-button icon-button--tiny layers__del`,type:`button`,title:`Delete layer`,onclick:t=>{t.stopPropagation(),this.store.removeLayer(e.id)}},Y(`trash`,16)),s=W(`span`,{class:`layers__grip`,title:`Drag to reorder`},Y(`grip`,14)),c=W(`li`,{class:[`layers__item`,t&&`is-active`,!e.visible&&`is-hidden`,!n&&`is-missing`],tabIndex:0,dataset:{id:e.id},onclick:()=>this.store.set({selectedLayerId:e.id,mode:`effect`}),ondblclick:()=>this.rename(e),oncontextmenu:t=>{t.preventDefault(),this.contextMenu(e,{x:t.clientX,y:t.clientY})},onkeydown:t=>{t.key===`Enter`&&this.store.set({selectedLayerId:e.id,mode:`effect`})}},s,W(`span`,{class:`layers__name`},r,e.opacity<1||e.blend!==`normal`?W(`span`,{class:`layers__badge`},`${Math.round(e.opacity*100)}%`):null),W(`span`,{class:`layers__trail`},o,i));return this.dragSort(c,s,e),c}dragSort(e,t,n){t.addEventListener(`pointerdown`,r=>{r.preventDefault(),r.stopPropagation();let i=[...this.list.querySelectorAll(`.layers__item`)],a=i.map(e=>e.getBoundingClientRect()),o=r.clientY,s=i.indexOf(e),c=s;e.classList.add(`is-dragging`),t.setPointerCapture(r.pointerId);let l=t=>{let n=t.clientY-o;e.style.transform=`translateY(${n}px)`;let r=a[s].top+a[s].height/2+n;c=a.findIndex(e=>r<e.bottom),c<0&&(c=i.length-1),i.forEach((t,n)=>{if(t===e)return;let r=s<c?n>s&&n<=c?-a[s].height:0:n>=c&&n<s?a[s].height:0;t.style.transform=r?`translateY(${r}px)`:``})},u=()=>{if(t.removeEventListener(`pointermove`,l),t.removeEventListener(`pointerup`,u),t.removeEventListener(`pointercancel`,u),i.forEach(e=>e.style.transform=``),e.classList.remove(`is-dragging`),c!==s){let e=i.length;this.store.moveLayer(n.id,e-1-c)}};t.addEventListener(`pointermove`,l),t.addEventListener(`pointerup`,u),t.addEventListener(`pointercancel`,u)})}async rename(e){let t=a(e.effectId),n=await Xa(`Rename layer`,`Name`,e.name||t?.name||``,`Rename`);n!==null&&this.store.patchLayer(e.id,{name:n.trim()||void 0})}contextMenu(e,t){let n=this.store.state.project.layers,r=n.findIndex(t=>t.id===e.id);X(t,[{label:`Duplicate`,shortcut:`Ctrl+D`,action:()=>this.store.duplicateLayer(e.id)},{label:`Rename…`,action:()=>this.rename(e)},{label:e.visible?`Hide`:`Show`,action:()=>this.store.patchLayer(e.id,{visible:!e.visible})},{separator:!0},{label:`Move up`,disabled:r>=n.length-1,action:()=>this.store.moveLayer(e.id,r+1)},{label:`Move down`,disabled:r<=0,action:()=>this.store.moveLayer(e.id,r-1)},{separator:!0},{label:`Delete`,shortcut:`Del`,action:()=>this.store.removeLayer(e.id)}])}openAddMenu(e){let t=o().filter(e=>!e.hidden),n=[],r=``;for(let e of t)e.category!==r&&(r=e.category,n.push({label:r,heading:!0})),n.push({label:e.name,action:()=>this.store.addLayer(e.id)});X(e,n).classList.add(`menu--tall`)}},to=[.05,.1,.125,.25,1/3,.5,2/3,1,1.5,2,3,4,6,8,12,16],no=class{store;actions;el;canvas;viewport;frame;zoomLabel;formatLabel;cropBtn;cropOverlay;empty;busy;zoom=`fit`;panX=0;panY=0;imgW=0;imgH=0;srcW=0;srcH=0;spaceDown=!1;constructor(e,t){this.store=e,this.actions=t,this.canvas=W(`canvas`,{class:`stage__canvas`}),this.cropOverlay=W(`div`,{class:`crop`,hidden:!0}),this.frame=W(`div`,{class:`stage__frame`},this.canvas,this.cropOverlay),this.empty=W(`div`,{class:`stage__empty`},W(`p`,{class:`stage__empty-title`},`Drop an image here`),W(`p`,{class:`stage__empty-sub`},`or`),W(`div`,{class:`stage__empty-actions`},W(`button`,{class:`button button--primary`,type:`button`,onclick:()=>t.upload()},Y(`upload`,16),`Upload image`),W(`button`,{class:`button`,type:`button`,onclick:()=>t.sample(`portrait`)},Y(`image`,16),`Use a sample`))),this.busy=W(`div`,{class:`stage__busy`,hidden:!0},W(`span`,{class:`spinner`})),this.viewport=W(`div`,{class:`stage__viewport`},this.frame,this.empty,this.busy),this.zoomLabel=W(`span`,null,`Fit`),this.formatLabel=W(`span`,null,`PNG`);let n=W(`button`,{class:`toolbar__button`,type:`button`,title:`Zoom`,onclick:e=>this.zoomMenu(e.currentTarget)},this.zoomLabel,Y(`chevronDown`,14));this.cropBtn=W(`button`,{class:`toolbar__button toolbar__icon`,type:`button`,title:`Crop (C)`,onclick:()=>this.toggleCrop()},Y(`crop`,18));let r=W(`button`,{class:`toolbar__button toolbar__icon`,type:`button`,title:`Hold to compare with original (\\)`},Y(`compare`,18));r.addEventListener(`pointerdown`,()=>e.set({compare:!0}));for(let t of[`pointerup`,`pointerleave`,`pointercancel`])r.addEventListener(t,()=>e.state.compare&&e.set({compare:!1}));let i=W(`button`,{class:`toolbar__button`,type:`button`,title:`Export format`,onclick:t=>X(t.currentTarget,[`png`,`jpeg`,`webp`].map(t=>({label:t===`jpeg`?`JPG`:t.toUpperCase(),checked:e.state.export.format===t,action:()=>e.set({export:{...e.state.export,format:t}})})),{placement:`above`})},this.formatLabel),a=W(`button`,{class:`toolbar__export`,type:`button`,onclick:e=>t.openExport(e.currentTarget)},`Export`),o=W(`div`,{class:`toolbar`},n,W(`span`,{class:`toolbar__sep`}),this.cropBtn,r,W(`span`,{class:`toolbar__sep`}),i,a);this.el=W(`section`,{class:`stage`,attrs:{"aria-label":`Canvas`}},this.viewport,W(`div`,{class:`stage__toolbar`},o)),new ResizeObserver(()=>this.layout()).observe(this.viewport),this.bindPanZoom(),this.bindDrop(),e.subscribe((e,t)=>{e.export.format!==t.export.format&&(this.formatLabel.textContent=e.export.format===`jpeg`?`JPG`:e.export.format.toUpperCase()),(e.mode!==t.mode||e.project.crop!==t.project.crop||e.source!==t.source)&&this.syncCrop(),e.source!==t.source&&(this.empty.hidden=!!e.source)}),this.empty.hidden=!!e.state.source}setBusy(e){this.busy.hidden=!e}setImageSize(e,t,n,r){let i=e!==this.imgW||t!==this.imgH;this.imgW=e,this.imgH=t,this.srcW=n,this.srcH=r,i&&this.layout()}get displayScale(){let e=this.viewport.clientWidth,t=this.viewport.clientHeight;return!this.imgW||!e?1:this.zoom===`fit`?Math.min((e-48)/this.imgW,(t-48-56)/this.imgH,4/devicePixelRatio):this.zoom/devicePixelRatio}get displayDevicePixels(){return Math.max(this.imgW,this.imgH)*this.displayScale*devicePixelRatio}layout(){if(!this.imgW)return;let e=this.displayScale,t=this.imgW*e,n=this.imgH*e,r=this.viewport.clientWidth,i=this.viewport.clientHeight-56;this.zoom===`fit`&&(this.panX=0,this.panY=0);let a=Math.max(0,(t-r)/2+80),o=Math.max(0,(n-i)/2+80);this.panX=q(this.panX,-a,a),this.panY=q(this.panY,-o,o),this.frame.style.width=t+`px`,this.frame.style.height=n+`px`,this.frame.style.transform=`translate(calc(-50% + ${this.panX}px), calc(-50% + ${this.panY-28}px))`,this.canvas.classList.toggle(`is-pixelated`,e*devicePixelRatio>=2);let s=Math.round(e*devicePixelRatio*100);this.zoomLabel.textContent=this.zoom===`fit`?`Fit · ${s}%`:`${s}%`,this.syncCrop(),this.onLayout?.()}onLayout=null;setZoom(e,t){let n=this.displayScale;this.zoom=e===`fit`?`fit`:q(e,.02,32);let r=this.displayScale;if(t&&e!==`fit`){let e=this.viewport.getBoundingClientRect(),i=t.x-(e.left+e.width/2),a=t.y-(e.top+e.height/2-28),o=r/n;this.panX=i-(i-this.panX)*o,this.panY=a-(a-this.panY)*o}this.layout()}zoomBy(e,t){let n=this.displayScale*devicePixelRatio,r=e>0?to.find(e=>e>n*1.01)??16:[...to].reverse().find(e=>e<n*.99)??.05;this.setZoom(r,t)}zoomMenu(e){X(e,[{label:`Zoom in`,shortcut:`+`,action:()=>this.zoomBy(1)},{label:`Zoom out`,shortcut:`−`,action:()=>this.zoomBy(-1)},{separator:!0},{label:`Zoom to 50%`,action:()=>this.setZoom(.5)},{label:`Zoom to 100%`,shortcut:`1`,action:()=>this.setZoom(1)},{label:`Zoom to 200%`,shortcut:`2`,action:()=>this.setZoom(2)},{label:`Zoom to fit`,shortcut:`0`,checked:this.zoom===`fit`,action:()=>this.setZoom(`fit`)}],{placement:`above`})}bindPanZoom(){let e=this.viewport;e.addEventListener(`wheel`,e=>{if(this.imgW){if(e.preventDefault(),e.ctrlKey||e.metaKey){let t=this.displayScale*devicePixelRatio,n=Math.exp(-e.deltaY*(e.deltaMode===1?.05:.0025));this.setZoom(t*n,{x:e.clientX,y:e.clientY})}else{this.zoom===`fit`&&(this.zoom=this.displayScale*devicePixelRatio);let t=e.deltaMode===1?16:1;this.panX-=e.deltaX*t,this.panY-=e.deltaY*t,this.layout()}}},{passive:!1});let t=!1,n=0,r=0,i=0,a=0;e.addEventListener(`pointerdown`,o=>{(o.button===1||o.button===0&&this.spaceDown)&&(this.zoom===`fit`&&(this.zoom=this.displayScale*devicePixelRatio),t=!0,n=o.clientX,r=o.clientY,i=this.panX,a=this.panY,e.setPointerCapture(o.pointerId),e.classList.add(`is-panning`),o.preventDefault())}),e.addEventListener(`pointermove`,e=>{t&&(this.panX=i+e.clientX-n,this.panY=a+e.clientY-r,this.layout())});let o=()=>{t=!1,e.classList.remove(`is-panning`)};e.addEventListener(`pointerup`,o),e.addEventListener(`pointercancel`,o),e.addEventListener(`dblclick`,t=>{(t.target===e||t.target===this.canvas)&&this.setZoom(this.zoom===`fit`?1:`fit`,{x:t.clientX,y:t.clientY})}),window.addEventListener(`keydown`,t=>{t.code===`Space`&&!ro(t)&&(this.spaceDown=!0,e.classList.add(`can-pan`),t.target===document.body&&t.preventDefault())}),window.addEventListener(`keyup`,t=>{t.code===`Space`&&(this.spaceDown=!1,e.classList.remove(`can-pan`))})}bindDrop(){let e=this.el;e.addEventListener(`dragover`,t=>{t.dataTransfer?.types.includes(`Files`)&&(t.preventDefault(),e.classList.add(`is-dropping`))}),e.addEventListener(`dragleave`,t=>{(t.target===e||!e.contains(t.relatedTarget))&&e.classList.remove(`is-dropping`)}),e.addEventListener(`drop`,t=>{t.preventDefault(),e.classList.remove(`is-dropping`),t.dataTransfer?.files?.length&&this.actions.loadFiles(t.dataTransfer.files)})}toggleCrop(){this.store.state.source&&this.store.set({mode:this.store.state.mode===`crop`?`effect`:`crop`})}syncCrop(){let e=this.store.state,t=e.mode===`crop`&&!!e.source;if(this.cropBtn.classList.toggle(`is-active`,t),this.cropOverlay.hidden=!t,!t)return;let n=e.project.crop??{x:0,y:0,w:1,h:1},r=this.cropRect??this.buildCropOverlay();r.style.left=n.x*100+`%`,r.style.top=n.y*100+`%`,r.style.width=n.w*100+`%`,r.style.height=n.h*100+`%`,r.style.transform=n.rotation?`rotate(${n.rotation}deg)`:``}cropRect=null;cropAspect=null;buildCropOverlay(){let e=W(`div`,{class:`crop__rect`},W(`div`,{class:`crop__grid`}));for(let t of[`nw`,`n`,`ne`,`e`,`se`,`s`,`sw`,`w`])e.append(W(`div`,{class:`crop__handle crop__handle--${t}`,dataset:{h:t}}));this.cropOverlay.append(e),this.cropRect=e;let t=null,n=0,r=0,i=``;e.addEventListener(`pointerdown`,a=>{i=a.target.dataset.h??`move`,t={...this.store.state.project.crop??{x:0,y:0,w:1,h:1}},n=a.clientX,r=a.clientY,e.setPointerCapture(a.pointerId),a.preventDefault(),a.stopPropagation()}),e.addEventListener(`pointermove`,e=>{if(!t)return;let a=this.frame.getBoundingClientRect(),o=(e.clientX-n)/a.width,s=(e.clientY-r)/a.height;this.store.setCrop(this.dragCrop(t,i,o,s),`crop`)});let a=()=>{t&&this.store.commit(),t=null};return e.addEventListener(`pointerup`,a),e.addEventListener(`pointercancel`,a),e}dragCrop(e,t,n,r){let{x:i,y:a,w:o,h:s}=e,c=.02;if(t===`move`)return i=q(i+n,0,1-o),a=q(a+r,0,1-s),{...e,x:i,y:a};let l=i+o,u=a+s;if(t.includes(`w`)&&(i=q(i+n,0,l-c)),t.includes(`e`)&&(l=q(l+n,i+c,1)),t.includes(`n`)&&(a=q(a+r,0,u-c)),t.includes(`s`)&&(u=q(u+r,a+c,1)),o=l-i,s=u-a,this.cropAspect){let n=this.cropAspect*(this.srcH/this.srcW);if(t===`n`||t===`s`?o=s*n:t===`e`||t===`w`?s=o/n:o/s>n?o=s*n:s=o/n,t.includes(`w`)&&(i=l-o),t.includes(`n`)&&(a=u-s),(t===`n`||t===`s`)&&(i=q(e.x+(e.w-o)/2,0,1-o)),(t===`e`||t===`w`)&&(a=q(e.y+(e.h-s)/2,0,1-s)),i+o>1||a+s>1||i<0||a<0)return e}return{...e,x:i,y:a,w:o,h:s}}};function ro(e){let t=e.target;if(!t)return!1;let n=t.tagName;return n===`INPUT`||n===`TEXTAREA`||n===`SELECT`||t.isContentEditable}function Q(e,t,...n){return W(`div`,{class:`param__header`},W(`label`,{class:`param__title`,title:`Double-click to reset`,ondblclick:()=>t.reset()},e),W(`div`,{class:`param__trail`},...n))}function io(e,t,n,r={}){let i=W(`input`,{class:`param__number`,type:`text`,inputMode:`decimal`,spellcheck:!1,value:K(e,t)}),a=()=>{let e=parseFloat(i.value.replace(`,`,`.`));Number.isFinite(e)&&n(e)};return i.addEventListener(`change`,a),i.addEventListener(`keydown`,e=>{if(e.key===`Enter`)a(),i.blur();else if(e.key===`ArrowUp`||e.key===`ArrowDown`){e.preventDefault();let a=parseFloat(i.value)||0,o=e.shiftKey?10:e.altKey?.1:1,s=a+(e.key===`ArrowUp`?1:-1)*t*o;r.min!==void 0&&(s=Math.max(r.min,s)),r.max!==void 0&&(s=Math.min(r.max,s)),i.value=K(s,t),n(s)}}),i.addEventListener(`focus`,()=>i.select()),i.style.width=Math.max(4,K(r.max??e,t).length+2)+`ch`,i}function ao(e,t,n,r){let i=r>0?Math.round((e-t)/r)*r+t:e;return q(parseFloat(i.toFixed(6)),t,n)}function oo(e,t){let n=W(`div`,{class:`slider__fill`}),r=W(`div`,{class:`slider__thumb`}),i=W(`div`,{class:`slider__track`,tabIndex:0},W(`div`,{class:`slider__rail`}),n,r),a=e=>{e=q(e,0,1),r.style.left=`${e*100}%`,n.style.width=`${e*100}%`};return a(e),J(i,{start:()=>{},move:e=>{let n=i.getBoundingClientRect();t(q((e.clientX-n.left)/n.width,0,1),!1)},end:e=>{let n=i.getBoundingClientRect();t(q((e.clientX-n.left)/n.width,0,1),!0)}}),{el:i,set:a}}function so(e){if(!e)return null;let t=e.split(/\s*[·,;]\s*(?=\d+\s*[:=]?\s*\S)/),n=new Map;for(let e of t){let t=/^(\d+)\s*[:=]?\s*(.+)$/.exec(e.trim());if(!t)return null;n.set(Number(t[1]),t[2].trim())}return n.size>=2?n:null}function co(e,t,n){let r=e.step??(e.type===`int`?1:.01),i=e.type===`int`?so(e.hint):null,a=i?W(`span`,{class:`param__value-label param__value-name`},i.get(Math.round(t))??``):null,o=e.curve??1,s=t=>q((t-e.min)/(e.max-e.min||1),0,1)**(1/o),c=t=>e.min+t**+o*(e.max-e.min),l=t,u=io(t,r,t=>{let n=e.type===`int`?Math.round(t):t;p(n,!0)},{min:e.min,max:e.max}),d=e.unit?W(`span`,{class:`param__unit`},e.unit):null,f=oo(s(t),(t,n)=>p(ao(c(t),e.min,e.max,r),n)),p=(e,t)=>{l=e,f.set(s(e)),u.value=K(e,r),a&&(a.textContent=i.get(Math.round(e))??``),n.set(e,{commit:t})};return f.el.addEventListener(`keydown`,t=>{let n=t.key;if(n!==`ArrowLeft`&&n!==`ArrowRight`&&n!==`ArrowUp`&&n!==`ArrowDown`)return;t.preventDefault();let i=n===`ArrowLeft`||n===`ArrowDown`?-1:1,a=t.shiftKey?10:1;p(q(ao(l+i*r*a,e.min,e.max,r),e.min,e.max),!0)}),{el:W(`div`,{class:`param param--slider`,title:i?void 0:e.hint},Q(e.label,n,a,u,d),f.el),update(e){l=Number(e),f.set(s(l)),a&&(a.textContent=i.get(Math.round(l))??``),document.activeElement!==u&&(u.value=K(l,r))}}}function lo(e,t,n){let r=e.options.length,i=W(`span`,{class:`param__value-label`},e.options[t]??``),a=oo(r>1?t/(r-1):0,(t,o)=>{let s=Math.round(t*(r-1));i.textContent=e.options[s]??``,a.set(r>1?s/(r-1):0),n.set(s,{commit:o})});return{el:W(`div`,{class:`param param--slider param--enum`},W(`div`,{class:`param__header`},(e.label?W(`label`,{class:`param__title`,ondblclick:()=>n.reset()},e.label):null)??W(`span`),W(`div`,{class:`param__trail`},i)),a.el),update(t){let n=Number(t);i.textContent=e.options[n]??``,a.set(r>1?n/(r-1):0)}}}function uo(e,t,n){let r=e.options.map((e,t)=>W(`button`,{class:`switcher__item`,type:`button`,onclick:()=>n.set(t,{commit:!0})},e)),i=W(`div`,{class:`switcher`},...r),a=W(`div`,{class:`param param--switcher`},Q(e.label,n),i),o=e=>r.forEach((t,n)=>t.classList.toggle(`is-active`,n===Number(e)));return o(t),{el:a,update:o}}function fo(e,t,n){let r=W(`span`,{class:`dropdown__text`},e.options[t]??``),i=W(`button`,{class:`dropdown`,type:`button`},r,Y(`chevronDown`,16)),a=t,o=e.livePreview?n.preview?.bind(n):void 0;return i.addEventListener(`click`,()=>{let t=[];e.options.forEach((r,i)=>{e.groups?.includes(i)&&t.push({separator:!0}),t.push({label:r,checked:i===a,action:()=>n.set(i,{commit:!0}),preview:o&&(()=>o(i))})}),X(i,t,{align:`stretch`,onPreviewEnd:o&&(()=>o(null))})}),{el:W(`div`,{class:`param param--select`},Q(e.label,n),i),update(t){a=Number(t),r.textContent=e.options[a]??``}}}function po(e,t,n){let r=W(`button`,{class:`switcher__item`,type:`button`,onclick:()=>n.set(!0,{commit:!0})},`On`),i=W(`button`,{class:`switcher__item`,type:`button`,onclick:()=>n.set(!1,{commit:!0})},`Off`),a=W(`div`,{class:`param param--toggle`},Q(e.label,n,W(`div`,{class:`switcher switcher--small`},r,i))),o=e=>{r.classList.toggle(`is-active`,!!e),i.classList.toggle(`is-active`,!e)};return o(t),{el:a,update:o}}function mo(e,t,n){let r=W(`input`,{type:`color`,class:`color__native`,value:t}),i=W(`span`,{class:`color__swatch`,style:{background:t}},r),a=W(`input`,{class:`param__number color__hex`,type:`text`,value:t.toUpperCase(),spellcheck:!1,maxLength:7});return r.addEventListener(`input`,()=>{i.style.background=r.value,a.value=r.value.toUpperCase(),n.set(r.value,{commit:!1})}),r.addEventListener(`change`,()=>n.set(r.value,{commit:!0})),a.addEventListener(`change`,()=>{let e=a.value.trim();e.startsWith(`#`)||(e=`#`+e),/^#[0-9a-fA-F]{3}$/.test(e)&&(e=`#`+e.slice(1).split(``).map(e=>e+e).join(``)),/^#[0-9a-fA-F]{6}$/.test(e)&&n.set(e.toLowerCase(),{commit:!0})}),{el:W(`div`,{class:`param param--color`},Q(e.label,n,a,i)),update(e){let t=String(e);r.value=t,i.style.background=t,document.activeElement!==a&&(a.value=t.toUpperCase())}}}function ho(e,t,n){let r=e.step??.01,i=[...t],a=io(i[0],r,t=>p([q(t,e.min,i[1]),i[1]],!0)),o=io(i[1],r,t=>p([i[0],q(t,i[0],e.max)],!0)),s=W(`div`,{class:`slider__fill slider__fill--range`}),c=W(`div`,{class:`slider__thumb`}),l=W(`div`,{class:`slider__thumb`}),u=W(`div`,{class:`slider__track`},W(`div`,{class:`slider__rail`}),s,c,l),d=t=>(t-e.min)/(e.max-e.min||1),f=()=>{c.style.left=d(i[0])*100+`%`,l.style.left=d(i[1])*100+`%`,s.style.left=d(i[0])*100+`%`,s.style.width=(d(i[1])-d(i[0]))*100+`%`,document.activeElement!==a&&(a.value=K(i[0],r)),document.activeElement!==o&&(o.value=K(i[1],r))},p=(e,t)=>{i=e,f(),n.set([...e],{commit:t})},m=0;return J(u,{start:t=>{let n=u.getBoundingClientRect(),r=e.min+(t.clientX-n.left)/n.width*(e.max-e.min);m=Math.abs(r-i[0])<=Math.abs(r-i[1])?0:1,i[0]===i[1]&&(m=r<i[0]?0:1)},move:t=>{let n=u.getBoundingClientRect(),a=ao(e.min+q((t.clientX-n.left)/n.width,0,1)*(e.max-e.min),e.min,e.max,r);p(m===0?[Math.min(a,i[1]),i[1]]:[i[0],Math.max(a,i[0])],!1)},end:()=>n.set([...i],{commit:!0})}),f(),{el:W(`div`,{class:`param param--range`},Q(e.label,n,a,o),u),update(e){i=[...e],f()}}}function go(e,t,n){let r=e.multiline?W(`textarea`,{class:`param__text`,rows:3,value:t,spellcheck:!1}):W(`input`,{class:`param__text`,type:`text`,value:t,spellcheck:!1});return r.addEventListener(`input`,()=>n.set(r.value,{commit:!1})),r.addEventListener(`change`,()=>n.set(r.value,{commit:!0})),{el:W(`div`,{class:`param param--text`},Q(e.label,n),r),update(e){document.activeElement!==r&&(r.value=String(e??``))}}}function _o(e,t,n,r){let i=e.min??[-1,-1],a=e.max??[1,1],o=e.step??.01,s=[...t],c=io(s[0],o,e=>p([e,s[1]],!0)),l=io(s[1],o,e=>p([s[0],e],!0)),u=W(`div`,{class:`plane__point`}),d=W(`div`,{class:`plane`},W(`div`,{class:`plane__axis plane__axis--x`}),W(`div`,{class:`plane__axis plane__axis--y`}),u),f=()=>{let e=(s[0]-i[0])/(a[0]-i[0]),t=(s[1]-i[1])/(a[1]-i[1]);u.style.left=q(e,0,1)*100+`%`,u.style.top=(1-q(t,0,1))*100+`%`,document.activeElement!==c&&(c.value=K(s[0],o)),document.activeElement!==l&&(l.value=K(s[1],o))},p=(e,t)=>{s=e,f(),n.set([...e],{commit:t})},m=e=>{let t=d.getBoundingClientRect(),n=q((e.clientX-t.left)/t.width,0,1),r=q(1-(e.clientY-t.top)/t.height,0,1),s=(e,t,n)=>parseFloat((Math.round((t+e*(n-t))/o)*o).toFixed(5));return[s(n,i[0],a[0]),s(r,i[1],a[1])]};return J(d,{move:e=>p(m(e),!1),end:e=>p(m(e),!0)}),d.addEventListener(`dblclick`,()=>n.reset()),new ResizeObserver(()=>{let e=q(r(),.4,2.5);d.style.aspectRatio=String(e)}).observe(d),f(),{el:W(`div`,{class:`param param--plane`},Q(e.label,n,c,l),d),update(e){s=[...e],f()}}}function vo(e,t,n){let r=t.map(e=>[...e]),i=G(`path`,{class:`curve__line`,d:``,stroke:e.color??`currentColor`}),a=G(`line`,{class:`curve__diag`,x1:0,y1:160,x2:240,y2:0}),o=G(`g`,{class:`curve__grid`});for(let e=1;e<4;e++)o.append(G(`line`,{x1:240*e/4,y1:0,x2:240*e/4,y2:160})),o.append(G(`line`,{x1:0,y1:160*e/4,x2:240,y2:160*e/4}));let s=G(`g`),c=G(`svg`,{class:`curve__svg`,viewBox:`0 0 240 160`,preserveAspectRatio:`none`},o,e.periodic?null:a,i,s),l=W(`div`,{class:`curve`},e.hueBackground?W(`div`,{class:`curve__hue`}):null,c),u=-1,d=()=>{let t=Je(r,e.periodic),n=``;for(let e=0;e<=96;e++){let r=e/96,i=q(t(r),-.05,1.05);n+=(e?`L`:`M`)+(r*240).toFixed(2)+` `+((1-i)*160).toFixed(2)}i.setAttribute(`d`,n),s.innerHTML=``,r.forEach((e,t)=>{s.append(G(`circle`,{class:`curve__pt`+(t===u?` is-active`:``),cx:e[0]*240,cy:(1-e[1])*160,r:5}))})},f=e=>{let t=l.getBoundingClientRect();return[q((e.clientX-t.left)/t.width,0,1),q(1-(e.clientY-t.top)/t.height,0,1)]},p=e=>n.set(r.map(e=>[yo(e[0]),yo(e[1])]),{commit:e}),m=!1;J(l,{start:t=>{let[n,i]=f(t),a=l.getBoundingClientRect(),o=10/a.width;if(u=r.findIndex(e=>Math.abs(e[0]-n)<o&&Math.abs(e[1]-i)<10/a.height*1.2),u<0){let t=Je(r,e.periodic),a=Math.abs(t(n)-i)<.08?t(n):i;r.push([n,a]),r.sort((e,t)=>e[0]-t[0]),u=r.findIndex(e=>e[0]===n)}m=!1},move:t=>{if(u<0)return;let n=l.getBoundingClientRect(),i=t.clientY<n.top-24||t.clientY>n.bottom+24,a=!e.periodic&&(u===0||u===r.length-1);m=i&&r.length>2&&!a;let[o,s]=f(t),c=u>0?r[u-1][0]+.005:0,h=u<r.length-1?r[u+1][0]-.005:1;o=q(o,c,h),!e.periodic&&u===0&&r.length>1&&!t.shiftKey&&(o=Math.min(o,h)),r[u]=[o,s],l.classList.toggle(`is-removing`,m),d(),p(!1)},end:()=>{m&&u>=0&&r.splice(u,1),l.classList.remove(`is-removing`),u=-1,d(),p(!0)}}),l.addEventListener(`dblclick`,e=>{let t=l.getBoundingClientRect(),n=(e.clientX-t.left)/t.width,i=1-(e.clientY-t.top)/t.height,a=r.findIndex(e=>Math.abs(e[0]-n)<.04&&Math.abs(e[1]-i)<.06);a>=0&&r.length>2&&(r.splice(a,1),d(),p(!0))});let h=W(`button`,{class:`icon-button icon-button--tiny`,type:`button`,title:`Reset curve`,onclick:()=>n.reset()},Y(`reset`,14));return d(),{el:W(`div`,{class:`param param--curve`},Q(e.label,n,h),l,W(`div`,{class:`param__hint`},`Click to add · drag off to remove`)),update(e){u>=0||(r=e.map(e=>[...e]),d())}}}var yo=e=>Math.round(e*1e3)/1e3;function bo(e,t,n){let r=e.evaluate??Xe,i=t.map(e=>({...e})),a=0,o=W(`div`,{class:`gradient__bar`}),s=W(`div`,{class:`gradient__stops`}),c=W(`div`,{class:`gradient__mids`}),l=W(`input`,{type:`color`,class:`gradient__picker`}),u=io(0,.01,e=>{i[a]&&(i[a].pos=q(e,0,1),h(),v(),m(!0))},{min:0,max:1}),d=W(`span`,{class:`color__swatch`},l),f=W(`button`,{class:`icon-button icon-button--tiny`,type:`button`,title:`Remove stop`,onclick:()=>g(a)},Y(`trash`,14)),p=W(`button`,{class:`icon-button icon-button--tiny`,type:`button`,title:`Reverse`,onclick:()=>_()},Y(`flipH`,14)),m=e=>n.set(i.map(e=>({...e,pos:yo(e.pos)})),{commit:e}),h=()=>{let e=i[a];i.sort((e,t)=>e.pos-t.pos),a=i.indexOf(e)},g=e=>{i.length<=2||(i.splice(e,1),a=Math.max(0,Math.min(a,i.length-1)),v(),m(!0))},_=()=>{i=i.map(e=>({...e,pos:1-e.pos})).reverse();let e=i.map(e=>e.mid);i.forEach((t,n)=>t.mid=n<i.length-1?1-(e[n+1]??.5):.5),v(),m(!0)},v=()=>{o.style.background=xo(i,r),s.innerHTML=``,i.forEach((e,t)=>{let n=W(`div`,{class:[`gradient__stop`,t===a&&`is-selected`],style:{left:e.pos*100+`%`,"--c":e.color}}),c=!1,u=!1;J(n,{start:()=>{a=t,c=!1,b(),s.querySelectorAll(`.gradient__stop`).forEach((e,n)=>e.classList.toggle(`is-selected`,n===t))},move:e=>{let t=o.getBoundingClientRect(),s=q((e.clientX-t.left)/t.width,0,1);u=i.length>2&&e.clientY>t.bottom+40,n.classList.toggle(`is-removing`,u),Math.abs(s-i[a].pos)>.001&&(c=!0),i[a].pos=s,n.style.left=s*100+`%`,o.style.background=xo(i,r),y(),b(),m(!1)},end:()=>{u?g(a):(h(),v(),m(!0),c||l.click())}}),s.append(n)}),y(),b()},y=()=>{c.innerHTML=``;let e=[...i].sort((e,t)=>e.pos-t.pos);for(let t=0;t<e.length-1;t++){let n=e[t],a=e[t+1],s=n.mid??.5,l=W(`div`,{class:`gradient__mid`,style:{left:(n.pos+(a.pos-n.pos)*s)*100+`%`},title:`Midpoint`});J(l,{move:e=>{let t=o.getBoundingClientRect(),s=q((e.clientX-t.left)/t.width,n.pos,a.pos);n.mid=q((s-n.pos)/Math.max(1e-6,a.pos-n.pos),.05,.95),l.style.left=(n.pos+(a.pos-n.pos)*n.mid)*100+`%`,o.style.background=xo(i,r),m(!1)},end:()=>m(!0)}),l.addEventListener(`dblclick`,()=>{n.mid=.5,v(),m(!0)}),c.append(l)}},b=()=>{let e=i[a];e&&(l.value=e.color,d.style.background=e.color,document.activeElement!==u&&(u.value=K(e.pos,.01)))};return l.addEventListener(`input`,()=>{i[a]&&(i[a].color=l.value,v(),m(!1))}),l.addEventListener(`change`,()=>m(!0)),o.addEventListener(`pointerdown`,e=>{let t=o.getBoundingClientRect(),n=q((e.clientX-t.left)/t.width,0,1),s=r(i,n);i.push({pos:n,color:qe(s[0],s[1],s[2]),mid:.5}),a=i.length-1,h(),v(),m(!0)}),v(),{el:W(`div`,{class:`param param--gradient`},Q(e.label,n,p),W(`div`,{class:`gradient`},o,c,s),W(`div`,{class:`gradient__inspector`},d,W(`span`,{class:`param__hint`},`Location`),u,f)),update(e){let t=e.map(e=>({...e}));JSON.stringify(t)!==JSON.stringify(i)&&(i=t,a=Math.min(a,i.length-1),v())}}}function xo(e,t=Xe){let n=[];for(let r=0;r<=48;r++){let i=r/48,a=t(e,i);n.push(`${qe(a[0],a[1],a[2])} ${(i*100).toFixed(1)}%`)}return`linear-gradient(90deg, ${n.join(`,`)})`}function So(e,t,n){let r=[...t],i=io(r[0],1,e=>l([(e%360+360)%360,r[1]],!0),{min:0,max:360}),a=io(r[1],.01,e=>l([r[0],q(e,0,1)],!0),{min:0,max:1}),o=W(`div`,{class:`wheel__point`}),s=W(`div`,{class:`wheel__disc`},W(`div`,{class:`wheel__center`}),o),c=()=>{let e=r[0]*Math.PI/180;o.style.left=50+Math.cos(e)*r[1]*50+`%`,o.style.top=50-Math.sin(e)*r[1]*50+`%`,document.activeElement!==i&&(i.value=K(r[0],1)),document.activeElement!==a&&(a.value=K(r[1],.01))},l=(e,t)=>{r=e,c(),n.set([...e],{commit:t})},u=e=>{let t=s.getBoundingClientRect(),n=(e.clientX-t.left)/t.width*2-1,r=-((e.clientY-t.top)/t.height*2-1),i=Math.atan2(r,n)*180/Math.PI;i<0&&(i+=360);let a=q(Math.hypot(n,r),0,1);return[Math.round(i),Math.round(a*100)/100]};return J(s,{move:e=>l(u(e),!1),end:e=>l(u(e),!0)}),s.addEventListener(`dblclick`,()=>n.reset()),c(),{el:W(`div`,{class:`param param--wheel`},Q(e.label,n,i,W(`span`,{class:`param__unit`},`°`),a),W(`div`,{class:`wheel`},s)),update(e){r=[...e],c()}}}function Co(e,t,n){let r=[...t],i=e.maxColors??32,a=W(`div`,{class:`palette`}),o=()=>n.set([...r],{commit:!0}),s=()=>{a.innerHTML=``,r.forEach((e,t)=>{let i=W(`input`,{type:`color`,value:e,class:`palette__input`});i.addEventListener(`input`,()=>{r[t]=i.value,c.style.background=i.value,n.set([...r],{commit:!1})}),i.addEventListener(`change`,o);let c=W(`label`,{class:`palette__swatch`,style:{background:e},title:e+` · right-click to remove`},i);c.addEventListener(`contextmenu`,e=>{e.preventDefault(),!(r.length<=1)&&(r.splice(t,1),s(),o())}),a.append(c)}),r.length<i&&a.append(W(`button`,{class:`palette__add`,type:`button`,title:`Add color`,onclick:()=>{r.push(r[r.length-1]??`#ffffff`),s(),o()}},Y(`plus`,14)))};return s(),{el:W(`div`,{class:`param param--palette`},Q(e.label,n),a),update(e){let t=[...e];t.join()!==r.join()&&(r=t,s())}}}function wo(e,t,n){let r=new Set(t),i=W(`div`,{class:`patterns`}),a=()=>{i.innerHTML=``,e.patterns.forEach((e,t)=>{let s=document.createElement(`canvas`);s.width=16,s.height=16;let c=s.getContext(`2d`),l=c.createImageData(16,16);for(let t=0;t<16;t++)for(let n=0;n<16;n++){let r=e[t%8]>>7-n%8&1,i=(t*16+n)*4,a=r?20:240;l.data[i]=l.data[i+1]=l.data[i+2]=a,l.data[i+3]=255}c.putImageData(l,0,0);let u=W(`button`,{class:[`patterns__swatch`,r.has(String(t))&&`is-selected`],type:`button`,title:`Pattern ${t+1}`,onclick:()=>{let e=String(t);r.has(e)?r.size>1&&r.delete(e):r.add(e),a(),n.set(o(),{commit:!0})}},s);i.append(u)})},o=()=>[...r].sort((e,t)=>+e-t);return a(),{el:W(`div`,{class:`param param--patterns`},Q(e.label,n),i),update(e){r=new Set(e),a()}}}function To(e,t,n,r){let i=W(`input`,{type:`file`,accept:`image/*`,hidden:!0}),a=W(`div`,{class:`texture__thumb`}),o=W(`span`,{class:`texture__name`},`No image`),s=W(`button`,{class:`icon-button icon-button--tiny`,type:`button`,title:`Remove image`,onclick:e=>{e.stopPropagation(),n.set(null,{commit:!0})}},Y(`x`,14)),c=W(`button`,{class:`icon-button icon-button--tiny`,type:`button`,title:`Use a loaded image`,onclick:e=>{e.stopPropagation();let t=r.all();if(!t.length)return Z(`No images loaded yet`);X(c,t.map(e=>({label:e.name,action:()=>n.set({assetId:e.id},{commit:!0})})))}},Y(`folder`,14)),l=W(`button`,{class:`texture`,type:`button`,onclick:()=>i.click()},a,W(`div`,{class:`texture__meta`},o,W(`span`,{class:`param__hint`},`Click or drop an image`))),u=async e=>{try{let t=await r.add(e,e.name);n.set({assetId:t.id},{commit:!0})}catch{Z(`Could not load that image`,`error`)}};i.addEventListener(`change`,()=>{let e=i.files?.[0];e&&u(e),i.value=``}),l.addEventListener(`dragover`,e=>{e.preventDefault(),l.classList.add(`is-over`)}),l.addEventListener(`dragleave`,()=>l.classList.remove(`is-over`)),l.addEventListener(`drop`,e=>{e.preventDefault(),e.stopPropagation(),l.classList.remove(`is-over`);let t=e.dataTransfer?.files?.[0];t&&u(t)});let d=e=>{let t=e,n=t?.assetId?r.get(t.assetId):void 0;a.style.backgroundImage=n?`url(${n.url})`:``,a.classList.toggle(`is-empty`,!n),o.textContent=n?n.name:t?.assetId?`Missing image`:`No image`,s.hidden=!t};return d(t),{el:W(`div`,{class:`param param--texture`},Q(e.label,n,c,s),l,i),update:d}}function Eo(e,t,n){let r=W(`span`,{class:`dropdown__text`},t),i=W(`button`,{class:`dropdown`,type:`button`},r,Y(`chevronDown`,16));return i.addEventListener(`click`,()=>{X(i,Pr.map(e=>({label:e.name,checked:e.name===t,action:async()=>{await Ir(e.name),n.set(e.name,{commit:!0})}})),{align:`stretch`})}),{el:W(`div`,{class:`param param--select`},Q(e.label,n),i),update(e){t=String(e),r.textContent=t,r.style.fontFamily=`"${t}", sans-serif`}}}function $(e,t){return e+Math.random()*(t-e)}function Do(){let e=Math.random(),t=$(.35,1),n=$(.25,.8),r=t=>(t+e*12)%12,i=t*Math.min(n,1-n),a=e=>n-i*Math.max(-1,Math.min(r(e)-3,Math.min(9-r(e),1)));return qe(a(0),a(8),a(4))}function Oo(e,t){let n={...t};for(let r of e.params)if(!r.noRandom)switch(r.type){case`float`:case`int`:{let[e,t]=r.randomRange??[r.min,r.max],i=r.default,a=Math.random()<.5?$(e,t):i+($(e,t)-i)*$(.15,.6),o=r.step??(r.type===`int`?1:.01);a=Math.round(a/o)*o,n[r.key]=Math.min(r.max,Math.max(r.min,parseFloat(a.toFixed(5))));break}case`enum`:(r.ui!==`select`||Math.random()<.3)&&(n[r.key]=Math.floor(Math.random()*r.options.length));break;case`bool`:Math.random()<.3&&(n[r.key]=!t[r.key]);break;case`color`:n[r.key]=Do();break;case`vec2`:{let e=r.min??[-1,-1],t=r.max??[1,1];n[r.key]=[parseFloat($(e[0]*.6,t[0]*.6).toFixed(3)),parseFloat($(e[1]*.6,t[1]*.6).toFixed(3))];break}case`wheel`:n[r.key]=[Math.round($(0,360)),parseFloat($(0,.5).toFixed(2))];break;case`gradient`:{let e=2+Math.floor(Math.random()*3),t=[];for(let n=0;n<e;n++)t.push({pos:n/(e-1),color:Do(),mid:.5});n[r.key]=t;break}case`palette`:{let e=Math.max(2,t[r.key]?.length??4);n[r.key]=Array.from({length:e},Do);break}}return n}var ko=class{store;assets;aspect;el;title;body;mounted=[];layerId=null;effectId=null;layerSection=null;lastParams=null;constructor(e,t,n){this.store=e,this.assets=t,this.aspect=n,this.title=W(`span`,{class:`panel__title`},`Controls`);let r=W(`button`,{class:`icon-button`,type:`button`,title:`Randomize`,onclick:()=>this.randomize()},Y(`shuffle`,18)),i=W(`button`,{class:`icon-button`,type:`button`,title:`Reset to defaults`,onclick:()=>this.resetAll()},Y(`reset`,18));this.body=W(`div`,{class:`panel__scroll params`}),this.el=W(`aside`,{class:`panel panel--controls`,attrs:{"aria-label":`Controls`}},W(`div`,{class:`panel__header`},this.title,W(`div`,{class:`panel__actions`},r,i)),this.body),e.subscribe((e,t)=>{e.mode===`effect`&&(e.selectedLayerId!==t.selectedLayerId||e.project!==t.project||e.mode!==t.mode)&&this.sync()}),t.onChange(()=>this.refreshValues(!0)),this.sync()}get layer(){return this.store.selectedLayer}sync(){let e=this.layer,t=e?a(e.effectId):void 0;!e||!t?(this.layerId=null,this.effectId=null,this.mounted=[],this.layerSection=null,this.title.textContent=`Controls`,ba(this.body),this.body.append(W(`div`,{class:`empty`},W(`p`,null,`Select a layer to edit its controls,`),W(`p`,null,`or pick an effect from the library to add one.`)))):e.id!==this.layerId||t.id!==this.effectId?this.build(e,t):this.refreshValues()}host(e,t){return{set:(n,r)=>{this.store.setParam(e,t.key,n),r?.commit&&this.store.commit()},reset:()=>{this.store.setParam(e,t.key,s(t.default),!1),this.store.commit()},preview:n=>{let r=this.store.state.project.layers.find(t=>t.id===e)?.params[t.key];this.setPreview(n===null||n===r?null:{layerId:e,params:{[t.key]:n}})}}}setPreview(e){(e!==null||this.store.state.preview!==null)&&this.store.set({preview:e})}build(e,t){this.layerId=e.id,this.effectId=t.id,this.title.textContent=e.name||t.name,ba(this.body),this.mounted=[];let n=null,r;for(let i of t.params){let t=this.createControl(i,e.params[i.key]??i.default,this.host(e.id,i));if(t){if(i.hint&&!t.el.title&&!(i.type===`int`&&t.el.querySelector(`.param__value-name`))&&(t.el.title=i.hint),this.mounted.push({def:i,ctl:t}),i.group!==r){if(r=i.group,i.group){let e=W(`details`,{class:`param-group`,open:!0},W(`summary`,{class:`param-group__summary`},Y(`chevronRight`,14,`param-group__chevron`),i.group));n=W(`div`,{class:`param-group__controls`}),e.append(n),this.body.append(e)}else n=null}(n??this.body).append(t.el)}}let i={set:(t,n)=>{this.store.patchLayer(e.id,{opacity:Number(t)},`opacity:`+e.id),n?.commit&&this.store.commit()},reset:()=>this.store.patchLayer(e.id,{opacity:1})},a={set:t=>this.store.patchLayer(e.id,{blend:p[Number(t)]??`normal`}),reset:()=>this.store.patchLayer(e.id,{blend:`normal`}),preview:t=>{let n=t===null?null:p[Number(t)]??`normal`,r=this.store.state.project.layers.find(t=>t.id===e.id)?.blend;this.setPreview(n===null||n===r?null:{layerId:e.id,blend:n})}},o=co({type:`float`,key:`_opacity`,label:`layer opacity`,min:0,max:1,step:.01,default:1},e.opacity,i),s=fo({type:`enum`,key:`_blend`,label:`layer blend`,options:p.map(e=>h[e]),default:0,ui:`select`,groups:m,livePreview:!0},Math.max(0,p.indexOf(e.blend)),a);this.layerSection={opacity:o,blend:s};let c=W(`details`,{class:`param-group param-group--layer`},W(`summary`,{class:`param-group__summary`},Y(`chevronRight`,14,`param-group__chevron`),`Layer`),W(`div`,{class:`param-group__controls`},o.el,s.el));(e.opacity<1||e.blend!==`normal`)&&(c.open=!0),this.body.append(c),this.lastParams=e.params,this.applyVisibility(e.params)}refreshValues(e=!1){let t=this.layer;if(t){if(this.title.textContent=t.name||a(t.effectId)?.name||`Controls`,e||t.params!==this.lastParams){for(let n of this.mounted){let r=t.params[n.def.key];(e||r!==this.lastParams?.[n.def.key])&&n.ctl.update(r??n.def.default)}this.lastParams=t.params,this.applyVisibility(t.params)}this.layerSection&&(this.layerSection.opacity.update(t.opacity),this.layerSection.blend.update(Math.max(0,p.indexOf(t.blend))))}}applyVisibility(e){for(let t of this.mounted){let n=!t.def.visibleIf||t.def.visibleIf(e);t.ctl.el.hidden=!n}}createControl(e,t,n){switch(e.type){case`float`:case`int`:return co(e,Number(t),n);case`enum`:return e.ui===`switcher`?uo(e,Number(t),n):e.ui===`select`?fo(e,Number(t),n):lo(e,Number(t),n);case`bool`:return po(e,!!t,n);case`color`:return mo(e,String(t),n);case`vec2`:return _o(e,t,n,this.aspect);case`range`:return ho(e,t,n);case`curve`:return vo(e,t,n);case`gradient`:return bo(e,t,n);case`wheel`:return So(e,t,n);case`palette`:return Co(e,t,n);case`texture`:return To(e,t,n,this.assets);case`text`:return go(e,String(t??``),n);case`font`:return Eo(e,String(t),n);case`patterns`:return wo(e,t,n);default:return null}}randomize(){let e=this.layer,t=e?a(e.effectId):void 0;e&&t&&this.store.setParams(e.id,Oo(t,e.params))}resetAll(){let e=this.layer,t=e?a(e.effectId):void 0;e&&t&&this.store.setParams(e.id,c(t))}},Ao=[{label:`Free`,value:null},{label:`Original`,value:`original`},{label:`1:1`,value:1},{label:`4:5`,value:4/5},{label:`5:4`,value:5/4},{label:`3:4`,value:3/4},{label:`4:3`,value:4/3},{label:`2:3`,value:2/3},{label:`3:2`,value:3/2},{label:`9:16`,value:9/16},{label:`16:9`,value:16/9},{label:`21:9`,value:21/9}],jo=class{store;stage;el;size;ratioButtons=[];ratio=null;rotation;constructor(e,t){this.store=e,this.stage=t,this.size=W(`div`,{class:`crop-panel__size`});let n=W(`div`,{class:`crop-panel__ratios`});for(let e of Ao){let t=W(`button`,{class:`chip`,type:`button`,onclick:()=>this.setRatio(e.value)},e.label);this.ratioButtons.push(t),n.append(t)}this.rotation=co({type:`float`,key:`rotation`,label:`rotation`,min:-45,max:45,step:.1,default:0,unit:`°`},0,{set:(t,n)=>{this.patch({rotation:Number(t)},`crop-rot`),n?.commit&&e.commit()},reset:()=>this.patch({rotation:0})});let r=W(`div`,{class:`crop-panel__row`},W(`button`,{class:`button button--small`,type:`button`,onclick:()=>this.patch({flipX:!this.crop.flipX})},Y(`flipH`,16),`Flip H`),W(`button`,{class:`button button--small`,type:`button`,onclick:()=>this.patch({flipY:!this.crop.flipY})},Y(`flipV`,16),`Flip V`)),i=W(`div`,{class:`crop-panel__row`},W(`button`,{class:`button button--small`,type:`button`,onclick:()=>this.reset()},Y(`reset`,16),`Reset`),W(`button`,{class:`button button--primary button--small`,type:`button`,onclick:()=>e.set({mode:`effect`})},Y(`check`,16),`Done`));this.el=W(`aside`,{class:`panel panel--controls panel--crop`,attrs:{"aria-label":`Crop`}},W(`div`,{class:`panel__header`},W(`span`,{class:`panel__title`},`Crop`)),W(`div`,{class:`panel__scroll params`},W(`div`,{class:`param`},W(`div`,{class:`param__header`},W(`label`,{class:`param__title`},`Size`)),this.size),W(`div`,{class:`param`},W(`div`,{class:`param__header`},W(`label`,{class:`param__title`},`Aspect ratio`)),n),this.rotation.el,r,i,W(`p`,{class:`param__hint crop-panel__hint`},`Drag the frame or its handles on the canvas. Effects are hidden while cropping.`))),e.subscribe((e,t)=>{(e.project.crop!==t.project.crop||e.source!==t.source||e.mode!==t.mode)&&this.sync()}),this.sync()}get crop(){return this.store.state.project.crop??{x:0,y:0,w:1,h:1}}patch(e,t){this.store.setCrop({...this.crop,...e},t)}reset(){this.ratio=null,this.stage.cropAspect=null,this.store.setCrop(null)}setRatio(e){this.ratio=e;let t=this.store.state.source;if(!t)return;let n=e===`original`?t.width/t.height:e;if(this.stage.cropAspect=n,n){let e=this.crop,r=e.x+e.w/2,i=e.y+e.h/2,a=n*(t.height/t.width),o=1,s=o/a;s>1&&(s=1,o=a);let c=Math.min(1-o,Math.max(0,r-o/2)),l=Math.min(1-s,Math.max(0,i-s/2));this.store.setCrop({...e,x:c,y:l,w:o,h:s})}this.sync()}sync(){let e=this.store.state.source,t=this.crop;e&&(this.size.textContent=`${Math.round(t.w*e.width)} × ${Math.round(t.h*e.height)} px`),this.ratioButtons.forEach((e,t)=>e.classList.toggle(`is-active`,Ao[t].value===this.ratio)),this.rotation.update(t.rotation??0)}},Mo=class{store;el;playBtn;loopBtn;head;label;track;durationLabel;constructor(e){this.store=e,this.playBtn=W(`button`,{class:`icon-button`,type:`button`,title:`Play / pause (K)`,onclick:()=>this.toggle()}),this.loopBtn=W(`button`,{class:`icon-button`,type:`button`,title:`Loop`,onclick:()=>e.set({loop:!e.state.loop})},Y(`loop`,18)),this.durationLabel=W(`button`,{class:`timeline__duration`,type:`button`,title:`Click to change duration`,onclick:()=>{let t=[2,3,5,8,10,15,30],n=t.indexOf(e.state.duration);e.set({duration:t[(n+1)%t.length]})}}),this.head=W(`div`,{class:`timeline__head`}),this.label=W(`span`,{class:`timeline__time`});let t=W(`div`,{class:`timeline__ticks`});this.track=W(`div`,{class:`timeline__track`},t,this.head,this.label),J(this.track,{start:()=>{this.store.state.playing&&this.store.set({playing:!1})},move:e=>{let t=this.track.getBoundingClientRect(),n=q((e.clientX-t.left)/t.width,0,1)*this.store.state.duration;this.store.updateProject(e=>({...e,time:Math.round(n*100)/100}),{history:!1})}}),this.el=W(`footer`,{class:`timeline`,hidden:!0},W(`div`,{class:`timeline__controls`},this.playBtn,this.loopBtn,this.durationLabel),this.track),e.subscribe((e,t)=>{(e.playing!==t.playing||e.loop!==t.loop||e.duration!==t.duration||e.project.time!==t.project.time)&&this.sync()}),this.sync()}setVisible(e){this.el.hidden!==!e&&(this.el.hidden=!e,!e&&this.store.state.playing&&this.store.set({playing:!1}))}toggle(){this.store.set({playing:!this.store.state.playing})}sync(){let e=this.store.state;this.playBtn.replaceChildren(Y(e.playing?`pause`:`play`,18)),this.loopBtn.classList.toggle(`is-active`,e.loop),this.durationLabel.textContent=`${e.duration.toFixed(1)}s`;let t=e.project.time,n=q(t/e.duration,0,1);this.head.style.left=n*100+`%`,this.label.style.left=n*100+`%`,this.label.textContent=No(t);let r=this.track.querySelector(`.timeline__ticks`);r.childElementCount!==Math.round(e.duration*2)+1&&r.replaceChildren(...Array.from({length:Math.round(e.duration*2)+1},(t,n)=>W(`span`,{class:[`timeline__tick`,n%2==0&&`is-major`],style:{left:n/(e.duration*2)*100+`%`}},n%2==0?`${n/2}s`:``)))}};function No(e){let t=Math.floor(e/60);return`${t}:${(e-t*60).toFixed(1).padStart(4,`0`)}`}var Po=class{renderer;queue=[];visible=new Set;done=new WeakMap;observer;jobs=new WeakMap;version=0;scheduled=!1;paused=!1;busyUntil=0;crop=null;constructor(e){this.renderer=e,this.observer=new IntersectionObserver(e=>{for(let t of e){let e=t.target;t.isIntersecting?(this.visible.add(e),this.enqueue(e)):this.visible.delete(e)}},{rootMargin:`200px`})}observe(e,t){this.jobs.set(e,t),this.observer.observe(e)}unobserve(e){this.observer.unobserve(e),this.visible.delete(e)}invalidate(){this.version++;for(let e of this.visible)this.enqueue(e)}enqueue(e){let t=this.jobs.get(e);if(!t)return;let n=t(),r=n.key+`@`+this.version;this.done.get(e)!==r&&(this.queue.some(t=>t.canvas===e)||this.queue.push(n),this.schedule())}schedule(){this.scheduled||(this.scheduled=!0,requestAnimationFrame(()=>this.tick()))}busy=!1;async tick(){if(this.scheduled=!1,this.busy||!this.renderer.hasSource||this.renderer.isContextLost())return;if(this.paused||performance.now()<this.busyUntil){setTimeout(()=>this.schedule(),150);return}let e=this.queue.shift();if(e){if(this.visible.has(e.canvas)){let t=e.layers.map(e=>a(e.effectId)).filter(e=>!!e);if(!this.renderer.ready(t)){this.queue.push(e),this.renderer.pollPrograms(),setTimeout(()=>this.schedule(),30);return}this.busy=!0;let n=this.version;try{await this.draw(e)}catch(t){console.warn(`Thumbnail failed`,e.key,t)}finally{this.busy=!1}this.done.set(e.canvas,e.key+`@`+n)}this.queue.length&&this.schedule()}}async draw(e){let t=this.renderer,[n,r]=t.sourceSize,i=n*(this.crop?.w??1),a=r*(this.crop?.h??1),o=256/Math.max(i,a),s=Math.max(8,Math.round(i*o)),c=Math.max(8,Math.round(a*o)),l=await t.renderToPixelsAsync(e.layers,{width:s,height:c,pxScale:fr(s,c),time:0,format:t.defaultFormat,crop:this.crop}),u=e.canvas;u.width=s,u.height=c,u.getContext(`2d`).putImageData(new ImageData(new Uint8ClampedArray(l.buffer,l.byteOffset,l.byteLength),s,c),0,0)}},Fo=16384;function Io(e,t,n){let r=t,i=n;if(e.sizeMode===`scale`)r=t*e.scale,i=n*e.scale;else if(e.sizeMode===`long`){let a=e.longSide/Math.max(t,n);r=t*a,i=n*a}else e.sizeMode===`custom`&&(r=e.customW,i=e.customH);return{w:Math.max(1,Math.round(r)),h:Math.max(1,Math.round(i))}}function Lo(e){let t=e.caps;return Math.min(Fo,t.maxTextureSize,t.maxRenderbufferSize,t.maxViewport[0],t.maxViewport[1])}function Ro(e,t,n){let r=e*t;return r*(n===`rgba16f`?8:4)*3+r*4}function zo(e,t,n,r){return e.caps.floatTargets?r===16?`rgba16f`:t*n>67108864?`rgba8`:`rgba16f`:`rgba8`}async function Bo(e,t,n,r){let{settings:i}=t,{w:a,h:o}=Io(i,t.sourceW,t.sourceH),s=Lo(e);if(a>s||o>s)throw Error(`This GPU supports exports up to ${s}px per side (requested ${a}×${o}).`);if(i.format===`webp`&&(a>16383||o>16383))throw Error(`WebP is limited to 16383px per side — use PNG or JPG for 16K.`);let c=i.format===`png`?i.bitDepth:8,l=zo(e,a,o,c),u=Math.max(a,o),d=t.units===`relative`?u/720:u/Math.max(t.sourceW,t.sourceH),f=e.gl;n({stage:`render`,progress:0,detail:`Rendering ${a}×${o}`}),e.pool.trim();let p;try{p=await e.renderChainAsync(t.layers,{width:a,height:o,pxScale:d,time:t.time,format:l,crop:t.crop,exporting:!0,tileSize:1024,onLayer:(e,t)=>n({stage:`render`,progress:(e+1)/Math.max(1,t),detail:`Rendering layer ${e+1} of ${t}`})},r)}catch(t){throw e.pool.trim(),t instanceof DOMException&&t.name===`AbortError`?t:Vo(t,f,a,o)}if(f.getError()===f.OUT_OF_MEMORY)throw e.pool.release(p),e.pool.trim(),Error(`The GPU ran out of memory rendering ${a}×${o}. Try a smaller size or fewer layers.`);await e.gpuIdle();let m=i.format===`png`&&e.minAlpha(p)<.999,h=c===16||p.format===`rgba8`?p:e.toRGBA8(p,!0);h!==p&&e.pool.release(p);let g=new Worker(new URL(new URL(`encode-worker-ChgA_AXJ.js`,import.meta.url).href,``+import.meta.url),{type:`module`}),_=0,v=[],y=null,b=()=>void 0,x=()=>void 0,S=new Promise((e,t)=>{b=e,x=t});g.onmessage=e=>{let t=e.data;t.type===`ack`?(_--,v.splice(0).forEach(e=>e())):t.type===`done`?b(t.blob):t.type===`error`&&(y=Error(t.message),x(y),v.splice(0).forEach(e=>e()))},g.onerror=e=>{y=Error(e.message||`Encoder worker failed`),x(y)};let C=(e,t=[])=>g.postMessage(e,t);try{C({type:`start`,format:i.format,width:a,height:o,quality:i.quality,bitDepth:c,alpha:m});let t=a*(c===16?16:4),s=Math.max(16,Math.floor((24<<20)/t/16)*16);for(let t=0;t<o;t+=s){if(r.aborted)throw new DOMException(`Export cancelled`,`AbortError`);if(y)throw y;for(;_>=3;)await new Promise(e=>v.push(e));let a=Math.min(s,o-t);if(c===16){let n=e.readRowsFloat(h,t,a);C({type:`rows`,data:n.buffer,rows:a,float:!0},[n.buffer])}else{let n=e.readRowsRGBA8(h,t,a);C({type:`rows`,data:n.buffer,rows:a,float:!1},[n.buffer])}_++,n({stage:`encode`,progress:(t+a)/o,detail:`Encoding ${i.format.toUpperCase()} · ${Math.round((t+a)/o*100)}%`}),await new Promise(e=>setTimeout(e,0))}e.pool.release(h),e.pool.trim(),C({type:`end`});let l=await S;return n({stage:`done`,progress:1,detail:`Done · ${(l.size/1048576).toFixed(1)} MB`}),l}catch(e){throw C({type:`abort`}),e}finally{e.pool.release(h),e.pool.trim(),v=[],setTimeout(()=>g.terminate(),100)}}function Vo(e,t,n,r){if(t.isContextLost())return Error(`The GPU reset while rendering ${n}×${r} (likely out of memory). Try a smaller size.`);let i=e?.message??String(e);return/Framebuffer incomplete|out of memory/i.test(i)?Error(`Could not allocate ${n}×${r} render targets on this GPU. Try a smaller size.`):e instanceof Error?e:Error(i)}function Ho(e,t){let n=URL.createObjectURL(e),r=document.createElement(`a`);r.href=n,r.download=t,document.body.append(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),6e4)}var Uo=[1080,2048,3840,4096,6e3,8192,12288,16384],Wo=[.25,.5,1,1.5,2,3,4];function Go(e,t,n,r,i){let a=W(`div`,{class:`export`}),o=qa(e,a,{placement:`above`,align:`end`}),s=e=>{t.set({export:{...t.state.export,...e}}),c()},c=()=>{let e=t.state.export,[c,l]=r(),{w:u,h:d}=Io(e,c,l),f=Lo(n),p=u>f||d>f,m=e.format===`webp`&&(u>16383||d>16383),h=zo(n,u,d,e.format===`png`?e.bitDepth:8),g=Ro(u,d,h);a.replaceChildren(...[W(`div`,{class:`export__title`},`Export image`),Ko(`Format`,qo([[`png`,`PNG`],[`jpeg`,`JPG`],[`webp`,`WEBP`]],e.format,e=>s({format:e}))),e.format===`png`?Ko(`Bit depth`,qo([[`8`,`8-bit`],[`16`,`16-bit`]],String(e.bitDepth),e=>s({bitDepth:Number(e)}))):Ko(`Quality`,Yo(e.quality,e=>s({quality:e}))),Ko(`Size`,qo([[`original`,`Original`],[`scale`,`Scale`],[`long`,`Long side`],[`custom`,`Custom`]],e.sizeMode,e=>s({sizeMode:e}))),e.sizeMode===`scale`?W(`div`,{class:`chips`},...Wo.map(t=>Jo(`${t}×`,e.scale===t,()=>s({scale:t})))):null,e.sizeMode===`long`?W(`div`,{class:`chips`},...Uo.map(t=>Jo(t>=1e3&&t%1024==0?`${t/1024}K`:t===3840?`4K UHD`:`${t}`,e.longSide===t,()=>s({longSide:t}),t>f))):null,e.sizeMode===`custom`?Xo(e,c,l,e=>s(e)):null,W(`div`,{class:[`export__summary`,(p||m)&&`is-error`]},W(`strong`,null,`${u} × ${d}px`),W(`span`,null,`${(u*d/1e6).toFixed(1)} MP · ~${Zo(g)} GPU · ${h===`rgba16f`?`16-bit float`:`8-bit`} pipeline`),p?W(`span`,null,`Exceeds this GPU's limit of ${f}px per side.`):null,m?W(`span`,null,`WebP supports up to 16383px per side.`):null),W(`button`,{class:`button button--primary button--block`,type:`button`,disabled:p||m||!t.state.source,onclick:()=>{o(),i()}},Y(`download`,16),`Export`)].filter(e=>!!e))};c()}function Ko(e,t){return W(`div`,{class:`export__field`},W(`span`,{class:`export__label`},e),t)}function qo(e,t,n){return W(`div`,{class:`switcher`},...e.map(([e,r])=>W(`button`,{class:[`switcher__item`,e===t&&`is-active`],type:`button`,onclick:()=>n(e)},r)))}function Jo(e,t,n,r=!1){return W(`button`,{class:[`chip`,t&&`is-active`],type:`button`,disabled:r,onclick:n},e)}function Yo(e,t){let n=W(`span`,{class:`export__value`},`${Math.round(e*100)}`),r=W(`input`,{class:`range`,type:`range`,min:10,max:100,step:1,value:Math.round(e*100)});return r.addEventListener(`input`,()=>n.textContent=r.value),r.addEventListener(`change`,()=>t(Number(r.value)/100)),W(`div`,{class:`export__quality`},r,n)}function Xo(e,t,n,r){let i=t/n,a=W(`input`,{class:`input input--small`,type:`number`,min:1,max:16384,value:e.customW||t}),o=W(`input`,{class:`input input--small`,type:`number`,min:1,max:16384,value:e.customH||n}),s=W(`input`,{type:`checkbox`,checked:!0});return a.addEventListener(`change`,()=>{let e=Math.max(1,Math.round(Number(a.value)));r({customW:e,customH:s.checked?Math.round(e/i):Number(o.value)})}),o.addEventListener(`change`,()=>{let e=Math.max(1,Math.round(Number(o.value)));r({customH:e,customW:s.checked?Math.round(e*i):Number(a.value)})}),W(`div`,{class:`export__custom`},a,W(`span`,null,`×`),o,W(`label`,{class:`export__lock`},s,`Keep ratio`))}function Zo(e){return e>=1<<30?(e/(1<<30)).toFixed(1)+` GB`:e>=1<<20?Math.round(e/(1<<20))+` MB`:Math.round(e/1024)+` KB`}function Qo(e,t){let n=W(`div`,{class:`progress__bar`}),r=W(`div`,{class:`progress__detail`},`Preparing…`),i=W(`button`,{class:`button`,type:`button`,onclick:()=>t()},`Cancel`),a=Ya(e,W(`div`,{class:`modal__body`},W(`div`,{class:`progress`},n),r,W(`div`,{class:`modal__actions`},i)),{dismissable:!1});return{update(e,t){n.style.width=Math.round(Math.min(1,Math.max(0,e))*100)+`%`,r.textContent=t},close:()=>a.close()}}var $o=`fxlib.settings.v1`;function es(){let e={theme:`dark`,previewMax:0,units:`relative`,browserCollapsed:!1};try{return{...e,...JSON.parse(localStorage.getItem($o)||`{}`)}}catch{return e}}var ts=class{store;renderer;assets;library=new Ma;stage;browser;controls;cropPanel;timeline;thumbs;root;rightSlot;settings=es();sourceBlob=null;sourceBitmap=null;dirty=!0;rafPending=!1;lastFrameTime=0;fileInput;exporting=!1;lastRenderMs=0;chainCache=null;constructor(e){let t={project:{layers:[],crop:null,time:0},selectedLayerId:null,mode:`effect`,source:null,export:{format:`png`,quality:.92,bitDepth:8,sizeMode:`original`,scale:2,longSide:4096,customW:0,customH:0},previewMax:this.settings.previewMax,playing:!1,loop:!0,duration:5,theme:this.settings.theme,compare:!1,preview:null};this.store=new Ta(t),this.applyTheme(),this.stage=new no(this.store,{openExport:e=>this.openExport(e),upload:()=>this.fileInput.click(),sample:e=>this.loadSample(e),loadFiles:e=>this.loadFiles(e)}),this.renderer=new oa(this.stage.canvas),this.renderer.onProgramReady=()=>this.requestRender(),this.assets=new Ea(this.renderer),this.thumbs=new Po(this.renderer),this.browser=new Qa(this.store,this.library,this.thumbs,()=>this.toggleBrowser());let r=new eo(this.store,{upload:()=>this.fileInput.click(),random:()=>this.loadRandom(),fromUrl:()=>this.loadFromUrl(),sample:e=>this.loadSample(e),savePreset:()=>this.savePreset()});this.controls=new ko(this.store,this.assets,()=>this.aspect()),this.cropPanel=new jo(this.store,this.stage),this.timeline=new Mo(this.store),this.rightSlot=W(`div`,{class:`right-slot`},this.controls.el),this.fileInput=W(`input`,{type:`file`,accept:`image/*`,hidden:!0}),this.fileInput.addEventListener(`change`,()=>{this.fileInput.files?.length&&this.loadFiles(this.fileInput.files),this.fileInput.value=``}),this.root=W(`div`,{class:[`app`,this.settings.browserCollapsed&&`is-browser-collapsed`]},this.topbar(),W(`main`,{class:`workspace`},this.browser.el,r.el,this.stage.el,this.rightSlot),this.timeline.el,this.fileInput),e.replaceChildren(this.root),this.store.subscribe((e,t)=>this.onState(e,t)),this.stage.onLayout=()=>this.maybeResizePreview(),this.bindKeys(),this.bindContextLoss(),document.addEventListener(`fontloaded`,()=>this.requestRender()),window.addEventListener(`paste`,e=>{let t=[...e.clipboardData?.files??[]].find(e=>e.type.startsWith(`image/`));t&&this.loadFiles([t])});for(let e of n)Z(e,`error`,8e3)}async start(){let e=await Ba();if(e?.source?.blob)try{for(let t of e.assets??[])await this.assets.add(t.blob,t.name,t.id);await this.loadBlob(e.source.blob,e.source.name,{keepCrop:!0});let t=(e.project?.layers??[]).filter(e=>a(e.effectId)).map(e=>({...e,params:l(a(e.effectId),e.params)}));this.store.set({project:{layers:t,crop:e.project?.crop??null,time:e.project?.time??0},selectedLayerId:e.selectedLayerId??(t.length?t[t.length-1].id:null)}),this.thumbs.crop=this.store.state.project.crop,this.store.resetHistory();return}catch(e){console.warn(`Could not restore session`,e)}await this.loadSample(`portrait`),this.store.resetHistory()}onState(e,t){(e.project!==t.project||e.mode!==t.mode||e.compare!==t.compare||e.source!==t.source||e.previewMax!==t.previewMax||e.preview!==t.preview)&&this.requestRender(),e.mode!==t.mode&&(this.rightSlot.replaceChildren(e.mode===`crop`?this.cropPanel.el:this.controls.el),e.mode===`effect`&&this.controls.sync()),(e.project.crop!==t.project.crop||e.source!==t.source||e.mode!==t.mode)&&this.updateStageSize(),e.project.crop!==t.project.crop&&this.cropThumbs(),e.theme!==t.theme&&this.applyTheme(),e.project.layers!==t.project.layers&&(this.renderer.pruneLayers(new Set(e.project.layers.map(e=>e.id))),this.timeline.setVisible(e.project.layers.some(e=>e.visible&&a(e.effectId)?.animated))),e.playing&&!t.playing&&(this.lastFrameTime=performance.now(),this.requestRender()),(e.project!==t.project||e.source!==t.source)&&this.autosave()}updateStageSize(){let e=this.store.state;if(!e.source)return;let[t,n]=this.croppedSize(e.mode===`crop`);this.stage.setImageSize(t,n,e.source.width,e.source.height)}croppedSize(e=!1){let t=this.store.state.source;if(!t)return[0,0];let n=this.store.state.project.crop;return!n||e?[t.width,t.height]:[Math.max(1,Math.round(n.w*t.width)),Math.max(1,Math.round(n.h*t.height))]}aspect(){let[e,t]=this.croppedSize();return e&&t?e/t:1}requestRender(){this.dirty=!0,!this.rafPending&&(this.rafPending=!0,requestAnimationFrame(e=>this.frame(e)))}previewSize(){let e=this.store.state,[t,n]=this.croppedSize(e.mode===`crop`),r=Math.max(t,n),i=r,a=this.renderer.caps.maxTextureSize;if(e.previewMax>0)i=Math.min(i,e.previewMax);else{let e=Math.ceil(this.stage.displayDevicePixels/512)*512;i=Math.min(i,Math.max(1024,e))}i=Math.min(i,a);let o=i/r;return[Math.max(1,Math.round(t*o)),Math.max(1,Math.round(n*o))]}lastPreviewLong=0;maybeResizePreview(){let[e,t]=this.previewSize();Math.max(e,t)!==this.lastPreviewLong&&this.requestRender()}frame(e){this.rafPending=!1;let t=this.store.state,n=t.playing&&t.project.layers.some(e=>e.visible&&a(e.effectId)?.animated);if(n){let n=Math.min(.1,(e-this.lastFrameTime)/1e3);this.lastFrameTime=e;let r=t.project.time+n;r>t.duration&&(r=t.loop?r%t.duration:t.duration),this.store.updateProject(e=>({...e,time:r}),{history:!1}),!t.loop&&r>=t.duration&&this.store.set({playing:!1})}if(this.dirty&&this.renderer.hasSource&&!this.exporting&&!this.renderer.isContextLost()){let e=t.preview,n=t.mode===`crop`||t.compare?[]:e?t.project.layers.map(t=>t.id===e.layerId?{...t,blend:e.blend??t.blend,params:e.params?{...t.params,...e.params}:t.params}:t):t.project.layers,r=n.filter(e=>e.visible).map(e=>a(e.effectId)).filter(Boolean);if(!this.renderer.ready(r)){this.stage.setBusy(!0),this.renderer.pollPrograms(),setTimeout(()=>this.requestRender(),30);return}this.stage.setBusy(!1);let[i,o]=this.previewSize();this.lastPreviewLong=Math.max(i,o);let[s,c]=this.croppedSize(t.mode===`crop`),l=this.settings.units===`relative`?Math.max(i,o)/720:i/s,u=performance.now();try{let e={width:i,height:o,pxScale:l,time:t.project.time,format:this.renderer.defaultFormat,crop:t.mode===`crop`?null:t.project.crop},r=n.findIndex(e=>e.id===t.selectedLayerId),s=r>0?n.slice(0,r):[],c=s.some(e=>e.visible)&&!this.exporting?JSON.stringify([this.renderer.sourceVersion,e.crop,i,o,l,s.some(e=>e.visible&&a(e.effectId)?.animated)?t.project.time:0,s.map(e=>[e.effectId,e.visible,e.opacity,e.blend,e.params])]):null,u=this.chainCache,d=c!==null&&u!==null&&u.key===c,f=this.renderer.renderChain(n,{...e,start:d?{tex:u.tex,index:r}:void 0,capture:!d&&c!==null?r:void 0,onCapture:e=>{this.chainCache&&this.renderer.pool.release(this.chainCache.tex),this.chainCache={key:c,tex:e}}});this.renderer.present(f),this.renderer.pool.release(f),this.renderer.pool.trimOlderThan(8e3),this.dirty=!1}catch(e){console.error(e),this.dirty=!1,Z(String(e.message??e).split(`
`)[0],`error`,6e3)}this.lastRenderMs=performance.now()-u,this.thumbs.busyUntil=performance.now()+Math.min(600,120+this.lastRenderMs*2)}n&&this.requestRender()}async loadFiles(e){let t=[...e][0];if(t){if(t.type.startsWith(`video/`))return Z(`Video input is not supported yet — load an image.`,`error`);if(t.type===`application/json`||t.name.endsWith(`.json`))return this.importProject(t);await this.loadBlob(t,t.name)}}async loadBlob(e,t,n={}){let r;try{r=await createImageBitmap(e,{imageOrientation:`from-image`,premultiplyAlpha:`none`,colorSpaceConversion:`default`})}catch{Z(`Could not decode “${t}”. Try PNG, JPG, WebP or AVIF.`,`error`);return}let i=this.renderer.caps.maxTextureSize;(r.width>i||r.height>i)&&Z(`Image is larger than this GPU's ${i}px limit — it was downscaled.`,`info`,6e3),this.renderer.setSource(r),this.sourceBitmap?.close(),this.sourceBitmap=r,this.sourceBlob=e;let a=this.store.state.source?.url;a&&URL.revokeObjectURL(a);let[o,s]=this.renderer.sourceSize;this.store.set({source:{name:t,width:o,height:s,url:URL.createObjectURL(e)}}),!n.keepCrop&&this.store.state.project.crop&&this.store.updateProject(e=>({...e,crop:null}),{history:!1}),this.updateStageSize(),this.stage.setZoom(`fit`),this.thumbs.crop=this.store.state.project.crop,this.thumbs.invalidate(),this.requestRender()}async loadSample(e){try{let t=await fetch(`samples/${e}.jpg`);if(!t.ok)throw Error(String(t.status));await this.loadBlob(await t.blob(),`${e}.jpg`)}catch{Z(`Could not load the sample image`,`error`)}}async loadRandom(){this.stage.setBusy(!0);try{let e=await fetch(`https://picsum.photos/${Math.random()<.35?`1600/2000`:`2400/1600`}?random=${Date.now()}`);if(!e.ok)throw Error(String(e.status));let t=e.headers.get(`picsum-id`);await this.loadBlob(await e.blob(),t?`picsum-${t}.jpg`:`random.jpg`)}catch{Z(`Could not fetch a random image (offline?)`,`error`)}finally{this.stage.setBusy(!1)}}async loadFromUrl(){let e=await Xa(`Add from URL`,`Image URL (must allow cross-origin access)`,``,`Load`);if(e){this.stage.setBusy(!0);try{let t=await fetch(e,{mode:`cors`});if(!t.ok)throw Error(String(t.status));let n=decodeURIComponent(new URL(e).pathname.split(`/`).pop()||`image`);await this.loadBlob(await t.blob(),n)}catch{Z(`Could not load that URL (blocked by CORS or not an image)`,`error`,6e3)}finally{this.stage.setBusy(!1)}}}openExport(e){if(!this.store.state.source)return Z(`Load an image first`);Go(e,this.store,this.renderer,()=>this.croppedSize(),()=>this.doExport())}async doExport(){let e=this.store.state;if(!e.source||this.exporting)return;let[t,n]=this.croppedSize(),r=new AbortController,i=Qo(`Exporting`,()=>r.abort());this.exporting=!0,this.thumbs.paused=!0,this.chainCache&&=(this.renderer.pool.release(this.chainCache.tex),null);let o=performance.now();try{let s=e.project.layers.filter(e=>e.visible).map(e=>a(e.effectId)).filter(Boolean);for(;!this.renderer.ready(s);)this.renderer.pollPrograms(),await new Promise(e=>setTimeout(e,30));let c=await Bo(this.renderer,{layers:e.project.layers,crop:e.project.crop,time:e.project.time,sourceW:t,sourceH:n,settings:e.export,units:this.settings.units},e=>i.update(e.stage===`render`?e.progress*.5:e.stage===`encode`?.5+e.progress*.5:1,e.detail),r.signal),{w:l,h:u}=Io(e.export,t,n),d=e.source.name.replace(/\.[^.]+$/,``)||`image`,f=e.export.format===`jpeg`?`jpg`:e.export.format;Ho(c,`${d}-fx-${l}x${u}.${f}`),Z(`Exported ${l}×${u} ${f.toUpperCase()} (${(c.size/1048576).toFixed(1)} MB) in ${((performance.now()-o)/1e3).toFixed(1)}s`,`success`,5e3)}catch(e){e?.name===`AbortError`?Z(`Export cancelled`):Z(String(e?.message??e),`error`,8e3)}finally{i.close(),this.exporting=!1,this.thumbs.paused=!1,this.renderer.isContextLost()&&Z(`The GPU context was lost; it will be restored automatically.`,`error`),this.requestRender()}}async savePreset(){let e=this.store.state.project.layers;if(!e.length)return Z(`Add some effects first`);let t=await Xa(`Save preset`,`Preset name`,`My look`,`Save`);t!==null&&(this.library.savePreset(t,e),Z(`Preset saved to the Presets tab`,`success`))}exportProject(){let e=this.store.state;Ho(new Blob([Ha(e.project,e.source?.name)],{type:`application/json`}),(e.source?.name.replace(/\.[^.]+$/,``)||`project`)+`.fx.json`)}async importProject(e){try{let t=JSON.parse(await e.text()),n=t.project??t;if(!Array.isArray(n.layers))throw Error(`bad`);this.store.setLayers(n.layers),this.store.setCrop(n.crop??null),Z(`Project loaded`,`success`)}catch{Z(`That file is not a valid project`,`error`)}}cropThumbs=Sa(()=>{this.thumbs.crop=this.store.state.project.crop,this.thumbs.invalidate()},500);autosave=Sa(()=>{let e=this.store.state;if(!this.sourceBlob||!e.source)return;let t=new Set;for(let n of e.project.layers)for(let e of Object.values(n.params))e&&typeof e==`object`&&`assetId`in e&&t.add(e.assetId);let n=this.assets.all().filter(e=>t.has(e.id)).map(e=>({id:e.id,name:e.name,blob:e.blob}));za({project:e.project,selectedLayerId:e.selectedLayerId,source:{name:e.source.name,blob:this.sourceBlob},assets:n,savedAt:Date.now()})},800);topbar(){let e=W(`button`,{class:`icon-button`,type:`button`,title:`Undo (Ctrl+Z)`,onclick:()=>this.store.undo()},Y(`undo`,18)),t=W(`button`,{class:`icon-button`,type:`button`,title:`Redo (Ctrl+Shift+Z)`,onclick:()=>this.store.redo()},Y(`redo`,18)),n=()=>{e.disabled=!this.store.canUndo,t.disabled=!this.store.canRedo};return this.store.subscribe(n),n(),W(`header`,{class:`topbar`},W(`div`,{class:`topbar__brand`},W(`button`,{class:`icon-button topbar__browser-toggle`,type:`button`,title:`Show effect library`,onclick:()=>this.toggleBrowser()},Y(`layers`,18)),W(`span`,{class:`logo`},`EFFECTS`,W(`span`,{class:`logo__dot`},`.`),`LIB`)),W(`div`,{class:`topbar__center`},e,t),W(`div`,{class:`topbar__actions`},W(`button`,{class:`pill`,type:`button`,onclick:()=>this.fileInput.click()},Y(`plus`,16),`Load media`),W(`button`,{class:`icon-button`,type:`button`,title:`Toggle theme`,onclick:()=>this.toggleTheme()},Y(`sun`,18)),W(`button`,{class:`icon-button`,type:`button`,title:`Menu`,onclick:e=>this.mainMenu(e.currentTarget)},Y(`menu`,20))))}mainMenu(e){let t=this.settings;X(e,[{label:`Preview resolution`,heading:!0},{label:`Auto (match screen)`,checked:t.previewMax===0,action:()=>this.setSetting({previewMax:0})},{label:`Up to 2048 px`,checked:t.previewMax===2048,action:()=>this.setSetting({previewMax:2048})},{label:`Up to 4096 px`,checked:t.previewMax===4096,action:()=>this.setSetting({previewMax:4096})},{label:`Full resolution`,checked:t.previewMax===1e9,action:()=>this.setSetting({previewMax:1e9})},{label:`Effect size units`,heading:!0},{label:`Relative to image (720 px reference)`,checked:t.units===`relative`,action:()=>this.setSetting({units:`relative`})},{label:`Source pixels`,checked:t.units===`source`,action:()=>this.setSetting({units:`source`})},{separator:!0},{label:`Save stack as preset…`,icon:`bookmark`,action:()=>this.savePreset()},{label:`Download project (.json)`,icon:`download`,action:()=>this.exportProject()},{label:`Open project / image…`,icon:`folder`,action:()=>this.fileInput.click()},{label:`Clear all layers`,icon:`trash`,action:()=>this.store.setLayers([])},{label:`Reset session`,icon:`reset`,action:async()=>{await Va(),location.reload()}},{separator:!0},{label:`Keyboard shortcuts`,icon:`info`,action:()=>this.showShortcuts()},{label:`GPU diagnostics…`,icon:`info`,action:()=>this.showDiagnostics()},{label:`About & credits`,icon:`info`,action:()=>this.showAbout()}])}setSetting(e){this.settings={...this.settings,...e};try{localStorage.setItem($o,JSON.stringify(this.settings))}catch{}e.previewMax!==void 0&&this.store.set({previewMax:e.previewMax}),this.thumbs.invalidate(),this.requestRender()}toggleTheme(){let e=this.store.state.theme===`dark`?`day`:`dark`;this.store.set({theme:e}),this.setSetting({theme:e})}applyTheme(){document.documentElement.dataset.theme=this.store.state.theme}toggleBrowser(){this.settings.browserCollapsed=!this.settings.browserCollapsed,this.root.classList.toggle(`is-browser-collapsed`,this.settings.browserCollapsed),this.setSetting({}),setTimeout(()=>this.stage.layout(),220)}showShortcuts(){Ya(`Keyboard shortcuts`,W(`div`,{class:`modal__body shortcuts`},...[[`Ctrl/⌘ Z`,`Undo`],[`Ctrl/⌘ Shift Z · Ctrl Y`,`Redo`],[`Delete`,`Delete selected layer`],[`Ctrl/⌘ D`,`Duplicate layer`],[`H`,`Hide / show layer`],[`[  ]`,`Select layer below / above`],[`R`,`Randomize layer`],[`C`,`Crop`],[`\\ (hold)`,`Compare with original`],[`0 · 1 · 2`,`Zoom fit · 100% · 200%`],[`+ / −`,`Zoom in / out`],[`Space + drag`,`Pan`],[`/`,`Search effects`],[`K`,`Play / pause animation`],[`Ctrl/⌘ E`,`Export`],[`Ctrl/⌘ O`,`Open image`],[`Ctrl/⌘ V`,`Paste image`]].map(([e,t])=>W(`div`,{class:`shortcuts__row`},W(`kbd`,null,e),W(`span`,null,t)))))}showDiagnostics(){let e;try{e=fa(this.renderer)}catch(t){e=`Diagnostics failed: `+(t.stack||String(t))}this.requestRender();let t=W(`button`,{class:`button button--primary`,type:`button`},`Copy report`);t.onclick=async()=>{try{await navigator.clipboard.writeText(e),Z(`Report copied`,`success`)}catch{Z(`Copy failed: select the text and copy it`,`error`)}},Ya(`GPU diagnostics`,W(`div`,{class:`modal__body diagnostics`},W(`pre`,{class:`diagnostics__report`},e),W(`div`,{class:`modal__actions`},t)),{wide:!0})}async showAbout(){let e=[];try{e=await(await fetch(`samples/credits.json`)).json()}catch{}let t=this.renderer.caps;Ya(`About`,W(`div`,{class:`modal__body about`},W(`p`,null,`A WebGL 2 image effects workstation for digital art — stack GPU effects, tweak them live and export up to 16K.`),W(`p`,{class:`muted`},`GPU: ${t.renderer} · max texture ${t.maxTextureSize}px · float targets ${t.floatTargets?`yes`:`no`}`),W(`h4`,null,`Sample photos (Unsplash license)`),W(`ul`,null,...e.map(e=>W(`li`,null,W(`a`,{href:e.url,target:`_blank`,rel:`noopener`},e.author),` — ${e.file}`)))))}bindKeys(){window.addEventListener(`keydown`,e=>{let t=e.ctrlKey||e.metaKey,n=e.key;if(t&&n.toLowerCase()===`z`){if(ro(e))return;e.preventDefault(),e.shiftKey?this.store.redo():this.store.undo();return}if(t&&n.toLowerCase()===`y`){e.preventDefault(),this.store.redo();return}if(t&&n.toLowerCase()===`o`){e.preventDefault(),this.fileInput.click();return}if(t&&n.toLowerCase()===`e`){e.preventDefault();let t=this.root.querySelector(`.toolbar__export`);t&&this.openExport(t);return}if(t&&n.toLowerCase()===`s`){e.preventDefault(),this.savePreset();return}if(t&&n.toLowerCase()===`d`){e.preventDefault();let t=this.store.state.selectedLayerId;t&&this.store.duplicateLayer(t);return}if(ro(e)||t||e.altKey)return;let r=this.store.state.selectedLayerId;switch(n){case`Delete`:case`Backspace`:r&&(e.preventDefault(),this.store.removeLayer(r));break;case`h`:case`H`:{let e=this.store.selectedLayer;e&&this.store.patchLayer(e.id,{visible:!e.visible});break}case`[`:case`]`:{let e=this.store.state.project.layers,t=e.findIndex(e=>e.id===r),i=Math.max(0,Math.min(e.length-1,t+(n===`]`?1:-1)));e[i]&&this.store.set({selectedLayerId:e[i].id,mode:`effect`});break}case`r`:case`R`:this.controls.randomize();break;case`c`:case`C`:this.stage.toggleCrop();break;case`\\`:this.store.state.compare||this.store.set({compare:!0});break;case`0`:this.stage.setZoom(`fit`);break;case`1`:this.stage.setZoom(1);break;case`2`:this.stage.setZoom(2);break;case`+`:case`=`:this.stage.zoomBy(1);break;case`-`:case`_`:this.stage.zoomBy(-1);break;case`/`:e.preventDefault(),this.settings.browserCollapsed&&this.toggleBrowser(),this.browser.focusSearch();break;case`k`:case`K`:this.timeline.toggle();break;case`Escape`:this.store.state.mode===`crop`&&this.store.set({mode:`effect`})}}),window.addEventListener(`keyup`,e=>{e.key===`\\`&&this.store.state.compare&&this.store.set({compare:!1})})}bindContextLoss(){let e=this.stage.canvas;e.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),Z(`GPU context lost — restoring…`,`error`)}),e.addEventListener(`webglcontextrestored`,()=>{this.chainCache=null,this.renderer.handleContextRestored(),this.assets.dropTextures(),this.sourceBitmap&&this.renderer.setSource(this.sourceBitmap),this.thumbs.invalidate(),this.requestRender(),Z(`GPU context restored`,`success`)})}},ns=document.getElementById(`app`);try{let e=new ts(ns);e.start(),window.__app=e}catch(e){ns.innerHTML=``;let t=document.createElement(`div`);t.className=`fatal`,t.innerHTML=`<h1>Real-time effects are not available</h1><p></p>`,t.querySelector(`p`).textContent=String(e?.message??e)+` — this app needs a browser with WebGL 2 (Chrome, Edge, Firefox or Safari 15+).`,ns.append(t),console.error(e)}