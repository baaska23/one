import * as THREE from "three";

// Samples a sub-range [tStart, tEnd] of a curve and builds a flat ribbon
// mesh following it, so each stop-to-stop stretch can be its own mesh
// with its own "visited" material.
export function buildRoadSegmentGeometry(
	curve: THREE.CatmullRomCurve3,
	tStart: number,
	tEnd: number,
	width: number,
	divisions = 16,
): THREE.BufferGeometry {
	const points: THREE.Vector3[] = [];
	for (let i = 0; i <= divisions; i++) {
		const t = tStart + (tEnd - tStart) * (i / divisions);
		points.push(curve.getPointAt(t));
	}

	const up = new THREE.Vector3(0, 1, 0);
	const positions: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];

	for (let i = 0; i < points.length; i++) {
		const prev = points[Math.max(0, i - 1)]!;
		const next = points[Math.min(points.length - 1, i + 1)]!;
		const tangent = next.clone().sub(prev).normalize();
		const side = new THREE.Vector3().crossVectors(tangent, up).normalize().multiplyScalar(width / 2);
		const point = points[i]!;
		const left = point.clone().sub(side);
		const right = point.clone().add(side);

		positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
		const v = i / (points.length - 1);
		uvs.push(0, v, 1, v);
	}

	for (let i = 0; i < points.length - 1; i++) {
		const a = i * 2;
		const b = i * 2 + 1;
		const c = (i + 1) * 2;
		const d = (i + 1) * 2 + 1;
		indices.push(a, c, b, b, c, d);
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

// Builds a curve running parallel to another one, offset sideways by a
// fixed distance — used to lay sidewalks/building rows alongside the road
// without hand-authoring separate control points.
export function buildOffsetCurve(curve: THREE.CatmullRomCurve3, offset: number, samples = 48): THREE.CatmullRomCurve3 {
	const up = new THREE.Vector3(0, 1, 0);
	const points: THREE.Vector3[] = [];
	for (let i = 0; i <= samples; i++) {
		const t = i / samples;
		const point = curve.getPointAt(t);
		const tangent = curve.getTangentAt(t);
		const side = new THREE.Vector3().crossVectors(tangent, up).normalize().multiplyScalar(offset);
		points.push(point.clone().add(side));
	}
	return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.3);
}
