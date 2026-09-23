import * as THREE from "three";
import { buildRoadSegmentGeometry } from "./road";

// Reds, oranges and yellows of autumn city trees at sunset.
const CANOPY_PALETTE = [0xc8321e, 0xe0501e, 0xf07a28, 0xf5a030, 0xd8b040];
// Riverbank bushes: late-summer greens turning yellow and orange.
const BUSH_PALETTE = [0x7a8a30, 0x9aa040, 0xc8a030, 0xd87a2a];

// Scrolling textures (the river) the render loop animates.
export interface FlowTexture {
	texture: THREE.Texture;
	speed: number;
}

// Rough circular footprint used to keep buildings, trees and paths apart.
export interface Footprint {
	x: number;
	z: number;
	r: number;
}

// Small canvas texture with hard pixels, tiled across a surface.
function pixelTexture(
	width: number,
	height: number,
	draw: (ctx: CanvasRenderingContext2D) => void,
	repeatX = 1,
	repeatY = 1,
): THREE.Texture {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) return new THREE.Texture();
	draw(ctx);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.generateMipmaps = false;
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(repeatX, repeatY);
	return texture;
}

function speckle(ctx: CanvasRenderingContext2D, colors: string[], count: number, w = 1, h = 1) {
	const { width, height } = ctx.canvas;
	for (let i = 0; i < count; i++) {
		ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]!;
		ctx.fillRect(Math.floor(Math.random() * width), Math.floor(Math.random() * height), w, h);
	}
}

function sampleXZ(curve: THREE.Curve<THREE.Vector3>, samples: number): THREE.Vector2[] {
	return Array.from({ length: samples + 1 }, (_, i) => {
		const p = curve.getPointAt(i / samples);
		return new THREE.Vector2(p.x, p.z);
	});
}

function distanceToSamples(x: number, z: number, samples: THREE.Vector2[]): number {
	let min = Infinity;
	for (const s of samples) min = Math.min(min, Math.hypot(s.x - x, s.y - z));
	return min;
}

function overlaps(x: number, z: number, r: number, footprints: Footprint[], slack = 0.85): boolean {
	return footprints.some((f) => Math.hypot(f.x - x, f.z - z) < (f.r + r) * slack);
}

// Dusty city ground: worn grass, packed dirt and fallen leaves.
export function buildGround(center: THREE.Vector3): THREE.Mesh {
	const texture = pixelTexture(
		32,
		32,
		(ctx) => {
			ctx.fillStyle = "#7a7040";
			ctx.fillRect(0, 0, 32, 32);
			speckle(ctx, ["#6e6a3a", "#8a7c48", "#6a6048", "#7a7a44"], 260);
			speckle(ctx, ["#b8481e", "#d86a24", "#e8a03a"], 50);
		},
		40,
		40,
	);
	const mesh = new THREE.Mesh(
		new THREE.PlaneGeometry(120, 120),
		new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
	);
	mesh.rotation.x = -Math.PI / 2;
	mesh.position.set(center.x, -0.02, center.z);
	return mesh;
}

// Paving-slab sidewalk with a few leaves on it; the scene tints it when visited.
export function createPathTexture(pathLength: number): THREE.Texture {
	return pixelTexture(
		16,
		32,
		(ctx) => {
			ctx.fillStyle = "#b8aa98";
			ctx.fillRect(0, 0, 16, 32);
			speckle(ctx, ["#a89a88", "#c8baa8", "#b0a290"], 60);
			// Slab joints.
			ctx.fillStyle = "#968a7a";
			for (let y = 0; y < 32; y += 8) ctx.fillRect(0, y, 16, 1);
			ctx.fillRect(8, 0, 1, 32);
			speckle(ctx, ["#d0502a", "#e88a30"], 5, 2, 1);
		},
		1,
		pathLength / 1.6,
	);
}

// The river runs across the whole city and passes under the bridge at `bridge`.
export function buildRiverCurve(bridge: THREE.Vector3): THREE.CatmullRomCurve3 {
	const y = 0.04;
	const { x: bx, z: bz } = bridge;
	const points = [
		new THREE.Vector3(bx - 46, y, bz + 3),
		new THREE.Vector3(bx - 28, y, bz - 1.5),
		new THREE.Vector3(bx - 13, y, bz + 1.2),
		new THREE.Vector3(bx - 4, y, bz + 0.2),
		new THREE.Vector3(bx, y, bz),
		new THREE.Vector3(bx + 4, y, bz - 0.2),
		new THREE.Vector3(bx + 14, y, bz - 1.4),
		new THREE.Vector3(bx + 28, y, bz + 1.4),
		new THREE.Vector3(bx + 46, y, bz - 2),
	];
	return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.4);
}

