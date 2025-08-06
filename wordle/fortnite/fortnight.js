// Get the canvas and its 2D rendering context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreDisplay = document.getElementById('final-score');
const scoreDisplay = document.getElementById('score-display');
const healthDisplay = document.getElementById('health-display');

const myImage = document.getElementById('victory-image');
const ProImage = document.getElementById('pro-image');
const Button = document.getElementById('nextButton');
const LargeImg = document.getElementById('large');



// Game state variables
let score = 0;
let isGameOver = false;
let isStopped = false;
let isPurpleBoxChasing = false;
let isMovingBack = false;
let animationFrameId;

// Game constants
const PLAYER_SIZE = 30;
const GRAVITY = 0.5;
const JUMP_POWER = -15;
const FLOOR_HEIGHT = 15;
let SCROLL_SPEED = 5;
const TILE_WIDTH = 50;
const BUMP_MAX_HEIGHT = 10;
const PLAYER_INITIAL_HEALTH = 150; // NEW: Player's starting health
const PLAYER_DAMAGE_PER_HIT = 10;
let BULLET_SPEED = 10; // Speed of player bullets
let isPlayerShooting = false; // New global variable
let lastPlayerShotTime = 0; // New global variable to control firing rate
const PLAYER_SHOOT_INTERVAL = 150;

let lastMouseX = canvas.width / 2; // Store last known mouse X position
let lastMouseY = canvas.height / 2; // Store last known mouse Y position
// Timestamp of the last player shot


const playerStartX = 550; // Centered start position for the player
const purpleboxStartX = -750; // Start position for the purple box
const WALL_PUSH_FORCE = 5;

// Obstacle constants
const OBSTACLE_TILE_WIDTH = 2;
const OBSTACLE_TILE_HEIGHT = 100;
const OBSTACLE_MAX_TILES_HIGH = 3;
const OBSTACLE_SPAWN_INTERVAL = 5000; // in milliseconds
let lastObstacleSpawn = 0;

//let lastPresetLength = 0;
let PRESET_SPAWN_INTERVAL = 3000; // Your desired base spawn time in milliseconds

const SAFE_SPAWN_GAP = 50;
//let lastPresetNextGap = 0; // Initialize with the safe spawn gap

let lastObstacle = null;
let uniqueObstacleId = 0;


let ORIGINAL_SCROLL_SPEED = 0; // The original scroll speed of the game 
let TARGET_SPEED = 0; // The target speed for the game
let speedIncrease = 0;
let SCORE_THRESHOLD_FOR_MAX_SPEED = 100;

let bots = [];
const botBullets = [];
const BOT_SIZE = 30;
let BOT_SHOOT_INTERVAL = 6000;
let canSpawnBot = false;
let botspawn = 0.3;// Flag to control bot spawning

let oldnumber = 0;
let oldPresetNumber = 0; // Variable to store the last preset number used
// Player object
const player = {
    x: playerStartX,
    y: canvas.height - PLAYER_SIZE - FLOOR_HEIGHT,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    dy: 0, // y velocity
    dx: 0, // x velocity for collision checks
    isGrounded: true,
    x_prev: 0, // previous x position for collision checks
    y_prev: 0,
    onPlatform: null, // New property to hold the platform the player is on
    platformOffset: 0,
    health: PLAYER_INITIAL_HEALTH,// New property to store the player's x offset from the platform's x

    draw() {
        ctx.fillStyle = '#ffd700'; // Gold, a vibrant yellow
        ctx.fillRect(this.x, this.y, this.width, this.height);
    },

    update() {
        // Store previous positions before updating
        this.x_prev = this.x;
        this.y_prev = this.y;

        // Apply gravity if not grounded
        if (!this.isGrounded) {
            this.dy += GRAVITY;
            this.y += this.dy;
        }
    },

    jump() {
        if (this.isGrounded) {
            this.dy = JUMP_POWER;
            this.isGrounded = false;
        }
    },

    shoot(mouseX, mouseY) {
        // Calculate direction vector from player to mouse
        const playerCenterX = this.x + this.width / 2;
        const playerCenterY = this.y + this.height / 2;

        const dx = mouseX - playerCenterX;
        const dy = mouseY - playerCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Normalize and scale to BULLET_SPEED
        const vx = (dx / distance) * BULLET_SPEED;
        const vy = (dy / distance) * BULLET_SPEED;

    

        // Create bullet with calculated velocities
        bullets.push(new Bullet(playerCenterX, playerCenterY, vx, vy));
    }
};

// Bumpy floor variables
const floorTiles = [];

// Function to create a new floor tile with a random bump
function createFloorTile(x) {
    const yOffset = Math.random() * BUMP_MAX_HEIGHT;
    floorTiles.push({
        x: x,
        y: canvas.height - FLOOR_HEIGHT - yOffset,
        width: TILE_WIDTH,
        height: FLOOR_HEIGHT + yOffset
    });
}

// Initialize the bumpy floor with tiles
function initializeFloor() {
    floorTiles.length = 0; // Clear existing tiles
    let currentX = 0;
    while (currentX < canvas.width + TILE_WIDTH) {
        createFloorTile(currentX);
        currentX += TILE_WIDTH;
    }
}


const purpleBox = {
    x: -1000,
    y: 0,
    width: 1000, // Adjust width to cover the desired screen area
    height: canvas.height,

    draw() {
        ctx.fillStyle = '#800080'; // Purple color
        ctx.fillRect(this.x, this.y, this.width, this.height);
    },

    update() {
        // If the game is stopped, move the box slowly towards the player
        if (isStopped) {
            this.x += 1;
        }
        // If the game is not stopped AND the box is not at its starting position,
        // move it back slowly.
        else if (this.x < purpleboxStartX) {
            this.x += 1;
        } else if (this.x > purpleboxStartX) {
            this.x -= 1;
        }
    }
};

const bullets = [];
class Bullet {
    // REVISED: Bullet constructor now takes vx and vy for targeted movement
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 15;
        this.vx = vx; // Horizontal velocity
        this.vy = vy; // Vertical velocity
    }

    draw() {
        ctx.fillStyle = '#ff0000'; // Red color for bullets
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    // REVISED: Bullet update now uses vx and vy
    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
}



// REVISED: The Bot class now has its own physics properties like dy and isGrounded.
 // Time in ms between bot shots (made shorter for visibility)

// REVISED: The Bot class now has its own physics properties like dy and isGrounded.
class Bot {
    constructor(x, y, attachedObstacle) {
        this.x = x;
        this.y = y;
        this.width = BOT_SIZE;
        this.height = BOT_SIZE;
        this.dy = 0; // Vertical velocity for falling
        this.isGrounded = true; // Is the bot standing on something?
        this.attachedObstacle = attachedObstacle; // Reference to the obstacle it's on
        this.health = 1;
        this.lastShot = 0;
    }

