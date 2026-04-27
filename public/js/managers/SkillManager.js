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
        if (player.learnedSkills && player.learnedSkills.includes(skillId)) return { ok: false, reason: '이미 습득한 스킬' };
        // 오픈 모드: 직업·레벨·비용 제한 해제 — 모든 학생이 자유롭게 체험
        return { ok: true };
    }

    /**
     * 스킬 습득 실행
     */
    learnSkill(skillId, player) {
        const check = this.canLearn(skillId, player);
        if (!check.ok) return { success: false, message: check.reason };

        const skill = this.SKILLS[skillId];

        // 오픈 모드: 비용 차감 없음 (모든 스킬 무료 습득)
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

        // 공격형 스킬: 주변에 타겟이 없으면 MP를 소모하지 않고 취소
        if (skill.type === 'attack_multi' || skill.type === 'magic_attack') {
            if (!this._hasNearbyTarget(player, combat, 2)) {
                return { success: false, message: '주변에 적이 없습니다.' };
            }
        }
        if (skill.type === 'aoe_attack' || skill.type === 'aoe_magic') {
            if (!this._hasNearbyTarget(player, combat, 3)) {
                return { success: false, message: '주변에 적이 없습니다.' };
            }
        }

        // HP→MP 변환 스킬: HP 30% 이하일 때 사용 불가 (안전 장치)
        if (skill.type === 'hp_to_mp') {
            const hpRatio = player.stats.hp / player.stats.maxHp;
            if (hpRatio <= 0.3) {
                return { success: false, message: '⚠️ HP가 너무 낮아 사용할 수 없습니다.' };
            }
        }

        // MP 소비
        player.stats.mp -= skill.mpCost;

        // 쿨타임 시작
        this.cooldowns[skillId] = skill.cooldown;

        // 스킬 시전 직후 짧은 무적 프레임 (0.5초) - 시전 중 즉사 방지
        this._grantSkillImmunity(player, 0.5);

        // 사운드: 스킬 유형별 고유 효과음 재생
        const skillSoundMap = {
            // ── 전사 ──
            warrior_heal1:      'skill_heal',
            warrior_double:     'slash_heavy',
            warrior_triple:     'slash_heavy',
            warrior_buff_atk:   'skill_buff',
            warrior_ultimate:   'skill_aoe',
            warrior_super_buff: 'skill_buff',
            // ── 도적 ──
            thief_buff_atk:     'skill_buff',
            thief_double:       'slash_fast',
            thief_stealth:      'skill_debuff',
            thief_blink:        'skill_thunder',
            thief_ultimate:     'critical',
            thief_clone:        'skill_buff',
            // ── 주술사 ──
            mage_magic1:        'skill_fire',
            mage_magic2:        'skill_ice',
            mage_protect:       'skill_buff',
            mage_magic3:        'skill_fire',
            mage_curse:         'skill_debuff',
            mage_paralyze:      'skill_thunder',
            mage_ultimate:      'skill_aoe',
            // ── 도사 ──
            poet_mana_drain:    'skill_heal',
            poet_magic1:        'magic_cast',
            poet_protect:       'skill_buff',
            poet_heal_big:      'skill_heal',
            poet_barrier:       'skill_buff',
            poet_mega_heal:     'skill_heal',
            poet_invincible:    'skill_buff',
        };
        const skillSound = skillSoundMap[skillId] || 'skill';
        soundManager.play(skillSound);

        // 스킬 효과 적용
        this._applySkillEffect(skill, player, combat);

        // [멀티플레이] 스킬 사용 브로드캐스트
        if (typeof networkManager !== 'undefined') {
            networkManager.broadcastEvent('skill', {
                skillId: skill.id,
                job: player.job,
                direction: player.direction
            });
        }


        // ===== 개별 스킬별 고유 비주얼 이펙트 =====
        if (player.spawnSkillEffect) {
            // 개별 스킬 ID별 고유 이펙트/색상 매핑 (AssetManager.images.procEffects ID 사용)
            const skillVisualMap = {
                // ── 전사 ──
                warrior_heal1:    { fx: 'heal',  color: '#80ff80' },
                warrior_double:   { fx: 'proc',  id: 'double_slash' },
                warrior_triple:   { fx: 'proc',  id: 'triple_slash' },
                warrior_buff_atk: { fx: 'buff',  color: '#FF8C00' },
                warrior_ultimate: { fx: 'proc',  id: 'earth' },
                warrior_super_buff: { fx: 'buff', color: '#FFD700' },
                // ── 도적 ──
                thief_buff_atk:   { fx: 'buff',  color: '#E0AAFF' },
                thief_double:     { fx: 'proc',  id: 'double_slash' },
                thief_stealth:    { fx: 'proc',  id: 'stealth' },
                thief_blink:      { fx: 'proc',  id: 'wind' },
                thief_ultimate:   { fx: 'proc',  id: 'triple_slash' },
                thief_clone:      { fx: 'buff',  color: '#AA00FF' },
                // ── 주술사 ──
                mage_magic1:      { fx: 'proc',  id: 'aoe_fire' },
                mage_magic2:      { fx: 'proc',  id: 'aoe_ice' },
                mage_protect:     { fx: 'buff',  color: '#4FC3F7' },
                mage_magic3:      { fx: 'proc',  id: 'aoe_poison' },
                mage_curse:       { fx: 'proc',  id: 'curse' },
                mage_paralyze:    { fx: 'proc',  id: 'paralyze' },
                mage_ultimate:    { fx: 'proc',  id: 'aoe_fire' }, 
                // ── 도사 ──
                poet_mana_drain:  { fx: 'proc',  id: 'hp_to_mp' },
                poet_magic1:      { fx: 'proc',  id: 'wind' },
                poet_protect:     { fx: 'buff',  color: '#69F0AE' },
                poet_heal_big:    { fx: 'proc',  id: 'holy' },
                poet_barrier:     { fx: 'proc',  id: 'stealth' },
                poet_mega_heal:   { fx: 'proc',  id: 'holy' },
                poet_invincible:  { fx: 'proc',  id: 'holy' },
            };

            // 타입별 폴백 매핑
            const typeEffectMap = {
                'self_heal': 'heal', 'hp_to_mp': 'heal',
                'attack_multi': 'magic', 'magic_attack': 'magic',
                'aoe_attack': 'aoe', 'aoe_magic': 'aoe',
                'buff': 'buff', 'buff_multi': 'buff',
                'debuff': 'magic',
            };
            const typeColorMap = {
                'self_heal': '#80ff80', 'hp_to_mp': '#80d0ff',
                'attack_multi': '#FFD700', 'magic_attack': '#c080ff',
                'aoe_attack': '#ff8040', 'aoe_magic': '#ff80ff',
                'buff': '#80d0ff', 'buff_multi': '#80d0ff',
                'debuff': '#ff80ff',
            };

            const visual = skillVisualMap[skillId];
            const fxType = visual ? visual.fx : (typeEffectMap[skill.type] || 'magic');
            const fxColor = visual ? visual.color : (typeColorMap[skill.type] || '#ffffff');
            const procId = visual ? visual.id : null;
            
            player.spawnSkillEffect(fxType, fxColor, procId);
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
                // HP → MP 변환 (안전 장치: HP 30% 이하 보호는 useSkill에서 처리)
                if (player.stats.hp > skill.value) {
                    player.stats.hp -= skill.value;
                    player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + skill.value);
                    combat._addDamageText(player.x + 16, player.y - 16, `MP+${skill.value}`, '#80d0ff');
                } else {
                    // HP가 변환량보다 적으면 실제 남은 HP 일부만 변환 (최소 1 유지)
                    const safeAmount = Math.max(0, player.stats.hp - 1);
                    if (safeAmount > 0) {
                        player.stats.hp -= safeAmount;
                        player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + safeAmount);
                        combat._addDamageText(player.x + 16, player.y - 16, `MP+${safeAmount}`, '#80d0ff');
                    } else {
                        combat._addDamageText(player.x + 16, player.y - 16, 'HP 부족!', '#ff8080');
                    }
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

            case 'target_heal':
            case 'target_buff':
                // 아군 타겟팅 스킬 (가장 가까운 아군 또는 파티원)
                this._applyInterPlayerSkill(skill, player, combat);
                break;
        }
    }

    /**
     * 타 플레이어 대상 스킬 적용 (힐/버프)
     */
    _applyInterPlayerSkill(skill, player, combat) {
        // 1. 타겟 결정 (현재 전방 또는 가장 가까운 아군)
        const target = this._findAllyTarget(player);
        
        if (target) {
            // 원격 플레이어인 경우 이벤트 전송
            if (target instanceof RemotePlayer) {
                const eventType = skill.type === 'target_heal' ? 'heal' : 'buff';
                networkManager.broadcastEvent(eventType, {
                    targetUid: target.uid,
                    value: skill.value || 0,
                    stat: skill.buffStat,
                    name: skill.name
                });
                
                combat._addDamageText(target.x + 16, target.y - 16, `${skill.icon} ${skill.name}`, '#80D0FF');
            } else {
                // 자기 자신인 경우 (로컬 처리)
                if (skill.type === 'target_heal') {
                    player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + skill.value);
                    combat._addDamageText(player.x + 16, player.y - 16, `+${skill.value} HP`, '#80ff80');
                } else {
                    this._addBuff(skill.id, skill.name, skill.icon, skill.buffStat, skill.buffValue, skill.buffDuration, player, combat);
                }
            }
        } else {
            // 타겟이 없으면 자기 자신에게 적용 (폴백)
            if (skill.type === 'target_heal') {
                player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + skill.value);
                combat._addDamageText(player.x + 16, player.y - 16, `+${skill.value} HP`, '#80ff80');
            }
        }
    }

    /**
     * 가장 적절한 아군 대상 찾기
     */
    _findAllyTarget(player) {
        // 전방 1~2칸 내에 있는 원격 플레이어 우선
        const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const [ox, oy] = offsets[player.direction] || [0, 1];
        
        let closest = null;
        let minDist = 3; // 최대 3칸 거리

        if (typeof networkManager !== 'undefined') {
            networkManager.remotePlayers.forEach(remote => {
                if (remote.isDead) return;
                const dist = Math.abs(remote.tileX - (player.tileX + ox)) + Math.abs(remote.tileY - (player.tileY + oy));
                if (dist < minDist) {
                    closest = remote;
                    minDist = dist;
                }
            });
        }

        return closest || player; // 없으면 자기 자신
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
    // 유틸리티: 주변 타겟 존재 확인
    // ============================================================

    /**
     * 주변에 공격 가능한 몬스터가 있는지 확인
     * @param {Player} player
     * @param {CombatManager} combat
     * @param {number} range - 탐색 거리 (타일)
     * @returns {boolean}
     */
    _hasNearbyTarget(player, combat, range) {
        if (!combat || !combat.monsters) return false;
        return combat.monsters.some(m => {
            if (m.state === 'dead') return false;
            const dx = Math.abs(m.tileX - player.tileX);
            const dy = Math.abs(m.tileY - player.tileY);
            return (dx + dy) <= range;
        });
    }

    /**
     * 스킬 시전 후 짧은 무적 프레임 부여 (즉사 방지)
     * @param {Player} player
     * @param {number} duration - 무적 시간 (초)
     */
    _grantSkillImmunity(player, duration) {
        // skillImmunityTimer를 플레이어에 설정 → CombatManager에서 확인
        player._skillImmunityTimer = duration;
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
        if (!player) {
            console.error('[SkillManager] 플레이어 정보가 없어 스킬북을 열 수 없습니다.');
            return;
        }
        if (this.isBookOpen) return;
        console.log('[SkillManager] ✨ 스킬북 열기');
        this.isBookOpen = true;
        document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
        this._renderBookUI(player);
    }

    closeBook() {
        console.log('[SkillManager] ✨ 스킬북 닫기');
        this.isBookOpen = false;
        const overlay = document.getElementById('skillbook-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = ''; // body 스크롤 복원
    }

    _renderBookUI(player) {
        if (!player || !player.job) return;
        
        const overlay = document.getElementById('skillbook-overlay');
        if (!overlay) return;
        overlay.style.display = 'flex';

        // 오버레이 배경(어두운 영역) 클릭 시 닫기
        overlay.onclick = (e) => {
            if (e.target === overlay) this.closeBook();
        };

        const popup = overlay.querySelector('.skillbook-popup');
        if (!popup) return;

        // 직업 아이콘
        const jobIcons = { '전사': '⚔️', '도적': '🗡️', '주술사': '🔮', '도사': '☯️' };

        // 현재 직업 스킬만 필터링, 레벨순 정렬
        const jobSkills = Object.values(this.SKILLS)
            .filter(s => player && s.job === player.job)

            .sort((a, b) => a.reqLevel - b.reqLevel);
        const learned = player.learnedSkills || [];

        popup.innerHTML = `
            <div class="sb-header">
                <span class="sb-job-icon">${jobIcons[player.job] || '📖'}</span>
                <div class="sb-header-info">
                    <h3>${player.job} 스킬 트리</h3>
                    <span class="sb-level-badge">Lv.${player.level}</span>
                </div>
                <button class="sb-close-btn" id="sb-close">✕</button>
            </div>
            <div class="sb-stats-bar">
                <span>💰 ${player.gold.toLocaleString()}전</span>
                <span>💙 MP ${player.stats.mp}/${player.stats.maxMp}</span>
                <span>✅ 습득 ${learned.filter(id => this.SKILLS[id] && this.SKILLS[id].job === player.job).length}/${jobSkills.length}</span>
            </div>

            <div class="sb-layout">
                <div class="sb-tree-col">
                    <h4 class="sb-col-title">스킬 트리</h4>
                    <div id="sb-skills-list" class="sb-skills"></div>
                </div>
                <div class="sb-detail-col" id="sb-detail-panel">
                    <div class="sb-detail-placeholder">
                        <div style="font-size:2rem;margin-bottom:8px;">👆</div>
                        <p>스킬을 클릭하면<br>상세 정보가 표시됩니다</p>
                    </div>
                </div>
            </div>

            <p id="sb-message" class="sb-message"></p>

            <div class="sb-bar-section">
                <h4>⚡ 스킬바 (숫자키 1~4로 사용)</h4>
                <div class="sb-bar" id="sb-bar-slots"></div>
            </div>
        `;

        popup.querySelector('#sb-close').addEventListener('click', () => this.closeBook());

        // 스킬 트리 렌더링
        const listEl = popup.querySelector('#sb-skills-list');
        jobSkills.forEach((skill, idx) => {
            const isLearned = learned.includes(skill.id);
            const stateClass = isLearned ? 'st-learned' : 'st-available';

            const row = document.createElement('div');
            row.className = `sb-tree-row ${stateClass}`;
            row.dataset.id = skill.id;

            // 레벨 진행도 바 (max level for job ~ 65)
            const maxLv = 65;
            const lvPct = Math.min(100, Math.round((skill.reqLevel / maxLv) * 100));

            row.innerHTML = `
                ${idx > 0 ? '<div class="sb-tree-connector"></div>' : ''}
                <div class="sb-tree-node">
                    <div class="sb-tree-icon">${skill.icon}</div>
                    <div class="sb-tree-meta">
                        <div class="sb-tree-name">${skill.name}</div>
                        <div class="sb-tree-lv-bar">
                            <div class="sb-tree-lv-fill" style="width:${lvPct}%"></div>
                        </div>
                        <div class="sb-tree-lv-label">추천 Lv.${skill.reqLevel}</div>
                    </div>
                    <div class="sb-tree-state">
                        ${isLearned ? '<span class="sb-badge-learned">✅ 습득완료</span>'
                                    : '<span class="sb-badge-available">✨ 배울 수 있어요!</span>'}
                    </div>
                </div>
            `;
            listEl.appendChild(row);
        });

        // 스킬 클릭 → 상세 패널
        listEl.querySelectorAll('.sb-tree-row').forEach(row => {
            row.addEventListener('click', () => {
                listEl.querySelectorAll('.sb-tree-row').forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');
                this._showSkillDetail(row.dataset.id, player, popup);
            });
        });

        // 스킬바 슬롯 렌더링
        this._renderBarSlots(player);
    }

    /**
     * 스킬 상세 패널 렌더링
     */
    _showSkillDetail(skillId, player, popup) {
        const skill = this.SKILLS[skillId];
        if (!skill) return;
        const panel = popup.querySelector('#sb-detail-panel');
        if (!panel) return;

        const learned = player.learnedSkills || [];
        const isLearned = learned.includes(skillId);
        const onBar = this.skillBar.includes(skillId);
        const costText = '무료 (오픈 모드)';

        const typeNames = {
            'self_heal': '🩹 회복', 'hp_to_mp': '🔄 전환',
            'attack_multi': '⚔️ 물리공격', 'magic_attack': '✨ 마법공격',
            'aoe_attack': '💥 광역물리', 'aoe_magic': '🌋 광역마법',
            'buff': '🛡️ 버프', 'buff_multi': '✨ 복합버프', 'debuff': '☠️ 디버프',
        };

        panel.innerHTML = `
            <div class="sb-detail-card">
                <div class="sb-detail-icon">${skill.icon}</div>
                <div class="sb-detail-name">${skill.name}</div>
                <div class="sb-detail-type">${typeNames[skill.type] || skill.type}</div>
                <div class="sb-detail-desc">${skill.desc}</div>
                <div class="sb-detail-stats">
                    <div class="sb-detail-stat"><span>추천 레벨</span><strong>Lv.${skill.reqLevel}</strong></div>
                    <div class="sb-detail-stat"><span>MP 소모</span><strong>${skill.mpCost}</strong></div>
                    <div class="sb-detail-stat"><span>쿨타임</span><strong>${skill.cooldown}초</strong></div>
                </div>
                <div class="sb-detail-cost">습득 비용: ${costText}</div>
                <div class="sb-detail-actions" id="sb-detail-actions"></div>
            </div>
        `;

        const actEl = panel.querySelector('#sb-detail-actions');

        if (isLearned) {
            actEl.innerHTML = `
                <div class="sb-learned-info">✅ 이미 습득한 스킬입니다.</div>
                ${onBar
                    ? `<button class="sb-btn-unequip" data-id="${skillId}">⚡ 스킬바에서 제거</button>`
                    : `<button class="sb-btn-equip" data-id="${skillId}">⚡ 스킬바에 배치</button>`
                }
            `;
            actEl.querySelector('.sb-btn-equip, .sb-btn-unequip')?.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if (onBar) {
                    const slotIdx = this.skillBar.indexOf(id);
                    if (slotIdx !== -1) this.skillBar[slotIdx] = null;
                } else {
                    const emptySlot = this.skillBar.indexOf(null);
                    if (emptySlot !== -1) {
                        this.skillBar[emptySlot] = id;
                    } else {
                        this._showBookMessage('스킬바가 가득 찼습니다.', false);
                        return;
                    }
                }
                this._save(player);
                this._renderBookUI(player);
                // 상세 패널 다시 표시
                setTimeout(() => {
                    const row = document.querySelector(`.sb-tree-row[data-id="${skillId}"]`);
                    if (row) { row.classList.add('selected'); this._showSkillDetail(skillId, player, popup); }
                }, 50);
            });
        } else {
            actEl.innerHTML = `<button class="sb-btn-learn" data-id="${skillId}">✨ 스킬 습득하기</button>`;
            actEl.querySelector('.sb-btn-learn').addEventListener('click', () => {
                const result = this.learnSkill(skillId, player);
                this._showBookMessage(result.message, result.success);
                if (result.success) {
                    this._renderBookUI(player);
                    setTimeout(() => {
                        const row = document.querySelector(`.sb-tree-row[data-id="${skillId}"]`);
                        if (row) { row.classList.add('selected'); this._showSkillDetail(skillId, player, popup); }
                    }, 50);
                }
            });
        }
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
     * HUD 스킬바 업데이트 (초기 패널 버전)
     */
    updateSkillBarHUD() {
        // ===== 모바일 HUD 스킬 버튼 동기화 =====
        for (let i = 0; i < 4; i++) {
            // --- 모바일/터치 HUD 스킬 버튼 (hud-skill-0~3) ---
            const mSlot = document.getElementById(`hud-skill-${i}`);
            if (!mSlot) continue;

            const skillId = this.skillBar[i];
            // cd-overlay 요소가 textContent로 덮어씌워지지 않도록 보존
            let mCdOverlay = mSlot.querySelector('.cd-overlay');

            if (skillId) {
                const skill = this.SKILLS[skillId];
                // 이모지 아이콘을 텍스트로 표시 (cd-overlay 보존)
                // 기존 자식 중 cd-overlay가 아닌 텍스트 노드만 업데이트
                const existingText = Array.from(mSlot.childNodes).find(n => n.nodeType === 3);
                if (existingText) {
                    existingText.textContent = skill.icon;
                } else {
                    // 텍스트 노드가 없으면 맨 앞에 추가
                    mSlot.insertBefore(document.createTextNode(skill.icon), mSlot.firstChild);
                }
                mSlot.classList.remove('empty');

                // 쿨다운 오버레이 복구 (textContent로 삭제된 경우)
                if (!mCdOverlay) {
                    mCdOverlay = document.createElement('span');
                    mCdOverlay.className = 'cd-overlay';
                    mSlot.appendChild(mCdOverlay);
                }

                const remaining = this.cooldowns[skillId] || 0;
                if (remaining > 0) {
                    const pct = (remaining / skill.cooldown) * 100;
                    mCdOverlay.style.height = `${pct}%`;
                    // 쿨타임 숫자 표시
                    mSlot.classList.add('on-cooldown');
                    mSlot.dataset.cd = Math.ceil(remaining);
                } else {
                    mCdOverlay.style.height = '0%';
                    mSlot.classList.remove('on-cooldown');
                    mSlot.dataset.cd = '';
                }
            } else {
                // 빈 슬롯
                const existingText = Array.from(mSlot.childNodes).find(n => n.nodeType === 3);
                if (existingText) existingText.textContent = '';
                mSlot.classList.add('empty');
                if (mCdOverlay) mCdOverlay.style.height = '0%';
                mSlot.classList.remove('on-cooldown');
                mSlot.dataset.cd = '';
            }
        }
    }

}

// 전역 인스턴스
const skillManager = new SkillManager();
