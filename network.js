// Simulates a small packet network floating in 3D and flattens it into "glow primitives"
// that every renderer tier (WebGPU, WebGL, Canvas 2D) can draw.
//
// A primitive is 12 floats:
//   ax, ay, bx, by   segment endpoints (a == b for a point); y spans -1..1, x spans -aspect..aspect
//   ring             if > 0 the glow sits on a ring of this radius around the segment
//   width            glow falloff width
//   intensity
//   tail             0..1, how strongly the glow fades from b towards a (comet tails)
//   r, g, b, unused

export const FLOATS_PER_PRIM = 12;

const Z_NEAR = 1.2;
const Z_FAR = 5.5;
const Z_FOCUS = 2.6;         // depth that is rendered sharp; everything else blurs with distance from it
const SPREAD = 1.25;         // nodes extend past the screen edge so camera movement never reveals a border
const MAX_LINKS = 4;
const HOP_SECONDS = 1.6;
const RIPPLE_SECONDS = 1.4;
const TAIL_LENGTH = 0.25;    // fraction of an edge
const BLUR = 0.03;

const COOL_COLORS = [
    [0.25, 0.72, 1.0],
    [0.35, 0.5, 1.0],
    [0.62, 0.45, 1.0],
    [0.2, 0.9, 0.8]
];
const WARM_COLOR = [1.0, 0.55, 0.3];
const EDGE_COLOR = [0.3, 0.55, 0.9];
const DUST_COLOR = [0.6, 0.75, 1.0];

const random = (min, max) => min + Math.random() * (max - min);
const pick = (items) => items[Math.floor(Math.random() * items.length)];

export class Network {
    constructor(nodeCount, dustCount) {
        this.time = random(0, 1000);
        this.nodes = [];
        this.edges = [];
        this.packets = [];
        this.ripples = [];
        this.dust = [];
        this.maxPackets = Math.ceil(nodeCount / 4);
        this.pointer = { x: 0, y: 0 };   // where the visitor points, -1..1
        this.look = { x: 0, y: 0 };      // smoothed pointer, drives the camera

        this._placeNodes(nodeCount);
        this._linkNodes();
        for (let i = 0; i < dustCount; i++) {
            this.dust.push(this._randomPoint());
        }

        const capacity = dustCount + nodeCount + this.edges.length + 3 * this.maxPackets + 16;
        this.prims = new Float32Array(capacity * FLOATS_PER_PRIM);
        this.primCount = 0;

        // Start with traffic already flowing, so the first (or the only, with reduced motion) frame looks alive.
        for (let i = 0; i < 50; i++) {
            this.step(0.1);
        }
    }

    _randomPoint() {
        return {
            u: random(-1, 1), v: random(-1, 1), z: random(Z_NEAR, Z_FAR),
            speed: random(0.05, 0.15),
            phaseX: random(0, 6.28), phaseY: random(0, 6.28), phaseZ: random(0, 6.28),
            sx: 0, sy: 0, inv: 0
        };
    }

    _placeNodes(count) {
        // Keep nodes apart on screen so they do not clump; give up after a few tries rather than loop forever.
        const minDistance = 0.9 / Math.sqrt(count);
        for (let i = 0; i < count; i++) {
            let node;
            for (let attempt = 0; attempt < 20; attempt++) {
                node = this._randomPoint();
                if (this.nodes.every(o => Math.hypot(o.u - node.u, o.v - node.v) > minDistance)) break;
            }
            node.color = Math.random() < 0.1 ? WARM_COLOR : pick(COOL_COLORS);
            node.links = [];
            node.flash = 0;
            this.nodes.push(node);
        }
    }

    _linkNodes() {
        const distance = (a, b) => Math.hypot((a.u * a.z - b.u * b.z) * 1.6, a.v * a.z - b.v * b.z, a.z - b.z);
        for (const node of this.nodes) {
            const wanted = 1 + Math.floor(Math.random() * 2);
            const nearest = this.nodes
                .filter(o => o !== node && !node.links.some(l => l.node === o))
                .sort((a, b) => distance(node, a) - distance(node, b));
            for (const other of nearest) {
                if (node.links.length >= wanted) break;
                if (other.links.length >= MAX_LINKS) continue;
                const edge = { a: node, b: other, heat: 0 };
                node.links.push({ node: other, edge });
                other.links.push({ node, edge });
                this.edges.push(edge);
            }
        }
    }

    step(dt) {
        this.time += dt;

        const ease = 1 - Math.exp(-dt * 2);
        this.look.x += (this.pointer.x - this.look.x) * ease;
        this.look.y += (this.pointer.y - this.look.y) * ease;

        const cool = Math.exp(-dt * 1.5);
        for (const node of this.nodes) node.flash *= cool;
        for (const edge of this.edges) edge.heat *= cool;

        for (const ripple of this.ripples) ripple.age += dt / RIPPLE_SECONDS;
        this.ripples = this.ripples.filter(r => r.age < 1);

        for (const packet of this.packets) {
            packet.progress += dt / HOP_SECONDS;
            packet.edge.heat = 1;
            if (packet.progress >= 1) this._arrive(packet);
        }
        this.packets = this.packets.filter(p => p.hops >= 0);

        if (this.packets.length < this.maxPackets && Math.random() < dt * this.maxPackets * 0.25) {
            this._emit();
        }
    }