    draw() {
        ctx.fillStyle = '#ff0000'; // Red for bots
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    // REVISED: The bot's update method now only handles gravity and scrolling.
    // The position is no longer snapped to the obstacle here.
    update(timestamp) {
        if (!this.isGrounded) {
            this.dy += GRAVITY;
            this.y += this.dy;
        }

        // The bot's x position moves with the screen scroll
        this.x -= SCROLL_SPEED;

        // Make the bot shoot at the player periodically
        if (timestamp - this.lastShot > BOT_SHOOT_INTERVAL && !isGameOver) { // Using BOT_SHOOT_INTERVAL
            this.shoot();
            this.lastShot = timestamp;
        }
    }

    shoot() {
        const bulletX = this.x - this.width / 2;
        const bulletY = this.y + this.height / 2;
        // Calculate direction vector to the player
        const dx = player.x - bulletX;
        const dy = player.y - bulletY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 7;
        const vx = (dx / distance) * speed;
        const vy = (dy / distance) * speed;

        botBullets.push(new BotBullet(bulletX, bulletY, vx, vy));
    }
}


class BotBullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.width = 8;
        this.height = 4;
        this.vx = vx;
        this.vy = vy;
    }

    draw() {
        ctx.fillStyle = '#0000FF'; // Orange-red for bot bullets
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
}

function checkBotCollisions() {
    bots.forEach(bot => {
        let isBotOnGround = false;

        // Check collision with the main floor
        const floorY = canvas.height - FLOOR_HEIGHT;
        if (bot.y + bot.height + bot.dy >= floorY) {
            bot.y = floorY - bot.height;
            bot.dy = 0;
            isBotOnGround = true;
            bot.attachedObstacle = null; // Detach from any obstacle
        }

        // Check collision with obstacles
        obstacles.forEach(obstacle => {
            obstacle.tiles.forEach(tile => {
                // Check if the bot's feet are above the tile and it's within the tile's x bounds
                if (bot.y + bot.height <= tile.y &&
                    bot.y + bot.height + bot.dy >= tile.y &&
                    bot.x + bot.width > tile.x &&
                    bot.x < tile.x + tile.width) {

                    // Snap bot to the top of the tile
                    bot.y = tile.y - bot.height;
                    bot.dy = 0;
                    isBotOnGround = true;
                    bot.attachedObstacle = obstacle; // Attach the bot to this obstacle
                }
            });
        });

        bot.isGrounded = isBotOnGround;

        // If the bot is grounded on an obstacle, make sure it moves with the obstacle
        if (bot.isGrounded && bot.attachedObstacle) {
            const topTile = bot.attachedObstacle.tiles[bot.attachedObstacle.tiles.length - 1];
            bot.y = topTile.y - bot.height;
        }
    });
}

// Array to hold all obstacles
const obstacles = [];

// Base Obstacle class for common properties and methods
class Obstacle {
    constructor(x, y, width, height, imageSrc, tileHeight) {
        this.id = uniqueObstacleId++;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.image = new Image();
        this.image.src = imageSrc;
        this.tileHeight = tileHeight;
        this.tiles = [];
        this.shouldBeRemoved = false;
    }

    // REVISED: The update method now checks the 'isStopped' flag.
    update(timestamp, isStopped) {
        if (!isStopped) {
            this.x -= SCROLL_SPEED;
            this.tiles.forEach(tile => {
                tile.x -= SCROLL_SPEED;
            });
        }
    }

    draw() {
        this.tiles.forEach(tile => {
            ctx.drawImage(this.image, tile.x, tile.y, tile.width, tile.height);
        });
    }
}

// New class for Wall Obstacles
class WallObstacle extends Obstacle {
    constructor(x, width, heightInTiles, tileHeight, base_y = canvas.height - FLOOR_HEIGHT) { // NEW: Add base_y parameter
        const finalTileHeight = tileHeight || 100;
        const finalHeightInTiles = heightInTiles || (Math.floor(Math.random() * 3) + 1);
        const finalWidth = width || (100 * (Math.floor(Math.random() * 2) + 1));
        const finalX = x || canvas.width;

        const height = finalHeightInTiles * finalTileHeight;
        const y = base_y - height; // NEW: Calculate y from the base_y

        super(finalX, y, finalWidth, height, 'wall.png', finalTileHeight);

        this.originalImage = new Image();
        this.originalImage.src = 'wall.png';
        this.hitImage = new Image();
        this.hitImage.src = 'wall-hit.png';

        for (let i = 0; i < finalHeightInTiles; i++) {
            this.tiles.push({
                x: this.x,
                y: this.y + (this.height - (i + 1) * this.tileHeight),
                width: this.width,
                height: this.tileHeight,
                health: 2,
                lastHitTimestamp: 0
            });
        }

        this.isAnimating = false;
        this.animationStartTime = 0;
        this.animationDuration = 100;
    }

    // REVISED: The update method now handles both horizontal movement and vertical animation.
    update(timestamp, isStopped) {
        // Handle the tile destruction animation
        if (this.isAnimating) {
            const elapsedTime = timestamp - this.animationStartTime;
            const progress = Math.min(elapsedTime / this.animationDuration, 1);

            for (let i = this.animationStartIndex; i < this.tiles.length; i++) {
                const tile = this.tiles[i];
                tile.y = tile.originalY + this.dropAmount * progress;
            }

            if (progress >= 1) {
                // Animation finished, snap to final positions and reset state
                this.isAnimating = false;
                this.animationStartTime = 0;

                // Update the originalY for future animations
                for (let i = this.animationStartIndex; i < this.tiles.length; i++) {
                    const tile = this.tiles[i];
                    tile.originalY = tile.y;
                }
            }
        }

        // Only move the obstacle and its tiles horizontally if the game is not stopped
        if (!isStopped) {
            this.x -= SCROLL_SPEED;
            this.tiles.forEach(tile => {
                tile.x -= SCROLL_SPEED;
            });
        }
    }

    draw(timestamp) {
        this.tiles.forEach(tile => {
            const imageToDraw = (timestamp - tile.lastHitTimestamp < 100)
                ? this.hitImage
                : this.originalImage;

            ctx.drawImage(imageToDraw, tile.x, tile.y, tile.width, tile.height);
        });
    }
}
// New class for Stairs Obstacles
class StairsObstacle extends Obstacle {
    constructor(x, numStairs, base_y = canvas.height - FLOOR_HEIGHT) { // NEW: Add base_y parameter
        const tileWidth = 100;
        const tileHeight = 100;

        const finalNumStairs = numStairs || (Math.floor(Math.random() * 3) + 1);
        const finalX = x || canvas.width;

        const width = tileWidth * finalNumStairs;
        const height = tileHeight * finalNumStairs;
        const y = base_y - height; // NEW: Calculate y from the base_y

        super(finalX, y, width, height, 'stairs.png', tileHeight);

        this.originalImage = new Image();
        this.originalImage.src = 'stairs.png';
        this.hitImage = new Image();
        this.hitImage.src = 'stairs-hit.png';

        for (let i = 0; i < finalNumStairs; i++) {
            this.tiles.push({
                x: this.x + i * tileWidth,
                y: this.y + (height - ((i + 1) * tileHeight)),
                width: tileWidth,
                height: tileHeight,
                health: 2,
                lastHitTimestamp: 0
            });
        }

        this.isBreaking = false;
        this.breakStartTime = 0;
        this.breakDelay = 100;
        this.breakIndex = -1;
    }

