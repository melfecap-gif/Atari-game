// Atari Grand Prix - Pseudo 3D Racing Logic
// Developed for Atari Game Repository

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('scoreValue');
const speedBar = document.getElementById('speedBar');
const carIcon = document.getElementById('carIcon');
const messageBoard = document.getElementById('messageBoard');

// --- Configuration ---
const width = 1024;
const height = 768;
const roadWidth = 2000;
const segmentLength = 200;
const rumbleLength = 3;
const lanes = 3;
const fieldOfView = 100;
const cameraHeight = 1000;
const cameraDepth = 1 / Math.tan((fieldOfView / 2) * Math.PI / 180);
const drawDistance = 300;

const playerMaxSpeed = segmentLength / (1/60) * 0.8;
const accel = playerMaxSpeed / 5;
const breaking = -playerMaxSpeed / 2;
const decel = -playerMaxSpeed / 10;
const offRoadDecel = -playerMaxSpeed / 2;
const offRoadLimit = playerMaxSpeed / 4;

// Colors (Atari Style)
const Colors = {
    SKY:  '#000080',
    TREE: '#006400',
    FOG:  '#000000',
    LIGHT:  { road: '#333', grass: '#004d00', rumble: '#fff' },
    DARK:   { road: '#222', grass: '#004000', rumble: '#000' }
};

// --- State ---
let cameraZ = 0;
let playerX = 0;
let playerZ = 0;
let speed = 0;
let totalTime = 0;
let gameStarted = false;
let segments = [];
let cars = [];
let keys = {};

// Assets
const background = new Image();
background.src = './assets/background.png'; // Reusing the one I have or the new one if it worked

// --- Initialization ---
function resetRoad() {
    segments = [];
    for (let n = 0; n < 5000; n++) {
        segments.push({
            p1: { world: { z: n * segmentLength }, screen: { x: 0, y: 0, w: 0 } },
            p2: { world: { z: (n + 1) * segmentLength }, screen: { x: 0, y: 0, w: 0 } },
            color: Math.floor(n / rumbleLength) % 2 ? Colors.LIGHT : Colors.DARK
        });
    }
    segments.forEach((s, i) => s.index = i);
}

function resetCars() {
    cars = [];
    const carColors = ['#ff0', '#f0f', '#0ff', '#f00', '#00f'];
    for (let n = 0; n < 200; n++) {
        const offset = Math.random() * 2 - 1;
        const z = segmentLength * (10 + n * 40 + Math.random() * 20);
        cars.push({
            offset: offset,
            z: z,
            color: carColors[n % carColors.length],
            speed: playerMaxSpeed * (0.3 + Math.random() * 0.2)
        });
    }
}

// --- Projection ---
function project(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
    p.camera = {
        x: (p.world.x || 0) - cameraX,
        y: (p.world.y || 0) - cameraY,
        z: (p.world.z || 0) - cameraZ
    };
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
    p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
    p.screen.w = Math.round(p.screen.scale * roadWidth * width / 2);
}

// --- Rendering Helpers ---
function drawPolygon(ctx, x1, y1, w1, x2, y2, w2, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.lineTo(x2 - w2, y2);
    ctx.lineTo(x2 + w2, y2);
    ctx.lineTo(x1 + w1, y1);
    ctx.fill();
}

function drawAtariCar(ctx, x, y, scale, color) {
    const w = 200 * scale;
    const h = 100 * scale;
    const tireW = 40 * scale;
    const tireH = 60 * scale;

    ctx.fillStyle = '#000'; // Tires
    ctx.fillRect(x - w/2 - tireW/2, y - h/2, tireW, tireH);
    ctx.fillRect(x + w/2 - tireW/2, y - h/2, tireW, tireH);
    ctx.fillRect(x - w/2 - tireW/2, y + h/2 - tireH, tireW, tireH);
    ctx.fillRect(x + w/2 - tireW/2, y + h/2 - tireH, tireW, tireH);

    ctx.fillStyle = color; // Body
    ctx.fillRect(x - w/4, y - h/2, w/2, h);
    
    ctx.fillStyle = '#ccc'; // Cockpit
    ctx.fillRect(x - w/10, y - h/4, w/5, h/4);
}

