/**
 * SkillManager.js - 직업별 스킬 시스템 관리자
 * 바람의 나라 교육용 RPG - 스킬 습득, 사용, 버프, UI
 */

class SkillManager {
    constructor() {
        // UI 상태
        this.isBookOpen = false;

        // 스킬바 슬롯 (최대 4개)
        this.skillBar = [null, null, null, null];

        // 쿨타임 타이머 { skillId: remainingSeconds }
        this.cooldowns = {};

        // 활성 버프 [{ id, name, stat, value, remaining, icon }]
        this.activeBuffs = [];

        // 4직업 스킬 데이터베이스
        this.SKILLS = this._defineAllSkills();

        console.log('[SkillManager] 초기화 완료');
    }

    // ============================================================
    // 스킬 데이터 정의
    // ============================================================

    _defineAllSkills() {
        return {
            // ===================================================
            // 전사 스킬 (물리 강화 특화)
            // ===================================================
            warrior_heal1: {
                id: 'warrior_heal1', job: '전사', name: '누리의기원', icon: '💚',
                reqLevel: 5, mpCost: 15, cooldown: 10,
                type: 'self_heal', value: 80,
                desc: 'HP 80 즉시 회복',
                learnCost: { gold: 50, items: { c01: 2 } },
            },
            warrior_double: {
                id: 'warrior_double', job: '전사', name: '이중공격', icon: '⚔️',
                reqLevel: 10, mpCost: 20, cooldown: 3,
                type: 'attack_multi', value: 2,
                desc: '공격력 2배 데미지',
                learnCost: { gold: 150, items: { c01: 3 } },
            },
            warrior_triple: {
                id: 'warrior_triple', job: '전사', name: '삼중공격', icon: '🗡️',
                reqLevel: 20, mpCost: 35, cooldown: 5,
                type: 'attack_multi', value: 3,
                desc: '공격력 3배 데미지',
                learnCost: { gold: 400, items: { c01: 5 } },
            },
            warrior_buff_atk: {
                id: 'warrior_buff_atk', job: '전사', name: '신검합일', icon: '🔥',
                reqLevel: 30, mpCost: 25, cooldown: 15,
                type: 'buff', buffStat: 'atk', buffValue: 15, buffDuration: 30,
                desc: 'ATK+15 (30초)',
                learnCost: { gold: 800, items: { c03: 2 } },
            },
            warrior_ultimate: {
                id: 'warrior_ultimate', job: '전사', name: '건곤대나이', icon: '💥',
                reqLevel: 45, mpCost: 60, cooldown: 20,
                type: 'aoe_attack', value: 5,
                desc: '광역 5배 데미지 (주변 적 전체)',
                learnCost: { gold: 1500, items: { c03: 5 } },
            },
            warrior_super_buff: {
                id: 'warrior_super_buff', job: '전사', name: '백호령', icon: '🐯',
                reqLevel: 60, mpCost: 50, cooldown: 30,
                type: 'buff_multi', buffs: [
                    { stat: 'atk', value: 30, duration: 30 },
                    { stat: 'def', value: 10, duration: 30 },
                ],
                desc: 'ATK+30, DEF+10 (30초)',
                learnCost: { gold: 3000, items: { c03: 10 } },
            },

            // ===================================================
            // 도적 스킬 (기동+기습 특화)
            // ===================================================
            thief_buff_atk: {
                id: 'thief_buff_atk', job: '도적', name: '누리의힘', icon: '💪',
                reqLevel: 5, mpCost: 10, cooldown: 10,
                type: 'buff', buffStat: 'atk', buffValue: 5, buffDuration: 20,
                desc: 'ATK+5 (20초)',
                learnCost: { gold: 50, items: { c02: 2 } },
            },
            thief_double: {
                id: 'thief_double', job: '도적', name: '이중공격', icon: '🗡️',
                reqLevel: 12, mpCost: 20, cooldown: 3,
                type: 'attack_multi', value: 2,
                desc: '공격력 2배 데미지',
                learnCost: { gold: 150, items: { c02: 3 } },
            },
            thief_stealth: {
                id: 'thief_stealth', job: '도적', name: '투명', icon: '👻',
                reqLevel: 20, mpCost: 30, cooldown: 20,
                type: 'buff', buffStat: 'stealth', buffValue: 1, buffDuration: 10,
                desc: '10초간 은신 (몬스터 무시)',
                learnCost: { gold: 400, items: { c02: 5 } },
            },
            thief_blink: {
                id: 'thief_blink', job: '도적', name: '비영승보', icon: '💨',
                reqLevel: 30, mpCost: 25, cooldown: 8,
                type: 'attack_multi', value: 3,
                desc: '순간이동 후 3배 타격',
                learnCost: { gold: 800, items: { c03: 2 } },
            },
            thief_ultimate: {
                id: 'thief_ultimate', job: '도적', name: '필살검무', icon: '⚡',
                reqLevel: 45, mpCost: 55, cooldown: 15,
                type: 'attack_multi', value: 6,
                desc: '6배 크리티컬 데미지',
                learnCost: { gold: 1500, items: { c03: 5 } },
            },
            thief_clone: {
                id: 'thief_clone', job: '도적', name: '분신', icon: '👥',
                reqLevel: 60, mpCost: 60, cooldown: 30,
                type: 'buff', buffStat: 'atk', buffValue: 25, buffDuration: 30,
                desc: 'ATK+25 (30초, 분신 공격)',
                learnCost: { gold: 3000, items: { c03: 10 } },
            },

            // ===================================================
            // 주술사 스킬 (마법 딜+디버프 특화)
            // ===================================================
            mage_magic1: {
                id: 'mage_magic1', job: '주술사', name: '신수마법 1차', icon: '🔮',
                reqLevel: 3, mpCost: 10, cooldown: 2,
                type: 'magic_attack', value: 2,
                desc: '원거리 마법 (마력×2)',
                learnCost: { gold: 30, items: { c02: 1 } },
            },
            mage_magic2: {
                id: 'mage_magic2', job: '주술사', name: '신수마법 2차', icon: '✨',
                reqLevel: 12, mpCost: 20, cooldown: 3,
                type: 'magic_attack', value: 3,
                desc: '원거리 마법 (마력×3)',
                learnCost: { gold: 150, items: { c02: 3 } },
            },
            mage_protect: {
                id: 'mage_protect', job: '주술사', name: '보호', icon: '🛡️',
                reqLevel: 20, mpCost: 30, cooldown: 20,
                type: 'buff', buffStat: 'def', buffValue: 20, buffDuration: 30,
                desc: 'DEF+20 (30초)',
                learnCost: { gold: 400, items: { c02: 5 } },
            },
            mage_magic3: {
                id: 'mage_magic3', job: '주술사', name: '신수마법 3차', icon: '💫',
                reqLevel: 30, mpCost: 35, cooldown: 4,
                type: 'magic_attack', value: 5,
                desc: '원거리 마법 (마력×5)',
                learnCost: { gold: 800, items: { c03: 2 } },
            },
            mage_curse: {
                id: 'mage_curse', job: '주술사', name: '저주', icon: '☠️',
                reqLevel: 40, mpCost: 40, cooldown: 15,
                type: 'debuff', debuffStat: 'def', debuffValue: -15, debuffDuration: 20,
                desc: '적 DEF-15 (20초)',
                learnCost: { gold: 1200, items: { c03: 3 } },
            },
            mage_paralyze: {
                id: 'mage_paralyze', job: '주술사', name: '마비', icon: '⚡',
                reqLevel: 50, mpCost: 45, cooldown: 20,
                type: 'debuff', debuffStat: 'stun', debuffValue: 1, debuffDuration: 3,
                desc: '적 3초 행동불가',
                learnCost: { gold: 2000, items: { c03: 5 } },
            },
            mage_ultimate: {
                id: 'mage_ultimate', job: '주술사', name: '헬파이어', icon: '🌋',
                reqLevel: 65, mpCost: 80, cooldown: 25,
                type: 'aoe_magic', value: 8,
                desc: '광역 마력×8 마법 폭발',
                learnCost: { gold: 3500, items: { c03: 10 } },
            },

            // ===================================================
            // 도사 스킬 (힐+버프 특화)
            // ===================================================
            poet_mana_drain: {
                id: 'poet_mana_drain', job: '도사', name: '공력증강', icon: '🔄',
                reqLevel: 5, mpCost: 0, cooldown: 10,
                type: 'hp_to_mp', value: 50,
                desc: 'HP 50 소비 → MP 50 회복',
                learnCost: { gold: 50, items: { c02: 2 } },
            },
            poet_magic1: {
                id: 'poet_magic1', job: '도사', name: '신수마법', icon: '🔮',
                reqLevel: 10, mpCost: 15, cooldown: 3,
                type: 'magic_attack', value: 2,
                desc: '원거리 마법 (마력×2)',
                learnCost: { gold: 100, items: { c02: 3 } },
            },
            poet_protect: {
                id: 'poet_protect', job: '도사', name: '보호', icon: '🛡️',
                reqLevel: 18, mpCost: 25, cooldown: 15,
                type: 'buff', buffStat: 'def', buffValue: 15, buffDuration: 20,
                desc: 'DEF+15 (20초, 피해 감소)',
                learnCost: { gold: 300, items: { c01: 5 } },
            },
            poet_heal_big: {
                id: 'poet_heal_big', job: '도사', name: '태양의기원', icon: '☀️',
                reqLevel: 30, mpCost: 40, cooldown: 12,
                type: 'self_heal', value: 300,
                desc: 'HP 300 대량 회복',
                learnCost: { gold: 800, items: { c03: 2 } },
            },
            poet_barrier: {
                id: 'poet_barrier', job: '도사', name: '차폐', icon: '🔰',
                reqLevel: 40, mpCost: 35, cooldown: 25,
                type: 'buff', buffStat: 'stealth', buffValue: 1, buffDuration: 15,
                desc: '15초 몬스터 무시',
                learnCost: { gold: 1200, items: { c03: 3 } },
            },
            poet_mega_heal: {
                id: 'poet_mega_heal', job: '도사', name: '생명의기원', icon: '💖',
                reqLevel: 55, mpCost: 60, cooldown: 15,
                type: 'self_heal', value: 800,
                desc: 'HP 800 초대형 회복',
                learnCost: { gold: 2500, items: { c03: 5 } },
            },
            poet_invincible: {
                id: 'poet_invincible', job: '도사', name: '금강불체', icon: '✨',
                reqLevel: 65, mpCost: 80, cooldown: 60,
                type: 'buff', buffStat: 'invincible', buffValue: 1, buffDuration: 10,
                desc: '10초간 완전 무적',
                learnCost: { gold: 3500, items: { c03: 10 } },
            },
        };
    }

