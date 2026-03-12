/**
 * Player.js - 로컬 플레이어 엔티티
 * 바람의 나라 교육용 RPG - 캐릭터 이동, 애니메이션, 상태 관리
 */

class Player {
    constructor(nickname, job, uid) {
        // 기본 정보
        this.nickname = nickname;
        this.job = job;
        this.uid = uid;

        // 위치 (타일 좌표)
        this.tileX = 15;
        this.tileY = 15;

        // 위치 (픽셀 좌표 - 부드러운 이동용)
        this.x = this.tileX * 32 + 16;
        this.y = this.tileY * 32 + 16;

        // 이동 목표 (픽셀 좌표)
        this.targetX = this.x;
        this.targetY = this.y;

        // 방향 (초기: 아래)
        this.direction = 'down';

        // 이동 상태
        this.isMoving = false;
        this.moveSpeed = 120; // 픽셀/초

        // 이동 쿨다운 (타일 기반 이동에서 다음 타일로의 전환 제어)
        this.moveCooldown = 0;
        this.MOVE_COOLDOWN_TIME = 0.18; // 초

        // 애니메이션
        this.animFrame = 0;
        this.animTimer = 0;
        this.ANIM_SPEED = 0.15; // 프레임당 시간 (초)

        // 스탯 (PRD 기준 직업별 초기값)
        this.stats = this._getInitialStats(job);
        this.level = 1;
        this.exp = 0;
        this.gold = 0;

        // 장비 슬롯 (InventoryManager와 동기화)
        this.equipment = {
            weapon: null,
            armor: null,
            accessory: null,
        };

        // 스킬 및 버프 시스템
        this.learnedSkills = [];
        this.activeBuffs = [];

        // 상태
        this.isAlive = true;
        this.isAttacking = false;
        this.attackTimer = 0;
    }

    /**
     * 장비 및 버프 보너스를 포함한 실제 스탯 계산
     * @returns {Object} { atk, def, ... }
     */
    getEffectiveStats() {
        const base = { ...this.stats };
        // 장비 보너스 합산
        Object.values(this.equipment).forEach(itemId => {
            if (!itemId) return;
            const item = shopManager ? shopManager.getItem(itemId) : null;
            if (item) {
                if (item.atk) base.atk += item.atk;
                if (item.def) base.def += item.def;
            }
        });

        // 버프 보너스 합산
        if (typeof skillManager !== 'undefined') {
            const buffBonus = skillManager.getBuffBonus();
            if (buffBonus.atk) base.atk += buffBonus.atk;
            if (buffBonus.def) base.def += buffBonus.def;
        }

        return base;
    }

    /**
     * 직업별 초기 스탯 (PRD Section 10 기준)
     */
    _getInitialStats(job) {
        const statTable = {
            '전사': { maxHp: 150, maxMp: 30, hp: 150, mp: 30, atk: 12, def: 10, speed: 80, magic: 3 },
            '도적': { maxHp: 100, maxMp: 50, hp: 100, mp: 50, atk: 10, def: 6, speed: 130, magic: 5 },
            '주술사': { maxHp: 80, maxMp: 120, hp: 80, mp: 120, atk: 5, def: 4, speed: 90, magic: 15 },
            '도사': { maxHp: 90, maxMp: 100, hp: 90, mp: 100, atk: 6, def: 5, speed: 100, magic: 12 },
        };
        return statTable[job] || statTable['전사'];
    }

    /**
     * 매 프레임 업데이트
     * @param {number} dt - 델타 타임 (초)
     * @param {InputManager} input - 입력 관리자
     * @param {MapManager} map - 맵 관리자
     */
    update(dt, input, map) {
        // 이동 중이면 목표까지 부드럽게 보간
        if (this.isMoving) {
            this._smoothMove(dt);
            this._updateAnimation(dt);
            return;
        }

        // 이동 쿨다운
        if (this.moveCooldown > 0) {
            this.moveCooldown -= dt;
            return;
        }

        // 입력 방향이 있으면 이동 시도
        if (input.direction) {
            this.direction = input.direction;
            this._tryMove(input.direction, map);
        } else {
            // 정지 시 idle 애니메이션 (프레임 0)
            this.animFrame = 0;
        }

        // 공격 입력 처리
        if (input.actionPressed && !this.isAttacking) {
            this._attack();
        }
    }