    _emit() {
        const from = pick(this.nodes);
        if (!from.links.length) return;
        const link = pick(from.links);
        from.flash = 1;
        this.packets.push({
            from, to: link.node, edge: link.edge, progress: 0,
            hops: 1 + Math.floor(Math.random() * 4),
            color: Math.random() < 0.2 ? WARM_COLOR : pick(COOL_COLORS)
        });
    }

    _arrive(packet) {
        const at = packet.to;
        at.flash = 1;
        packet.hops--;
        const onward = at.links.filter(l => l.node !== packet.from);
        if (packet.hops < 0 || !onward.length) {
            packet.hops = -1;
            this.ripples.push({ node: at, age: 0, color: packet.color });
            return;
        }
        const link = pick(onward);
        packet.from = at;
        packet.to = link.node;
        packet.edge = link.edge;
        packet.progress -= 1;
    }

    /**
     * Projects the scene and fills this.prims / this.primCount.
     * @param {number} aspect - canvas width / height
     * @param {number} pixel - size of one canvas pixel in primitive units (2 / canvas height)
     */
    project(aspect, pixel) {
        const t = this.time;
        const yaw = 0.08 * Math.sin(t * 0.07) + this.look.x * 0.05;
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);
        const camX = 0.15 * Math.sin(t * 0.05) + this.look.x * 0.15;
        const camY = 0.1 * Math.cos(t * 0.043) - this.look.y * 0.12;

        const place = (point) => {
            const x = point.u * point.z * aspect * SPREAD + 0.12 * Math.sin(t * point.speed + point.phaseX);
            const y = point.v * point.z * SPREAD + 0.12 * Math.sin(t * point.speed * 0.8 + point.phaseY);
            const z = point.z - Z_FOCUS + 0.15 * Math.sin(t * point.speed * 0.6 + point.phaseZ);
            point.inv = 1 / (Z_FOCUS + x * sin + z * cos);
            point.sx = (x * cos - z * sin - camX) * point.inv;
            point.sy = (y - camY) * point.inv;
        };

        const prims = this.prims;
        let offset = 0;
        // inv is 1 / depth: it scales sizes for perspective and tells how far out of focus the primitive is.
        const put = (ax, ay, bx, by, inv, ring, size, intensity, tail, color) => {
            if (offset >= prims.length) return;
            const sharp = size * inv;
            // Never go thinner than a pixel, that would shimmer; dim instead.
            const width = Math.max(sharp + BLUR * Math.abs(inv - 1 / Z_FOCUS), pixel * 0.75);
            prims[offset++] = ax;
            prims[offset++] = ay;
            prims[offset++] = bx;
            prims[offset++] = by;
            prims[offset++] = ring;
            prims[offset++] = width;
            prims[offset++] = intensity * (sharp / width) * Math.min(1, inv * Z_FOCUS);
            prims[offset++] = tail;
            prims[offset++] = color[0];
            prims[offset++] = color[1];
            prims[offset++] = color[2];
            prims[offset++] = 0;
        };

        for (const speck of this.dust) {
            place(speck);
            put(speck.sx, speck.sy, speck.sx, speck.sy, speck.inv, 0, 0.004, 0.5, 0, DUST_COLOR);
        }

        for (const node of this.nodes) place(node);

        for (const { a, b, heat } of this.edges) {
            put(a.sx, a.sy, b.sx, b.sy, (a.inv + b.inv) / 2, 0, 0.003, 0.24 + 0.25 * heat, 0, EDGE_COLOR);
        }

        for (const { node, age, color } of this.ripples) {
            const fade = (1 - age) * (1 - age);
            put(node.sx, node.sy, node.sx, node.sy, node.inv, 0.2 * age * node.inv, 0.006, 0.7 * fade, 0, color);
        }

        for (const { from, to, progress, color } of this.packets) {
            const start = Math.max(0, progress - TAIL_LENGTH);
            put(
                from.sx + (to.sx - from.sx) * start, from.sy + (to.sy - from.sy) * start,
                from.sx + (to.sx - from.sx) * progress, from.sy + (to.sy - from.sy) * progress,
                from.inv + (to.inv - from.inv) * progress, 0, 0.007, 1.6, 1, color
            );
        }

        for (const node of this.nodes) {
            put(node.sx, node.sy, node.sx, node.sy, node.inv, 0, 0.015, 0.9 + 1.3 * node.flash, 0, node.color);
        }

        this.primCount = offset / FLOATS_PER_PRIM;
    }
}
