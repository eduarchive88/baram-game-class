/**
 * ShopManager.js - 상점 시스템 관리자
 * 바람의 나라 교육용 RPG - 아이템 구매/판매
 */

class ShopManager {
    constructor() {
        // 상점 열림 상태
        this.isOpen = false;
        // 현재 탭 (weapon, armor, consumable)
        this.currentTab = 'weapon';
        // DOM 요소 캐시
        this.overlay = null;

        // 아이템 데이터베이스 (전체)
        this.ITEMS = {
            // === 무기 ===
            w01: { id: 'w01', name: '나무 검', type: 'weapon', atk: 3, def: 0, price: 50, sellPrice: 25, reqLevel: 1, desc: '초보 모험가의 기본 무기' },
            w02: { id: 'w02', name: '철 검', type: 'weapon', atk: 8, def: 0, price: 200, sellPrice: 100, reqLevel: 3, desc: '단단한 철로 만든 검' },
            w03: { id: 'w03', name: '강철 대검', type: 'weapon', atk: 15, def: 0, price: 500, sellPrice: 250, reqLevel: 5, desc: '묵직한 강철 대검' },
            w04: { id: 'w04', name: '마법 검', type: 'weapon', atk: 22, def: 2, price: 1000, sellPrice: 500, reqLevel: 8, desc: '마법이 깃든 신비한 검' },
            w05: { id: 'w05', name: '용의 검', type: 'weapon', atk: 35, def: 5, price: 2500, sellPrice: 1250, reqLevel: 12, desc: '용의 이빨로 만든 전설의 검' },
            // === 방어구 ===
            a01: { id: 'a01', name: '가죽 갑옷', type: 'armor', atk: 0, def: 3, price: 60, sellPrice: 30, reqLevel: 1, desc: '기본적인 가죽 방어구' },
            a02: { id: 'a02', name: '사슬 갑옷', type: 'armor', atk: 0, def: 7, price: 250, sellPrice: 125, reqLevel: 3, desc: '철 고리로 엮은 갑옷' },
            a03: { id: 'a03', name: '판금 갑옷', type: 'armor', atk: 0, def: 13, price: 600, sellPrice: 300, reqLevel: 5, desc: '무거운 판금 갑옷' },
            a04: { id: 'a04', name: '미스릴 갑옷', type: 'armor', atk: 2, def: 20, price: 1200, sellPrice: 600, reqLevel: 8, desc: '가볍고 견고한 미스릴 갑옷' },
            a05: { id: 'a05', name: '드래곤 갑옷', type: 'armor', atk: 5, def: 30, price: 3000, sellPrice: 1500, reqLevel: 12, desc: '용의 비늘로 만든 최강 방어구' },
            // === 소비 아이템 ===
            c01: { id: 'c01', name: '빨간 포션', type: 'consumable', effect: { hp: 50 }, price: 30, sellPrice: 15, reqLevel: 1, desc: 'HP 50 회복' },
            c02: { id: 'c02', name: '파란 포션', type: 'consumable', effect: { mp: 30 }, price: 25, sellPrice: 12, reqLevel: 1, desc: 'MP 30 회복' },
            c03: { id: 'c03', name: '만능 물약', type: 'consumable', effect: { hp: 100, mp: 50 }, price: 80, sellPrice: 40, reqLevel: 5, desc: 'HP 100 + MP 50 회복' },
        };
    }

    /**
     * 아이템 정보 조회
     * @param {string} itemId - 아이템 ID
     * @returns {Object|null}
     */
    getItem(itemId) {
        return this.ITEMS[itemId] || null;
    }

    /**
     * 상점 열기
     * @param {Player} player - 로컬 플레이어
     */
    open(player) {
        if (this.isOpen) return;
        this.isOpen = true;
        this.currentTab = 'weapon';
        this._renderShopUI(player);
    }

