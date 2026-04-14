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

        this._lastIsMaster = false; // 마스터 권한 상태 추적용
        this._currentMapEnvRef = null;
        this._envListenerAttached = false;
        this._syncTimer = 0;

        console.log('[CombatManager] GameData 연동 모드로 초기화 완료');
    }

    /**
     * 맵의 몬스터 스폰 구역 기반으로 몬스터 생성
     * @param {Object} mapData - 맵 데이터 (monsterZones 포함)
     */
    spawnMonsters(mapData) {
        this.cleanupSync(); // 기존 동기화 리스너 및 설정 초기화
        this.monsters = [];
        if (!mapData.monsterZones || typeof GameData === 'undefined') return;

        mapData.monsterZones.forEach((zone, zoneIdx) => {
            const def = GameData.monsters[zone.type];
            if (!def) {
                console.warn(`[CombatManager] GameData에 정의되지 않은 몬스터 타입: ${zone.type}`);
                return;
            }

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
                    stats: { 
                        hp: def.hp, 
                        maxHp: def.hp, 
                        atk: def.atk, 
                        def: def.def || 0, 
                        exp: def.exp, 
                        gold: def.gold 
                    },
                    aggroRange: def.isBoss ? 10 : 5,
                    roamRange: def.isBoss ? 2 : 4
                });
                this.monsters.push(monster);
            }
        });
        console.log(`[CombatManager] ${this.monsters.length}마리 몬스터(GameData 기반) 스폰 완료`);
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

        const isRanged = (player.job === '도사' || player.job === '주술사');
        const range = isRanged ? 4 : 1;
        const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const [ox, oy] = offsets[player.direction] || [0, 1];
        
        let hitMonster = null;
        
        // 1. 방향타 기반 사거리 판정
        for (let i = 1; i <= range; i++) {
            const checkX = player.tileX + ox * i;
            const checkY = player.tileY + oy * i;
            const target = this.monsters.find(m => m.state !== 'dead' && m.tileX === checkX && m.tileY === checkY);
            if (target) {
                hitMonster = target;
                break;
            }
        }

        // 2. 전사/도적(근접)인 경우 대각선 등 인접 범위(거리 1) 타겟을 추가 보정하여 좀 더 쉽게 맞도록 함
        if (!hitMonster && !isRanged) {
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
        // 직업별 평타 사운드 분기
        const atkSound = isRanged ? 'magic_cast' : (player.job === '도적' ? 'slash_fast' : 'slash_heavy');
        soundManager.play(atkSound);

        if (hitMonster) {
            soundManager.play('monster_hit');
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

                // 리젠 타이머 리셋 (전투 중 회복 정지)
                if (player.onHit) player.onHit();

                // 몬스터 공격 + 플레이어 피격 사운드
                soundManager.play('monster_attack', 0.5);
                soundManager.play('player_hurt', 0.6);
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

        // 파티 EXP 보너스 적용
        let finalExp = expGain;
        let partyBonus = false;
        if (typeof partyManager !== 'undefined' && partyManager.isInParty()) {
            const ratio = partyManager.getExpShareRatio();
            finalExp = Math.floor(expGain * ratio);
            partyBonus = true;
        }
        player.exp = (player.exp || 0) - expGain + finalExp; // 보정

        // 몬스터 사망 + 보상 사운드
        soundManager.play('monster_die', 0.7);
        soundManager.play('coin', 0.5);
        const expLabel = partyBonus ? `+${finalExp} EXP (파티 보너스!)` : `+${finalExp} EXP`;
        this._addDamageText(monster.x + 16, monster.y - 16, expLabel, partyBonus ? '#a0ffa0' : '#80ff80');
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

        if (typeof inventoryManager !== 'undefined' && typeof GameData !== 'undefined') {
            const mData = GameData.monsters[monster.type];
            let droppedBossItem = false;
            
            // 보스 특별 드롭 - 보스 경험치/능력치 등을 보고 하드코딩 혹은 mData.drop 배열 활용 가능
            if (mData && mData.isBoss) {
                if (monster.type === 'boss_slime_king' && inventoryManager.canAddItem('acc_ring_of_power')) {
                    inventoryManager.addItem('acc_ring_of_power', 1);
                    this._addDamageText(monster.x + 16, monster.y - 45, `👑 힘의 반지 획득!`, '#ff80ff');
                    droppedBossItem = true;
                } else if (monster.type === 'boss_lich_king' && inventoryManager.canAddItem('arm_dragon_armor')) {
                    inventoryManager.addItem('arm_dragon_armor', 1);
                    this._addDamageText(monster.x + 16, monster.y - 45, `👑 드래곤 아머 획득!`, '#ff80ff');
                    droppedBossItem = true;
                } else if (monster.type === 'boss_black_dragon' && inventoryManager.canAddItem('wpn_dragon_slayer')) {
                    inventoryManager.addItem('wpn_dragon_slayer', 1);
                    this._addDamageText(monster.x + 16, monster.y - 45, `👑 드래곤 슬레이어 획득!`, '#ff80ff');
                    droppedBossItem = true;
                }
            }

            if (!droppedBossItem) {
                // [변경] 하드코딩된 테이블 대신 GameData.items 기반 동적 드랍
                const dropChance = monster.stats.exp > 500 ? 0.4 : 0.2; // 보스급은 확률 업
                if (Math.random() < dropChance) {
                    const allItemIds = Object.keys(GameData.items);
                    // 몬스터 경험치 수준에 맞는 아이템 필터링 (간략화된 동적 드랍 로직)
                    const eligibleItems = allItemIds.filter(id => {
                        const itm = GameData.items[id];
                        // 대략적인 밸런싱: 아이템 가격이 몬스터 골드 보상의 10~50배 사이면 적정 드랍 범주로 간주 (장비류) 
                        // 또는 소모품/재료는 언제나 드랍 가능
                        if (itm.type === 'potion' || itm.type === 'material') return true;
                        if (itm.price <= monster.stats.gold * 20) return true;
                        return false;
                    });
    
                    if (eligibleItems.length > 0) {
                        const dropId = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
                        const dropItem = GameData.items[dropId];
                        if (inventoryManager.canAddItem(dropId)) {
                            inventoryManager.addItem(dropId, 1);
                            this._addDamageText(monster.x + 16, monster.y - 45, `🎁 ${dropItem.name} 획득!`, '#ff80ff');
                            console.log(`[CombatManager] 아이템 획득: ${dropItem.name} (${dropId})`);
                        }
                    }
                }
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
