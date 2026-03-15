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
                { id: 'npc_guide', type: '길드마스터', name: '수련 안내자', x: 14, y: 12, dialog: '환영한다, 젊은 모험가여! 주변의 몬스터를 처치하고 경험을 쌓거라.' },
            ],
            // 포털 (맵 이동 지점)
            portals: [
                { x: 28, y: 15, targetMap: 'map_001', targetX: 1, targetY: 15, label: '→ 바람 마을' },
            ],
            // 몬스터 스폰 구역 (CombatManager 호환)
            monsterZones: [
                { type: 'slime', x: 3, y: 3, width: 10, height: 10, count: 20, level: 1 },
                { type: 'slime', x: 18, y: 3, width: 10, height: 10, count: 20, level: 1 },
                { type: 'goblin', x: 3, y: 18, width: 10, height: 10, count: 15, level: 2 },
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
                { id: 'npc_innkeeper', type: '주모', name: '주모 봉선', x: 12, y: 8, dialog: '이 곳은 바람 마을의 주막이란다. 여기서 쉬어가렴. HP가 완전 회복됩니다!' },
                { id: 'npc_smith', type: '대장장이', name: '대장장이 무쇠', x: 18, y: 14, dialog: '좋은 무기가 필요하면 나를 찾아라! 레벨이 오르면 더 강해진다.' },
                { id: 'npc_quiz', type: '길드마스터', name: '퀴즈 마스터', x: 12, y: 19, dialog: '지식의 시험을 받아보겠나? 정답 시 특별 보상이 있다네!' },
            ],
            portals: [
                { x: 0, y: 12, targetMap: 'map_000', targetX: 27, targetY: 15, label: '← 왕초보 사냥터' },
                { x: 24, y: 12, targetMap: 'map_002', targetX: 1, targetY: 15, label: '→ 풍림 사냥터' },
            ],
            monsterZones: [], // 마을은 안전 구역
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
            tiles: this._generateForestMap(),
            npcs: [
                { id: 'npc_hunter', type: '길드마스터', name: '사냥꾼 진', x: 3, y: 14, dialog: '이곳은 풍림 사냥터다. 늑대와 해골 전사를 조심하게!' },
            ],
            portals: [
                { x: 0, y: 15, targetMap: 'map_001', targetX: 23, targetY: 12, label: '← 바람 마을' },
            ],
            monsterZones: [
                { type: 'wolf', x: 8, y: 3, width: 12, height: 12, count: 25, level: 3 },
                { type: 'skeleton', x: 20, y: 5, width: 12, height: 12, count: 20, level: 4 },
                { type: 'wolf', x: 5, y: 20, width: 12, height: 12, count: 20, level: 3 },
                { type: 'goblin', x: 20, y: 20, width: 12, height: 12, count: 20, level: 3 },
            ],
        };

        return maps;
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
                        row.push(4); // 포털
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
                        row.push(4); // 서쪽 포털
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

        // 타일 렌더링
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const tileId = map.tiles[row][col];
                const screenX = col * this.TILE_SIZE - this.camera.x;
                const screenY = row * this.TILE_SIZE - this.camera.y;

                const tileImg = tileImages[tileId];
                if (tileImg) {
                    this.ctx.drawImage(tileImg, Math.floor(screenX), Math.floor(screenY));
                }
            }
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

        const tileId = this.currentMap.tiles[tileY][tileX];
        return !this.solidTiles.has(tileId);
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
