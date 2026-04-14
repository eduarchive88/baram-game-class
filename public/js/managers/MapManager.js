/**
 * MapManager.js - 타일맵 렌더링 및 카메라 시스템
 * 바람의 나라 교육용 RPG - 맵 관리 + 충돌 감지
 */

class MapManager {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.TILE_SIZE = 32;

        // 카메라 위치 (월드 좌표)
        this.camera = { x: 0, y: 0 };

        // 현재 맵 데이터
        this.currentMap = null;
        this.mapId = null;

        // 이동 불가 타일 ID 목록
        this.solidTiles = new Set([1, 3, 6, 8]);

        // 이동 불가 메가타일(장식 오브젝트) ID 목록
        this.solidDecorations = new Set([
            'big_tree', 'world_tree', 'ancient_tree',  // 나무류
            'shrine', 'statue', 'hero_statue',          // 석상/사당
            'castle_gate',                               // 성문
            'stone_pillar', 'lava_pillar', 'ice_pillar', // 기둥류
            'ice_crystal',                               // 얼음 결정
            'dungeon_cage', 'altar', 'skull_altar',      // 던전 구조물
            'straw_house', 'wooden_house',               // 건물
            'cliff', 'ruin',                             // 절벽/폐허
            'cherry_blossom', 'pavillion', 'ice_statue', // 장식물
        ]);

