const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

// 현재 작업 디렉토리 기준 경로 설정
const rawDir = path.resolve(__dirname, '../scratch/raw_assets');
const outDir = path.resolve(__dirname, '../public/assets/images');

const jobs = [
    // Monsters (32x32)
    { in: 'monster_medusa.png', out: 'monsters/medusa.png', size: 32 },
    { in: 'monster_chimera.png', out: 'monsters/chimera.png', size: 32 },
    { in: 'monster_griffin.png', out: 'monsters/griffin.png', size: 32 },
    { in: 'monster_kraken.png', out: 'monsters/kraken.png', size: 32 },
    { in: 'monster_phoenix.png', out: 'monsters/phoenix.png', size: 32 },
    { in: 'monster_succubus.png', out: 'monsters/succubus.png', size: 32 },
    { in: 'monster_gargoyle.png', out: 'monsters/gargoyle.png', size: 32 },
    { in: 'monster_minotaur.png', out: 'monsters/minotaur.png', size: 32 },
    { in: 'monster_centaur.png', out: 'monsters/centaur.png', size: 32 },
    { in: 'monster_death_knight.png', out: 'monsters/death_knight.png', size: 32 },
    
    // Items (16x16)
    { in: 'item_mythril_sword.png', out: 'items/mythril_sword.png', size: 16 },
    { in: 'item_ruby_staff.png', out: 'items/ruby_staff.png', size: 16 },
    { in: 'item_infinite_bow.png', out: 'items/infinite_bow.png', size: 16 },
    { in: 'item_hero_shield.png', out: 'items/hero_shield.png', size: 16 },
    { in: 'item_sage_robe.png', out: 'items/sage_robe.png', size: 16 },
    { in: 'item_dragon_egg.png', out: 'items/dragon_egg.png', size: 16 },
    { in: 'item_dragon_slayer.png', out: 'items/dragon_slayer.png', size: 16 },
    { in: 'item_ring_of_power.png', out: 'items/ring_of_power.png', size: 16 },
    { in: 'item_dragon_armor.png', out: 'items/dragon_armor.png', size: 16 },

    // NPCs (32x32)
    { in: 'npc_village_chief.png', out: 'characters/village_chief.png', size: 32 },
    { in: 'npc_guard.png', out: 'characters/guard.png', size: 32 },
    { in: 'npc_merchant.png', out: 'characters/merchant.png', size: 32 },

    // New Monsters (32x32)
    { in: 'monster_slime_king.png', out: 'monsters/slime_king.png', size: 32 },
    { in: 'monster_lich.png', out: 'monsters/lich.png', size: 32 },
    { in: 'monster_slime.png', out: 'monsters/slime.png', size: 32 },
    { in: 'monster_wild_boar.png', out: 'monsters/wild_boar.png', size: 32 },
    { in: 'monster_boss_ogre.png', out: 'monsters/boss_ogre.png', size: 32 },
    { in: 'monster_goblin.png', out: 'monsters/goblin.png', size: 32 },
    { in: 'monster_skeleton.png', out: 'monsters/skeleton.png', size: 32 },
    { in: 'monster_wolf.png', out: 'monsters/wolf.png', size: 32 },
    { in: 'monster_bear.png', out: 'monsters/bear.png', size: 32 },
    { in: 'monster_snake.png', out: 'monsters/snake.png', size: 32 },
    { in: 'monster_spider.png', out: 'monsters/spider.png', size: 32 },
    { in: 'monster_golem.png', out: 'monsters/golem.png', size: 32 },
    { in: 'monster_mummy.png', out: 'monsters/mummy.png', size: 32 },
    { in: 'monster_bat.png', out: 'monsters/bat.png', size: 32 },
    { in: 'monster_ghost.png', out: 'monsters/ghost.png', size: 32 },

    // Mega Tiles
    { in: 'mega_ruined_temple.png', out: 'map/mega_ruined_temple.png', size: 96 },
];

async function processImage(job) {
    const inputPath = path.join(rawDir, job.in);
    const outputPath = path.join(outDir, job.out);
    
    if (!fs.existsSync(inputPath)) {
        console.warn(`Input file not found: ${inputPath}`);
        return;
    }

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
            // Magenta fallback (#FF00FF)
            if (
                dist1 < 60 || dist2 < 60 || 
                (r > 200 && b > 200 && g < 100)
            ) {
                this.bitmap.data[idx + 3] = 0; // alpha = 0
            }
        });
        
        // Resize with nearest neighbor to keep pixel art look
        image.resize(job.size, job.size, Jimp.RESIZE_NEAREST_NEIGHBOR);

        await image.writeAsync(outputPath);
        console.log('Successfully saved to', outputPath);
    } catch (e) {
        console.error('Failed to process', inputPath, e);
    }
}

async function main() {
    console.log('Starting image processing...');
    for (const job of jobs) {
        await processImage(job);
    }
    console.log('All images processed and saved.');
}

main();