    // ============================================================
    // 스킬 습득
    // ============================================================

    /**
     * 스킬 습득 가능 여부 체크
     */
    canLearn(skillId, player) {
        const skill = this.SKILLS[skillId];
        if (!skill) return { ok: false, reason: '존재하지 않는 스킬' };
        if (skill.job !== player.job) return { ok: false, reason: '다른 직업의 스킬입니다' };
        if (player.level < skill.reqLevel) return { ok: false, reason: `Lv.${skill.reqLevel} 필요` };
        if (player.learnedSkills && player.learnedSkills.includes(skillId)) return { ok: false, reason: '이미 습득한 스킬' };
        if (player.gold < skill.learnCost.gold) return { ok: false, reason: '골드 부족' };

        // 아이템 확인
        for (const [itemId, qty] of Object.entries(skill.learnCost.items || {})) {
            if (inventoryManager.getItemCount(itemId) < qty) {
                const item = shopManager.getItem(itemId);
                return { ok: false, reason: `${item ? item.name : itemId} ${qty}개 필요` };
            }
        }
        return { ok: true };
    }

    /**
     * 스킬 습득 실행
     */
    learnSkill(skillId, player) {
        const check = this.canLearn(skillId, player);
        if (!check.ok) return { success: false, message: check.reason };

        const skill = this.SKILLS[skillId];

        // 비용 차감
        player.gold -= skill.learnCost.gold;
        for (const [itemId, qty] of Object.entries(skill.learnCost.items || {})) {
            inventoryManager.removeItem(itemId, qty);
        }

        // 스킬 습득
        if (!player.learnedSkills) player.learnedSkills = [];
        player.learnedSkills.push(skillId);

        // 스킬바에 자동 배치 (빈 슬롯)
        const emptySlot = this.skillBar.indexOf(null);
        if (emptySlot !== -1) {
            this.skillBar[emptySlot] = skillId;
        }

        // RTDB 저장
        this._save(player);
        shopManager._savePlayerGold(player);

        return { success: true, message: `✨ ${skill.name} 습득!` };
    }

