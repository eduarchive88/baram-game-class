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

        // ===== 유령 모드 (사망 페널티) =====
        this.isDead = false;
        this.deathTimer = 0;           // 남은 부활 대기 시간 (초)
        this.DEATH_PENALTY_TIME = 60;  // 사망 페널티: 60초
        this.deathFadeAlpha = 0;       // 사망 시 페이드 효과

        // ===== 전투 이펙트 시스템 =====
        this.effects = [];  // [{ type, x, y, timer, duration, ... }]
    }

    /**
     * 플레이어 상태 실시간 저장
     */
    async saveUserData() {
        if (!this.uid) return;
        
        try {
            const data = {
                level: this.level,
                exp: this.exp,
                gold: this.gold,
                map: this.map || 'map_000',
                x: this.tileX,
                y: this.tileY,
                stats: {
                    hp: this.stats.hp,
                    maxHp: this.stats.maxHp,
                    mp: this.stats.mp,
                    maxMp: this.stats.maxMp,
                    atk: this.stats.atk,
                    def: this.stats.def
                },
                // 인벤토리 및 장비 정보 포함
                inventory: (typeof inventoryManager !== 'undefined') ? inventoryManager.items : [],
                equipment: (typeof inventoryManager !== 'undefined') ? inventoryManager.equipment : { weapon: null, armor: null, accessory: null },
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            };

            // 1. 전역 유저 데이터 저장
            await rtdb.ref(`userData/${this.uid}`).update(data);
            
            // 2. 현재 세션 내 데이터 백업 (교사 확인용)
            if (typeof networkManager !== 'undefined' && networkManager.sessionCode) {
                await rtdb.ref(`sessions/${networkManager.sessionCode}/users/${this.uid}`).update(data);
            }
            
            console.log(`[Player] ${this.nickname} 데이터 저장 완료`);
        } catch (err) {
            console.error('[Player] 데이터 저장 오류:', err);
        }
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
        // ===== 이펙트 타이머 업데이트 =====
        this.effects = this.effects.filter(e => {
            e.timer += dt;
            return e.timer < e.duration;
        });

        // ===== 유령 모드 처리 =====
        if (this.isDead) {
            this.deathTimer -= dt;
            this.deathFadeAlpha = Math.min(1, this.deathFadeAlpha + dt * 2);

            // 유령 상태에서도 이동은 가능
            if (this.isMoving) {
                this._smoothMove(dt);
                this._updateAnimation(dt);
            } else if (this.moveCooldown > 0) {
                this.moveCooldown -= dt;
            } else if (input && input.direction) {
                this.direction = input.direction;
                this._tryMove(input.direction, map);
            } else {
                this.animFrame = 0;
            }

            // 부활 타이머 만료 → 부활
            if (this.deathTimer <= 0) {
                this._respawn();
            }
            return; // 유령 상태에서는 공격/스킬 불가
        }

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
        if (input && input.direction) {
            this.direction = input.direction;
            this._tryMove(input.direction, map);
        } else {
            // 정지 시 idle 애니메이션 (프레임 0)
            this.animFrame = 0;
        }

        // 공격 입력 처리
        if (input && input.actionPressed && !this.isAttacking) {
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
        this.attackTimer = 0.3;

        // 공격 이펙트 생성 (방향에 따라 슬래시)
        const offsets = { up: [0, -32], down: [0, 32], left: [-32, 0], right: [32, 0] };
        const [ox, oy] = offsets[this.direction] || [0, 32];
        this._spawnSlashEffect(this.x + ox, this.y + oy, this.direction);

        setTimeout(() => {
            this.isAttacking = false;
        }, 300);
    }

    /**
     * NPC 인터랙션
     */
    _interactNPC(npc) {
        console.log(`[Player] NPC 대화: ${npc.name} - "${npc.dialog}"`);
        if (window.gameUI) {
            window.gameUI.showDialog(npc.name, npc.dialog);
        }
    }

    // ===== 사망 / 부활 시스템 =====

    /**
     * 사망 처리 (HP가 0이 되었을 때 CombatManager에서 호출)
     */
    async die() {
        if (this.isDead) return;
        this.isDead = true;
        this.isAlive = false;
        this.deathTimer = this.DEATH_PENALTY_TIME;
        this.deathFadeAlpha = 0;
        this.isAttacking = false;
        
        console.log(`[Player] ${this.nickname} 사망! ${this.DEATH_PENALTY_TIME}초 후 부활`);
        
        // 사망 상태 저장
        await this.saveUserData();
    }

    /**
     * 부활 처리
     */
    async _respawn() {
        this.isDead = false;
        this.isAlive = true;
        this.stats.hp = Math.floor(this.stats.maxHp * 0.3); // HP 30%로 부활
        this.stats.mp = Math.floor(this.stats.maxMp * 0.3); // MP 30%로 부활
        this.deathFadeAlpha = 0;

        // 부활 이펙트
        this._spawnReviveEffect();
        console.log(`[Player] ${this.nickname} 부활!`);
        
        // 부활 상태 저장
        await this.saveUserData();
    }

    // ===== 이펙트 생성 헬퍼 =====

    /**
     * 직업별 고유 평타 이펙트 (각 직업마다 색상/형태/파티클이 다름)
     */
    _spawnSlashEffect(x, y, dir) {
        const job = this.job;

        // 직업별 색상 및 형태 정의
        const jobEffects = {
            '전사': { color: '#FF6B35', glow: '#FFA500', type: 'heavy_slash', particles: 8, pSize: 3 },
            '도적': { color: '#C77DFF', glow: '#9D4EDD', type: 'quick_slash', particles: 6, pSize: 2 },
            '주술사': { color: '#7B68EE', glow: '#6A5ACD', type: 'magic_wave', particles: 10, pSize: 2 },
            '도사': { color: '#00E676', glow: '#69F0AE', type: 'chi_burst', particles: 12, pSize: 2 },
        };
        const fx = jobEffects[job] || jobEffects['전사'];

        // 메인 슬래시 이펙트
        this.effects.push({
            type: fx.type, x, y, dir,
            timer: 0, duration: 0.4,
            color: fx.color, glow: fx.glow,
        });

        // 직업별 파티클 패턴
        for (let i = 0; i < fx.particles; i++) {
            const angle = (Math.PI * 2 / fx.particles) * i;
            const spread = job === '전사' ? 30 : job === '도적' ? 20 : 15;
            this.effects.push({
                type: 'particle',
                x: x + (Math.random() - 0.5) * spread,
                y: y + (Math.random() - 0.5) * spread,
                vx: Math.cos(angle) * (50 + Math.random() * 40),
                vy: Math.sin(angle) * (50 + Math.random() * 40) - 20,
                timer: 0, duration: 0.35 + Math.random() * 0.15,
                color: fx.color, size: fx.pSize + Math.random() * 2,
            });
        }

        // 도적 전용: 잔상(2중 슬래시)
        if (job === '도적') {
            setTimeout(() => {
                this.effects.push({
                    type: 'quick_slash', x: x + 4, y: y - 4, dir,
                    timer: 0, duration: 0.3,
                    color: '#E0AAFF', glow: '#C77DFF',
                });
            }, 80);
        }

        // 주술사 전용: 마법진 링
        if (job === '주술사') {
            this.effects.push({
                type: 'magic_circle', x, y,
                timer: 0, duration: 0.5,
                color: '#7B68EE',
            });
        }

        // 도사 전용: 기 파동 링
        if (job === '도사') {
            this.effects.push({
                type: 'chi_ring', x, y,
                timer: 0, duration: 0.5,
                color: '#00E676',
            });
        }
    }

    /**
     * 스킬 시전 이펙트 (외부에서 호출 가능)
     * @param {string} skillType - 'magic', 'heal', 'buff', 'aoe'
     * @param {string} color - 이펙트 색상
     */
    spawnSkillEffect(skillType, color) {
        const cx = this.x;
        const cy = this.y;

        switch (skillType) {
            case 'magic': {
                // 전방 마법 발사체
                const offsets = { up: [0, -40], down: [0, 40], left: [-40, 0], right: [40, 0] };
                const [ox, oy] = offsets[this.direction] || [0, 40];
                this.effects.push({
                    type: 'magic_bolt', x: cx + ox, y: cy + oy,
                    timer: 0, duration: 0.5, color: color || '#c080ff',
                });
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i;
                    this.effects.push({
                        type: 'particle',
                        x: cx + ox + Math.cos(angle) * 8,
                        y: cy + oy + Math.sin(angle) * 8,
                        vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60,
                        timer: 0, duration: 0.5,
                        color: color || '#c080ff', size: 2,
                    });
                }
                break;
            }
            case 'heal': {
                // 회복 빛기둥 + 반짝이
                this.effects.push({
                    type: 'heal_pillar', x: cx, y: cy,
                    timer: 0, duration: 0.8, color: color || '#80ff80',
                });
                for (let i = 0; i < 12; i++) {
                    this.effects.push({
                        type: 'particle',
                        x: cx + (Math.random() - 0.5) * 24,
                        y: cy + (Math.random() - 0.5) * 24,
                        vx: (Math.random() - 0.5) * 30,
                        vy: -40 - Math.random() * 60,
                        timer: 0, duration: 0.6 + Math.random() * 0.3,
                        color: color || '#80ff80', size: 2 + Math.random() * 2,
                    });
                }
                break;
            }
            case 'buff': {
                // 버프 원형 파동
                this.effects.push({
                    type: 'buff_ring', x: cx, y: cy,
                    timer: 0, duration: 0.6, color: color || '#80d0ff',
                });
                break;
            }
            case 'aoe': {
                // 광역 폭발
                this.effects.push({
                    type: 'aoe_explosion', x: cx, y: cy,
                    timer: 0, duration: 0.7, color: color || '#ff8040',
                });
                for (let i = 0; i < 16; i++) {
                    const angle = (Math.PI * 2 / 16) * i;
                    this.effects.push({
                        type: 'particle',
                        x: cx + Math.cos(angle) * 12,
                        y: cy + Math.sin(angle) * 12,
                        vx: Math.cos(angle) * 100, vy: Math.sin(angle) * 100,
                        timer: 0, duration: 0.5,
                        color: color || '#ff8040', size: 3,
                    });
                }
                break;
            }
        }
    }

    /**
     * 부활 이펙트
     */
    _spawnReviveEffect() {
        this.effects.push({
            type: 'heal_pillar', x: this.x, y: this.y,
            timer: 0, duration: 1.0, color: '#FFD700',
        });
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 / 20) * i;
            this.effects.push({
                type: 'particle',
                x: this.x + Math.cos(angle) * 16,
                y: this.y + Math.sin(angle) * 16,
                vx: Math.cos(angle) * 50, vy: -60 - Math.random() * 40,
                timer: 0, duration: 0.8,
                color: '#FFD700', size: 3,
            });
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

        ctx.save();

        // ===== 유령 모드 렌더링 =====
        if (this.isDead) {
            ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 300) * 0.15; // 깜빡이는 반투명
        }

        // 캐릭터 스프라이트 렌더링
        const charSprites = assetManager.images.characters[this.job];
        if (charSprites) {
            const dirFrames = charSprites[this.direction];
            if (dirFrames && dirFrames[this.animFrame]) {
                ctx.drawImage(dirFrames[this.animFrame], Math.floor(screenX), Math.floor(screenY));
            }
        }

        ctx.restore();

        // ===== 이펙트 렌더링 =====
        this._renderEffects(ctx, camera);

        // ===== 유령 상태 표시 =====
        if (this.isDead) {
            ctx.save();
            // 유령 아이콘 (크기 확대 및 그림자 추가)
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(255, 0, 0, 0.6)';
            ctx.shadowBlur = 10;
            ctx.fillText('👻', screenX + 16, screenY - 18);

            // 부활 타이머
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "Noto Sans KR", sans-serif';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            const timerText = `부활 ${Math.ceil(this.deathTimer)}초`;
            ctx.strokeText(timerText, screenX + 16, screenY - 6);
            ctx.fillStyle = '#ff8080';
            ctx.fillText(timerText, screenX + 16, screenY - 6);
            ctx.restore();
            return; // 유령 상태에서는 HP바/닉네임 생략
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
     * 전투 이펙트 렌더링 (슬래시, 파티클, 마법, 힐, 버프, AOE)
     */
    _renderEffects(ctx, camera) {
        this.effects.forEach(e => {
            const sx = e.x - camera.x;
            const sy = e.y - camera.y;
            const progress = e.timer / e.duration;

            ctx.save();

            switch (e.type) {
                case 'slash':
                case 'heavy_slash': {
                    // 전사: 무거운 대검 슬래시
                    const alpha = 1 - progress;
                    ctx.globalAlpha = alpha * 0.9;
                    ctx.strokeStyle = e.color;
                    ctx.lineWidth = 4;
                    ctx.shadowColor = e.glow || e.color;
                    ctx.shadowBlur = 15;

                    const startAngle = { up: Math.PI, down: 0, left: Math.PI / 2, right: -Math.PI / 2 };
                    const angle = startAngle[e.dir] || 0;
                    const sweep = Math.PI * progress * 1.5;
                    const radius = 14 + progress * 12;

                    // 이중 슬래시 아크
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius, angle - sweep / 2, angle + sweep / 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius * 0.7, angle - sweep / 2.5, angle + sweep / 2.5);
                    ctx.stroke();

                    // 충격파 채움
                    ctx.globalAlpha = alpha * 0.25;
                    ctx.fillStyle = e.color;
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius * 0.5, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                case 'quick_slash': {
                    // 도적: 빠른 연속 베기
                    const alpha = 1 - progress;
                    ctx.globalAlpha = alpha * 0.85;
                    ctx.strokeStyle = e.color;
                    ctx.lineWidth = 2;
                    ctx.shadowColor = e.glow || e.color;
                    ctx.shadowBlur = 10;

                    // X자 크로스 슬래시
                    const len = 10 + progress * 14;
                    ctx.beginPath();
                    ctx.moveTo(sx - len, sy - len);
                    ctx.lineTo(sx + len, sy + len);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(sx + len, sy - len);
                    ctx.lineTo(sx - len, sy + len);
                    ctx.stroke();

                    // 중심 스파크
                    ctx.globalAlpha = alpha * 0.6;
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(sx, sy, 3 * (1 - progress), 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                case 'magic_wave': {
                    // 주술사: 마법 파동
                    const alpha = 1 - progress;
                    const radius = 6 + progress * 18;
                    ctx.globalAlpha = alpha * 0.7;
                    ctx.fillStyle = e.color;
                    ctx.shadowColor = e.glow || e.color;
                    ctx.shadowBlur = 20;

                    // 펄싱 오브
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius * (0.8 + Math.sin(progress * Math.PI * 3) * 0.2), 0, Math.PI * 2);
                    ctx.fill();

                    // 외곽 글로우
                    ctx.globalAlpha = alpha * 0.3;
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius + 5, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }
                case 'chi_burst': {
                    // 도사: 기 파동 폭발
                    const alpha = 1 - progress;
                    ctx.globalAlpha = alpha * 0.6;

                    // 기 파동 링 확산
                    const r1 = 8 + progress * 22;
                    const r2 = 4 + progress * 14;
                    ctx.strokeStyle = e.color;
                    ctx.lineWidth = 3;
                    ctx.shadowColor = e.glow || e.color;
                    ctx.shadowBlur = 15;
                    ctx.beginPath();
                    ctx.arc(sx, sy, r1, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(sx, sy, r2, 0, Math.PI * 2);
                    ctx.stroke();

                    // 중심 빛
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(sx, sy, 4 * (1 - progress), 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                case 'magic_circle': {
                    // 주술사 전용 마법진
                    const alpha = (1 - progress) * 0.5;
                    const r = 16 + progress * 8;
                    ctx.globalAlpha = alpha;
                    ctx.strokeStyle = e.color;
                    ctx.lineWidth = 1;
                    ctx.shadowColor = e.color;
                    ctx.shadowBlur = 8;
                    // 회전하는 마법진
                    const rot = progress * Math.PI * 4;
                    for (let i = 0; i < 6; i++) {
                        const a = (Math.PI * 2 / 6) * i + rot;
                        ctx.beginPath();
                        ctx.moveTo(sx + Math.cos(a) * r * 0.4, sy + Math.sin(a) * r * 0.4);
                        ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
                        ctx.stroke();
                    }
                    ctx.beginPath();
                    ctx.arc(sx, sy, r, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }
                case 'chi_ring': {
                    // 도사 전용 기 파동 링
                    const alpha = (1 - progress) * 0.6;
                    const r = 10 + progress * 20;
                    ctx.globalAlpha = alpha;
                    ctx.strokeStyle = e.color;
                    ctx.lineWidth = 2;
                    ctx.shadowColor = e.color;
                    ctx.shadowBlur = 10;
                    // 이중 링
                    ctx.beginPath();
                    ctx.arc(sx, sy, r, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(sx, sy, r * 0.6, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }
                case 'particle': {
                    // 이동하는 작은 파티클
                    const px = sx + (e.vx || 0) * e.timer;
                    const py = sy + (e.vy || 0) * e.timer;
                    const alpha = 1 - progress;
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = e.color;
                    ctx.shadowColor = e.color;
                    ctx.shadowBlur = 6;
                    ctx.beginPath();
                    ctx.arc(px, py, (e.size || 2) * (1 - progress * 0.5), 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                case 'magic_bolt': {
                    // 마법 구체
                    const alpha = 1 - progress;
                    const radius = 8 + Math.sin(progress * Math.PI) * 6;
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = e.color;
                    ctx.shadowColor = e.color;
                    ctx.shadowBlur = 20;
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
                    ctx.fill();

                    // 외곽 글로우 링
                    ctx.globalAlpha = alpha * 0.4;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius + 4, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }
                case 'heal_pillar': {
                    // 치유 빛기둥
                    const alpha = (1 - progress) * 0.6;
                    const h = 40 * (1 - progress * 0.3);
                    ctx.globalAlpha = alpha;

                    const gradient = ctx.createLinearGradient(sx, sy - h, sx, sy + 8);
                    gradient.addColorStop(0, 'transparent');
                    gradient.addColorStop(0.3, e.color);
                    gradient.addColorStop(1, 'transparent');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(sx - 6, sy - h, 12, h + 8);

                    // 중심 밝은 점
                    ctx.globalAlpha = alpha * 1.5;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(sx, sy - h * 0.5, 3, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                case 'buff_ring': {
                    // 바닥에서 확장되는 링
                    const radius = 6 + progress * 28;
                    const alpha = (1 - progress) * 0.7;
                    ctx.globalAlpha = alpha;
                    ctx.strokeStyle = e.color;
                    ctx.lineWidth = 2;
                    ctx.shadowColor = e.color;
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }
                case 'aoe_explosion': {
                    // 광역 폭발 원
                    const maxR = 48;
                    const radius = progress * maxR;
                    const alpha = (1 - progress) * 0.5;

                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = e.color;
                    ctx.shadowColor = e.color;
                    ctx.shadowBlur = 25;
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
                    ctx.fill();

                    // 내부 링
                    ctx.globalAlpha = alpha * 0.8;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius * 0.7, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }
            }

            ctx.restore();
        });
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
