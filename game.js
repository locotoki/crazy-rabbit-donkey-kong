// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 700 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Game variables
let player;
let platforms;
let ladders;
let barrels;
let coins;
let enemies;
let score = 0;
let scoreText;
let gameOver = false;
let level = 1;
let lives = 3;
let livesText;
let levelText;
let cursors;
let jumpButton;
let isClimbing = false;

// Initialize the game
const game = new Phaser.Game(config);

// Preload game assets
function preload() {
    // Load images
    this.load.image('background', 'assets/background.png');
    this.load.image('platform', 'assets/platform.png');
    this.load.image('ladder', 'assets/ladder.png');
    this.load.image('barrel', 'assets/barrel.png');
    this.load.image('coin', 'assets/coin.png');
    this.load.image('enemy', 'assets/enemy.png');
    
    // Load spritesheets
    this.load.spritesheet('rabbit', 'assets/rabbit.png', { 
        frameWidth: 32, 
        frameHeight: 48 
    });
    
    // Load audio
    this.load.audio('jump', 'assets/jump.mp3');
    this.load.audio('collect', 'assets/collect.mp3');
    this.load.audio('hit', 'assets/hit.mp3');
    this.load.audio('levelup', 'assets/levelup.mp3');
}

// Create game elements
function create() {
    // Add background
    this.add.image(400, 300, 'background');
    
    // Set up sounds
    this.jumpSound = this.sound.add('jump');
    this.collectSound = this.sound.add('collect');
    this.hitSound = this.sound.add('hit');
    this.levelupSound = this.sound.add('levelup');
    
    // Create static groups
    platforms = this.physics.add.staticGroup();
    ladders = this.physics.add.staticGroup();
    
    // Create bottom platform
    platforms.create(400, 580, 'platform').setScale(2).refreshBody();
    
    // Create level platforms
    createLevel(this);
    
    // Create player
    player = this.physics.add.sprite(100, 450, 'rabbit');
    player.setBounce(0.1);
    player.setCollideWorldBounds(true);
    
    // Player animations
    this.anims.create({
        key: 'left',
        frames: this.anims.generateFrameNumbers('rabbit', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });
    
    this.anims.create({
        key: 'turn',
        frames: [ { key: 'rabbit', frame: 4 } ],
        frameRate: 20
    });
    
    this.anims.create({
        key: 'right',
        frames: this.anims.generateFrameNumbers('rabbit', { start: 5, end: 8 }),
        frameRate: 10,
        repeat: -1
    });
    
    this.anims.create({
        key: 'climb',
        frames: this.anims.generateFrameNumbers('rabbit', { start: 9, end: 10 }),
        frameRate: 10,
        repeat: -1
    });
    
    // Create coins
    coins = this.physics.add.group({
        key: 'coin',
        repeat: 11,
        setXY: { x: 12, y: 0, stepX: 70 }
    });
    
    coins.children.iterate(function (child) {
        child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
    });
    
    // Create barrels group (they'll fall from the top)
    barrels = this.physics.add.group();
    
    // Create text displays
    scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#000' });
    levelText = this.add.text(230, 16, 'Level: 1', { fontSize: '32px', fill: '#000' });
    livesText = this.add.text(630, 16, 'Lives: 3', { fontSize: '32px', fill: '#000' });
    
    // Set up collisions
    this.physics.add.collider(player, platforms);
    this.physics.add.collider(coins, platforms);
    this.physics.add.collider(barrels, platforms);
    
    // Set up overlaps
    this.physics.add.overlap(player, coins, collectCoin, null, this);
    this.physics.add.overlap(player, barrels, hitBarrel, null, this);
    this.physics.add.overlap(player, ladders, touchLadder, null, this);
    
    // Start barrel generator
    this.time.addEvent({
        delay: 3000 / level,
        callback: spawnBarrel,
        callbackScope: this,
        loop: true
    });
    
    // Set up cursor keys
    cursors = this.input.keyboard.createCursorKeys();
    jumpButton = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
}

// Game loop
function update() {
    if (gameOver) {
        return;
    }
    
    // Player movement
    if (isClimbing && player.body.touching.none) {
        isClimbing = false;
    }
    
    if (isClimbing) {
        player.body.gravity.y = 0;
        if (cursors.up.isDown) {
            player.setVelocityY(-150);
            player.anims.play('climb', true);
        } else if (cursors.down.isDown) {
            player.setVelocityY(150);
            player.anims.play('climb', true);
        } else {
            player.setVelocityY(0);
            player.anims.play('climb');
        }
    } else {
        player.body.gravity.y = 700;
        
        if (cursors.left.isDown) {
            player.setVelocityX(-160);
            player.anims.play('left', true);
        } else if (cursors.right.isDown) {
            player.setVelocityX(160);
            player.anims.play('right', true);
        } else {
            player.setVelocityX(0);
            player.anims.play('turn');
        }
        
        if ((jumpButton.isDown || cursors.up.isDown) && player.body.touching.down) {
            player.setVelocityY(-450);
            this.jumpSound.play();
        }
    }
    
    // Barrel management
    barrels.children.iterate(function(barrel) {
        if (barrel.y > 600) {
            barrel.destroy();
        }
        
        // Make barrels bounce off platform edges
        if (barrel.body.velocity.x > 0 && !barrel.body.touching.down) {
            barrel.setVelocityX(-100 - (level * 10));
        } else if (barrel.body.velocity.x < 0 && !barrel.body.touching.down) {
            barrel.setVelocityX(100 + (level * 10));
        }
    });
    
    // Check if all coins are collected
    if (coins.countActive(true) === 0) {
        levelUp(this);
    }
}

// Helper functions
function createLevel(scene) {
    // Clear existing platforms (except the bottom one)
    platforms.children.iterate(function(child) {
        if (child.y < 580) {
            child.destroy();
        }
    });
    
    // Clear existing ladders
    ladders.clear(true, true);
    
    // Create platforms
    const numPlatforms = 4 + Math.min(level - 1, 2);
    const platformHeight = 480 / numPlatforms;
    
    for (let i = 1; i <= numPlatforms; i++) {
        const y = 580 - (i * platformHeight);
        const width = Phaser.Math.Between(5, 8) * 100;
        const x = i % 2 === 0 ? 800 - (width / 2) : width / 2;
        
        platforms.create(x, y, 'platform').setScale(width / 100, 1).refreshBody();
        
        // Create ladders connecting platforms
        if (i < numPlatforms) {
            const ladderX = i % 2 === 0 ? 120 : 680;
            const ladderHeight = platformHeight;
            const ladder = ladders.create(ladderX, y - (ladderHeight / 2), 'ladder');
            ladder.setScale(1, ladderHeight / 100).refreshBody();
        }
    }
}

function spawnBarrel() {
    if (gameOver) return;
    
    const x = Phaser.Math.Between(100, 700);
    const barrel = barrels.create(x, 0, 'barrel');
    
    barrel.setBounce(0.5);
    barrel.setCollideWorldBounds(true);
    barrel.setVelocity(Phaser.Math.Between(-200, 200), 20);
    barrel.allowGravity = true;
}

function collectCoin(player, coin) {
    coin.disableBody(true, true);
    
    this.collectSound.play();
    
    score += 10;
    scoreText.setText('Score: ' + score);
}

function hitBarrel(player, barrel) {
    if (gameOver) return;
    
    this.hitSound.play();
    
    lives--;
    livesText.setText('Lives: ' + lives);
    
    barrel.destroy();
    
    if (lives <= 0) {
        gameOver = true;
        this.physics.pause();
        
        player.setTint(0xff0000);
        player.anims.play('turn');
        
        this.add.text(400, 300, 'GAME OVER', { 
            fontSize: '64px', 
            fill: '#fff',
            backgroundColor: '#000',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
        
        this.add.text(400, 380, 'Final Score: ' + score, { 
            fontSize: '32px', 
            fill: '#fff',
            backgroundColor: '#000',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
        
        this.add.text(400, 440, 'Click to restart', { 
            fontSize: '24px', 
            fill: '#fff',
            backgroundColor: '#000',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
        
        this.input.on('pointerdown', function() {
            gameOver = false;
            lives = 3;
            score = 0;
            level = 1;
            this.scene.restart();
        }, this);
    } else {
        // Flash the player
        this.tweens.add({
            targets: player,
            alpha: 0,
            duration: 100,
            ease: 'Linear',
            repeat: 5,
            yoyo: true,
            onComplete: function() {
                player.alpha = 1;
            }
        });
    }
}

function touchLadder(player, ladder) {
    if (cursors.up.isDown || cursors.down.isDown) {
        isClimbing = true;
    }
}

function levelUp(scene) {
    level++;
    levelText.setText('Level: ' + level);
    
    scene.levelupSound.play();
    
    // Create new coins
    coins.clear(true, true);
    coins = scene.physics.add.group({
        key: 'coin',
        repeat: 11,
        setXY: { x: 12, y: 0, stepX: 70 }
    });
    
    coins.children.iterate(function (child) {
        child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
    });
    
    scene.physics.add.collider(coins, platforms);
    scene.physics.add.overlap(player, coins, collectCoin, null, scene);
    
    // Reset barrel generator with faster timing
    scene.time.removeAllEvents();
    scene.time.addEvent({
        delay: 3000 / level,
        callback: spawnBarrel,
        callbackScope: scene,
        loop: true
    });
    
    // Create new level layout
    createLevel(scene);
}