    /**
     * 상점 닫기
     */
    close() {
        this.isOpen = false;
        const overlay = document.getElementById('shop-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    /**
     * 아이템 구매
     * @param {string} itemId - 아이템 ID
     * @param {Player} player - 플레이어
     * @returns {Object} { success, message }
     */
    buyItem(itemId, player) {
        const item = this.ITEMS[itemId];
        if (!item) return { success: false, message: '존재하지 않는 아이템입니다.' };

        // 레벨 제한 확인
        if (player.level < item.reqLevel) {
            return { success: false, message: `레벨 ${item.reqLevel} 이상 필요합니다.` };
        }

        // 골드 확인
        if (player.gold < item.price) {
            return { success: false, message: '골드가 부족합니다.' };
        }

        // 인벤토리 공간 확인
        if (!inventoryManager.canAddItem(itemId)) {
            return { success: false, message: '인벤토리가 가득 찼습니다.' };
        }

        // 구매 실행
        player.gold -= item.price;
        inventoryManager.addItem(itemId, 1);

        // RTDB 저장
        this._savePlayerGold(player);

        return { success: true, message: `${item.name}을(를) 구매했습니다!` };
    }

    /**
     * 아이템 판매
     * @param {string} itemId - 아이템 ID
     * @param {Player} player - 플레이어
     * @returns {Object} { success, message }
     */
    sellItem(itemId, player) {
        const item = this.ITEMS[itemId];
        if (!item) return { success: false, message: '존재하지 않는 아이템입니다.' };

        // 인벤토리에 있는지 확인
        if (!inventoryManager.hasItem(itemId)) {
            return { success: false, message: '보유하지 않은 아이템입니다.' };
        }

        // 장착 중이면 판매 불가
        if (inventoryManager.isEquipped(itemId)) {
            return { success: false, message: '장착 중인 아이템은 먼저 해제하세요.' };
        }

        // 판매 실행
        player.gold += item.sellPrice;
        inventoryManager.removeItem(itemId, 1);

        // RTDB 저장
        this._savePlayerGold(player);

        return { success: true, message: `${item.name}을(를) ${item.sellPrice}전에 판매했습니다.` };
    }

    /**
     * 골드 RTDB 저장 (Player.saveUserData로 통합)
     */
    _savePlayerGold(player) {
        if (player && player.uid) {
            // 개별 저장이 아닌 플레이어 전체 상태 저장을 호출하여 일관성 유지
            player.saveUserData();
        }
    }

    // ============================================================
    // 상점 UI 렌더링
    // ============================================================

    /**
     * 상점 팝업 UI 렌더링
     */
    _renderShopUI(player) {
        const overlay = document.getElementById('shop-overlay');
        if (!overlay) return;
        overlay.style.display = 'flex';

        const popup = overlay.querySelector('.shop-popup');
        if (!popup) return;

        // 탭 + 아이템 목록 렌더링
        popup.innerHTML = `
            <div class="shop-header">
                <span class="shop-icon">🏪</span>
                <h3>대장장이 상점</h3>
                <button class="shop-close-btn" id="shop-close">✕</button>
            </div>
            <div class="shop-tabs">
                <button class="shop-tab ${this.currentTab === 'weapon' ? 'active' : ''}" data-tab="weapon">⚔️ 무기</button>
                <button class="shop-tab ${this.currentTab === 'armor' ? 'active' : ''}" data-tab="armor">🛡️ 방어구</button>
                <button class="shop-tab ${this.currentTab === 'consumable' ? 'active' : ''}" data-tab="consumable">🧪 소비</button>
            </div>
            <div class="shop-gold">💰 보유 골드: <span id="shop-gold-display">${player.gold}</span> 전</div>
            <div class="shop-items" id="shop-items-list"></div>
            <p id="shop-message" class="shop-message"></p>
        `;

        // 탭 이벤트
        popup.querySelectorAll('.shop-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentTab = tab.dataset.tab;
                this._renderShopUI(player);
            });
        });

        // 닫기 버튼
        popup.querySelector('#shop-close').addEventListener('click', () => this.close());

        // 아이템 목록 렌더링
        this._renderItemList(player);
    }

    /**
     * 현재 탭의 아이템 목록 렌더링
     */
    _renderItemList(player) {
        const listEl = document.getElementById('shop-items-list');
        if (!listEl) return;

        const items = Object.values(this.ITEMS).filter(it => it.type === this.currentTab);
        listEl.innerHTML = '';

        items.forEach(item => {
            const canBuy = player.level >= item.reqLevel && player.gold >= item.price;
            const owned = inventoryManager.getItemCount(item.id);
            const equipped = inventoryManager.isEquipped(item.id);

            const card = document.createElement('div');
            card.className = `shop-item-card ${!canBuy ? 'disabled' : ''}`;

            // 아이템 아이콘 선택
            const icon = item.type === 'weapon' ? '⚔️' : item.type === 'armor' ? '🛡️' : '🧪';

            // 스탯 텍스트
            let statText = '';
            if (item.atk) statText += `ATK+${item.atk} `;
            if (item.def) statText += `DEF+${item.def} `;
            if (item.effect) {
                if (item.effect.hp) statText += `HP+${item.effect.hp} `;
                if (item.effect.mp) statText += `MP+${item.effect.mp} `;
            }

            card.innerHTML = `
                <div class="shop-item-icon">${icon}</div>
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name} ${owned > 0 ? `<span class="shop-owned">(보유: ${owned})</span>` : ''}</div>
                    <div class="shop-item-stat">${statText}</div>
                    <div class="shop-item-desc">${item.desc}</div>
                    <div class="shop-item-req">Lv.${item.reqLevel}${player.level < item.reqLevel ? ' ❌' : ' ✅'}</div>
                </div>
                <div class="shop-item-actions">
                    <div class="shop-item-price">💰 ${item.price}</div>
                    <button class="shop-buy-btn" data-id="${item.id}" ${!canBuy ? 'disabled' : ''}>구매</button>
                    ${owned > 0 && !equipped ? `<button class="shop-sell-btn" data-id="${item.id}">판매 (${item.sellPrice})</button>` : ''}
                </div>
            `;

            listEl.appendChild(card);
        });

        // 구매 버튼 이벤트
        listEl.querySelectorAll('.shop-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const result = this.buyItem(btn.dataset.id, player);
                this._showMessage(result.message, result.success);
                if (result.success) this._renderShopUI(player);
            });
        });

        // 판매 버튼 이벤트
        listEl.querySelectorAll('.shop-sell-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const result = this.sellItem(btn.dataset.id, player);
                this._showMessage(result.message, result.success);
                if (result.success) this._renderShopUI(player);
            });
        });
    }

    /**
     * 상점 메시지 표시
     */
    _showMessage(message, success) {
        const msgEl = document.getElementById('shop-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `shop-message ${success ? 'success' : 'error'}`;
            setTimeout(() => { msgEl.textContent = ''; }, 2000);
        }
        // 골드 업데이트
        const goldEl = document.getElementById('shop-gold-display');
        if (goldEl && localPlayer) goldEl.textContent = localPlayer.gold;
    }
}

// 전역 인스턴스
const shopManager = new ShopManager();
