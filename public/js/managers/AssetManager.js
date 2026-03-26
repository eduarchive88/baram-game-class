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
            // === 아이템 ===
            item_potion_hp:    await this.loadImage('/assets/images/items/potion_hp.png'),
            item_potion_mp:    await this.loadImage('/assets/images/items/potion_mp.png'),
            item_potion_full:  await this.loadImage('/assets/images/items/potion_full.png'),
            item_gold:         await this.loadImage('/assets/images/items/gold.png'),
            item_sword:        await this.loadImage('/assets/images/items/sword.png'),
            // === 스킬 이펙트 ===
            effect_slash:     await this.loadImage('/assets/images/effects/slash.png'),
            effect_magic:     await this.loadImage('/assets/images/effects/magic.png'),
            effect_fireball:  await this.loadImage('/assets/images/effects/fireball.png'),
            effect_lightning: await this.loadImage('/assets/images/effects/lightning.png'),
            effect_heal:      await this.loadImage('/assets/images/effects/heal.png'),
            effect_poison:    await this.loadImage('/assets/images/effects/poison.png'),
            effect_shield:    await this.loadImage('/assets/images/effects/shield.png'),
            effect_ice:       await this.loadImage('/assets/images/effects/ice.png'),
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
            // 아이템
            item_potion_hp:   rawAssets.item_potion_hp,
            item_potion_mp:   rawAssets.item_potion_mp,
            item_potion_full: rawAssets.item_potion_full,
            item_gold:        rawAssets.item_gold,
            item_sword:       rawAssets.item_sword,
            // 스킬 이펙트
            effect_slash:     rawAssets.effect_slash,
            effect_magic:     rawAssets.effect_magic,
            effect_fireball:  rawAssets.effect_fireball,
            effect_lightning: rawAssets.effect_lightning,
            effect_heal:      rawAssets.effect_heal,
            effect_poison:    rawAssets.effect_poison,
            effect_shield:    rawAssets.effect_shield,
            effect_ice:       rawAssets.effect_ice,
        };

        // 타일셋 스프라이트 생성
        this.images.tiles = this._generateTileset(assets);

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
        };

        // 아이템 이미지 등록 (흰 배경 → 투명 처리)
        this.images.items = {
            potion_hp:   this._removeWhiteBackground(assets.item_potion_hp),
            potion_mp:   this._removeWhiteBackground(assets.item_potion_mp),
            potion_full: this._removeWhiteBackground(assets.item_potion_full),
            gold:        this._removeWhiteBackground(assets.item_gold),
            sword:       this._removeWhiteBackground(assets.item_sword),
        };

        // 메가타일 (여러 타일 합체 대형 지형 오브젝트)
        this.images.megaTiles = this._generateMegaTiles();

        // 프로시저럴 스킬 이펙트 캔버스 생성 (이미지 없이 캔버스로 직접 그린 이펙트)
        this.images.procEffects = this._generateProceduralEffects();

        this.loaded = true;
        console.log('[AssetManager] 모든 에셋 준비 완료');
        return true;
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
     * @param {HTMLImageElement|HTMLCanvasElement} imgEl
     * @returns {HTMLCanvasElement}
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
            // 흰색~밝은 회색 영역 투명처리
            if (r > 200 && g > 200 && b > 200) {
                // 흰색 가까울수록 더 강하게 투명화
                const factor = ((r - 200) + (g - 200) + (b - 200)) / (3 * 55);
                d[i+3] = Math.min(d[i+3], Math.floor(d[i+3] * (1 - factor)));
            }
        }
        ctx.putImageData(data, 0, 0);
        return canvas;
    }

    /**
     * 검정 배경 제거 (스킬 이펙트 이미지용)
     * 어두운 픽셀(R,G,B 모두 80 이하)을 투명 처리
     * @param {HTMLImageElement|HTMLCanvasElement} imgEl
     * @returns {HTMLCanvasElement}
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
            // 어두운 영역을 투명도에 반영
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
     * 메가타일 8종 프로시저럴 생성
     * 각 오브젝트는 2~3개 타일 폭/높이 캔버스로 그려짐
     * 반환: { id: { canvas, tilesW, tilesH, theme } }
     */
    _generateMegaTiles() {
        const S = this.TILE_SIZE;
        const mgt = {};
        // 헬퍼: W×H 타일 크기 캔버스 생성
        const mk = (w, h) => {
            const c = document.createElement('canvas');
            c.width = w * S; c.height = h * S;
            return { c, x: c.getContext('2d') };
        };
        const rnd = (seed) => { const v = Math.sin(seed + 1) * 10000; return v - Math.floor(v); };

        // 1. 대형 고목 (2x3 = 64x96px, 숲/야외)
        {
            const { c, x: ctx } = mk(2, 3);
            const W = c.width, H = c.height;
            // 트렁크
            ctx.fillStyle = '#5a3a1a'; ctx.fillRect(24, 44, 16, 52);
            ctx.fillStyle = '#6a4a28'; ctx.fillRect(26, 60, 4, 30);
            ctx.fillStyle = '#4a2e10'; ctx.fillRect(38, 58, 3, 32);
            // 잎사귀 6클러스터
            [
                [10,6,19,'#2e6014'],[33,2,22,'#3a7820'],[54,8,17,'#286010'],
                [20,22,23,'#348018'],[44,24,20,'#3a7820'],[32,36,25,'#2c7016'],
            ].forEach(([lx,ly,r,col]) => {
                ctx.fillStyle = col;
                ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI*2); ctx.fill();
            });
            // 반짝임
            ctx.fillStyle = 'rgba(100,255,50,0.15)';
            for (let i=0;i<12;i++) { ctx.fillRect(rnd(i*7)*W, rnd(i*7+1)*56, 3, 3); }
            mgt['big_tree'] = { canvas: c, tilesW: 2, tilesH: 3, theme: 'forest' };
        }

        // 2. 석조 폐허 (3x2 = 96x64px, 던전)
        {
            const { c, x: ctx } = mk(3, 2);
            const W = c.width, H = c.height;
            ctx.fillStyle = '#3a3a4a'; ctx.fillRect(0, 0, W, H);
            [
                [2,2,30,35],[35,8,28,30],[65,4,28,32],
                [10,30,25,28],[50,28,32,30],[15,48,20,14],[70,44,22,18],
            ].forEach(([sx,sy,sw,sh],i) => {
                ctx.fillStyle = ['#5a5a6a','#6a6a7a','#686878','#4e4e5e'][i%4];
                ctx.fillRect(sx,sy,sw,sh);
                ctx.fillStyle='#7e7e8e'; ctx.fillRect(sx,sy,sw,2); ctx.fillRect(sx,sy,2,sh);
                ctx.fillStyle='#4a4a58'; ctx.fillRect(sx,sy+sh-2,sw,2); ctx.fillRect(sx+sw-2,sy,2,sh);
            });
            ctx.fillStyle='#3a5a3a';
            for(let i=0;i<14;i++) ctx.fillRect(rnd(i*9+200)*W, 30+rnd(i*9+201)*30, 3, 2);
            mgt['ruin'] = { canvas: c, tilesW: 3, tilesH: 2, theme: 'dungeon' };
        }

        // 3. 암벽 절벽 (3x2 = 96x64px, 야외)
        {
            const { c, x: ctx } = mk(3, 2);
            const W = c.width, H = c.height;
            ctx.fillStyle = '#808090'; ctx.fillRect(0, 0, W, H);
            const g = ctx.createLinearGradient(0,0,0,H);
            g.addColorStop(0,'#6a6a7e'); g.addColorStop(1,'#9a9aaa');
            ctx.fillStyle = g; ctx.fillRect(0,0,W,Math.floor(H*0.7));
            [[0,12,'#5a5a6e'],[14,8,'#7a7a88'],[24,10,'#5e5e70'],[36,6,'#8a8a96']].forEach(([y,h,col]) => {
                ctx.fillStyle=col; ctx.fillRect(8,y,W-16,h);
                for(let px=0;px<W-8;px+=16) {
                    const jit = Math.floor(rnd(px*3+y)*6)-3;
                    ctx.fillRect(px, y+jit, 14, h);
                }
            });
            ctx.fillStyle='#4a6a30';
            for(let i=0;i<8;i++) ctx.fillRect(rnd(i*11+100)*W, H-14, 4, 14);
            mgt['cliff'] = { canvas: c, tilesW: 3, tilesH: 2, theme: 'outdoor' };
        }

        // 4. 신전 석상 (2x3 = 64x96px, 마을)
        {
            const { c, x: ctx } = mk(2, 3);
            const W = c.width, H = c.height;
            ctx.fillStyle='#b09870'; ctx.fillRect(0,0,W,H);
            [[78,18,'#7a6040'],[64,14,'#8a7050'],[52,12,'#9a8060'],[43,9,'#aA9070']].forEach(([y,h,col]) => {
                const m = Math.floor(W*0.12);
                ctx.fillStyle=col; ctx.fillRect(m,y,W-m*2,h);
                ctx.fillStyle='#bba070'; ctx.fillRect(m,y,W-m*2,2);
            });
            ctx.fillStyle='#5a5a7a'; ctx.fillRect(18,22,28,22);
            ctx.fillStyle='#4a4a6a'; ctx.fillRect(20,24,24,20);
            ctx.fillStyle='#e0e0ff'; ctx.fillRect(22,28,6,4); ctx.fillRect(36,28,6,4);
            ctx.fillStyle='#ffd700'; ctx.fillRect(16,20,32,2); ctx.fillRect(16,44,32,2);
            mgt['shrine'] = { canvas: c, tilesW: 2, tilesH: 3, theme: 'village' };
        }

        // 5. 폭포 (2x3 = 64x96px, 야외)
        {
            const { c, x: ctx } = mk(2, 3);
            const W = c.width, H = c.height;
            ctx.fillStyle='#6a8070'; ctx.fillRect(0,0,W,H);
            for(let px=16;px<48;px+=6) {
                for(let py=0;py<70;py+=4) {
                    const wave = Math.sin(py/8+px*0.15)*2;
                    ctx.fillStyle = py%8<4 ? '#4080b8' : '#50a0d0';
                    ctx.fillRect(px+wave, py, 4, 4);
                }
            }
            ctx.fillStyle='rgba(200,240,255,0.35)';
            for(let i=0;i<18;i++) ctx.fillRect(10+rnd(i*5+50)*44, rnd(i*5+51)*80, 2, 3);
            ctx.fillStyle='#3060a0'; ctx.fillRect(14,68,36,12);
            ctx.fillStyle='#3a5a30'; ctx.fillRect(2,0,10,96); ctx.fillRect(52,0,10,96);
            mgt['waterfall'] = { canvas: c, tilesW: 2, tilesH: 3, theme: 'outdoor' };
        }

        // 6. 상인 천막 (3x2 = 96x64px, 마을)
        {
            const { c, x: ctx } = mk(3, 2);
            const W = c.width, H = c.height;
            ctx.fillStyle='#c09060'; ctx.fillRect(8,12,80,48);
            const rg = ctx.createLinearGradient(0,4,0,16);
            rg.addColorStop(0,'#8a6030'); rg.addColorStop(1,'#c08040');
            ctx.fillStyle=rg;
            ctx.beginPath(); ctx.moveTo(0,16); ctx.lineTo(48,0); ctx.lineTo(96,16); ctx.closePath(); ctx.fill();
            ctx.fillStyle='#7a5030'; ctx.fillRect(12,12,8,50); ctx.fillRect(76,12,8,50);
            [[25,28,'#e04040'],[44,26,'#4040e0'],[62,30,'#40a040']].forEach(([ix,iy,ic]) => {
                ctx.fillStyle=ic; ctx.fillRect(ix,iy,8,14);
                ctx.fillStyle='#ffffff'; ctx.fillRect(ix+2,iy+2,4,2);
            });
            ctx.fillStyle='#ffd700'; ctx.fillRect(32,4,32,8);
            ctx.fillStyle='#8a6000'; ctx.fillRect(34,5,28,6);
            mgt['tent'] = { canvas: c, tilesW: 3, tilesH: 2, theme: 'village' };
        }

        // 7. 용암기둥 (2x3 = 64x96px, 용암던전)
        {
            const { c, x: ctx } = mk(2, 3);
            const W = c.width, H = c.height;
            ctx.fillStyle='#2a1a0a'; ctx.fillRect(0,0,W,H);
            ctx.fillStyle='#4a2a1a'; ctx.fillRect(20,20,24,72);
            const lCols=['#ff4000','#ff6600','#ff8000','#ffaa00'];
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

        return fx;
    }
}

// 전역 에셋 매니저 인스턴스
const assetManager = new AssetManager();
