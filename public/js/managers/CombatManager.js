/**
 * CombatManager.js - 전투 시스템 관리자
 * 바람의 나라 교육용 RPG - 몬스터 스폰, 데미지 계산, 보상 지급
 */

class CombatManager {
    constructor() {
        // 현재 맵의 몬스터 목록
        this.monsters = [];
        // 데미지 텍스트 이펙트
        this.damageTexts = [];
        // 공격 쿨다운
        this.attackCooldown = 0;
        this.ATTACK_COOLDOWN_TIME = 0.8; // 초

        // 몬스터 정의 (PRD Section 10 기준)
        this.MONSTER_DEFS = {
            slime: {
                name: '슬라임',
                stats: { hp: 40, maxHp: 40, atk: 6, def: 1, exp: 15, gold: 8 },
                aggroRange: 4, roamRange: 3
            },
            wolf: {
                name: '들늑대',
                stats: { hp: 80, maxHp: 80, atk: 12, def: 4, exp: 30, gold: 18 },
                aggroRange: 6, roamRange: 4
            },
            goblin: {
                name: '고블린',
                stats: { hp: 60, maxHp: 60, atk: 10, def: 3, exp: 22, gold: 12 },
                aggroRange: 5, roamRange: 3
            },
            skeleton: {
                name: '해골 전사',
                stats: { hp: 100, maxHp: 100, atk: 15, def: 6, exp: 45, gold: 25 },
                aggroRange: 5, roamRange: 4
            },
            boss_ogre: {
                name: '오우거 대장',
                stats: { hp: 500, maxHp: 500, atk: 30, def: 15, exp: 200, gold: 100 },
                aggroRange: 8, roamRange: 2
            },
        };

        console.log('[CombatManager] 초기화 완료');
    }

    /**
     * 맵의 몬스터 스폰 구역 기반으로 몬스터 생성
     * @param {Object} mapData - 맵 데이터 (monsterZones 포함)
     */
    spawnMonsters(mapData) {
        this.monsters = [];
        if (!mapData.monsterZones) return;

        mapData.monsterZones.forEach((zone, zoneIdx) => {
            const def = this.MONSTER_DEFS[zone.type];
            if (!def) return;

            // 존 내에서 몬스터 배치
            for (let i = 0; i < zone.count; i++) {
                // 스폰 영역 내 랜덤 위치
                const tx = zone.x + Math.floor(Math.random() * zone.width);
                const ty = zone.y + Math.floor(Math.random() * zone.height);

                const monster = new Monster({
                    id: `${zone.type}_${zoneIdx}_${i}`,
                    name: def.name,
                    type: zone.type,
                    tileX: tx,
                    tileY: ty,
                    level: zone.level || 1,
                    stats: { ...def.stats },
                    aggroRange: def.aggroRange,
                    roamRange: def.roamRange,
                });

                this.monsters.push(monster);
            }
        });

        console.log(`[CombatManager] 몬스터 ${this.monsters.length}마리 스폰`);
    }

    /**
     * 매 프레임 업데이트
     * @param {number} dt - 델타 타임
     * @param {MapManager} map - 맵 관리자
     * @param {Player} player - 로컬 플레이어
     * @param {NetworkManager} network - 네트워크 관리자 (환경 동기화용)
     */
    update(dt, map, player, network = null) {
        const isMaster = network && network.isTeacher;
        const teacherPresent = network && network.teacherPresent;

        // 공격 쿨다운 감소
        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        // 몬스터 AI 업데이트 및 상태 이상(디버프/기절) 처리
        this.monsters.forEach(m => {
            // 마스터(교사)이거나, 교사가 없을 때는 로컬 모드로 동작
            // 단, 교사가 접속 중인데 내가 학생이라면 교사의 데이터를 기다려야 함
            if (isMaster || !teacherPresent) {
                m.update(dt, map, player, isMaster);
            } else {
                // 학생이고 교사가 접속 중일 때: 부드러운 이동 애니메이션만 진행 (AI 생각은 중지)
                if (m.isMoving) m._smoothMove(dt);
            }
        });

        // 환경 동기화 (서버 <-> 클라이언트)
        if (network && network.envRef) {
            const mapEnvRef = network.envRef.child(map.currentMapId || 'default');
            
            if (isMaster) {
                // [교사] 몬스터 상태 서버에 전송 (최적화를 위해 주기를 둠)
                this._syncTimer = (this._syncTimer || 0) + dt;
                if (this._syncTimer >= 0.1) { // 100ms마다 동기화
                    this._syncTimer = 0;
                    const monsterData = {};
                    this.monsters.forEach(m => {
                        monsterData[m.id] = {
                            x: m.tileX,
                            y: m.tileY,
                            hp: m.stats.hp,
                            state: m.state,
                            direction: m.direction
                        };
                    });
                    // set 대신 update를 사용하여 네트워크 부하 감소
                    mapEnvRef.child('monsters').update(monsterData);
                }
            } else if (teacherPresent) {
                // [학생] 교사가 접속 중일 때만 서버 데이터 수신
                if (!this._envListenerAttached) {
                    mapEnvRef.child('monsters').on('value', (snap) => {
                        const serverMonsters = snap.val();
                        if (serverMonsters) {
                            this.monsters.forEach(m => {
                                if (serverMonsters[m.id]) {
                                    m.updateFromServer(serverMonsters[m.id]);
                                }
                            });
                        }
                    });
                    this._envListenerAttached = true;
                }
            }
        }

        // 몬스터 -> 플레이어 근접 공격 체크
        // (동기화 이슈 방지를 위해 각자 로컬에서 데미지 판정 - 혹은 교사만 판정하도록 변경 가능)
        this._checkMonsterAttacks(dt, player);

        // 데미지 텍스트 업데이트
        this.damageTexts = this.damageTexts.filter(t => {
            t.timer += dt;
            t.y -= 30 * dt; // 위로 떠오름
            t.alpha = 1 - (t.timer / t.duration);
            return t.timer < t.duration;
        });
    }

