const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Resolution Settings ---
const width = 640;
const height = 480;
canvas.width = width;
canvas.height = height;

// --- Game Constants ---
const FPS = 60;
const STEP = 1 / FPS;
const ROAD_WIDTH = 3000; // Increased for better visible range
const SEGMENT_LENGTH = 200;
const RUMBLE_LENGTH = 3;
const LANES = 3;
const FIELD_OF_VIEW = 100;
const CAMERA_HEIGHT = 1000;
const CAMERA_DEPTH = 1 / Math.tan((FIELD_OF_VIEW / 2) * Math.PI / 180);
const DRAW_DISTANCE = 300;
const FOG_DENSITY = 5;

// --- Colors (Atari Palette) ---
const COLORS = {
    SKY:  '#6D7EB2', // Deep blue sky
    TREE: '#31A031',
    FOG:  '#000000',
    LIGHT:  { road: '#7F7F7F', grass: '#C15802', rumble: '#B300B3', lane: '#CCCCCC'  }, // Orange-ish ground like in image 1
    DARK:   { road: '#7F7F7F', grass: '#C15802', rumble: '#FFFFFF'                   }, 
    START:  { road: 'white',   grass: 'white',   rumble: 'white'                     },
    FINISH: { road: 'black',   grass: 'black',   rumble: 'black'                     }
};

// --- Game State ---
let playerX = 0; // -1 to 1 (left to right)
let position = 0; // current distance down the road
let speed = 0; // Current speed
let maxSpeed = 12000; 
let accel = maxSpeed / 4; 
let breaking = -maxSpeed; 
let decel = -maxSpeed / 100; // Extremely slow deceleration (momentum)
let offRoadDecel = -maxSpeed / 4;
let offRoadLimit = maxSpeed / 3;

let segments = [];
let totalLength = 0;
let carPos = 0;
let cars = [];

let startTime = 0;
let timer = 0;
let gameActive = false;
let gameFinished = false;

// --- Input handling ---
const keys = { w: false, s: false, a: false, d: false, enter: false };
window.addEventListener('keydown', e => { 
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true; 
    if (key === 'enter') {
        if (!gameActive) startGame();
        else if (gameFinished) startGame();
    }
});
window.addEventListener('keyup', e => { 
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false; 
});

// --- Helper Functions ---
function project(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
    p.camera.x     = (p.world.x || 0) - cameraX;
    p.camera.y     = (p.world.y || 0) - cameraY;
    p.camera.z     = (p.world.z || 0) - cameraZ;
    p.screen.scale = cameraDepth / p.camera.z;
    // Reduce cameraX influence here to make the car move more and road move less
    p.screen.x     = Math.round((width / 2)  + (p.screen.scale * p.camera.x  * width / 2));
    p.screen.y     = Math.round((height / 2) - (p.screen.scale * p.camera.y  * height / 2));
    p.screen.w     = Math.round((p.screen.scale * roadWidth   * width / 2));
}

function lastY() { return (segments.length == 0) ? 0 : segments[segments.length - 1].p2.world.y; }

function addSegment(curve, y) {
    let n = segments.length;
    segments.push({
        index: n,
        p1: { world: { y: lastY(), z: n * SEGMENT_LENGTH }, camera: {}, screen: {} },
        p2: { world: { y: y, z: (n + 1) * SEGMENT_LENGTH }, camera: {}, screen: {} },
        curve: curve,
        cars: [],
        color: Math.floor(n / RUMBLE_LENGTH) % 2 ? COLORS.DARK : COLORS.LIGHT
    });
}

