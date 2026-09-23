import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MemoryStop } from "../data/memories";
import { createLeafTexture } from "./leafTexture";
import { createGlowTexture } from "./glowTexture";
import { buildRoadSegmentGeometry } from "./road";
import { createSunsetSkyTexture } from "./skyTexture";
import {
	buildAutumnTrees,
	buildBuildings,
	buildCityBridge,
	buildCranes,
	buildGround,
	buildRiver,
	buildRiverBushes,
	buildRiverCurve,
	buildSun,
	createPathTexture,
	planCity,
	planSkyline,
	planTrees,
	type FlowTexture,
	type Footprint,
} from "./environment";

export interface JourneySceneCallbacks {
	onSelectStop: (index: number) => void;
	onFinaleReady: () => void;
	onFinaleSelect: () => void;
	onFinaleLocked: (visitedCount: number, totalCount: number) => void;
}

interface LeafInstanceData {
	x: number;
	y: number;
	z: number;
	speed: number;
	swayPhase: number;
	swayAmp: number;
	swaySpeed: number;
	rotSpeed: number;
	rotation: number;
}

interface LeafBounds {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
	groundY: number;
	topY: number;
}

const PIXEL_SHORT_SIDE = 240;

const LEAF_PALETTE = [0xc8321e, 0xe0501e, 0xf07a28, 0xf5a030, 0xe8a33d];

// Stops sit on the path surface; the first stop ("where we met") sits on
// the bridge deck in the middle of the river.
const PATH_Y = 0.03;
const BRIDGE_DECK_Y = 0.35;
// Extra room after the first stop so the path clears the bridge before
// it bends.
const AFTER_BRIDGE_GAP = 1.5;
const STOP_SPACING = 4.5;
const PATH_AMPLITUDE = 2.2;

function buildStopPositions(count: number): THREE.Vector3[] {
	const spacing = STOP_SPACING;
	const amplitude = PATH_AMPLITUDE;
	const positions: THREE.Vector3[] = [];
	for (let i = 0; i < count; i++) {
		const x = Math.sin(i * 0.85) * amplitude;
		const z = -i * spacing - (i > 0 ? AFTER_BRIDGE_GAP : 0);
		positions.push(new THREE.Vector3(x, i === 0 ? BRIDGE_DECK_Y + 0.01 : PATH_Y, z));
	}
	return positions;
}

function buildFinalePosition(count: number): THREE.Vector3 {
	const spacing = STOP_SPACING;
	const amplitude = PATH_AMPLITUDE;
	const x = Math.sin((count - 1) * 0.85) * amplitude - 0.5;
	const z = -(count - 1) * spacing - AFTER_BRIDGE_GAP - 4;
	return new THREE.Vector3(x, PATH_Y, z);
}

