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
     * 모든 에셋을 생성/로드
     * @returns {Promise} 로드 완료 프로미스
     */
    async loadAll() {
        console.log('[AssetManager] 에셋 로드 시작...');

        const assets = {
            grass: await this.loadImage('/assets/rpg_grass_tile_1773292706481.png'),
            wall: await this.loadImage('/assets/rpg_wall_brick_1773292904200.png'),
            dirt: await this.loadImage('/assets/rpg_dirt_path_1773292888496.png'),
            portal: await this.loadImage('/assets/rpg_portal_1773292920194.png'),
            shop: await this.loadImage('/assets/rpg_shop_building_1773292762510.png'),
            warrior: await this.loadImage('/assets/rpg_player_sprite_1773292722977.png'),
            thief: await this.loadImage('/assets/rpg_thief_sprite_1773292975879.png'),
            mage: await this.loadImage('/assets/rpg_mage_sprite_1773292931497.png'),
            healer: await this.loadImage('/assets/rpg_poet_sprite_1773292988919.png'),
            monster_squirrel: await this.loadImage('/assets/rpg_monster_squirrel_1773292740316.png')
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
            slime: this._generateMonsterSprite('slime', assets.monster_squirrel),
            wolf: this._generateMonsterSprite('wolf', assets.monster_squirrel),
            goblin: this._generateMonsterSprite('goblin', assets.monster_squirrel),
            skeleton: this._generateMonsterSprite('skeleton', assets.monster_squirrel),
            boss_ogre: this._generateMonsterSprite('boss_ogre', assets.monster_squirrel),
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

        // 0: 풀밭 (이동 가능)
        tiles[0] = this._createTile((ctx) => {
            // 풀밭 배경
            ctx.fillStyle = '#3a7a3a';
            ctx.fillRect(0, 0, S, S);
            // 풀 질감 (랜덤 풀잎)
            const grassColors = ['#2e6e2e', '#4a8a4a', '#358535', '#408040'];
            for (let i = 0; i < 20; i++) {
                const gx = Math.floor(this._seededRandom(i * 3) * S);
                const gy = Math.floor(this._seededRandom(i * 3 + 1) * S);
                ctx.fillStyle = grassColors[i % grassColors.length];
                ctx.fillRect(gx, gy, 2, 3);
                // 풀잎 모양
                ctx.fillRect(gx - 1, gy - 1, 1, 2);
                ctx.fillRect(gx + 2, gy - 1, 1, 2);
            }
        }, assets.grass);

        // 1: 벽/바위 (이동 불가)
        tiles[1] = this._createTile((ctx) => {
            // 돌 벽 배경
            ctx.fillStyle = '#5a5a6a';
            ctx.fillRect(0, 0, S, S);
            // 돌 패턴
            ctx.fillStyle = '#6a6a7a';
            ctx.fillRect(1, 1, 14, 10);
            ctx.fillRect(17, 1, 14, 10);
            ctx.fillRect(1, 13, 10, 8);
            ctx.fillRect(13, 13, 10, 8);
            ctx.fillRect(25, 13, 6, 8);
            ctx.fillRect(1, 23, 14, 8);
            ctx.fillRect(17, 23, 14, 8);
            // 돌 사이 어두운 선
            ctx.fillStyle = '#4a4a5a';
            ctx.fillRect(0, 11, S, 2);
            ctx.fillRect(0, 21, S, 2);
            ctx.fillRect(15, 0, 2, 12);
            ctx.fillRect(11, 12, 2, 10);
            ctx.fillRect(23, 12, 2, 10);
            ctx.fillRect(15, 22, 2, 10);
            // 하이라이트
            ctx.fillStyle = '#7a7a8a';
            ctx.fillRect(2, 2, 12, 1);
            ctx.fillRect(18, 2, 12, 1);
        }, assets.wall);

        // 2: 흙길 (이동 가능)
        tiles[2] = this._createTile((ctx) => {
            ctx.fillStyle = '#8a7050';
            ctx.fillRect(0, 0, S, S);
            // 흙 질감
            const dirtColors = ['#7a6040', '#9a8060', '#806848'];
            for (let i = 0; i < 15; i++) {
                const dx = Math.floor(this._seededRandom(i * 5 + 100) * S);
                const dy = Math.floor(this._seededRandom(i * 5 + 101) * S);
                ctx.fillStyle = dirtColors[i % dirtColors.length];
                ctx.fillRect(dx, dy, 3, 2);
            }
        }, assets.dirt);

        // 3: 물 (이동 불가)
        tiles[3] = this._createTile((ctx) => {
            ctx.fillStyle = '#2050a0';
            ctx.fillRect(0, 0, S, S);
            // 물결 패턴
            ctx.fillStyle = '#3060b0';
            for (let y = 0; y < S; y += 6) {
                for (let x = 0; x < S; x += 4) {
                    const offset = (y % 12 === 0) ? 2 : 0;
                    ctx.fillRect(x + offset, y, 3, 2);
                }
            }
            ctx.fillStyle = '#4070c0';
            ctx.fillRect(4, 8, 5, 1);
            ctx.fillRect(18, 16, 6, 1);
            ctx.fillRect(10, 24, 4, 1);
        });

        // 4: 포털/계단 (맵 이동 트리거)
        tiles[4] = this._createTile((ctx) => {
            // 어두운 배경
            ctx.fillStyle = '#2a2a3a';
            ctx.fillRect(0, 0, S, S);
            // 소용돌이 포털 효과
            ctx.fillStyle = '#6040c0';
            ctx.beginPath();
            ctx.arc(16, 16, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#8060e0';
            ctx.beginPath();
            ctx.arc(16, 16, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#a080ff';
            ctx.beginPath();
            ctx.arc(16, 16, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#d0c0ff';
            ctx.beginPath();
            ctx.arc(16, 16, 2, 0, Math.PI * 2);
            ctx.fill();
        }, assets.portal);

        // 5: 나무 타일 바닥 (실내)
        tiles[5] = this._createTile((ctx) => {
            ctx.fillStyle = '#8a6840';
            ctx.fillRect(0, 0, S, S);
            // 나무결 패턴
            ctx.fillStyle = '#7a5830';
            for (let y = 0; y < S; y += 8) {
                ctx.fillRect(0, y, S, 1);
            }
            ctx.fillStyle = '#9a7850';
            ctx.fillRect(0, 3, S, 2);
            ctx.fillRect(0, 19, S, 2);
        });

        // 6: 나무 (이동 불가, 장식)
        tiles[6] = this._createTile((ctx) => {
            // 풀밭 배경
            ctx.fillStyle = '#3a7a3a';
            ctx.fillRect(0, 0, S, S);
            // 나무 기둥
            ctx.fillStyle = '#6a4a2a';
            ctx.fillRect(13, 18, 6, 14);
            // 나무 잎 (원형)
            ctx.fillStyle = '#2a6a2a';
            ctx.beginPath(); ctx.arc(16, 12, 11, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#3a8a3a';
            ctx.beginPath(); ctx.arc(14, 10, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4a9a4a';
            ctx.beginPath(); ctx.arc(18, 8, 5, 0, Math.PI * 2); ctx.fill();
        });

        // 7: 동굴 바닥 (이동 가능)
        tiles[7] = this._createTile((ctx) => {
            ctx.fillStyle = '#4a4050';
            ctx.fillRect(0, 0, S, S);
            const caveColors = ['#3a3040', '#5a5060', '#484058'];
            for (let i = 0; i < 12; i++) {
                const cx = Math.floor(this._seededRandom(i * 7 + 200) * S);
                const cy = Math.floor(this._seededRandom(i * 7 + 201) * S);
                ctx.fillStyle = caveColors[i % caveColors.length];
                ctx.fillRect(cx, cy, 4, 3);
            }
        });

        // 8: 동굴 벽 (이동 불가)
        tiles[8] = this._createTile((ctx) => {
            ctx.fillStyle = '#3a3040';
            ctx.fillRect(0, 0, S, S);
            ctx.fillStyle = '#4a4050';
            ctx.fillRect(2, 2, 12, 8);
            ctx.fillRect(18, 2, 12, 8);
            ctx.fillRect(2, 14, 8, 7);
            ctx.fillRect(14, 14, 8, 7);
            ctx.fillRect(26, 14, 4, 7);
            ctx.fillRect(2, 24, 12, 7);
            ctx.fillRect(18, 24, 12, 7);
            ctx.fillStyle = '#2a2030';
            ctx.fillRect(0, 10, S, 3);
            ctx.fillRect(0, 22, S, 2);
            ctx.fillRect(14, 0, 3, 12);
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
