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

        this._lastIsMaster = false; // 마스터 권한 상태 추적용
        this._currentMapEnvRef = null;
        this._envListenerAttached = false;
        this._syncTimer = 0;

        console.log('[CombatManager] 초기화 완료');
    }

    /**
     * 맵의 몬스터 스폰 구역 기반으로 몬스터 생성
     * @param {Object} mapData - 맵 데이터 (monsterZones 포함)
     */
    spawnMonsters(mapData) {
        this.cleanupSync(); // 기존 동기화 리스너 및 설정 초기화
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
                    roamRange: def.roamRange
                });
                this.monsters.push(monster);
            }
        });
        console.log(`[CombatManager] ${this.monsters.length}마리 몬스터 스폰 완료`);
    }
    /**
     * 매 프레임 업데이트
     * @param {number} dt - 델타 타임
     * @param {MapManager} map - 맵 관리자
     * @param {Player} player - 로컬 플레이어
     * @param {NetworkManager} network - 네트워크 관리자 (환경 동기화용)
     */
    update(dt, map, player, network = null) {
        // 네트워크 초기 설정 (한 번만 실행)
        if (network && !this._networkInited) {
            network.onMasterChanged = (isMaster) => {
                console.log(`[CombatManager] 마스터 상태 변경됨: ${isMaster}`);
                if (isMaster) {
                    this.setupMasterSync(map, network);
                } else {
                    this.setupSlaveSync(map, network, player);
                }
            };
            // 초기 상태 설정
            if (network.isMaster()) this.setupMasterSync(map, network);
            else this.setupSlaveSync(map, network, player);
            
            this._networkInited = true;
        }

        // 공격 쿨다운 감소
        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        // 몬스터 업데이트
        const isMaster = network && network.isMaster();
        this.monsters.forEach(m => {
            m.update(dt, map, player, isMaster && (this.monstersEnabled !== false));
        });

        // 데미지 텍스트 업데이트
        this.damageTexts = this.damageTexts.filter(t => {
            t.timer += dt;
            t.y -= 30 * dt;
            t.alpha = 1 - (t.timer / t.duration);
            return t.timer < t.duration;
        });

        // [마스터 전용] 주기적 브로드캐스트
        if (isMaster && this._currentMapEnvRef) {
            this._syncTimer = (this._syncTimer || 0) + dt;
            if (this._syncTimer >= 0.15) { // 빈도 약간 낮춤 (부하 감소)
                this._syncTimer = 0;
                const monsterData = {};
                this.monsters.forEach(m => {
                    monsterData[m.id] = {
                        px: Math.round(m.x),
                        py: Math.round(m.y),
                        tx: m.tileX,
                        ty: m.tileY,
                        hp: m.stats.hp,
                        state: m.state,
                        direction: m.direction,
                        killerUid: m.killerUid || null
                    };
                });
                this._currentMapEnvRef.child('monsters').update(monsterData);
            }
        }
        
        // 몬스터 -> 플레이어 근접 공격 체크
        this._checkMonsterAttacks(dt, player);
    }

    /**
     * 슬레이브 모드 동기화 설정 (서버 -> 로컬)
     */
    setupSlaveSync(map, network, player) {
        this.cleanupSync();
        if (!network || !network.envRef) return;

        const mapEnvRef = network.envRef.child(map.currentMapId || 'default');
        this._currentMapEnvRef = mapEnvRef;

        // 1. 몬스터 활성화 상태 감시
        mapEnvRef.child('monstersEnabled').on('value', snap => {
            this.monstersEnabled = (snap.val() !== false);
        });

        // 2. 몬스터 데이터 수신
        mapEnvRef.child('monsters').on('value', (snap) => {
            // 내가 마스터로 바뀌었으면 무시 (이벤트 순서 보장)
            if (network.isMaster()) return;

            const serverMonsters = snap.val();
            if (serverMonsters) {
                this.monsters.forEach(m => {
                    const sData = serverMonsters[m.id];
                    if (sData) {
                        // 내가 죽인 몬스터 보상
                        if (sData.state === 'dead' && m.state !== 'dead' && sData.killerUid === network.localUid) {
                            this._onMonsterKill(player, m);
                        }
                        m.updateFromServer(sData);
                    }
                });
            }
        });

        this._envListenerAttached = true;
        console.log(`[CombatManager] [${map.currentMapId}] 슬레이브 동기화 모드 시작`);
    }

    /**
     * 마스터 모드 동기화 설정 (로컬 -> 서버)
     */
    setupMasterSync(map, network) {
        this.cleanupSync();
        if (!network || !network.envRef) return;

        const mapEnvRef = network.envRef.child(map.currentMapId || 'default');
        this._currentMapEnvRef = mapEnvRef;

        // 1. 초기 데이터 동기화 (서버 상태 로드)
        mapEnvRef.child('monsters').once('value', (snap) => {
            const serverMonsters = snap.val();
            if (serverMonsters) {
                this.monsters.forEach(m => {
                    if (serverMonsters[m.id]) m.updateFromServer(serverMonsters[m.id]);
                });
            }
        });

        // 2. 학생들의 공격 판정 리스너
        const hitsRef = mapEnvRef.child('hits');
        hitsRef.on('child_added', (snap) => {
            const data = snap.val();
            if (data && data.monsterId) {
                const monster = this.monsters.find(m => m.id === data.monsterId);
                if (monster && monster.state !== 'dead') {
                    monster.takeDamage(data.damage, data.attackerUid);
                    this._addDamageText(monster.x + 16, monster.y, data.damage, '#FFD700');
                }
            }
            hitsRef.child(snap.key).remove();
        });

        console.log(`[CombatManager] [${map.currentMapId}] 마스터 권한 모드 시작`);
    }


    /**
     * 플레이어 공격 실행
     * @param {Player} player - 로컬 플레이어
     * @returns {boolean} 공격 성공 여부
     */
    playerAttack(player) {
        if (player.isDead) return false;
        if (this.attackCooldown > 0) return false;

        const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const [ox, oy] = offsets[player.direction] || [0, 1];
        const targetTileX = player.tileX + ox;
        const targetTileY = player.tileY + oy;

        let hitMonster = null;
        for (const m of this.monsters) {
            if (m.state === 'dead') continue;
            if (m.tileX === targetTileX && m.tileY === targetTileY) {
                hitMonster = m;
                break;
            }
        }

        if (!hitMonster) {
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
        soundManager.play('attack');

        if (hitMonster) {
            soundManager.play('hit');
            const effectiveStats = player.getEffectiveStats ? player.getEffectiveStats() : player.stats;

            let monsterDef = hitMonster.stats.def;
            if (hitMonster.debuffs) {
                hitMonster.debuffs.forEach(db => {
                    if (db.stat === 'def') monsterDef += db.value;
                });
            }
            if (monsterDef < 0) monsterDef = 0;

            const rawDmg = effectiveStats.atk - Math.floor(monsterDef / 2);
            const dmg = Math.max(1, rawDmg + Math.floor(Math.random() * 5));

            // [변경] 마스터 여부에 따라 처리 분기
            if (networkManager.isMaster()) {
                const killed = hitMonster.takeDamage(dmg);
                this._addDamageText(hitMonster.x + 16, hitMonster.y, dmg, '#FFD700');
                if (killed) {
                    this._onMonsterKill(player, hitMonster);
                }
            } else {
                // 슬레이브는 서버에 '판정 요청'만 전송
                if (this._currentMapEnvRef) {
                    this._currentMapEnvRef.child('hits').push({
                        monsterId: hitMonster.id,
                        damage: dmg,
                        attackerUid: networkManager.localUid,
                        timestamp: firebase.database.ServerValue.TIMESTAMP
                    });
                    // 로컬에서는 사운드만 재생 (데미지 텍스트는 마스터 브로드캐스트 대기하거나 즉시 표시 가능)
                    // 현재는 마스터가 브로드캐스트하는 HP 변화를 통해 몬스터 HP가 깎이는것을 보게 됨.
                    // 즉각적인 피드백을 위해 데미지 텍스트만 미리 보여줌
                    this._addDamageText(hitMonster.x + 16, hitMonster.y, dmg, '#FFD700');
                }
            }

            return true;
        }

        return false;
    }

    /**
     * 몬스터의 플레이어 공격 체크 (근접)
     */
    _checkMonsterAttacks(dt, player) {
        if (player.isDead) return;

        this.monsters.forEach(m => {
            if (m.state !== 'attacking' || m.isMoving) return;

            const dx = Math.abs(m.tileX - player.tileX);
            const dy = Math.abs(m.tileY - player.tileY);
            if (dx + dy > 1) return;

            if (m.aiTimer >= m.AI_THINK_INTERVAL * 0.8) {
                if (typeof skillManager !== 'undefined') {
                    const buffBonus = skillManager.getBuffBonus();
                    if (buffBonus.invincible > 0) return;
                }

                const effectiveStats = player.getEffectiveStats ? player.getEffectiveStats() : player.stats;
                const rawDmg = m.stats.atk - Math.floor(effectiveStats.def / 2);
                const dmg = Math.max(1, rawDmg);

                player.stats.hp -= dmg;
                if (player.stats.hp < 0) player.stats.hp = 0;

                soundManager.play('hit', 0.6);
                this._addDamageText(player.x + 16, player.y, dmg, '#ff4040');

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

        if (player.isDead) {
            this._addDamageText(monster.x + 16, monster.y - 16, '👻 경험치 획득 불가', '#888888');
            return;
        }

        player.exp = (player.exp || 0) + expGain;
        player.gold = (player.gold || 0) + goldGain;

        this._addDamageText(monster.x + 16, monster.y - 16, `+${expGain} EXP`, '#80ff80');
        this._addDamageText(monster.x + 16, monster.y - 28, `+${goldGain} 전`, '#FFD700');

        const requiredExp = player.level * 100;
        if (player.exp >= requiredExp) {
            player.exp -= requiredExp;
            player.level++;
            player.stats.maxHp += 15;
            player.stats.hp = player.stats.maxHp;
            player.stats.maxMp += 5;
            player.stats.mp = player.stats.maxMp;
            player.stats.atk += 3;
            player.stats.def += 2;

            soundManager.play('levelup');
            this._addDamageText(player.x + 16, player.y - 40, `🎉 LEVEL UP! Lv.${player.level}`, '#FFD700');
            console.log(`[CombatManager] 레벨업! Lv.${player.level}`);
        }

        if (player.uid) {
            player.saveUserData();
        }

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
            const dropItem = typeof shopManager !== 'undefined' ? shopManager.getItem(dropId) : null;
            if (dropItem && inventoryManager.canAddItem(dropId)) {
                inventoryManager.addItem(dropId, 1);
                this._addDamageText(monster.x + 16, monster.y - 40, `🎁 ${dropItem.name} 획득!`, '#ff80ff');
            }
        }

        if (Math.random() < 0.5 && typeof quizManager !== 'undefined') {
            setTimeout(() => quizManager.triggerQuiz(player), 500);
        }

        console.log(`[CombatManager] ${monster.name} 처치! +${expGain}EXP +${goldGain}G`);
    }

    _addDamageText(x, y, text, color) {
        this.damageTexts.push({
            x: x, y: y,
            text: String(text),
            color: color || '#fff',
            timer: 0,
            duration: 1.2,
            alpha: 1,
        });
    }

    renderDamageTexts(ctx, camera) {
        this.damageTexts.forEach(t => {
            const sx = t.x - camera.x;
            const sy = t.y - camera.y;

            ctx.save();
            ctx.globalAlpha = Math.max(0, t.alpha);
            ctx.font = 'bold 12px "Noto Sans KR", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText(t.text, sx + 1, sy + 1);
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, sx, sy);
            ctx.restore();
        });
    }

    renderMonsters(ctx, camera) {
        this.monsters.forEach(m => m.render(ctx, camera));
    }

    cleanupSync() {
        if (this._currentMapEnvRef) {
            // 모든 하위 리스너 완전 해제 (몬스터 데이터 + 활성화 상태 + 공격 판정)
            this._currentMapEnvRef.child('monstersEnabled').off('value');
            this._currentMapEnvRef.child('hits').off('child_added');
            this._currentMapEnvRef.child('monsters').off('value');
            this._currentMapEnvRef = null;
        }
        this._envListenerAttached = false;
        // 동기화 초기화 플래그 리셋 (맵 전환/재접속 시 재초기화 보장)
        this._networkInited = false;
        this._syncTimer = 0;
    }

    destroy() {
        this.cleanupSync();
        this.monsters = [];
        this.damageTexts = [];
        this._networkInited = false;
    }
}