    // New update method to handle timed breaks and movement
    update(timestamp, isStopped) {
        // Handle the timed breaking sequence
        if (this.isBreaking) {
            if (timestamp - this.breakStartTime >= this.breakDelay) {
                // Remove the tile at the current breakIndex
                this.tiles.splice(this.breakIndex, 1);

                // If there are more tiles to break, update the break state
                if (this.breakIndex < this.tiles.length) {
                    this.breakStartTime = timestamp;
                } else {
                    // This is the last tile to break. Set flag to be removed.
                    this.shouldBeRemoved = true;
                    // Also set the flag for the connected ramp and any obstacles on top of it.
                    if (this.connectedRamp) {
                        this.connectedRamp.shouldBeRemoved = true;
                        this.connectedRamp.obstaclesOnTop.forEach(obstacle => {
                            obstacle.shouldBeRemoved = true;
                        });
                    }
                    // No more tiles to break, reset the state
                    this.isBreaking = false;
                    this.breakIndex = -1;
                }
            }
        }
        // Only move the obstacle and its tiles horizontally if the game is not stopped
        if (!isStopped) {
            this.x -= SCROLL_SPEED;
            this.tiles.forEach(tile => {
                tile.x -= SCROLL_SPEED;
            });
        }
    }
    draw(timestamp) {
        this.tiles.forEach(tile => {
            const imageToDraw = (timestamp - tile.lastHitTimestamp < 100)
                ? this.hitImage
                : this.originalImage;

            ctx.drawImage(imageToDraw, tile.x, tile.y, tile.width, tile.height);
        });
    }
}

// NEW: Class for FloorRamp Obstacles
// NEW: Class for FloorRamp Obstacles

class RampObstacle extends Obstacle {

    constructor(x, y, numTiles, connectedObstacle) {
        const tileWidth = 100;
        const tileHeight = 5;
        const width = tileWidth * numTiles;
        const height = tileHeight;
        const imageSrc = 'floor.png';
        super(x, y, width, height, imageSrc, tileHeight);

        this.connectedObstacle = connectedObstacle;
        this.obstaclesOnTop = []; 

        for (let i = 0; i < numTiles; i++) {

            this.tiles.push({
                x: this.x + i * tileWidth,
                y: this.y,
                width: tileWidth,
                height: tileHeight,
                health: 1

            });
        }
    }

    update(timestamp, isStopped) {
        super.update(timestamp, isStopped);
        if (this.connectedObstacle.shouldBeRemoved) {
            this.shouldBeRemoved = true;
        }
    }

    draw() {

        this.tiles.forEach(tile => {
            ctx.drawImage(this.image, tile.x, tile.y + tile.height - 100 + 50, tile.width, 100);

        });

    }

}


function checkBulletCollisions() {
    // Check for player bullet collisions with bots
    bullets.forEach((bullet, bulletIndex) => {
        bots.forEach((bot, botIndex) => {
            if (bullet.x < bot.x + bot.width &&
                bullet.x + bullet.width > bot.x &&
                bullet.y < bot.y + bot.height &&
                bullet.y + bullet.height > bot.y) {

                // Collision detected!
                bot.health--;
                bullets.splice(bulletIndex, 1); // Remove the bullet

                if (bot.health <= 0) {
                    bots.splice(botIndex, 1); // Remove the bot
                }
            }
        });
    });

    // Check for bot bullet collisions with player
    botBullets.forEach((bullet, bulletIndex) => {
        if (bullet.x < player.x + player.width &&
            bullet.x + bullet.width > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + bullet.height > player.y) {

            // Collision detected!
            player.health -= PLAYER_DAMAGE_PER_HIT; // NEW: Decrease player health
            healthDisplay.innerText = `Health: ${player.health}`; // NEW: Update health display

            if (player.health <= 0) { // NEW: Check if health is zero or less
                isGameOver = true;
                gameOver();
            }
            botBullets.splice(bulletIndex, 1); // Remove the bullet
        }
    });


   


    
}
function handleObstacleSpawning(timestamp) {
    if (!lastObstacleSpawn) lastObstacleSpawn = timestamp;

    const timeSinceLastSpawn = timestamp - lastObstacleSpawn;

    // Check if the game is ready to spawn
    const lastObstacle = obstacles[obstacles.length - 1];
    const isSafeToSpawn = lastObstacle


        ? (lastObstacle.x + lastObstacle.width + lastPresetNextGap < canvas.width)
        : true; // It's always safe to spawn if there are no obstacles

  

    if (timeSinceLastSpawn >= PRESET_SPAWN_INTERVAL && isSafeToSpawn) {
        let list = [];
        let PresetNumber = 1;

        let randomIndex = Math.floor(Math.random() * list.length);
        oldnumber = randomIndex;

        if (score < 100) {
            spawnRandomStructure(PresetNumber);
        }
        else if (score < 200) {

            list = [preset1010, preset1011, preset1012, preset1013, preset1014, preset1015];

            while (randomIndex === oldnumber) {
                oldnumber = randomIndex; // Ensure a new random index is selected
                randomIndex = Math.floor(Math.random() * list.length);
            }


            PresetNumber = randomIndex + 2;

            console.log(`sd preset: ${PresetNumber}`);
            PRESET_SPAWN_INTERVAL = 2000; // Adjust spawn interval for higher scores

            spawnRandomStructure(PresetNumber);
        }
        else if (score < 300) {

            createObstacle();
        }
        else if (score < 400) {

            if (Math.random() < 0.4) { createStairsObstacle(); } else { createObstacle(); }
        }
        else if (score < 500) {

            canSpawnBot = true;
            spawnRandomStructure();
        }
        else if (score < 600) {
            PRESET_SPAWN_INTERVAL = 100;
            if (Math.random() < 0.4) { spawnRandomStructure(); } else { RandomRandom(); }
            
        }
        else if (score < 700) {

            if (Math.random() < 0.4) { spawnRandomStructure(); } else { RandomRandom(); }
           
        }
        else if (score < 800) {
            PRESET_SPAWN_INTERVAL = 80;
            if (Math.random() < 0.4) { spawnRandomStructure(); } else { RandomRandom(); }
       
           
        }
        else if (score < 900) {
            botspawn = 0.2; // Increase bot spawn chance
            if (Math.random() < 0.4) { spawnRandomStructure(); } else { RandomRandom(); }
           
        }
        else if (score < 1000) {

            PRESET_SPAWN_INTERVAL = 70;
            if (Math.random() < 0.4) { spawnRandomStructure(); } else { RandomRandom(); }
        }



        lastObstacleSpawn = timestamp;
    }
}

