<script lang="ts" setup>
/**
 * Siri-style GLSL shaders on a raw WebGL canvas.
 *
 *   "wave"        the iOS voice waveform, chromatic and level-reactive
 *   "fluid-dots"  six metaball dots that merge, scatter and gather
 *
 * Self-contained: one fullscreen triangle drives a fragment shader, no WebGL
 * library. The shader maths is the original `siriWaveCore` / `siriFluidDotsCore`
 * source. Three things were changed to make it ours rather than Apple's:
 *
 *   colour     the hard-coded rainbow is replaced by a ramp between two theme
 *              colours, read from CSS custom properties, so the wave carries the
 *              app's palette in light and dark alike.
 *   alpha      the original paints on opaque black. This one un-multiplies its
 *              own brightness into an alpha channel, so it composites onto
 *              whatever surface it sits on instead of punching a black hole.
 *   inputs     `resolved` and `level` became uniforms, so the wave can gather
 *              into a single point while connecting and open up when the room
 *              gets loud, rather than looping the same canned animation.
 */
import {cn} from '~/lib/utils';

export type SiriWaveVariant = 'wave' | 'fluid-dots';

const props = withDefaults(defineProps<{
  variant?: SiriWaveVariant;
  /** CSS display size, in px. The shader is aspect-correct, so these need not match. */
  width?: number;
  height?: number;
  /** Internal render resolution multiplier. Lower is cheaper and softer. */
  renderScale?: number;
  /** 0..1 loudness. Drives amplitude and brightness. */
  level?: number;
  /** 0..1. At 0 the wave collapses to a single gathered point; at 1 it is a full wave. */
  resolved?: number;
  /** Time multiplier. Above 1 the wave travels faster. */
  speed?: number;
  /**
   * Paint onto black instead of compositing. Needed for the blown-out white core
   * that makes the wave read as light; requires a dark container behind it.
   */
  opaque?: boolean;
  /** Saturation pushed into the ramp before it is used. 1 leaves the tokens as authored. */
  chroma?: number;
  /** CSS custom properties the colour ramp runs between. */
  tintFrom?: string;
  tintTo?: string;
  class?: string;
}>(), {
  variant: 'wave',
  width: 224,
  height: 64,
  renderScale: 0.75,
  level: 0,
  resolved: 1,
  speed: 1,
  opaque: false,
  chroma: 1,
  tintFrom: '--primary',
  tintTo: '--chart-2',
});

const canvas = ref<HTMLCanvasElement | null>(null);

const VERTEX_SHADER = 'attribute vec2 aPos; void main(){ gl_Position=vec4(aPos,0.0,1.0); }';

