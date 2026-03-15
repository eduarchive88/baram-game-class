/**
 * Monster.js - 몬스터 엔티티 + 기본 AI
 * 바람의 나라 교육용 RPG - 필드 몬스터 스폰, 배회, 전투 트리거
 */

class Monster {
    /**
     * @param {Object} config - 몬스터 설정
     * @param {string} config.id - 고유 ID
     * @param {string} config.name - 이름
     * @param {string} config.type - 타입 (slime, wolf, boss 등)
     * @param {number} config.tileX - 스폰 타일 X
     * @param {number} config.tileY - 스폰 타일 Y
     * @param {number} config.level - 레벨
     * @param {Object} config.stats - 스탯 { hp, maxHp, atk, def, exp, gold }
     */
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.type = config.type || 'slime';
        this.level = config.level || 1;

        // 스폰 위치 (원점)
        this.spawnTileX = config.tileX;
        this.spawnTileY = config.tileY;

        // 현재 위치 (타일 좌표)
        this.tileX = config.tileX;
        this.tileY = config.tileY;

        // 렌더링 위치 (픽셀, 부드러운 이동용)
        this.x = config.tileX * 32;
        this.y = config.tileY * 32;
        this.targetX = this.x;
        this.targetY = this.y;

        // 스탯
        this.stats = {
            hp: config.stats?.hp || 50,
            maxHp: config.stats?.maxHp || 50,
            atk: config.stats?.atk || 8,
            def: config.stats?.def || 2,
            exp: config.stats?.exp || 20,
            gold: config.stats?.gold || 10,
        };

        // AI 상태
        this.state = 'idle'; // idle, roaming, chasing, attacking, dead
        this.aiTimer = Math.random() * 0.5; // 행동 타이머 (랜덤 오프셋)
        this.AI_THINK_INTERVAL = 0.5 + Math.random() * 1.0; // 0.5~1.5초마다 행동 (더 자주)
        this.roamRange = config.roamRange || 4; // 스폰에서 배회 가능 범위
        this.aggroRange = config.aggroRange || 5; // 어그로 감지 범위 (타일)
        this.isMoving = false;

        // 방향
        this.direction = 'down';

        // 애니메이션
        this.animFrame = 0;
        this.animTimer = 0;

        // 피격 효과
        this.hitFlash = 0;

