// WebGPU tier. Keep the shaders in sync with renderer-webgl.js, they are the same code in two languages.

import { FLOATS_PER_PRIM } from './network.js';

const SHADER = /* wgsl */`
struct View {
    resolution: vec2f,
    time: f32,
    aspect: f32,
}

@group(0) @binding(0) var<uniform> view: View;

// The page content sits in the middle; everything is dimmed there so the text stays easy to read.
fn calm(p: vec2f) -> f32 {
    let e = p / vec2f(0.1 + 0.9 * min(view.aspect, 1.0), 0.42);
    return exp(-dot(e, e));
}

fn hash(p: vec2f) -> f32 {
    var p3 = fract(p.xyx * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Breaks up colour banding, which is very visible in dark gradients.
fn dither(color: vec3f, pixel: vec2f) -> vec3f {
    return color + (hash(pixel + fract(view.time) * 61.0) - 0.5) / 255.0;
}

// Gradient noise, roughly 0..1. Smoother than value noise, which shows its grid in slow fog.
fn noise(p: vec2f) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    let angle = 6.2831853 * vec4f(
        hash(i), hash(i + vec2f(1.0, 0.0)), hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)));
    let corner = cos(angle) * (f.x - vec4f(0.0, 1.0, 0.0, 1.0)) + sin(angle) * (f.y - vec4f(0.0, 0.0, 1.0, 1.0));
    return 0.5 + 0.7 * mix(mix(corner.x, corner.y, u.x), mix(corner.z, corner.w, u.x), u.y);
}

fn fbm(start: vec2f, octaves: i32) -> f32 {
    var p = start;
    var sum = 0.0;
    var amplitude = 0.5;
    for (var i = 0; i < octaves; i++) {
        sum += amplitude * noise(p);
        p = mat2x2f(0.8, 0.6, -0.6, 0.8) * p * 2.02;
        amplitude *= 0.5;
    }
    return sum;
}

@vertex
fn backgroundVertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    // One triangle that covers the whole screen.
    return vec4f(f32((index << 1u) & 2u) * 2.0 - 1.0, f32(index & 2u) * 2.0 - 1.0, 0.0, 1.0);
}

@fragment
fn backgroundFragment(@builtin(position) pixel: vec4f) -> @location(0) vec4f {
    // Pixel coordinates grow downwards here but upwards in WebGL; flip so both tiers draw the same picture.
    let p = (pixel.xy * 2.0 - view.resolution) / view.resolution.y * vec2f(1.0, -1.0);
    let t = view.time * 0.012;

    // Domain-warped noise: slow drifting fog.
    let warp = vec2f(
        fbm(p * 0.8 + vec2f(t, -0.7 * t), 3),
        fbm(p * 0.8 + vec2f(5.2 - 0.6 * t, 1.3 + t), 3));
    let fog = fbm(p * 0.6 + 2.0 * warp, 4);

    var color = vec3f(0.006, 0.01, 0.022);
    color += vec3f(0.015, 0.065, 0.13) * smoothstep(0.3, 0.7, fog);
    color += vec3f(0.1, 0.03, 0.14) * smoothstep(0.4, 0.7, warp.y) * smoothstep(0.3, 0.6, fog);
    color *= 1.0 - 0.4 * dot(p, p) / (1.0 + view.aspect * view.aspect);
    color *= 1.0 - 0.4 * calm(p);

    return vec4f(dither(color, pixel.xy), 1.0);
}

struct Prim {
    @builtin(position) clip: vec4f,
    @location(0) position: vec2f,
    @location(1) @interpolate(flat) segment: vec4f,
    @location(2) @interpolate(flat) shape: vec4f, // ring, width, intensity, tail
    @location(3) @interpolate(flat) color: vec4f,
}

@vertex
fn primVertex(
    @builtin(vertex_index) index: u32,
    @location(0) segment: vec4f,
    @location(1) shape: vec4f,
    @location(2) color: vec4f,
) -> Prim {
    let corner = vec2f(f32(index & 1u), f32(index >> 1u)) * 2.0 - 1.0;
    let a = segment.xy;
    let b = segment.zw;
    let len = length(b - a);
    var along = vec2f(1.0, 0.0);
    if (len > 1e-6) {
        along = (b - a) / len;
    }
    // The glow reaches exactly zero 6 widths away, see the fragment shader.
    let reach = shape.x + 6.0 * shape.y;
    let position = (a + b) * 0.5
        + along * (len * 0.5 + reach) * corner.x
        + vec2f(-along.y, along.x) * reach * corner.y;
    return Prim(vec4f(position.x / view.aspect, position.y, 0.0, 1.0), position, segment, shape, color);
}

@fragment
fn primFragment(prim: Prim) -> @location(0) vec4f {
    let a = prim.segment.xy;
    let ab = prim.segment.zw - a;
    let ap = prim.position - a;
    let h = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-12), 0.0, 1.0);
    let x = abs(length(ap - ab * h) - prim.shape.x) / prim.shape.y;

    // Bright core with a long soft halo, windowed so it ends where the quad ends.
    let window = max(1.0 - x / 6.0, 0.0);
    var glow = prim.shape.z * window * window / (1.0 + x * x);
    glow *= mix(1.0, h * h, prim.shape.w);
    glow *= 1.0 - 0.5 * calm(prim.position);

    return vec4f(dither(prim.color.rgb * glow, prim.clip.xy), 1.0);
}
`;