const WAVE_SHADER = `precision highp float;
uniform vec2 iResolution; uniform float iTime;
uniform vec3 uTintA; uniform vec3 uTintB;
uniform float uResolved; uniform float uLevel; uniform float uOpaque; uniform float uChroma;
const float PI = 3.14159265359;
const float AMPLITUDE   = 0.32;
const float FREQ        = 1.1;
const float ABER_FREQ   = 1.0;
const float SPEED       = 2.4;
const float WAVE_SCALE  = 0.95;
const float ABERRATION  = 5.4;
const float THICKNESS   = 3.0;
const float INTENSITY   = 2.;
const float FALLOFF     = 1.7;
const float EDGE_MASK   = 0.4;
const float EDGE_INSET  = 0.0;
const float BAND_FILL   = 30000.0;
const float BAND_THICK  = 0.08;
const float SOFTNESS    = 2.5;
const float LOW_AMP     = 6.0;
const float LOW_INT     = 1.5;
const float MID_ABER    = 0.8;
const float MID_ABAMP   = 0.05;
const float MID_BAND    = 20.0;
const float MID_SOFT    = 0.4;
const float HIGH_ABER   = 0.5;
const float HIGH_ABAMP  = 0.06;
const float UNRES_SCALE = 0.14;

// Our palette in place of the original's spectral rainbow. The four taps still
// separate like chromatic aberration; they just do it between two theme colours.
//
// The original taps are FULLY saturated primaries, which is why its layers read
// so vividly. Brand tokens carry maybe a third of that chroma, and once the
// per-channel division bleaches the overlap there is not enough colour left in
// the fringes to see. So the ramp is pushed away from its own grey first.
vec3 saturate3(vec3 c, float k){
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return clamp(mix(vec3(l), c, k), 0.0, 1.0);
}

vec3 tint4(int s){
    return saturate3(mix(uTintA, uTintB, float(s)/3.0), uChroma);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 R = iResolution.xy;
    float aspect = R.x / R.y;
    vec2 p = (fragCoord + 0.5) * 2.0 / R - 1.0;
    p.x *= aspect;
    float yScreen = p.y;
    p /= max(WAVE_SCALE, 0.1);

    float t   = iTime;
    float lvl = clamp(uLevel, 0.0, 1.0);
    float low  = clamp(0.45 + 0.45*sin(t*0.8)*sin(t*0.37+1.0), 0.0, 1.0);
    float mid  = clamp(0.40 + 0.40*sin(t*1.7+2.0)*sin(t*0.53), 0.0, 1.0);
    float high = clamp(0.30 + 0.30*sin(t*2.9+4.0)*sin(t*0.71+2.0), 0.0, 1.0);
    // A quiet room still breathes; a loud one drives the full band.
    low  = mix(low*0.22,  low,  lvl);
    mid  = mix(mid*0.18,  mid,  lvl);
    high = mix(high*0.12, high, lvl);

    float res   = clamp(uResolved, 0.0, 1.0);
    float drift = mod(t, 20.0*PI) * SPEED;

    float xN  = p.x / max(aspect, 1.0);
    float env = cos(PI*0.5 * min(abs(0.9*xN), 1.0));
    env *= env;

    // A resting wave still has to be visibly a wave, so silence keeps a little
    // over half the amplitude rather than collapsing to a flat line.
    float A1    = AMPLITUDE*(0.55 + 0.75*lvl) + 0.01*low*LOW_AMP;
    float A2    = A1 + mid*MID_ABAMP + high*HIGH_ABAMP;
    float AB    = (ABERRATION + mid*MID_ABER + high*HIGH_ABER)*res;
    float th    = mix(0.1, 0.01*THICKNESS, res);
    float inten = mix(0.1, 0.01*(INTENSITY + low*LOW_INT), res);
    float soft  = 0.01*res*max(0.0, SOFTNESS + mid*MID_SOFT);

    float dUnres = max(length(p) - mix(0.14, UNRES_SCALE, res), 0.0);
    float yMain = A1 * env * res * sin(p.x*FREQ + drift);

    float bandFillTh = max(BAND_THICK, 1e-4);
    float bandAmt    = 1e-4 * BAND_FILL * inten;
    // The middle of the ramp, standing in for the original's white wherever the
    // shader wants an untinted value.
    vec3 core = mix(uTintA, uTintB, 0.5);

    vec3 num = vec3(0.0), den = vec3(0.0);
    for(int s = 0; s < 4; s++){
        vec3 hue = mix(core, tint4(s), res);
        den += hue;
        float ab = mix(-AB, AB, float(s)/3.0);
        float yL = A2 * env * res * sin(p.x*ABER_FREQ + drift + ab);
        float d   = mix(dUnres, abs(p.y - yL), res);
        float lor = mix(1.0/(1.0 + (0.02*d)*(0.02*d)), 1.0, res);
        float line = inten / (sqrt(d*d + soft*soft) + th);
        float lo = min(yMain, yL), hi = max(yMain, yL);
        float dBand = max(0.0, max(p.y - hi, lo - p.y));
        float band  = bandAmt / (dBand + bandFillTh);
        num += hue * lor * (line + band);
    }
    // Per-channel division, as the original. This is the whole trick: where all
    // four taps overlap the tint cancels and the core goes white-hot, and colour
    // survives only where they separate. That contrast between a burning centre
    // and coloured fringes is what makes it read as light rather than as paint.
    // Normalising by luminance instead keeps the hue but loses the core, and the
    // result is a flat lozenge.
    vec3 col = num / den;

    // The untinted centre line, left untinted on purpose: it is the highlight the
    // coloured layers separate around. Kept lean, because it is pure white and
    // too much of it bleaches the layers it is supposed to sit between.
    float dM    = mix(dUnres, abs(p.y - yMain), res);
    float lorM  = mix(1.0/(1.0 + (0.02*dM)*(0.02*dM)), 1.0, res);
    float boost = (1.0 - res) * (14.0*low + 4.0);
    col += 0.12 * inten * (lorM + boost) / (sqrt(dM*dM + soft*soft) + th);

    col = pow(max(col, 0.0), vec3(1.5));
    float emT = clamp((abs(yScreen) - 1.0 + EDGE_INSET) / (-max(EDGE_MASK, 1e-4)), 0.0, 1.0);
    float em  = emT*emT*(3.0 - 2.0*emT);
    float gauss = exp(-pow(xN*FALLOFF, 2.0));
    // Always taper the ends. The original gates this on the resolved value too,
    // which is harmless at a constant 1.0 but turns every lower value into a bar
    // running the full width of the canvas.
    col *= em*gauss;
    // The original multiplies straight by the resolved value, which is fine when
    // RESOLVED is a hard-coded 1.0. It is a uniform here, and at 0 that scaled the
    // whole image to black: the gathered point it is meant to show never drew at
    // all. Dim the unresolved end instead of erasing it.
    col *= mix(0.6, 1.0, res);

    // Two ways out. Opaque paints straight onto black exactly as the original
    // does, which is the only way the blown-out core reads as light; it needs a
    // dark container to sit in. Transparent turns brightness into alpha so the
    // wave can float on any surface, at the cost of that core.
    float m = max(max(col.r, col.g), col.b);
    float a = clamp(m, 0.0, 1.0);
    vec3 rgb = m > 0.001 ? col / m : col;
    fragColor = mix(vec4(clamp(rgb, 0.0, 1.0), a), vec4(clamp(col, 0.0, 1.0), 1.0), uOpaque);
}
void main(){ mainImage(gl_FragColor, gl_FragCoord.xy); }`;

