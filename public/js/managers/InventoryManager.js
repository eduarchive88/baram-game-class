/**
 * InventoryManager.js - 인벤토리 및 장비 시스템 관리자
 * 바람의 나라 교육용 RPG - 아이템 보관, 장착/해제, UI
 */

class InventoryManager {
    constructor() {
        // 인벤토리 (20칸)
        this.MAX_SLOTS = 20;
        this.items = []; // [{ itemId, quantity }]

        // 장비 슬롯
        this.equipment = {
            weapon: null,   // 아이템 ID
            armor: null,
            accessory: null,
        };

        // UI 상태
        this.isOpen = false;
    }

    // ============================================================
    // 인벤토리 조작
    // ============================================================

    /**
     * 아이템 추가
     * @param {string} itemId - 아이템 ID
     * @param {number} quantity - 수량
     * @returns {boolean} 성공 여부
     */
    addItem(itemId, quantity = 1) {
        const item = shopManager.getItem(itemId);
        if (!item) return false;

        // 소비 아이템은 스택 가능
        if (item.type === 'consumable') {
            const existing = this.items.find(s => s.itemId === itemId);
            if (existing) {
                existing.quantity += quantity;
                this._save();
                return true;
            }
        }

        // 빈 슬롯 확인
        if (this.items.length >= this.MAX_SLOTS) return false;

        this.items.push({ itemId, quantity });
        this._save();
        return true;
    }

    /**
     * 아이템 제거
     * @param {string} itemId - 아이템 ID
     * @param {number} quantity - 수량
     * @returns {boolean} 성공 여부
     */
    removeItem(itemId, quantity = 1) {
        const idx = this.items.findIndex(s => s.itemId === itemId);
        if (idx === -1) return false;

        this.items[idx].quantity -= quantity;
        if (this.items[idx].quantity <= 0) {
            this.items.splice(idx, 1);
        }
        this._save();
        return true;
    }

    /**
     * 아이템 보유 여부
     */
    hasItem(itemId) {
        return this.items.some(s => s.itemId === itemId && s.quantity > 0);
    }

    /**
     * 아이템 수량 조회
     */
    getItemCount(itemId) {
        const slot = this.items.find(s => s.itemId === itemId);
        return slot ? slot.quantity : 0;
    }

    /**
     * 아이템 추가 가능 여부
     */
    canAddItem(itemId) {
        const item = shopManager.getItem(itemId);
        if (!item) return false;

        // 소비 아이템 스택
        if (item.type === 'consumable') {
            const existing = this.items.find(s => s.itemId === itemId);
            if (existing) return true;
        }

        return this.items.length < this.MAX_SLOTS;
    }

    // ============================================================
    // 장비 시스템
    // ============================================================

    /**
     * 장비 착용
     * @param {string} itemId - 아이템 ID
     * @param {Player} player - 플레이어
     * @returns {Object} { success, message }
     */
    equipItem(itemId, player) {
        const item = shopManager.getItem(itemId);
        if (!item) return { success: false, message: '존재하지 않는 아이템입니다.' };
        if (item.type === 'consumable') return { success: false, message: '소비 아이템은 장착할 수 없습니다.' };
        if (!this.hasItem(itemId)) return { success: false, message: '보유하지 않은 아이템입니다.' };
        if (player.level < item.reqLevel) return { success: false, message: `레벨 ${item.reqLevel} 이상 필요합니다.` };

        // 슬롯 결정
        const slot = item.type; // 'weapon' 또는 'armor'

        // 기존 장비 해제
        if (this.equipment[slot]) {
            // 기존 아이템을 인벤토리로 되돌림 (이미 인벤토리에 있으므로 교체 처리)
        }

        this.equipment[slot] = itemId;

        // 플레이어 스탯 재계산
        player.equipment = { ...this.equipment };
        // 사운드: 아이템 장착
        soundManager.play('item');
        this._save();

        return { success: true, message: `${item.name}을(를) 장착했습니다!` };
    }

