/**
 * AssetManager.js - CC0 에셋 로딩 및 스프라이트 생성 관리자
 * 바람의 나라 교육용 RPG - 그래픽/사운드 리소스 매핑
 * 
 * CC0 에셋 원칙: 모든 그래픽은 프로그래밍 방식의 픽셀아트 스프라이트로 생성
 * (캔버스 기본 도형 렌더링 금지 → 상세한 픽셀아트 캐릭터/타일 생성)
 */

class AssetManager {
    constructor() {
        // 로드된 에셋 캐시
        this.images = {};
        this.sounds = {};
        this.loaded = false;
        this.totalAssets = 0;
        this.loadedAssets = 0;

        // 타일 크기 상수
        this.TILE_SIZE = 32;
        this.SPRITE_SIZE = 32;
    }

    /**
     * 이미지 비동기 로드
     */
    async loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn(`[AssetManager] Failed to load ${src}`);
                resolve(null);
            };
            img.src = src;
        });
    }

    /**
     * 이미지의 하얀색(유사 하얀색 포함) 배경을 투명하게 처리
     */
    _removeWhiteBackground(img) {
        if (!img) return null;
        const canvas = document.createElement('canvas');
        canvas.width = img.width || this.SPRITE_SIZE;
        canvas.height = img.height || this.SPRITE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const w = canvas.width;
            const h = canvas.height;

            // 1단계: 코너 4곳의 색상을 샘플링하여 배경색 추정
            const corners = [
                0,                           // 좌상
                (w - 1) * 4,                  // 우상
                (h - 1) * w * 4,              // 좌하
                ((h - 1) * w + (w - 1)) * 4,  // 우하
            ];
            let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
            corners.forEach(idx => {
                if (idx >= 0 && idx < data.length - 2) {
                    bgR += data[idx];
                    bgG += data[idx + 1];
                    bgB += data[idx + 2];
                    bgCount++;
                }
            });
            if (bgCount > 0) {
                bgR = Math.floor(bgR / bgCount);
                bgG = Math.floor(bgG / bgCount);
                bgB = Math.floor(bgB / bgCount);
            }

            // 2단계: 배경색과 유사한 픽셀 + 밝은 픽셀 투명화
            const BG_TOLERANCE = 45;   // 배경색과의 허용 차이
            const WHITE_THRESHOLD = 200; // 밝은 픽셀 임계값 (기존 230에서 강화)
            const LIGHT_THRESHOLD = 210; // 연한 파스텔/베이지 임계값

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const a = data[i + 3];
                if (a === 0) continue; // 이미 투명

                // 조건 1: 순백/밝은 회색 제거
                if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
                    data[i + 3] = 0;
                    continue;
                }

                // 조건 2: 추정된 배경색과 유사한 픽셀 제거
                const dr = Math.abs(r - bgR);
                const dg = Math.abs(g - bgG);
                const db = Math.abs(b - bgB);
                if (dr < BG_TOLERANCE && dg < BG_TOLERANCE && db < BG_TOLERANCE) {
                    data[i + 3] = 0;
                    continue;
                }

                // 조건 3: 연한 색상(채도가 낮고 밝은) 제거
                const maxC = Math.max(r, g, b);
                const minC = Math.min(r, g, b);
                const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
                if (maxC >= LIGHT_THRESHOLD && saturation < 0.15) {
                    data[i + 3] = 0;
                    continue;
                }
            }

            // 3단계: 반투명 경계 부드럽게 처리 (anti-aliasing)
            const tempData = new Uint8ClampedArray(data);
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = (y * w + x) * 4;
                    if (tempData[idx + 3] === 0) continue;

                    // 주변 8방향 투명 픽셀 수 확인
                    let transparentNeighbors = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nIdx = ((y + dy) * w + (x + dx)) * 4;
                            if (tempData[nIdx + 3] === 0) transparentNeighbors++;
                        }
                    }
                    // 투명 이웃이 5개 이상이면 반투명 처리
                    if (transparentNeighbors >= 5) {
                        data[idx + 3] = Math.floor(data[idx + 3] * 0.3);
                    } else if (transparentNeighbors >= 3) {
                        data[idx + 3] = Math.floor(data[idx + 3] * 0.7);
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0);
            return canvas;
        } catch (e) {
            console.warn('[AssetManager] 배경 제거 실패:', e);
            return img;
        }
    }

    /**
     * 모든 에셋을 생성/로드
     * @returns {Promise} 로드 완료 프로미스
     */
    async loadAll() {
        console.log('[AssetManager] 에셋 로드 시작...');

        try {
        const rawAssets = {
            // === 맵 타일 ===
            grass:      await this.loadImage('/assets/images/map/grass.png'),
            wall:       await this.loadImage('/assets/images/map/wall_brick.png'),
            dirt:       await this.loadImage('/assets/images/map/dirt.png'),
            water:      await this.loadImage('/assets/images/map/water.png'),
            tree:       await this.loadImage('/assets/images/map/tree.png'),
            snow:       await this.loadImage('/assets/images/map/snow.png'),
            lava:       await this.loadImage('/assets/images/map/lava.png'),
            cave_floor: await this.loadImage('/assets/images/map/cave_floor.png'),
            wood_floor: await this.loadImage('/assets/images/map/wood_floor.png'),
            sand:       await this.loadImage('/assets/images/map/sand.png'),
            // === 건물/포털/NPC ===
            portal:  await this.loadImage('/assets/rpg_portal_1773292920194.png'),
            shop:    await this.loadImage('/assets/rpg_shop_building_1773292762510.png'),
            // === 캐릭터 ===
            student:  await this.loadImage('/assets/images/characters/student_down.png'),
            warrior:  await this.loadImage('/assets/rpg_player_sprite_1773292722977.png'),
            thief:    await this.loadImage('/assets/rpg_thief_sprite_1773292975879.png'),
            mage:     await this.loadImage('/assets/rpg_mage_sprite_1773292931497.png'),
            healer:   await this.loadImage('/assets/rpg_poet_sprite_1773292988919.png'),
            npc_village_chief: await this.loadImage('/assets/images/characters/village_chief.png'),
            npc_guard: await this.loadImage('/assets/images/characters/guard.png'),
            npc_merchant: await this.loadImage('/assets/images/characters/merchant.png'),
            // === 몬스터 ===
            monster_squirrel:   await this.loadImage('/assets/rpg_monster_squirrel_1773292740316.png'),
            monster_slime:      await this.loadImage('/assets/images/monsters/slime.png'),
            monster_wolf:       await this.loadImage('/assets/images/monsters/wolf.png'),
            monster_goblin:     await this.loadImage('/assets/images/monsters/goblin.png'),
            monster_skeleton:   await this.loadImage('/assets/images/monsters/skeleton.png'),
            monster_boss_ogre:  await this.loadImage('/assets/images/monsters/boss_ogre.png'),
            monster_bear:       await this.loadImage('/assets/images/monsters/bear.png'),
            monster_snake:      await this.loadImage('/assets/images/monsters/snake.png'),
            monster_bat:        await this.loadImage('/assets/images/monsters/bat.png'),
            monster_ghost:      await this.loadImage('/assets/images/monsters/ghost.png'),
            monster_dragon_boss:await this.loadImage('/assets/images/monsters/dragon_boss.png'),
            monster_golem:      await this.loadImage('/assets/images/monsters/golem.png'),
            monster_spider:     await this.loadImage('/assets/images/monsters/spider.png'),
            monster_harpy:      await this.loadImage('/assets/images/monsters/harpy.png'),
            monster_mimic:      await this.loadImage('/assets/images/monsters/mimic.png'),
            monster_fire_spirit:await this.loadImage('/assets/images/monsters/fire_spirit.png'),
            monster_dark_knight:await this.loadImage('/assets/images/monsters/dark_knight.png'),
            monster_mantis:     await this.loadImage('/assets/images/monsters/mantis.png'),
            monster_sand_worm:  await this.loadImage('/assets/images/monsters/sand_worm.png'),
            monster_treant:     await this.loadImage('/assets/images/monsters/treant.png'),
            monster_demon:      await this.loadImage('/assets/images/monsters/demon.png'),
            monster_mummy:      await this.loadImage('/assets/images/monsters/mummy.png'),
            monster_tentacle:   await this.loadImage('/assets/images/monsters/tentacle.png'),
            monster_medusa:     await this.loadImage('/assets/images/monsters/medusa.png'),
            monster_chimera:    await this.loadImage('/assets/images/monsters/chimera.png'),
            monster_griffin:    await this.loadImage('/assets/images/monsters/griffin.png'),
            monster_kraken:     await this.loadImage('/assets/images/monsters/kraken.png'),
            monster_phoenix:    await this.loadImage('/assets/images/monsters/phoenix.png'),
            monster_succubus:   await this.loadImage('/assets/images/monsters/succubus.png'),
            monster_gargoyle:   await this.loadImage('/assets/images/monsters/gargoyle.png'),
            monster_minotaur:   await this.loadImage('/assets/images/monsters/minotaur.png'),
            monster_centaur:    await this.loadImage('/assets/images/monsters/centaur.png'),
            monster_death_knight:await this.loadImage('/assets/images/monsters/death_knight.png'),
            monster_slime_king: await this.loadImage('/assets/images/monsters/slime_king.png'),
            monster_lich:       await this.loadImage('/assets/images/monsters/lich.png'),
            // === 아이템 ===
            item_potion_hp:    await this.loadImage('/assets/images/items/potion_hp.png'),
            item_potion_mp:    await this.loadImage('/assets/images/items/potion_mp.png'),
            item_potion_full:  await this.loadImage('/assets/images/items/potion_full.png'),
            item_gold:         await this.loadImage('/assets/images/items/gold.png'),
            item_sword:        await this.loadImage('/assets/images/items/sword.png'),
            item_bow:          await this.loadImage('/assets/images/items/bow.png'),
            item_staff_crystal:await this.loadImage('/assets/images/items/staff_crystal.png'),
            item_shield_iron:  await this.loadImage('/assets/images/items/shield_iron.png'),
            item_armor_plate:  await this.loadImage('/assets/images/items/armor_plate.png'),
            item_mythril_sword:await this.loadImage('/assets/images/items/mythril_sword.png'),
            item_ruby_staff:   await this.loadImage('/assets/images/items/ruby_staff.png'),
            item_infinite_bow: await this.loadImage('/assets/images/items/infinite_bow.png'),
            item_hero_shield:  await this.loadImage('/assets/images/items/hero_shield.png'),
            item_sage_robe:    await this.loadImage('/assets/images/items/sage_robe.png'),
            item_dragon_egg:   await this.loadImage('/assets/images/items/dragon_egg.png'),
            item_dragon_slayer:await this.loadImage('/assets/images/items/dragon_slayer.png'),
            item_ring_of_power:await this.loadImage('/assets/images/items/ring_of_power.png'),
            item_dragon_armor: await this.loadImage('/assets/images/items/dragon_armor.png'),
            // === 스킬 이펙트 ===
            effect_slash:     await this.loadImage('/assets/images/effects/slash.png'),
            effect_magic:     await this.loadImage('/assets/images/effects/magic.png'),
            effect_fireball:  await this.loadImage('/assets/images/effects/fireball.png'),
            effect_lightning: await this.loadImage('/assets/images/effects/lightning.png'),
            effect_heal:      await this.loadImage('/assets/images/effects/heal.png'),
            effect_poison:    await this.loadImage('/assets/images/effects/poison.png'),
            effect_shield:    await this.loadImage('/assets/images/effects/shield.png'),
            effect_ice:       await this.loadImage('/assets/images/effects/ice.png'),
            // === 고해상도 신규 에셋 (Mega-objects & Props) ===
            mega_ruined_temple: await this.loadImage('/assets/images/map/mega_ruined_temple.png'),
            mega_house:       await this.loadImage('/assets/images/map/mega_wooden_house.png'),
            mega_cherry:      await this.loadImage('/assets/images/map/mega_cherry_blossom.png'),
            mega_pavillion:   await this.loadImage('/assets/images/map/mega_pavillion.png'),
            mega_flower:      await this.loadImage('/assets/images/map/mega_flower_bed.png'),
            mine_rail:        await this.loadImage('/assets/images/map/mine_rail.png'),
            mine_ore:         await this.loadImage('/assets/images/map/mine_ore.png'),
            mine_stalactite:  await this.loadImage('/assets/images/map/mine_stalactite.png'),
            hell_lava:        await this.loadImage('/assets/images/map/hell_lava_pit.png'),
            snow_statue:      await this.loadImage('/assets/images/map/snow_ice_statue.png'),
            // === 신규 몬스터 및 이펙트 ===
            monster_wild_boar: await this.loadImage('/assets/images/monsters/wild_boar.png'),
            monster_wasp:      await this.loadImage('/assets/images/monsters/wasp.png'),
            monster_yeti:      await this.loadImage('/assets/images/monsters/yeti.png'),
            monster_ice_spirit:await this.loadImage('/assets/images/monsters/ice_spirit.png'),
            effect_fire_storm: await this.loadImage('/assets/images/effects/fire_storm.png'),
            // === NPC 초상화 ===
            face_guide:     await this.loadImage('/assets/images/faces/guide.png'),
            face_innkeeper: await this.loadImage('/assets/images/faces/innkeeper.png'),
        };

        // 투명화 적용 자산 (자연 경관 일부 이외의 개체들)
        // 새로 생성한 에셋은 이미 배경 제거 스크립트(remove_bg.js)를 거쳤으므로 _removeWhiteBackground 필요없음
        const assets = {
            // 맵 타일 (배경 제거 불필요)
            grass: rawAssets.grass, wall: rawAssets.wall, dirt: rawAssets.dirt,
            water: rawAssets.water, tree: rawAssets.tree,
            snow: rawAssets.snow, lava: rawAssets.lava,
            cave_floor: rawAssets.cave_floor, wood_floor: rawAssets.wood_floor, sand: rawAssets.sand,
            // 건물/포털
            portal: this._removeWhiteBackground(rawAssets.portal),
            shop:   this._removeWhiteBackground(rawAssets.shop),
            // 캐릭터
            student: rawAssets.student,
            warrior: this._removeWhiteBackground(rawAssets.warrior),
            thief:   this._removeWhiteBackground(rawAssets.thief),
            mage:    this._removeWhiteBackground(rawAssets.mage),
            healer:  this._removeWhiteBackground(rawAssets.healer),
            npc_village_chief: rawAssets.npc_village_chief,
            npc_guard: rawAssets.npc_guard,
            npc_merchant: rawAssets.npc_merchant,
            // 몬스터
            monster_squirrel:    this._removeWhiteBackground(rawAssets.monster_squirrel),
            monster_slime:       this._removeWhiteBackground(rawAssets.monster_slime),
            monster_wolf:        this._removeWhiteBackground(rawAssets.monster_wolf),
            monster_goblin:      this._removeWhiteBackground(rawAssets.monster_goblin),
            monster_skeleton:    this._removeWhiteBackground(rawAssets.monster_skeleton),
            monster_boss_ogre:   this._removeWhiteBackground(rawAssets.monster_boss_ogre),
            monster_bear:        this._removeWhiteBackground(rawAssets.monster_bear),
            monster_snake:       this._removeWhiteBackground(rawAssets.monster_snake),
            monster_bat:         this._removeWhiteBackground(rawAssets.monster_bat),
            monster_ghost:       this._removeWhiteBackground(rawAssets.monster_ghost),
            monster_dragon_boss: this._removeWhiteBackground(rawAssets.monster_dragon_boss),
            monster_golem:       this._removeWhiteBackground(rawAssets.monster_golem),
            monster_spider:      this._removeWhiteBackground(rawAssets.monster_spider),
            monster_harpy:       this._removeWhiteBackground(rawAssets.monster_harpy),
            monster_mimic:       this._removeWhiteBackground(rawAssets.monster_mimic),
            monster_fire_spirit: this._removeWhiteBackground(rawAssets.monster_fire_spirit),
            monster_dark_knight: this._removeWhiteBackground(rawAssets.monster_dark_knight),
            monster_mantis:      this._removeWhiteBackground(rawAssets.monster_mantis),
            monster_sand_worm:   this._removeWhiteBackground(rawAssets.monster_sand_worm),
            monster_treant:      this._removeWhiteBackground(rawAssets.monster_treant),
            monster_demon:       this._removeWhiteBackground(rawAssets.monster_demon),
            monster_mummy:       this._removeWhiteBackground(rawAssets.monster_mummy),
            monster_tentacle:    this._removeWhiteBackground(rawAssets.monster_tentacle),
            monster_medusa:      this._removeWhiteBackground(rawAssets.monster_medusa),
            monster_chimera:     this._removeWhiteBackground(rawAssets.monster_chimera),
            monster_griffin:     this._removeWhiteBackground(rawAssets.monster_griffin),
            monster_kraken:      this._removeWhiteBackground(rawAssets.monster_kraken),
            monster_phoenix:     this._removeWhiteBackground(rawAssets.monster_phoenix),
            monster_succubus:    this._removeWhiteBackground(rawAssets.monster_succubus),
            monster_gargoyle:    this._removeWhiteBackground(rawAssets.monster_gargoyle),
            monster_minotaur:    this._removeWhiteBackground(rawAssets.monster_minotaur),
            monster_centaur:     this._removeWhiteBackground(rawAssets.monster_centaur),
            monster_death_knight:this._removeWhiteBackground(rawAssets.monster_death_knight),
            monster_slime_king:  rawAssets.monster_slime_king,
            monster_lich:        rawAssets.monster_lich,
            // 아이템
            item_potion_hp:   rawAssets.item_potion_hp,
            item_potion_mp:   rawAssets.item_potion_mp,
            item_potion_full: rawAssets.item_potion_full,
            item_gold:        rawAssets.item_gold,
            item_sword:       rawAssets.item_sword,
            item_bow:         rawAssets.item_bow,
            item_staff_crystal: rawAssets.item_staff_crystal,
            item_shield_iron: rawAssets.item_shield_iron,
            item_armor_plate: rawAssets.item_armor_plate,
            item_mythril_sword: rawAssets.item_mythril_sword,
            item_ruby_staff:  rawAssets.item_ruby_staff,
            item_infinite_bow:rawAssets.item_infinite_bow,
            item_hero_shield: rawAssets.item_hero_shield,
            item_sage_robe:   rawAssets.item_sage_robe,
            item_dragon_egg:  rawAssets.item_dragon_egg,
            item_dragon_slayer:rawAssets.item_dragon_slayer,
            item_ring_of_power:rawAssets.item_ring_of_power,
            item_dragon_armor: rawAssets.item_dragon_armor,
            // 스킬 이펙트
            effect_slash:     rawAssets.effect_slash,
            effect_magic:     rawAssets.effect_magic,
            effect_fireball:  rawAssets.effect_fireball,
            effect_lightning: rawAssets.effect_lightning,
            effect_heal:      rawAssets.effect_heal,
            effect_poison:    rawAssets.effect_poison,
            effect_shield:    rawAssets.effect_shield,
            effect_ice:       rawAssets.effect_ice,
            // 신규 대형 에셋
            mega_ruined_temple: rawAssets.mega_ruined_temple,
            mega_house:       rawAssets.mega_house,
            mega_cherry:      rawAssets.mega_cherry,
            mega_pavillion:   rawAssets.mega_pavillion,
            mega_flower:      rawAssets.mega_flower,
            mine_rail:        rawAssets.mine_rail,
            mine_ore:         rawAssets.mine_ore,
            mine_stalactite:  rawAssets.mine_stalactite,
            hell_lava:        rawAssets.hell_lava,
            snow_statue:      rawAssets.snow_statue,
            // 몬스터 및 이펙트
            monster_wild_boar: this._removeWhiteBackground(rawAssets.monster_wild_boar),
            monster_wasp:      this._removeWhiteBackground(rawAssets.monster_wasp),
            monster_yeti:      this._removeWhiteBackground(rawAssets.monster_yeti),
            monster_ice_spirit:this._removeWhiteBackground(rawAssets.monster_ice_spirit),
            effect_fire_storm: rawAssets.effect_fire_storm,
        };

        // 타일셋 스프라이트 생성
        this.images.tiles = this._generateTileset(assets);

        // 메가타일(대형 오브젝트) 생성
        this.images.megaTiles = this._generateMegaTiles(assets);

        // 캐릭터 스프라이트시트 생성 (4직업 × 4방향 × 4프레임)
        this.images.characters = {
            '전사': this._generateCharacterSheet('전사', assets.warrior),
            '도적': this._generateCharacterSheet('도적', assets.thief),
            '주술사': this._generateCharacterSheet('주술사', assets.mage),
            '도사': this._generateCharacterSheet('도사', assets.healer),
            '학생': this._generateCharacterSheet('학생', assets.student),
        };

        // GM 캐릭터 스프라이트 (황금색 특수)
        this.images.gm = this._generateCharacterSheet('GM', assets.warrior);

        // NPC 스프라이트
        this.images.npcs = {
            '주모': this._generateNPCSprite('#e07050', '#ffd0b0', assets.shop),
            '대장장이': this._generateNPCSprite('#808080', '#c0c0c0', assets.shop),
            '길드마스터': this._generateNPCSprite('#6040a0', '#d0b0ff', assets.shop),
            '촌장님': this._generateNPCSprite(null, null, assets.npc_village_chief),
            '경비병': this._generateNPCSprite(null, null, assets.npc_guard),
            '떠돌이 상인': this._generateNPCSprite(null, null, assets.npc_merchant),
        };

        // UI 아이콘 생성
        this.images.icons = this._generateUIIcons(assets);

        // 몬스터 스프라이트 생성 (기존 + 신규 5종)
        this.images.monsters = {
            slime:       this._generateMonsterSprite('slime',       assets.monster_slime),
            wolf:        this._generateMonsterSprite('wolf',        assets.monster_wolf),
            goblin:      this._generateMonsterSprite('goblin',      assets.monster_goblin),
            skeleton:    this._generateMonsterSprite('skeleton',    assets.monster_skeleton),
            boss_ogre:   this._generateMonsterSprite('boss_ogre',   assets.monster_boss_ogre),
            squirrel:    this._generateMonsterSprite('squirrel',    assets.monster_squirrel),
            bear:        this._generateMonsterSprite('bear',        assets.monster_bear),
            snake:       this._generateMonsterSprite('snake',       assets.monster_snake),
            bat:         this._generateMonsterSprite('bat',         assets.monster_bat),
            ghost:       this._generateMonsterSprite('ghost',       assets.monster_ghost),
            dragon_boss: this._generateMonsterSprite('dragon_boss', assets.monster_dragon_boss),
            wild_boar:   this._generateMonsterSprite('wild_boar',   assets.monster_wild_boar),
            wasp:        this._generateMonsterSprite('wasp',        assets.monster_wasp),
            yeti:        this._generateMonsterSprite('yeti',        assets.monster_yeti),
            ice_spirit:  this._generateMonsterSprite('ice_spirit',  assets.monster_ice_spirit),
            golem:       this._generateMonsterSprite('golem',       assets.monster_golem),
            spider:      this._generateMonsterSprite('spider',      assets.monster_spider),
            harpy:       this._generateMonsterSprite('harpy',       assets.monster_harpy),
            mimic:       this._generateMonsterSprite('mimic',       assets.monster_mimic),
            fire_spirit: this._generateMonsterSprite('fire_spirit', assets.monster_fire_spirit),
            dark_knight: this._generateMonsterSprite('dark_knight', assets.monster_dark_knight),
            mantis:      this._generateMonsterSprite('mantis',      assets.monster_mantis),
            sand_worm:   this._generateMonsterSprite('sand_worm',   assets.monster_sand_worm),
            treant:      this._generateMonsterSprite('treant',      assets.monster_treant),
            demon:       this._generateMonsterSprite('demon',       assets.monster_demon),
            mummy:       this._generateMonsterSprite('mummy',       assets.monster_mummy),
            tentacle:    this._generateMonsterSprite('tentacle',    assets.monster_tentacle),
            medusa:      this._generateMonsterSprite('medusa',      assets.monster_medusa),
            chimera:     this._generateMonsterSprite('chimera',     assets.monster_chimera),
            griffin:     this._generateMonsterSprite('griffin',     assets.monster_griffin),
            kraken:      this._generateMonsterSprite('kraken',      assets.monster_kraken),
            phoenix:     this._generateMonsterSprite('phoenix',     assets.monster_phoenix),
            succubus:    this._generateMonsterSprite('succubus',    assets.monster_succubus),
            gargoyle:    this._generateMonsterSprite('gargoyle',    assets.monster_gargoyle),
            minotaur:    this._generateMonsterSprite('minotaur',    assets.monster_minotaur),
            centaur:     this._generateMonsterSprite('centaur',     assets.monster_centaur),
            death_knight:this._generateMonsterSprite('death_knight',assets.monster_death_knight),
            slime_king:  this._generateMonsterSprite('slime_king',  assets.monster_slime_king),
            lich:        this._generateMonsterSprite('lich',        assets.monster_lich),
        };

        // 스킬 이펙트 이미지 등록 (검정 배경 → 투명 처리)
        this.images.effects = {
            slash:     this._removeBlackBackground(assets.effect_slash),
            magic:     this._removeBlackBackground(assets.effect_magic),
            fireball:  this._removeBlackBackground(assets.effect_fireball),
            lightning: this._removeBlackBackground(assets.effect_lightning),
            heal:      this._removeBlackBackground(assets.effect_heal),
            poison:    this._removeBlackBackground(assets.effect_poison),
            shield:    this._removeBlackBackground(assets.effect_shield),
            ice:       this._removeBlackBackground(assets.effect_ice),
            fire_storm: this._removeBlackBackground(assets.effect_fire_storm),
        };

        // 아이템 이미지 등록 (흰 배경 → 투명 처리)
        this.images.items = {
            potion_hp:   this._removeWhiteBackground(assets.item_potion_hp),
            potion_mp:   this._removeWhiteBackground(assets.item_potion_mp),
            potion_full: this._removeWhiteBackground(assets.item_potion_full),
            gold:        this._removeWhiteBackground(assets.item_gold),
            sword:       this._removeWhiteBackground(assets.item_sword),
            bow:         this._removeWhiteBackground(assets.item_bow),
            staff_crystal: this._removeWhiteBackground(assets.item_staff_crystal),
            shield_iron: this._removeWhiteBackground(assets.item_shield_iron),
            armor_plate: this._removeWhiteBackground(assets.item_armor_plate),
            mythril_sword: this._removeWhiteBackground(assets.item_mythril_sword),
            ruby_staff:    this._removeWhiteBackground(assets.item_ruby_staff),
            infinite_bow:  this._removeWhiteBackground(assets.item_infinite_bow),
            hero_shield:   this._removeWhiteBackground(assets.item_hero_shield),
            sage_robe:     this._removeWhiteBackground(assets.item_sage_robe),
            dragon_egg:    this._removeWhiteBackground(assets.item_dragon_egg),
        };

        // 캐릭터 초상화 등록
        this.images.faces = {
            '길드마스터': assets.face_guide,
            '주모': assets.face_innkeeper,
            // 나머지는 시스템 기본 이미지 또는 실루엣 (추후 추가 가능)
        };

        // 프로시저럴 스킬 이펙트 캔버스 생성 (이미지 없이 캔버스로 직접 그린 이펙트)
        this.images.procEffects = this._generateProceduralEffects();

        this.loaded = true;
        console.log('[AssetManager] 모든 에셋 준비 완료');
        return true;

        } catch (err) {
            console.error('[AssetManager] 에셋 로드 중 에러 발생:', err);
            // 에러 발생 시에도 프로시저럴 에셋으로 최소한 게임 실행 가능하도록
            if (!this.images.tiles) this.images.tiles = this._generateTileset({});
            if (!this.images.megaTiles) this.images.megaTiles = this._generateMegaTiles({});
            if (!this.images.characters) this.images.characters = {};
            if (!this.images.monsters) this.images.monsters = {};
            if (!this.images.effects) this.images.effects = {};
            if (!this.images.npcs) this.images.npcs = {};
            if (!this.images.faces) this.images.faces = {};
            if (!this.images.procEffects) {
                try { this.images.procEffects = this._generateProceduralEffects(); } catch(e) { this.images.procEffects = {}; }
            }
            this.loaded = true;
            return true;
        }
    }

    // ============================================================
    // 타일셋 생성 (상세 픽셀아트)
    // ============================================================

    /**
     * 타일셋 이미지 맵 생성
     * 각 타일 ID에 대응하는 32x32 캔버스 이미지
     */
    _generateTileset(assets) {
        const tiles = {};
        const S = this.TILE_SIZE;

        // 0: 풀밭 (이동 가능) - 고퀄리티 다층 풀
        tiles[0] = this._createTile((ctx) => {
            // 베이스 그라데이션
            const grd = ctx.createLinearGradient(0, 0, S, S);
            grd.addColorStop(0, '#3a7a3a');
            grd.addColorStop(0.5, '#358535');
            grd.addColorStop(1, '#2e7030');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, S, S);
            // 풀 질감 (다층 풀잎 + 디테일)
            const grassColors = ['#2a6a2a', '#4a9a4a', '#358535', '#409040', '#2e7e2e'];
            for (let i = 0; i < 35; i++) {
                const gx = Math.floor(this._seededRandom(i * 3) * S);
                const gy = Math.floor(this._seededRandom(i * 3 + 1) * S);
                ctx.fillStyle = grassColors[i % grassColors.length];
                // 풀잎 형태 변형
                if (i % 5 === 0) {
                    ctx.fillRect(gx, gy, 1, 4); // 긴 풀
                    ctx.fillRect(gx - 1, gy, 1, 3);
                } else if (i % 5 === 1) {
                    ctx.fillRect(gx, gy, 3, 1); // 넓은 풀
                    ctx.fillRect(gx + 1, gy - 1, 1, 2);
                } else {
                    ctx.fillRect(gx, gy, 2, 2);
                }
            }
            // 작은 꽃/돌 디테일 (6% 확률)
            for (let i = 0; i < 3; i++) {
                const fx = Math.floor(this._seededRandom(i * 11 + 50) * S);
                const fy = Math.floor(this._seededRandom(i * 11 + 51) * S);
                if (i % 3 === 0) {
                    ctx.fillStyle = '#e0e040'; // 노란 꽃
                    ctx.fillRect(fx, fy, 2, 2);
                } else {
                    ctx.fillStyle = '#7a7a6a'; // 작은 돌
                    ctx.fillRect(fx, fy, 3, 2);
                    ctx.fillStyle = '#8a8a7a';
                    ctx.fillRect(fx, fy, 2, 1);
                }
            }
        }, assets.grass);

        // 1: 벽/바위 (이동 불가) - 고퀄리티 벽돌
        tiles[1] = this._createTile((ctx) => {
            ctx.fillStyle = '#5a5a6a';
            ctx.fillRect(0, 0, S, S);
            // 벽돌 패턴 (색상 변이 포함)
            const brickColors = ['#6a6a7a', '#626278', '#70707e', '#5e5e6e'];
            const bricks = [
                [1, 1, 14, 9], [17, 1, 14, 9],
                [1, 12, 10, 8], [13, 12, 10, 8], [25, 12, 6, 8],
                [1, 22, 14, 9], [17, 22, 14, 9]
            ];
            bricks.forEach((b, i) => {
                ctx.fillStyle = brickColors[i % brickColors.length];
                ctx.fillRect(b[0], b[1], b[2], b[3]);
                // 개별 벽돌 하이라이트
                ctx.fillStyle = '#7e7e8e';
                ctx.fillRect(b[0], b[1], b[2], 1);
                ctx.fillRect(b[0], b[1], 1, b[3]);
                // 그림자
                ctx.fillStyle = '#4e4e5e';
                ctx.fillRect(b[0], b[1] + b[3] - 1, b[2], 1);
                ctx.fillRect(b[0] + b[2] - 1, b[1], 1, b[3]);
            });
            // 시멘트 선
            ctx.fillStyle = '#4a4a58';
            ctx.fillRect(0, 10, S, 2);
            ctx.fillRect(0, 20, S, 2);
            ctx.fillRect(15, 0, 2, 11);
            ctx.fillRect(11, 11, 2, 10);
            ctx.fillRect(23, 11, 2, 10);
            ctx.fillRect(15, 21, 2, 11);
            // 이끼/먼지 디테일
            ctx.fillStyle = '#4a6a4a';
            ctx.fillRect(3, 28, 2, 2);
            ctx.fillRect(22, 7, 1, 2);
        }, assets.wall);

        // 2: 흙길 (이동 가능) - 자갈+발자국 디테일
        tiles[2] = this._createTile((ctx) => {
            const grd = ctx.createRadialGradient(16, 16, 4, 16, 16, 22);
            grd.addColorStop(0, '#9a8060');
            grd.addColorStop(1, '#7a6040');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, S, S);
            // 자갈 디테일
            const dirtColors = ['#6a5030', '#a08868', '#806848', '#8a7050', '#705838'];
            for (let i = 0; i < 25; i++) {
                const dx = Math.floor(this._seededRandom(i * 5 + 100) * S);
                const dy = Math.floor(this._seededRandom(i * 5 + 101) * S);
                ctx.fillStyle = dirtColors[i % dirtColors.length];
                if (i % 4 === 0) {
                    ctx.fillRect(dx, dy, 4, 3); // 큰 자갈
                    ctx.fillStyle = '#b09878';
                    ctx.fillRect(dx, dy, 3, 1); // 하이라이트
                } else {
                    ctx.fillRect(dx, dy, 2, 2);
                }
            }
            // 발자국 느낌 (경로 디테일)
            ctx.fillStyle = 'rgba(60,40,20,0.2)';
            ctx.fillRect(10, 8, 4, 3);
            ctx.fillRect(18, 18, 4, 3);
        }, assets.dirt);

        // 3: 물 (이동 불가) - 반짝임+수초 디테일
        tiles[3] = this._createTile((ctx) => {
            // 깊이감 있는 물 그라데이션
            const grd = ctx.createLinearGradient(0, 0, S, S);
            grd.addColorStop(0, '#1848a0');
            grd.addColorStop(0.5, '#2060b0');
            grd.addColorStop(1, '#1850a8');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, S, S);
            // 물결 패턴 (다층)
            ctx.fillStyle = '#2868b8';
            for (let y = 0; y < S; y += 5) {
                for (let x = 0; x < S; x += 3) {
                    const offset = (y % 10 < 5) ? 1 : -1;
                    ctx.fillRect(x + offset, y, 2, 1);
                }
            }
            // 밝은 반짝임
            const sparkles = [[6, 4], [20, 12], [12, 22], [26, 8], [8, 16]];
            sparkles.forEach(([sx, sy]) => {
                ctx.fillStyle = 'rgba(140,200,255,0.5)';
                ctx.fillRect(sx, sy, 2, 1);
                ctx.fillStyle = 'rgba(200,230,255,0.3)';
                ctx.fillRect(sx + 1, sy - 1, 1, 1);
            });
            // 수초 디테일
            ctx.fillStyle = '#206030';
            ctx.fillRect(2, 26, 1, 4);
            ctx.fillRect(3, 25, 1, 3);
            ctx.fillRect(27, 28, 1, 3);
        }, assets.water);

        // 4: 포털/계단 (맵 이동 트리거) - 글로우 개선
        tiles[4] = this._createTile((ctx) => {
            ctx.fillStyle = '#1a1a2a';
            ctx.fillRect(0, 0, S, S);
            // 소용돌이 포털 (다중 링)
            const portalColors = ['#4020a0', '#6040c0', '#8060e0', '#a080ff', '#c0a0ff', '#e0d0ff'];
            portalColors.forEach((c, i) => {
                ctx.fillStyle = c;
                ctx.beginPath();
                ctx.arc(16, 16, 14 - i * 2, 0, Math.PI * 2);
                ctx.fill();
            });
            // 소용돌이 선
            ctx.strokeStyle = 'rgba(200,180,255,0.3)';
            ctx.lineWidth = 1;
            for (let a = 0; a < Math.PI * 4; a += 0.3) {
                const r = a * 2;
                if (r > 14) break;
                const x = 16 + Math.cos(a) * r;
                const y = 16 + Math.sin(a) * r;
                ctx.fillStyle = 'rgba(200,180,255,0.2)';
                ctx.fillRect(x, y, 1, 1);
            }
        }, assets.portal);

        // 5: 나무 타일 바닥 (실내) - 나무결 디테일
        tiles[5] = this._createTile((ctx) => {
            ctx.fillStyle = '#8a6840';
            ctx.fillRect(0, 0, S, S);
            // 나무판 패턴
            for (let y = 0; y < S; y += 8) {
                ctx.fillStyle = '#7a5830';
                ctx.fillRect(0, y + 7, S, 1);
                // 나무결 라인
                ctx.fillStyle = '#7e5c34';
                ctx.fillRect(0, y + 2, S, 1);
                ctx.fillRect(0, y + 5, S, 1);
                // 하이라이트
                ctx.fillStyle = '#9a7850';
                ctx.fillRect(0, y, S, 1);
            }
            // 나무 무늬 점
            ctx.fillStyle = '#6a4820';
            ctx.beginPath(); ctx.arc(8, 12, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(24, 4, 1.5, 0, Math.PI * 2); ctx.fill();
        });

        // 6: 나무 (이동 불가, 장식) - 고퀄리티 나무
        tiles[6] = this._createTile((ctx) => {
            // 풀밭 배경
            ctx.fillStyle = '#3a7a3a';
            ctx.fillRect(0, 0, S, S);
            // 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(16, 28, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
            // 나무 기둥 (그라데이션)
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(13, 16, 6, 16);
            ctx.fillStyle = '#6a4a2a';
            ctx.fillRect(14, 16, 4, 16);
            ctx.fillStyle = '#7a5a3a';
            ctx.fillRect(15, 18, 1, 10); // 하이라이트
            // 나무 잎 (3층)
            ctx.fillStyle = '#1a5a1a';
            ctx.beginPath(); ctx.arc(16, 13, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2a7a2a';
            ctx.beginPath(); ctx.arc(13, 10, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#3a9a3a';
            ctx.beginPath(); ctx.arc(19, 8, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4aaa4a';
            ctx.beginPath(); ctx.arc(15, 6, 4, 0, Math.PI * 2); ctx.fill();
            // 하이라이트 점
            ctx.fillStyle = '#5aba5a';
            ctx.fillRect(11, 7, 2, 1);
            ctx.fillRect(17, 5, 2, 1);
        }, assets.tree);

        // 7: 동굴 바닥 (이동 가능) - 광석+균열 디테일
        tiles[7] = this._createTile((ctx) => {
            ctx.fillStyle = '#3a3040';
            ctx.fillRect(0, 0, S, S);
            const caveColors = ['#2a2030', '#4a4058', '#383048', '#504860'];
            for (let i = 0; i < 20; i++) {
                const cx = Math.floor(this._seededRandom(i * 7 + 200) * S);
                const cy = Math.floor(this._seededRandom(i * 7 + 201) * S);
                ctx.fillStyle = caveColors[i % caveColors.length];
                ctx.fillRect(cx, cy, 3 + (i % 3), 2 + (i % 2));
            }
            // 반짝이는 광석 디테일
            ctx.fillStyle = '#8080a0';
            ctx.fillRect(8, 14, 2, 1);
            ctx.fillRect(24, 6, 1, 2);
            ctx.fillStyle = '#a0a0c0';
            ctx.fillRect(8, 14, 1, 1);
            // 균열 라인
            ctx.strokeStyle = '#2a2030';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(6, 0); ctx.lineTo(10, 8); ctx.lineTo(8, 16);
            ctx.stroke();
        });

        // 8: 동굴 벽 (이동 불가) - 종유석+이끼
        tiles[8] = this._createTile((ctx) => {
            ctx.fillStyle = '#2a2030';
            ctx.fillRect(0, 0, S, S);
            // 울퉁불퉁한 바위
            const rockColors = ['#3a3048', '#4a4058', '#3e3850', '#484260'];
            const rocks = [
                [2, 2, 12, 8], [18, 2, 12, 8],
                [2, 13, 8, 7], [14, 13, 8, 7], [26, 13, 4, 7],
                [2, 23, 12, 8], [18, 23, 12, 8]
            ];
            rocks.forEach((r, i) => {
                ctx.fillStyle = rockColors[i % rockColors.length];
                ctx.fillRect(r[0], r[1], r[2], r[3]);
                // 하이라이트
                ctx.fillStyle = '#5a5870';
                ctx.fillRect(r[0] + 1, r[1] + 1, r[2] - 2, 1);
            });
            // 시멘트 선
            ctx.fillStyle = '#1a1020';
            ctx.fillRect(0, 10, S, 3);
            ctx.fillRect(0, 21, S, 2);
            ctx.fillRect(14, 0, 3, 11);
            // 이끼 디테일
            ctx.fillStyle = '#2a4a2a';
            ctx.fillRect(5, 28, 3, 2);
            ctx.fillRect(20, 9, 2, 1);
            // 광석 반짝임
            ctx.fillStyle = '#b0a0d0';
            ctx.fillRect(22, 4, 1, 1);
            ctx.fillRect(6, 16, 1, 1);
        });

        // 9: 모래 (이동 가능) - 사막/해변용  
        tiles[9] = this._createTile((ctx) => {
            const grd = ctx.createLinearGradient(0, 0, S, S);
            grd.addColorStop(0, '#d4b87a');
            grd.addColorStop(1, '#c8a862');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, S, S);
            // 모래알 디테일
            const sandColors = ['#bfa060', '#dcc090', '#c4a868', '#e0cc98'];
            for (let i = 0; i < 30; i++) {
                const sx = Math.floor(this._seededRandom(i * 4 + 300) * S);
                const sy = Math.floor(this._seededRandom(i * 4 + 301) * S);
                ctx.fillStyle = sandColors[i % sandColors.length];
                ctx.fillRect(sx, sy, 1 + (i % 2), 1);
            }
            // 바람 자국
            ctx.fillStyle = 'rgba(200,180,130,0.3)';
            ctx.fillRect(4, 12, 8, 1);
            ctx.fillRect(18, 20, 10, 1);
        });

        // 10: 꽃밭 (이동 가능) - 풀밭+꽃
        tiles[10] = this._createTile((ctx) => {
            ctx.fillStyle = '#358535';
            ctx.fillRect(0, 0, S, S);
            // 풀 디테일
            for (let i = 0; i < 15; i++) {
                const gx = Math.floor(this._seededRandom(i * 3 + 400) * S);
                const gy = Math.floor(this._seededRandom(i * 3 + 401) * S);
                ctx.fillStyle = ['#2e7030', '#40a040'][i % 2];
                ctx.fillRect(gx, gy, 2, 3);
            }
            // 다양한 꽃
            const flowers = [
                { x: 6, y: 8, c: '#ff6080' },   // 분홍
                { x: 18, y: 4, c: '#ffff60' },   // 노랑
                { x: 12, y: 20, c: '#60a0ff' },  // 파랑
                { x: 26, y: 14, c: '#ff80ff' },  // 보라
                { x: 4, y: 26, c: '#ffffff' },    // 하양
            ];
            flowers.forEach(f => {
                ctx.fillStyle = f.c;
                ctx.fillRect(f.x, f.y, 2, 2);
                ctx.fillRect(f.x - 1, f.y + 1, 1, 1);
                ctx.fillRect(f.x + 2, f.y + 1, 1, 1);
                ctx.fillStyle = '#408040';
                ctx.fillRect(f.x, f.y + 2, 1, 3); // 줄기
            });
        });

        return tiles;
    }

    // ============================================================
    // 캐릭터 스프라이트시트 생성
    // ============================================================

    /**
     * 직업별 캐릭터 스프라이트시트 생성
     * 4방향(down, left, right, up) × 4프레임 = 16개 포즈
     * @param {string} job - 직업명
     * @param {HTMLImageElement} img - (옵션) 실제 이미지 에셋
     * @returns {Object} { down: [4 canvas], left: [4 canvas], right: [4 canvas], up: [4 canvas] }
     */
    _generateCharacterSheet(job, img = null) {
        // 직업별 색상 팔레트
        const palettes = {
            '전사': { body: '#c04040', armor: '#8a3030', hair: '#3a2a1a', skin: '#f0c8a0', weapon: '#a0a0b0' },
            '도적': { body: '#404060', armor: '#303050', hair: '#1a1a2a', skin: '#e8c098', weapon: '#808090' },
            '주술사': { body: '#5030a0', armor: '#402080', hair: '#e0d0e0', skin: '#f0c8a0', weapon: '#a070ff' },
            '도사': { body: '#e0e0f0', armor: '#c0c0e0', hair: '#c0c0c0', skin: '#f0c8a0', weapon: '#60d0a0' },
            'GM': { body: '#ffd700', armor: '#daa520', hair: '#ff4500', skin: '#f0c8a0', weapon: '#fff8dc' },
        };

        const palette = palettes[job] || palettes['전사'];
        const directions = ['down', 'left', 'right', 'up'];
        const sheet = {};

        directions.forEach(dir => {
            sheet[dir] = [];
            for (let frame = 0; frame < 4; frame++) {
                if (img) {
                    const canvas = document.createElement('canvas');
                    canvas.width = this.SPRITE_SIZE;
                    canvas.height = this.SPRITE_SIZE;
                    const ctx = canvas.getContext('2d');

                    // Simple animation for single image: just bob up/down
                    const bounce = (frame % 2 === 1) ? -1 : 0;
                    ctx.drawImage(img, 0, bounce, this.SPRITE_SIZE, this.SPRITE_SIZE);
                    sheet[dir].push(canvas);
                } else {
                    sheet[dir].push(this._drawCharacter(palette, dir, frame, job));
                }
            }
        });

        return sheet;
    }

    /**
     * 단일 캐릭터 프레임 생성 (32x32 상세 픽셀아트)
     * @param {Object} palette - 색상 팔레트
     * @param {string} direction - 방향
     * @param {number} frame - 애니메이션 프레임 (0~3)
     * @param {string} job - 직업명
     * @returns {HTMLCanvasElement} 캐릭터 프레임 캔버스
     */
    _drawCharacter(palette, direction, frame, job) {
        const canvas = document.createElement('canvas');
        canvas.width = this.SPRITE_SIZE;
        canvas.height = this.SPRITE_SIZE;
        const ctx = canvas.getContext('2d');
        const S = this.SPRITE_SIZE;

        // 걷기 애니메이션 오프셋 (프레임에 따라 발 위치 변경)
        const walkOffset = [0, -1, 0, 1][frame];
        const legOffset = frame % 2 === 1 ? 1 : 0;

        // === 그림자 ===
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(16, 30, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // === 몸통 ===
        const bodyY = 12 + walkOffset;

        // 발 (걷기 애니메이션)
        ctx.fillStyle = '#4a3020';
        if (frame === 0 || frame === 2) {
            ctx.fillRect(11, 26 + walkOffset, 4, 4);
            ctx.fillRect(17, 26 + walkOffset, 4, 4);
        } else if (frame === 1) {
            ctx.fillRect(10, 25 + walkOffset, 4, 5);
            ctx.fillRect(18, 27 + walkOffset, 4, 3);
        } else {
            ctx.fillRect(10, 27 + walkOffset, 4, 3);
            ctx.fillRect(18, 25 + walkOffset, 4, 5);
        }

        // 다리
        ctx.fillStyle = palette.armor;
        ctx.fillRect(11, 22 + walkOffset, 4, 5);
        ctx.fillRect(17, 22 + walkOffset, 4, 5);

        // 몸체
        ctx.fillStyle = palette.body;
        ctx.fillRect(10, bodyY, 12, 11);
        // 갑옷/의상 디테일
        ctx.fillStyle = palette.armor;
        ctx.fillRect(10, bodyY, 12, 3);
        // 벨트
        ctx.fillStyle = '#8a7a50';
        ctx.fillRect(10, bodyY + 8, 12, 2);

        // 팔 (방향에 따라)
        ctx.fillStyle = palette.body;
        if (direction === 'down' || direction === 'up') {
            // 양쪽 팔
            const armFrame = frame % 2 === 1 ? 1 : 0;
            ctx.fillRect(7, bodyY + 1 + armFrame, 3, 8);
            ctx.fillRect(22, bodyY + 1 - armFrame, 3, 8);
            // 손
            ctx.fillStyle = palette.skin;
            ctx.fillRect(7, bodyY + 8 + armFrame, 3, 2);
            ctx.fillRect(22, bodyY + 8 - armFrame, 3, 2);
        } else if (direction === 'left') {
            ctx.fillRect(8, bodyY + 1, 3, 9);
            ctx.fillStyle = palette.skin;
            ctx.fillRect(8, bodyY + 9, 3, 2);
        } else {
            ctx.fillRect(21, bodyY + 1, 3, 9);
            ctx.fillStyle = palette.skin;
            ctx.fillRect(21, bodyY + 9, 3, 2);
        }

        // === 머리 ===
        const headY = 3 + walkOffset;

        // 방향별 얼굴 렌더링
        if (direction === 'down') {
            // 머리카락 뒤
            ctx.fillStyle = palette.hair;
            ctx.fillRect(10, headY, 12, 10);
            // 얼굴 (피부)
            ctx.fillStyle = palette.skin;
            ctx.fillRect(11, headY + 2, 10, 7);
            // 눈
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(13, headY + 4, 2, 2);
            ctx.fillRect(17, headY + 4, 2, 2);
            // 눈동자 하이라이트
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(13, headY + 4, 1, 1);
            ctx.fillRect(17, headY + 4, 1, 1);
            // 입
            ctx.fillStyle = '#c08070';
            ctx.fillRect(14, headY + 7, 4, 1);
        } else if (direction === 'up') {
            ctx.fillStyle = palette.hair;
            ctx.fillRect(10, headY, 12, 10);
            // 뒷모습은 머리카락만
            ctx.fillStyle = palette.hair;
            ctx.fillRect(9, headY + 2, 14, 6);
        } else if (direction === 'left') {
            ctx.fillStyle = palette.hair;
            ctx.fillRect(10, headY, 12, 10);
            ctx.fillStyle = palette.skin;
            ctx.fillRect(10, headY + 2, 8, 7);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(12, headY + 4, 2, 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(12, headY + 4, 1, 1);
            ctx.fillStyle = '#c08070';
            ctx.fillRect(12, headY + 7, 3, 1);
        } else { // right
            ctx.fillStyle = palette.hair;
            ctx.fillRect(10, headY, 12, 10);
            ctx.fillStyle = palette.skin;
            ctx.fillRect(14, headY + 2, 8, 7);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(18, headY + 4, 2, 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(19, headY + 4, 1, 1);
            ctx.fillStyle = '#c08070';
            ctx.fillRect(17, headY + 7, 3, 1);
        }

        // GM 전용: 황금 왕관
        if (job === 'GM') {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(10, headY - 3, 12, 3);
            ctx.fillRect(10, headY - 5, 2, 2);
            ctx.fillRect(15, headY - 5, 2, 2);
            ctx.fillRect(20, headY - 5, 2, 2);
            // 보석
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(15, headY - 4, 2, 1);
        }

        return canvas;
    }

    /**
     * NPC 스프라이트 생성 (단일 정면 이미지)
     */
    _generateNPCSprite(bodyColor, accentColor, img = null) {
        const canvas = document.createElement('canvas');
        canvas.width = this.SPRITE_SIZE;
        canvas.height = this.SPRITE_SIZE;
        const ctx = canvas.getContext('2d');

        if (img) {
            ctx.drawImage(img, 0, 0, this.SPRITE_SIZE, this.SPRITE_SIZE);
            return canvas;
        }

        // 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(16, 30, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 몸체
        ctx.fillStyle = bodyColor;
        ctx.fillRect(10, 14, 12, 12);
        ctx.fillStyle = accentColor;
        ctx.fillRect(10, 14, 12, 3);

        // 다리
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(11, 26, 4, 4);
        ctx.fillRect(17, 26, 4, 4);

        // 머리
        ctx.fillStyle = '#f0c8a0';
        ctx.fillRect(11, 5, 10, 9);
        // 눈
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(13, 8, 2, 2);
        ctx.fillRect(17, 8, 2, 2);
        // 머리카락
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(10, 3, 12, 4);

        // NPC 표시 느낌표
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(15, 0, 2, 2);

        return canvas;
    }

    /**
     * UI 아이콘 생성
     */
    _generateUIIcons(assets = {}) {
        const icons = {};

        // HP 아이콘 (새로운 포션 이미지 적용)
        icons.hp = this._createSmallIcon(16, (ctx) => {
            if (assets.item_potion_hp) {
                ctx.drawImage(assets.item_potion_hp, 0, 0, 16, 16);
            } else {
                ctx.fillStyle = '#ff4040';
                ctx.beginPath();
                ctx.arc(5, 5, 4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath();
                ctx.arc(11, 5, 4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath();
                ctx.moveTo(1, 7); ctx.lineTo(8, 14); ctx.lineTo(15, 7);
                ctx.fill();
            }
        });

        // MP 아이콘 (파란 마름모 유지)
        icons.mp = this._createSmallIcon(16, (ctx) => {
            ctx.fillStyle = '#4080ff';
            ctx.beginPath();
            ctx.moveTo(8, 1); ctx.lineTo(15, 8); ctx.lineTo(8, 15); ctx.lineTo(1, 8);
            ctx.fill();
            ctx.fillStyle = '#80b0ff';
            ctx.beginPath();
            ctx.moveTo(8, 3); ctx.lineTo(12, 8); ctx.lineTo(8, 13); ctx.lineTo(4, 8);
            ctx.fill();
        });

        // Gold 아이콘 (새 동전 이미지 적용)
        icons.gold = this._createSmallIcon(16, (ctx) => {
            if (assets.item_gold) {
                ctx.drawImage(assets.item_gold, 0, 0, 16, 16);
            } else {
                ctx.fillStyle = '#c49a20';
                ctx.beginPath();
                ctx.arc(8, 8, 7, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#f0c040';
                ctx.beginPath();
                ctx.arc(8, 8, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#c49a20';
                ctx.font = 'bold 8px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('$', 8, 11);
            }
        });

        // Effect Slash 아이콘 추가 (필요시 렌더러가 꺼내 쓸 수 있도록)
        if (assets.effect_slash) icons.slash = assets.effect_slash;
        if (assets.effect_magic) icons.magic = assets.effect_magic;
        if (assets.item_sword) icons.sword = assets.item_sword;

        return icons;
    }

    // ============================================================
    // 몬스터 스프라이트 생성
    // ============================================================

    /**
     * 몬스터 타입별 4프레임 스프라이트 생성
     * @param {string} type - 몬스터 타입
     * @param {HTMLImageElement} img - (옵션) 실제 이미지 에셋
     * @returns {Array<HTMLCanvasElement>} 4프레임 배열
     */
    _generateMonsterSprite(type, img = null) {
        const configs = {
            slime: { body: '#40c040', eye: '#fff', size: 0.7 },
            wolf: { body: '#808080', eye: '#ff4040', size: 0.85 },
            goblin: { body: '#c09040', eye: '#fff', size: 0.75 },
            skeleton: { body: '#d0d0d0', eye: '#ff0000', size: 0.8 },
            boss_ogre: { body: '#c04040', eye: '#FFD700', size: 1.0 },
            squirrel: { body: '#a08050', eye: '#000', size: 0.8 }
        };
        const cfg = configs[type] || configs.slime;
        const frames = [];

        for (let f = 0; f < 4; f++) {
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            const bounce = [0, -1, 0, 1][f];

            if (img) {
                // 그림자
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(16, 28, 8 * cfg.size, 3, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.drawImage(img, 0, bounce, 32, 32);
                frames.push(canvas);
                continue;
            }

            // 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(16, 28, 8 * cfg.size, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            if (type === 'slime') {
                // 슬라임: 탱글탱글 젤리 형태
                ctx.fillStyle = cfg.body;
                ctx.beginPath();
                ctx.ellipse(16, 20 + bounce, 10, 8 - bounce * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                // 하이라이트
                ctx.fillStyle = '#60e060';
                ctx.beginPath();
                ctx.ellipse(13, 17 + bounce, 3, 2, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (type === 'wolf') {
                // 늑대: 네발 동물 형태
                ctx.fillStyle = cfg.body;
                ctx.fillRect(8, 14 + bounce, 16, 10);
                // 머리
                ctx.fillStyle = '#909090';
                ctx.fillRect(4, 12 + bounce, 8, 8);
                // 꼬리
                ctx.fillRect(24, 12 + bounce, 4, 3);
                // 다리
                ctx.fillStyle = '#707070';
                ctx.fillRect(9, 24 + bounce, 3, 4);
                ctx.fillRect(20, 24 + bounce, 3, 4);
            } else if (type === 'goblin') {
                // 고블린: 작은 인간형
                ctx.fillStyle = cfg.body;
                ctx.fillRect(12, 16 + bounce, 8, 8);
                // 머리
                ctx.fillStyle = '#d0a050';
                ctx.fillRect(11, 8 + bounce, 10, 8);
                // 다리
                ctx.fillStyle = '#805020';
                ctx.fillRect(13, 24 + bounce, 3, 4);
                ctx.fillRect(17, 24 + bounce, 3, 4);
                // 귀
                ctx.fillStyle = '#c09040';
                ctx.fillRect(9, 6 + bounce, 3, 4);
                ctx.fillRect(20, 6 + bounce, 3, 4);
            } else if (type === 'skeleton') {
                // 해골 전사
                ctx.fillStyle = cfg.body;
                ctx.fillRect(12, 14 + bounce, 8, 10);
                // 머리 (해골)
                ctx.fillRect(11, 5 + bounce, 10, 9);
                ctx.fillStyle = '#000';
                ctx.fillRect(13, 8 + bounce, 2, 3);
                ctx.fillRect(17, 8 + bounce, 2, 3);
                ctx.fillRect(14, 12 + bounce, 4, 1);
                // 다리
                ctx.fillStyle = '#b0b0b0';
                ctx.fillRect(13, 24 + bounce, 2, 4);
                ctx.fillRect(17, 24 + bounce, 2, 4);
            } else if (type === 'boss_ogre') {
                // 오우거 대장 (크게)
                ctx.fillStyle = cfg.body;
                ctx.fillRect(6, 10 + bounce, 20, 16);
                // 머리
                ctx.fillStyle = '#e06060';
                ctx.fillRect(9, 2 + bounce, 14, 10);
                // 뿔
                ctx.fillStyle = '#a0a0a0';
                ctx.fillRect(9, 0 + bounce, 3, 4);
                ctx.fillRect(20, 0 + bounce, 3, 4);
                // 다리
                ctx.fillStyle = '#a03030';
                ctx.fillRect(10, 26 + bounce, 4, 4);
                ctx.fillRect(18, 26 + bounce, 4, 4);
            }

            // 눈
            ctx.fillStyle = cfg.eye;
            if (type === 'slime') {
                ctx.fillRect(13, 18 + bounce, 2, 2);
                ctx.fillRect(18, 18 + bounce, 2, 2);
            } else if (type === 'wolf') {
                ctx.fillRect(6, 14 + bounce, 2, 2);
            } else if (type === 'boss_ogre') {
                ctx.fillRect(13, 5 + bounce, 3, 3);
                ctx.fillRect(18, 5 + bounce, 3, 3);
            }
            // 눈동자
            ctx.fillStyle = '#000';
            if (type === 'slime') {
                ctx.fillRect(14, 19 + bounce, 1, 1);
                ctx.fillRect(19, 19 + bounce, 1, 1);
            }

            frames.push(canvas);
        }

        return frames;
    }

    /**
     * 몬스터 스프라이트 접근자
     * @param {string} type - 몬스터 타입
     * @param {number} frame - 애니메이션 프레임 (0~3)
     * @returns {HTMLCanvasElement|null}
     */
    getMonsterSprite(type, frame) {
        const sprites = this.images.monsters?.[type];
        if (!sprites) return null;
        return sprites[frame % sprites.length] || null;
    }

    /**
     * 캐릭터 스프라이트 접근자
     * @param {string} job - 직업명 (한국어)
     * @param {string|number} direction - 방향명 혹은 인덱스
     * @param {number} frame - 애니메이션 프레임
     */
    getSprite(job, direction, frame) {
        const directions = ['down', 'left', 'right', 'up'];
        const dirKey = typeof direction === 'number' ? directions[direction] : direction;
        
        // 직업명이 영어로 들어올 경우를 대비한 매핑
        const jobMapping = {
            'warrior': '전사', 'rogue': '도적', 'shaman': '주술사', 'healer': '도사',
            'thief': '도적', 'mage': '주술사', 'poet': '도사'
        };
        const searchJob = jobMapping[job] || job;
        
        const sheet = this.images.characters?.[searchJob] || this.images.characters?.['전사'];
        if (!sheet) return null;
        
        const frames = sheet[dirKey];
        if (!frames) return null;
        
        return frames[frame % frames.length] || null;
    }

    // ============================================================
    // 유틸리티
    // ============================================================

    /**
     * 타일 생성 헬퍼
     */
    _createTile(drawFn, img = null) {
        const canvas = document.createElement('canvas');
        canvas.width = this.TILE_SIZE;
        canvas.height = this.TILE_SIZE;
        const ctx = canvas.getContext('2d');
        if (img) {
            ctx.drawImage(img, 0, 0, this.TILE_SIZE, this.TILE_SIZE);
        } else {
            drawFn(ctx);
        }
        return canvas;
    }

    /**
     * 소형 아이콘 생성 헬퍼
     */
    _createSmallIcon(size, drawFn) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        drawFn(ctx);
        return canvas;
    }

    /**
     * 시드 기반 의사 난수 (타일 질감 일관성 보장)
     */
    _seededRandom(seed) {
        const x = Math.sin(seed + 1) * 10000;
        return x - Math.floor(x);
    }

    /**
     * 흰 배경 제거 (몬스터/아이템 이미지용)
     * 밝은 픽셀(R,G,B 모두 200 이상)을 투명 처리
     */
    _removeWhiteBackground(imgEl) {
        if (!imgEl) return null;
        const canvas = document.createElement('canvas');
        canvas.width  = imgEl.width  || imgEl.naturalWidth  || this.TILE_SIZE;
        canvas.height = imgEl.height || imgEl.naturalHeight || this.TILE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i+1], b = d[i+2];
            if (r > 200 && g > 200 && b > 200) {
                const factor = ((r - 200) + (g - 200) + (b - 200)) / (3 * 55);
                d[i+3] = Math.min(d[i+3], Math.floor(d[i+3] * (1 - factor)));
            }
        }
        ctx.putImageData(data, 0, 0);
        return canvas;
    }

    /**
     * 검정 배경 제거 (스킬 이펙트 이미지용)
     */
    _removeBlackBackground(imgEl) {
        if (!imgEl) return null;
        const canvas = document.createElement('canvas');
        canvas.width  = imgEl.width  || imgEl.naturalWidth  || this.TILE_SIZE;
        canvas.height = imgEl.height || imgEl.naturalHeight || this.TILE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i+1], b = d[i+2];
            const brightness = (r + g + b) / 3;
            if (brightness < 80) {
                const factor = (80 - brightness) / 80;
                d[i+3] = Math.min(d[i+3], Math.floor(d[i+3] * (1 - factor)));
            }
        }
        ctx.putImageData(data, 0, 0);
        return canvas;
    }

    // ============================================================
    // 메가타일 생성 (타일 6개 합체 대형 지형 오브젝트)
    // ============================================================

    /**
     * 메가타일 8종 프로시저럴 생성 + 실제 에셋 연동
     */
    _generateMegaTiles(assets = {}) {
        const S = this.TILE_SIZE;
        const mgt = {};
        const mk = (w, h) => {
            const c = document.createElement('canvas');
            c.width = w * S; c.height = h * S;
            return { c, x: c.getContext('2d') };
        };

        if (assets.mega_ruined_temple) {
            mgt['ruined_temple'] = { canvas: assets.mega_ruined_temple, tilesW: 3, tilesH: 3, theme: 'dungeon' };
        }

        // 1. 대형 고목 (실제 에셋: mega_cherry 활용)
        if (assets.mega_cherry) {
            mgt['cherry_blossom'] = { canvas: assets.mega_cherry, tilesW: 3, tilesH: 3, theme: 'village' };
        }

        // 2. 대형 기와집 (실제 에셋: mega_house 활용)
        if (assets.mega_house) {
            mgt['wooden_house'] = { canvas: assets.mega_house, tilesW: 4, tilesH: 3, theme: 'village' };
        }

        // 3. 정자 (실제 에셋: mega_pavillion 활용)
        if (assets.mega_pavillion) {
            mgt['pavillion'] = { canvas: assets.mega_pavillion, tilesW: 3, tilesH: 3, theme: 'village' };
        }

        // 4. 꽃단지 (실제 에셋: mega_flower 활용)
        if (assets.mega_flower) {
            mgt['flower_bed'] = { canvas: assets.mega_flower, tilesW: 2, tilesH: 2, theme: 'village' };
        }

        // 5. 광산 레일 (실제 에셋: mine_rail 활용)
        if (assets.mine_rail) {
            mgt['mine_rail'] = { canvas: assets.mine_rail, tilesW: 2, tilesH: 2, theme: 'dungeon' };
        }

        // 6. 광산 광석 (실제 에셋: mine_ore 활용)
        if (assets.mine_ore) {
            mgt['mine_ore'] = { canvas: assets.mine_ore, tilesW: 1, tilesH: 1, theme: 'dungeon' };
        }

        // 7. 설원 얼음 석상 (실제 에셋: snow_statue 활용)
        if (assets.snow_statue) {
            mgt['ice_statue'] = { canvas: assets.snow_statue, tilesW: 2, tilesH: 3, theme: 'snow' };
        }

        // 8. 헬 하운드 용암 구덩이 (실제 에셋: hell_lava 활용)
        if (assets.hell_lava) {
            mgt['lava_pit'] = { canvas: assets.hell_lava, tilesW: 3, tilesH: 2, theme: 'lava' };
        }

        // --- 기존 절차적 타일들도 유지 (에셋이 없을 경우 대비) ---
        const rnd = (seed) => { const v = Math.sin(seed + 1) * 10000; return v - Math.floor(v); };
        
        if (!mgt['big_tree']) {
            const { c, x: ctx } = mk(2, 3);
            ctx.fillStyle = '#5a3a1a'; ctx.fillRect(24, 44, 16, 52);
            [ [10,6,19,'#2e6014'],[33,2,22,'#3a7820'],[54,8,17,'#286010'],[20,22,23,'#348018'],[44,24,20,'#3a7820'],[32,36,25,'#2c7016'] ].forEach(([lx,ly,r,col]) => {
                ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI*2); ctx.fill();
            });
            mgt['big_tree'] = { canvas: c, tilesW: 2, tilesH: 3, theme: 'forest' };
        }

        // 우물
        {
            const { c, x: ctx } = mk(2, 2);
            ctx.fillStyle='#7a7a88'; ctx.beginPath(); ctx.arc(32,48,24,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#304a8a'; ctx.beginPath(); ctx.arc(32,48,16,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#5a3010'; ctx.fillRect(10,10,4,40); ctx.fillRect(50,10,4,40);
            ctx.fillStyle='#8a6040'; ctx.fillRect(8,4,48,12);
            mgt['well'] = { canvas: c, tilesW: 2, tilesH: 2, theme: 'village' };
        }
        // 7. 용암 기둥 (2x3 = 64x96px, 용암 던전)
        {
            const { c, x: ctx } = mk(2, 3);
            ctx.fillStyle='#4a2a10'; ctx.fillRect(20,30,24,62); // 기둥 몸체
            ctx.fillStyle='#3a1a08'; ctx.fillRect(18,80,28,16); // 기둥 받침
            // 용암 줄기
            const lCols = ['#ff4400','#ff8000','#ffaa00'];
            for(let py=30;py<90;py+=6) {
                for(let px=22;px<42;px+=3) {
                    ctx.fillStyle = lCols[rnd(px*3+py)>0.5?2:0];
                    ctx.fillRect(px+Math.floor(rnd(px+py*5)*3), py, 2, 5);
                }
            }
            const lg = ctx.createRadialGradient(32,30,4,32,30,30);
            lg.addColorStop(0,'rgba(255,150,0,0.5)'); lg.addColorStop(1,'rgba(255,0,0,0)');
            ctx.fillStyle=lg; ctx.fillRect(4,4,56,56);
            mgt['lava_pillar'] = { canvas: c, tilesW: 2, tilesH: 3, theme: 'lava' };
        }

        // 8. 얼음 결정탑 (2x2 = 64x64px, 눈 던전)
        {
            const { c, x: ctx } = mk(2, 2);
            const W = c.width, H = c.height;
            ctx.fillStyle='#c0d4e8'; ctx.fillRect(0,0,W,H);
            [
                [[32,4],[20,40],[44,40]],[[52,10],[44,38],[60,38]],
                [[14,12],[6,36],[22,36]],[[32,20],[26,52],[38,52]],
            ].forEach((pts, i) => {
                ctx.fillStyle=['#80c0f0','#60a0e0','#a0d0ff','#50b0f8'][i];
                ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
                ctx.lineTo(pts[1][0],pts[1][1]); ctx.lineTo(pts[2][0],pts[2][1]);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle='#c0e8ff';
                ctx.beginPath();
                ctx.moveTo(pts[0][0],pts[0][1]);
                ctx.lineTo((pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2);
                ctx.lineTo(pts[0][0],pts[0][1]); ctx.closePath(); ctx.fill();
            });
            ctx.fillStyle='rgba(200,230,255,0.4)';
            for(let i=0;i<10;i++) ctx.fillRect(rnd(i*7+300)*W, rnd(i*7+301)*H, 3, 3);
            mgt['ice_crystal'] = { canvas: c, tilesW: 2, tilesH: 2, theme: 'snow' };
        }

        // 9. 시장 매대 (3x2, 마을)
        {
            const { c, x: ctx } = mk(3, 2);
            const W = c.width, H = c.height;
            ctx.fillStyle='#8a6030'; ctx.fillRect(4,20,88,40); // 나무 테이블
            ctx.fillStyle='#c08040'; ctx.fillRect(8,24,80,32);
            // 매대 위 상품들
            [[15,30,'#e04040'],[35,32,'#40a040'],[55,28,'#ffd700'],[75,34,'#4040e0']].forEach(([ix,iy,ic])=> {
                ctx.fillStyle=ic; ctx.fillRect(ix,iy,8,10);
            });
            // 천막 기둥
            ctx.fillStyle='#5a3010'; ctx.fillRect(6,4,4,50); ctx.fillRect(86,4,4,50);
            mgt['market_stall'] = { canvas: c, tilesW: 3, tilesH: 2, theme: 'village' };
        }

        // 10. 고대 석상 (2x3, 던전/보스)
        {
            const { c, x: ctx } = mk(2, 3);
            const W = c.width, H = c.height;
            ctx.fillStyle='#8a8a96'; ctx.fillRect(16,70,32,20); // 받침대
            ctx.fillStyle='#7a7a88'; ctx.fillRect(14,86,36,6);
            // 석상 몸체 (실루엣)
            ctx.fillStyle='#9a9aaa';
            ctx.beginPath(); ctx.moveTo(32,10); ctx.lineTo(16,40); ctx.lineTo(16,70); ctx.lineTo(48,70); ctx.lineTo(48,40); ctx.closePath(); ctx.fill();
            ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(20,20,8,20); // 광택
            mgt['statue'] = { canvas: c, tilesW: 2, tilesH: 3, theme: 'outdoor' };
        }
        // 11. 마을 우물 (2x2, 마을)
        {
            const { c, x: ctx } = mk(2, 2);
            ctx.fillStyle='#7a7a88'; 
            ctx.beginPath(); ctx.arc(32,48,24,0,Math.PI*2); ctx.fill(); // 우물 본체
            ctx.fillStyle='#304a8a';
            ctx.beginPath(); ctx.arc(32,48,16,0,Math.PI*2); ctx.fill(); // 물
            // 지붕 기둥
            ctx.fillStyle='#5a3010'; ctx.fillRect(10,10,4,40); ctx.fillRect(50,10,4,40);
            ctx.fillStyle='#8a6040'; ctx.fillRect(8,4,48,12); // 지붕
            mgt['well'] = { canvas: c, tilesW: 2, tilesH: 2, theme: 'village' };
        }

        // 12. 성문 (4x2, 마을/성곽)
        {
            const { c, x: ctx } = mk(4, 2);
            ctx.fillStyle='#5a5a66'; ctx.fillRect(0, 10, 128, 54); // 전체 벽면
            ctx.fillStyle='#3a3a44'; ctx.fillRect(20, 20, 88, 44); // 아치형 입구 공간
            ctx.fillStyle='#5a3010'; ctx.fillRect(24, 24, 80, 40); // 나무 문
            // 격자 무늬
            ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=2;
            for(let i=0; i<4; i++) ctx.strokeRect(i*32,10,32,54);
            mgt['castle_gate'] = { canvas: c, tilesW: 4, tilesH: 2, theme: 'village' };
        }

        // 13. 세계수 (3x4, 숲/마을)
        {
            const { c, x: ctx } = mk(3, 4);
            // 줄기
            ctx.fillStyle='#5a3010'; 
            ctx.beginPath(); ctx.moveTo(48, 128); ctx.quadraticCurveTo(30, 80, 48, 40); ctx.quadraticCurveTo(66, 80, 48, 128); ctx.fill();
            // 잎더미
            const leaves = [[48,40,40,'#206020'],[28,50,30,'#307030'],[68,50,30,'#307030'],[48,20,35,'#105010']];
            leaves.forEach(([lx,ly,lr,lc]) => {
                ctx.fillStyle=lc; ctx.beginPath(); ctx.arc(lx,ly,lr,0,Math.PI*2); ctx.fill();
            });
            mgt['world_tree'] = { canvas: c, tilesW: 3, tilesH: 4, theme: 'outdoor' };
        }

        // 14. 고대 마법진 (3x3, 던전/보스)
        {
            const { c, x: ctx } = mk(3, 3);
            ctx.strokeStyle='rgba(100,200,255,0.6)'; ctx.lineWidth=3;
            ctx.beginPath(); ctx.arc(48,48,40,0,Math.PI*2); ctx.stroke(); // 큰 원
            ctx.beginPath(); ctx.arc(48,48,25,0,Math.PI*2); ctx.stroke(); // 작은 원
            // 육각별
            ctx.beginPath();
            for(let i=0; i<7; i++) {
                const ang = (i * Math.PI * 2 / 6) - Math.PI/2;
                const r = 40;
                if(i===0) ctx.moveTo(48 + Math.cos(ang)*r, 48 + Math.sin(ang)*r);
                else ctx.lineTo(48 + Math.cos(ang)*r, 48 + Math.sin(ang)*r);
            }
            ctx.stroke();
            mgt['magic_circle'] = { canvas: c, tilesW: 3, tilesH: 3, theme: 'dungeon' };
        }

        // 15. 황금 보물더미 (2x2, 던전)
        {
            const { c, x: ctx } = mk(2, 2);
            ctx.fillStyle='#ffd700';
            for(let i=0; i<30; i++) {
                ctx.beginPath(); ctx.arc(10+Math.random()*44, 20+Math.random()*34, 4+Math.random()*6, 0, Math.PI*2); ctx.fill();
            }
            ctx.fillStyle='#ffec8b';
            for(let i=0; i<10; i++) ctx.fillRect(15+Math.random()*34, 25+Math.random()*24, 3, 3);
            mgt['treasure_pile'] = { canvas: c, tilesW: 2, tilesH: 2, theme: 'dungeon' };
        }

        // 16. 해골 제단 (3x2, 던전)
        {
            const { c, x: ctx } = mk(3, 2);
            ctx.fillStyle='#4a4a55'; ctx.fillRect(16, 20, 64, 40); // 제단 기단
            ctx.fillStyle='#d2d2d2'; 
            for(let i=0; i<5; i++) {
                ctx.beginPath(); ctx.arc(24+i*12, 18, 5, 0, Math.PI*2); ctx.fill(); // 두개골
            }
            mgt['skull_altar'] = { canvas: c, tilesW: 3, tilesH: 2, theme: 'dungeon' };
        }

        // --- 지형 전용 메가타일 (Floor Terrains) ---

        // 17. 대형 돌무더기 바닥 (3x2, 야외/던전)
        {
            const { c, x: ctx } = mk(3, 2);
            const W = c.width, H = c.height;
            for(let i=0; i<12; i++) {
                const px = rnd(i*7)*W, py = rnd(i*7+1)*H;
                const r = 8 + rnd(i*7+2)*12;
                ctx.fillStyle = ['#7a7a8a', '#6a6a7a', '#8a8a9a'][i%3];
                ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.beginPath(); ctx.arc(px-2, py-2, r*0.6, 0, Math.PI*2); ctx.fill();
            }
            mgt['stone_patch'] = { canvas: c, tilesW: 3, tilesH: 2, theme: 'outdoor' };
        }

        // 18. 이끼 낀 바위 지대 (2x3, 숲/야외)
        {
            const { c, x: ctx } = mk(2, 3);
            const W = c.width, H = c.height;
            for(let i=0; i<8; i++) {
                const px = rnd(i*13)*W, py = rnd(i*13+1)*H;
                ctx.fillStyle = '#5a5a6a';
                ctx.beginPath(); ctx.ellipse(px, py, 12, 8, rnd(i), 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(50,120,40,0.4)'; // 이끼
                ctx.fillRect(px-6, py-4, 12, 8);
            }
            mgt['mossy_rocks'] = { canvas: c, tilesW: 2, tilesH: 3, theme: 'forest' };
        }

        // 19. 사구 지형 (3x2, 사막)
        {
            const { c, x: ctx } = mk(3, 2);
            const W = c.width, H = c.height;
            ctx.strokeStyle = 'rgba(180,150,80,0.5)'; ctx.lineWidth = 3;
            for(let i=0; i<5; i++) {
                ctx.beginPath();
                ctx.moveTo(0, 10 + i*10);
                ctx.bezierCurveTo(W/3, i*10-10, 2*W/3, i*10+20, W, 10 + i*10);
                ctx.stroke();
            }
            mgt['sand_dunes'] = { canvas: c, tilesW: 3, tilesH: 2, theme: 'desert' };
        }

        // 20. 초가집 (3x2, 마을)
        {
            const { c, x: ctx } = mk(3, 2);
            ctx.fillStyle='#8b4513'; ctx.fillRect(10, 30, 76, 30); // 벽면
            ctx.fillStyle='#daa520'; // 초가 지붕
            ctx.beginPath(); ctx.moveTo(0,34); ctx.lineTo(48,4); ctx.lineTo(96,34); ctx.closePath(); ctx.fill();
            ctx.fillStyle='#5d2e0a'; ctx.fillRect(38, 40, 20, 20); // 문
            ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.strokeRect(38, 40, 20, 20);
            mgt['straw_house'] = { canvas: c, tilesW: 3, tilesH: 2, theme: 'village' };
        }

        // 21. 고목 (2x3, 림/야외)
        {
            const { c, x: ctx } = mk(2, 3);
            ctx.fillStyle='#4b2e0a';
            ctx.fillRect(24, 64, 16, 32); // 밑동
            ctx.beginPath(); // 꼬인 가지 형태
            ctx.moveTo(32, 64); ctx.quadraticCurveTo(10, 40, 20, 20); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(32, 64); ctx.quadraticCurveTo(54, 40, 44, 10); ctx.stroke();
            mgt['ancient_tree'] = { canvas: c, tilesW: 2, tilesH: 3, theme: 'outdoor' };
        }

        // 22. 던전 횃불 스탠드 (1x2, 던전)
        {
            const { c, x: ctx } = mk(1, 2);
            ctx.fillStyle='#333'; ctx.fillRect(12, 32, 8, 32); // 기둥
            ctx.fillStyle='#ff4500'; ctx.beginPath(); ctx.arc(16, 28, 6, 0, Math.PI*2); ctx.fill(); // 불꽃
            ctx.fillStyle='#ffa500'; ctx.beginPath(); ctx.arc(16, 28, 3, 0, Math.PI*2); ctx.fill();
            mgt['dungeon_torch'] = { canvas: c, tilesW: 1, tilesH: 2, theme: 'dungeon' };
        }

        // 23. 마을 수레 (2x2, 마을)
        {
            const { c, x: ctx } = mk(2, 2);
            ctx.fillStyle='#8b4513'; ctx.fillRect(10, 20, 44, 24); // 몸체
            ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(15, 44, 8, 0, Math.PI*2); ctx.fill(); // 바퀴1
            ctx.beginPath(); ctx.arc(49, 44, 8, 0, Math.PI*2); ctx.fill(); // 바퀴2
            ctx.fillStyle='#a0522d'; ctx.fillRect(0, 24, 10, 4); // 손잡이
            mgt['village_cart'] = { canvas: c, tilesW: 2, tilesH: 2, theme: 'village' };
        }

        // 24. 마을 분수대 (2x2, 마을)
        {
            const { c, x: ctx } = mk(2, 2);
            ctx.fillStyle='#aaa'; ctx.beginPath(); ctx.arc(32, 40, 28, 0, Math.PI*2); ctx.fill(); // 아래 수조
            ctx.fillStyle='#4682b4'; ctx.beginPath(); ctx.arc(32, 40, 22, 0, Math.PI*2); ctx.fill(); // 물
            ctx.fillStyle='#ccc'; ctx.fillRect(28, 10, 8, 30); // 중앙 기둥
            ctx.strokeStyle='#fff'; ctx.beginPath(); ctx.moveTo(32, 10); ctx.lineTo(16, 20); ctx.moveTo(32,10); ctx.lineTo(48,20); ctx.stroke(); // 물줄기
            mgt['village_fountain'] = { canvas: c, tilesW: 2, tilesH: 2, theme: 'village' };
        }

        // 25. 장식용 석조 기둥 (1x3, 던전/성)
        {
            const { c, x: ctx } = mk(1, 3);
            ctx.fillStyle='#666'; ctx.fillRect(8, 64, 16, 32); // 기반
            ctx.fillStyle='#888'; ctx.fillRect(10, 10, 12, 54); // 기둥 몸체
            ctx.fillStyle='#999'; ctx.fillRect(6, 6, 20, 8); // 머리
            mgt['stone_pillar'] = { canvas: c, tilesW: 1, tilesH: 3, theme: 'dungeon' };
        }

        // 26. 마을 시장 가판대 (2x2, 마을)
        {
            const { c, x: ctx } = mk(2, 2);
            ctx.fillStyle = '#5d2e0a'; ctx.fillRect(4, 38, 56, 12); // 테이블
            ctx.fillStyle = '#ff4444'; ctx.fillRect(0, 0, 64, 16); // 천막 (빨강)
            ctx.fillStyle = '#ffffff'; ctx.fillRect(16, 0, 16, 16); ctx.fillRect(48, 0, 16, 16); // 천막 스트라이프
            ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(4, 16); ctx.lineTo(4, 38); ctx.moveTo(60, 16); ctx.lineTo(60, 38); ctx.stroke(); // 기둥
            mgt['market_stall'] = { canvas: c, tilesW: 2, tilesH: 2, theme: 'village' };
        }

        // 27. 전설의 석상 (2x3, 마을/던전)
        {
            const { c, x: ctx } = mk(2, 3);
            ctx.fillStyle = '#888'; ctx.fillRect(12, 70, 40, 20); // 받침대
            ctx.fillStyle = '#aaa';
            ctx.beginPath(); // 몸체
            ctx.moveTo(32, 70); ctx.lineTo(16, 40); ctx.lineTo(48, 40); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.arc(32, 25, 12, 0, Math.PI * 2); ctx.fill(); // 머리
            ctx.strokeStyle = '#777'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(48, 40); ctx.lineTo(56, 10); ctx.stroke(); // 검을 든 팔
            mgt['hero_statue'] = { canvas: c, tilesW: 2, tilesH: 3, theme: 'village' };
        }

        // 28. 신비로운 포탈 (2x2, 마을/던전)
        {
            const { c, x: ctx } = mk(2, 2);
            const grad = ctx.createRadialGradient(32, 32, 5, 32, 32, 30);
            grad.addColorStop(0, '#fff'); grad.addColorStop(0.3, '#4fc3f7'); grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.arc(32, 32, 25, 0, Math.PI * 2); ctx.stroke();
            mgt['blue_portal'] = { canvas: c, tilesW: 2, tilesH: 2, theme: 'village' };
        }

        // 29. 던전 감옥 (2x2, 던전)
        {
            const { c, x: ctx } = mk(2, 2);
            ctx.fillStyle = '#333'; ctx.fillRect(8, 8, 48, 48); // 배경
            ctx.strokeStyle = '#666'; ctx.lineWidth = 3;
            for(let i=0; i<5; i++) {
                ctx.beginPath(); ctx.moveTo(16 + i*8, 8); ctx.lineTo(16 + i*8, 56); ctx.stroke(); // 창살
            }
            mgt['dungeon_cage'] = { canvas: c, tilesW: 2, tilesH: 2, theme: 'dungeon' };
        }

        // 30. 제단 (2x2, 던전/성)
        {
            const { c, x: ctx } = mk(2, 2);
            ctx.fillStyle = '#444'; ctx.fillRect(8, 40, 48, 16); // 기단
            ctx.fillStyle = '#666'; ctx.fillRect(16, 20, 32, 20); // 상단부
            ctx.fillStyle = '#800'; ctx.beginPath(); ctx.arc(32, 25, 8, 0, Math.PI * 2); ctx.fill(); // 붉은 보석
            ctx.shadowBlur = 10; ctx.shadowColor = '#f00';
            mgt['altar'] = { canvas: c, tilesW: 2, tilesH: 2, theme: 'dungeon' };
        }

        // 31. 천하대장군 장승 (1x3, 마을)
        {
            const { c, x: ctx } = mk(1, 3);
            ctx.fillStyle = '#5d4037'; ctx.fillRect(8, 20, 16, 76); // 몸통
            ctx.fillStyle = '#ffecb3'; ctx.beginPath(); ctx.arc(16, 25, 12, 0, Math.PI*2); ctx.fill(); // 얼굴
            ctx.fillStyle = '#000'; ctx.fillRect(10, 20, 12, 2); // 눈썹
            ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.arc(16, 32, 3, 0, Math.PI*2); ctx.fill(); // 입
            mgt['totem_pole'] = { canvas: c, tilesW: 1, tilesH: 3, theme: 'village' };
        }

        // 32. 전통 석등 (1x2, 마을/야외)
        {
            const { c, x: ctx } = mk(1, 2);
            ctx.fillStyle = '#78909c'; ctx.fillRect(12, 32, 8, 32); // 기둥
            ctx.fillStyle = '#455a64'; ctx.fillRect(6, 10, 20, 22); // 상단부
            const grad = ctx.createRadialGradient(16, 21, 2, 16, 21, 10);
            grad.addColorStop(0, '#fff9c4'); grad.addColorStop(1, 'rgba(255,235,59,0)');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(16, 21, 10, 0, Math.PI*2); ctx.fill(); // 불빛
            mgt['stone_lantern'] = { canvas: c, tilesW: 1, tilesH: 2, theme: 'village' };
        }

        // 33. 무기 거치대 (2x1, 실내/마을)
        {
            const { c, x: ctx } = mk(2, 1);
            ctx.fillStyle = '#4e342e'; ctx.fillRect(5, 5, 2, 22); ctx.fillRect(57, 5, 2, 22); // 지지대
            ctx.fillRect(5, 10, 54, 3); ctx.fillRect(5, 20, 54, 3); // 가로대
            ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(10, 11); ctx.lineTo(54, 11); ctx.stroke(); // 검 1
            ctx.beginPath(); ctx.moveTo(10, 21); ctx.lineTo(54, 21); ctx.stroke(); // 검 2
            mgt['weapon_rack'] = { canvas: c, tilesW: 2, tilesH: 1, theme: 'village' };
        }

        // 34. 주막 카운터 (2x1, 실내)
        {
            const { c, x: ctx } = mk(2, 1);
            ctx.fillStyle = '#795548'; ctx.fillRect(0, 5, 64, 27); // 카운터 몸체
            ctx.fillStyle = '#5d4037'; ctx.fillRect(0, 5, 64, 5); // 선반 상단
            ctx.fillStyle = '#81c784'; ctx.beginPath(); ctx.arc(15, 5, 4, 0, Math.PI*2); ctx.fill(); // 술병 1
            ctx.fillStyle = '#64b5f6'; ctx.beginPath(); ctx.arc(32, 5, 4, 0, Math.PI*2); ctx.fill(); // 술병 2
            mgt['tavern_counter'] = { canvas: c, tilesW: 2, tilesH: 1, theme: 'village' };
        }

        return mgt;
    }

    // ============================================================
    // 프로시저럴 스킬 이펙트 생성 (26개 스킬 대응 캔버스 이펙트)
    // ============================================================

    /**
     * 캔버스 기반 스킬 이펙트 14종 생성
     * 각 직업별 스킬 타입에 맞춘 시각 이펙트
     * 반환: { effectId: HTMLCanvasElement }
     */
    _generateProceduralEffects() {
        const fx = {};
        const S = 64;
        const mk = () => {
            const c = document.createElement('canvas');
            c.width = S; c.height = S;
            return { c, x: c.getContext('2d') };
        };
        const C = S / 2; // 중심

        // --- 바람 (wind): 녹색 소용돌이 ---
        {
            const { c, x: ctx } = mk();
            for (let a = 0; a < 360; a += 15) {
                const rad = (a * Math.PI) / 180;
                const r = 4 + a / 14;
                const px = C + Math.cos(rad) * r;
                const py = C + Math.sin(rad) * r;
                const g = 150 + Math.floor((a / 360) * 105);
                ctx.fillStyle = `rgba(50,${g},80,0.8)`;
                ctx.fillRect(px - 2, py - 2, 5, 3);
            }
            ctx.fillStyle = 'rgba(100,255,120,0.4)';
            ctx.beginPath(); ctx.arc(C, C, 10, 0, Math.PI * 2); ctx.fill();
            fx['wind'] = c;
        }

        // --- 신성 (holy): 황금빛 폭발 ---
        {
            const { c, x: ctx } = mk();
            ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
            ctx.beginPath(); ctx.arc(C, C, 25, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 12; i++) {
                const ang = (i * Math.PI * 2) / 12;
                ctx.strokeStyle = '#fff700'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(C, C);
                ctx.lineTo(C + Math.cos(ang) * 30, C + Math.sin(ang) * 30);
                ctx.stroke();
            }
            fx['holy'] = c;
        }

        // --- 대지 (earth): 암석 및 먼지 ---
        {
            const { c, x: ctx } = mk();
            ctx.fillStyle = '#8b4513';
            for (let i = 0; i < 8; i++) {
                const ox = Math.random() * 30 - 15;
                const oy = Math.random() * 30 - 15;
                const sz = 5 + Math.random() * 8;
                ctx.fillRect(C + ox - sz / 2, C + oy - sz / 2, sz, sz);
            }
            ctx.fillStyle = 'rgba(139, 69, 19, 0.3)';
            ctx.beginPath(); ctx.arc(C, C, 20, 0, Math.PI * 2); ctx.fill();
            fx['earth'] = c;
        }

        // --- 중독 (poison): 보라색 거품 ---
        {
            const { c, x: ctx } = mk();
            ctx.fillStyle = 'rgba(128, 0, 128, 0.5)';
            for (let i = 0; i < 10; i++) {
                const ox = Math.random() * 32 - 16;
                const oy = Math.random() * 32 - 16;
                const r = 3 + Math.random() * 6;
                ctx.beginPath(); ctx.arc(C + ox, C + oy, r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#dda0dd'; ctx.lineWidth = 1; ctx.stroke();
            }
            fx['poison'] = c;
        }

        // --- 얼음 (ice): 청백색 결정 ---
        {
            const { c, x: ctx } = mk();
            ctx.strokeStyle = '#afeeee'; ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
                const ang = (i * Math.PI * 2) / 6;
                ctx.beginPath(); ctx.moveTo(C, C);
                ctx.lineTo(C + Math.cos(ang) * 28, C + Math.sin(ang) * 28);
                ctx.stroke();
                // 끝에 작은 결정
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(C + Math.cos(ang) * 25, C + Math.sin(ang) * 25, 3, 0, Math.PI * 2); ctx.fill();
            }
            fx['ice'] = c;
        }

        // --- 어둠 (dark): 보라 소용돌이 ---
        {
            const { c, x: ctx } = mk();
            const g = ctx.createRadialGradient(C, C, 0, C, C, 28);
            g.addColorStop(0, 'rgba(200,0,255,0.9)');
            g.addColorStop(0.5, 'rgba(80,0,120,0.6)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, 28, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 8; i++) {
                const rad = (i / 8) * Math.PI * 2;
                ctx.fillStyle = 'rgba(160,0,255,0.7)';
                ctx.fillRect(C + Math.cos(rad) * 14 - 3, C + Math.sin(rad) * 14 - 3, 6, 6);
            }
            fx['dark'] = c;
        }

        // --- 신성 (holy): 금빛 十자 ---
        {
            const { c, x: ctx } = mk();
            const g = ctx.createRadialGradient(C, C, 2, C, C, 26);
            g.addColorStop(0, 'rgba(255,255,180,0.95)');
            g.addColorStop(0.5, 'rgba(255,210,50,0.6)');
            g.addColorStop(1, 'rgba(255,200,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, 26, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,220,0.9)';
            ctx.fillRect(C - 3, 4, 6, S - 8);
            ctx.fillRect(4, C - 3, S - 8, 6);
            fx['holy'] = c;
        }

        // --- 번개 (thunder): 노란 지그재그 ---
        {
            const { c, x: ctx } = mk();
            ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(C, 4); ctx.lineTo(C - 10, 24); ctx.lineTo(C + 8, 24);
            ctx.lineTo(C - 12, 44); ctx.lineTo(C + 6, 44); ctx.lineTo(C, S - 4);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,180,0.4)'; ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.moveTo(C, 4); ctx.lineTo(C - 10, 24); ctx.lineTo(C + 8, 24);
            ctx.lineTo(C - 12, 44); ctx.lineTo(C + 6, 44); ctx.lineTo(C, S - 4);
            ctx.stroke();
            fx['thunder'] = c;
        }

        // --- 대지 (earth): 갈색 충격파 원 ---
        {
            const { c, x: ctx } = mk();
            for (let r = 28; r >= 6; r -= 8) {
                const alpha = 0.2 + (28 - r) / 28 * 0.6;
                ctx.strokeStyle = `rgba(180,120,40,${alpha})`;
                ctx.lineWidth = 4 - (28 - r) / 10;
                ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.fillStyle = 'rgba(160,100,30,0.5)';
            ctx.beginPath(); ctx.arc(C, C, 8, 0, Math.PI * 2); ctx.fill();
            fx['earth'] = c;
        }

        // --- 은신 (stealth): 청록 연기 ---
        {
            const { c, x: ctx } = mk();
            for (let i = 0; i < 12; i++) {
                const rnd = (s) => { const v = Math.sin(s + 1) * 10000; return v - Math.floor(v); };
                const px = 10 + rnd(i * 7) * 44;
                const py = 8 + rnd(i * 7 + 1) * 48;
                const r = 6 + rnd(i * 7 + 2) * 10;
                const a = 0.15 + rnd(i * 7 + 3) * 0.3;
                ctx.fillStyle = `rgba(50,200,180,${a})`;
                ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
            }
            fx['stealth'] = c;
        }

        // --- AOE 화염 (aoe_fire): 방사형 불꽃 ---
        {
            const { c, x: ctx } = mk();
            const g = ctx.createRadialGradient(C, C, 0, C, C, 30);
            g.addColorStop(0, 'rgba(255,220,50,0.95)');
            g.addColorStop(0.4, 'rgba(255,80,0,0.8)');
            g.addColorStop(0.8, 'rgba(200,20,0,0.4)');
            g.addColorStop(1, 'rgba(100,0,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, 30, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 8; i++) {
                const rad = (i / 8) * Math.PI * 2;
                ctx.fillStyle = 'rgba(255,160,0,0.6)';
                ctx.fillRect(C + Math.cos(rad) * 20 - 3, C + Math.sin(rad) * 20 - 3, 8, 4);
            }
            fx['aoe_fire'] = c;
        }

        // --- AOE 빙결 (aoe_ice): 방사형 얼음 ---
        {
            const { c, x: ctx } = mk();
            const g = ctx.createRadialGradient(C, C, 0, C, C, 28);
            g.addColorStop(0, 'rgba(200,240,255,0.95)');
            g.addColorStop(0.5, 'rgba(80,160,240,0.7)');
            g.addColorStop(1, 'rgba(40,80,200,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, 28, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 6; i++) {
                const rad = (i / 6) * Math.PI * 2;
                ctx.fillStyle = 'rgba(150,220,255,0.8)';
                ctx.fillRect(C + Math.cos(rad) * 14 - 2, C + Math.sin(rad) * 14 - 6, 4, 12);
            }
            fx['aoe_ice'] = c;
        }

        // --- AOE 독 (aoe_poison): 초록 점액 ---
        {
            const { c, x: ctx } = mk();
            const g = ctx.createRadialGradient(C, C, 0, C, C, 26);
            g.addColorStop(0, 'rgba(120,255,80,0.9)');
            g.addColorStop(0.5, 'rgba(40,160,20,0.7)');
            g.addColorStop(1, 'rgba(0,80,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, 26, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 10; i++) {
                const rnd = (s) => { const v = Math.sin(s + 7) * 10000; return v - Math.floor(v); };
                ctx.fillStyle = 'rgba(80,200,40,0.6)';
                ctx.beginPath();
                ctx.arc(8 + rnd(i * 5) * 48, 8 + rnd(i * 5 + 1) * 48, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            fx['aoe_poison'] = c;
        }

        // --- 이중 슬래시: 붉은 X자 ---
        {
            const { c, x: ctx } = mk();
            ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(S - 8, S - 8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(S - 8, 8); ctx.lineTo(8, S - 8); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,200,200,0.4)'; ctx.lineWidth = 8;
            ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(S - 8, S - 8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(S - 8, 8); ctx.lineTo(8, S - 8); ctx.stroke();
            fx['double_slash'] = c;
        }

        // --- 삼중 슬래시: 세 줄 사선 ---
        {
            const { c, x: ctx } = mk();
            const lines = [[4,4,S-4,S-4],[12,2,S-2,S-12],[2,12,S-12,S-2]];
            lines.forEach(([x1,y1,x2,y2]) => {
                ctx.strokeStyle = 'rgba(255,100,100,0.85)'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
            });
            fx['triple_slash'] = c;
        }

        // --- 저주: 해골 + 어두운 원 ---
        {
            const { c, x: ctx } = mk();
            const g = ctx.createRadialGradient(C, C, 0, C, C, 22);
            g.addColorStop(0, 'rgba(80,0,80,0.8)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, 22, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(200,180,255,0.9)';
            ctx.fillRect(C-6, C-10, 12, 10);
            ctx.fillRect(C-4, C, 8, 6);
            ctx.fillStyle = 'rgba(80,0,80,0.9)';
            ctx.fillRect(C-4, C-8, 3, 4); ctx.fillRect(C+1, C-8, 3, 4);
            fx['curse'] = c;
        }

        // --- 마비: 노란 번개 + 회색 원 ---
        {
            const { c, x: ctx } = mk();
            const g = ctx.createRadialGradient(C, C, 0, C, C, 20);
            g.addColorStop(0, 'rgba(255,255,100,0.6)');
            g.addColorStop(1, 'rgba(100,100,100,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, 20, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 5; i++) {
                const rad = (i / 5) * Math.PI * 2;
                ctx.strokeStyle = 'rgba(255,255,0,0.8)'; ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(C, C);
                ctx.lineTo(C + Math.cos(rad) * 22, C + Math.sin(rad) * 22);
                ctx.stroke();
            }
            fx['paralyze'] = c;
        }

        // --- 마나 흡수: 파란 안쪽 화살표 ---
        {
            const { c, x: ctx } = mk();
            const g = ctx.createRadialGradient(C, C, 0, C, C, 24);
            g.addColorStop(0, 'rgba(100,180,255,0.9)');
            g.addColorStop(1, 'rgba(0,80,200,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, 24, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 4; i++) {
                const rad = (i / 4) * Math.PI * 2;
                const sx = C + Math.cos(rad) * 22;
                const sy = C + Math.sin(rad) * 22;
                ctx.strokeStyle = 'rgba(180,220,255,0.9)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(C, C); ctx.stroke();
            }
            fx['hp_to_mp'] = c;
        }

        // --- 폭발 (explosion): 주황빛 거대 구체 ---
        {
            const { c, x: ctx } = mk();
            const g = ctx.createRadialGradient(C, C, 0, C, C, 30);
            g.addColorStop(0, '#fff');
            g.addColorStop(0.2, '#ffeb3b');
            g.addColorStop(0.5, '#fb8c00');
            g.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, 30, 0, Math.PI * 2); ctx.fill();
            fx['explosion'] = c;
        }

        // --- 임팩트 (impact): 충격파 선 ---
        {
            const { c, x: ctx } = mk();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
            for(let i=0; i<4; i++) {
                const r = 10 + i * 6;
                ctx.globalAlpha = 1 - (i/4);
                ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.stroke();
            }
            fx['impact'] = c;
        }

        // --- 크리티컬 (critical): 붉은 번개 느낌 ---
        {
            const { c, x: ctx } = mk();
            ctx.strokeStyle = '#f00'; ctx.lineWidth = 4;
            ctx.beginPath(); 
            ctx.moveTo(10, 10); ctx.lineTo(32, 20); ctx.lineTo(15, 40); ctx.lineTo(50, 60);
            ctx.stroke();
            ctx.shadowBlur = 10; ctx.shadowColor = '#f00';
            fx['critical'] = c;
        }

        return fx;
    }

    /**
     * NPC 종류에 따른 포트레이트(얼굴) 이미지 반환
     */
    getPortrait(npcName) {
        if (!npcName) return null;
        
        // 1. 전용 포트레이트가 있는 경우
        if (npcName.includes('안내자') || npcName.includes('수련')) return this.images.faces.guide;
        if (npcName.includes('주모')) return this.images.faces.innkeeper;
        
        // 2. 이름 기반 매핑
        const faceMap = {
            '대장장이': this.images.faces.guide, // 임시 (전사 얼굴 등으로 추후 교체 가능)
            '성황당 할머니': this.images.faces.innkeeper,
            '비단': this.images.faces.innkeeper,
            '목공': this.images.faces.guide
        };
        
        for (const key in faceMap) {
            if (npcName.includes(key)) return faceMap[key];
        }
        
        // 3. 기본값 (안내자 얼굴)
        return this.images.faces.guide;
    }
}

// 전역 에셋 매니저 인스턴스
const assetManager = new AssetManager();