export function buildRiver(riverCurve: THREE.CatmullRomCurve3, flows: FlowTexture[]): THREE.Group {
	const group = new THREE.Group();
	const length = riverCurve.getLength();

	const texture = pixelTexture(
		16,
		32,
		(ctx) => {
			ctx.fillStyle = "#34507a";
			ctx.fillRect(0, 0, 16, 32);
			speckle(ctx, ["#46688f", "#5a80a8", "#2a4468"], 60, 3, 1);
			// Sunset reflection glinting down the middle of the water.
			for (let i = 0; i < 14; i++) {
				ctx.fillStyle = i % 3 === 0 ? "#ffd070" : "#f0a050";
				ctx.fillRect(5 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 32), 2 + Math.floor(Math.random() * 3), 1);
			}
		},
		1,
		length / 2.2,
	);
	flows.push({ texture, speed: -0.2 });

	const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
	group.add(new THREE.Mesh(buildRoadSegmentGeometry(riverCurve, 0, 1, 2.4, 160), material));

	// Muddy banks either side of the water, like the real riverbed.
	const bankMaterial = new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 1, side: THREE.DoubleSide });
	const bank = new THREE.Mesh(buildRoadSegmentGeometry(riverCurve, 0, 1, 3.6, 160), bankMaterial);
	bank.position.y = -0.015;
	group.add(bank);

	return group;
}

// Cream balustrade with turquoise diamond panels and a rusty top rail,
// after the railing on the real bridge.
function createRailingTexture(length: number): THREE.Texture {
	return pixelTexture(
		16,
		8,
		(ctx) => {
			ctx.fillStyle = "#e6dcc4";
			ctx.fillRect(0, 0, 16, 8);
			ctx.fillStyle = "#b8643a";
			ctx.fillRect(0, 0, 16, 1);
			ctx.fillStyle = "#c8bca0";
			ctx.fillRect(0, 7, 16, 1);
			[4, 12].forEach((cx) => {
				ctx.fillStyle = "#4aa8b0";
				ctx.fillRect(cx - 1, 2, 2, 4);
				ctx.fillRect(cx - 2, 3, 4, 2);
				ctx.fillStyle = "#2a5a70";
				ctx.fillRect(cx - 1, 3, 2, 2);
			});
			ctx.fillStyle = "#d8ccb0";
			ctx.fillRect(0, 1, 1, 6);
			ctx.fillRect(8, 1, 1, 6);
		},
		length / 0.9,
		1,
	);
}

// Flat concrete road bridge centred on `center`, running along `tangent`.
export function buildCityBridge(center: THREE.Vector3, tangent: THREE.Vector3, deckY: number): THREE.Group {
	const group = new THREE.Group();
	const concrete = new THREE.MeshStandardMaterial({ color: 0xa8a098, flatShading: true, roughness: 1 });
	const length = 5;
	const width = 2.8;

	const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, length), concrete);
	deck.position.y = deckY - 0.15;
	group.add(deck);

	// Curbs between the walkway and the railing.
	[-1, 1].forEach((side) => {
		const curb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, length), concrete);
		curb.position.set(side * (width / 2 - 0.35), deckY + 0.03, 0);
		group.add(curb);
	});

	const railTexture = createRailingTexture(length);
	const railMaterial = new THREE.MeshStandardMaterial({ map: railTexture, roughness: 0.9 });
	const railTop = new THREE.MeshStandardMaterial({ color: 0xb8643a, roughness: 0.9 });
	[-1, 1].forEach((side) => {
		const railing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, length), [
			railMaterial,
			railMaterial,
			railTop,
			railTop,
			railMaterial,
			railMaterial,
		]);
		// Box side faces map U along Z, so the pattern runs along the rail.
		railing.position.set(side * (width / 2 - 0.05), deckY + 0.21, 0);
		group.add(railing);
	});

	// Squat piers on each bank.
	[-1, 1].forEach((end) => {
		const pier = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, deckY, 0.5), concrete);
		pier.position.set(0, deckY / 2 - 0.3, end * (length / 2 - 0.25));
		group.add(pier);
	});

	group.position.set(center.x, 0, center.z);
	group.rotation.y = Math.atan2(tangent.x, tangent.z);
	return group;
}

