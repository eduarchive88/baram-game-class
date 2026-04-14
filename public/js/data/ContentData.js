/**
 * ContentData.js - 20시간 플레이 분량을 위한 대규모 게임 데이터베이스
 * 아이템, 몬스터, 퀘스트, 스킬 정보를 통합 관리
 */

const GameData = {
    // ==========================================
    // 1. 아이템 도감 (100종 목표)
    // ==========================================
    // ==========================================
    // 1. 아이템 도감 (100종 이상 완성)
    // ==========================================
    items: {
        // --- [Weapon] Tier 1 (Lv.1-5) ---
        'wpn_001_wood_sword': { name: '훈련용 목검', type: 'weapon', class: 'warrior', atk: 3, price: 50, desc: '나무를 깎아 만든 검.' },
        'wpn_002_wood_dagger': { name: '낡은 단검', type: 'weapon', class: 'rogue', atk: 2, crit: 5, price: 45, desc: '날이 무딘 단검.' },
        'wpn_003_wood_staff': { name: '견습 지팡이', type: 'weapon', class: 'mage', matk: 4, price: 60, desc: '마력이 약간 서린 지팡이.' },
        'wpn_004_old_fan': { name: '찢어진 부채', type: 'weapon', class: 'shaman', matk: 3, price: 55, desc: '도사가 쓰는 낡은 부채.' },
        'wpn_001b_refined_wood': { name: '다듬어진 목검', type: 'weapon', class: 'warrior', atk: 6, price: 150 },
        'wpn_002b_sharp_wood': { name: '뾰족한 나뭇가지', type: 'weapon', class: 'rogue', atk: 5, crit: 7, price: 140 },

        // --- [Weapon] Tier 2 (Lv.6-15) ---
        'wpn_005_iron_sword': { name: '강철 장검', type: 'weapon', class: 'warrior', atk: 12, price: 500 },
        'wpn_006_steel_dagger': { name: '강철 단검', type: 'weapon', class: 'rogue', atk: 9, crit: 8, price: 480 },
        'wpn_007_oak_staff': { name: '참나무 지팡이', type: 'weapon', class: 'mage', matk: 14, price: 520 },
        'wpn_008_feather_fan': { name: '깃털 부채', type: 'weapon', class: 'shaman', matk: 11, price: 500 },
        'wpn_005b_sharp_iron': { name: '날카로운 강철검', type: 'weapon', class: 'warrior', atk: 18, price: 1200 },
        'wpn_006b_assassin_knife': { name: '암살자의 칼날', type: 'weapon', class: 'rogue', atk: 15, crit: 12, price: 1150 },

        // --- [Weapon] Tier 3 (Lv.16-25) ---
        'wpn_009_gladius': { name: '글라디우스', type: 'weapon', class: 'warrior', atk: 32, price: 3500 },
        'wpn_010_poison_dagger': { name: '맹독 단검', type: 'weapon', class: 'rogue', atk: 26, crit: 18, price: 3800 },
        'wpn_011_mana_wand': { name: '마나 완드', type: 'weapon', class: 'mage', matk: 38, price: 3700 },
        'wpn_012_jade_staff': { name: '비취 석팡이', type: 'weapon', class: 'shaman', matk: 30, price: 3600 },
        'wpn_009b_bastard_sword': { name: '바스타드 소드', type: 'weapon', class: 'warrior', atk: 45, price: 6000 },
        'wpn_010b_hidden_blade': { name: '숨겨진 암기', type: 'weapon', class: 'rogue', atk: 38, crit: 25, price: 6500 },

        // --- [Weapon] Tier 4 (Lv.26-35) ---
        'wpn_013_ice_claymore': { name: '빙결의 대검', type: 'weapon', class: 'warrior', atk: 65, price: 12000 },
        'wpn_014_frost_katar': { name: '서리 카타르', type: 'weapon', class: 'rogue', atk: 55, crit: 22, price: 12500 },
        'wpn_015_crystal_orb': { name: '수정 보주', type: 'weapon', class: 'mage', matk: 75, price: 13000 },
        'wpn_016_snow_bell': { name: '눈꽃 방울', type: 'weapon', class: 'shaman', matk: 60, price: 12200 },
        'wpn_013b_glacier_axe': { name: '빙하 파괴 도끼', type: 'weapon', class: 'warrior', atk: 85, price: 18000 },
        'wpn_014b_ice_spike': { name: '만년설 송곳', type: 'weapon', class: 'rogue', atk: 72, crit: 28, price: 18500 },

        // --- [Weapon] Tier 5 (Lv.36-40) ---
        'wpn_017_heaven_slayer': { name: '천천의 신검', type: 'weapon', class: 'warrior', atk: 120, price: 45000 },
        'wpn_018_light_fang': { name: '빛의 송곳니', type: 'weapon', class: 'rogue', atk: 105, crit: 35, price: 42000 },
        'wpn_019_archmage_staff': { name: '현자의 지팡이', type: 'weapon', class: 'mage', matk: 140, price: 50000 },
        'wpn_020_holy_fan': { name: '성스러운 기운의 부채', type: 'weapon', class: 'shaman', matk: 115, price: 46000 },
        'wpn_017b_excalibur': { name: '엑스칼리버', type: 'weapon', class: 'warrior', atk: 180, price: 100000 },
        'wpn_018b_moonlight_blade': { name: '달빛 화문도', type: 'weapon', class: 'rogue', atk: 155, crit: 45, price: 95000 },

        // --- [Armor - Body] ---
        'arm_001_cloth': { name: '누더기 옷', type: 'armor', def: 1, price: 30 },
        'arm_002_leather': { name: '가죽 소복', type: 'armor', def: 6, price: 400 },
        'arm_003_iron_plate': { name: '강철 두정갑', type: 'armor', def: 18, price: 2500 },
        'arm_004_ice_armor': { name: '혹한의 갑옷', type: 'armor', def: 45, price: 16000 },
        'arm_005_god_plate': { name: '천상 금갑', type: 'armor', def: 95, price: 80000 },
        'arm_b01_linen': { name: '삼베 옷', type: 'armor', def: 3, price: 100 },
        'arm_b02_studded': { name: '징 박힌 가죽갑', type: 'armor', def: 10, price: 1000 },
        'arm_b03_full_plate': { name: '풀 플레이트 메일', type: 'armor', def: 30, price: 8000 },

        // --- [Armor - Shield/Misc] ---
        'shd_001_wood': { name: '나무 방패', type: 'shield', def: 2, price: 150 },
        'shd_002_iron': { name: '철제 방패', type: 'shield', def: 10, price: 3000 },
        'shd_003_dragon': { name: '용비늘 방패', type: 'shield', def: 35, price: 25000 },

        // --- [Accessory - Ring/Necklace] ---
        'acc_001_copper_ring': { name: '구리 반지', type: 'acc', hp: 10, price: 500 },
        'acc_002_silver_ring': { name: '은 반지', type: 'acc', hp: 50, mp: 20, price: 3000 },
        'acc_003_gold_ring': { name: '금 반지', type: 'acc', hp: 200, mp: 100, price: 15000 },
        'acc_004_diamond_ring': { name: '다이아몬드 반지', type: 'acc', hp: 1000, mp: 500, price: 80000 },
        'acc_n01_beads': { name: '염주', type: 'acc', mp: 50, price: 1200 },
        'acc_n02_amulet': { name: '호신 부적', type: 'acc', def: 5, price: 5000 },
        'acc_n03_ruby': { name: '루비 펜던트', type: 'acc', atk: 15, price: 20000 },

        // --- [Consumables] ---
        'pot_red_1': { name: '빨간 시약(소)', type: 'potion', heal: 50, price: 20 },
        'pot_red_2': { name: '빨간 시약(중)', type: 'potion', heal: 200, price: 150 },
        'pot_red_3': { name: '빨간 시약(대)', type: 'potion', heal: 800, price: 1000 },
        'pot_blue_1': { name: '파란 시약(소)', type: 'potion', mana: 30, price: 30 },
        'pot_blue_2': { name: '파란 시약(중)', type: 'potion', mana: 120, price: 250 },
        'pot_blue_3': { name: '파란 시약(대)', type: 'potion', mana: 500, price: 1500 },
        'pot_elixir': { name: '만능 엘릭서', type: 'potion', heal: 9999, mana: 9999, price: 20000 },
        'itm_scroll_home': { name: '장터 복귀 주문서', type: 'scroll', price: 100 },
        'itm_scroll_buff': { name: '용맹의 주문서', type: 'scroll', effect: 'atk_up', price: 500 },

        // --- [Material - Common] ---
        'mat_jelly_green': { name: '초록 젤리', type: 'material', price: 5 },
        'mat_jelly_red': { name: '빨간 젤리', type: 'material', price: 10 },
        'mat_fur_soft': { name: '부드러운 털뭉치', type: 'material', price: 8 },
        'mat_tooth_pointy': { name: '뾰족한 이빨', type: 'material', price: 15 },
        'mat_bone': { name: '부러진 뼈다구', type: 'material', price: 20 },
        'mat_stone': { name: '반짝이는 조약돌', type: 'material', price: 30 },
        'mat_wood_branch': { name: '단단한 가지', type: 'material', price: 25 },
        'mat_leaf': { name: '신비한 잎사귀', type: 'material', price: 40 },

        // --- [Material - Rare] ---
        'mat_leather_hard': { name: '질긴 가죽', type: 'material', price: 100 },
        'mat_iron_ore': { name: '철광석', type: 'material', price: 250 },
        'mat_silver_ore': { name: '은광석', type: 'material', price: 800 },
        'mat_gold_ore': { name: '금광석', type: 'material', price: 2000 },
        'mat_mithril': { name: '미스릴 원석', type: 'material', price: 10000 },
        'mat_ice_shard': { name: '얼음 파편', type: 'material', price: 1500 },
        'mat_frost_heart': { name: '서리 심장', type: 'material', price: 5000 },
        'mat_dragon_scale': { name: '용의 비늘', type: 'material', price: 30000 },
        'mat_heaven_dust': { name: '천상의 가루', type: 'material', price: 8000 },
        'mat_angel_feather': { name: '천사의 깃털', type: 'material', price: 20000 },

        // --- [Trophies & Misc] ---
        'etc_old_coin': { name: '녹슨 엽전', type: 'etc', price: 100 },
        'etc_treasure_map': { name: '보물 지도 조각', type: 'etc', price: 1000 },
        'etc_king_crown': { name: '왕슬라임의 왕관', type: 'etc', price: 5000 },
        'etc_goblin_seal': { name: '고블린 징표', type: 'etc', price: 200 },
        'etc_broken_sword': { name: '부러진 전설의 칼날', type: 'etc', price: 50000 },
        'etc_holy_water': { name: '성수', type: 'etc', price: 3000 },
        'etc_demon_blood': { name: '악마의 피', type: 'etc', price: 7000 },
        'etc_ancient_text': { name: '고대 문양판', type: 'etc', price: 15000 },
        'etc_magic_flute': { name: '마력이 깃든 피리', type: 'etc', price: 25000 },
        'etc_phoenix_egg': { name: '불사조의 알', type: 'etc', price: 99999 },
    },

    // ==========================================
    // 2. 몬스터 도감 (50종 이상 완성)
    // ==========================================
    monsters: {
        // --- Beginner (Lv.1-10) ---
        'm_001_slime': { name: '초록 슬라임', hp: 30, atk: 5, exp: 12, gold: 5, sprite: 'monster_slime' },
        'm_002_slime_red': { name: '빨간 슬라임', hp: 50, atk: 8, exp: 20, gold: 10, sprite: 'monster_slime_red' },
        'm_003_squirrel': { name: '다람쥐', hp: 20, atk: 3, exp: 8, gold: 3, sprite: 'monster_squirrel' },
        'm_004_rabbit': { name: '산토끼', hp: 25, atk: 4, exp: 10, gold: 4, sprite: 'monster_rabbit' },
        'm_005_bee': { name: '말벌', hp: 40, atk: 15, exp: 25, gold: 8, sprite: 'monster_wasp' },
        'm_001b_slime_blue': { name: '파랑 슬라임', hp: 60, atk: 12, exp: 35, gold: 15 },
        'm_003b_squirrel_strong': { name: '힘센 다람쥐', hp: 80, atk: 18, exp: 50, gold: 20 },
        'm_006_crow': { name: '까마귀', hp: 70, atk: 20, exp: 45, gold: 18 },
        'm_007_caterpillar': { name: '거대 송충이', hp: 100, atk: 10, exp: 40, gold: 12 },
        'm_008_fox': { name: '여우', hp: 120, atk: 25, exp: 70, gold: 30 },

        // --- Forest/Dungeon (Lv.11-20) ---
        'm_011_wolf': { name: '야생 늑대', hp: 250, atk: 45, exp: 150, gold: 60, sprite: 'monster_wolf' },
        'm_012_boar': { name: '멧돼지', hp: 350, atk: 55, exp: 220, gold: 80, sprite: 'monster_wild_boar' },
        'm_013_goblin_scout': { name: '고블린 정찰병', hp: 300, atk: 50, exp: 200, gold: 90, sprite: 'monster_goblin' },
        'm_014_goblin_warrior': { name: '고블린 전사', hp: 450, atk: 65, exp: 350, gold: 150 },
        'm_015_goblin_shaman': { name: '고블린 주술사', hp: 400, atk: 80, exp: 400, gold: 200 },
        'm_016_snake_forest': { name: '숲 구렁이', hp: 380, atk: 70, exp: 300, gold: 120 },
        'm_017_owl_bear': { name: '아울베어', hp: 800, atk: 90, exp: 800, gold: 400 },
        'm_018_ent_corrupt': { name: '오염된 고목', hp: 1200, atk: 60, exp: 1200, gold: 600 },
        'm_019_spider_web': { name: '맹독 거미', hp: 500, atk: 100, exp: 600, gold: 250 },
        'm_020_kobold': { name: '코볼트 일꾼', hp: 420, atk: 75, exp: 450, gold: 180 },

        // --- Cave/Mountain (Lv.21-30) ---
        'm_021_skeleton': { name: '해골 병사', hp: 1000, atk: 130, exp: 1500, gold: 500, sprite: 'monster_skeleton' },
        'm_022_zombie': { name: '부패한 좀비', hp: 2000, atk: 100, exp: 1800, gold: 400 },
        'm_023_bat_giant': { name: '거대 박쥐', hp: 900, atk: 160, exp: 1600, gold: 450 },
        'm_024_gargoyle': { name: '가고일', hp: 3000, atk: 200, exp: 4000, gold: 1200 },
        'm_025_mimic': { name: '보물상자 미믹', hp: 2500, atk: 250, exp: 6000, gold: 15000 },
        'm_026_dark_elf': { name: '타락한 엘프', hp: 1800, atk: 280, exp: 5000, gold: 1000 },
        'm_027_troll': { name: '동굴 트롤', hp: 6000, atk: 180, exp: 8000, gold: 2000 },
        'm_028_wraith': { name: '망령', hp: 1500, atk: 350, exp: 7000, gold: 1500 },
        'm_029_hell_hound': { name: '지옥견', hp: 2200, atk: 400, exp: 10000, gold: 3000 },
        'm_030_ogre': { name: '바위 오우거', hp: 5000, atk: 300, exp: 9000, gold: 2500 },

        // --- Ice Cave (Lv.31-40) ---
        'm_031_ice_slime': { name: '빙결 슬라임', hp: 4000, atk: 500, exp: 20000, gold: 4000, sprite: 'monster_ice_slime' },
        'm_032_yeti': { name: '설인', hp: 8000, atk: 650, exp: 35000, gold: 7000, sprite: 'monster_yeti' },
        'm_033_ice_ghost': { name: '얼음 유령', hp: 6000, atk: 800, exp: 40000, gold: 8000 },
        'm_034_frost_golem': { name: '서리 골렘', hp: 15000, atk: 1000, exp: 80000, gold: 20000 },
        'm_035_snow_leopard': { name: '눈표범', hp: 5000, atk: 900, exp: 30000, gold: 6000 },
        'm_036_ice_spider': { name: '혹한의 거미', hp: 7000, atk: 850, exp: 45000, gold: 9000 },
        'm_037_frozen_warrior': { name: '빙결된 기사', hp: 10000, atk: 1200, exp: 70000, gold: 15000 },
        'm_038_polar_bear': { name: '북극곰 대장', hp: 12000, atk: 1100, exp: 65000, gold: 12000 },
        'm_039_ice_spirit': { name: '겨울 정령', hp: 9000, atk: 1300, exp: 90000, gold: 18000, sprite: 'monster_ice_spirit' },
        'm_040_frost_dragon_small': { name: '새끼 냉기룡', hp: 20000, atk: 1800, exp: 150000, gold: 50000 },

        // --- Heaven Garden (Lv.41-50) ---
        'm_041_angel_novice': { name: '하급 천사', hp: 30000, atk: 2500, exp: 200000, gold: 30000 },
        'm_042_heavenly_knight': { name: '신성 기사', hp: 50000, atk: 4000, exp: 400000, gold: 60000 },
        'm_043_pegasus_wild': { name: '야생 페가수스', hp: 40000, atk: 3500, exp: 350000, gold: 50000 },
        'm_044_valkyrie': { name: '발키리', hp: 80000, atk: 6000, exp: 800000, gold: 150000 },
        'm_045_light_orb': { name: '빛의 구체', hp: 25000, atk: 5000, exp: 300000, gold: 40000 },
        'm_046_guardian_archon': { name: '수호 아콘', hp: 120000, atk: 8000, exp: 1200000, gold: 300000 },
        'm_047_seraphim_servant': { name: '세라핌의 시종', hp: 100000, atk: 7000, exp: 1000000, gold: 250000 },
        'm_048_heaven_beast': { name: '천계의 성수', hp: 150000, atk: 10000, exp: 2000000, gold: 500000 },
        'm_049_cherubim': { name: '케루빔 전사', hp: 200000, atk: 15000, exp: 5000000, gold: 1000000 },
        'm_050_divine_dragon': { name: '신성한 황금룡', hp: 500000, atk: 30000, exp: 20000000, gold: 5000000 },

        // --- Special Bosses ---
        'boss_slime_king': { name: '슬라임 대왕', hp: 1500, atk: 100, exp: 5000, gold: 20000, isBoss: true },
        'boss_goblin_king': { name: '고블린 추장', hp: 5000, atk: 250, exp: 20000, gold: 80000, isBoss: true },
        'boss_lich_king': { name: '리치 왕', hp: 50000, atk: 3000, exp: 500000, gold: 1000000, isBoss: true },
        'boss_black_dragon': { name: '심연의 흑룡', hp: 2000000, atk: 100000, exp: 100000000, gold: 99999999, isBoss: true },
    },

    // ==========================================
    // 3. 퀘스트 시스템 (연쇄 퀘스트 확장)
    // ==========================================
    quests: {
        'q001_beginner': { title: '모험의 시작', desc: '안내자에게 말을 거세보.', reward: { gold: 100, exp: 50, item: 'wpn_001_wood_sword' } },
        'q002_slime_5': { title: '슬라임 청소', target: { type: 'm_001_slime', count: 5 }, reward: { gold: 500, exp: 100 } },
        'q003_squirrel_10': { title: '도술의 재료', target: { type: 'm_003_squirrel', count: 10 }, reward: { gold: 1000, exp: 300, item: 'arm_001_cloth' } },
        'q004_village_elder': { title: '촌장의 부름', desc: '바람마을 촌장을 만나세요.', reward: { gold: 2000, exp: 1000 } },
        'q005_wolf_hunt': { title: '늑대 무리의 위협', target: { type: 'm_011_wolf', count: 15 }, reward: { gold: 10000, exp: 5000, item: 'wpn_005_iron_sword' } },
        'q006_goblin_base': { title: '고블린 소굴 습격', target: { type: 'm_014_goblin_warrior', count: 20 }, reward: { gold: 30000, exp: 20000, item: 'arm_003_iron_plate' } },
        'q007_cave_skeleton': { title: '잠들지 못하는 뼈들', target: { type: 'm_021_skeleton', count: 30 }, reward: { gold: 80000, exp: 100000, item: 'acc_002_silver_ring' } },
        'q008_ice_cave_entry': { title: '혹한의 시련', desc: '얼음 동굴의 슬라임을 처치하세요.', target: { type: 'm_031_ice_slime', count: 40 }, reward: { gold: 200000, exp: 500000 } },
        'q009_heaven_gate': { title: '천상의 문턱', target: { type: 'm_041_angel_novice', count: 50 }, reward: { gold: 1000000, exp: 5000000, item: 'arm_005_god_plate' } },
        'q010_dragon_slayer': { title: '전설의 종결', target: { type: 'boss_black_dragon', count: 1 }, reward: { gold: 99999999, exp: 99999999, item: 'wpn_017b_excalibur' } },
    },

    // ==========================================
    // 4. 스킬 정보 (직업별 확장)
    // ==========================================
    skills: {
        // [전사]
        'war_01_slash': { name: '파워 슬래시', power: 1.5, cost: 5, effect: 'slash', class: 'warrior', reqLevel: 5 },
        'war_02_bash': { name: '강타', power: 2.5, cost: 12, effect: 'impact', class: 'warrior', reqLevel: 12 },
        'war_03_shout': { name: '포효', power: 1.2, cost: 20, effect: 'debuff', class: 'warrior', reqLevel: 25 },
        'war_04_execute': { name: '단죄', power: 5.0, cost: 50, effect: 'slash_heavy', class: 'warrior', reqLevel: 40 },
        // [도적]
        'rog_01_stab': { name: '기습 찌르기', power: 1.8, cost: 8, effect: 'stab', class: 'rogue', reqLevel: 5 },
        'rog_02_poison': { name: '맹독 바르기', power: 1.3, cost: 15, effect: 'poison', class: 'rogue', reqLevel: 15 },
        'rog_03_shadow': { name: '분신술', power: 2.2, cost: 30, effect: 'dark', class: 'rogue', reqLevel: 28 },
        'rog_04_nullify': { name: '급소 일격', power: 6.0, cost: 60, effect: 'critical', class: 'rogue', reqLevel: 42 },
        // [주술사]
        'mag_01_fire': { name: '화염구', power: 2.2, cost: 15, effect: 'fire', class: 'mage', reqLevel: 5 },
        'mag_02_thunder': { name: '연쇄 번개', power: 3.5, cost: 40, effect: 'lightning', class: 'mage', reqLevel: 18 },
        'mag_03_blizzard': { name: '눈보라', power: 4.5, cost: 80, effect: 'ice', class: 'mage', reqLevel: 32 },
        'mag_04_meteor': { name: '메테오', power: 10.0, cost: 150, effect: 'explosion', class: 'mage', reqLevel: 45 },
        // [도사]
        'sha_01_heal': { name: '기원', power: -2.0, cost: 10, effect: 'heal', class: 'shaman', reqLevel: 5 },
        'sha_02_shield': { name: '금강불괴', power: 0, cost: 50, effect: 'shield', class: 'shaman', reqLevel: 20 },
        'sha_03_resurrect': { name: '부활', power: 0, cost: 100, effect: 'light', class: 'shaman', reqLevel: 35 },
        'sha_04_judgment': { name: '천벌', power: 8.0, cost: 120, effect: 'holy', class: 'shaman', reqLevel: 48 },
    }
};

if (typeof window !== 'undefined') {
    window.GameData = GameData;
}
