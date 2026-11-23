// Picks the best background renderer the device can handle and drives the animation.
//
// Tiers, best first: WebGPU, WebGL 2, Canvas 2D, and finally just the CSS gradient from styles.css.
// Append ?bg=webgpu|webgl|2d|static to the URL to force one of them.

import { Network } from './network.js';

const TIERS = [
    ['webgpu', () => import('./renderer-webgpu.js')],
    ['webgl', () => import('./renderer-webgl.js')],
    ['2d', () => import('./renderer-canvas.js')]
];

const MAX_PIXELS = 2560 * 1440;  // the scene is soft, rendering more pixels than this only costs battery
const MIN_QUALITY = 0.4;
const WARMUP_FRAMES = 30;        // not measured: shaders compile, the page is still loading
const MEASURED_FRAMES = 60;

const forcedTier = new URLSearchParams(location.search).get('bg');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const lowEnd = navigator.hardwareConcurrency <= 4 || navigator.deviceMemory <= 4;

let canvas = document.getElementById('background-canvas');
let renderer = null;
let network = null;
let quality = lowEnd ? 0.7 : 1;  // resolution multiplier, lowered when frames come too slowly
let maxScale = 2;
let minFrameMs = 0;
let frozen = false;              // the device cannot keep up even at minimum quality
let frameRequest = 0;
let lastFrame = 0;
let sampleCount = 0;
let sampleSum = 0;

async function start(firstTier) {
    for (let i = firstTier; i < TIERS.length; i++) {
        const [name, load] = TIERS[i];
        if (forcedTier && forcedTier !== name) continue;
        try {
            renderer = await (await load()).create(canvas, Boolean(forcedTier));
        } catch (error) {
            console.warn(`Background tier "${name}" failed, trying the next one.`, error);
        }
        if (renderer) {
            setUp(name === '2d');
            renderer.lost.then(() => {
                stop();
                renderer = null;
                replaceCanvas();
                start(i + 1);
            });
            return;
        }
        replaceCanvas();
    }
}

// A canvas is bound to its first context type forever, so every new attempt needs a fresh one.
function replaceCanvas() {
    const fresh = canvas.cloneNode();
    fresh.classList.remove('ready');
    canvas.replaceWith(fresh);
    canvas = fresh;
}

function setUp(is2d) {
    const light = lowEnd || is2d;
    const area = innerWidth * innerHeight;
    const nodeCount = Math.round(Math.min(Math.max(area / 25000, 20), 64) * (light ? 0.6 : 1));
    network = new Network(nodeCount, is2d ? 0 : nodeCount * 2);
    maxScale = is2d ? 1 : 2;
    // High refresh rate displays get every second or third frame, 60 fps is plenty for a slow background.
    minFrameMs = is2d ? 30 : 12;
    resize();
    updateRunning();
    canvas.classList.add('ready');
}

function resize() {
    if (!renderer) return;
    const area = innerWidth * innerHeight;
    const scale = Math.min(devicePixelRatio, maxScale, Math.sqrt(MAX_PIXELS / area)) * quality;
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
    if (!frameRequest) draw();
}

function draw() {
    network.project(canvas.width / canvas.height, 2 / canvas.height);
    renderer.render(network.prims, network.primCount, network.time);
}

function frame(now) {
    frameRequest = requestAnimationFrame(frame);
    const elapsed = now - lastFrame;
    if (elapsed < minFrameMs) return;
    lastFrame = now;
    network.step(Math.min(elapsed, 100) / 1000);
    draw();
    measure(Math.min(elapsed, 100));
}

// Frame pacing is the only signal a page has about GPU load. It also drops when the browser
// throttles the page to save power, and rendering fewer pixels is the right answer to that too.
function measure(elapsed) {
    if (++sampleCount <= WARMUP_FRAMES) return;
    sampleSum += elapsed;
    if (sampleCount < WARMUP_FRAMES + MEASURED_FRAMES) return;
    const average = sampleSum / MEASURED_FRAMES;
    sampleCount = 0;
    sampleSum = 0;

    if (average > minFrameMs * 4 && quality <= MIN_QUALITY) {
        frozen = true;
        updateRunning();
    } else if (average > minFrameMs * 2 && quality > MIN_QUALITY) {
        quality = Math.max(MIN_QUALITY, quality * 0.75);
        resize();
    }
}

function stop() {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
}

function updateRunning() {
    stop();
    if (!renderer) return;
    if (frozen || document.hidden || reducedMotion.matches) {
        draw();  // leave a still frame behind
        return;
    }
    sampleCount = 0;
    sampleSum = 0;
    lastFrame = performance.now();
    frameRequest = requestAnimationFrame(frame);
}

addEventListener('resize', resize);
document.addEventListener('visibilitychange', updateRunning);
reducedMotion.addEventListener('change', updateRunning);
addEventListener('pointermove', (event) => {
    // Touch would make the scene jump on every tap.
    if (network && event.pointerType === 'mouse') {
        network.pointer.x = event.clientX / innerWidth * 2 - 1;
        network.pointer.y = event.clientY / innerHeight * 2 - 1;
    }
});

start(0);