function handleSpeed() {

    if (score <= SCORE_THRESHOLD_FOR_MAX_SPEED) {


        const progress = Math.min(score / SCORE_THRESHOLD_FOR_MAX_SPEED, 1);
        SCROLL_SPEED = ORIGINAL_SCROLL_SPEED + (TARGET_SPEED - ORIGINAL_SCROLL_SPEED) * progress;

    }
    else {
        speedChange();
    }

    if (TARGET_SPEED <= ORIGINAL_SCROLL_SPEED) {

        if (SCROLL_SPEED === 0) {

            cancelAnimationFrame(animationFrameId);
            clearInterval(scoreIntervalId);
        }


        const progress = Math.min(score / SCORE_THRESHOLD_FOR_MAX_SPEED, 1);
        SCROLL_SPEED = ORIGINAL_SCROLL_SPEED * (1 - progress)



    }


}

function speedChange()
{

   if (score >= 950) {

        ORIGINAL_SCROLL_SPEED = SCROLL_SPEED;
        SCORE_THRESHOLD_FOR_MAX_SPEED = 1100;
        TARGET_SPEED = 0;
    }
   else if (score >= 700) {
       ORIGINAL_SCROLL_SPEED = SCROLL_SPEED;
       SCORE_THRESHOLD_FOR_MAX_SPEED = 980;
       TARGET_SPEED = 20;
    }
   else if (score >= 300) {

       ORIGINAL_SCROLL_SPEED = SCROLL_SPEED;
       SCORE_THRESHOLD_FOR_MAX_SPEED = 700;
       TARGET_SPEED = 20;

   }
    else if (score >= 100) {
        ORIGINAL_SCROLL_SPEED = SCROLL_SPEED;
        TARGET_SPEED = 15;
        BULLET_SPEED = 15;
        SCORE_THRESHOLD_FOR_MAX_SPEED = 300;

    }
    

    


}

function createRandomPreset() {
    const preset = {
        obstacles: []
    };

    // Define a default tile size for calculations
    const TILE_SIZE = 100;
    const TILE_WIDTH = 100; // Assuming walls and stairs tiles are 100x100
    // Assuming walls and stairs tiles are 100x100

    // --- First Obstacle ---
    const initialObstacleType = Math.random() < 0.5 ? "wall" : "stairs"; // Randomly choose wall or stairs
    const initialNumbOfTiles = Math.floor(Math.random() * 3) + 1; // 1 to 3 tiles high/long

    let initialObstacle = {
        type: initialObstacleType,
        xOffset: 0 // This obstacle starts at the beginning of the preset's spawn point
    };

    if (initialObstacleType === "wall") {
        initialObstacle.width = TILE_WIDTH;
        initialObstacle.heightInTiles = initialNumbOfTiles;
        initialObstacle.tileHeight = TILE_SIZE;
    } else { // stairs
        initialObstacle.numStairs = initialNumbOfTiles;
    }

    const hasRampForInitial = Math.random() < 0.5; // 50% chance for a ramp
    if (hasRampForInitial) {
        initialObstacle.linkRamp = Math.floor(Math.random() * 3) + 1; // 1 to 3 ramp tiles
    }

    preset.obstacles.push(initialObstacle);

    // --- Obstacle on the First Ramp (if it exists) ---
    if (hasRampForInitial) {
        // Calculate the length of the ramp that would be linked to the initial obstacle
        const rampLength = initialObstacle.linkRamp * TILE_SIZE;
        const rampObstacleChance = Math.random() < 0.5; // 50% chance for an obstacle on the ramp

        if (rampObstacleChance) {
            const rampObstacleType = Math.random() < 0.5 ? "wall" : "stairs";
            const rampObstacleNumbOfTiles = Math.floor(Math.random() * 3) + 1; // 1 to 3 tiles high/long

            // Calculate xOffset for obstacle on ramp. It should be within the ramp's length.
            // Ensure it's not too close to the start or end of the ramp.
            // Min offset 50, Max offset (rampLength - TILE_SIZE - 50) to keep it inside
            const minRampOffset = 50;
            const maxRampOffset = Math.max(minRampOffset, rampLength - TILE_SIZE - 50); // Ensure max is not less than min
            const rampObstacleXOffset = Math.floor(Math.random() * (maxRampOffset - minRampOffset + 1)) + minRampOffset;


            let rampObstacle = {
                type: rampObstacleType,
                xOffset: rampObstacleXOffset, // This offset is relative to the start of the ramp
                onRamp: true // This flag tells the spawning logic to place it on the preceding ramp
            };

            if (rampObstacleType === "wall") {
                rampObstacle.width = TILE_WIDTH;
                rampObstacle.heightInTiles = rampObstacleNumbOfTiles;
                rampObstacle.tileHeight = TILE_SIZE;
            } else { // stairs
                rampObstacle.numStairs = rampObstacleNumbOfTiles;
            }

            const hasRampForRampObstacle = Math.random() < 0.5; // 50% chance for this obstacle to have its own ramp
            if (hasRampForRampObstacle) {
                rampObstacle.linkRamp = Math.floor(Math.random() * 3) + 1; // 1 to 3 ramp tiles
            }
            preset.obstacles.push(rampObstacle);
        }
    }

    // --- Set the nextPresetGap ---
    // Assuming SAFE_SPAWN_GAP is defined elsewhere, e.g., const SAFE_SPAWN_GAP = 200;
    // This will create a gap between 200 and 299 pixels.
    preset.nextPresetGap = Math.floor(Math.random() * 100) + SAFE_SPAWN_GAP;

    return preset;
}
function spawnBotOnObstacle(obstacle) {
    // There's a 50% chance a bot will spawn on the new obstacle
    if (Math.random() < botspawn) {
        const topTile = obstacle.tiles[obstacle.tiles.length - 1];
        const spawnX = topTile.x + topTile.width / 2 - BOT_SIZE / 2;
        const spawnY = topTile.y - BOT_SIZE;
        bots.push(new Bot(spawnX, spawnY, obstacle));
    }
}
// Function to create a new wall obstacle and a connected ramp
function createObstacle() {
    lastPresetNextGap = SAFE_SPAWN_GAP;
    const width = OBSTACLE_TILE_WIDTH * TILE_WIDTH;
    const heightInTiles = Math.floor(Math.random() * OBSTACLE_MAX_TILES_HIGH) + 1;
    const newWall = new WallObstacle(canvas.width, width, heightInTiles, OBSTACLE_TILE_HEIGHT);
    obstacles.push(newWall);

    // Get a reference to the highest tile to set the ramp's position
    const highestTile = newWall.tiles[newWall.tiles.length - 1];

    // Create a ramp and connect it to the wall
    const startX = newWall.x + newWall.width;
    const numRampTiles = Math.floor(Math.random() * 3) + 1;
    const newRamp = new RampObstacle(startX, highestTile.y, numRampTiles, newWall);
    obstacles.push(newRamp);

    // NEW: The wall now also holds a reference to the ramp
    newWall.connectedRamp = newRamp;

    lastObstacle = newRamp;

    if (canSpawnBot) {
        spawnBotOnObstacle(newWall);
    }
    
}

