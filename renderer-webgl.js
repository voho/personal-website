// WebGL 2 tier. Keep the shaders in sync with renderer-webgpu.js, they are the same code in two languages.

import { FLOATS_PER_PRIM } from './network.js';

const SHARED = `#version 300 es
precision highp float;

uniform vec4 uView; // resolution.xy, time, aspect

// The page content sits in the middle; everything is dimmed there so the text stays easy to read.
float calm(vec2 p) {
    vec2 e = p / vec2(0.1 + 0.9 * min(uView.w, 1.0), 0.42);
    return exp(-dot(e, e));
}

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Breaks up colour banding, which is very visible in dark gradients.
vec3 dither(vec3 color, vec2 pixel) {
    return color + (hash(pixel + fract(uView.z) * 61.0) - 0.5) / 255.0;
}
`;

const BACKGROUND_VERTEX = `#version 300 es
void main() {
    // One triangle that covers the whole screen.
    gl_Position = vec4(float((gl_VertexID << 1) & 2) * 2.0 - 1.0, float(gl_VertexID & 2) * 2.0 - 1.0, 0.0, 1.0);
}
`;

const BACKGROUND_FRAGMENT = SHARED + `
out vec4 outColor;

// Gradient noise, roughly 0..1. Smoother than value noise, which shows its grid in slow fog.
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec4 angle = 6.2831853 * vec4(
        hash(i), hash(i + vec2(1.0, 0.0)), hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)));
    vec4 corner = cos(angle) * (f.x - vec4(0.0, 1.0, 0.0, 1.0)) + sin(angle) * (f.y - vec4(0.0, 0.0, 1.0, 1.0));
    return 0.5 + 0.7 * mix(mix(corner.x, corner.y, u.x), mix(corner.z, corner.w, u.x), u.y);
}

float fbm(vec2 p, int octaves) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < octaves; i++) {
        sum += amplitude * noise(p);
        p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.02;
        amplitude *= 0.5;
    }
    return sum;
}

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - uView.xy) / uView.y;
    float t = uView.z * 0.012;

    // Domain-warped noise: slow drifting fog.
    vec2 warp = vec2(
        fbm(p * 0.8 + vec2(t, -0.7 * t), 3),
        fbm(p * 0.8 + vec2(5.2 - 0.6 * t, 1.3 + t), 3));
    float fog = fbm(p * 0.6 + 2.0 * warp, 4);

    vec3 color = vec3(0.006, 0.01, 0.022);
    color += vec3(0.015, 0.065, 0.13) * smoothstep(0.3, 0.7, fog);
    color += vec3(0.1, 0.03, 0.14) * smoothstep(0.4, 0.7, warp.y) * smoothstep(0.3, 0.6, fog);
    color *= 1.0 - 0.4 * dot(p, p) / (1.0 + uView.w * uView.w);
    color *= 1.0 - 0.4 * calm(p);

    outColor = vec4(dither(color, gl_FragCoord.xy), 1.0);
}
`;

const PRIM_VERTEX = `#version 300 es
precision highp float;

uniform vec4 uView;

layout(location = 0) in vec4 aSegment;
layout(location = 1) in vec4 aShape;
layout(location = 2) in vec4 aColor;

out vec2 vPosition;
flat out vec4 vSegment;
flat out vec4 vShape;
flat out vec4 vColor;

void main() {
    vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
    vec2 a = aSegment.xy;
    vec2 b = aSegment.zw;
    float len = length(b - a);
    vec2 along = len > 1e-6 ? (b - a) / len : vec2(1.0, 0.0);
    // The glow reaches exactly zero 6 widths away, see the fragment shader.
    float reach = aShape.x + 6.0 * aShape.y;
    vPosition = (a + b) * 0.5
        + along * (len * 0.5 + reach) * corner.x
        + vec2(-along.y, along.x) * reach * corner.y;
    vSegment = aSegment;
    vShape = aShape;
    vColor = aColor;
    gl_Position = vec4(vPosition.x / uView.w, vPosition.y, 0.0, 1.0);
}
`;

const PRIM_FRAGMENT = SHARED + `
in vec2 vPosition;
flat in vec4 vSegment;
flat in vec4 vShape; // ring, width, intensity, tail
flat in vec4 vColor;

out vec4 outColor;

void main() {
    vec2 a = vSegment.xy;
    vec2 ab = vSegment.zw - a;
    vec2 ap = vPosition - a;
    float h = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
    float x = abs(length(ap - ab * h) - vShape.x) / vShape.y;

    // Bright core with a long soft halo, windowed so it ends where the quad ends.
    float window = max(1.0 - x / 6.0, 0.0);
    float glow = vShape.z * window * window / (1.0 + x * x);
    glow *= mix(1.0, h * h, vShape.w);
    glow *= 1.0 - 0.5 * calm(vPosition);

    outColor = vec4(dither(vColor.rgb * glow, gl_FragCoord.xy), 1.0);
}
`;

function compile(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('Shader program failed to link: ' + gl.getProgramInfoLog(program));
    }
    return { program, view: gl.getUniformLocation(program, 'uView') };
}

export function create(canvas, allowSoftware) {
    const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        // A decorative background is not worth waking up the discrete GPU.
        powerPreference: 'low-power',
        // Software rendering would be slower than the Canvas 2D tier.
        failIfMajorPerformanceCaveat: !allowSoftware
    });
    if (!gl) return null;

    const background = compile(gl, BACKGROUND_VERTEX, BACKGROUND_FRAGMENT);
    const prim = compile(gl, PRIM_VERTEX, PRIM_FRAGMENT);

    const backgroundVao = gl.createVertexArray();
    const primVao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    let bufferSize = 0;
    gl.bindVertexArray(primVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (let i = 0; i < 3; i++) {
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, i * 16);
        gl.vertexAttribDivisor(i, 1);
    }
    // Screen blending: glows add up but saturate softly instead of clipping to white.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);

    return {
        lost: new Promise(resolve => canvas.addEventListener('webglcontextlost', resolve, { once: true })),

        render(prims, primCount, time) {
            const width = canvas.width;
            const height = canvas.height;
            gl.viewport(0, 0, width, height);

            gl.disable(gl.BLEND);
            gl.useProgram(background.program);
            gl.uniform4f(background.view, width, height, time, width / height);
            gl.bindVertexArray(backgroundVao);
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            gl.enable(gl.BLEND);
            gl.useProgram(prim.program);
            gl.uniform4f(prim.view, width, height, time, width / height);
            gl.bindVertexArray(primVao);
            if (bufferSize !== prims.byteLength) {
                gl.bufferData(gl.ARRAY_BUFFER, prims.byteLength, gl.DYNAMIC_DRAW);
                bufferSize = prims.byteLength;
            }
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, prims, 0, primCount * FLOATS_PER_PRIM);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, primCount);
        }
    };
}