    // ============================================================
    // 스킬 사용
    // ============================================================

    /**
     * 스킬 사용 (스킬바 슬롯 기반)
     * @param {number} slotIndex - 0~3
     * @param {Player} player
     * @param {CombatManager} combat
     * @returns {Object} { success, message }
     */
    useSkill(slotIndex, player, combat) {
        const skillId = this.skillBar[slotIndex];
        if (!skillId) return { success: false, message: '스킬이 배치되지 않았습니다.' };

        // 유령 상태에서는 스킬 사용 불가
        if (player.isDead) return { success: false, message: '👻 유령 상태에서는 스킬을 사용할 수 없습니다.' };

        const skill = this.SKILLS[skillId];
        if (!skill) return { success: false, message: '알 수 없는 스킬' };

        // 쿨다운 확인
        if (this.cooldowns[skillId] && this.cooldowns[skillId] > 0) {
            return { success: false, message: `쿨타임 ${Math.ceil(this.cooldowns[skillId])}초` };
        }

        // MP 확인
        if (player.stats.mp < skill.mpCost) {
            return { success: false, message: 'MP가 부족합니다.' };
        }

        // MP 소비
        player.stats.mp -= skill.mpCost;

        // 쿨타임 시작
        this.cooldowns[skillId] = skill.cooldown;

        // 스킬 효과 적용
        this._applySkillEffect(skill, player, combat);

        // ===== 스킬 시전 비주얼 이펙트 =====
        if (player.spawnSkillEffect) {
            const effectMap = {
                'self_heal': 'heal', 'hp_to_mp': 'heal',
                'attack_multi': 'magic', 'magic_attack': 'magic',
                'aoe_attack': 'aoe', 'aoe_magic': 'aoe',
                'buff': 'buff', 'buff_multi': 'buff',
                'debuff': 'magic',
            };
            const colorMap = {
                'self_heal': '#80ff80', 'hp_to_mp': '#80d0ff',
                'attack_multi': '#FFD700', 'magic_attack': '#c080ff',
                'aoe_attack': '#ff8040', 'aoe_magic': '#ff80ff',
                'buff': '#80d0ff', 'buff_multi': '#80d0ff',
                'debuff': '#ff80ff',
            };
            player.spawnSkillEffect(
                effectMap[skill.type] || 'magic',
                colorMap[skill.type] || '#ffffff'
            );
        }

        return { success: true, message: `${skill.icon} ${skill.name}!` };
    }