    /**
     * 이동 시도 (타일 기반)
     */
    _tryMove(direction, map) {
        let newTileX = this.tileX;
        let newTileY = this.tileY;

        switch (direction) {
            case 'up': newTileY--; break;
            case 'down': newTileY++; break;
            case 'left': newTileX--; break;
            case 'right': newTileX++; break;
        }

        // 충돌 검사
        if (map.isWalkable(newTileX, newTileY)) {
            // NPC 충돌 검사 (NPC 위치로는 이동 불가)
            const npc = map.checkNPC(newTileX, newTileY);
            if (npc) {
                // NPC와 대화 (이동하지 않음)
                this._interactNPC(npc);
                return;
            }

            // 이동 시작
            this.tileX = newTileX;
            this.tileY = newTileY;
            this.targetX = newTileX * 32 + 16;
            this.targetY = newTileY * 32 + 16;
            this.isMoving = true;
            this.moveCooldown = this.MOVE_COOLDOWN_TIME;
        }
    }

    /**
     * 부드러운 이동 보간
     */
    _smoothMove(dt) {
        const speed = this.moveSpeed;
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) {
            // 도착
            this.x = this.targetX;
            this.y = this.targetY;
            this.isMoving = false;
        } else {
            // 보간 이동
            this.x += (dx / dist) * speed * dt;
            this.y += (dy / dist) * speed * dt;
        }
    }

    /**
     * 걷기 애니메이션 업데이트
     */
    _updateAnimation(dt) {
        this.animTimer += dt;
        if (this.animTimer >= this.ANIM_SPEED) {
            this.animTimer -= this.ANIM_SPEED;
            this.animFrame = (this.animFrame + 1) % 4;
        }
    }

    /**
     * 공격 액션
     */
    _attack() {
        this.isAttacking = true;
        this.attackTimer = 0.3; // 공격 모션 시간

        // 공격 범위 앞 타일의 몬스터 감지 (Phase 3에서 구현)
        console.log(`[Player] ${this.nickname} 공격! 방향: ${this.direction}`);

        setTimeout(() => {
            this.isAttacking = false;
        }, 300);
    }

    /**
     * NPC 인터랙션
     */
    _interactNPC(npc) {
        console.log(`[Player] NPC 대화: ${npc.name} - "${npc.dialog}"`);
        // 대화 UI 이벤트 발생
        if (window.gameUI) {
            window.gameUI.showDialog(npc.name, npc.dialog);
        }
    }

    /**
     * 렌더링
     * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
     * @param {Object} camera - 카메라 { x, y }
     */
    render(ctx, camera) {
        if (!assetManager.loaded) return;

        const screenX = this.x - 16 - camera.x;
        const screenY = this.y - 16 - camera.y;

        // 캐릭터 스프라이트 렌더링
        const charSprites = assetManager.images.characters[this.job];
        if (charSprites) {
            const dirFrames = charSprites[this.direction];
            if (dirFrames && dirFrames[this.animFrame]) {
                ctx.drawImage(dirFrames[this.animFrame], Math.floor(screenX), Math.floor(screenY));
            }
        }

        // 공격 이펙트 (간단한 슬래시)
        if (this.isAttacking) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#FFD700';
            let atkX = screenX + 16, atkY = screenY + 16;
            switch (this.direction) {
                case 'up': atkY -= 28; break;
                case 'down': atkY += 28; break;
                case 'left': atkX -= 28; break;
                case 'right': atkX += 28; break;
            }
            ctx.beginPath();
            ctx.arc(atkX, atkY, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 닉네임 표시
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeText(this.nickname, screenX + 16, screenY - 6);
        ctx.fillText(this.nickname, screenX + 16, screenY - 6);
        ctx.restore();

        // HP 바 표시
        this._renderHPBar(ctx, screenX, screenY);
    }

    /**
     * HP 바 렌더링
     */
    _renderHPBar(ctx, screenX, screenY) {
        const barW = 28;
        const barH = 3;
        const barX = screenX + 2;
        const barY = screenY - 2;
        const hpRatio = this.stats.hp / this.stats.maxHp;

        // 배경
        ctx.fillStyle = '#300000';
        ctx.fillRect(barX, barY, barW, barH);
        // HP 채움
        ctx.fillStyle = hpRatio > 0.5 ? '#40c040' : hpRatio > 0.25 ? '#c0c040' : '#c04040';
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
        // 테두리
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
    }

    /**
     * 포털 이동 시 위치 설정
     */
    setPosition(tileX, tileY) {
        this.tileX = tileX;
        this.tileY = tileY;
        this.x = tileX * 32 + 16;
        this.y = tileY * 32 + 16;
        this.targetX = this.x;
        this.targetY = this.y;
        this.isMoving = false;
    }
}