        // 죽음 타이머 (사라지기까지)
        this.deathTimer = 0;
        this.RESPAWN_TIME = 0.8; // 0.8초 후 리스폰 (상향 조정)
    }

    /**
     * 매 프레임 업데이트
     * @param {number} dt - 델타 타임
     * @param {MapManager} map - 맵 관리자
     * @param {Player} player - 로컬 플레이어 (어그로 판정용)
     */
    update(dt, map, player) {
        if (this.state === 'dead') {
            this.deathTimer += dt;
            if (this.deathTimer >= this.RESPAWN_TIME) {
                this._respawn();
            }
            return;
        }

        // 피격 효과 감소
        if (this.hitFlash > 0) this.hitFlash -= dt * 4;

        // 부드러운 이동
        if (this.isMoving) {
            this._smoothMove(dt);
        }

        // AI 로직
        this.aiTimer += dt;
        if (this.aiTimer >= this.AI_THINK_INTERVAL && !this.isMoving) {
            this.aiTimer = 0;
            this._think(map, player);
        }

        // 걷기 애니메이션
        if (this.isMoving) {
            this.animTimer += dt;
            if (this.animTimer >= 0.2) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % 4;
            }
        }
    }

    /**
     * AI 사고 로직
     */
    _think(map, player) {
        // 플레이어와의 거리 계산
        const dx = player.tileX - this.tileX;
        const dy = player.tileY - this.tileY;
        const dist = Math.abs(dx) + Math.abs(dy); // 맨해튼 거리

        if (dist <= this.aggroRange && dist > 1) {
            // 어그로 범위 내: 플레이어를 향해 이동
            this.state = 'chasing';
            this._moveTowards(dx, dy, map);
        } else if (dist <= 1) {
            // 인접: 공격 대기 (전투는 CombatManager가 처리)
            this.state = 'attacking';
            // 플레이어 방향 바라보기
            if (Math.abs(dx) > Math.abs(dy)) {
                this.direction = dx > 0 ? 'right' : 'left';
            } else {
                this.direction = dy > 0 ? 'down' : 'up';
            }
        } else {
            // 평화 상태: 랜덤 배회
            this.state = 'roaming';
            this._randomRoam(map);
        }
    }

    /**
     * 플레이어를 향해 1타일 이동
     */
    _moveTowards(dx, dy, map) {
        // 주 방향으로 이동 시도
        let moved = false;
        if (Math.abs(dx) >= Math.abs(dy)) {
            // X 방향 우선
            const dir = dx > 0 ? 'right' : 'left';
            moved = this._tryMove(dir, map);
            if (!moved) {
                // 보조 방향 시도
                const altDir = dy > 0 ? 'down' : 'up';
                moved = this._tryMove(altDir, map);
            }
        } else {
            // Y 방향 우선
            const dir = dy > 0 ? 'down' : 'up';
            moved = this._tryMove(dir, map);
            if (!moved) {
                const altDir = dx > 0 ? 'right' : 'left';
                moved = this._tryMove(altDir, map);
            }
        }
    }

    /**
     * 랜덤 배회 (스폰 범위 내)
     */
    _randomRoam(map) {
        const dirs = ['up', 'down', 'left', 'right'];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        this._tryMove(dir, map);
    }

    /**
     * 지정 방향으로 1타일 이동 시도
     */
    _tryMove(dir, map) {
        const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const [ox, oy] = offsets[dir];
        const newX = this.tileX + ox;
        const newY = this.tileY + oy;

        // 스폰 범위 체크
        if (Math.abs(newX - this.spawnTileX) > this.roamRange ||
            Math.abs(newY - this.spawnTileY) > this.roamRange) {
            return false;
        }

        // 이동 가능 체크
        if (!map.isWalkable(newX, newY)) return false;

        this.direction = dir;
        this.tileX = newX;
        this.tileY = newY;
        this.targetX = newX * 32;
        this.targetY = newY * 32;
        this.isMoving = true;
        return true;
    }

    /**
     * 부드러운 이동 보간
     */
    _smoothMove(dt) {
        const speed = 64; // 픽셀/초
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 1) {
            this.x = this.targetX;
            this.y = this.targetY;
            this.isMoving = false;
        } else {
            const step = speed * dt;
            this.x += (dx / dist) * Math.min(step, dist);
            this.y += (dy / dist) * Math.min(step, dist);
        }
    }

    /**
     * 피격 처리
     * @param {number} damage - 받는 데미지
     * @returns {boolean} 사망 여부
     */
    takeDamage(damage) {
        const actualDmg = Math.max(1, damage - this.stats.def);
        this.stats.hp -= actualDmg;
        this.hitFlash = 1.0;

        if (this.stats.hp <= 0) {
            this.stats.hp = 0;
            this.state = 'dead';
            this.deathTimer = 0;
            return true; // 사망
        }
        return false;
    }

    /**
     * 리스폰
     */
    _respawn() {
        this.tileX = this.spawnTileX;
        this.tileY = this.spawnTileY;
        this.x = this.spawnTileX * 32;
        this.y = this.spawnTileY * 32;
        this.targetX = this.x;
        this.targetY = this.y;
        this.stats.hp = this.stats.maxHp;
        this.state = 'idle';
        this.deathTimer = 0;
        this.hitFlash = 0;
        this.aiTimer = Math.random() * 1; // 리스폰 후 더 빨리 행동 유도
        console.log(`[Monster] ${this.name} 리스폰`);
    }

    /**
     * 렌더링
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera - 카메라 { x, y }
     */
    render(ctx, camera) {
        if (this.state === 'dead') return;

        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // 화면 밖이면 스킵
        if (screenX < -32 || screenX > ctx.canvas.width + 32 ||
            screenY < -32 || screenY > ctx.canvas.height + 32) return;

        ctx.save();

        // 피격 플래시 효과
        if (this.hitFlash > 0) {
            ctx.globalAlpha = 0.5 + Math.sin(this.hitFlash * 20) * 0.5;
        }

        // 몬스터 스프라이트 (AssetManager에서 제공)
        const sprite = assetManager.getMonsterSprite(this.type, this.animFrame);
        if (sprite) {
            ctx.drawImage(sprite, screenX, screenY, 32, 32);
        } else {
            // 폴백: 타입별 기본 도형
            this._renderFallback(ctx, screenX, screenY);
        }

        ctx.globalAlpha = 1.0;

        // 이름 표시
        ctx.font = 'bold 9px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillText(this.name, screenX + 17, screenY - 7);
        ctx.fillStyle = '#ff8080';
        ctx.fillText(this.name, screenX + 16, screenY - 8);

        // HP 바
        const barW = 28;
        const barH = 3;
        const barX = screenX + 2;
        const barY = screenY - 3;
        const ratio = this.stats.hp / this.stats.maxHp;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = ratio > 0.5 ? '#e04040' : '#ff2020';
        ctx.fillRect(barX, barY, barW * ratio, barH);

        ctx.restore();
    }

    /**
     * 폴백 렌더링 (스프라이트 없을 때)
     */
    _renderFallback(ctx, sx, sy) {
        const colors = {
            slime: '#40c040', wolf: '#808080', goblin: '#c09040',
            skeleton: '#d0d0d0', boss_ogre: '#c04040'
        };
        const color = colors[this.type] || '#40c040';

        // 몸체
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(sx + 16, sy + 20, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // 눈
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + 11, sy + 16, 4, 4);
        ctx.fillRect(sx + 19, sy + 16, 4, 4);
        ctx.fillStyle = '#000';
        ctx.fillRect(sx + 12, sy + 17, 2, 2);
        ctx.fillRect(sx + 20, sy + 17, 2, 2);
    }
}
