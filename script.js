import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

window.addEventListener('error', (e) => {
    console.error("Script Error:", e.message, e.filename, e.lineno);
});

// --- CONFIGURATION ---
const CONFIG = {
    fieldRadius: 220,
    instanceCount: 25000,
    heartScale: 85,
    colors: {
        bg: 0xfff0f5,
        fog: 0xfff0f5,
        tint: 0xffffff,
        whiteRoseTint: 0xffffff,
    }
};

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.bg);
scene.fog = new THREE.FogExp2(CONFIG.colors.fog, 0.0035);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 160, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(CONFIG.colors.bg);
if (container) {
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 5;
controls.maxDistance = 600;
controls.enabled = false;

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffeedd, 0.8);
sunLight.position.set(50, 100, 50);
sunLight.castShadow = true;
scene.add(sunLight);

// --- TEXTURES ---
const manager = new THREE.LoadingManager();
manager.onLoad = function () {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        // Optional: remove after transition
        setTimeout(() => loadingScreen.style.display = 'none', 1000);
    }
};

const texLoader = new THREE.TextureLoader(manager);
const texRed = texLoader.load('red.png');
const texWhite = texLoader.load('white.png');
texRed.colorSpace = THREE.SRGBColorSpace;
texWhite.colorSpace = THREE.SRGBColorSpace;

const texParticle = createGlowTexture();
function createGlowTexture() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255, 255, 230, 1)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    } catch (e) { return null; }
}

// --- PRELOAD ASSETS ---
let preloadedRose = null;
let preloadedFont = null;

const gltfLoader = new GLTFLoader(manager);
gltfLoader.load('rose.glb', (gltf) => {
    preloadedRose = gltf.scene;
});

const fontLoader = new FontLoader(manager);
fontLoader.load('https://unpkg.com/three@0.160.0/examples/fonts/droid/droid_sans_bold.typeface.json', (font) => {
    preloadedFont = font;
});

// --- FIELD ---
const instances = [];
let redMesh, whiteMesh;
const dummy = new THREE.Object3D();

const roseGeo = new THREE.PlaneGeometry(2.0, 2.0);
roseGeo.rotateX(-Math.PI / 2);

const matRed = new THREE.MeshBasicMaterial({
    map: texRed, color: CONFIG.colors.tint, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: false
});
const matWhite = new THREE.MeshBasicMaterial({
    map: texWhite, color: CONFIG.colors.whiteRoseTint, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: false
});

redMesh = new THREE.InstancedMesh(roseGeo, matRed, CONFIG.instanceCount);
whiteMesh = new THREE.InstancedMesh(roseGeo, matWhite, CONFIG.instanceCount);
redMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
whiteMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(redMesh); scene.add(whiteMesh);

let redC = 0, whiteC = 0;
for (let i = 0; i < CONFIG.instanceCount; i++) {
    const r = Math.sqrt(Math.random()) * CONFIG.fieldRadius;
    const theta = Math.random() * 2 * Math.PI;
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    const nx = (x / CONFIG.heartScale) * 1.5; const ny = -(z / CONFIG.heartScale) * 1.5;
    const val = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * Math.pow(ny, 3);
    const isHeart = val <= 0;
    const ry = Math.random() * Math.PI * 2;
    const scale = 1.5 + Math.random() * 1.0;

    dummy.position.set(x, 0.1, z);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();

    if (isHeart) { if (redC < CONFIG.instanceCount) redMesh.setMatrixAt(redC++, dummy.matrix); }
    else { if (whiteC < CONFIG.instanceCount) whiteMesh.setMatrixAt(whiteC++, dummy.matrix); }

    instances.push({ x: x, z: z, ry: ry, baseScale: scale, currentScale: scale, isHeart: isHeart, id: isHeart ? redC - 1 : whiteC - 1, mesh: isHeart ? redMesh : whiteMesh });
}
redMesh.count = redC; whiteMesh.count = whiteC;
redMesh.instanceMatrix.needsUpdate = true; whiteMesh.instanceMatrix.needsUpdate = true;

