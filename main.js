/**
 * RETRO GP - Pseudo-3D Racing Game
 * Inspired by Atari Grand Prix
 */

// Configuration
const CONFIG = {
    FPS: 60,
    LANES: 3,
    ROAD_WIDTH: 2000,
    SEGMENT_LENGTH: 200,
    RUMBLE_LENGTH: 3,
    CAMERA_HEIGHT: 1000,
    FOCAL_LENGTH: 0.8,
    DRAW_DISTANCE: 300,
    FIELD_OF_VIEW: 100,
    MAX_SPEED: 15000,
    ACCEL: 50,
    BREAKING: -100,
    DECEL: -20,
    OFF_ROAD_DECEL: -150,
    OFF_ROAD_LIMIT: 4000,
    TRACK_LENGTH: 1000, // Total segments
};

// Colors (Palette)
const COLORS = {
    SKY:  '#050110',
    TREE: '#005108',
    FOG:  '#4a154b',
    LIGHT: { road: '#6B6B6B', grass: '#10AA10', rumble: '#555555', lane: '#CCCCCC'  },
    DARK:  { road: '#696969', grass: '#009A00', rumble: '#BBBBBB', lane: ''         },
    START: { road: 'white',   grass: 'white',   rumble: 'white',   lane: 'white'    },
    FINISH:{ road: 'black',   grass: 'black',   rumble: 'black',   lane: 'black'    }
};

// Utilities
const Util = {
    project: (p, cameraX, cameraY, cameraZ, focalLength, width, height) => {
        p.camera.x     = (p.world.x || 0) - cameraX;
        p.camera.y     = (p.world.y || 0) - cameraY;
        p.camera.z     = (p.world.z || 0) - cameraZ;
        p.screen.scale = focalLength / p.camera.z;
        p.screen.x     = Math.round((width/2)  + (p.screen.scale * p.camera.x  * width/2));
        p.screen.y     = Math.round((height/2) - (p.screen.scale * p.camera.y  * height/2));
        p.screen.w     = Math.round((p.screen.scale * CONFIG.ROAD_WIDTH * width/2));
    },
    overlap: (x1, w1, x2, w2, percent) => {
        let half = (percent || 1) / 2;
        let min1 = x1 - (w1 * half);
        let max1 = x1 + (w1 * half);
        let min2 = x2 - (w2 * half);
        let max2 = x2 + (w2 * half);
        return !((max1 < min2) || (min1 > max2));
    },
    interpolate: (a, b, percent) => a + (b - a) * percent,
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1) + min)
};