function addRoad(enter, hold, leave, curve, y) {
    let startY = lastY();
    let endY = startY + (y || 0) * SEGMENT_LENGTH;
    let n, total = enter + hold + leave;
    for (n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (n = 0; n < hold; n++)  addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
}

function easeIn(a, b, percent) { return a + (b - a) * Math.pow(percent, 2); }
function easeOut(a, b, percent) { return a + (b - a) * (1 - Math.pow(1 - percent, 2)); }
function easeInOut(a, b, percent) { return a + (b - a) * ((-Math.cos(percent * Math.PI) / 2) + 0.5); }

function resetRoad() {
    segments = [];
    addRoad(50, 50, 50, 0, 0); // straight
    addRoad(100, 100, 100, 2, 2); // soft curve
    addRoad(100, 100, 100, -2, -2);
    addRoad(100, 100, 100, 4, 0); // sharp curve
    addRoad(100, 100, 100, 0, 5); // hill
    addRoad(100, 100, 100, -4, 0);
    addRoad(100, 100, 100, 0, -5);
    addRoad(200, 200, 200, 0, 0); // final stretch
    
    totalLength = segments.length * SEGMENT_LENGTH;
    
    // Start line (White)
    for(let n=0; n<RUMBLE_LENGTH; n++) segments[n].color = COLORS.START;
    
    // Finish line (Chequered pattern - Black/White)
    let finishBase = segments.length - 100;
    for(let n=0; n<20; n++) {
        segments[finishBase + n].color = (n % 2 === 0) ? COLORS.START : COLORS.FINISH;
    }

    resetCars();
}

function findSegment(z) {
    return segments[Math.floor(z / SEGMENT_LENGTH) % segments.length];
}

function resetCars() {
    cars = [];
    const CAR_COLORS = ['#FF0000', '#0000FF', '#FFFF00', '#FFFFFF'];
    for (let n = 0; n < 30; n++) {
        let offset = Math.random() * 0.8 * (Math.random() > 0.5 ? 1 : -1);
        let z = Math.floor(Math.random() * (segments.length - 100)) * SEGMENT_LENGTH + 2000;
        let color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
        let car = { offset: offset, z: z, speed: maxSpeed / 4 + Math.random() * maxSpeed / 2, color: color };
        let segment = findSegment(z);
        segment.cars.push(car);
        cars.push(car);
    }
}

let trackPoints = [];
function drawMinimapTrack() {
    const mapCanvas = document.createElement('canvas');
    mapCanvas.id = 'map-canvas';
    mapCanvas.width = 100;
    mapCanvas.height = 150;
    document.getElementById('minimap').appendChild(mapCanvas);
    const mctx = mapCanvas.getContext('2d');
    
    mctx.strokeStyle = '#fff';
    mctx.lineWidth = 2;
    mctx.beginPath();
    
    trackPoints = [];
    let curX = 0;
    for (let i = 0; i < segments.length; i += 1) {
        curX += segments[i].curve * (SEGMENT_LENGTH / 100);
        if (i % 10 === 0) {
            let px = 50 + curX / 5;
            let py = 150 - (i / segments.length) * 150;
            trackPoints.push({x: px, y: py});
            if (i === 0) mctx.moveTo(px, py);
            else mctx.lineTo(px, py);
        }
    }
    mctx.stroke();
}

// --- Main Game Loop Functions ---

function startGame() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('minimap').classList.remove('hidden');
    
    // Start slightly after the line so it can be seen if needed
    position = 0;
    speed = 0;
    playerX = 0;
    timer = 0;
    startTime = Date.now();
    gameActive = true;
    gameFinished = false;
    resetRoad();
    
    // Clear old map canvas if exists
    const oldCanvas = document.getElementById('map-canvas');
    if (oldCanvas) oldCanvas.remove();
    drawMinimapTrack();
}

function update(dt) {
    if (!gameActive) return;

    timer = (Date.now() - startTime) / 1000;
    document.getElementById('timer').innerText = timer.toFixed(2);
    document.getElementById('speed').innerText = Math.floor(speed / 100);

    let playerSegment = findSegment(position + CAMERA_HEIGHT);
    let speedPercent = speed / maxSpeed;
    let dx = dt * 2 * speedPercent; // player steering speed

    position = (position + speed * dt);
    
    // Update map
    let mapIndex = Math.floor((position / totalLength) * (trackPoints.length - 1));
    if (mapIndex >= 0 && mapIndex < trackPoints.length) {
        let point = trackPoints[mapIndex];
        document.getElementById('map-player').style.left = (point.x - 4) + 'px';
        document.getElementById('map-player').style.top = (point.y - 4) + 'px';
    }

    // Check finish line (Now trigger AFTER passing it)
    if (position >= totalLength - (10 * SEGMENT_LENGTH)) { // Wait until near absolute end
        finishGame();
        return;
    }

    // Input
    if (keys.w) speed = Math.min(speed + accel * dt, maxSpeed);
    else if (keys.s) speed = Math.max(speed + breaking * dt, 0);
    else speed = Math.max(speed + decel * dt, 0);

    if (keys.a) playerX = playerX - dx;
    if (keys.d) playerX = playerX + dx;

    // Movement penalties
    if ((playerX < -1) || (playerX > 1)) {
        if (speed > offRoadLimit) speed = Math.max(speed + offRoadDecel * dt, offRoadLimit);
    }

    // Update cars
    for (let car of cars) {
        let oldSegment = findSegment(car.z);
        car.z = (car.z + car.speed * dt);
        if (car.z >= totalLength) car.z -= totalLength;
        let newSegment = findSegment(car.z);
        if (oldSegment != newSegment) {
            let index = oldSegment.cars.indexOf(car);
            oldSegment.cars.splice(index, 1);
            newSegment.cars.push(car);
        }
    }

    // Collision
    playerSegment.cars.forEach(car => {
        if (speed > car.speed) {
            if (Math.abs(playerX - car.offset) < 0.25) { // Tighter collision
                speed = car.speed * 0.5;
                position = car.z - (CAMERA_HEIGHT * 2); 
            }
        }
    });

    // Clamp playerX to avoid leaving the screen view
    playerX = Math.max(-1.8, Math.min(1.8, playerX));
}