const FLUID_DOTS_SHADER = `precision highp float;
uniform vec2 iResolution; uniform float iTime;
uniform vec3 uTintA; uniform vec3 uTintB;
uniform float uLevel;
const float TAU = 6.28318530718;
const int   N   = 6;
const float SMOOTH_K = 0.08;
const float INTENSITY  = 0.0025;
const float FALLOFF_P  = 1.35;
const float FADE_START = 0.02;
const float FADE_END   = 0.56;
const float ABERR = 0.005;
const vec3  SPECTRAL = vec3(0.0, 0.5, 1.0) * ABERR;
const float COLOR_K   = 0.5;
const float MERGE_PERIOD = 6.0;
const float STAGGER  = 0.33;
const float HOLD     = 0.0;
const float W = 4.6;
const float L = 3.2;
const float PIERCE  = 0.12;
const float RECOIL  = 0.035;
const float REC_LAG = 0.11;
const float GATHER_PERIOD = 12.0;
const float GATHER_START  = 9.2;
const float GATHER_HOLD   = 0.8;
const float GATHER_R      = 0.008;
const float GATHER_DIM    = 0.85;
const float GATHER_IN     = 1.8;
const float GATHER_IN_L   = 7.5;
const float BURST_W = 6.5;
const float BURST_L = 4.0;
const float CHARGE_T     = 0.30;
const float CHARGE_SHRK  = 0.18;
const float CHARGE_GLOW  = 0.35;
const float FLASH_GAIN   = 1.2;
const float FLASH_DECAY  = 7.0;

float hash11(float n){ return fract(sin(n*127.1 + 311.7)*43758.5453); }
float settleWL(float tau, float w, float l){
    if(tau <= 0.0) return 0.0;
    return 1.0 - exp(-l*tau)*cos(w*tau);
}
float settle(float tau){ return settleWL(tau, W, L); }
float settleCrit(float tau, float l){
    if(tau <= 0.0) return 0.0;
    return 1.0 - exp(-l*tau)*(1.0 + l*tau);
}
float smin(float a, float b, float k){
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h*h*k*0.25;
}
float dotR(float fi, float seed, float t){
    return 0.036 + 0.010*sin(t*1.3 + seed*TAU) + 0.005*sin(t*2.4 + fi*1.3);
}
float dotSD(vec2 p, vec2 pos, float r, float t, float fi, float shapeDamp){
    vec2 d = p - pos;
    float sq = 0.075 * (0.5 + 0.5*sin(t*0.9 + fi*2.0)) * shapeDamp;
    float ca = cos(t*0.35 + fi), sa = sin(t*0.35 + fi);
    d = mat2(ca,-sa,sa,ca) * d;
    d *= vec2(1.0+sq, 1.0-sq);
    return length(d) - r;
}
vec3 scene(vec2 p, float t){
    float k  = floor(t/MERGE_PERIOD);
    float u  = fract(t/MERGE_PERIOD);
    float te = u * MERGE_PERIOD;
    float tg = mod(t, GATHER_PERIOD);
    float g  = settleCrit((tg - GATHER_START) * GATHER_IN, GATHER_IN_L)
             - settleWL(tg - GATHER_START - GATHER_HOLD, BURST_W, BURST_L);
    float gC = clamp(g, 0.0, 1.0);
    float tb     = tg - (GATHER_START + GATHER_HOLD);
    float charge = smoothstep(-CHARGE_T, 0.0, min(tb, 0.0)) * gC;
    float flash  = tb > 0.0 ? exp(-tb * FLASH_DECAY) : 0.0;
    float gBright = mix(1.0, GATHER_DIM, gC) * (1.0 + CHARGE_GLOW*charge + FLASH_GAIN*flash);
    vec3  total3 = vec3(1e5);
    vec3  cAcc   = vec3(0.0);
    float wAcc   = 1e-6;
    for(int i=0; i<N; i++){
        float fi   = float(i);
        float seed = hash11(fi);
        float ang = fi/float(N)*TAU + t*0.35;
        vec2 dir  = vec2(cos(ang), sin(ang));
        float R = 0.17 + 0.010*sin(t*1.0) + 0.007*sin(t*1.3 + seed*TAU);
        float pairId   = mod(fi, 3.0);
        float moverLow = mod(k + pairId, 2.0);
        float isMover  = (fi < 2.5) ? step(moverLow, 0.5) : step(0.5, moverLow);
        float goStart  = pairId * STAGGER;
        float retStart = 3.0*STAGGER + HOLD + pairId * STAGGER;
        float m   = (settle(te - goStart)           - settle(te - retStart))           * isMover;
        float rec = (settle(te - goStart - REC_LAG) - settle(te - retStart - REC_LAG)) * (1.0 - isMover);
        float rSelf = dotR(fi, seed, t);
        rSelf = mix(rSelf, 0.036, gC);
        rSelf *= 1.0 - CHARGE_SHRK * charge;
        float fj    = mod(fi + 3.0, 6.0);
        float rPart = dotR(fj, hash11(fj), t);
        float deep   = -(R + RECOIL) - PIERCE * rPart;
        float radial = mix(R, deep, m) + RECOIL * rec;
        radial = mix(radial, GATHER_R, g);
        vec2  pos    = radial * dir;
        float sdR = dotSD(p - SPECTRAL.r*dir, pos, rSelf, t, fi, 1.0 - gC);
        float sdG = dotSD(p - SPECTRAL.g*dir, pos, rSelf, t, fi, 1.0 - gC);
        float sdB = dotSD(p - SPECTRAL.b*dir, pos, rSelf, t, fi, 1.0 - gC);
        total3 = vec3( smin(total3.r, sdR, SMOOTH_K),
                       smin(total3.g, sdG, SMOOTH_K),
                       smin(total3.b, sdB, SMOOTH_K) );
        // Each dot sits somewhere on the theme ramp instead of the original hue wheel.
        vec3 dotCol = mix(uTintA, uTintB, fi/float(N));
        float w = exp(-sdG * COLOR_K);
        cAcc += w * dotCol;
        wAcc += w;
    }
    vec3 sd3    = max(total3, vec3(0.0)) + 1e-4;
    vec3 core3  = clamp(INTENSITY / pow(sd3, vec3(FALLOFF_P)), 0.0, 1.0);
    vec3 edge3  = 1.0 - smoothstep(vec3(FADE_START), vec3(FADE_END), sd3);
    vec3 bright = core3 * edge3 * gBright * (0.55 + 0.45*clamp(uLevel, 0.0, 1.0));
    return bright * (cAcc / wAcc);
}
void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 res = iResolution.xy;
    vec2 p = (2.0*fragCoord - res) / min(res.x, res.y);
    float t = iTime;
    p /= 1.0 + 0.03*sin(t*1.0);
    vec3 col = scene(p, t);
    col *= 1.0 + 0.05*sin(t*1.0 + 1.0);
    col = pow(col, vec3(1.0/1.2));
    col = min(col, 1.0);
    // Normalise by the ACTUAL peak channel, not by the clamped alpha. The core
    // runs well past 1.0, and dividing by a clamped value leaves every channel
    // pinned at 1.0 — a white streak where the palette should be.
    float m = max(max(col.r, col.g), col.b);
    float a = clamp(m, 0.0, 1.0);
    vec3 rgb = m > 0.001 ? col / m : col;
    fragColor = vec4(clamp(rgb, 0.0, 1.0), a);
}
void main(){ mainImage(gl_FragColor, gl_FragCoord.xy); }`;