// --- Main Loops ---
function update(dt) {
    if (!gameStarted) {
        if (keys['Enter']) {
            gameStarted = true;
            messageBoard.style.display = 'none';
        }
        return;
    }

    totalTime += dt;
    
    // Player movement
    const speedPercent = speed / playerMaxSpeed;
    const dx = dt * 2 * speedPercent;

    if (keys['ArrowLeft'] || keys['a'] || keys['A']) playerX = playerX - dx;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) playerX = playerX + dx;
    playerX = Math.max(-2.5, Math.min(2.5, playerX));

    // Acceleration / Braking
    if (keys['ArrowUp'] || keys['w'] || keys['W']) speed = accelerate(speed, accel, dt);
    else if (keys['ArrowDown'] || keys['s'] || keys['S']) speed = accelerate(speed, breaking, dt);
    else speed = accelerate(speed, decel, dt);

    // Off-road penalty
    if ((playerX < -1) || (playerX > 1)) {
        if (speed > offRoadLimit)
            speed = accelerate(speed, offRoadDecel, dt);
    }

    // Update cars
    cars.forEach(car => {
        car.z = car.z + dt * car.speed;
        if (car.z > playerZ + 200 * segmentLength) car.z -= 5000 * segmentLength;
        else if (car.z < playerZ - 200 * segmentLength) car.z += 5000 * segmentLength;
        
        // COLLISION
        if (Math.abs(playerX - car.offset) < 0.5 && Math.abs(playerZ - car.z) < 250) {
            speed = car.speed / 2;
            playerZ = car.z - 251;
        }
    });

    playerZ = (playerZ + dt * speed);
    cameraZ = playerZ - cameraHeight;

    // HUD Update
    const currentSpeedPercent = (speed / playerMaxSpeed) * 100;
    speedBar.style.width = currentSpeedPercent + '%';
    carIcon.style.left = currentSpeedPercent + '%';
    scoreEl.innerText = Math.floor(playerZ / 100).toString().padStart(5, '0');
}

function accelerate(v, accel, dt) { return Math.max(0, Math.min(playerMaxSpeed, v + accel * dt)); }

function findSegment(z) {
    return segments[Math.floor(z / segmentLength) % segments.length];
}

function render() {
    // Parallax Background
    const bgOffset = (playerZ / segmentLength) * 0.1;
    ctx.drawImage(background, -((bgOffset % 1) * width), 0, width, height / 2);
    ctx.drawImage(background, width - ((bgOffset % 1) * width), 0, width, height / 2);

    const baseSegment = findSegment(cameraZ);
    let maxy = height;

    for (let n = 0; n < drawDistance; n++) {
        const segment = segments[(baseSegment.index + n) % segments.length];
        
        project(segment.p1, playerX * roadWidth, cameraHeight, cameraZ, cameraDepth, width, height, roadWidth);
        project(segment.p2, playerX * roadWidth, cameraHeight, cameraZ, cameraDepth, width, height, roadWidth);

        if (segment.p1.camera.z <= cameraDepth || segment.p2.screen.y >= maxy) continue;

        const p1 = segment.p1.screen;
        const p2 = segment.p2.screen;

        // Draw Grass
        ctx.fillStyle = segment.color.grass;
        ctx.fillRect(0, p2.y, width, p1.y - p2.y);

        // Draw Rumble
        drawPolygon(ctx, p1.x, p1.y, p1.w * 1.05, p2.x, p2.y, p2.w * 1.05, segment.color.rumble);
        // Draw Road
        drawPolygon(ctx, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, segment.color.road);

        maxy = p2.y;
    }

    // Render Sprites
    for (let n = drawDistance - 1; n > 0; n--) {
        const segment = segments[(baseSegment.index + n) % segments.length];
        cars.forEach(car => {
            if (findSegment(car.z) === segment) {
                const scale = segment.p1.screen.scale;
                const destX = segment.p1.screen.x + (scale * car.offset * roadWidth * width / 2);
                const destY = segment.p1.screen.y;
                drawAtariCar(ctx, destX, destY, scale * 5, car.color);
            }
        });
    }

    // Render Player
    drawAtariCar(ctx, width / 2, height - 100, 1.5, '#eee');
}

// --- Game Initialization ---
function init() {
    canvas.width = width;
    canvas.height = height;
    
    resetRoad();
    resetCars();

    window.addEventListener('keydown', e => keys[e.key] = true);
    window.addEventListener('keyup', e => keys[e.key] = false);

    let last = Date.now();
    function frame() {
        const now = Date.now();
        const dt = Math.min(1, (now - last) / 1000);
        update(dt);
        render();
        last = now;
        requestAnimationFrame(frame);
    }
    frame();
}

init();