function finishGame() {
    gameActive = false;
    gameFinished = true;
    
    // Show game over after a small delay to see the crossing
    setTimeout(() => {
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('minimap').classList.add('hidden');
        document.getElementById('final-score').innerText = "TEMPO: " + timer.toFixed(2) + "s";
    }, 1000); 
}

let mountainOffset = 0;

function draw() {
    ctx.clearRect(0, 0, width, height);

    // Update parallax
    let baseSegment = findSegment(position);
    mountainOffset += baseSegment.curve * (speed / maxSpeed) * 0.1;

    // Draw Sky
    ctx.fillStyle = COLORS.SKY;
    ctx.fillRect(0, 0, width, height / 2);
    
    // Draw Parallax Mountains
    drawMountains(mountainOffset);

    // Camera follow logic: Camera X follows playerX with a safety limit
    let camX = Math.max(-1.5 * ROAD_WIDTH, Math.min(1.5 * ROAD_WIDTH, playerX * ROAD_WIDTH));

    let basePercent = (position % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    
    let x = 0;
    let dx = - (baseSegment.curve * basePercent);

    // Render road segments from back to front (Painter's algorithm)
    let maxy = height;

    for (let n = 0; n < DRAW_DISTANCE; n++) {
        let segment = segments[(baseSegment.index + n) % segments.length];
        // Looping logic for segments at the end of the data
        let loopZ = (segment.index < baseSegment.index) ? totalLength : 0;
        
        project(segment.p1, camX - x,      CAMERA_HEIGHT, position - loopZ, CAMERA_DEPTH, width, height, ROAD_WIDTH);
        project(segment.p2, camX - x - dx, CAMERA_HEIGHT, position - loopZ, CAMERA_DEPTH, width, height, ROAD_WIDTH);

        x = x + dx;
        dx = dx + segment.curve;

        if ((segment.p1.camera.z <= CAMERA_DEPTH) || (segment.p2.screen.y >= maxy)) continue;

        drawSegment(segment);
        maxy = segment.p2.screen.y;
    }

    // Draw Player Car (Simple Rect for Atari style)
    drawPlayer();
}

function drawMountains(offset) {
    ctx.fillStyle = '#105B10'; // Dark Green mountains
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    for (let i = 0; i <= width; i += 40) {
        let x = i;
        let y = (height / 2) - 30 + Math.sin((i + offset * 10) * 0.05) * 10;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height / 2);
    ctx.fill();

    // Brown base
    ctx.fillStyle = '#C15802';
    ctx.fillRect(0, height / 2, width, height / 2);
}

function drawSegment(segment) {
    let p1 = segment.p1.screen;
    let p2 = segment.p2.screen;

    // Grass
    ctx.fillStyle = segment.color.grass;
    ctx.fillRect(0, p2.y, width, p1.y - p2.y);

    // Rumble
    let r1 = p1.w / 10;
    let r2 = p2.w / 10;
    ctx.fillStyle = segment.color.rumble;
    ctx.beginPath();
    ctx.moveTo(p1.x - p1.w - r1, p1.y); ctx.lineTo(p1.x - p1.w, p1.y); ctx.lineTo(p2.x - p2.w, p2.y); ctx.lineTo(p2.x - p2.w - r2, p2.y);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p1.x + p1.w + r1, p1.y); ctx.lineTo(p1.x + p1.w, p1.y); ctx.lineTo(p2.x + p2.w, p2.y); ctx.lineTo(p2.x + p2.w + r2, p2.y);
    ctx.fill();

    // Road
    ctx.fillStyle = segment.color.road;
    ctx.beginPath();
    ctx.moveTo(p1.x - p1.w, p1.y); ctx.lineTo(p1.x + p1.w, p1.y); ctx.lineTo(p2.x + p2.w, p2.y); ctx.lineTo(p2.x - p2.w, p2.y);
    ctx.fill();

    // Lanes
    if (segment.color.lane) {
        let l1 = p1.w / 30;
        let l2 = p2.w / 30;
        ctx.fillStyle = segment.color.lane;
        ctx.beginPath();
        ctx.moveTo(p1.x - l1, p1.y); ctx.lineTo(p1.x + l1, p1.y); ctx.lineTo(p2.x + l2, p2.y); ctx.lineTo(p2.x - l2, p2.y);
        ctx.fill();
    }

    // Draw cars in this segment
    for (let car of segment.cars) {
        drawCar(car, segment);
    }
}

