import * as THREE from "three";

// Soft radial glow sprite — a cheap stand-in for bloom post-processing,
// much lighter on mobile GPUs.
export function createGlowTexture(): THREE.Texture {
	const size = 128;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return new THREE.Texture();
	}

	const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	gradient.addColorStop(0, "rgba(255,255,255,1)");
	gradient.addColorStop(0.35, "rgba(255,220,160,0.6)");
	gradient.addColorStop(1, "rgba(255,180,90,0)");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, size);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}