    /**
     * 스킬 효과 적용
     */
    _applySkillEffect(skill, player, combat) {
        switch (skill.type) {
            case 'self_heal':
                // 자가 힐
                player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + skill.value);
                combat._addDamageText(player.x + 16, player.y - 16, `+${skill.value} HP`, '#80ff80');
                break;

            case 'hp_to_mp':
                // HP → MP 변환
                if (player.stats.hp > skill.value) {
                    player.stats.hp -= skill.value;
                    player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + skill.value);
                    combat._addDamageText(player.x + 16, player.y - 16, `MP+${skill.value}`, '#80d0ff');
                }
                break;

            case 'attack_multi':
                // 배율 물리 공격 (전방 1칸)
                this._doSkillAttack(player, combat, skill.value, false);
                break;

            case 'magic_attack':
                // 마법 공격 (마력 기반)
                this._doSkillAttack(player, combat, skill.value, true);
                break;

            case 'aoe_attack':
                // 광역 물리 공격
                this._doAoeAttack(player, combat, skill.value, false);
                break;

            case 'aoe_magic':
                // 광역 마법 공격
                this._doAoeAttack(player, combat, skill.value, true);
                break;

            case 'buff':
                // 단일 버프
                this._addBuff(skill.id, skill.name, skill.icon, skill.buffStat, skill.buffValue, skill.buffDuration, player, combat);
                break;

            case 'buff_multi':
                // 복수 버프
                skill.buffs.forEach(b => {
                    this._addBuff(skill.id + '_' + b.stat, skill.name, skill.icon, b.stat, b.value, b.duration, player, combat);
                });
                break;