function drawCar(car, segment) {
    let scale = segment.p1.screen.scale;
    let destX = segment.p1.screen.x + (scale * car.offset * ROAD_WIDTH * width / 2);
    let destY = segment.p1.screen.y;
    let w = 550 * scale * width / 2;
    let h = 280 * scale * width / 2;
    
    if (w < 4) w = 4;
    if (h < 2) h = 2;

    // Cuboid 3D Effect Factors
    let depth = h * 0.5; 
    let sideOffset = (car.offset - playerX) * w * 0.5;

    // 1. Back Face (Main body)
    ctx.fillStyle = car.color || '#00f'; 
    ctx.fillRect(destX - w/2, destY - h, w, h);
    
    // 2. Top Face (Depth towards horizon)
    ctx.fillStyle = shadeColor(ctx.fillStyle, -20);
    ctx.beginPath();
    ctx.moveTo(destX - w/2,         destY - h);
    ctx.lineTo(destX + w/2,         destY - h);
    ctx.lineTo(destX + w/2 - depth, destY - h - depth);
    ctx.lineTo(destX - w/2 + depth, destY - h - depth);
    ctx.fill();

    // 3. Side Face (Visible based on car.offset relative to player)
    ctx.fillStyle = shadeColor(car.color || '#00f', -40);
    ctx.beginPath();
    if (sideOffset > 0) { // Right side visible
        ctx.moveTo(destX + w/2,         destY);
        ctx.lineTo(destX + w/2,         destY - h);
        ctx.lineTo(destX + w/2 - depth, destY - h - depth);
        ctx.lineTo(destX + w/2 - depth, destY - depth);
    } else { // Left side visible
        ctx.moveTo(destX - w/2,         destY);
        ctx.lineTo(destX - w/2,         destY - h);
        ctx.lineTo(destX - w/2 + depth, destY - h - depth);
        ctx.lineTo(destX - w/2 + depth, destY - depth);
    }
    ctx.fill();

    // 4. Black Outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(1, 2 * scale * width / 640);
    ctx.strokeRect(destX - w/2, destY - h, w, h);

    // 5. Features (Tail lights)
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(destX - w/2 + 2, destY - h + 2, w/4, h/4);
    ctx.fillRect(destX + w/2 - w/4 - 2, destY - h + 2, w/4, h/4);
}

function shadeColor(color, percent) {
    let num = parseInt(color.replace("#",""),16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = (num >> 8 & 0x00FF) + amt,
    B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
}

function drawPlayer() {
    let w = 110;
    let h = 55;
    let x = width / 2; 
    let y = height - 20;

    // 3D Player Car Effect
    let depth = 15;
    let tilt = playerX * 10;

    // 1. Bottom/Sides
    ctx.fillStyle = shadeColor('#B300B3', -40);
    ctx.beginPath();
    ctx.moveTo(x - w/2, y);
    ctx.lineTo(x + w/2, y);
    ctx.lineTo(x + w/2 + tilt, y - depth);
    ctx.lineTo(x - w/2 + tilt, y - depth);
    ctx.fill();

    // 2. Main Body
    ctx.fillStyle = '#B300B3';
    ctx.fillRect(x - w/2 + tilt, y - h - depth, w, h);
    
    // 3. Cockpit/Yellow Detail
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x - w/6 + tilt, y - h - depth - 5, w/3, 10);
    
    // 4. Black Tires (Apparent)
    ctx.fillStyle = '#000';
    ctx.fillRect(x - w/2 + tilt - 10, y - h - depth + 10, 15, 35);
    ctx.fillRect(x + w/2 + tilt - 5,  y - h - depth + 10, 15, 35);

    // 5. Outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - w/2 + tilt, y - h - depth, w, h);
}

// --- Game Loop ---
function frame() {
    update(STEP);
    draw();
    requestAnimationFrame(frame);
}

resetRoad();
frame();