const SHADERS: Record<SiriWaveVariant, string> = {
  wave: WAVE_SHADER,
  'fluid-dots': FLUID_DOTS_SHADER,
};

/**
 * Resolve a CSS custom property to 0..1 sRGB for the shader.
 *
 * Two conversions, because neither alone is enough. `getComputedStyle` resolves
 * the variable but hands back whatever syntax it was authored in — these tokens
 * are OKLCH, and the numbers in `oklch(0.68 0.19 35)` are nothing like RGB, so
 * reading them off with a regex yields near-black. A 2D canvas is then asked to
 * paint that string and the pixel is read back, which works for any colour
 * syntax the browser can parse at all.
 */
function resolveTint(el: HTMLElement, cssVar: string): [number, number, number] {
  const probe = document.createElement('span');
  probe.style.cssText = `color: var(${cssVar}); position: absolute; visibility: hidden;`;
  el.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();

  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  const ctx = c.getContext('2d', {willReadFrequently: true});
  if (!ctx) return [1, 1, 1];
  ctx.fillStyle = '#000';
  ctx.fillStyle = computed;         // ignored if unparseable, leaving the black above
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [(r ?? 255) / 255, (g ?? 255) / 255, (b ?? 255) / 255];
}

// Live handles so the render loop reads current props without re-initialising.
const live = {level: 0, resolved: 1, speed: 1, opaque: 0, chroma: 1};
watchEffect(() => {
  live.level = props.level;
  live.resolved = props.resolved;
  live.speed = props.speed;
  live.opaque = props.opaque ? 1 : 0;
  live.chroma = props.chroma;
});

