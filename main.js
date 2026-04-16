/**
 * Retro GP - Pseudo-3D Racing Engine
 * Inspired by Atari Grand Prix & Outrun
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const speedEl = document.getElementById('speed');
const timeEl = document.getElementById('time');
const finalTimeEl = document.getElementById('final-time');

// Configuration
const width = 800;
const height = 600;
canvas.width = width;
canvas.height = height;

const roadWidth = 2000;
const segmentLength = 200;
const rumbleLength = 3;
const lanes = 3;
const fieldOfView = 100;
const cameraHeight = 1000;
const cameraDepth = 1 / Math.tan((fieldOfView / 2) * Math.PI / 180);
const drawDistance = 300;
const fogDensity = 5;

// Game State
let playerX = 0; // -1 to 1
let playerZ = 0;
let cameraZ = 0;
let speed = 0;
const maxSpeed = 12000;
const accel = maxSpeed / 5;
const breaking = -maxSpeed / 2;
const decel = -maxSpeed / 10;
const offRoadDecel = -maxSpeed / 2;
const offRoadLimit = maxSpeed / 4;

let segments = [];
let cars = [];
let totalTrackLength = 0;
let startTime = 0;
let playing = false;
let gameFinished = false;

// Assets
const assets = {
    background: new Image(),
    player: new Image(),
    obstacle: new Image()
};
assets.background.src = 'assets/background.png';
assets.player.src = 'assets/player.png';
assets.obstacle.src = 'assets/obstacle.png';

// Setup Keys
const keys = { left: false, right: false, up: false, down: false };
window.addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'ArrowUp') keys.up = true;
    if (e.code === 'ArrowDown') keys.down = true;
});
window.addEventListener('keyup', e => {
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'ArrowUp') keys.up = false;
    if (e.code === 'ArrowDown') keys.down = false;
});

// Road Generation
function resetRoad() {
    segments = [];
    for (let n = 0; n < 5000; n++) {
        segments.push({
            index: n,
            p1: { world: { x: 0, y: 0, z: n * segmentLength }, camera: {}, screen: {} },
            p2: { world: { x: 0, y: 0, z: (n + 1) * segmentLength }, camera: {}, screen: {} },
            curve: n > 500 && n < 1000 ? 2 : (n > 2000 && n < 2500 ? -3 : 0),
            color: Math.floor(n / rumbleLength) % 2 ? { road: '#444', grass: '#1a1a1a', rumble: '#fff' } : { road: '#333', grass: '#0a0a0a', rumble: '#f00' }
        });
    }
    totalTrackLength = segments.length * segmentLength;
    
    // Add some random cars
    cars = [];
    for (let n = 0; n < 50; n++) {
        let posZ = 10000 + Math.random() * (totalTrackLength - 20000);
        cars.push({
            z: posZ,
            x: Math.random() * 2 - 1,
            speed: maxSpeed * (0.3 + Math.random() * 0.3),
            sprite: assets.obstacle
        });
    }
}

// Projection
function project(p, cameraX, cameraY, cameraZ, canvasWidth, canvasHeight, roadWidth) {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    p.camera.z = (p.world.z || 0) - cameraZ;
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round((canvasWidth / 2) + (p.screen.scale * p.camera.x * canvasWidth / 2));
    p.screen.y = Math.round((canvasHeight / 2) - (p.screen.scale * p.camera.y * canvasHeight / 2));
    p.screen.w = Math.round(p.screen.scale * roadWidth * canvasWidth / 2);
}

// Rendering Helpers
function drawPolygon(x1, y1, w1, x2, y2, w2, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.lineTo(x2 - w2, y2);
    ctx.lineTo(x2 + w2, y2);
    ctx.lineTo(x1 + w1, y1);
    ctx.closePath();
    ctx.fill();
}

// Game Loop
function update(dt) {
    if (!playing) return;

    // Movement logic
    const playerSegment = segments[Math.floor(cameraZ / segmentLength) % segments.length];
    const speedPercent = speed / maxSpeed;

    // Speed controls
    if (keys.up) speed += accel * dt;
    else if (keys.down) speed += breaking * dt;
    else speed += decel * dt;

    // Off-road penalty
    if ((playerX < -1 || playerX > 1) && (speed > offRoadLimit))
        speed += offRoadDecel * dt;

    speed = Math.max(0, Math.min(speed, maxSpeed));

    // Steering
    if (keys.left) playerX -= 3 * dt * speedPercent;
    if (keys.right) playerX += 3 * dt * speedPercent;

    // Curve drag
    playerX -= (speedPercent * dt * playerSegment.curve * 1.5);

    // Position Update
    cameraZ += speed * dt;
    if (cameraZ >= totalTrackLength) {
        finishGame();
        return;
    }

    // Update cars
    cars.forEach(car => {
        car.z -= car.speed * dt; // They move towards player or just slower
        if (car.z < 0) car.z += totalTrackLength;
        
        // Collision
        if (Math.abs(cameraZ - car.z) < segmentLength) {
            if (Math.abs(playerX - car.x) < 0.5) {
                speed = speed / 4; // Harsh collision penalty
                car.z += 1000; // Knock it away
            }
        }
    });

    // Update UI
    speedEl.innerText = Math.floor(speed / 100);
    const elapsed = (Date.now() - startTime) / 1000;
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = Math.floor(elapsed % 60).toString().padStart(2, '0');
    timeEl.innerText = `${mins}:${secs}`;
}

function render() {
    ctx.clearRect(0, 0, width, height);

    // Draw Parallax Background
    const bgOffset = (cameraZ / segmentLength) * 0.1;
    ctx.drawImage(assets.background, (bgOffset % width), 0, width, height);
    ctx.drawImage(assets.background, (bgOffset % width) - width, 0, width, height);

    const baseSegment = segments[Math.floor(cameraZ / segmentLength) % segments.length];
    const basePercent = (cameraZ % segmentLength) / segmentLength;
    
    // Draw Road & Sprites (Back to Front)
    let maxY = height;
    
    // First, project all segments needed
    let projectedSegments = [];
    let x = 0;
    let dx = -(baseSegment.curve * basePercent);
    
    for (let n = 0; n < drawDistance; n++) {
        const segment = segments[(baseSegment.index + n) % segments.length];
        const looped = segment.index < baseSegment.index;

        project(segment.p1, playerX * roadWidth - x, cameraHeight, cameraZ - (looped ? totalTrackLength : 0), width, height, roadWidth);
        project(segment.p2, playerX * roadWidth - x - dx, cameraHeight, cameraZ - (looped ? totalTrackLength : 0), width, height, roadWidth);

        x += dx;
        dx += segment.curve;
        projectedSegments.push(segment);
    }

    // Now render back to front
    for (let n = drawDistance - 1; n > 0; n--) {
        const segment = projectedSegments[n];
        if (segment.p1.camera.z <= cameraDepth || segment.p1.screen.y >= maxY) continue;

        // Draw Grass
        ctx.fillStyle = segment.color.grass;
        ctx.fillRect(0, segment.p2.screen.y, width, segment.p1.screen.y - segment.p2.screen.y);

        // Draw Rumble
        const r1 = segment.p1.screen.w / 10;
        const r2 = segment.p2.screen.w / 10;
        drawPolygon(segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w + r1, segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w + r2, segment.color.rumble);
        
        // Draw Road
        drawPolygon(segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w, segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w, segment.color.road);

        // Update maxY to avoid drawing over near segments
        maxY = segment.p1.screen.y;
    }

    // Draw Cars at their respective Z (Simple back-to-front for cars)
    cars.sort((a, b) => b.z - a.z);
    cars.forEach(car => {
        if (car.z > cameraZ && car.z < cameraZ + drawDistance * segmentLength) {
            const scale = cameraDepth / (car.z - cameraZ);
            const carX = width / 2 + (scale * (car.x * roadWidth - playerX * roadWidth) * width / 2);
            // Height calculation based on cameraHeight and distance
            const carY = height / 2 - (scale * (cameraHeight - 500) * height / 2); // 500 is half car height roughly
            const carW = scale * 1500 * (width / 2);
            const carH = carW * 0.6;
            
            ctx.drawImage(assets.obstacle, carX - carW / 2, carY - carH, carW, carH);
        }
    });


    // Draw Player
    const playerScale = cameraDepth / cameraDepth; // Fixed at front
    const pW = 200;
    const pH = 120;
    ctx.drawImage(assets.player, (width / 2) - (pW / 2), height - pH - 20, pW, pH);
}

let lastTime = Date.now();
function frame() {
    const now = Date.now();
    const dt = Math.min(1, (now - lastTime) / 1000);
    update(dt);
    render();
    lastTime = now;
    requestAnimationFrame(frame);
}

function startGame() {
    resetRoad();
    cameraZ = 0;
    playerX = 0;
    speed = 0;
    startTime = Date.now();
    playing = true;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
}

function finishGame() {
    playing = false;
    gameFinished = true;
    finalTimeEl.innerText = timeEl.innerText;
    gameOverScreen.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Start
resetRoad();
frame();