interface FacadeStyle {
	wall: string;
	trim: string;
	window: string;
	lit: string;
	stripe?: string;
	balcony?: string;
}

// Palettes lifted from the Soviet-era blocks around the bridge: salmon,
// cream with teal bands, beige, pale grey — plus blue glass for towers.
const APARTMENT_STYLES: FacadeStyle[] = [
	{ wall: "#d98a5a", trim: "#c07048", window: "#3a4658", lit: "#ffd08a", balcony: "#b8643a" },
	{ wall: "#e6dcc0", trim: "#cfc4a4", window: "#3a4658", lit: "#ffcf8f", stripe: "#4aa0a0" },
	{ wall: "#d8c4a0", trim: "#c0ac88", window: "#404a5a", lit: "#ffd9a0" },
	{ wall: "#b8b8b4", trim: "#a0a09c", window: "#3a4658", lit: "#ffcf8f", balcony: "#8a8a86" },
	{ wall: "#e0a888", trim: "#c89070", window: "#3a4658", lit: "#ffe0a8", stripe: "#e6dcc0" },
];
const GLASS_STYLE: FacadeStyle = { wall: "#5a7e9a", trim: "#8ab0c8", window: "#46688a", lit: "#ffc070" };

// One tile = 4 window bays x 4 floors; tiled per building so window
// counts match the block's size.
function createFacadeTile(style: FacadeStyle, glass = false): THREE.Texture {
	return pixelTexture(32, 32, (ctx) => {
		ctx.fillStyle = style.wall;
		ctx.fillRect(0, 0, 32, 32);
		for (let floor = 0; floor < 4; floor++) {
			const y = floor * 8;
			if (style.stripe) {
				ctx.fillStyle = style.stripe;
				ctx.fillRect(0, y + 7, 32, 1);
			}
			for (let bay = 0; bay < 4; bay++) {
				const x = bay * 8;
				if (glass) {
					ctx.fillStyle = Math.random() < 0.15 ? style.lit : style.window;
					ctx.fillRect(x + 1, y + 1, 7, 6);
					ctx.fillStyle = style.trim;
					ctx.fillRect(x + 1, y + 3, 7, 1);
					continue;
				}
				ctx.fillStyle = style.trim;
				ctx.fillRect(x + 1, y + 1, 6, 6);
				ctx.fillStyle = Math.random() < 0.22 ? style.lit : style.window;
				ctx.fillRect(x + 2, y + 2, 4, 4);
				if (style.balcony && bay % 2 === 1) {
					ctx.fillStyle = style.balcony;
					ctx.fillRect(x + 1, y + 5, 6, 2);
				}
			}
		}
	});
}

export interface BuildingPlan extends Footprint {
	width: number;
	depth: number;
	height: number;
	angle: number;
	style: number;
	glass: boolean;
}