    /**
     * 플레이어 공격 실행
     * @param {Player} player - 로컬 플레이어
     * @returns {boolean} 공격 성공 여부
     */
    playerAttack(player) {
        // 유령 상태에서는 공격 불가
        if (player.isDead) return false;
        if (this.attackCooldown > 0) return false;

        // 플레이어 전방 타일 계산
        const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const [ox, oy] = offsets[player.direction] || [0, 1];
        const targetTileX = player.tileX + ox;
        const targetTileY = player.tileY + oy;

        // 해당 타일에 있는 몬스터 찾기
        let hitMonster = null;
        for (const m of this.monsters) {
            if (m.state === 'dead') continue;
            if (m.tileX === targetTileX && m.tileY === targetTileY) {
                hitMonster = m;
                break;
            }
        }

        if (!hitMonster) {
            // 인접 타일 확대 검색 (이동 중일 수 있으므로)
            for (const m of this.monsters) {
                if (m.state === 'dead') continue;
                const dx = Math.abs(m.tileX - player.tileX);
                const dy = Math.abs(m.tileY - player.tileY);
                if (dx + dy <= 1) {
                    hitMonster = m;
                    break;
                }
            }
        }

        this.attackCooldown = this.ATTACK_COOLDOWN_TIME;

        // 사운드: 휘두르기 (공격 시도)
        soundManager.play('attack');

        if (hitMonster) {
            // 사운드: 타격
            soundManager.play('hit');

            // 데미지 계산 (PRD 공식: ATK - DEF/2, 최소 1, 장비 보너스 반영)
            const effectiveStats = player.getEffectiveStats ? player.getEffectiveStats() : player.stats;

            // 몬스터 방어력(DEF) 디버프 적용
            let monsterDef = hitMonster.stats.def;
            if (hitMonster.debuffs) {
                hitMonster.debuffs.forEach(db => {
                    if (db.stat === 'def') {
                        monsterDef += db.value; // 음수값 더함 (예: -15)
                    }
                });
            }
            if (monsterDef < 0) monsterDef = 0;

            const rawDmg = effectiveStats.atk - Math.floor(monsterDef / 2);
            const dmg = Math.max(1, rawDmg + Math.floor(Math.random() * 5));
            const killed = hitMonster.takeDamage(dmg);

            // 데미지 텍스트
            this._addDamageText(hitMonster.x + 16, hitMonster.y, dmg, '#FFD700');

            if (killed) {
                // 몬스터 처치 보상
                this._onMonsterKill(player, hitMonster);
            }

            return true;
        }

        return false;
    }

    /**
     * 몬스터의 플레이어 공격 체크 (근접)
     */
    _checkMonsterAttacks(dt, player) {
        // 유령 상태에서는 몬스터가 공격하지 않음
        if (player.isDead) return;

        this.monsters.forEach(m => {
            if (m.state !== 'attacking' || m.isMoving) return;

            // 인접 확인
            const dx = Math.abs(m.tileX - player.tileX);
            const dy = Math.abs(m.tileY - player.tileY);
            if (dx + dy > 1) return;

            if (m.aiTimer >= m.AI_THINK_INTERVAL * 0.8) {
                // 무적 버프 체크
                if (typeof skillManager !== 'undefined') {
                    const buffBonus = skillManager.getBuffBonus();
                    if (buffBonus.invincible > 0) return; // 무적 상태
                }

                const effectiveStats = player.getEffectiveStats ? player.getEffectiveStats() : player.stats;
                const rawDmg = m.stats.atk - Math.floor(effectiveStats.def / 2);
                const dmg = Math.max(1, rawDmg);

                player.stats.hp -= dmg;
                if (player.stats.hp < 0) player.stats.hp = 0;

                // 사운드: 플레이어 피격 (낮은 볼륨)
                soundManager.play('hit', 0.6);

                this._addDamageText(player.x + 16, player.y, dmg, '#ff4040');

                // ===== 사망 판정 =====
                if (player.stats.hp <= 0 && !player.isDead) {
                    player.die();
                    this._addDamageText(player.x + 16, player.y - 20, '💀 사망!', '#ff4040');
                }
            }
        });
    }

