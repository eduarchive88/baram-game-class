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
            grass: await this.loadImage('/assets/rpg_grass_tile_1773292706481.png'),
            wall: await this.loadImage('/assets/rpg_wall_brick_1773292904200.png'),
            dirt: await this.loadImage('/assets/rpg_dirt_path_1773292888496.png'),
            portal: await this.loadImage('/assets/rpg_portal_1773292920194.png'),
            shop: await this.loadImage('/assets/rpg_shop_building_1773292762510.png'),
            warrior: await this.loadImage('/assets/rpg_player_sprite_1773292722977.png'),
            thief: await this.loadImage('/assets/rpg_thief_sprite_1773292975879.png'),
            mage: await this.loadImage('/assets/rpg_mage_sprite_1773292931497.png'),
            healer: await this.loadImage('/assets/rpg_poet_sprite_1773292988919.png'),
            monster_squirrel: await this.loadImage('/assets/rpg_monster_squirrel_1773292740316.png'),
            monster_slime: await this.loadImage('/assets/rpg_monster_slime_1773294505327.png'),
            monster_wolf: await this.loadImage('/assets/rpg_monster_wolf_1773294519586.png'),
            monster_goblin: await this.loadImage('/assets/rpg_monster_goblin_1773294533102.png'),
            monster_skeleton: await this.loadImage('/assets/rpg_monster_skeleton.png')
        };

        // 투명화 적용 자산 (자연 경관 일부 이외의 개체들)
        const assets = {
            grass: rawAssets.grass, // 타일은 배경 제거 시 검은색 맵 바닥이 보일 수 있으므로 제외
            wall: rawAssets.wall,
            dirt: rawAssets.dirt,
            portal: this._removeWhiteBackground(rawAssets.portal),
            shop: this._removeWhiteBackground(rawAssets.shop),
            warrior: this._removeWhiteBackground(rawAssets.warrior),
            thief: this._removeWhiteBackground(rawAssets.thief),
            mage: this._removeWhiteBackground(rawAssets.mage),
            healer: this._removeWhiteBackground(rawAssets.healer),
            monster_squirrel: this._removeWhiteBackground(rawAssets.monster_squirrel),
            monster_slime: this._removeWhiteBackground(rawAssets.monster_slime),
            monster_wolf: this._removeWhiteBackground(rawAssets.monster_wolf),
            monster_goblin: this._removeWhiteBackground(rawAssets.monster_goblin),
            monster_skeleton: this._removeWhiteBackground(rawAssets.monster_skeleton),
        };

        // 타일셋 스프라이트 생성
        this.images.tiles = this._generateTileset(assets);

        // 캐릭터 스프라이트시트 생성 (4직업 × 4방향 × 4프레임)
        this.images.characters = {
            '전사': this._generateCharacterSheet('전사', assets.warrior),
            '도적': this._generateCharacterSheet('도적', assets.thief),
            '주술사': this._generateCharacterSheet('주술사', assets.mage),
            '도사': this._generateCharacterSheet('도사', assets.healer),
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
        this.images.icons = this._generateUIIcons();

        // 몬스터 스프라이트 생성
        this.images.monsters = {
            slime: this._generateMonsterSprite('slime', assets.monster_slime),
            wolf: this._generateMonsterSprite('wolf', assets.monster_wolf),
            goblin: this._generateMonsterSprite('goblin', assets.monster_goblin),
            skeleton: this._generateMonsterSprite('skeleton', assets.monster_skeleton),
            boss_ogre: this._generateMonsterSprite('boss_ogre', null), // 이미지 생성 한계로 절차적 드로잉 폴백
            squirrel: this._generateMonsterSprite('squirrel', assets.monster_squirrel),
        };

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
        });

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
        });

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
    _generateUIIcons() {
        const icons = {};

        // HP 아이콘 (빨간 하트)
        icons.hp = this._createSmallIcon(16, (ctx) => {
            ctx.fillStyle = '#ff4040';
            ctx.beginPath();
            ctx.arc(5, 5, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.arc(11, 5, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(1, 7); ctx.lineTo(8, 14); ctx.lineTo(15, 7);
            ctx.fill();
        });

        // MP 아이콘 (파란 마름모)
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

        // Gold 아이콘 (동전)
        icons.gold = this._createSmallIcon(16, (ctx) => {
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
        });

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
}

// 전역 에셋 매니저 인스턴스
const assetManager = new AssetManager();