// --- HOVER PARTICLES ---
const hoverCount = 600;
const hoverGeo = new THREE.BufferGeometry();
const hoverPos = new Float32Array(hoverCount * 3);
const hoverCol = new Float32Array(hoverCount * 3);
hoverGeo.setAttribute('position', new THREE.Float32BufferAttribute(hoverPos, 3));
hoverGeo.setAttribute('color', new THREE.Float32BufferAttribute(hoverCol, 3));
const hoverMat = new THREE.PointsMaterial({
    size: 2.5, map: texParticle, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true
});
const hoverSystem = new THREE.Points(hoverGeo, hoverMat);
scene.add(hoverSystem);

const hoverData = [];
for (let i = 0; i < hoverCount; i++) {
    hoverData.push({ active: false, life: 0, vx: 0, vy: 0, vz: 0 });
    hoverPos[i * 3] = 0; hoverPos[i * 3 + 1] = -500; hoverPos[i * 3 + 2] = 0;
}

function spawnHoverParticle(x, y, z, isHeart) {
    for (let i = 0; i < hoverCount; i++) {
        if (!hoverData[i].active) {
            hoverData[i].active = true;
            hoverData[i].life = 1.0;
            hoverPos[i * 3] = x + (Math.random() - 0.5) * 1.0;
            hoverPos[i * 3 + 1] = y + Math.random();
            hoverPos[i * 3 + 2] = z + (Math.random() - 0.5) * 1.0;

            if (isHeart) {
                hoverCol[i * 3] = 1.0; hoverCol[i * 3 + 1] = 0.2; hoverCol[i * 3 + 2] = 0.5; // Red
            } else {
                hoverCol[i * 3] = 1.0; hoverCol[i * 3 + 1] = 0.9; hoverCol[i * 3 + 2] = 0.5; // Gold
            }

            hoverData[i].vx = (Math.random() - 0.5) * 0.1;
            hoverData[i].vy = Math.random() * 0.15 + 0.1; // Float up
            hoverData[i].vz = (Math.random() - 0.5) * 0.1;
            return;
        }
    }
}