// Function to create a new stairs obstacle and a connected ramp
function createStairsObstacle() {
    const newStairs = new StairsObstacle(canvas.width);
    obstacles.push(newStairs);
    lastPresetNextGap = SAFE_SPAWN_GAP;
    // Get a reference to the highest tile of the newly created stairs
    const highestTile = newStairs.tiles[newStairs.tiles.length - 1];

    // Create a ramp and connect it to the stairs
    const startX = newStairs.x + newStairs.width;
    const numRampTiles = Math.floor(Math.random() * 3) + 1;
    const newRamp = new RampObstacle(startX, highestTile.y, numRampTiles, newStairs);
    obstacles.push(newRamp);

    // NEW: The stairs now also hold a reference to the ramp
    newStairs.connectedRamp = newRamp;

    lastObstacle = newRamp;

    if (canSpawnBot) {
        spawnBotOnObstacle(newRamp);
    }
}


function RandomRandom(PresetNumber) {
    


    const selectedPreset = createRandomPreset();
    const selectedPresetData = selectedPreset.obstacles;



    lastPresetNextGap = selectedPreset.nextPresetGap || SAFE_SPAWN_GAP;

    const newObstacles = [];
    const startX = canvas.width;
    let lastRamp = null;

    for (let i = 0; i < selectedPresetData.length; i++) {
        const data = selectedPresetData[i];
        let newObstacle;

        let obstacleX = startX + data.xOffset;
        let obstacleY = canvas.height - FLOOR_HEIGHT;

        if (data.onRamp && lastRamp) {
            obstacleX = lastRamp.x + data.xOffset;
            obstacleY = lastRamp.y;
        }

        switch (data.type) {
            case 'wall':
                newObstacle = new WallObstacle(
                    obstacleX,
                    data.width,
                    data.heightInTiles,
                    data.tileHeight,
                    obstacleY
                );
                break;
            case 'stairs':
                newObstacle = new StairsObstacle(obstacleX, data.numStairs, obstacleY);
                break;
        }

        if (newObstacle) {
            newObstacles.push(newObstacle);

            // NEW: If onRamp is true, add the obstacle to the ramp's array
            if (data.onRamp && lastRamp) {
                lastRamp.obstaclesOnTop.push(newObstacle);
            }

            if (canSpawnBot) {
                spawnBotOnObstacle(newObstacle);
            }

            if (typeof data.linkRamp === 'number') {
                const numRampTiles = data.linkRamp;
                const platformY = newObstacle.tiles[newObstacle.tiles.length - 1].y;

                const newPlatform = new RampObstacle(
                    newObstacle.x + newObstacle.width,
                    platformY,
                    numRampTiles,
                    newObstacle
                );
                newObstacles.push(newPlatform);
                newObstacle.connectedRamp = newPlatform;
                lastRamp = newPlatform;
            } else {
                lastRamp = null; // Clear the last ramp if no new one is created
            }
        }
    }

    obstacles.push(...newObstacles);
}


const preset1 = {
    nextPresetGap: 100,
    obstacles: [
        { type: 'wall', width: 100, heightInTiles: 3, tileHeight: 100, xOffset: 0, linkRamp: 2 }
    ]
};

const preset101 = {
    nextPresetGap: 100,
    obstacles: [
        { type: 'wall', width: 100, heightInTiles: 1, tileHeight: 100, xOffset: 0 }
    ]
};

const preset1010 = {
    nextPresetGap: 50,
    obstacles: [
        { type: 'wall', width: 100, heightInTiles: 1, tileHeight: 100, xOffset: 0, linkRamp: 1 }
    ]
};

const preset1011 = {
    nextPresetGap: 50,
    obstacles: [
        { type: 'wall', width: 100, heightInTiles: 1, tileHeight: 100, xOffset: 0, linkRamp: 2 }
    ]
};

const preset1012 = {
    nextPresetGap: 50,
    obstacles: [
        { type: 'wall', width: 100, heightInTiles: 2, tileHeight: 100, xOffset: 0, linkRamp: 2 }
    ]
};

const preset1013 = {
    nextPresetGap: 50,
    obstacles: [
        { type: 'wall', width: 100, heightInTiles: 2, tileHeight: 100, xOffset: 0, linkRamp: 1 }
    ]
};

const preset1014 = {
    nextPresetGap: 50,
    obstacles: [
        { type: 'wall', width: 100, heightInTiles: 2, tileHeight: 100, xOffset: 0}
    ]
};

const preset1015 = {
    nextPresetGap: 50,
    obstacles: [
        { type: 'wall', width: 100, heightInTiles: 1, tileHeight: 100, xOffset: 0 }
    ]
};

const preset102 = {
    nextPresetGap: 100,
    obstacles: [
        { type: 'wall', width: 100, heightInTiles: 1, tileHeight: 100, xOffset: 0, linkRamp: 2 },
         { type: 'wall', width: 100, heightInTiles: 2, tileHeight: 100, xOffset: 100, onRamp: true }
    ]
};

// A stairs obstacle with a 3-tile ramp (300px), followed by a wall
const preset2 = {
    nextPresetGap: 300,
    obstacles: [
        { type: 'stairs', numStairs: 3, xOffset: 0, linkRamp: 3 },
        // xOffset of 400 is calculated as: stairs width (300) + ramp width (300) + gap (100)
        { type: 'wall', width: 100, heightInTiles: 2, tileHeight: 100, xOffset: 700 }
    ]
};

// A complex structure with multiple custom ramps
const preset3 = {
    nextPresetGap: 100,
    obstacles: [
        { type: 'stairs', numStairs: 2, xOffset: 0, linkRamp: 2 },
        // This wall is now placed on the ramp from the previous stairs
        { type: 'wall', width: 100, heightInTiles: 1, tileHeight: 100, xOffset: 100, onRamp: true },
        { type: 'stairs', numStairs: 1, xOffset: 500 }
    ]
};

// Another example with a wall placed on a ramp
const preset4 = {
    nextPresetGap: 100,
    obstacles: [
        { type: 'stairs', numStairs: 2, xOffset: 0, linkRamp: 2 },
        // A wall is placed on the ramp. Its xOffset is relative to the *start* of the ramp.
        { type: 'wall', width: 100, heightInTiles: 3, tileHeight: 100, xOffset: 100, onRamp: true },
        { type: 'stairs', numStairs: 1, xOffset: 400 }
    ]
};