let cleanup: (() => void) | null = null;

function init() {
  cleanup?.();
  cleanup = null;

  const el = canvas.value;
  if (!el) return;
  const gl = el.getContext('webgl', {alpha: true, premultipliedAlpha: false, antialias: false});
  if (!gl) return; // No WebGL: the element stays blank and the surrounding UI carries the state.

  const compile = (type: number, src: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(log ?? 'shader compile error');
    }
    return shader;
  };

  const program = gl.createProgram()!;
  const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compile(gl.FRAGMENT_SHADER, SHADERS[props.variant]);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const uResolution = gl.getUniformLocation(program, 'iResolution');
  const uTime = gl.getUniformLocation(program, 'iTime');
  const uTintA = gl.getUniformLocation(program, 'uTintA');
  const uTintB = gl.getUniformLocation(program, 'uTintB');
  const uResolvedLoc = gl.getUniformLocation(program, 'uResolved');
  const uLevelLoc = gl.getUniformLocation(program, 'uLevel');
  const uOpaqueLoc = gl.getUniformLocation(program, 'uOpaque');
  const uChromaLoc = gl.getUniformLocation(program, 'uChroma');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(props.width * props.renderScale * dpr));
  const h = Math.max(1, Math.round(props.height * props.renderScale * dpr));
  el.width = w;
  el.height = h;
  gl.viewport(0, 0, w, h);

  const a = resolveTint(el.parentElement ?? document.body, props.tintFrom);
  const b = resolveTint(el.parentElement ?? document.body, props.tintTo);
  gl.uniform3f(uTintA, a[0], a[1], a[2]);
  gl.uniform3f(uTintB, b[0], b[1], b[2]);

  // Reduced motion still gets the wave, just held still: the shape carries the
  // state, and it is the travelling that people are asking not to see.
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const start = performance.now();
  let clock = 0;
  let last = start;
  let raf = 0;

  const frame = (now: number) => {
    // Integrate rather than scale elapsed time, so a speed change bends the wave
    // forward instead of jumping it to a different phase.
    clock += still ? 0 : ((now - last) / 1000) * live.speed;
    last = now;
    gl.uniform2f(uResolution, w, h);
    gl.uniform1f(uTime, still ? 1.2 : clock);
    if (uResolvedLoc) gl.uniform1f(uResolvedLoc, live.resolved);
    if (uLevelLoc) gl.uniform1f(uLevelLoc, live.level);
    if (uOpaqueLoc) gl.uniform1f(uOpaqueLoc, live.opaque);
    if (uChromaLoc) gl.uniform1f(uChromaLoc, live.chroma);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  cleanup = () => {
    cancelAnimationFrame(raf);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.deleteBuffer(buffer);
  };
}

onMounted(init);
onBeforeUnmount(() => cleanup?.());

// Re-initialise only on the things that are baked in at setup: the shader, the
// backing-store size, and the palette. Level and speed ride the live handles.
watch(() => [props.variant, props.width, props.height, props.renderScale, props.tintFrom, props.tintTo],
  () => init());

// The tints are sampled once, so a light/dark flip has to resample them.
const colorMode = useColorMode();
watch(() => colorMode.value, () => init());
</script>

<template>
  <canvas ref="canvas" aria-hidden="true"
          :class="cn('block', props.class)"
          :style="{ width: `${width}px`, height: `${height}px` }"/>
</template>
