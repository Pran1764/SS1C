const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// --- Sizing ---
const BASE_W = 400;
const BASE_H = 600;
let scale = 1;

function resize() {
    const dpr = window.devicePixelRatio || 1;
    scale = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
    canvas.style.width = BASE_W * scale + 'px';
    canvas.style.height = BASE_H * scale + 'px';
    canvas.width = BASE_W * scale * dpr;
    canvas.height = BASE_H * scale * dpr;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// --- Colors / Drawing helpers ---
const COLORS = {
    sky: '#4EC0CA',
    skyBottom: '#E8F5E0',
    ground: '#DED895',
    groundDark: '#D2B638',
    pipeBody: '#73BF2E',
    pipeDark: '#558B20',
    pipeLight: '#8CD640',
    pipeEdge: '#3B5C15',
    pipeCap: '#73BF2E',
    birdBody: '#F5C842',
    birdWing: '#E8A025',
    birdBeak: '#EC5E28',
    birdEye: '#FFFFFF',
    birdPupil: '#000000',
    birdBelly: '#F5DC8A',
    textFill: '#FFFFFF',
    textStroke: '#000000',
    medal_gold: '#FFD700',
    medal_silver: '#C0C0C0',
    medal_bronze: '#CD7F32',
};

// --- Game State ---
const GRAVITY = 0.45;
const FLAP_VEL = -7.5;
const PIPE_SPEED = 2.5;
const PIPE_GAP = 140;
const PIPE_WIDTH = 52;
const PIPE_SPAWN_INTERVAL = 90; // frames
const GROUND_HEIGHT = 80;
const BIRD_X = 80;
const BIRD_RADIUS = 15;

let bird, pipes, score, bestScore, gameState, frameCount, groundX, flashTimer;

// gameState: 'menu' | 'playing' | 'dying' | 'dead'

function loadBest() {
    try { return parseInt(localStorage.getItem('flappy_best')) || 0; } catch { return 0; }
}
function saveBest(s) {
    try { localStorage.setItem('flappy_best', s); } catch {}
}

function resetGame() {
    bird = { y: BASE_H / 2 - 40, vel: 0, rotation: 0, wingPhase: 0 };
    pipes = [];
    score = 0;
    bestScore = loadBest();
    frameCount = 0;
    groundX = 0;
    flashTimer = 0;
    gameState = 'menu';
}
resetGame();

// --- Input ---
function flap() {
    if (gameState === 'menu') {
        gameState = 'playing';
        bird.vel = FLAP_VEL;
    } else if (gameState === 'playing') {
        bird.vel = FLAP_VEL;
    } else if (gameState === 'dead') {
        resetGame();
    }
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        flap();
    }
});
canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    flap();
});

// --- Pipe logic ---
function spawnPipe() {
    const minY = 80;
    const maxY = BASE_H - GROUND_HEIGHT - PIPE_GAP - 80;
    const topH = minY + Math.random() * (maxY - minY);
    pipes.push({
        x: BASE_W + 10,
        topH: topH,
        scored: false,
    });
}

// --- Collision ---
function checkCollision() {
    const bx = BIRD_X;
    const by = bird.y;
    const r = BIRD_RADIUS - 2;

    // Ground / ceiling
    if (by + r >= BASE_H - GROUND_HEIGHT || by - r <= 0) return true;

    for (const p of pipes) {
        // Pipe rects
        const px = p.x;
        const pw = PIPE_WIDTH;
        const capH = 26;

        // Top pipe body
        if (circleRect(bx, by, r, px, 0, pw, p.topH)) return true;
        // Top pipe cap
        if (circleRect(bx, by, r, px - 3, p.topH - capH, pw + 6, capH)) return true;

        // Bottom pipe
        const bottomY = p.topH + PIPE_GAP;
        if (circleRect(bx, by, r, px, bottomY + capH, pw, BASE_H - GROUND_HEIGHT - bottomY - capH)) return true;
        // Bottom pipe cap
        if (circleRect(bx, by, r, px - 3, bottomY, pw + 6, capH)) return true;
    }
    return false;
}

function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const nearX = Math.max(rx, Math.min(cx, rx + rw));
    const nearY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearX;
    const dy = cy - nearY;
    return dx * dx + dy * dy < cr * cr;
}