const preset5 = {
    nextPresetGap: 200,
    obstacles: [
        // A small wall
        { type: 'wall', width: 100, heightInTiles: 2, tileHeight: 100, xOffset: 0 },
        // A medium wall, staggered to the right
        { type: 'wall', width: 100, heightInTiles: 3, tileHeight: 100, xOffset: 200 },
        // A tall wall, staggered even further
        { type: 'wall', width: 100, heightInTiles: 4, tileHeight: 100, xOffset: 400 }
    ]
};

// A long ramp that's blocked by a wall in the middle
const preset6 = {
    nextPresetGap: 200,
    obstacles: [
        // A stairs section to get the player up to the ramp's height
        { type: 'stairs', numStairs: 2, xOffset: 0, linkRamp: 3 },
        // A wall placed on the ramp, creating the "broken" section
        { type: 'wall', width: 100, heightInTiles: 2, tileHeight: 100, xOffset: 200, onRamp: true },
        // Another stairs section to descend, placed after the wall on the ramp
        { type: 'stairs', numStairs: 1, xOffset: 400, onRamp: true }
    ]
};

// A large, imposing defensive gate
const preset7= {
    nextPresetGap: 400,
    obstacles: [
        // The first section of the gate
        { type: 'wall', width: 100, heightInTiles: 3, tileHeight: 100, xOffset: 0, linkRamp: 1 },
        // A second, taller wall placed after a gap
        { type: 'wall', width: 100, heightInTiles: 3, tileHeight: 100, xOffset: 0, onRamp: true }
    ]
};

const preset8 = {
    nextPresetGap: 300,
    obstacles: [
        // A low wall to begin the tunnel
        { type: 'wall', width: 100, heightInTiles: 2, tileHeight: 100, xOffset: 0 },
        // A second, similar wall placed right after a small gap
        { type: 'wall', width: 100, heightInTiles: 2, tileHeight: 100, xOffset: 200 },
        // A third wall to complete the tunnel
        { type: 'wall', width: 100, heightInTiles: 2, tileHeight: 100, xOffset: 400 }
    ]
};

const preset9 = {
    nextPresetGap: 250,
    obstacles: [
        // A set of stairs to go up
        { type: 'stairs', numStairs: 2, xOffset: 0, linkRamp: 1 },
        // A second set of stairs, placed on the ramp, to go down
        { type: 'stairs', numStairs: 2, xOffset: 100, onRamp: true }
    ]
};
const preset10 = {
    nextPresetGap: 300,
    obstacles: [
        // A low, flat platform
        { type: 'wall', width: 100, heightInTiles: 1, tileHeight: 100, xOffset: 0 },
        // A second platform after a gap
        { type: 'wall', width: 100, heightInTiles: 1, tileHeight: 100, xOffset: 250 },
        // A third platform after another gap
        { type: 'wall', width: 100, heightInTiles: 1, tileHeight: 100, xOffset: 500 }
    ]
};

const preset11 = {
    nextPresetGap: 300,
    obstacles: [
        // A set of stairs to go up
        { type: 'stairs', numStairs: 2, xOffset: 0, linkRamp: 1 },
        { type: 'wall', width: 100, heightInTiles: 1, tileHeight: 100, xOffset: 100, onRamp: true, linkRamp: 1 },
        { type: 'stairs', numStairs: 2, xOffset: 100, onRamp: true }
    ]
};
const allPresets = [
    preset1,
    preset101,
    preset1010,
    preset1011,
    preset1012,
    preset1013,
    preset1014,
    preset1015,
    preset102,
  preset2,
  preset3,
  preset4,
  preset5,
  preset6,
  preset7,
    preset8,
    preset9,
    preset10,
    preset11,
   

   //myCustomPreset // Add your new preset here 
];

function spawnRandomStructure(PresetNumber) {
    let randomIndex = Math.floor(Math.random() * allPresets.length);


    const selectedPreset = allPresets[PresetNumber] || allPresets[randomIndex];
    const selectedPresetData = selectedPreset.obstacles;

   

    lastPresetNextGap = selectedPreset.nextPresetGap || SAFE_SPAWN_GAP;

    const newObstacles = [];
    const startX = canvas.width;
    let lastRamp = null;

    for (let i = 0; i < selectedPresetData.length; i++) {
        const data = selectedPresetData[i];
        let newObstacle;

        let obstacleX = startX + data.xOffset;
        let obstacleY = canvas.height - FLOOR_HEIGHT;

        if (data.onRamp && lastRamp) {
            obstacleX = lastRamp.x + data.xOffset;
            obstacleY = lastRamp.y;
        }

        switch (data.type) {
            case 'wall':
                newObstacle = new WallObstacle(
                    obstacleX,
                    data.width,
                    data.heightInTiles,
                    data.tileHeight,
                    obstacleY
                );
                break;
            case 'stairs':
                newObstacle = new StairsObstacle(obstacleX, data.numStairs, obstacleY);
                break;
        }

        if (newObstacle) {
            newObstacles.push(newObstacle);

            // NEW: If onRamp is true, add the obstacle to the ramp's array
            if (data.onRamp && lastRamp) {
                lastRamp.obstaclesOnTop.push(newObstacle);
            }

            if (canSpawnBot) {
                spawnBotOnObstacle(newObstacle);
            }

            if (typeof data.linkRamp === 'number') {
                const numRampTiles = data.linkRamp;
                const platformY = newObstacle.tiles[newObstacle.tiles.length - 1].y;

                const newPlatform = new RampObstacle(
                    newObstacle.x + newObstacle.width,
                    platformY,
                    numRampTiles,
                    newObstacle
                );
                newObstacles.push(newPlatform);
                newObstacle.connectedRamp = newPlatform;
                lastRamp = newPlatform;
            } else {
                lastRamp = null; // Clear the last ramp if no new one is created
            }
        }
    }

    obstacles.push(...newObstacles);
}
// The main game loop
function removeRampAndDependencies(ramp) {
    // Find the ramp's index in the main obstacles array
    const rampIndex = obstacles.indexOf(ramp);
    if (rampIndex === -1) {
        return; // The ramp has already been removed
    }

    // Check if there are obstacles on top of this ramp
    if (ramp.obstaclesOnTop && ramp.obstaclesOnTop.length > 0) {
        // Iterate through the obstacles on top and remove them first
        // Use a shallow copy to prevent issues with splice modifying the array we are iterating
        for (const stackedObstacle of [...ramp.obstaclesOnTop]) {
            // Check if the stacked obstacle has a ramp connected to it.
            // This handles cases where a Wall or Stairs has its own ramp.
            if (stackedObstacle.connectedRamp) {
                removeRampAndDependencies(stackedObstacle.connectedRamp);
            }

            // Now, remove the stacked obstacle itself
            const stackedIndex = obstacles.indexOf(stackedObstacle);
            if (stackedIndex !== -1) {
                obstacles.splice(stackedIndex, 1);
            }
        }
    }

    // Finally, remove the ramp itself
    obstacles.splice(rampIndex, 1);
}


