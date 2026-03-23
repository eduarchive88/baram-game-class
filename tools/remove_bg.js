const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const brainDir = 'C:/Users/eduar/.gemini/antigravity/brain/2a0fda8a-9a7e-4d11-8552-37ce935c2d5d';
const outDir = 'C:/Users/eduar/OneDrive/Desktop/baram game class/public/assets/images';

const jobs = [
    // Tiles (32x32)
    { in: 'tile_grass_1774241853798.png', out: 'map/grass.png', size: 32 },
    { in: 'tile_dirt_1774241869930.png', out: 'map/dirt.png', size: 32 },
    { in: 'tile_water_1774241886683.png', out: 'map/water.png', size: 32 },
    { in: 'tile_wall_1774241901705.png', out: 'map/wall_brick.png', size: 32 },
    { in: 'tile_tree_1774241915377.png', out: 'map/tree.png', size: 32 },
    // Monsters (32x32)
    { in: 'monster_slime_1774241960110.png', out: 'monsters/slime.png', size: 32 },
    { in: 'monster_wolf_1774241977791.png', out: 'monsters/wolf.png', size: 32 },
    { in: 'monster_goblin_1774241994819.png', out: 'monsters/goblin.png', size: 32 },
    { in: 'monster_skeleton_1774242010131.png', out: 'monsters/skeleton.png', size: 32 },
    { in: 'monster_boss_ogre_1774242025386.png', out: 'monsters/boss_ogre.png', size: 64 }, // Boss is bigger
    // Items (16x16)
    { in: 'item_potion_hp_1774242057872.png', out: 'items/potion_hp.png', size: 16 },
    { in: 'item_gold_1774242074004.png', out: 'items/gold.png', size: 16 },
    { in: 'item_sword_1774242089757.png', out: 'items/sword.png', size: 16 },
    // Character (32x32)
    { in: 'char_student_1774242104763.png', out: 'characters/student_down.png', size: 32 }, // Map 1 frame to standard down state
    // Effects (32x32)
    { in: 'effect_slash_1774242119812.png', out: 'effects/slash.png', size: 32 },
    { in: 'effect_magic_1774242145729.png', out: 'effects/magic.png', size: 32 },
];

async function processImage(job) {
    const inputPath = path.join(brainDir, job.in);
    const outputPath = path.join(outDir, job.out);
    
    // Create output directory if it doesn't exist
    const outParsed = path.parse(outputPath);
    if (!fs.existsSync(outParsed.dir)) {
        fs.mkdirSync(outParsed.dir, { recursive: true });
    }

    try {
        const image = await Jimp.read(inputPath);
        
        // Use corner pixels to detect solid background colors
        const bg1 = image.getPixelColor(0, 0); // Top-left
        const bg2 = image.getPixelColor(image.bitmap.width - 1, image.bitmap.height - 1); // Bottom-right
        const { r: br1, g: bg1c, b: bb1 } = Jimp.intToRGBA(bg1);
        const { r: br2, g: bg2c, b: bb2 } = Jimp.intToRGBA(bg2);

        // Calculate color distance
        const distance = (c1, c2) => Math.sqrt(Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2));
        
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            
            const dist1 = distance({r: br1, g: bg1c, b: bb1}, {r, g, b});
            const dist2 = distance({r: br2, g: bg2c, b: bb2}, {r, g, b});
            
            // Allow for compression artifacts on background
            // Green fallback: heavily green
            // Magenta fallback: heavily magenta
            if (
                dist1 < 45 || dist2 < 45 || 
                (g > 210 && r < 50 && b < 50) || 
                (r > 210 && b > 210 && g < 50)
            ) {
                this.bitmap.data[idx + 3] = 0; // alpha = 0
            }
        });
        
        // Resize to match 2D game pixel size uniformly
        image.resize(job.size, job.size, Jimp.RESIZE_NEAREST_NEIGHBOR);

        await image.writeAsync(outputPath);
        console.log('Successfully saved to', outputPath);
    } catch (e) {
        console.error('Failed to process', inputPath, e);
    }
}

async function main() {
    for (const job of jobs) {
        await processImage(job);
    }
    console.log('All images processed and saved.');
}

main();