// Lines the path with apartment blocks, keeping clear of the path itself,
// the river, the bridge and the camera's starting spot.
export function planCity(
	pathCurve: THREE.CatmullRomCurve3,
	riverCurve: THREE.CatmullRomCurve3,
	keepClear: Footprint[],
): BuildingPlan[] {
	const pathSamples = sampleXZ(pathCurve, 120);
	const riverSamples = sampleXZ(riverCurve, 160);
	const plans: BuildingPlan[] = [];
	const up = new THREE.Vector3(0, 1, 0);

	const tryPlace = (plan: BuildingPlan) => {
		if (distanceToSamples(plan.x, plan.z, pathSamples) < 1.2 + plan.r * 0.75) return;
		if (distanceToSamples(plan.x, plan.z, riverSamples) < 2.1 + plan.r * 0.75) return;
		if (overlaps(plan.x, plan.z, plan.r, keepClear, 1)) return;
		if (overlaps(plan.x, plan.z, plan.r, plans)) return;
		plans.push(plan);
	};

	// Two rows each side: low blocks by the path, taller ones behind.
	const rows = [
		{ offset: [2.8, 3.6], floors: [4, 6], step: 2.4 },
		{ offset: [6.5, 8.5], floors: [6, 9], step: 2.8 },
	];
	const length = pathCurve.getLength();
	rows.forEach((row) => {
		for (let d = 0; d < length + 6; d += row.step) {
			const t = Math.min(d / length, 1);
			const p = pathCurve.getPointAt(t);
			const tangent = pathCurve.getTangentAt(t);
			const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
			// Past the end of the path, keep extending straight ahead.
			if (d > length) p.addScaledVector(tangent, d - length);
			[-1, 1].forEach((side) => {
				const width = THREE.MathUtils.randFloat(1.8, 2.8);
				const depth = THREE.MathUtils.randFloat(1.4, 2);
				const floors = THREE.MathUtils.randInt(row.floors[0]!, row.floors[1]!);
				const offset = THREE.MathUtils.randFloat(row.offset[0]!, row.offset[1]!) + depth / 2;
				const c = p.clone().addScaledVector(normal, side * offset);
				tryPlace({
					x: c.x,
					z: c.z,
					r: Math.hypot(width, depth) / 2,
					width,
					depth,
					height: floors * 0.42,
					angle: Math.atan2(tangent.x, tangent.z),
					style: Math.floor(Math.random() * APARTMENT_STYLES.length),
					glass: false,
				});
			});
		}
	});

	// Blocks along the far riverbank so the river reads as running through town.
	for (let x = -22; x <= 22; x += 3) {
		const width = THREE.MathUtils.randFloat(2, 3);
		const depth = THREE.MathUtils.randFloat(1.4, 2);
		const river = riverCurve.getPointAt(THREE.MathUtils.clamp((x + 46) / 92, 0, 1));
		const floors = THREE.MathUtils.randInt(4, 8);
		tryPlace({
			x,
			z: river.z + THREE.MathUtils.randFloat(3.4, 4.6) + depth / 2,
			r: Math.hypot(width, depth) / 2,
			width,
			depth,
			height: floors * 0.42,
			angle: 0,
			style: Math.floor(Math.random() * APARTMENT_STYLES.length),
			glass: false,
		});
	}

	return plans;
}

// Background high-rises and glass towers, beyond the path's far end.
export function planSkyline(end: THREE.Vector3, keepClear: Footprint[]): BuildingPlan[] {
	const plans: BuildingPlan[] = [];
	for (let attempt = 0; attempt < 200 && plans.length < 22; attempt++) {
		const x = THREE.MathUtils.randFloat(-30, 30);
		const z = THREE.MathUtils.randFloat(end.z - 26, end.z - 8);
		const glass = Math.random() < 0.45;
		const width = THREE.MathUtils.randFloat(2.4, 4);
		const depth = THREE.MathUtils.randFloat(2.4, 4);
		const plan: BuildingPlan = {
			x,
			z,
			r: Math.hypot(width, depth) / 2,
			width,
			depth,
			height: THREE.MathUtils.randFloat(glass ? 8 : 5, glass ? 15 : 9),
			angle: THREE.MathUtils.randFloat(-0.2, 0.2),
			style: Math.floor(Math.random() * APARTMENT_STYLES.length),
			glass,
		};
		if (overlaps(x, z, plan.r, keepClear, 1) || overlaps(x, z, plan.r, plans, 1)) continue;
		plans.push(plan);
	}
	return plans;
}

export function buildBuildings(plans: BuildingPlan[]): THREE.Group {
	const group = new THREE.Group();
	const tiles = APARTMENT_STYLES.map((style) => createFacadeTile(style));
	const glassTile = createFacadeTile(GLASS_STYLE, true);
	const roof = new THREE.MeshStandardMaterial({ color: 0x5e5a58, flatShading: true, roughness: 1 });
	const floorHeight = 0.42;
	const bayWidth = 0.55;

	const faceMaterial = (tile: THREE.Texture, span: number, height: number) => {
		const texture = tile.clone();
		texture.repeat.set(span / (bayWidth * 4), height / (floorHeight * 4));
		texture.needsUpdate = true;
		return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 });
	};

	plans.forEach((plan) => {
		const tile = plan.glass ? glassTile : tiles[plan.style]!;
		const front = faceMaterial(tile, plan.width, plan.height);
		const side = faceMaterial(tile, plan.depth, plan.height);
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(plan.width, plan.height, plan.depth), [
			side,
			side,
			roof,
			roof,
			front,
			front,
		]);
		mesh.position.set(plan.x, plan.height / 2 - 0.02, plan.z);
		mesh.rotation.y = plan.angle;
		group.add(mesh);

		// Stair/elevator hut on some roofs breaks up the flat skyline.
		if (!plan.glass && Math.random() < 0.5) {
			const hut = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.6), roof);
			hut.position.set(plan.x, plan.height + 0.15, plan.z);
			hut.rotation.y = plan.angle;
			group.add(hut);
		}
	});
	return group;
}

