// Retro GP - Pseudo 3D Racing Logic
// Developed for Atari Game Repository

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const speedEl = document.getElementById('speedValue');
const timeEl = document.getElementById('timeValue');
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
const fogDensity = 5;

const playerMaxSpeed = segmentLength / (1/60) * 0.8; // Approx max speed
const accel = playerMaxSpeed / 5;
const breaking = -playerMaxSpeed / 2;
const decel = -playerMaxSpeed / 10;
const offRoadDecel = -playerMaxSpeed / 2;
const offRoadLimit = playerMaxSpeed / 4;

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
background.src = './assets/background.png';
const playerSprite = new Image();
playerSprite.src = './assets/player.png';
const obstacleSprite = new Image();
obstacleSprite.src = './assets/obstacle.png';

// --- Initialization ---
function resetRoad() {
    segments = [];
    for (let n = 0; n < 5000; n++) {
        segments.push({
            p1: { world: { z: n * segmentLength }, screen: { x: 0, y: 0, w: 0 } },
            p2: { world: { z: (n + 1) * segmentLength }, screen: { x: 0, y: 0, w: 0 } },
            color: Math.floor(n / rumbleLength) % 2 ? 
                { road: '#222', grass: '#050510', rumble: '#ff00ff', lane: '#ff00ff' } : 
                { road: '#333', grass: '#0a0a20', rumble: '#00ffff', lane: '#00ffff' }
        });
    }
}

function resetCars() {
    cars = [];
    for (let n = 0; n < 200; n++) {
        const offset = Math.random() * 2 - 1;
        const z = segmentLength * (10 + n * 40 + Math.random() * 20);
        cars.push({
            offset: offset,
            z: z,
            sprite: obstacleSprite,
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

function drawSprite(ctx, width, height, resolution, roadWidth, sprite, scale, destX, destY, offsetX, offsetY, clipY) {
    const destW = (sprite.width * scale * width / 2) * (roadWidth / 800);
    const destH = (sprite.height * scale * width / 2) * (roadWidth / 800);

    destX = destX + (destW * (offsetX || 0));
    destY = destY + (destH * (offsetY || 0));

    const clipH = clipY ? Math.max(0, destY + destH - clipY) : 0;
    if (clipH < destH) {
        ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height - (sprite.width * clipH / destW), destX, destY, destW, destH - clipH);
    }
}

// --- Main Loops ---
function update(dt) {
    if (!gameStarted) {
        if (keys['Enter'] || keys[' ']) {
            gameStarted = true;
            messageBoard.style.display = 'none';
        }
        return;
    }

    totalTime += dt;
    
    // Player movement
    const playerSegment = findSegment(playerZ);
    const speedPercent = speed / playerMaxSpeed;
    const dx = dt * 2 * speedPercent;

    if (keys['ArrowLeft'] || keys['a']) playerX = playerX - dx;
    if (keys['ArrowRight'] || keys['d']) playerX = playerX + dx;

    // Movement limits (keep player on screen roughly)
    playerX = Math.max(-2.5, Math.min(2.5, playerX));

    // Acceleration / Braking
    if (keys['ArrowUp'] || keys['w']) speed = accelerate(speed, accel, dt);
    else if (keys['ArrowDown'] || keys['s']) speed = accelerate(speed, breaking, dt);
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
        
        // SIMPLE COLLISION
        if (Math.abs(playerX - car.offset) < 0.3 && Math.abs(playerZ - car.z) < 200) {
            speed = car.speed / 2;
            playerZ = car.z - 201; // Move back slightly
        }
    });

    playerZ = (playerZ + dt * speed);
    cameraZ = playerZ - cameraHeight;

    // HUD Update
    speedEl.innerText = Math.round(speed / 10);
    const m = Math.floor(totalTime / 60);
    const s = Math.floor(totalTime % 60);
    const ms = Math.floor((totalTime % 1) * 100);
    timeEl.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
}

function accelerate(v, accel, dt) { return Math.max(0, Math.min(playerMaxSpeed, v + accel * dt)); }

function findSegment(z) {
    return segments[Math.floor(z / segmentLength) % segments.length];
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Parallax Background
    const bgOffset = (playerZ / segmentLength) * 0.1;
    ctx.drawImage(background, -((bgOffset % 1) * canvas.width), 0, canvas.width, canvas.height);
    ctx.drawImage(background, canvas.width - ((bgOffset % 1) * canvas.width), 0, canvas.width, canvas.height);

    const baseSegment = findSegment(cameraZ);
    let maxy = height;

    for (let n = 0; n < drawDistance; n++) {
        const segment = segments[(baseSegment.index + n) % segments.length];
        segment.index = (baseSegment.index + n) % segments.length;
        
        project(segment.p1, playerX * roadWidth, cameraHeight, cameraZ, cameraDepth, width, height, roadWidth);
        project(segment.p2, playerX * roadWidth, cameraHeight, cameraZ, cameraDepth, width, height, roadWidth);

        if (segment.p1.camera.z <= cameraDepth || segment.p2.screen.y >= maxy) continue;

        const p1 = segment.p1.screen;
        const p2 = segment.p2.screen;

        // Draw Grass
        ctx.fillStyle = segment.color.grass;
        ctx.fillRect(0, p2.y, width, p1.y - p2.y);

        // Draw Rumble Strip
        drawPolygon(ctx, p1.x, p1.y, p1.w * 1.1, p2.x, p2.y, p2.w * 1.1, segment.color.rumble);
        // Draw Road
        drawPolygon(ctx, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, segment.color.road);

        // Draw Lane Markers
        if (segment.color.lane) {
            let laneW = p1.w / 50;
            let lanew1 = p1.w / lanes;
            let lanew2 = p2.w / lanes;
            for (let l = 1; l < lanes; l++) {
                drawPolygon(ctx, p1.x - lanew1 * (l - 1.5), p1.y, laneW, p2.x - lanew2 * (l - 1.5), p2.y, laneW, segment.color.lane);
            }
        }

        maxy = p2.y;
    }

    // Render Sprites (painter's algorithm - usually done back to front)
    for (let n = drawDistance - 1; n > 0; n--) {
        const segment = segments[(baseSegment.index + n) % segments.length];
        
        // Draw Cars on this segment
        cars.forEach(car => {
            if (findSegment(car.z) === segment) {
                const sprite = car.sprite;
                const scale = segment.p1.screen.scale;
                const destX = segment.p1.screen.x + (scale * car.offset * roadWidth * width / 2);
                const destY = segment.p1.screen.y;
                drawSprite(ctx, width, height, 1, roadWidth, sprite, scale, destX, destY, -0.5, -1);
            }
        });
    }

    // Render Player
    const playerScale = 0.3; // Fixed scale for player car for better visibility
    const playerDestX = width / 2;
    const playerDestY = height - 20;
    if (playerSprite.complete) {
        drawSprite(ctx, width, height, 1, roadWidth, playerSprite, playerScale, playerDestX, playerDestY, -0.5, -1);
    }
}

// --- Game Initialization ---
function init() {
    canvas.width = width;
    canvas.height = height;
    
    resetRoad();
    // Assign index to segments for easier loop
    segments.forEach((s, i) => s.index = i);
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

background.onload = init;