        // 맵 데이터 저장소
        this.maps = this._defineAllMaps();
    }

    /**
     * 모든 맵 데이터 정의
     * PRD 기준: 왕초보 사냥터(map_000), 마을(map_001), 사냥터(map_002), 보스방(map_003)
     */
    _defineAllMaps() {
        const maps = {};

        // =============================================
        // map_000: 왕초보 사냥터 (스폰 맵, 30x30)
        // =============================================
        maps['map_000'] = {
            name: '왕초보 사냥터',
            width: 30,
            height: 30,
            spawnX: 15,
            spawnY: 15,
            bgm: null,
            // 타일 레이어: 0=풀밭, 1=벽, 2=흙길, 3=물, 6=나무
            tiles: this._generateBeginnerMap(),
            // NPC 배치
            npcs: [
                { 
                    id: 'npc_guide', 
                    type: '길드마스터', 
                    name: '수련 안내자', 
                    x: 14, y: 12, 
                    dialogChain: [
                        '환영한다, 젊은 모험가여! 이곳은 수련의 장이다.',
                        '주변의 슬라임을 처치하여 기초를 다지도록 하게.',
                        '어느 정도 강해지면 동쪽 포털을 통해 바람 마을로 갈 수 있다네.'
                    ]
                },
            ],
            // 포털 (맵 이동 지점)
            portals: [
                { x: 28, y: 15, targetMap: 'map_001', targetX: 1, targetY: 15, label: '→ 바람 마을' },
            ],
            // 몬스터 스폰 구역 (CombatManager 호환)
            monsterZones: [
                { type: 'm_001_slime', x: 3, y: 3, width: 10, height: 10, count: 15, level: 1 },
                { type: 'm_001_slime', x: 18, y: 3, width: 10, height: 10, count: 15, level: 1 },
                { type: 'm_013_goblin_scout', x: 3, y: 18, width: 10, height: 10, count: 10, level: 2 },
                { type: 'm_005_bee', x: 18, y: 18, width: 8, height: 8, count: 8, level: 1 },
            ],
            // 메가타일 장식 오브젝트 배치 { id, tileX, tileY }
            decorations: [
                { id: 'big_tree',   tileX: 7,  tileY: 4  },
                { id: 'big_tree',   tileX: 20, tileY: 7  },
                { id: 'waterfall',  tileX: 2,  tileY: 10 },
                { id: 'cliff',      tileX: 10, tileY: 24 },
                { id: 'big_tree',   tileX: 24, tileY: 22 },
                { id: 'village_cart', tileX: 18, tileY: 16 },
                { id: 'blue_portal', tileX: 28, tileY: 14 },
                { id: 'market_stall', tileX: 12, tileY: 10 },
                // 추가 장애물 — 탐험 경로 다양화
                { id: 'big_tree',   tileX: 4,  tileY: 15 },
                { id: 'big_tree',   tileX: 12, tileY: 20 },
                { id: 'big_tree',   tileX: 22, tileY: 12 },
                { id: 'ancient_tree', tileX: 16, tileY: 8 },
            ],
            terrains: [
                { id: 'stone_patch', tileX: 5, tileY: 20, alpha: 0.6 },
            ],
        };

        // =============================================
        // map_001: 바람 마을 (안전 구역, 25x25)
        // =============================================
        maps['map_001'] = {
            name: '바람 마을',
            width: 25,
            height: 25,
            spawnX: 1,
            spawnY: 12,
            bgm: null,
            tiles: this._generateVillageMap(),
            npcs: [
                { 
                    id: 'npc_innkeeper', 
                    type: '주모', 
                    name: '주모 봉선', 
                    x: 12, y: 8, 
                    dialogChain: [
                        '어서오렴! 먼 길 오느라 고생 많았지?',
                        '맛있는 국밥 한 그릇 먹고 푹 쉬면 기운이 날 게다.',
                        '(주모가 정성스레 차린 음식을 먹고 기운을 차립니다! HP/MP 완전 회복)'
                    ]
                },
                { 
                    id: 'npc_smith', 
                    type: '대장장이', 
                    name: '대장장이 무쇠', 
                    x: 18, y: 14, 
                    dialogChain: [
                        '오, 자네! 무기가 좀 낡아 보이는군.',
                        '더 강해지고 싶다면 내 물건들을 한번 구경해 보게나.',
                        '돈만 충분하다면 최고의 장비를 마련해주지!'
                    ]
                },
                { 
                    id: 'npc_quiz', 
                    type: '길드마스터', 
                    name: '퀴즈 마스터', 
                    x: 12, y: 19, 
                    dialogChain: [
                        '지혜는 힘보다 강할 때가 있는 법.',
                        '내 퀴즈를 모두 맞춘다면 특별한 보상을 주겠네.',
                        '도전해 보겠는가?'
                    ]
                },
                { 
                    id: 'npc_village_chief', 
                    type: '촌장님', 
                    name: '바람마을 촌장', 
                    x: 10, y: 5, 
                    dialogChain: [
                        '요즘 마을 밖이 흉흉하네. 모험가여, 자네의 힘이 필요해.',
                        '전설의 무기 드래곤 슬레이어를 얻는다면 어둠을 물리칠 수 있을 텐데...'
                    ]
                },
                { 
                    id: 'npc_guard', 
                    type: '경비병', 
                    name: '마을 경비대장', 
                    x: 2, y: 12, 
                    dialogChain: [
                        '이 앞은 초보자들이 가기엔 위험합니다!',
                        '장비를 단단히 정비하고 나가십시오.'
                    ]
                },
                { 
                    id: 'npc_merchant', 
                    type: '떠돌이 상인', 
                    name: '떠돌이 상인 카심', 
                    x: 22, y: 18, 
                    dialogChain: [
                        '세상 곳곳을 돌아다니며 진귀한 물건을 구하죠.',
                        '혹시 드래곤의 알이나 힘의 반지를 보셨나요?',
                        '진귀한 물건을 찾으면 꼭 제게 가져오세요!'
                    ]
                },
            ],
            portals: [
                { x: 0, y: 12, targetMap: 'map_000', targetX: 27, targetY: 15, label: '← 왕초보 사냥터' },
                { x: 24, y: 12, targetMap: 'map_002', targetX: 1, targetY: 15, label: '→ 풍림 사냥터' },
                { x: 5, y: 24, targetMap: 'map_004', targetX: 5, targetY: 6, label: '↓ 얼음 동굴' },
                { x: 13, y: 0, targetMap: 'map_006', targetX: 5, targetY: 6, label: '↑ 잊혀진 광산' },
            ],
            monsterZones: [], // 마을은 안전 구역
            decorations: [
                { id: 'shrine',     tileX: 10, tileY: 4  },
                { id: 'well',       tileX: 13, tileY: 15 },
                { id: 'market_stall', tileX: 16, tileY: 18 },
                { id: 'castle_gate',  tileX: 0,  tileY: 10 }, // 서쪽 성문
                { id: 'castle_gate',  tileX: 21, tileY: 10 }, // 동쪽 성문
                { id: 'wooden_house', tileX: 5,  tileY: 2  }, // 신규 기와집
                { id: 'wooden_house', tileX: 18, tileY: 2  },
                { id: 'cherry_blossom', tileX: 8, tileY: 2 }, // 벚꽃
                { id: 'cherry_blossom', tileX: 16, tileY: 2 },
                { id: 'pavillion',    tileX: 11, tileY: 21 }, // 정자
                { id: 'flower_bed',   tileX: 8, tileY: 18 }, // 꽃밭
                { id: 'flower_bed',   tileX: 14, tileY: 18 },
            ],
        };

        // =============================================
        // map_002: 풍림 사냥터 (중급 사냥터, 35x35)
        // =============================================
        maps['map_002'] = {
            name: '풍림 사냥터',
            width: 35,
            height: 35,
            spawnX: 1,
            spawnY: 15,
            bgm: null,
            weather: 'leaves',
            tiles: this._generateForestMap(),
            npcs: [
                { id: 'npc_hunter', type: '길드마스터', name: '사냥꾼 진', x: 3, y: 14, dialog: '이곳은 풍림 사냥터다. 늑대와 해골 전사를 조심하게!' },
            ],
            portals: [
                { x: 0, y: 15, targetMap: 'map_001', targetX: 23, targetY: 12, label: '← 바람 마을' },
                { x: 34, y: 15, targetMap: 'map_003', targetX: 15, targetY: 26, label: '→ 불의 심장 (보스)' },
            ],
            monsterZones: [
                { type: 'm_011_wolf', x: 8, y: 3, width: 12, height: 12, count: 15, level: 3 },
                { type: 'm_021_skeleton', x: 20, y: 5, width: 12, height: 12, count: 12, level: 4 },
                { type: 'm_012_boar', x: 5, y: 20, width: 12, height: 12, count: 10, level: 3 },
                { type: 'm_013_goblin_scout', x: 20, y: 20, width: 12, height: 12, count: 12, level: 3 },
                { type: 'm_005_bee', x: 14, y: 8, width: 6, height: 6, count: 8, level: 3 },
                { type: 'boss_slime_king', x: 25, y: 25, width: 6, height: 6, count: 1, level: 5 },
            ],
            decorations: [
                { id: 'ruined_temple', tileX: 16, tileY: 16 },
                { id: 'big_tree',   tileX: 4,  tileY: 4  },
                { id: 'big_tree',   tileX: 15, tileY: 3  },
                { id: 'big_tree',   tileX: 28, tileY: 5  },
                { id: 'ruin',       tileX: 6,  tileY: 18 },
                { id: 'ruin',       tileX: 22, tileY: 16 },
                { id: 'cliff',      tileX: 12, tileY: 28 },
                { id: 'waterfall',  tileX: 30, tileY: 20 },
                { id: 'ancient_tree', tileX: 25, tileY: 25 },
                { id: 'ancient_tree', tileX: 5,  tileY: 10 },
                // 추가 나무 울타리 — 사냥 구역 분리용
                { id: 'big_tree',   tileX: 10, tileY: 8  },
                { id: 'big_tree',   tileX: 12, tileY: 8  },
                { id: 'big_tree',   tileX: 20, tileY: 20 },
                { id: 'big_tree',   tileX: 22, tileY: 22 },
                { id: 'ancient_tree', tileX: 8,  tileY: 25 },
                { id: 'ancient_tree', tileX: 30, tileY: 12 },
                { id: 'big_tree',   tileX: 18, tileY: 28 },
            ],
            terrains: [
                { id: 'mossy_rocks', tileX: 12, tileY: 12, alpha: 0.8 },
                { id: 'stone_patch', tileX: 20, tileY: 25, alpha: 0.5 },
            ],
        };

        // =============================================
        // map_003: 불의 심장 (보스방, 30x30)
        // =============================================
        maps['map_003'] = {
            name: '불의 심장 (보스)',
            width: 30,
            height: 30,
            spawnX: 15,
            spawnY: 25,
            bgm: null,
            weather: 'lava',
            tiles: this._generateLavaMap(),
            npcs: [],
            portals: [
                { x: 15, y: 29, targetMap: 'map_002', targetX: 17, targetY: 2, label: '← 풍림 사냥터' },
            ],
            monsterZones: [
                { type: 'boss_black_dragon', x: 10, y: 5, width: 10, height: 10, count: 1, level: 10 },
                { type: 'm_029_hell_hound', x: 5, y: 20, width: 8, height: 6, count: 5, level: 8 },
                { type: 'm_024_gargoyle', x: 18, y: 20, width: 8, height: 6, count: 4, level: 8 },
            ],
            decorations: [
                { id: 'magic_circle', tileX: 13, tileY: 13 }, // 중앙 보스 소환진
                { id: 'skull_altar',  tileX: 5,  tileY: 5  },
                { id: 'skull_altar',  tileX: 22, tileY: 5  },
                { id: 'statue',      tileX: 8,  tileY: 10 },
                { id: 'statue',      tileX: 20, tileY: 10 },
                { id: 'lava_pillar', tileX: 5,  tileY: 20 },
                { id: 'lava_pillar', tileX: 22, tileY: 20 },
                { id: 'dungeon_torch', tileX: 12, tileY: 11 },
                { id: 'dungeon_torch', tileX: 18, tileY: 11 },
                { id: 'stone_pillar', tileX: 10, tileY: 15 },
                { id: 'stone_pillar', tileX: 20, tileY: 15 },
                { id: 'altar',       tileX: 14, tileY: 10 }, // 보석 제단
                { id: 'dungeon_cage', tileX: 5,  tileY: 15 }, // 고립된 감옥
                { id: 'lava_pit',     tileX: 10, tileY: 23 }, // 신규 용암 구덩이
                { id: 'lava_pit',     tileX: 18, tileY: 23 },
            ],
        };

        // =============================================
        // map_004: 남천 얼음 동굴 (고급 사냥터, 30x30)
        // =============================================
        maps['map_004'] = {
            name: '얼음 동굴',
            width: 30,
            height: 30,
            spawnX: 5,
            spawnY: 5,
            bgm: null,
            weather: 'snow',
            tiles: this._generateIceMap(),
            npcs: [],
            portals: [
                { x: 5, y: 5, targetMap: 'map_001', targetX: 5, targetY: 23, label: '↑ 바람 마을' },
                { x: 28, y: 28, targetMap: 'map_005', targetX: 2, targetY: 2, label: '→ 하늘 성전' },
            ],
            monsterZones: [
                { type: 'm_028_wraith', x: 8, y: 8, width: 10, height: 10, count: 10, level: 6 },
                { type: 'm_038_polar_bear', x: 18, y: 15, width: 8, height: 8, count: 5, level: 8 },
                { type: 'm_032_yeti', x: 5, y: 20, width: 10, height: 8, count: 4, level: 7 },
                { type: 'm_039_ice_spirit', x: 20, y: 22, width: 8, height: 6, count: 6, level: 7 },
                { type: 'boss_lich_king', x: 15, y: 15, width: 5, height: 5, count: 1, level: 9 },
            ],
            decorations: [
                { id: 'ice_pillar',   tileX: 3,  tileY: 10 },
                { id: 'ice_crystal',  tileX: 15, tileY: 20 },
                { id: 'treasure_pile', tileX: 26, tileY: 26 }, // 숨겨진 보물
                { id: 'stone_pillar', tileX: 10, tileY: 5 },
                { id: 'stone_pillar', tileX: 20, tileY: 5 },
                { id: 'ice_statue',   tileX: 5,  tileY: 20 }, // 신규 얼음 석상
                { id: 'ice_statue',   tileX: 25, tileY: 5  },
            ],
        };

        // =============================================
        // map_005: 하늘 정원 (최종 결전, 40x40)
        // =============================================
        maps['map_005'] = {
            name: '하늘 정원 (최종)',
            width: 40,
            height: 40,
            spawnX: 2,
            spawnY: 2,
            bgm: null,
            weather: 'leaves', // 꽃가루 느낌으로 낙엽 효과 재활용
            tiles: this._generateHeavenMap(),
            npcs: [
                { 
                    id: 'npc_final', 
                    type: '길드마스터', 
                    name: '천상의 수호자', 
                    x: 20, y: 35, 
                    dialogChain: [
                        '너머에... 이 세계의 운명을 결정지을 존재가 기다리고 있다.',
                        '용기를 잃지 마라, 모험가여.',
                        '그대에게 신의 가호가 있기를.'
                    ]
                },
            ],
            portals: [
                { x: 2, y: 2, targetMap: 'map_004', targetX: 27, targetY: 27, label: '← 얼음 동굴' },
            ],
            monsterZones: [
                { type: 'boss_black_dragon', x: 15, y: 15, width: 10, height: 10, count: 1, level: 12 },
                { type: 'm_028_wraith', x: 5, y: 10, width: 10, height: 15, count: 12, level: 9 },
                { type: 'm_042_heavenly_knight', x: 25, y: 10, width: 10, height: 15, count: 8, level: 10 },
                { type: 'm_044_valkyrie', x: 15, y: 30, width: 10, height: 8, count: 3, level: 11 },
            ],
            decorations: [
                { id: 'magic_circle', tileX: 18, tileY: 18 },
                { id: 'world_tree',   tileX: 30, tileY: 5  },
                { id: 'castle_gate',  tileX: 18, tileY: 30 },
                { id: 'statue',       tileX: 10, tileY: 35 },
                { id: 'statue',       tileX: 30, tileY: 35 },
            ],
        };

        // =============================================
        // map_006: 잊혀진 광산 (광산 맵, 30x30)
        // =============================================
        maps['map_006'] = {
            name: '잊혀진 광산',
            width: 30,
            height: 30,
            spawnX: 5,
            spawnY: 5,
            bgm: null,
            tiles: this._generateMineMap(),
            npcs: [
                { id: 'npc_miner', type: '길드마스터', name: '늙은 광부', x: 7, y: 7, dialog: '이곳은 한때 보물이 가득했지... 지금은 멧돼지들이 점령했다네.' },
            ],
            portals: [
                { x: 5, y: 28, targetMap: 'map_001', targetX: 13, targetY: 2, label: '↑ 바람 마을' },
            ],
            monsterZones: [
                { type: 'm_012_boar', x: 10, y: 10, width: 12, height: 12, count: 12, level: 5 },
                { type: 'm_019_spider_web', x: 20, y: 8, width: 8, height: 10, count: 8, level: 4 },
                { type: 'm_025_mimic', x: 22, y: 22, width: 6, height: 6, count: 3, level: 6 },
            ],
            decorations: [
                { id: 'mine_rail',      tileX: 5,  tileY: 15 },
                { id: 'mine_rail',      tileX: 7,  tileY: 15 },
                { id: 'mine_rail',      tileX: 9,  tileY: 15 },
                { id: 'mine_ore',       tileX: 15, tileY: 10 },
                { id: 'mine_ore',       tileX: 18, tileY: 12 },
                { id: 'mine_stalactite', tileX: 20, tileY: 5 },
                { id: 'mine_stalactite', tileX: 10, tileY: 25 },
            ],
        };

        return maps;
    }

    /**
     * 광산 맵 생성 (30x30)
     */
    _generateMineMap() {
        const W = 30, H = 30;
        // 시드 기반 랜덤 (일관성 유지)
        let seed = 42;
        const seededRand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };
        const tiles = [];
        for (let y = 0; y < H; y++) {
            const row = [];
            for (let x = 0; x < W; x++) {
                if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
                    if (x === 5 && y === H - 1) row.push(4); // 남쪽 포털 (마을로 귀환)
                    else row.push(8); // 동굴 벽
                } else if (seededRand() < 0.08) {
                    row.push(8); // 바위 기둥 (이동 불가)
                } else {
                    row.push(7); // 동굴 바닥 (이동 가능)
                }
            }
            tiles.push(row);
        }
        return tiles;
    }

    /**
     * 얼음 맵 생성 (30x30)
     */
    _generateIceMap() {
        const W = 30, H = 30;
        const tiles = [];
        for (let y = 0; y < H; y++) {
            const row = [];
            for (let x = 0; x < W; x++) {
                if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
                    if (x === 5 && y === 0) row.push(4); // 북쪽 포털
                    else if (x === W - 2 && y === H - 1) row.push(4); // 남쪽 포털 (약간 우측 아래)
                    else row.push(1);
                } else if (Math.random() < 0.15) {
                    row.push(3); // 얼음물
                } else if (Math.random() < 0.08) {
                    row.push(6); // 얼음 바위 (나무 타일 재활용)
                } else {
                    row.push(0); // 눈바닥
                }
            }
            tiles.push(row);
        }
        return tiles;
    }

    /**
     * 하늘 성전 맵 생성 (40x40)
     */
    _generateHeavenMap() {
        const W = 40, H = 40;
        const tiles = [];
        for (let y = 0; y < H; y++) {
            const row = [];
            for (let x = 0; x < W; x++) {
                if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
                    if (x === 2 && y === 0) row.push(4); // 입구 포털
                    else row.push(1);
                } else if ((x + y) % 10 === 0) {
                    row.push(5); // 대리석 길 (나무바닥 재활용)
                } else if (Math.random() < 0.05) {
                    row.push(3); // 구름 구덩이 (물 재활용)
                } else {
                    row.push(0); // 황금 풀밭
                }
            }
            tiles.push(row);
        }
        return tiles;
    }

    /**
     * 용암 맵 생성 (30x30)
     */
    _generateLavaMap() {
        const W = 30, H = 30;
        const tiles = [];
        for (let y = 0; y < H; y++) {
            const row = [];
            for (let x = 0; x < W; x++) {
                if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
                    row.push(1); // 벽
                } else if ((x < 5 || x > 25 || y < 5 || y > 25) && !(x === 15 && y > 24)) {
                    row.push(3); // 용암 (물 타일 재활용하거나 추후 용암 타일 추가)
                } else if (Math.random() < 0.1) {
                    row.push(2); // 흙
                } else {
                    row.push(5); // 나무바닥 (열기 있는 바닥 대용)
                }
            }
            tiles.push(row);
        }
        return tiles;
    }


    /**
     * 왕초보 사냥터 맵 타일 데이터 생성 (30x30)
     */
    _generateBeginnerMap() {
        const W = 30, H = 30;
        const tiles = [];
        for (let y = 0; y < H; y++) {
            const row = [];
            for (let x = 0; x < W; x++) {
                // 외곽 벽
                if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
                    // 포털 위치 (동쪽 출구)
                    if (x === W - 1 && y === 15) {
                        row.push(4); // 포털
                    } else {
                        row.push(1); // 벽
                    }
                }
                // 물웅덩이
                else if ((x >= 3 && x <= 5 && y >= 3 && y <= 5) ||
                    (x >= 22 && x <= 25 && y >= 22 && y <= 25)) {
                    row.push(3); // 물
                }
                // 나무
                else if ((x === 8 && y === 8) || (x === 20 && y === 6) ||
                    (x === 5 && y === 20) || (x === 24 && y === 10) ||
                    (x === 12 && y === 22) || (x === 18 && y === 18)) {
                    row.push(6); // 나무
                }
                // 중앙 길
                else if (y >= 14 && y <= 16 && x >= 1 && x <= 28) {
                    row.push(2); // 흙길
                }
                else if (x >= 14 && x <= 16 && y >= 1 && y <= 28) {
                    row.push(2); // 흙길 (세로)
                }
                else {
                    row.push(0); // 풀밭
                }
            }
            tiles.push(row);
        }
        return tiles;
    }

    /**
     * 바람 마을 맵 타일 데이터 생성 (25x25)
     */
    _generateVillageMap() {
        const W = 25, H = 25;
        const tiles = [];
        for (let y = 0; y < H; y++) {
            const row = [];
            for (let x = 0; x < W; x++) {
                // 외곽 벽
                if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
                    if ((x === 0 && y === 12) || (x === W - 1 && y === 12)) {
                        row.push(4); // 포털 (서쪽/동쪽)
                    } else if (x === 13 && y === 0) {
                        row.push(4); // 포털 (북쪽, 광산으로)
                    } else {
                        row.push(1);
                    }
                }
                // 건물 영역 (벽)
                else if (x >= 10 && x <= 14 && y >= 5 && y <= 10) {
                    if (x === 12 && y === 10) row.push(5); // 주막 입구 (나무바닥)
                    else row.push(1);
                }
                else if (x >= 16 && x <= 20 && y >= 12 && y <= 16) {
                    if (x === 18 && y === 16) row.push(5); // 대장간 입구
                    else row.push(1);
                }
                // 주요 도로 (흙길)
                else if (y >= 11 && y <= 13) {
                    row.push(2);
                }
                else if (x >= 11 && x <= 13 && y >= 10 && y <= 20) {
                    row.push(2);
                }
                // 마을 광장 (나무 바닥)
                else if (x >= 8 && x <= 16 && y >= 17 && y <= 21) {
                    row.push(5);
                }
                // 연못
                else if (x >= 3 && x <= 6 && y >= 17 && y <= 20) {
                    row.push(3);
                }
                // 마을 나무 장식
                else if ((x === 4 && y === 4) || (x === 20 && y === 4) ||
                    (x === 4 && y === 10) || (x === 22 && y === 20)) {
                    row.push(6);
                }
                else {
                    row.push(0);
                }
            }
            tiles.push(row);
        }
        return tiles;
    }

    /**
     * 풍림 사냥터 맵 타일 데이터 생성 (35x35)
     */
    _generateForestMap() {
        const W = 35, H = 35;
        const tiles = [];
        for (let y = 0; y < H; y++) {
            const row = [];
            for (let x = 0; x < W; x++) {
                // 외곽 벽
                if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
                    if (x === 0 && y === 15) {
                        row.push(4); // 서쪽 포털 (마을)
                    } else if (x === W - 1 && y === 15) {
                        row.push(4); // 동쪽 포털 (보스방)
                    } else {
                        row.push(1);
                    }
                }
                // 물 웅덩이
                else if (x >= 15 && x <= 19 && y >= 15 && y <= 19) {
                    row.push(3);
                }
                // 나무 숲 (랜덤 패턴)
                else if (
                    (x % 7 === 0 && y % 5 === 0 && x > 1 && y > 1) ||
                    (x === 10 && y === 10) || (x === 25 && y === 8) ||
                    (x === 8 && y === 25) || (x === 28 && y === 28) ||
                    (x === 5 && y === 30) || (x === 30 && y === 5)
                ) {
                    row.push(6);
                }
                // 메인 길
                else if (y >= 14 && y <= 16 && x >= 1 && x <= 6) {
                    row.push(2);
                }
                else if (x >= 14 && x <= 16 && y >= 1 && y <= 33) {
                    row.push(2);
                }
                else {
                    row.push(0);
                }
            }
            tiles.push(row);
        }
        return tiles;
    }

    /**
     * 맵 로드
     * @param {string} mapId - 맵 ID
     */
    loadMap(mapId) {
        if (!this.maps[mapId]) {
            console.error(`[MapManager] 맵을 찾을 수 없음: ${mapId}`);
            return false;
        }
        this.currentMap = this.maps[mapId];
        this.mapId = mapId;
        console.log(`[MapManager] 맵 로드: ${this.currentMap.name} (${mapId})`);
        return true;
    }

    /**
     * 카메라를 플레이어 위치에 맞춤 (플레이어 중심 스크롤)
     * @param {number} playerX - 플레이어 월드 X (픽셀)
     * @param {number} playerY - 플레이어 월드 Y (픽셀)
     */
    updateCamera(playerX, playerY) {
        if (!this.currentMap) return;

        // 카메라는 플레이어를 화면 중앙에 놓음
        this.camera.x = playerX - this.canvas.width / 2;
        this.camera.y = playerY - this.canvas.height / 2;

        // 맵 경계 클램핑
        const mapPixelW = this.currentMap.width * this.TILE_SIZE;
        const mapPixelH = this.currentMap.height * this.TILE_SIZE;
        this.camera.x = Math.max(0, Math.min(this.camera.x, mapPixelW - this.canvas.width));
        this.camera.y = Math.max(0, Math.min(this.camera.y, mapPixelH - this.canvas.height));
    }

    /**
     * 타일맵 렌더링 (카메라 기준 가시 영역만)
     */
    render() {
        if (!this.currentMap || !assetManager.loaded) return;

        const map = this.currentMap;
        const tileImages = assetManager.images.tiles;

        // 가시 타일 범위 계산
        const startCol = Math.max(0, Math.floor(this.camera.x / this.TILE_SIZE));
        const startRow = Math.max(0, Math.floor(this.camera.y / this.TILE_SIZE));
        const endCol = Math.min(map.width - 1, Math.ceil((this.camera.x + this.canvas.width) / this.TILE_SIZE));
        const endRow = Math.min(map.height - 1, Math.ceil((this.camera.y + this.canvas.height) / this.TILE_SIZE));

        // 타일 렌더링 (위치 기반 색조 변화 + 엣지 블렌딩)
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const tileId = map.tiles[row][col];
                const screenX = col * this.TILE_SIZE - this.camera.x;
                const screenY = row * this.TILE_SIZE - this.camera.y;
                const sx = Math.floor(screenX);
                const sy = Math.floor(screenY);
                const S  = this.TILE_SIZE;

                const tileImg = tileImages[tileId];
                if (tileImg) {
                    // ① 기본 타일 드로우
                    this.ctx.drawImage(tileImg, sx, sy);

                    // ② 위치 시드 기반 미세 색조 오버레이
                    // 같은 타일 반복 시 각 위치마다 미묘하게 다른 컬러로 변화
                    const seed = (col * 17 + row * 31) & 0xFFFFFF;
                    const rOff = ((seed & 0x1F) - 8) ;     // -8 ~ +23
                    const gOff = (((seed >> 5) & 0x1F) - 8);
                    const bOff = (((seed >> 10) & 0x1F) - 8);
                    const alpha = 0.06 + ((seed >> 15) & 0xF) / 150; // 0.06~0.16

                    if (tileId !== 1 && tileId !== 3) { // 벽/물은 오버레이 제외
                        this.ctx.save();
                        this.ctx.globalAlpha = alpha;
                        this.ctx.fillStyle = `rgb(${128 + rOff},${128 + gOff},${128 + bOff})`;
                        this.ctx.fillRect(sx, sy, S, S);
                        this.ctx.restore();
                    }

                    // ③ 이웃 타일과 다를 경우 엣지 그라데이션 블렌딩
                    const edgeDirs = [
                        { dx: 1, dy: 0, edge: 'right' },
                        { dx: 0, dy: 1, edge: 'bottom' },
                    ];
                    for (const { dx, dy, edge } of edgeDirs) {
                        const nx = col + dx, ny = row + dy;
                        if (nx < map.width && ny < map.height) {
                            const nId = map.tiles[ny][nx];
                            // 타일 종류가 다를 때만 블렌드 엣지 추가
                            if (nId !== tileId) {
                                this.ctx.save();
                                this.ctx.globalAlpha = 0.18;
                                let grad;
                                if (edge === 'right') {
                                    grad = this.ctx.createLinearGradient(sx + S - 6, sy, sx + S, sy);
                                } else {
                                    grad = this.ctx.createLinearGradient(sx, sy + S - 6, sx, sy + S);
                                }
                                grad.addColorStop(0, 'transparent');
                                grad.addColorStop(1, 'rgba(0,0,0,0.4)');
                                this.ctx.fillStyle = grad;
                                if (edge === 'right') {
                                    this.ctx.fillRect(sx + S - 6, sy, 6, S);
                                } else {
                                    this.ctx.fillRect(sx, sy + S - 6, S, 6);
                                }
                                this.ctx.restore();
                            }
                        }
                    }
                }
            }
        }

        // ④ 메가타일 지형(Terrain) 레이어 렌더링 (바닥 배경용 대형 오브젝트)
        const megaTiles = assetManager.images.megaTiles;
        if (megaTiles && map.terrains) {
            map.terrains.forEach(terr => {
                const mgt = megaTiles[terr.id];
                if (!mgt || !mgt.canvas) return;
                const sx = terr.tileX * this.TILE_SIZE - this.camera.x;
                const sy = terr.tileY * this.TILE_SIZE - this.camera.y;
                if (sx + mgt.canvas.width < 0 || sx > this.canvas.width) return;
                if (sy + mgt.canvas.height < 0 || sy > this.canvas.height) return;
                // 지형은 그림자 없이 바로 렌더링 (또는 매우 낮은 투명도)
                this.ctx.save();
                this.ctx.globalAlpha = terr.alpha || 1.0;
                this.ctx.drawImage(mgt.canvas, Math.floor(sx), Math.floor(sy));
                this.ctx.restore();
            });
        }

        // ⑤ 메가타일 데코레이션 레이어 렌더링 (타일 2~6개 크기 대형 오브젝트)
        if (megaTiles && map.decorations) {
            map.decorations.forEach(deco => {
                const mgt = megaTiles[deco.id];
                if (!mgt || !mgt.canvas) return;
                const sx = deco.tileX * this.TILE_SIZE - this.camera.x;
                const sy = deco.tileY * this.TILE_SIZE - this.camera.y;
                // 화면 범위 안에 있는지 확인
                if (sx + mgt.canvas.width < 0 || sx > this.canvas.width) return;
                if (sy + mgt.canvas.height < 0 || sy > this.canvas.height) return;
                // 그림자 (약한 반투명 원)
                this.ctx.save();
                this.ctx.globalAlpha = 0.18;
                this.ctx.fillStyle = '#000';
                this.ctx.beginPath();
                this.ctx.ellipse(sx + mgt.canvas.width / 2, sy + mgt.canvas.height - 6,
                    mgt.canvas.width * 0.4, 8, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
                // 메가타일 드로우
                this.ctx.drawImage(mgt.canvas, Math.floor(sx), Math.floor(sy));
            });
        }

        // 포털 글로우 애니메이션
        const time = Date.now() / 1000;
        map.portals.forEach(portal => {
            const screenX = portal.x * this.TILE_SIZE - this.camera.x + this.TILE_SIZE / 2;
            const screenY = portal.y * this.TILE_SIZE - this.camera.y + this.TILE_SIZE / 2;
            const glowRadius = 14 + Math.sin(time * 3) * 4;
            const alpha = 0.2 + Math.sin(time * 2) * 0.1;

            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = '#a080ff';
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });

        // NPC 렌더링
        this._renderNPCs();
    }

    /**
     * NPC 렌더링
     */
    _renderNPCs() {
        if (!this.currentMap) return;

        this.currentMap.npcs.forEach(npc => {
            const screenX = npc.x * this.TILE_SIZE - this.camera.x;
            const screenY = npc.y * this.TILE_SIZE - this.camera.y;

            // NPC 스프라이트
            const npcSprite = assetManager.images.npcs[npc.type];
            if (npcSprite) {
                this.ctx.drawImage(npcSprite, Math.floor(screenX), Math.floor(screenY));
            }

            // NPC 이름 표시
            this.ctx.save();
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = 'bold 10px "Noto Sans KR", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(npc.name, screenX + this.TILE_SIZE / 2, screenY - 4);
            this.ctx.fillText(npc.name, screenX + this.TILE_SIZE / 2, screenY - 4);
            this.ctx.restore();
        });
    }

    /**
     * 충돌 감지: 특정 타일 좌표가 이동 가능한지 확인
     * @param {number} tileX - 타일 X 좌표
     * @param {number} tileY - 타일 Y 좌표
     * @returns {boolean} 이동 가능 여부
     */
    isWalkable(tileX, tileY) {
        if (!this.currentMap) return false;
        if (tileX < 0 || tileY < 0 || tileX >= this.currentMap.width || tileY >= this.currentMap.height) {
            return false;
        }

        // ① 기본 타일 충돌 검사
        const tileId = this.currentMap.tiles[tileY][tileX];
        if (this.solidTiles.has(tileId)) return false;

        // ② 메가타일(데코레이션) 충돌 검사
        if (this.currentMap.decorations && typeof assetManager !== 'undefined' && assetManager.images.megaTiles) {
            const decos = this.currentMap.decorations;
            const megaTiles = assetManager.images.megaTiles;
            for (let i = 0; i < decos.length; i++) {
                const deco = decos[i];
                // solid 오브젝트만 충돌 판정
                if (!this.solidDecorations.has(deco.id)) continue;
                // 메가타일 크기 정보 조회
                const mgt = megaTiles[deco.id];
                if (!mgt) continue;
                const tw = mgt.tilesW || 2;
                const th = mgt.tilesH || 2;
                // 타일 좌표가 메가타일 영역 안에 있는지 확인
                if (tileX >= deco.tileX && tileX < deco.tileX + tw &&
                    tileY >= deco.tileY && tileY < deco.tileY + th) {
                    return false; // 이동 불가
                }
            }
        }

        return true; // 이동 가능
    }

    /**
     * 포털 체크: 플레이어가 포털 타일 위에 있는지 확인
     * @param {number} tileX - 타일 X
     * @param {number} tileY - 타일 Y
     * @returns {Object|null} 포털 정보 또는 null
     */
    checkPortal(tileX, tileY) {
        if (!this.currentMap) return null;
        return this.currentMap.portals.find(p => p.x === tileX && p.y === tileY) || null;
    }

    /**
     * NPC 인터랙션 체크
     * @param {number} tileX - 타일 X
     * @param {number} tileY - 타일 Y
     * @returns {Object|null} NPC 정보 또는 null
     */
    checkNPC(tileX, tileY) {
        if (!this.currentMap) return null;
        return this.currentMap.npcs.find(n => n.x === tileX && n.y === tileY) || null;
    }
}