function animate(timestamp) {
    if (isGameOver) return;

    // Clear the canvas on each frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);


    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.update();
        bullet.draw();

        // Remove bullet if it goes off-screen
        if (bullet.x > canvas.width) {
            bullets.splice(i, 1);
            continue;
        }

        // Check for collision with obstacle tiles
        for (let j = 0; j < obstacles.length; j++) {
            const obstacle = obstacles[j];

            // Check if the bullet collides with ANY tile of the current obstacle
            for (let k = obstacle.tiles.length - 1; k >= 0; k--) {
                const tile = obstacle.tiles[k];
                if (
                    bullet.x < tile.x + tile.width &&
                    bullet.x + bullet.width > tile.x &&
                    bullet.y < tile.y + tile.height &&
                    bullet.y + bullet.height > tile.y
                ) {
                    // Logic for a direct hit on a ramp
                    if (obstacle instanceof RampObstacle) {
                        obstacles.splice(j, 1);
                        j--;
                        // If the ramp was connected to an obstacle, break that link
                        if (obstacle.connectedObstacle) {
                            obstacle.connectedObstacle.connectedRamp = null;
                        }
                    }
                    // NEW: Logic for Wall Obstacles
                    else if (obstacle instanceof WallObstacle) {
                        tile.health--;
                        tile.lastHitTimestamp = timestamp;

                        if (tile.health <= 0) {
                            

                            const removedTile = obstacle.tiles.splice(k, 1)[0];
                            obstacle.height -= removedTile.height;

                            // Animate tiles above the destroyed one to drop down
                            if (k < obstacle.tiles.length) {
                                obstacle.isAnimating = true;
                                obstacle.animationStartTime = timestamp;
                                obstacle.dropAmount = removedTile.height;
                                obstacle.animationStartIndex = k;

                                // Store original Y positions for animation
                                for (let i = k; i < obstacle.tiles.length; i++) {
                                    obstacle.tiles[i].originalY = obstacle.tiles[i].y;
                                }
                            }

                            // Only remove the entire wall obstacle if all its tiles are gone
                            if (obstacle.tiles.length === 0) {
                                
                                obstacles.splice(j, 1);
                                j--;
                            }

                            // Also remove the connected ramp if it exists and a tile was just broken
                            if (obstacle.connectedRamp) {
                                // NEW: Call the new recursive function to handle ramp and its dependencies
                                removeRampAndDependencies(obstacle.connectedRamp);
                            }
                        }
                    }

                    else if (obstacle instanceof StairsObstacle) {
                        tile.health--;
                        tile.lastHitTimestamp = timestamp;

                        if (tile.health <= 0) {
                            // Start the timed breaking sequence
                            // We set isBreaking to true and record the initial break index
                            obstacle.isBreaking = true;
                            obstacle.breakStartTime = timestamp;
                            obstacle.breakIndex = k;

                            // If the stairs are completely destroyed, remove the obstacle from the game
                            if (obstacle.tiles.length === 0) {
                                obstacles.splice(j, 1);
                                j--;
                            }

                            if (obstacle.connectedRamp) {
                                // NEW: Call the new recursive function to handle ramp and its dependencies
                                removeRampAndDependencies(obstacle.connectedRamp);
                            }

                        }
                    }

                    bullets.splice(i, 1);
                    i--;
                    break;
                }
            }
        }
    }



    handleSpeed();
    purpleBox.update();
    purpleBox.draw();

    bots = bots.filter(bot => bot.x + bot.width > 0);
    bots.forEach(b => b.draw());
    
    botBullets.forEach(bullet => bullet.update());

    botBullets.forEach(bullet => bullet.draw());
    checkBotCollisions();
    checkBulletCollisions();

    if (!isStopped) {
        // Draw and update the bumpy floor
        for (let i = floorTiles.length - 1; i >= 0; i--) {
            const tile = floorTiles[i];
            tile.x -= SCROLL_SPEED;
            ctx.fillStyle = '#cccccc';
            ctx.fillRect(tile.x, tile.y, tile.width, tile.height);
            if (tile.x + tile.width < 0) {
                floorTiles.splice(i, 1);
                createFloorTile(canvas.width);
            }
        }

        bots.forEach(b => b.update(timestamp));
        handleObstacleSpawning(timestamp);
    } else { // Game is stopped
        // The floor should be drawn but not updated
        for (let i = 0; i < floorTiles.length; i++) {
            const tile = floorTiles[i];
            ctx.fillStyle = '#cccccc';
            ctx.fillRect(tile.x, tile.y, tile.width, tile.height);
        }
    }

    // --- NEW: Unified Loop for Obstacles ---
    // This loop runs every frame, regardless of the 'isStopped' state.
    // This allows the wall tile destruction animation to complete.
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];

        // Call the obstacle's update method with the current timestamp and game state.
        // The obstacle's own logic will determine whether to move or not.
        if (o.update) {
            o.update(timestamp, isStopped);
        }

        // Always draw the obstacle.
        if (o.draw) {
            o.draw(timestamp);
        }

        // Only remove obstacles that have scrolled off-screen if the game is running.
        if (!isStopped && o.x + o.width < 0) {
            obstacles.splice(i, 1);
         
        }
    }



    if (isPlayerShooting && timestamp - lastPlayerShotTime > PLAYER_SHOOT_INTERVAL && !isGameOver) {
        player.shoot(lastMouseX, lastMouseY);
        lastPlayerShotTime = timestamp;
    }
  

    // Update and draw player
    player.update();
    player.draw();

    let isPlayerOnGroundOrPlatform = false;
    let onObstacle = false;
    let sideCollisionOccurred = false;

    // --- REVISED COLLISION RESOLUTION ---
    for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        for (let j = 0; j < o.tiles.length; j++) {
            const tile = o.tiles[j];
            if (
                player.x < tile.x + tile.width &&
                player.x + player.width > tile.x &&
                player.y < tile.y + tile.height &&
                player.y + player.height > tile.y
            ) {
                
                if ((o instanceof RampObstacle || (o instanceof WallObstacle && j === o.tiles.length - 1)) && player.dy >= 0 && player.y_prev + player.height <= tile.y) {
                    onObstacle = true;
                    onObstacle = true;
                    player.y = tile.y - player.height;
                    player.dy = 0;
                    isPlayerOnGroundOrPlatform = true;
                    player.onPlatform = o;
                    player.platformOffset = player.x - o.x;
                } else {
                    if (o instanceof StairsObstacle) {
                        // Determine the player's position relative to the current stair tile's left edge
                        const relativeX = (player.x + player.width) - tile.x;

                        // Calculate the new player y based on the relative x position and the stair's slope
                        // The stair has a 1:1 slope (100px width, 100px height).
                        // We offset the y position so the player's feet are on the stair, not the top-left corner.
                        const newY = tile.y + tile.height - player.height - relativeX;

                        // Only update the player's y position if they are below the stair's top
                        if (player.y > newY) {
                            player.y = newY;
                            player.isGrounded = true;
                            isPlayerOnGroundOrPlatform = true;
                        }
                    }
                    else {

                        if (player.dx > 0 && player.x + player.width > tile.x && player.x_prev + player.width <= tile.x) {
                            player.x = tile.x - player.width;
                        } else if (player.dx < 0 && player.x < tile.x + tile.width && player.x_prev >= tile.x + tile.width) {
                            player.x = tile.x + tile.width;
                        }
                        sideCollisionOccurred = true;
                    }
                   
                }
            }
        }
    }



    let isCurrentlyOnPlatform = false;
    for (const o of obstacles) {
        for (const tile of o.tiles) {
            if (
                player.x < tile.x + tile.width &&
                player.x + player.width > tile.x &&
                player.y + player.height === tile.y
            ) {
                isCurrentlyOnPlatform = true;
                break;
            }
        }
    }

    if (isCurrentlyOnPlatform) {
        isPlayerOnGroundOrPlatform = true;
    }

    if (!onObstacle && player.onPlatform) {
        player.onPlatform = null;
        player.platformOffset = 0;
    }

    let onFloor = false;
    const floorY = canvas.height - FLOOR_HEIGHT;
    if (player.y + player.height >= floorY) {
        player.y = floorY - player.height;
        player.dy = 0;
        isPlayerOnGroundOrPlatform = true;
        onFloor = true;
    }

    player.isGrounded = isPlayerOnGroundOrPlatform;

    // --- REVISED GAME STATE LOGIC FOR STABLE COLLISION HANDLING ---
    // The game stops if a side collision occurs.
    isStopped = sideCollisionOccurred;

    // The purple box only chases the player when the game is intentionally stopped.
    isPurpleBoxChasing = isStopped;

    // Player horizontal movement logic
    // This logic ensures the player can move back to the center and prevents
    // the shaking by only executing when the game is not stopped.
    if (player.onPlatform) {
        player.x = player.onPlatform.x + player.platformOffset;
    } else if (!isStopped && player.x !== playerStartX) {
        const direction = player.x < playerStartX ? 1 : -1;
        player.x += direction * 5;
        if ((direction > 0 && player.x >= playerStartX) || (direction < 0 && player.x <= playerStartX)) {
            player.x = playerStartX;
        }
    }


    // Game over conditions
    if (
        player.x < purpleBox.x + purpleBox.width &&
        player.x + player.width > purpleBox.x &&
        player.y < purpleBox.y + purpleBox.height &&
        player.y + player.height > purpleBox.y
    ) {
        isGameOver = true;
        gameOver();
    }

    if (player.y > canvas.height) {
        isGameOver = true;
        gameOver();
    }

    // Update score display
    scoreDisplay.innerText = `Score: ${score}`;

    // Request the next frame of the animation
    animationFrameId = requestAnimationFrame(animate);
}
function gameOver() {
    cancelAnimationFrame(animationFrameId);
    clearInterval(scoreIntervalId);
    finalScoreDisplay.innerText = score;
    gameOverScreen.style.display = 'block';
}