export class JourneyScene {
	private renderer: THREE.WebGLRenderer;
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private controls: OrbitControls;
	private canvas: HTMLCanvasElement;
	private container: HTMLElement;
	private timer = new THREE.Timer();
	private raycaster = new THREE.Raycaster();
	private pointer = new THREE.Vector2();
	private hitTargets: THREE.Object3D[] = [];
	private finaleHit: THREE.Object3D | null = null;
	private segmentMaterials: THREE.MeshStandardMaterial[] = [];
	private lampGlowMaterials: THREE.SpriteMaterial[] = [];
	private lampGlowSprites: THREE.Sprite[] = [];
	private lampLights: THREE.PointLight[] = [];
	private finaleGlow: THREE.Sprite | null = null;
	private finaleLight: THREE.PointLight | null = null;
	private flowTextures: FlowTexture[] = [];
	// Place names are HTML chips pinned to 3D points, so they stay crisp
	// while the scene itself renders pixelated.
	private labelLayer: HTMLDivElement;
	private labels: { el: HTMLDivElement; anchor: THREE.Vector3; index: number }[] = [];
	private projected = new THREE.Vector3();
	private leafMesh!: THREE.InstancedMesh;
	private leafDummy = new THREE.Object3D();
	private leafData: LeafInstanceData[] = [];
	private bounds: LeafBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 5, groundY: -4, topY: 9 };
	private stopCount: number;
	private visited = new Set<number>();
	private callbacks: JourneySceneCallbacks;
	private pointerDown = { x: 0, y: 0, time: 0 };
	private pathCurve: THREE.CatmullRomCurve3 | null = null;
	private stopPositions: THREE.Vector3[] = [];
	private finalePosition = new THREE.Vector3();
	private flight: { cancel: () => void } | null = null;
	private ambientStarTimer: number | null = null;
	private disposed = false;

	constructor(canvas: HTMLCanvasElement, stops: MemoryStop[], finaleLabel: string, callbacks: JourneySceneCallbacks) {
		this.canvas = canvas;
		this.container = canvas.parentElement ?? document.body;
		this.stopCount = stops.length;
		this.callbacks = callbacks;

		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;

		this.labelLayer = document.createElement("div");
		this.labelLayer.className = "scene-labels";
		this.container.appendChild(this.labelLayer);

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);

		this.timer.connect(document);
		this.buildScene(stops, finaleLabel);
		this.resize();

		window.addEventListener("resize", this.resize);
		window.addEventListener("orientationchange", this.resize);
		document.addEventListener("visibilitychange", this.handleVisibility);

		this.canvas.style.touchAction = "none";
		this.canvas.addEventListener("pointerdown", this.onPointerDown);
		this.canvas.addEventListener("pointerup", this.onPointerUp);

		this.renderer.setAnimationLoop(this.tick);
		this.scheduleAmbientShootingStar();
	}

	private buildScene(stops: MemoryStop[], finaleLabel: string) {
		const fogColor = 0xe0976a;
		this.scene.background = new THREE.Color(fogColor);
		this.scene.fog = new THREE.FogExp2(fogColor, 0.013);

		const hemi = new THREE.HemisphereLight(0xffe0c8, 0x5a6a88, 1.5);
		this.scene.add(hemi);
		// Low, warm sun raking across the valley from the back-left.
		const sunLight = new THREE.DirectionalLight(0xffb070, 1.6);
		sunLight.position.set(-30, 12, -30);
		this.scene.add(sunLight);

		const positions = buildStopPositions(stops.length);
		const finalePosition = buildFinalePosition(stops.length);
		const allPoints = [...positions, finalePosition];
		const curve = new THREE.CatmullRomCurve3(allPoints, false, "catmullrom", 0.3);

		const center = new THREE.Vector3();
		allPoints.forEach((p) => center.add(p));
		center.divideScalar(allPoints.length);

		this.scene.add(this.buildSkyDome(center));
		this.scene.add(buildGround(center));

		const pathWidth = 1.3;
		const pathTexture = createPathTexture(curve.getLength() / (allPoints.length - 1));
		const segmentCount = allPoints.length - 1;
		const pathGroup = new THREE.Group();
		for (let i = 0; i < segmentCount; i++) {
			const geometry = buildRoadSegmentGeometry(curve, i / segmentCount, (i + 1) / segmentCount, pathWidth, 14);
			const material = new THREE.MeshStandardMaterial({
				map: pathTexture,
				color: 0xffffff,
				emissive: 0x1a1206,
				emissiveIntensity: 0.2,
				roughness: 1,
				side: THREE.DoubleSide,
				flatShading: true,
			});
			this.segmentMaterials.push(material);
			pathGroup.add(new THREE.Mesh(geometry, material));
		}
		this.scene.add(pathGroup);

		// Short stretch of sidewalk leading onto the bridge from the camera side.
		const bridgePoint = positions[0] ?? new THREE.Vector3();
		const approach = new THREE.CatmullRomCurve3([
			new THREE.Vector3(bridgePoint.x, PATH_Y, bridgePoint.z + 9),
			new THREE.Vector3(bridgePoint.x, PATH_Y, bridgePoint.z + 4.4),
			new THREE.Vector3(bridgePoint.x, BRIDGE_DECK_Y + 0.01, bridgePoint.z + 2.5),
			new THREE.Vector3(bridgePoint.x, BRIDGE_DECK_Y + 0.01, bridgePoint.z),
		]);
		this.scene.add(
			new THREE.Mesh(
				buildRoadSegmentGeometry(approach, 0, 1, pathWidth, 20),
				new THREE.MeshStandardMaterial({ map: pathTexture, roughness: 1, side: THREE.DoubleSide }),
			),
		);

		// The river runs across the city and under the bridge where we met.
		const riverCurve = buildRiverCurve(new THREE.Vector3(bridgePoint.x, 0, bridgePoint.z));
		this.scene.add(buildRiver(riverCurve, this.flowTextures));
		this.scene.add(buildCityBridge(bridgePoint, new THREE.Vector3(0, 0, -1), BRIDGE_DECK_Y));

		// Keep the bridge, the camera's start and the orbit ring free of buildings.
		const cameraStart = new THREE.Vector3(bridgePoint.x - 3, 3.2, bridgePoint.z + 7);
		const keepClear: Footprint[] = [
			{ x: bridgePoint.x, z: bridgePoint.z, r: 3.2 },
			{ x: cameraStart.x, z: cameraStart.z, r: 4 },
			{ x: finalePosition.x, z: finalePosition.z, r: 2.2 },
		];
		const city = planCity(curve, riverCurve, keepClear);
		const skyline = planSkyline(finalePosition, [...keepClear, ...city]);
		this.scene.add(buildBuildings([...city, ...skyline]));
		this.scene.add(buildCranes(finalePosition));
		this.scene.add(buildRiverBushes(riverCurve, [...keepClear, ...city]));
		this.scene.add(buildAutumnTrees(planTrees(curve, riverCurve, [...keepClear, ...city], finalePosition)));

		const glowTexture = createGlowTexture();
		this.scene.add(buildSun(glowTexture, new THREE.Vector3(18, 11, finalePosition.z - 58)));

		positions.forEach((pos, index) => this.buildLamp(pos, glowTexture, false, index, stops[index]?.place));
		this.buildLamp(finalePosition, glowTexture, true, -1, finaleLabel);

		this.buildLeaves(positions, finalePosition);

		this.pathCurve = curve;
		this.stopPositions = positions;
		this.finalePosition = finalePosition;

		const first = positions[0] ?? new THREE.Vector3();
		// Aim just past the bridge (not the middle of the whole path), so the
		// camera's max-distance clamp never drags it into the buildings.
		this.controls.target.set(first.x, 0.8, first.z - 6);

		// Start low in front of the bridge, looking across it into the city.
		this.camera.position.set(first.x - 3, 3.2, first.z + 7);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.minDistance = 3;
		this.controls.maxDistance = 18;
		this.controls.minPolarAngle = 1.0;
		this.controls.maxPolarAngle = 1.47;
		this.controls.enablePan = false;
		this.controls.update();
	}

	// Pixel sunset painted on the inside of a hemisphere, so clouds keep
	// their shape and sit behind the scene as the camera orbits.
	private buildSkyDome(center: THREE.Vector3): THREE.Mesh {
		const texture = createSunsetSkyTexture();
		texture.wrapS = THREE.RepeatWrapping;
		texture.repeat.set(4, 1);
		const dome = new THREE.Mesh(
			new THREE.SphereGeometry(150, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
			new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, depthWrite: false }),
		);
		dome.position.set(center.x, -2, center.z);
		dome.renderOrder = -1;
		return dome;
	}

	private buildLamp(
		position: THREE.Vector3,
		glowTexture: THREE.Texture,
		isFinale: boolean,
		index: number,
		label?: string,
	) {
		const group = new THREE.Group();
		group.position.copy(position);

		const poleHeight = isFinale ? 3.2 : 2.6;
		const pole = new THREE.Mesh(
			new THREE.CylinderGeometry(0.05, 0.07, poleHeight, 6),
			new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.8, flatShading: true }),
		);
		pole.position.y = poleHeight / 2;
		group.add(pole);

		const headColor = isFinale ? 0xffe3a8 : 0xffc978;
		const head = new THREE.Mesh(
			new THREE.IcosahedronGeometry(isFinale ? 0.32 : 0.22, 0),
			new THREE.MeshStandardMaterial({
				color: headColor,
				emissive: headColor,
				emissiveIntensity: isFinale ? 0.5 : 1.1,
				flatShading: true,
			}),
		);
		head.position.y = poleHeight + (isFinale ? 0.1 : 0.05);
		group.add(head);

		const light = new THREE.PointLight(isFinale ? 0xffdca0 : 0xffb454, isFinale ? 0.6 : 1.4, isFinale ? 14 : 9, 2);
		light.position.copy(head.position);
		group.add(light);
		if (isFinale) {
			this.finaleLight = light;
		} else {
			this.lampLights.push(light);
		}

		const glowMaterial = new THREE.SpriteMaterial({
			map: glowTexture,
			color: headColor,
			transparent: true,
			opacity: isFinale ? 0.35 : 0.75,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		});
		const glow = new THREE.Sprite(glowMaterial);
		const glowScale = isFinale ? 2.2 : 1.6;
		glow.scale.set(glowScale, glowScale, 1);
		glow.position.copy(head.position);
		glow.userData.baseScale = glowScale;
		group.add(glow);
		if (isFinale) {
			this.finaleGlow = glow;
		} else {
			this.lampGlowMaterials.push(glowMaterial);
			this.lampGlowSprites.push(glow);
		}

		const hit = new THREE.Mesh(
			new THREE.SphereGeometry(0.9, 8, 8),
			new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
		);
		hit.position.copy(head.position);
		hit.userData.index = isFinale ? -1 : index;
		group.add(hit);
		if (isFinale) {
			this.finaleHit = hit;
		} else {
			this.hitTargets.push(hit);
		}

		if (label) {
			const el = document.createElement("div");
			el.className = isFinale ? "scene-label is-finale" : "scene-label";
			el.textContent = label;
			this.labelLayer.appendChild(el);
			const anchor = position.clone();
			anchor.y += head.position.y + (isFinale ? 0.5 : 0.35);
			this.labels.push({ el, anchor, index: isFinale ? -1 : index });
		}

		this.scene.add(group);
	}

	private buildLeaves(positions: THREE.Vector3[], finalePosition: THREE.Vector3) {
		const allPoints = [...positions, finalePosition];
		let minX = Infinity;
		let maxX = -Infinity;
		let minZ = Infinity;
		let maxZ = -Infinity;
		allPoints.forEach((p) => {
			minX = Math.min(minX, p.x - 6);
			maxX = Math.max(maxX, p.x + 6);
			minZ = Math.min(minZ, p.z - 4);
			maxZ = Math.max(maxZ, p.z + 4);
		});
		this.bounds = { minX, maxX, minZ, maxZ, groundY: -4, topY: 9 };

		const count = 220;
		const geometry = new THREE.PlaneGeometry(0.32, 0.32);
		const texture = createLeafTexture();
		const material = new THREE.MeshBasicMaterial({
			map: texture,
			transparent: true,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		const mesh = new THREE.InstancedMesh(geometry, material, count);
		mesh.frustumCulled = false;

		const color = new THREE.Color();
		for (let i = 0; i < count; i++) {
			const data: LeafInstanceData = {
				x: THREE.MathUtils.randFloat(this.bounds.minX, this.bounds.maxX),
				y: THREE.MathUtils.randFloat(this.bounds.groundY, this.bounds.topY),
				z: THREE.MathUtils.randFloat(this.bounds.minZ, this.bounds.maxZ),
				speed: THREE.MathUtils.randFloat(0.4, 1.1),
				swayPhase: Math.random() * Math.PI * 2,
				swayAmp: THREE.MathUtils.randFloat(0.3, 0.9),
				swaySpeed: THREE.MathUtils.randFloat(0.4, 0.9),
				rotSpeed: THREE.MathUtils.randFloat(-1.2, 1.2),
				rotation: Math.random() * Math.PI * 2,
			};
			this.leafData.push(data);
			this.leafDummy.position.set(data.x, data.y, data.z);
			this.leafDummy.rotation.set(Math.random() * Math.PI, data.rotation, Math.random() * Math.PI);
			this.leafDummy.updateMatrix();
			mesh.setMatrixAt(i, this.leafDummy.matrix);
			color.setHex(LEAF_PALETTE[i % LEAF_PALETTE.length] ?? 0xe8a33d);
			mesh.setColorAt(i, color);
		}
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

		this.leafMesh = mesh;
		this.scene.add(mesh);
	}

	private updateLeaves(delta: number) {
		const time = this.timer.getElapsed();
		for (let i = 0; i < this.leafData.length; i++) {
			const d = this.leafData[i]!;
			d.y -= d.speed * delta;
			if (d.y < this.bounds.groundY) {
				d.y = this.bounds.topY;
				d.x = THREE.MathUtils.randFloat(this.bounds.minX, this.bounds.maxX);
				d.z = THREE.MathUtils.randFloat(this.bounds.minZ, this.bounds.maxZ);
			}
			d.rotation += d.rotSpeed * delta;
			const sway = Math.sin(time * d.swaySpeed + d.swayPhase) * d.swayAmp;
			this.leafDummy.position.set(d.x + sway, d.y, d.z);
			this.leafDummy.rotation.set(d.rotation * 0.6, d.rotation, d.rotation * 0.4);
			this.leafDummy.updateMatrix();
			this.leafMesh.setMatrixAt(i, this.leafDummy.matrix);
		}
		this.leafMesh.instanceMatrix.needsUpdate = true;
	}

	private tick = () => {
		this.timer.update();
		const delta = this.timer.getDelta();
		this.updateLeaves(delta);
		for (const flow of this.flowTextures) flow.texture.offset.y += flow.speed * delta;
		this.controls.update();
		this.renderer.render(this.scene, this.camera);
		this.updateLabels();
	};

	private updateLabels() {
		const rect = this.canvas.getBoundingClientRect();
		// Nearest first, so when chips collide the closer stop wins and the
		// one behind it is hidden instead of stacking into an unreadable pile.
		const ordered = this.labels
			.map((label) => ({ label, distance: this.camera.position.distanceTo(label.anchor) }))
			.sort((a, b) => a.distance - b.distance);
		const placed: { left: number; right: number; top: number; bottom: number }[] = [];

		for (const { label, distance } of ordered) {
			this.projected.copy(label.anchor).project(this.camera);
			const onScreen = this.projected.z < 1 && Math.abs(this.projected.x) < 1.1 && Math.abs(this.projected.y) < 1.1;
			if (!onScreen) {
				label.el.style.opacity = "0";
				continue;
			}
			const x = rect.left + ((this.projected.x + 1) / 2) * rect.width;
			const y = rect.top + ((1 - this.projected.y) / 2) * rect.height;
			const scale = THREE.MathUtils.clamp(9 / distance, 0.72, 1.1);
			const w = label.el.offsetWidth * scale;
			const h = label.el.offsetHeight * scale;
			const box = { left: x - w / 2 - 4, right: x + w / 2 + 4, top: y - h - 2, bottom: y + 2 };
			const hidden = placed.some((p) => box.left < p.right && box.right > p.left && box.top < p.bottom && box.bottom > p.top);
			label.el.style.opacity = hidden ? "0" : "1";
			if (!hidden) placed.push(box);
			label.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
			label.el.style.zIndex = String(1000 - Math.round(distance * 10));
		}
	}

	private resize = () => {
		const rect = this.container.getBoundingClientRect();
		const width = rect.width || window.innerWidth;
		const height = rect.height || window.innerHeight;
		this.camera.aspect = width / Math.max(height, 1);
		this.camera.updateProjectionMatrix();
		// Render into a small buffer (~240px on the short side) and let CSS
		// upscale it with nearest-neighbour filtering for a pixel-art look.
		this.renderer.setPixelRatio(Math.min(1, PIXEL_SHORT_SIDE / Math.max(Math.min(width, height), 1)));
		this.renderer.setSize(width, height, false);
	};

	private handleVisibility = () => {
		if (document.hidden) {
			this.renderer.setAnimationLoop(null);
		} else if (!this.disposed) {
			this.renderer.setAnimationLoop(this.tick);
		}
	};

	private onPointerDown = (event: PointerEvent) => {
		this.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
	};

	private onPointerUp = (event: PointerEvent) => {
		const dx = event.clientX - this.pointerDown.x;
		const dy = event.clientY - this.pointerDown.y;
		const dist = Math.hypot(dx, dy);
		const elapsed = performance.now() - this.pointerDown.time;
		if (dist > 10 || elapsed > 600) return;

		const rect = this.canvas.getBoundingClientRect();
		this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
		this.raycaster.setFromCamera(this.pointer, this.camera);

		const targets = this.finaleHit ? [...this.hitTargets, this.finaleHit] : this.hitTargets;
		const intersections = this.raycaster.intersectObjects(targets, false);
		if (intersections.length === 0) return;

		const index = intersections[0]!.object.userData.index as number;
		if (index === -1) {
			if (this.visited.size >= this.stopCount) {
				this.spawnShootingStar();
				this.callbacks.onFinaleSelect();
			} else {
				this.callbacks.onFinaleLocked(this.visited.size, this.stopCount);
			}
		} else {
			this.pulseLamp(index);
			this.callbacks.onSelectStop(index);
		}
	};

	private pulseLamp(index: number) {
		const sprite = this.lampGlowSprites[index];
		if (!sprite) return;
		const baseScale = (sprite.userData.baseScale as number | undefined) ?? sprite.scale.x;
		const peakScale = baseScale * 1.6;
		const duration = 320;
		const startTime = performance.now();
		const step = () => {
			const t = Math.min((performance.now() - startTime) / duration, 1);
			const eased = t < 0.5 ? t * 2 : 2 - t * 2;
			const scale = baseScale + (peakScale - baseScale) * eased;
			sprite.scale.set(scale, scale, 1);
			if (t < 1) {
				requestAnimationFrame(step);
			} else {
				sprite.scale.set(baseScale, baseScale, 1);
			}
		};
		requestAnimationFrame(step);
	}

	private scheduleAmbientShootingStar() {
		const delay = THREE.MathUtils.randFloat(14000, 26000);
		this.ambientStarTimer = window.setTimeout(() => {
			if (this.disposed) return;
			if (!document.hidden) this.spawnShootingStar();
			this.scheduleAmbientShootingStar();
		}, delay);
	}

	private spawnShootingStar() {
		const texture = createGlowTexture();
		const material = new THREE.SpriteMaterial({
			map: texture,
			color: 0xfff6e0,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			opacity: 1,
		});
		const sprite = new THREE.Sprite(material);
		sprite.scale.set(1.4, 1.4, 1);

		const targetZ = this.controls.target.z;
		const start = new THREE.Vector3(-26, 32, targetZ - 22);
		const end = new THREE.Vector3(26, 13, targetZ + 16);
		sprite.position.copy(start);
		this.scene.add(sprite);

		const duration = 1400;
		const startTime = performance.now();
		const step = () => {
			const progress = Math.min((performance.now() - startTime) / duration, 1);
			sprite.position.lerpVectors(start, end, progress);
			material.opacity = progress < 0.85 ? 1 : 1 - (progress - 0.85) / 0.15;
			if (progress < 1) {
				requestAnimationFrame(step);
			} else {
				this.scene.remove(sprite);
				material.dispose();
				texture.dispose();
			}
		};
		requestAnimationFrame(step);
	}

	// Camera pose for a stop: a few steps back along the path and slightly
	// to the side, looking at the lamp, so each memory is framed on arrival.
	private viewFor(point: THREE.Vector3, t: number, back: number): { position: THREE.Vector3; target: THREE.Vector3 } {
		const curve = this.pathCurve;
		const tangent = curve ? curve.getTangentAt(THREE.MathUtils.clamp(t, 0, 1)) : new THREE.Vector3(0, 0, -1);
		tangent.y = 0;
		tangent.normalize();
		const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
		const target = point.clone().setY(1.3).addScaledVector(tangent, 0.8);
		const position = point.clone().addScaledVector(tangent, -back).addScaledVector(side, 1.6).setY(2.4);
		return { position, target };
	}

	private flyTo(position: THREE.Vector3, target: THREE.Vector3, duration = 2200): Promise<void> {
		this.flight?.cancel();
		const fromPosition = this.camera.position.clone();
		const fromTarget = this.controls.target.clone();
		const start = performance.now();
		this.controls.enabled = false;

		return new Promise((resolve) => {
			let cancelled = false;
			this.flight = {
				cancel: () => {
					cancelled = true;
					resolve();
				},
			};
			const step = () => {
				if (cancelled || this.disposed) return;
				const t = Math.min((performance.now() - start) / duration, 1);
				const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
				this.camera.position.lerpVectors(fromPosition, position, eased);
				this.controls.target.lerpVectors(fromTarget, target, eased);
				if (t < 1) {
					requestAnimationFrame(step);
				} else {
					this.flight = null;
					resolve();
				}
			};
			requestAnimationFrame(step);
		});
	}

	public flyToStop(index: number): Promise<void> {
		const point = this.stopPositions[index];
		if (!point) return Promise.resolve();
		const t = index / Math.max(this.stopPositions.length, 1);
		const { position, target } = this.viewFor(point, t, 4.8);
		return this.flyTo(position, target).then(() => this.pulseLamp(index));
	}

	public flyToFinale(): Promise<void> {
		const { position, target } = this.viewFor(this.finalePosition, 1, 6);
		return this.flyTo(position, target, 2600).then(() => this.spawnShootingStar());
	}

	// Hands the camera back to the viewer once the guided walk is over.
	public enableFreeLook() {
		this.flight?.cancel();
		this.controls.enabled = true;
	}

	public markVisited(index: number) {
		if (this.visited.has(index)) return;
		this.visited.add(index);
		this.labels.find((l) => l.index === index)?.el.classList.add("is-visited");
		const ratio = this.visited.size / this.stopCount;

		this.segmentMaterials.forEach((material, segIndex) => {
			const lit = this.visited.has(segIndex) || this.visited.has(segIndex + 1);
			material.emissive.set(lit ? 0xffb454 : 0x1a1206);
			material.emissiveIntensity = lit ? 0.7 : 0.2;
			material.color.set(lit ? 0xffe0b0 : 0xffffff);
		});

		const glowMaterial = this.lampGlowMaterials[index];
		if (glowMaterial) glowMaterial.opacity = 1;
		const light = this.lampLights[index];
		if (light) light.intensity = 1.9;

		if (this.finaleGlow && this.finaleLight) {
			(this.finaleGlow.material as THREE.SpriteMaterial).opacity = 0.35 + ratio * 0.55;
			this.finaleLight.intensity = 0.6 + ratio * 1.4;
		}

		if (this.visited.size === this.stopCount) {
			this.callbacks.onFinaleReady();
		}
	}

	public dispose() {
		this.disposed = true;
		this.timer.dispose();
		if (this.ambientStarTimer !== null) window.clearTimeout(this.ambientStarTimer);
		this.renderer.setAnimationLoop(null);
		window.removeEventListener("resize", this.resize);
		window.removeEventListener("orientationchange", this.resize);
		document.removeEventListener("visibilitychange", this.handleVisibility);
		this.canvas.removeEventListener("pointerdown", this.onPointerDown);
		this.canvas.removeEventListener("pointerup", this.onPointerUp);
		this.renderer.dispose();
		this.labelLayer.remove();
	}
}