    /**
     * 장비 해제
     * @param {string} slot - 슬롯 ('weapon', 'armor', 'accessory')
     * @param {Player} player - 플레이어
     * @returns {Object} { success, message }
     */
    unequipItem(slot, player) {
        if (!this.equipment[slot]) {
            return { success: false, message: '장착된 아이템이 없습니다.' };
        }

        const itemId = this.equipment[slot];
        const item = shopManager.getItem(itemId);
        this.equipment[slot] = null;
        // 사운드: 아이템 해제
        soundManager.play('item');

        // 플레이어 장비 업데이트
        player.equipment = { ...this.equipment };
        this._save();

        return { success: true, message: `${item ? item.name : '아이템'}을(를) 해제했습니다.` };
    }

    /**
     * 아이템이 장착 중인지 확인
     */
    isEquipped(itemId) {
        return Object.values(this.equipment).includes(itemId);
    }

    /**
     * 소비 아이템 사용
     * @param {string} itemId - 아이템 ID
     * @param {Player} player - 플레이어
     * @returns {Object} { success, message }
     */
    useItem(itemId, player) {
        const item = shopManager.getItem(itemId);
        if (!item || item.type !== 'consumable') {
            return { success: false, message: '사용할 수 없는 아이템입니다.' };
        }
        if (!this.hasItem(itemId)) {
            return { success: false, message: '보유하지 않은 아이템입니다.' };
        }

        // 효과 적용
        if (item.effect.hp) {
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + item.effect.hp);
        }
        if (item.effect.mp) {
            player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + item.effect.mp);
        }

        // 수량 차감
        this.removeItem(itemId, 1);
        // 사운드: 소비 아이템 사용
        soundManager.play('levelup'); // 또는 적절한 회복음

        return { success: true, message: `${item.name} 사용! ${item.desc}` };
    }

    // ============================================================
    // RTDB 저장/로드
    // ============================================================

    /**
     * 인벤토리 + 장비 RTDB 저장
     */
    _save() {
        if (!localPlayer || !localPlayer.uid) return;
        rtdb.ref('userData/' + localPlayer.uid + '/inventory').set(this.items);
        rtdb.ref('userData/' + localPlayer.uid + '/equipment').set(this.equipment);
    }

    /**
     * RTDB에서 인벤토리/장비 로드
     * @param {Object} data - userData 전체 데이터
     */
    loadFromData(data) {
        if (data.inventory && Array.isArray(data.inventory)) {
            this.items = data.inventory;
        } else {
            this.items = [];
        }
        if (data.equipment) {
            this.equipment = {
                weapon: data.equipment.weapon || null,
                armor: data.equipment.armor || null,
                accessory: data.equipment.accessory || null,
            };
        }
    }

    // ============================================================
    // 인벤토리 UI
    // ============================================================

    /**
     * 인벤토리 열기
     */
    open(player) {
        if (this.isOpen) return;
        this.isOpen = true;
        this._renderInventoryUI(player);
    }

    /**
     * 인벤토리 닫기
     */
    close() {
        this.isOpen = false;
        const overlay = document.getElementById('inventory-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    /**
     * 인벤토리 UI 렌더링
     */
    _renderInventoryUI(player) {
        const overlay = document.getElementById('inventory-overlay');
        if (!overlay) return;
        overlay.style.display = 'flex';

        const popup = overlay.querySelector('.inventory-popup');
        if (!popup) return;

        // 장비 보너스 계산
        const bonus = this._getEquipmentBonus();
        const baseStats = player.stats;

        popup.innerHTML = `
            <div class="inv-header">
                <span class="inv-icon">🎒</span>
                <h3>인벤토리</h3>
                <button class="inv-close-btn" id="inv-close">✕</button>
            </div>

            <!-- 장비 패널 -->
            <div class="inv-equipment">
                <h4>⚔️ 장비</h4>
                <div class="inv-equip-slots">
                    ${this._renderEquipSlot('weapon', '무기')}
                    ${this._renderEquipSlot('armor', '방어구')}
                    ${this._renderEquipSlot('accessory', '악세서리')}
                </div>
                <div class="inv-stats">
                    <span>ATK: ${baseStats.atk}${bonus.atk > 0 ? ` <em class="bonus">+${bonus.atk}</em>` : ''}</span>
                    <span>DEF: ${baseStats.def}${bonus.def > 0 ? ` <em class="bonus">+${bonus.def}</em>` : ''}</span>
                </div>
            </div>

            <!-- 아이템 그리드 -->
            <div class="inv-grid" id="inv-grid"></div>
            <p id="inv-message" class="inv-message"></p>
        `;

        // 닫기 버튼
        popup.querySelector('#inv-close').addEventListener('click', () => this.close());

        // 장비 해제 버튼 이벤트
        popup.querySelectorAll('.inv-unequip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const result = this.unequipItem(btn.dataset.slot, player);
                this._showInvMessage(result.message, result.success);
                if (result.success) this._renderInventoryUI(player);
            });
        });

        // 아이템 그리드 렌더링
        this._renderItemGrid(player);
    }

    /**
     * 장비 슬롯 HTML
     */
    _renderEquipSlot(slot, label) {
        const itemId = this.equipment[slot];
        const item = itemId ? shopManager.getItem(itemId) : null;
        const icon = slot === 'weapon' ? '⚔️' : slot === 'armor' ? '🛡️' : '💍';

        if (item) {
            return `
                <div class="inv-equip-slot equipped">
                    <div class="inv-equip-icon">${icon}</div>
                    <div class="inv-equip-name">${item.name}</div>
                    <button class="inv-unequip-btn" data-slot="${slot}">해제</button>
                </div>
            `;
        } else {
            return `
                <div class="inv-equip-slot empty">
                    <div class="inv-equip-icon">${icon}</div>
                    <div class="inv-equip-name">${label} (비어있음)</div>
                </div>
            `;
        }
    }

    /**
     * 아이템 그리드 렌더링
     */
    _renderItemGrid(player) {
        const grid = document.getElementById('inv-grid');
        if (!grid) return;
        grid.innerHTML = '';

        // 보유 아이템 슬롯
        this.items.forEach(slot => {
            const item = shopManager.getItem(slot.itemId);
            if (!item) return;

            const isEquipped = this.isEquipped(slot.itemId);
            const icon = item.type === 'weapon' ? '⚔️' : item.type === 'armor' ? '🛡️' : '🧪';

            const cell = document.createElement('div');
            cell.className = `inv-cell ${isEquipped ? 'equipped' : ''}`;
            cell.innerHTML = `
                <div class="inv-cell-icon">${icon}</div>
                <div class="inv-cell-name">${item.name}</div>
                ${item.type === 'consumable' ? `<span class="inv-cell-qty">×${slot.quantity}</span>` : ''}
            `;

            // 클릭 이벤트
            cell.addEventListener('click', () => {
                this._showItemActions(slot.itemId, player);
            });

            grid.appendChild(cell);
        });

        // 빈 슬롯
        for (let i = this.items.length; i < this.MAX_SLOTS; i++) {
            const cell = document.createElement('div');
            cell.className = 'inv-cell empty';
            cell.innerHTML = '<div class="inv-cell-icon">·</div>';
            grid.appendChild(cell);
        }
    }

    /**
     * 아이템 액션 팝업 (장착/사용/버리기)
     */
    _showItemActions(itemId, player) {
        const item = shopManager.getItem(itemId);
        if (!item) return;

        const isEquipped = this.isEquipped(itemId);
        let result;

        if (item.type === 'consumable') {
            // 소비 아이템: 즉시 사용
            result = this.useItem(itemId, player);
        } else if (isEquipped) {
            // 장비 중이면 해제
            const slot = item.type;
            result = this.unequipItem(slot, player);
        } else {
            // 미장착이면 장착
            result = this.equipItem(itemId, player);
        }

        this._showInvMessage(result.message, result.success);
        if (result.success) this._renderInventoryUI(player);
    }

    /**
     * 장비 보너스 합산
     */
    _getEquipmentBonus() {
        let bonus = { atk: 0, def: 0 };
        Object.values(this.equipment).forEach(itemId => {
            if (!itemId) return;
            const item = shopManager.getItem(itemId);
            if (item) {
                bonus.atk += item.atk || 0;
                bonus.def += item.def || 0;
            }
        });
        return bonus;
    }

    /**
     * 인벤토리 메시지 표시
     */
    _showInvMessage(message, success) {
        const msgEl = document.getElementById('inv-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `inv-message ${success ? 'success' : 'error'}`;
            setTimeout(() => { msgEl.textContent = ''; }, 2000);
        }
    }
}

// 전역 인스턴스
const inventoryManager = new InventoryManager();