// --- Update ---
function update() {
    frameCount++;

    if (gameState === 'menu') {
        bird.wingPhase += 0.12;
        bird.y = BASE_H / 2 - 40 + Math.sin(frameCount * 0.06) * 12;
        groundX = (groundX - 1) % 24;
        return;
    }

    if (gameState === 'dying') {
        bird.vel += GRAVITY;
        bird.y += bird.vel;
        bird.rotation = Math.min(bird.rotation + 0.08, Math.PI / 2);
        flashTimer--;
        if (bird.y + BIRD_RADIUS >= BASE_H - GROUND_HEIGHT) {
            bird.y = BASE_H - GROUND_HEIGHT - BIRD_RADIUS;
            gameState = 'dead';
            if (score > bestScore) {
                bestScore = score;
                saveBest(bestScore);
            }
        }
        return;
    }

    if (gameState === 'dead') return;

    // Playing
    bird.vel += GRAVITY;
    bird.y += bird.vel;
    bird.wingPhase += 0.25;

    // Bird rotation based on velocity
    if (bird.vel < 0) {
        bird.rotation = Math.max(-0.45, bird.vel * 0.06);
    } else {
        bird.rotation = Math.min(Math.PI / 2, bird.vel * 0.08);
    }

    // Pipes
    if (frameCount % PIPE_SPAWN_INTERVAL === 0) spawnPipe();

    for (const p of pipes) {
        p.x -= PIPE_SPEED;
        if (!p.scored && p.x + PIPE_WIDTH < BIRD_X) {
            p.scored = true;
            score++;
        }
    }
    pipes = pipes.filter(p => p.x > -PIPE_WIDTH - 10);

    // Ground scroll
    groundX = (groundX - PIPE_SPEED) % 24;

    // Collision
    if (checkCollision()) {
        gameState = 'dying';
        bird.vel = -5;
        flashTimer = 6;
    }
}

// --- Drawing ---
function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, BASE_H - GROUND_HEIGHT);
    grad.addColorStop(0, COLORS.sky);
    grad.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, BASE_W, BASE_H - GROUND_HEIGHT);
}

function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const offset = (frameCount * 0.3) % (BASE_W + 200);
    for (let i = 0; i < 3; i++) {
        const cx = ((i * 180 + 50) - offset + BASE_W + 200) % (BASE_W + 200) - 100;
        const cy = 60 + i * 45;
        drawCloud(cx, cy, 30 + i * 5);
    }
}

function drawCloud(x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.arc(x + size * 0.8, y - size * 0.3, size * 0.7, 0, Math.PI * 2);
    ctx.arc(x + size * 1.4, y, size * 0.6, 0, Math.PI * 2);
    ctx.arc(x - size * 0.5, y + size * 0.1, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawGround() {
    // Dirt
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, BASE_H - GROUND_HEIGHT, BASE_W, GROUND_HEIGHT);

    // Green strip
    ctx.fillStyle = '#8BC34A';
    ctx.fillRect(0, BASE_H - GROUND_HEIGHT, BASE_W, 12);

    // Texture lines
    ctx.fillStyle = COLORS.groundDark;
    for (let x = groundX; x < BASE_W; x += 24) {
        ctx.fillRect(x, BASE_H - GROUND_HEIGHT + 14, 16, 3);
        ctx.fillRect(x + 12, BASE_H - GROUND_HEIGHT + 28, 16, 3);
    }
}

function drawPipe(p) {
    const capH = 26;
    const capOverhang = 3;

    // --- Top pipe ---
    // Body
    ctx.fillStyle = COLORS.pipeBody;
    ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topH - capH);

    // Body shading
    ctx.fillStyle = COLORS.pipeDark;
    ctx.fillRect(p.x, 0, 4, p.topH - capH);
    ctx.fillStyle = COLORS.pipeLight;
    ctx.fillRect(p.x + PIPE_WIDTH - 6, 0, 4, p.topH - capH);

    // Cap
    ctx.fillStyle = COLORS.pipeCap;
    ctx.fillRect(p.x - capOverhang, p.topH - capH, PIPE_WIDTH + capOverhang * 2, capH);
    // Cap shading
    ctx.fillStyle = COLORS.pipeEdge;
    ctx.strokeStyle = COLORS.pipeEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - capOverhang, p.topH - capH, PIPE_WIDTH + capOverhang * 2, capH);
    ctx.fillStyle = COLORS.pipeLight;
    ctx.fillRect(p.x - capOverhang + 3, p.topH - capH + 3, 4, capH - 6);

    // --- Bottom pipe ---
    const bottomY = p.topH + PIPE_GAP;

    // Cap
    ctx.fillStyle = COLORS.pipeCap;
    ctx.fillRect(p.x - capOverhang, bottomY, PIPE_WIDTH + capOverhang * 2, capH);
    ctx.strokeStyle = COLORS.pipeEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - capOverhang, bottomY, PIPE_WIDTH + capOverhang * 2, capH);
    ctx.fillStyle = COLORS.pipeLight;
    ctx.fillRect(p.x - capOverhang + 3, bottomY + 3, 4, capH - 6);

    // Body
    ctx.fillStyle = COLORS.pipeBody;
    ctx.fillRect(p.x, bottomY + capH, PIPE_WIDTH, BASE_H - GROUND_HEIGHT - bottomY - capH);
    ctx.fillStyle = COLORS.pipeDark;
    ctx.fillRect(p.x, bottomY + capH, 4, BASE_H - GROUND_HEIGHT - bottomY - capH);
    ctx.fillStyle = COLORS.pipeLight;
    ctx.fillRect(p.x + PIPE_WIDTH - 6, bottomY + capH, 4, BASE_H - GROUND_HEIGHT - bottomY - capH);
}