// --- PETALS ---
const petalCount = 800;
let petalSystemRed, petalSystemWhite;
const petalDummy = new THREE.Object3D();
const petalGeo = new THREE.PlaneGeometry(0.8, 0.8); petalGeo.rotateX(-Math.PI / 2);
const matPetalRed = new THREE.MeshBasicMaterial({ map: texRed, color: 0xffffff, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
const matPetalWhite = new THREE.MeshBasicMaterial({ map: texWhite, color: 0xffffff, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
petalSystemRed = new THREE.InstancedMesh(petalGeo, matPetalRed, Math.ceil(petalCount / 2));
petalSystemWhite = new THREE.InstancedMesh(petalGeo, matPetalWhite, Math.ceil(petalCount / 2));
scene.add(petalSystemRed); scene.add(petalSystemWhite);
const petals = [];
for (let i = 0; i < petalCount; i++) {
    petals.push({
        x: (Math.random() - 0.5) * 300, y: Math.random() * 100 + 10, z: (Math.random() - 0.5) * 300,
        vy: Math.random() * 0.2 + 0.1, rx: Math.random() * Math.PI, rz: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.1, isRed: i % 2 === 0, idx: Math.floor(i / 2)
    });
}

// --- FIREFLIES ---
let fireflySystem;
function createGlobalFireflies() {
    const fwCount = 1500;
    const fwGeo = new THREE.BufferGeometry();
    const fwPos = []; const fwAnim = [];
    for (let i = 0; i < fwCount; i++) { fwPos.push((Math.random() - 0.5) * 400, Math.random() * 150, (Math.random() - 0.5) * 400); fwAnim.push(Math.random() * Math.PI * 2); }
    fwGeo.setAttribute('position', new THREE.Float32BufferAttribute(fwPos, 3));
    const fwMat = new THREE.PointsMaterial({ color: 0xffff88, size: 1.5, map: texParticle, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    fireflySystem = new THREE.Points(fwGeo, fwMat); fireflySystem.userData = { phases: fwAnim }; scene.add(fireflySystem);
}
createGlobalFireflies();

// --- INTERACTION ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-999, -999);
const clock = new THREE.Clock();
let finalRoseMesh = null;

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    const delta = clock.getDelta();

    // Wind Interaction Calc
    raycaster.setFromCamera(mouse, camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, intersectPoint);
    const hasIntersect = (intersectPoint.lengthSq() < (CONFIG.fieldRadius * CONFIG.fieldRadius * 2));

    // Update Field
    for (let i = 0; i < instances.length; i++) {
        const data = instances[i];

        // Ambient Wind
        const windX = Math.sin(time + data.x * 0.4) * 0.1;
        const windZ = Math.cos(time + data.z * 0.4) * 0.1;

        let targetScale = data.baseScale;
        if (hasIntersect) {
            const dx = data.x - intersectPoint.x;
            const dz = data.z - intersectPoint.z;
            const distSq = dx * dx + dz * dz;

            // SMALLER RIPPLE RADIUS (~25 units -> 625)
            if (distSq < 625) {
                targetScale = data.baseScale * 1.3;

                // Spawn Particle Chance (Interactive Flow)
                // If this flower is actively swelling/in zone, chance to emit
                if (Math.random() < 0.05) {
                    spawnHoverParticle(data.x, 2.0, data.z, data.isHeart);
                }
            }
        }

        data.currentScale = data.currentScale * 0.9 + targetScale * 0.1;

        dummy.position.set(data.x, 0.1, data.z);
        dummy.scale.set(data.currentScale, data.currentScale, data.currentScale);
        dummy.rotation.set(windZ, data.ry + time * 0.05, windX);
        dummy.updateMatrix();
        data.mesh.setMatrixAt(data.id, dummy.matrix);
    }
    if (redMesh) redMesh.instanceMatrix.needsUpdate = true;
    if (whiteMesh) whiteMesh.instanceMatrix.needsUpdate = true;

    // Update Hover Particles
    const hp = hoverSystem.geometry.attributes.position.array;
    const hc = hoverSystem.geometry.attributes.color.array;

    for (let i = 0; i < hoverCount; i++) {
        if (hoverData[i].active) {
            hoverData[i].life -= 0.02; // Faster fade
            if (hoverData[i].life <= 0) {
                hoverData[i].active = false;
                hp[i * 3 + 1] = -500;
            } else {
                hp[i * 3] += hoverData[i].vx;
                hp[i * 3 + 1] += hoverData[i].vy;
                hp[i * 3 + 2] += hoverData[i].vz;
            }
        }
    }
    hoverSystem.geometry.attributes.position.needsUpdate = true;

    // Petals
    for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.y -= p.vy; p.rx += p.rotSpeed; p.rz += p.rotSpeed;
        if (p.y < 0) { p.y = 100; p.x = (Math.random() - 0.5) * 300; p.z = (Math.random() - 0.5) * 300; }
        petalDummy.position.set(p.x, p.y, p.z);
        petalDummy.rotation.set(p.rx, 0, p.rz);
        petalDummy.updateMatrix();
        if (p.isRed) petalSystemRed.setMatrixAt(p.idx, petalDummy.matrix);
        else petalSystemWhite.setMatrixAt(p.idx, petalDummy.matrix);
    }
    petalSystemRed.instanceMatrix.needsUpdate = true; petalSystemWhite.instanceMatrix.needsUpdate = true;

    // Fireflies
    const fp = fireflySystem.geometry.attributes.position.array;
    const phases = fireflySystem.userData.phases;
    for (let i = 0; i < phases.length; i++) {
        fp[i * 3] += Math.sin(time * 0.5 + phases[i]) * 0.05;
        fp[i * 3 + 1] += Math.cos(time * 0.3 + phases[i]) * 0.02;
        fp[i * 3 + 2] += Math.sin(time * 0.5 + phases[i]) * 0.05;
    }
    fireflySystem.geometry.attributes.position.needsUpdate = true;

    if (finalRoseMesh) {
        finalRoseMesh.rotation.z = -mouse.x * 0.15;
        finalRoseMesh.rotation.x = 0.5 + (mouse.y * 0.15);
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- UI HOOKS ---
window.camEnterField = () => {
    controls.enabled = true;
    gsap.to(camera.position, { y: 60, z: 50, duration: 3, ease: "power2.out" });
};

window.triggerFinalReveal = () => {
    gsap.to(scene.fog, { density: 0.01, duration: 4 });
    gsap.to(camera.position, { x: 0, y: 2, z: 20, duration: 5, ease: "power2.inOut", onUpdate: () => camera.lookAt(0, 5, 0), onComplete: spawnFinalRose });
};

function spawnFinalRose() {
    gsap.to(redMesh.material, { opacity: 0.05, duration: 2 });
    gsap.to(whiteMesh.material, { opacity: 0.05, duration: 2 });
    load3DText();

    // Use Preloaded Model
    if (preloadedRose) {
        setupFinalModel(preloadedRose.clone()); // Clone to be safe, though used once
    } else {
        // Fallback if somehow not loaded (though manager prevents this)
        const loader = new GLTFLoader();
        loader.load('rose.glb', (gltf) => { setupFinalModel(gltf.scene); });
    }
}

function load3DText() {
    if (preloadedFont) {
        create3DText(preloadedFont);
    } else {
        const loader = new FontLoader();
        loader.load('https://unpkg.com/three@0.160.0/examples/fonts/droid/droid_sans_bold.typeface.json', create3DText);
    }
}

function create3DText(font) {
    const geometry = new TextGeometry('ONLY FOR YOU', { font: font, size: 1.5, height: 0.2, curveSegments: 12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.02, bevelOffset: 0, bevelSegments: 5 });
    geometry.computeBoundingBox();
    const xOffset = -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
    geometry.translate(xOffset, 6.5, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0xe91e63, roughness: 0.4, metalness: 0.3, emissive: 0x880033, emissiveIntensity: 0.4 });
    const textMesh = new THREE.Mesh(geometry, material);
    textMesh.scale.set(0, 0, 0); textMesh.name = "FinalText";
    scene.add(textMesh);
    gsap.to(textMesh.scale, { x: 1, y: 1, z: 1, delay: 0.5, duration: 2, ease: "back.out(1.7)" });
}

function setupFinalModel(model) {
    model.scale.set(0, 0, 0); model.position.y = -5; model.rotation.set(0.5, 0, 0);
    scene.add(model); finalRoseMesh = model;
    model.traverse((child) => { if (child.isMesh && child.material) { child.material.emissive = new THREE.Color(0x550000); child.material.emissiveIntensity = 1.0; child.material.roughness = 0.2; child.material.metalness = 0.1; child.material.needsUpdate = true; } });
    gsap.to(model.scale, { x: 8.0, y: 8.0, z: 8.0, duration: 3, ease: "elastic.out(1, 0.5)" });
    gsap.to(model.rotation, { y: 0.2, duration: 4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to(model.position, { y: -3.5, duration: 2, yoyo: true, repeat: -1, ease: "sine.inOut" });
    const spot = new THREE.SpotLight(0xff0055, 30, 50, 0.5, 0.5, 1); spot.position.set(0, 15, 5); spot.target = model; scene.add(spot);
    const backLight = new THREE.PointLight(0xffaa00, 5, 20); backLight.position.set(0, 0, -5); scene.add(backLight);
    setTimeout(createTakeButton, 2000);
}

function createTakeButton() {
    const btn = document.createElement('button');
    btn.innerHTML = 'Take It <i class="fa-solid fa-hand-holding-heart"></i>';
    btn.className = "take-btn";
    document.body.appendChild(btn);
    requestAnimationFrame(() => { btn.style.opacity = '1'; });

    // REVISED CLICK HANDLER
    btn.onclick = () => {
        // 1. Fade out button
        btn.style.opacity = '0';
        setTimeout(() => btn.remove(), 500);

        // 2. Hide 3D Rose & Text
        if (finalRoseMesh) gsap.to(finalRoseMesh.scale, { x: 0, y: 0, z: 0, duration: 1, ease: "back.in(1.5)" });
        const textObj = scene.getObjectByName("FinalText");
        if (textObj) gsap.to(textObj.scale, { x: 0, y: 0, z: 0, duration: 1 });

        // 3. RESTORE UI CARD
        setTimeout(() => {
            const card = document.getElementById('story-container');

            // Un-minimize if needed
            if (card.classList.contains('minimized')) {
                // Manually trigger the toggle function logic or just class manipulation
                // Since toggleMinimize is on window, we can call it or just manipulate classes
                card.classList.remove('minimized');

                // Fix icon state if we can access it, otherwise it's fine
                const btnIcon = document.querySelector('#minimize-btn i');
                if (btnIcon) {
                    btnIcon.classList.remove('fa-plus');
                    btnIcon.classList.add('fa-minus');
                }
            }

            // Switch to Final Msg Section
            // Hide all sections first to be safe
            document.querySelectorAll('.section-content').forEach(el => {
                el.classList.remove('active');
                el.classList.add('hidden');
            });

            const finalSection = document.getElementById('final-msg');
            finalSection.classList.remove('hidden');
            finalSection.classList.add('active');

        }, 1000);
    };
}