    /**
     * 몬스터 처치 보상
     * @param {Player} player
     * @param {Monster} monster
     */
    _onMonsterKill(player, monster) {
        const expGain = monster.stats.exp;
        const goldGain = monster.stats.gold;

        // 유령 상태이면 경험치/골드 획득 불가 (파티원이라도 불가)
        if (player.isDead) {
            this._addDamageText(monster.x + 16, monster.y - 16, '👻 경험치 획득 불가', '#888888');
            return;
        }

        player.exp = (player.exp || 0) + expGain;
        player.gold = (player.gold || 0) + goldGain;

        // 경험치 텍스트
        this._addDamageText(monster.x + 16, monster.y - 16, `+${expGain} EXP`, '#80ff80');
        this._addDamageText(monster.x + 16, monster.y - 28, `+${goldGain} 전`, '#FFD700');

        // 레벨업 체크 (100 * 현재레벨 EXP 필요)
        const requiredExp = player.level * 100;
        if (player.exp >= requiredExp) {
            player.exp -= requiredExp;
            player.level++;
            // 스탯 증가
            player.stats.maxHp += 15;
            player.stats.hp = player.stats.maxHp; // HP 풀 회복
            player.stats.maxMp += 5;
            player.stats.mp = player.stats.maxMp;
            player.stats.atk += 3;
            player.stats.def += 2;

            // 사운드: 레벨업
            soundManager.play('levelup');

            this._addDamageText(player.x + 16, player.y - 40, `🎉 LEVEL UP! Lv.${player.level}`, '#FFD700');
            console.log(`[CombatManager] 레벨업! Lv.${player.level}`);
        }

        // RTDB에 플레이어 데이터 저장
        if (player.uid) {
            player.saveUserData();
        }

        // 드롭 아이템 (20% 확률)
        if (typeof inventoryManager !== 'undefined' && Math.random() < 0.2) {
            const dropTable = {
                slime: ['c01'],
                wolf: ['c01', 'c02'],
                goblin: ['c01', 'c02'],
                skeleton: ['c01', 'c02', 'c03'],
                boss_ogre: ['c03', 'w03', 'a03'],
            };
            const drops = dropTable[monster.type] || ['c01'];
            const dropId = drops[Math.floor(Math.random() * drops.length)];
            const dropItem = shopManager ? shopManager.getItem(dropId) : null;
            if (dropItem && inventoryManager.canAddItem(dropId)) {
                inventoryManager.addItem(dropId, 1);
                this._addDamageText(monster.x + 16, monster.y - 40, `🎁 ${dropItem.name} 획득!`, '#ff80ff');
            }
        }

        // 퀴즈 트리거 (50% 확률)
        if (Math.random() < 0.5 && typeof quizManager !== 'undefined') {
            setTimeout(() => quizManager.triggerQuiz(player), 500);
        }

        console.log(`[CombatManager] ${monster.name} 처치! +${expGain}EXP +${goldGain}G`);
    }

    /**
     * 데미지 텍스트 추가
     */
    _addDamageText(x, y, text, color) {
        this.damageTexts.push({
            x: x, y: y,
            text: String(text),
            color: color || '#fff',
            timer: 0,
            duration: 1.2, // 1.2초간 표시
            alpha: 1,
        });
    }

    /**
     * 데미지 텍스트 렌더링
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera
     */
    renderDamageTexts(ctx, camera) {
        this.damageTexts.forEach(t => {
            const sx = t.x - camera.x;
            const sy = t.y - camera.y;

            ctx.save();
            ctx.globalAlpha = Math.max(0, t.alpha);
            ctx.font = 'bold 12px "Noto Sans KR", sans-serif';
            ctx.textAlign = 'center';

            // 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText(t.text, sx + 1, sy + 1);

            // 텍스트
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, sx, sy);
            ctx.restore();
        });
    }

    /**
     * 몬스터 렌더링
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera
     */
    renderMonsters(ctx, camera) {
        this.monsters.forEach(m => m.render(ctx, camera));
    }

    /**
     * 자원 정리
     */
    destroy() {
        this.monsters = [];
        this.damageTexts = [];
    }
}