// Sprites Drawer (Atari Style)
const Sprite = {
    drawCar: (ctx, x, y, scale, color, side) => {
        const w = 80 * scale;
        const h = 40 * scale;
        
        ctx.save();
        ctx.translate(x, y);
        
        // Body (Simplified Atari Shape)
        ctx.fillStyle = color;
        ctx.fillRect(-w/2, -h, w, h);
        
        // Cockpit
        ctx.fillStyle = '#fff';
        ctx.fillRect(-w/4, -h * 0.8, w/2, h * 0.4);
        
        // Wheels
        ctx.fillStyle = '#000';
        ctx.fillRect(-w/2 - 5*scale, -h*0.9, 10*scale, 15*scale); // Front Left
        ctx.fillRect(w/2 - 5*scale, -h*0.9, 10*scale, 15*scale);  // Front Right
        ctx.fillRect(-w/2 - 5*scale, -h*0.3, 10*scale, 15*scale); // Back Left
        ctx.fillRect(w/2 - 5*scale, -h*0.3, 10*scale, 15*scale);  // Back Right
        
        // Spoiler (Rear)
        ctx.fillStyle = color;
        ctx.fillRect(-w/2, -h*0.1, w, 5*scale);
        
        ctx.restore();
    },
    drawTree: (ctx, x, y, scale) => {
        const w = 100 * scale;
        const h = 200 * scale;
        ctx.fillStyle = '#30c040';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - w/2, y);
        ctx.lineTo(x, y - h);
        ctx.lineTo(x + w/2, y);
        ctx.closePath();
        ctx.fill();
        // Trunk
        ctx.fillStyle = '#654321';
        ctx.fillRect(x - 5*scale, y, 10*scale, 20*scale);
    }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 640;
        this.height = 480;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.segments = [];
        this.cars = [];
        this.player = {
            x: 0,
            z: 0,
            speed: 0,
            maxSpeed: CONFIG.MAX_SPEED,
            accel: CONFIG.ACCEL,
            breaking: CONFIG.BREAKING,
            decel: CONFIG.DECEL,
            collisionX: 0
        };

        this.camera = { x: 0, y: CONFIG.CAMERA_HEIGHT, z: 0 };
        this.skyOffset = 0;
        this.hillOffset = 0;
        this.treeOffset = 0;
        this.keys = {};
        this.gameState = 'START'; // START, PLAYING, FINISHED
        this.timer = 0;
        this.startTime = 0;

        this.setupInput();
        this.resetTrack();
        this.gameLoop();
    }

    setupInput() {
        window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
        window.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (this.gameState === 'START' || this.gameState === 'FINISHED') {
                    this.start();
                }
            }
        });
    }

    start() {
        this.gameState = 'PLAYING';
        this.player.speed = 0;
        this.player.x = 0;
        this.player.z = 0;
        this.timer = 0;
        this.startTime = Date.now();
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
    }

    resetTrack() {
        this.segments = [];
        for (let n = 0; n < CONFIG.TRACK_LENGTH; n++) {
            this.segments.push({
                index: n,
                p1: { world: { z: n * CONFIG.SEGMENT_LENGTH }, camera: {}, screen: {} },
                p2: { world: { z: (n + 1) * CONFIG.SEGMENT_LENGTH }, camera: {}, screen: {} },
                color: Math.floor(n / CONFIG.RUMBLE_LENGTH) % 2 ? COLORS.DARK : COLORS.LIGHT,
                curve: 0,
                sprites: []
            });
            
            // Random trees on sides
            if (n % 5 === 0 && Math.random() > 0.3) {
                this.segments[n].sprites.push({ offset: (Math.random() > 0.5 ? 1.5 : -1.5), type: 'tree' });
            }
        }
        
        // Add some curves later? Keeping it simple Atari-style for now.
        
        // Finish line colors
        for (let n = 0; n < CONFIG.RUMBLE_LENGTH; n++) {
            this.segments[this.segments.length - 1 - n].color = COLORS.FINISH;
        }

        // Add NPC Cars
        this.cars = [];
        const numCars = 40;
        for (let n = 0; n < numCars; n++) {
            let offset = Math.random() * 2 - 1;
            let z = (Math.random() * (CONFIG.TRACK_LENGTH - 100) + 50) * CONFIG.SEGMENT_LENGTH;
            let speed = CONFIG.MAX_SPEED / 3 + Math.random() * CONFIG.MAX_SPEED / 3;
            let colors = ['#e02820', '#30c040', '#00f2ff', '#ff007f'];
            this.cars.push({ offset, z, speed, color: colors[n % colors.length] });
        }
    }

    update(dt) {
        if (this.gameState !== 'PLAYING') return;

        // Player movement
        if (this.keys['w']) this.player.speed += this.player.accel;
        else if (this.keys['s']) this.player.speed += this.player.breaking;
        else this.player.speed += this.player.decel;

        // Steering
        if (this.keys['a']) this.player.x -= (this.player.speed / CONFIG.MAX_SPEED) * 0.1;
        if (this.keys['d']) this.player.x += (this.player.speed / CONFIG.MAX_SPEED) * 0.1;

        // Off-road penalty
        if ((this.player.x < -1) || (this.player.x > 1)) {
            if (this.player.speed > CONFIG.OFF_ROAD_LIMIT)
                this.player.speed += CONFIG.OFF_ROAD_DECEL;
        }

        this.player.speed = Math.max(0, Math.min(this.player.speed, this.player.maxSpeed));
        this.player.z += this.player.speed * dt;
        this.player.x = Math.max(-2, Math.min(2, this.player.x));

        // Parallax effects
        this.skyOffset = (this.skyOffset + 0.001 * this.player.speed/CONFIG.MAX_SPEED * (this.player.x)) % 1;
        document.getElementById('sky').style.backgroundPosition = `${this.skyOffset * 100}% 0`;

        // Update NPC Cars
        this.cars.forEach(car => {
            car.z += car.speed * dt;
            if (car.z > CONFIG.TRACK_LENGTH * CONFIG.SEGMENT_LENGTH) car.z = 0;
            
            // Player collision
            if (Util.overlap(this.player.x, 0.3, car.offset, 0.3) && Math.abs(this.player.z - car.z) < CONFIG.SEGMENT_LENGTH) {
                this.player.speed = car.speed / 2;
                this.player.z = car.z - CONFIG.SEGMENT_LENGTH;
            }
        });

        // Finish Check
        if (this.player.z >= (CONFIG.TRACK_LENGTH - 5) * CONFIG.SEGMENT_LENGTH) {
            this.finish();
        }

        // UI Updates
        this.timer = (Date.now() - this.startTime) / 1000;
        document.getElementById('speed-val').innerText = Math.round(this.player.speed / 100);
        document.getElementById('time-val').innerText = this.formatTime(this.timer);
        let progress = (this.player.z / (CONFIG.TRACK_LENGTH * CONFIG.SEGMENT_LENGTH)) * 100;
        document.getElementById('distance-progress').style.width = `${progress}%`;
    }

    finish() {
        this.gameState = 'FINISHED';
        document.getElementById('final-time').innerText = this.formatTime(this.timer);
        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    formatTime(seconds) {
        let mins = Math.floor(seconds / 60);
        let secs = Math.floor(seconds % 60);
        let ms = Math.floor((seconds % 1) * 100);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        let baseSegment = this.findSegment(this.player.z);
        let playerSegment = this.findSegment(this.player.z + (CONFIG.CAMERA_HEIGHT * CONFIG.FOCAL_LENGTH));
        let maxY = this.height;

        // Render Road Segments
        for (let n = 0; n < CONFIG.DRAW_DISTANCE; n++) {
            let segment = this.segments[(baseSegment.index + n) % CONFIG.TRACK_LENGTH];
            let looped = segment.index < baseSegment.index;

            Util.project(segment.p1, this.player.x * CONFIG.ROAD_WIDTH, CONFIG.CAMERA_HEIGHT, this.player.z - (looped ? CONFIG.TRACK_LENGTH * CONFIG.SEGMENT_LENGTH : 0), CONFIG.FOCAL_LENGTH, this.width, this.height);
            Util.project(segment.p2, this.player.x * CONFIG.ROAD_WIDTH, CONFIG.CAMERA_HEIGHT, this.player.z - (looped ? CONFIG.TRACK_LENGTH * CONFIG.SEGMENT_LENGTH : 0), CONFIG.FOCAL_LENGTH, this.width, this.height);

            if ((segment.p1.camera.z <= CONFIG.FOCAL_LENGTH) || (segment.p2.screen.y >= maxY)) continue;

            this.drawSegment(this.ctx, segment);
            
            // Draw Scenery Sprites
            segment.sprites.forEach(sprite => {
                let scale = segment.p1.screen.scale;
                let x = segment.p1.screen.x + (scale * sprite.offset * CONFIG.ROAD_WIDTH * this.width/2);
                let y = segment.p1.screen.y;
                if (sprite.type === 'tree') Sprite.drawTree(this.ctx, x, y, scale * 40);
            });

            maxY = segment.p2.screen.y;
        }

        // Render NPC Cars
        this.cars.forEach(car => {
            let segment = this.findSegment(car.z);
            if (segment.index > baseSegment.index && segment.index < baseSegment.index + CONFIG.DRAW_DISTANCE) {
                let carZ = car.z - (segment.index < baseSegment.index ? CONFIG.TRACK_LENGTH * CONFIG.SEGMENT_LENGTH : 0);
                let scale = CONFIG.FOCAL_LENGTH / (carZ - this.player.z);
                let x = (this.width/2) + (scale * (car.offset - this.player.x) * CONFIG.ROAD_WIDTH * this.width/2);
                let y = (this.height/2) - (scale * (CONFIG.CAMERA_HEIGHT) * this.height/2);
                Sprite.drawCar(this.ctx, x, y, scale * 40, car.color);
            }
        });

        // Render Player Car (Always center-bottomish)
        Sprite.drawCar(this.ctx, this.width / 2, this.height - 30, 2.5, '#30c040'); // Atari Green
    }

    drawSegment(ctx, segment) {
        let p1 = segment.p1.screen;
        let p2 = segment.p2.screen;

        // Grass
        ctx.fillStyle = segment.color.grass;
        ctx.fillRect(0, p2.y, this.width, p1.y - p2.y);

        // Road
        this.drawPolygon(ctx, p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, segment.color.road);

        // Rumble
        let r1 = p1.w / 10;
        let r2 = p2.w / 10;
        this.drawPolygon(ctx, p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, segment.color.rumble);
        this.drawPolygon(ctx, p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, segment.color.rumble);

        // Lane lines
        if (segment.color.lane) {
            let l1 = p1.w / 40;
            let l2 = p2.w / 40;
            let lanew1 = p1.w * 2 / CONFIG.LANES;
            let lanew2 = p2.w * 2 / CONFIG.LANES;
            let lanex1 = p1.x - p1.w + lanew1;
            let lanex2 = p2.x - p2.w + lanew2;
            for (let lane = 1; lane < CONFIG.LANES; lanex1 += lanew1, lanex2 += lanew2, lane++) {
                this.drawPolygon(ctx, lanex1 - l1, p1.y, lanex1 + l1, p1.y, lanex2 + l2, p2.y, lanex2 - l2, p2.y, segment.color.lane);
            }
        }
    }

    drawPolygon(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.closePath();
        ctx.fill();
    }

    findSegment(z) {
        return this.segments[Math.floor(z / CONFIG.SEGMENT_LENGTH) % CONFIG.TRACK_LENGTH];
    }

    gameLoop() {
        let last = Date.now();
        const step = () => {
            let now = Date.now();
            let dt = Math.min(1, (now - last) / 1000);
            this.update(dt);
            this.render();
            last = now;
            requestAnimationFrame(step);
        };
        step();
    }
}

// Initialize Game
window.onload = () => {
    new Game();
};