function drawBird() {
    const bx = BIRD_X;
    const by = bird.y;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(bird.rotation);

    // Body
    ctx.fillStyle = COLORS.birdBody;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_RADIUS + 2, BIRD_RADIUS, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = COLORS.birdBelly;
    ctx.beginPath();
    ctx.ellipse(2, 4, BIRD_RADIUS - 4, BIRD_RADIUS - 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    const wingY = Math.sin(bird.wingPhase) * 4;
    ctx.fillStyle = COLORS.birdWing;
    ctx.beginPath();
    ctx.ellipse(-4, wingY, 10, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Eye (white)
    ctx.fillStyle = COLORS.birdEye;
    ctx.beginPath();
    ctx.arc(8, -5, 6, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = COLORS.birdPupil;
    ctx.beginPath();
    ctx.arc(10, -4, 3, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = COLORS.birdBeak;
    ctx.beginPath();
    ctx.moveTo(14, -1);
    ctx.lineTo(24, 2);
    ctx.lineTo(14, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawScore() {
    ctx.textAlign = 'center';

    if (gameState === 'playing' || gameState === 'dying') {
        ctx.font = 'bold 48px "Segoe UI", Arial, sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = COLORS.textStroke;
        ctx.fillStyle = COLORS.textFill;
        ctx.strokeText(score, BASE_W / 2, 60);
        ctx.fillText(score, BASE_W / 2, 60);
    }
}

function drawMenu() {
    // Title
    ctx.textAlign = 'center';
    ctx.font = 'bold 46px "Segoe UI", Arial, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = COLORS.textStroke;
    ctx.fillStyle = COLORS.birdBody;
    const titleY = 160;
    ctx.strokeText('Flappy Bird', BASE_W / 2, titleY);
    ctx.fillText('Flappy Bird', BASE_W / 2, titleY);

    // Subtitle
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.textStroke;
    ctx.fillStyle = COLORS.textFill;
    const subY = BASE_H / 2 + 80;
    ctx.strokeText('Click or press Space to play', BASE_W / 2, subY);
    ctx.fillText('Click or press Space to play', BASE_W / 2, subY);

    if (bestScore > 0) {
        ctx.font = '18px "Segoe UI", Arial, sans-serif';
        ctx.strokeText('Best: ' + bestScore, BASE_W / 2, subY + 35);
        ctx.fillText('Best: ' + bestScore, BASE_W / 2, subY + 35);
    }
}

function drawGameOver() {
    // Panel background
    const pw = 220, ph = 200;
    const px = (BASE_W - pw) / 2;
    const py = 140;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, px + 4, py + 4, pw, ph, 12, true, false);

    // Panel
    ctx.fillStyle = '#DEB887';
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 3;
    roundRect(ctx, px, py, pw, ph, 12, true, true);

    // Inner panel
    ctx.fillStyle = '#C4A050';
    roundRect(ctx, px + 15, py + 55, pw - 30, ph - 100, 6, true, false);

    // "Game Over" text
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.textStroke;
    ctx.fillStyle = '#EC5E28';
    ctx.strokeText('Game Over', BASE_W / 2, py + 38);
    ctx.fillText('Game Over', BASE_W / 2, py + 38);

    // Score
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.textFill;
    ctx.strokeStyle = COLORS.textStroke;
    ctx.lineWidth = 2;
    ctx.textAlign = 'left';
    ctx.strokeText('Score', px + 80, py + 85);
    ctx.fillText('Score', px + 80, py + 85);
    ctx.textAlign = 'right';
    ctx.strokeText(score, px + pw - 25, py + 85);
    ctx.fillText(score, px + pw - 25, py + 85);

    // Best
    ctx.textAlign = 'left';
    ctx.strokeText('Best', px + 80, py + 115);
    ctx.fillText('Best', px + 80, py + 115);
    ctx.textAlign = 'right';
    ctx.strokeText(bestScore, px + pw - 25, py + 115);
    ctx.fillText(bestScore, px + pw - 25, py + 115);

    // Medal
    if (score >= 5) {
        const medalColor = score >= 30 ? COLORS.medal_gold : score >= 15 ? COLORS.medal_silver : COLORS.medal_bronze;
        ctx.fillStyle = medalColor;
        ctx.beginPath();
        ctx.arc(px + 45, py + 95, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Star on medal
        ctx.fillStyle = '#FFF';
        ctx.font = '16px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u2605', px + 45, py + 101);
    }

    // Restart prompt
    ctx.textAlign = 'center';
    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.textStroke;
    ctx.fillStyle = COLORS.textFill;
    ctx.strokeText('Click to restart', BASE_W / 2, py + ph + 30);
    ctx.fillText('Click to restart', BASE_W / 2, py + ph + 30);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

function drawFlash() {
    if (flashTimer > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flashTimer / 6})`;
        ctx.fillRect(0, 0, BASE_W, BASE_H);
    }
}

// --- Main Loop ---
function frame() {
    update();

    drawSky();
    drawClouds();
    for (const p of pipes) drawPipe(p);
    drawGround();
    drawBird();
    drawScore();
    drawFlash();

    if (gameState === 'menu') drawMenu();
    if (gameState === 'dead') drawGameOver();

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