// Tower cranes over the skyline — the city is always building.
export function buildCranes(end: THREE.Vector3): THREE.Group {
	const group = new THREE.Group();
	const yellow = new THREE.MeshStandardMaterial({ color: 0xe8a830, emissive: 0xe8a830, emissiveIntensity: 0.25, flatShading: true });
	const red = new THREE.MeshStandardMaterial({ color: 0xc8402a, emissive: 0xc8402a, emissiveIntensity: 0.25, flatShading: true });
	[
		{ x: -8, z: end.z - 14, h: 12, angle: 0.4 },
		{ x: 11, z: end.z - 18, h: 14, angle: -0.9 },
	].forEach(({ x, z, h, angle }) => {
		const crane = new THREE.Group();
		const mast = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), yellow);
		mast.position.y = h / 2;
		crane.add(mast);
		const jib = new THREE.Mesh(new THREE.BoxGeometry(8, 0.25, 0.25), yellow);
		jib.position.set(2.6, h, 0);
		crane.add(jib);
		const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), red);
		counterweight.position.set(-1.2, h - 0.1, 0);
		crane.add(counterweight);
		const cab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), red);
		cab.position.set(0.3, h - 0.45, 0);
		crane.add(cab);
		crane.position.set(x, 0, z);
		crane.rotation.y = angle;
		group.add(crane);
	});
	return group;
}

interface TreeSpot {
	x: number;
	z: number;
	baseY: number;
	scale: number;
}

// Autumn trees as instanced trunks + clustered low-poly canopies, one
// instanced mesh per canopy colour so the whole city's trees are a few draws.
export function buildAutumnTrees(spots: TreeSpot[]): THREE.Group {
	const group = new THREE.Group();
	if (spots.length === 0) return group;
	const dummy = new THREE.Object3D();

	const trunkGeometry = new THREE.CylinderGeometry(0.07, 0.12, 1, 5);
	trunkGeometry.translate(0, 0.5, 0);
	const trunks = new THREE.InstancedMesh(
		trunkGeometry,
		new THREE.MeshStandardMaterial({ color: 0x4a2c22, flatShading: true, roughness: 1 }),
		spots.length,
	);

	const canopyMatrices: THREE.Matrix4[][] = CANOPY_PALETTE.map(() => []);
	spots.forEach((spot, i) => {
		const trunkHeight = THREE.MathUtils.randFloat(1.3, 2.2) * spot.scale;
		dummy.position.set(spot.x, spot.baseY, spot.z);
		dummy.rotation.set(0, 0, THREE.MathUtils.randFloat(-0.06, 0.06));
		dummy.scale.set(spot.scale, trunkHeight, spot.scale);
		dummy.updateMatrix();
		trunks.setMatrixAt(i, dummy.matrix);

		const colorIndex = Math.floor(Math.random() * CANOPY_PALETTE.length);
		const blobs = 3;
		for (let b = 0; b < blobs; b++) {
			const angle = (b / blobs) * Math.PI * 2 + Math.random();
			const r = 0.35 * spot.scale;
			dummy.position.set(
				spot.x + Math.cos(angle) * r,
				spot.baseY + trunkHeight + THREE.MathUtils.randFloat(-0.1, 0.45) * spot.scale,
				spot.z + Math.sin(angle) * r,
			);
			dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
			dummy.scale.setScalar(THREE.MathUtils.randFloat(0.55, 0.85) * spot.scale);
			dummy.updateMatrix();
			// Mix a neighbouring shade into each tree so canopies aren't flat.
			const shade = b === 0 ? (colorIndex + 1) % CANOPY_PALETTE.length : colorIndex;
			canopyMatrices[shade]!.push(dummy.matrix.clone());
		}
	});
	trunks.instanceMatrix.needsUpdate = true;
	group.add(trunks);

	const canopyGeometry = new THREE.IcosahedronGeometry(0.75, 0);
	canopyMatrices.forEach((matrices, index) => {
		if (matrices.length === 0) return;
		const color = CANOPY_PALETTE[index]!;
		const mesh = new THREE.InstancedMesh(
			canopyGeometry,
			new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.18, flatShading: true, roughness: 0.9 }),
			matrices.length,
		);
		matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
		mesh.instanceMatrix.needsUpdate = true;
		group.add(mesh);
	});

	return group;
}

