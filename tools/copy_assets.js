const fs = require('fs');
const path = require('path');

const sourceDir = 'C:\\Users\\eduar\\.gemini\\antigravity\\brain\\44dfea75-828a-46dd-bf72-cd67690c83a1';
const pubDir = 'c:\\Users\\eduar\\OneDrive\\Desktop\\baram game class\\public\\assets\\images';

// 카테고리별 폴더 생성
['monsters', 'items', 'map', 'effects'].forEach(d => {
    const dir = path.join(pubDir, d);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 에셋 매핑 (prefix → 저장 경로)
const mappings = [
    // 맵 타일
    { prefix: 'rpg_map_grass',       dest: 'map/grass.png' },
    { prefix: 'rpg_map_wall_brick',  dest: 'map/wall_brick.png' },
    { prefix: 'rpg_map_dirt',        dest: 'map/dirt.png' },
    { prefix: 'rpg_map_water',       dest: 'map/water.png' },
    { prefix: 'rpg_map_tree',        dest: 'map/tree.png' },
    { prefix: 'rpg_map_snow',        dest: 'map/snow.png' },
    { prefix: 'rpg_map_lava',        dest: 'map/lava.png' },
    { prefix: 'rpg_map_cave_floor',  dest: 'map/cave_floor.png' },
    { prefix: 'rpg_map_wood_floor',  dest: 'map/wood_floor.png' },
    { prefix: 'rpg_map_sand',        dest: 'map/sand.png' },

    // 몬스터
    { prefix: 'rpg_monster_slime',       dest: 'monsters/slime.png' },
    { prefix: 'rpg_monster_wolf',        dest: 'monsters/wolf.png' },
    { prefix: 'rpg_monster_goblin',      dest: 'monsters/goblin.png' },
    { prefix: 'rpg_monster_skeleton',    dest: 'monsters/skeleton.png' },
    { prefix: 'rpg_monster_boss_ogre',   dest: 'monsters/boss_ogre.png' },
    { prefix: 'rpg_monster_squirrel',    dest: 'monsters/squirrel.png' },
    { prefix: 'rpg_monster_bear',        dest: 'monsters/bear.png' },
    { prefix: 'rpg_monster_snake',       dest: 'monsters/snake.png' },
    { prefix: 'rpg_monster_bat',         dest: 'monsters/bat.png' },
    { prefix: 'rpg_monster_ghost',       dest: 'monsters/ghost.png' },
    { prefix: 'rpg_monster_dragon_boss', dest: 'monsters/dragon_boss.png' },

    // 스킬 이펙트
    { prefix: 'rpg_effect_slash',       dest: 'effects/slash.png' },
    { prefix: 'rpg_effect_magic',       dest: 'effects/magic.png' },
    { prefix: 'rpg_effect_fireball',    dest: 'effects/fireball.png' },
    { prefix: 'rpg_effect_lightning',   dest: 'effects/lightning.png' },
    { prefix: 'rpg_effect_heal',        dest: 'effects/heal.png' },
    { prefix: 'rpg_effect_poison',      dest: 'effects/poison.png' },
    { prefix: 'rpg_effect_shield',      dest: 'effects/shield.png' },
    { prefix: 'rpg_effect_ice',         dest: 'effects/ice.png' },

    // 아이템
    { prefix: 'rpg_item_potion_hp',   dest: 'items/potion_hp.png' },
    { prefix: 'rpg_item_gold',        dest: 'items/gold.png' },
    { prefix: 'rpg_item_sword',       dest: 'items/sword.png' },
    { prefix: 'rpg_item_potion_mp',   dest: 'items/potion_mp.png' },
    { prefix: 'rpg_item_potion_full', dest: 'items/potion_full.png' },
    { prefix: 'rpg_item_shield',      dest: 'items/shield.png' },
    { prefix: 'rpg_item_bow',         dest: 'items/bow.png' },
    { prefix: 'rpg_item_staff',       dest: 'items/staff.png' },
];

// 최신 파일 우선으로 정렬
const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.png')).sort().reverse();

let copied = 0;
for (const map of mappings) {
    const matchedFile = files.find(f => f.startsWith(map.prefix));
    if (matchedFile) {
        const srcPath = path.join(sourceDir, matchedFile);
        const destPath = path.join(pubDir, map.dest);
        fs.copyFileSync(srcPath, destPath);
        console.log(`✅ ${matchedFile} → ${map.dest}`);
        copied++;
    } else {
        console.log(`⏭️  SKIP: ${map.prefix} (파일 없음)`);
    }
}

console.log(`\n완료: ${copied}/${mappings.length}개 에셋 복사됨`);
