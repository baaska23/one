import * as THREE from "three";

// Hard-edged colour bands, top to bottom — slate blue overhead stepping
// down into a glowing orange/yellow horizon, pixel-art style (no blending).
const SKY_BANDS: [number, string][] = [
	[0, "#4f6687"],
	[0.18, "#5d6f8e"],
	[0.32, "#7a7590"],
	[0.44, "#b87a78"],
	[0.56, "#e08a58"],
	[0.68, "#f09c4c"],
	[0.8, "#f7b650"],
	[0.9, "#ffd068"],
];

// Blocky cloud banks: [x, y, width, height] in texture pixels.
const CLOUDS: { color: string; rects: [number, number, number, number][] }[] = [
	{
		color: "#c9707a",
		rects: [[0, 22, 20, 3], [4, 25, 26, 2], [44, 28, 20, 3], [38, 31, 26, 2], [2, 48, 18, 2], [46, 50, 18, 2]],
	},
	{
		color: "#e8844a",
		rects: [[0, 18, 14, 4], [3, 21, 22, 2], [10, 23, 12, 2], [46, 24, 18, 4], [40, 27, 22, 2], [50, 30, 14, 2], [0, 45, 16, 3], [44, 47, 20, 3]],
	},
	{
		color: "#f6a85a",
		rects: [[2, 17, 9, 2], [6, 20, 12, 1], [50, 23, 12, 2], [44, 26, 10, 1], [2, 44, 10, 2], [48, 46, 12, 2], [22, 56, 8, 1], [36, 57, 6, 1]],
	},
];

export function createSunsetSkyTexture(): THREE.Texture {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 96;
	const ctx = canvas.getContext("2d");
	if (!ctx) return new THREE.Texture();

	SKY_BANDS.forEach(([start, color], i) => {
		const end = SKY_BANDS[i + 1]?.[0] ?? 1;
		ctx.fillStyle = color;
		ctx.fillRect(0, Math.floor(start * canvas.height), canvas.width, Math.ceil((end - start) * canvas.height));
	});

	CLOUDS.forEach(({ color, rects }) => {
		ctx.fillStyle = color;
		rects.forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
	});

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	return texture;
}