export async function create(canvas, allowSoftware) {
    if (!navigator.gpu) return null;
    // A decorative background is not worth waking up the discrete GPU.
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
    if (!adapter) return null;
    // Software rendering would be slower than the Canvas 2D tier. (The flag moved to adapter.info in newer browsers.)
    if (!allowSoftware && (adapter.info?.isFallbackAdapter ?? adapter.isFallbackAdapter)) return null;
    const device = await adapter.requestDevice();

    // Only now touch the canvas: once it has a WebGPU context it can never get a WebGL one.
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });

    const module = device.createShaderModule({ code: SHADER });
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {}
        }]
    });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

    // The async variants reject on invalid shaders, so a broken driver falls through to the next tier.
    const [backgroundPipeline, primPipeline] = await Promise.all([
        device.createRenderPipelineAsync({
            layout,
            vertex: { module, entryPoint: 'backgroundVertex' },
            fragment: { module, entryPoint: 'backgroundFragment', targets: [{ format }] }
        }),
        device.createRenderPipelineAsync({
            layout,
            vertex: {
                module,
                entryPoint: 'primVertex',
                buffers: [{
                    arrayStride: FLOATS_PER_PRIM * 4,
                    stepMode: 'instance',
                    attributes: [0, 1, 2].map(i => ({ shaderLocation: i, offset: i * 16, format: 'float32x4' }))
                }]
            },
            fragment: {
                module,
                entryPoint: 'primFragment',
                targets: [{
                    format,
                    // Screen blending: glows add up but saturate softly instead of clipping to white.
                    blend: {
                        color: { srcFactor: 'one', dstFactor: 'one-minus-src' },
                        alpha: { srcFactor: 'one', dstFactor: 'zero' }
                    }
                }]
            },
            primitive: { topology: 'triangle-strip' }
        })
    ]);

    const viewData = new Float32Array(4);
    const viewBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: viewBuffer } }]
    });
    let primBuffer = null;

    return {
        lost: device.lost,

        render(prims, primCount, time) {
            if (primBuffer?.size !== prims.byteLength) {
                primBuffer?.destroy();
                primBuffer = device.createBuffer({
                    size: prims.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
                });
            }
            viewData.set([canvas.width, canvas.height, time, canvas.width / canvas.height]);
            device.queue.writeBuffer(viewBuffer, 0, viewData);
            device.queue.writeBuffer(primBuffer, 0, prims, 0, primCount * FLOATS_PER_PRIM);

            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    storeOp: 'store'
                }]
            });
            pass.setBindGroup(0, bindGroup);
            pass.setPipeline(backgroundPipeline);
            pass.draw(3);
            pass.setPipeline(primPipeline);
            pass.setVertexBuffer(0, primBuffer);
            pass.draw(4, primCount);
            pass.end();
            device.queue.submit([encoder.finish()]);
        }
    };
}
