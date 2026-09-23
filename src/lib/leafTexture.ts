import * as THREE from "three";

// Procedural leaf silhouette so we don't need an external asset.
export function createLeafTexture(): THREE.Texture {
	const size = 64;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return new THREE.Texture();
	}

	ctx.clearRect(0, 0, size, size);
	ctx.translate(size / 2, size / 2);

	ctx.beginPath();
	ctx.moveTo(0, -size * 0.42);
	ctx.bezierCurveTo(size * 0.34, -size * 0.28, size * 0.34, size * 0.24, 0, size * 0.42);
	ctx.bezierCurveTo(-size * 0.34, size * 0.24, -size * 0.34, -size * 0.28, 0, -size * 0.42);
	ctx.closePath();
	ctx.fillStyle = "#ffffff";
	ctx.fill();

	ctx.strokeStyle = "rgba(0,0,0,0.25)";
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(0, -size * 0.38);
	ctx.lineTo(0, size * 0.38);
	ctx.stroke();

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}