            case 'debuff':
                // 디버프 (가장 가까운 몬스터에게)
                this._applyDebuff(player, combat, skill);
                break;
        }
    }

    /**
     * 스킬 기반 단일 공격
     */
    _doSkillAttack(player, combat, multiplier, isMagic) {
        // 전방 몬스터 찾기
        const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const [ox, oy] = offsets[player.direction] || [0, 1];

        let target = null;
        for (const m of combat.monsters) {
            if (m.state === 'dead') continue;
            const dx = Math.abs(m.tileX - (player.tileX + ox));
            const dy = Math.abs(m.tileY - (player.tileY + oy));
            if (dx + dy <= 1) { target = m; break; }
        }

        if (!target) {
            // 인접 확장 검색
            for (const m of combat.monsters) {
                if (m.state === 'dead') continue;
                const dx = Math.abs(m.tileX - player.tileX);
                const dy = Math.abs(m.tileY - player.tileY);
                if (dx + dy <= 2) { target = m; break; }
            }
        }

        if (target) {
            const eff = player.getEffectiveStats ? player.getEffectiveStats() : player.stats;
            const baseDmg = isMagic ? (eff.magic || 10) : eff.atk;
            const dmg = Math.max(1, Math.floor(baseDmg * multiplier));
            const killed = target.takeDamage(dmg);
            combat._addDamageText(target.x + 16, target.y, dmg, isMagic ? '#c080ff' : '#FFD700');
            if (killed) combat._onMonsterKill(player, target);
        }
    }

    /**
     * 광역 공격 (주변 3타일 내 모든 적)
     */
    _doAoeAttack(player, combat, multiplier, isMagic) {
        const eff = player.getEffectiveStats ? player.getEffectiveStats() : player.stats;
        const baseDmg = isMagic ? (eff.magic || 10) : eff.atk;
        const dmg = Math.max(1, Math.floor(baseDmg * multiplier));
        let hitCount = 0;

        combat.monsters.forEach(m => {
            if (m.state === 'dead') return;
            const dx = Math.abs(m.tileX - player.tileX);
            const dy = Math.abs(m.tileY - player.tileY);
            if (dx + dy <= 3) {
                const killed = m.takeDamage(dmg);
                combat._addDamageText(m.x + 16, m.y, dmg, isMagic ? '#ff80ff' : '#FFD700');
                if (killed) combat._onMonsterKill(player, m);
                hitCount++;
            }
        });

        if (hitCount > 0) {
            combat._addDamageText(player.x + 16, player.y - 24, `💥 ${hitCount}체 적중!`, '#FFD700');
        }
    }

    /**
     * 버프 추가
     */
    _addBuff(id, name, icon, stat, value, duration, player, combat) {
        // 기존 같은 버프 제거
        this.activeBuffs = this.activeBuffs.filter(b => b.id !== id);

        this.activeBuffs.push({ id, name, icon, stat, value, remaining: duration });
        combat._addDamageText(player.x + 16, player.y - 16, `${icon} ${name}!`, '#80d0ff');
    }

    /**
     * 디버프 적용 (가장 가까운 몬스터)
     */
    _applyDebuff(player, combat, skill) {
        let closest = null;
        let closestDist = Infinity;

        combat.monsters.forEach(m => {
            if (m.state === 'dead') return;
            const dx = Math.abs(m.tileX - player.tileX);
            const dy = Math.abs(m.tileY - player.tileY);
            const dist = dx + dy;
            if (dist < closestDist && dist <= 5) {
                closest = m;
                closestDist = dist;
            }
        });

        if (closest) {
            if (skill.debuffStat === 'stun') {
                // 마비: 몬스터 일시 정지
                closest.stunTimer = skill.debuffDuration;
                combat._addDamageText(closest.x + 16, closest.y, '⚡ 마비!', '#ffff40');
            } else {
                // DEF 감소 등
                if (!closest.debuffs) closest.debuffs = [];
                closest.debuffs.push({
                    stat: skill.debuffStat,
                    value: skill.debuffValue,
                    remaining: skill.debuffDuration,
                });
                combat._addDamageText(closest.x + 16, closest.y, `${skill.icon} ${skill.name}!`, '#ff80ff');
            }
        }
    }

    // ============================================================
    // 매 프레임 업데이트
    // ============================================================

    /**
     * 쿨타임 + 버프 타이머 갱신
     */
    update(dt) {
        // 쿨타임 감소
        for (const id in this.cooldowns) {
            if (this.cooldowns[id] > 0) {
                this.cooldowns[id] -= dt;
                if (this.cooldowns[id] <= 0) delete this.cooldowns[id];
            }
        }

        // 버프 타이머 감소
        this.activeBuffs = this.activeBuffs.filter(b => {
            b.remaining -= dt;
            return b.remaining > 0;
        });
    }

    /**
     * 현재 버프 보너스 합산 (Player.getEffectiveStats에서 호출)
     */
    getBuffBonus() {
        const bonus = { atk: 0, def: 0, stealth: 0, invincible: 0 };
        this.activeBuffs.forEach(b => {
            if (bonus.hasOwnProperty(b.stat)) {
                bonus[b.stat] += b.value;
            }
        });
        return bonus;
    }

    // ============================================================
    // RTDB 저장/로드
    // ============================================================

    _save(player) {
        if (!player || !player.uid) return;
        rtdb.ref('userData/' + player.uid + '/learnedSkills').set(player.learnedSkills || []);
        rtdb.ref('userData/' + player.uid + '/skillBar').set(this.skillBar);
    }

    loadFromData(data, player) {
        if (data.learnedSkills && Array.isArray(data.learnedSkills)) {
            player.learnedSkills = data.learnedSkills;
        } else {
            player.learnedSkills = [];
        }
        if (data.skillBar && Array.isArray(data.skillBar)) {
            this.skillBar = data.skillBar;
        }
    }

    // ============================================================
    // 스킬북 UI (습득 화면)
    // ============================================================

    openBook(player) {
        if (this.isBookOpen) return;
        this.isBookOpen = true;
        this._renderBookUI(player);
    }

    closeBook() {
        this.isBookOpen = false;
        const overlay = document.getElementById('skillbook-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    _renderBookUI(player) {
        const overlay = document.getElementById('skillbook-overlay');
        if (!overlay) return;
        overlay.style.display = 'flex';

        const popup = overlay.querySelector('.skillbook-popup');
        if (!popup) return;

        // 현재 직업 스킬만 필터링
        const jobSkills = Object.values(this.SKILLS).filter(s => s.job === player.job);
        const learned = player.learnedSkills || [];

        popup.innerHTML = `
            <div class="sb-header">
                <span class="sb-icon">📖</span>
                <h3>${player.job} 스킬북</h3>
                <button class="sb-close-btn" id="sb-close">✕</button>
            </div>
            <p class="sb-sub">💰 ${player.gold}전 | MP ${player.stats.mp}/${player.stats.maxMp}</p>
            <div class="sb-skills" id="sb-skills-list"></div>
            <p id="sb-message" class="sb-message"></p>

            <div class="sb-bar-section">
                <h4>⚡ 스킬바 배치 (숫자키 1~4)</h4>
                <div class="sb-bar" id="sb-bar-slots"></div>
            </div>
        `;

        popup.querySelector('#sb-close').addEventListener('click', () => this.closeBook());

        // 스킬 목록 렌더링
        const listEl = popup.querySelector('#sb-skills-list');
        jobSkills.forEach(skill => {
            const isLearned = learned.includes(skill.id);
            const check = this.canLearn(skill.id, player);
            const onBar = this.skillBar.includes(skill.id);

            // 습득 비용 텍스트
            let costText = `${skill.learnCost.gold}전`;
            for (const [itemId, qty] of Object.entries(skill.learnCost.items || {})) {
                const item = shopManager.getItem(itemId);
                costText += ` + ${item ? item.name : itemId}×${qty}`;
            }

            const card = document.createElement('div');
            card.className = `sb-skill-card ${isLearned ? 'learned' : ''} ${!isLearned && !check.ok ? 'locked' : ''}`;
            card.innerHTML = `
                <div class="sb-skill-icon">${skill.icon}</div>
                <div class="sb-skill-info">
                    <div class="sb-skill-name">${skill.name} <span class="sb-skill-lv">Lv.${skill.reqLevel}</span></div>
                    <div class="sb-skill-desc">${skill.desc}</div>
                    <div class="sb-skill-cost">MP: ${skill.mpCost} | CD: ${skill.cooldown}s</div>
                </div>
                <div class="sb-skill-actions">
                    ${isLearned
                    ? `<span class="sb-learned-badge">✅ 습득</span>
                           ${!onBar ? `<button class="sb-equip-btn" data-id="${skill.id}">배치</button>` : '<span class="sb-on-bar">⚡</span>'}`
                    : `<div class="sb-learn-cost">${costText}</div>
                           <button class="sb-learn-btn" data-id="${skill.id}" ${!check.ok ? 'disabled' : ''}>습득</button>`
                }
                </div>
            `;
            listEl.appendChild(card);
        });

        // 습득 버튼 이벤트
        listEl.querySelectorAll('.sb-learn-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const result = this.learnSkill(btn.dataset.id, player);
                this._showBookMessage(result.message, result.success);
                if (result.success) this._renderBookUI(player);
            });
        });

        // 배치 버튼 이벤트
        listEl.querySelectorAll('.sb-equip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const emptySlot = this.skillBar.indexOf(null);
                if (emptySlot !== -1) {
                    this.skillBar[emptySlot] = btn.dataset.id;
                    this._save(player);
                    this._renderBookUI(player);
                } else {
                    this._showBookMessage('스킬바가 가득 찼습니다. 기존 스킬을 제거하세요.', false);
                }
            });
        });

        // 스킬바 슬롯 렌더링
        this._renderBarSlots(player);
    }

    /**
     * 스킬바 슬롯 렌더링 (스킬북 내)
     */
    _renderBarSlots(player) {
        const barEl = document.getElementById('sb-bar-slots');
        if (!barEl) return;
        barEl.innerHTML = '';

        for (let i = 0; i < 4; i++) {
            const skillId = this.skillBar[i];
            const skill = skillId ? this.SKILLS[skillId] : null;
            const slot = document.createElement('div');
            slot.className = `sb-bar-slot ${skill ? 'filled' : 'empty'}`;
            slot.innerHTML = `
                <span class="sb-bar-key">${i + 1}</span>
                ${skill ? `<span class="sb-bar-icon">${skill.icon}</span><span class="sb-bar-name">${skill.name}</span>
                    <button class="sb-bar-remove" data-slot="${i}">✕</button>` : '<span class="sb-bar-empty">비어있음</span>'}
            `;
            barEl.appendChild(slot);
        }

        // 제거 버튼 이벤트
        barEl.querySelectorAll('.sb-bar-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.skillBar[parseInt(btn.dataset.slot)] = null;
                this._save(player);
                this._renderBookUI(player);
            });
        });
    }

    _showBookMessage(message, success) {
        const msgEl = document.getElementById('sb-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `sb-message ${success ? 'success' : 'error'}`;
            setTimeout(() => { msgEl.textContent = ''; }, 2500);
        }
    }

    // ============================================================
    // 인게임 스킬바 HUD 렌더링 (Canvas 위 DOM)
    // ============================================================

    /**
     * HUD 스킬바 업데이트
     */
    updateSkillBarHUD() {
        for (let i = 0; i < 4; i++) {
            const slotEl = document.getElementById(`skill-slot-${i}`);
            if (!slotEl) continue;

            const skillId = this.skillBar[i];
            const skill = skillId ? this.SKILLS[skillId] : null;

            if (skill) {
                const cd = this.cooldowns[skillId] || 0;
                const onCooldown = cd > 0;
                slotEl.innerHTML = `
                    <span class="hud-skill-icon">${skill.icon}</span>
                    ${onCooldown ? `<div class="hud-skill-cd">${Math.ceil(cd)}</div>` : ''}
                `;
                slotEl.className = `hud-skill-slot ${onCooldown ? 'on-cooldown' : ''}`;
                slotEl.title = `${skill.name} (MP:${skill.mpCost})`;
            } else {
                slotEl.innerHTML = `<span class="hud-skill-key">${i + 1}</span>`;
                slotEl.className = 'hud-skill-slot empty';
                slotEl.title = '';
            }
        }
    }
}

// 전역 인스턴스
const skillManager = new SkillManager();
