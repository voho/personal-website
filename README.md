Simple personal website, to run at [voho.eu](http://voho.eu).

## Background animation

The animated background picks the best renderer the device can handle: WebGPU, then WebGL 2, then Canvas 2D,
and finally a plain CSS gradient. It lowers its resolution when frames come slowly, pauses in hidden tabs and
shows a still frame when the visitor prefers reduced motion.

To preview a specific tier, add `?bg=webgpu`, `?bg=webgl`, `?bg=2d` or `?bg=static` to the URL.
To run locally, serve the folder over HTTP (for example `python3 -m http.server`), ES modules do not load from `file://`.
