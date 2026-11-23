// Canvas 2D tier for devices without usable GPU acceleration: plain lines and dots, no shaders.
// The canvas stays transparent, so the CSS gradient behind it serves as the background.

import { FLOATS_PER_PRIM } from './network.js';

export function create(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    return {
        lost: new Promise(() => {}),

        render(prims, primCount) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const scale = canvas.height / 2;

            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineCap = 'round';

            for (let i = 0; i < primCount * FLOATS_PER_PRIM; i += FLOATS_PER_PRIM) {
                const ax = centerX + prims[i] * scale;
                const ay = centerY - prims[i + 1] * scale;
                const bx = centerX + prims[i + 2] * scale;
                const by = centerY - prims[i + 3] * scale;
                const ring = prims[i + 4] * scale;
                const width = Math.max(prims[i + 5] * scale * 2, 1);
                const color = `rgb(${prims[i + 8] * 255},${prims[i + 9] * 255},${prims[i + 10] * 255})`;

                ctx.globalAlpha = Math.min(prims[i + 6], 1);
                ctx.beginPath();
                if (ring > 0) {
                    ctx.arc(ax, ay, ring, 0, 2 * Math.PI);
                } else if (ax === bx && ay === by) {
                    ctx.arc(ax, ay, width, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                    continue;
                } else {
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(bx, by);
                }
                ctx.strokeStyle = color;
                ctx.lineWidth = width;
                ctx.stroke();
            }
        }
    };
}