function startScoring() {
    scoreIntervalId = setInterval(() => {
        score++;
        scoreDisplay.innerText = `Score: ${score}`;
    }, 150);
}


function restartGame() {
    isGameOver = false;
    score = 0;
    player.x = playerStartX;
    purpleBox.x = purpleboxStartX; // Reset purple box position
    player.y = canvas.height - PLAYER_SIZE - FLOOR_HEIGHT;
    player.dy = 0;
    gameOverScreen.style.display = 'none';

    ORIGINAL_SCROLL_SPEED = 5; 
    TARGET_SPEED = 10;
    SCORE_THRESHOLD_FOR_MAX_SPEED = 100;
    canSpawnBot = false;
    botspawn = 0.3; 
   
    initializeFloor();
    obstacles.length = 0;
    bots.length = 0;
    bullets.length = 0;
    botBullets.length = 0;
    player.health = PLAYER_INITIAL_HEALTH; // NEW: Reset player health
    healthDisplay.innerText = `Health: ${player.health}`; // NEW: Update health display

    startScoring();
    // Start the game loop again
    animate(0);
}

// Event listener for player jump
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        player.jump();
    }
});

document.addEventListener('mousedown', (e) => {
    if (!isGameOver && e.button === 0) {
        isPlayerShooting = true;
        // The first shot is still handled here
        const rect = canvas.getBoundingClientRect();
        lastMouseX = e.clientX - rect.left;
        lastMouseY = e.clientY - rect.top;
        player.shoot(lastMouseX, lastMouseY);
        lastPlayerShotTime = performance.now();
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        isPlayerShooting = false;
    }
});

// NEW: Add a mousemove listener to continuously update the mouse position
document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    lastMouseX = e.clientX - rect.left;
    lastMouseY = e.clientY - rect.top;
});


function gamewin()
{
    myImage.classList.add('is-animated');

   
    healthDisplay.innerText = ``;

    setTimeout(() => {
        ProImage.classList.add('is-animated');
        Button.classList.add('is-visible');
    }, 3000);


}

function next()
{
    console.log("Next Level"); 
    LargeImg.classList.add('is-animated');

    setTimeout(() => {

        window.location.href = ' ../scary/index.html';
    }, 3000);
}

let fullscreen = false; // Track fullscreen stat
window.onload = function () {
    restartGame();

    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) { // Firefox
        document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) { // Chrome, Safari and Opera
        document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) { // IE/Edge
        document.documentElement.msRequestFullscreen();
    }

    setTimeout(() => {

        if (document.fullscreenElement == null) {


            const overlay = document.createElement('div');
            overlay.id = 'fullscreen-overlay';
            overlay.innerHTML = `
        <p>Press 'ENTER' to go full screen.</p>
    `;
            document.body.appendChild(overlay);

            // Add an event listener to the document for the 'Enter' key
            document.addEventListener('keydown', blackImage);


        }
        else {
            fullscreen = true;
        }

    }, 100);
};

function blackImage(event) {
    if (event.key === 'Enter') {

        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) { // Firefox
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) { // Chrome, Safari and Opera
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { // IE/Edge
            document.documentElement.msRequestFullscreen();
        }


        // Remove the overlay and the event listener
        const overlay = document.getElementById('fullscreen-overlay');
        if (overlay) {
            overlay.remove();
        }
        document.removeEventListener('keydown', blackImage);

    }
}