// Street and riverbank trees in the gaps between buildings.
export function planTrees(
	pathCurve: THREE.CatmullRomCurve3,
	riverCurve: THREE.CatmullRomCurve3,
	obstacles: Footprint[],
	end: THREE.Vector3,
): TreeSpot[] {
	const pathSamples = sampleXZ(pathCurve, 120);
	const riverSamples = sampleXZ(riverCurve, 160);
	const spots: TreeSpot[] = [];

	for (let attempt = 0; attempt < 1200 && spots.length < 50; attempt++) {
		// Half the trees hug the riverbanks, like the greenery in the photo.
		const nearRiver = attempt % 2 === 0;
		let x: number;
		let z: number;
		if (nearRiver) {
			const p = riverCurve.getPointAt(THREE.MathUtils.randFloat(0.3, 0.7));
			x = p.x;
			z = p.z + (Math.random() < 0.5 ? -1 : 1) * THREE.MathUtils.randFloat(1.9, 3);
		} else {
			x = THREE.MathUtils.randFloat(-12, 12);
			z = THREE.MathUtils.randFloat(end.z - 3, 2);
		}
		if (distanceToSamples(x, z, pathSamples) < 1.4) continue;
		if (distanceToSamples(x, z, riverSamples) < 1.7) continue;
		if (overlaps(x, z, 0.5, obstacles, 1)) continue;
		if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1.3)) continue;
		spots.push({ x, z, baseY: 0, scale: THREE.MathUtils.randFloat(0.75, 1.2) });
	}
	return spots;
}

// Low scrubby bushes crowding both riverbanks.
export function buildRiverBushes(riverCurve: THREE.CatmullRomCurve3, keepClear: Footprint[]): THREE.Group {
	const group = new THREE.Group();
	const dummy = new THREE.Object3D();
	const matrices: THREE.Matrix4[][] = BUSH_PALETTE.map(() => []);

	for (let i = 0; i < 140; i++) {
		const t = THREE.MathUtils.randFloat(0.1, 0.9);
		const p = riverCurve.getPointAt(t);
		const tangent = riverCurve.getTangentAt(t);
		const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
		const offset = (i % 2 ? 1 : -1) * THREE.MathUtils.randFloat(1.3, 2);
		const x = p.x + normal.x * offset;
		const z = p.z + normal.z * offset;
		if (overlaps(x, z, 0.4, keepClear, 1)) continue;
		dummy.position.set(x, 0.15, z);
		dummy.rotation.set(Math.random(), Math.random() * Math.PI, 0);
		const s = THREE.MathUtils.randFloat(0.35, 0.65);
		dummy.scale.set(s * 1.3, s, s * 1.3);
		dummy.updateMatrix();
		matrices[i % BUSH_PALETTE.length]!.push(dummy.matrix.clone());
	}

	const geometry = new THREE.IcosahedronGeometry(0.75, 0);
	matrices.forEach((list, index) => {
		if (list.length === 0) return;
		const color = BUSH_PALETTE[index]!;
		const mesh = new THREE.InstancedMesh(
			geometry,
			new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12, flatShading: true, roughness: 1 }),
			list.length,
		);
		list.forEach((m, i) => mesh.setMatrixAt(i, m));
		mesh.instanceMatrix.needsUpdate = true;
		group.add(mesh);
	});
	return group;
}

// A big low sun sinking behind the skyline, with a wide warm halo.
export function buildSun(glowTexture: THREE.Texture, position: THREE.Vector3): THREE.Group {
	const group = new THREE.Group();

	const halo = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: glowTexture,
			color: 0xffa040,
			transparent: true,
			opacity: 0.75,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			fog: false,
		}),
	);
	halo.scale.set(40, 40, 1);
	group.add(halo);

	const core = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: glowTexture,
			color: 0xfff2a0,
			transparent: true,
			opacity: 1,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			fog: false,
		}),
	);
	core.scale.set(11, 11, 1);
	group.add(core);

	group.position.copy(position);
	return group;
}
