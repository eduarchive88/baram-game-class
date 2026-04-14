/**
 * PartyManager.js - 파티 시스템 관리자
 * Firebase Realtime Database를 이용한 실시간 파티 공유 및 상태 동기화
 * 기능: 생성/초대/수락/탈퇴, EXP 공유, 근접 플레이어 감지, HUD, 파티 패널 UI
 */

class PartyManager {
    constructor() {
        this.partyId = null;
        this.members = new Map(); // uid -> { nickname, job, hp, maxHp, mp, maxMp, level, mapId }
        this.partyRef = null;
        this.invitesRef = null;
        this.localUid = null;
        this.onPartyUpdate = null; // UI 업데이트 콜백

        // 파티 패널 표시 여부
        this.isPanelOpen = false;

        // 근접 플레이어 캐시
        this._nearbyPlayers = [];

        console.log('[PartyManager] 초기화 완료');
    }

    /**
     * 초기화
     * @param {string} uid - 로컬 유저 UID
     * @param {string} sessionCode - 현재 세션 코드
     */
    init(uid, sessionCode) {
        this.localUid = uid;
        this.sessionCode = sessionCode;
        this.invitesRef = rtdb.ref(`sessions/${sessionCode}/invites/${uid}`);
        
        // 초대 리스너 설정
        this._setupInviteListener();
    }

    // ===== 파티 생성/가입/탈퇴 =====

    /**
     * 파티 생성
     */
    async createParty() {
        if (this.partyId) return { success: false, message: '이미 파티에 소속되어 있습니다.' };

        const newPartyRef = rtdb.ref(`sessions/${this.sessionCode}/parties`).push();
        this.partyId = newPartyRef.key;
        this.partyRef = newPartyRef;

        // 파티장 등록
        await this.partyRef.child('members').child(this.localUid).set(true);
        await this.partyRef.child('leader').set(this.localUid);

        this._setupPartyListener();
        if (window.showGameMessage) window.showGameMessage('🎉 파티를 생성했습니다!', '#FFD700');
        soundManager.play('skill_buff');
        return { success: true, partyId: this.partyId };
    }

    /**
     * 파티 초대 보내기
     * @param {string} targetUid - 대상 유저 UID
     * @param {string} nickname - 파티장 닉네임
     */
    async sendInvite(targetUid, nickname) {
        if (!this.partyId) {
            const res = await this.createParty();
            if (!res.success) return res;
        }

        // 파티원 수 제한 (최대 4인)
        if (this.members.size >= 4) {
            return { success: false, message: '파티가 가득 찼습니다. (최대 4인)' };
        }

        const inviteData = {
            partyId: this.partyId,
            from: nickname,
            fromUid: this.localUid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        await rtdb.ref(`sessions/${this.sessionCode}/invites/${targetUid}`).push(inviteData);
        soundManager.play('click');
        return { success: true, message: `${targetUid}에게 초대를 보냈습니다.` };
    }

    /**
     * 파티 가입 (초대 수락)
     * @param {string} partyId 
     * @param {string} inviteKey 
     */
    async joinParty(partyId, inviteKey) {
        if (this.partyId) return { success: false, message: '이미 파티에 소속되어 있습니다.' };

        this.partyId = partyId;
        this.partyRef = rtdb.ref(`sessions/${this.sessionCode}/parties/${partyId}`);

        // 멤버 추가
        await this.partyRef.child('members').child(this.localUid).set(true);
        
        // 초대 데이터 삭제
        if (inviteKey) {
            this.invitesRef.child(inviteKey).remove();
        }

        this._setupPartyListener();
        soundManager.play('skill_buff');
        if (window.showGameMessage) window.showGameMessage('✅ 파티에 참가했습니다!', '#80FF80');
        return { success: true };
    }

    /**
     * 파티 탈퇴
     */
    async leaveParty() {
        if (!this.partyId) return;

        // 리스너 해제
        if (this.partyRef) {
            this.partyRef.child('members').off();
            this.partyRef.child('stats').off();
            // 동기화 데이터 제거
            this.partyRef.child('stats').child(this.localUid).remove();
            // 멤버 목록에서 제거
            await this.partyRef.child('members').child(this.localUid).remove();
        }

        this.partyId = null;
        this.partyRef = null;
        this.members.clear();
        
        if (this.onPartyUpdate) this.onPartyUpdate();
        this.renderPartyHUD();
        if (window.showGameMessage) window.showGameMessage('파티에서 탈퇴했습니다.', '#FF8080');
    }

    // ===== 파티 소속 여부 및 정보 =====

    /**
     * 파티 소속 여부 확인
     */
    isInParty() {
        return !!this.partyId;
    }

    /**
     * 같은 맵에 있는 파티원 UID 목록 반환
     * @param {string} currentMapId - 현재 맵 ID
     */
    getSameMapMembers(currentMapId) {
        const result = [];
        this.members.forEach((stats, uid) => {
            if (uid !== this.localUid && stats.mapId === currentMapId) {
                result.push(uid);
            }
        });
        return result;
    }

    /**
     * 파티원 수에 따른 EXP 공유 비율 반환
     * 2인: 1.1배, 3인: 1.2배, 4인: 1.3배 (솔로: 1.0배)
     */
    getExpShareRatio() {
        if (!this.partyId) return 1.0;
        const size = this.members.size;
        if (size <= 1) return 1.0;
        return 1.0 + (size - 1) * 0.1; // 2인 1.1, 3인 1.2, 4인 1.3
    }

    // ===== 근접 플레이어 감지 =====

    /**
     * 5타일 이내 비파티 원격 플레이어 감지
     * @param {Player} localPlayer - 로컬 플레이어
     * @param {Map} remotePlayers - NetworkManager.remotePlayers
     * @returns {Array} 근처 플레이어 목록 [{uid, nickname, job, level, distance}]
     */
    getNearbyPlayers(localPlayer, remotePlayers) {
        const RANGE = 5; // 5타일 반경
        const nearby = [];

        if (!remotePlayers) return nearby;

        remotePlayers.forEach((rp, uid) => {
            // 이미 파티원이면 제외
            if (this.members.has(uid)) return;

            const dx = Math.abs(rp.tileX - localPlayer.tileX);
            const dy = Math.abs(rp.tileY - localPlayer.tileY);
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= RANGE) {
                nearby.push({
                    uid,
                    nickname: rp.nickname,
                    job: rp.job,
                    level: rp.level || 1,
                    distance: Math.round(dist)
                });
            }
        });

        this._nearbyPlayers = nearby;
        return nearby;
    }

    // ===== 실시간 동기화 =====

    /**
     * 실시간 능력치 동기화 (네트워크 동기화 주기와 맞춤)
     */
    syncMyStats(player) {
        if (!this.partyId || !this.partyRef) return;

        this.partyRef.child('stats').child(this.localUid).update({
            nickname: player.nickname,
            job: player.job,
            hp: player.stats.hp,
            maxHp: player.stats.maxHp,
            mp: player.stats.mp,
            maxMp: player.stats.maxMp,
            level: player.level,
            mapId: window.game?.mapManager?.mapId || 'unknown',
            lastUpdate: firebase.database.ServerValue.TIMESTAMP
        });
    }

    // ===== 파티 리스너 =====

    /**
     * 파티 데이터 모니터링
     */
    _setupPartyListener() {
        if (!this.partyRef) return;

        // 파티원 목록 및 상태 모니터링
        this.partyRef.child('stats').on('value', (snap) => {
            const data = snap.val();
            if (!data) return;

            this.members.clear();
            for (const [uid, stats] of Object.entries(data)) {
                this.members.set(uid, stats);
            }

            if (this.onPartyUpdate) this.onPartyUpdate();
            this.renderPartyHUD();
        });

        // 파티 해체 또는 멤버 탈퇴 감지용
        this.partyRef.child('members').on('child_removed', (snap) => {
            if (snap.key === this.localUid) {
                // 강퇴당했거나 파티가 깨짐
                this.leaveParty();
            } else {
                this.members.delete(snap.key);
                if (this.onPartyUpdate) this.onPartyUpdate();
                this.renderPartyHUD();
            }
        });

        // 접속 종료 시 자동 탈퇴 예약
        this.partyRef.child('members').child(this.localUid).onDisconnect().remove();
        this.partyRef.child('stats').child(this.localUid).onDisconnect().remove();
    }

    // ===== 초대 리스너 =====

    /**
     * 초대 시스템 감시
     */
    _setupInviteListener() {
        if (!this.invitesRef) return;

        this.invitesRef.on('child_added', (snap) => {
            const invite = snap.val();
            const inviteKey = snap.key;

            // UI 알림
            if (window.showGameMessage) {
                window.showGameMessage(`✉️ ${invite.from}님으로부터 파티 초대! (P키로 파티 패널 열기)`, '#FFD700');
            }
            soundManager.play('item');
            
            // 전역 상태에 임시 저장
            this.lastInvite = { ...invite, key: inviteKey };
        });
    }

    /**
     * 마지막 초대 수락
     */
    async acceptLastInvite() {
        if (this.lastInvite) {
            await this.joinParty(this.lastInvite.partyId, this.lastInvite.key);
            this.lastInvite = null;
        }
    }

    // ===== 파티 HUD 렌더링 =====

    /**
     * 파티 HUD (좌측 상단 파티원 목록)
     */
    renderPartyHUD() {
        const container = document.getElementById('party-hud');
        if (!container) return;

        if (!this.partyId || this.members.size === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        let html = `<div class="party-hud-title">👥 파티 (${this.members.size}/4)</div>`;

        this.members.forEach((m, uid) => {
            const isMe = uid === this.localUid;
            const hpRatio = Math.max(0, (m.hp / m.maxHp) * 100);
            const mpRatio = Math.max(0, (m.mp / m.maxMp) * 100);
            const isLowHp = hpRatio < 25;

            // 같은 맵이면 "함께", 다른 맵이면 맵 이름
            const currentMapId = window.game?.mapManager?.mapId || '';
            const mapLabel = m.mapId === currentMapId ? '함께' : (m.mapId || '?');

            html += `
                <div class="party-member-card ${isMe ? 'party-me' : ''} ${isLowHp ? 'party-danger' : ''}">
                    <div class="party-member-header">
                        <span class="party-member-name">${isMe ? '👤 ' : ''}${m.nickname || '???'}</span>
                        <span class="party-member-level">Lv.${m.level || 1}</span>
                    </div>
                    <div class="party-stats-bars">
                        <div class="party-bar-container" title="HP: ${Math.floor(m.hp)}/${m.maxHp}">
                            <div class="party-bar-fill hp" style="width: ${hpRatio}%"></div>
                        </div>
                        <div class="party-bar-container" title="MP: ${Math.floor(m.mp)}/${m.maxMp}">
                            <div class="party-bar-fill mp" style="width: ${mpRatio}%"></div>
                        </div>
                    </div>
                    <div class="party-member-map">${mapLabel}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // ===== 파티 패널 UI =====

    /**
     * 파티 패널 토글 (P키)
     * @param {Player} localPlayer - 로컬 플레이어
     * @param {Map} remotePlayers - NetworkManager.remotePlayers
     */
    togglePanel(localPlayer, remotePlayers) {
        this.isPanelOpen = !this.isPanelOpen;

        if (this.isPanelOpen) {
            this._renderPanel(localPlayer, remotePlayers);
        } else {
            this._closePanel();
        }
    }

    /**
     * 파티 패널 렌더링
     */
    _renderPanel(localPlayer, remotePlayers) {
        // 기존 패널 제거
        this._closePanel();

        const panel = document.createElement('div');
        panel.id = 'party-panel';
        panel.className = 'game-popup-panel';
        panel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 340px; max-height: 460px; overflow-y: auto;
            background: linear-gradient(135deg, rgba(20,15,40,0.97), rgba(30,25,60,0.95));
            border: 2px solid rgba(180,160,255,0.4); border-radius: 12px;
            padding: 20px; z-index: 10000; color: #e0d8ff;
            font-family: 'Noto Sans KR', sans-serif;
            box-shadow: 0 0 30px rgba(120,80,255,0.3);
        `;

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom: 1px solid rgba(180,160,255,0.2); padding-bottom:10px;">
                <h3 style="margin:0; color:#c8b8ff; font-size:16px;">👥 파티 시스템</h3>
                <button onclick="partyManager._closePanel()" style="background:none; border:none; color:#ff8080; font-size:18px; cursor:pointer;">&times;</button>
            </div>
        `;

        // 파티 상태
        if (this.isInParty()) {
            html += `<div style="background: rgba(80,255,120,0.1); border: 1px solid rgba(80,255,120,0.3); border-radius:8px; padding:10px; margin-bottom:12px;">
                <div style="font-size:13px; color:#80ff80;">✅ 파티 참가 중 (${this.members.size}/4명)</div>
                <button onclick="partyManager.leaveParty(); partyManager._closePanel();" style="
                    margin-top:8px; padding:6px 14px; background: rgba(255,80,80,0.2); border: 1px solid rgba(255,80,80,0.5);
                    color:#ff8080; border-radius:6px; cursor:pointer; font-size:12px;
                ">탈퇴하기</button>
            </div>`;

            // 파티원 목록
            html += `<div style="margin-bottom:12px;"><div style="font-size:12px; color:#a098cc; margin-bottom:6px;">파티원 목록</div>`;
            this.members.forEach((m, uid) => {
                const isMe = uid === this.localUid;
                const hpP = Math.round((m.hp / m.maxHp) * 100);
                html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:rgba(255,255,255,0.05); border-radius:6px; margin-bottom:4px;">
                    <span style="font-size:13px;">${isMe ? '👤' : '🧑'} ${m.nickname} <span style="color:#8888cc; font-size:11px;">Lv.${m.level}</span></span>
                    <span style="font-size:11px; color:${hpP > 50 ? '#80ff80' : hpP > 25 ? '#ffcc00' : '#ff4040'};">HP ${hpP}%</span>
                </div>`;
            });
            html += `</div>`;
        } else {
            html += `<div style="background: rgba(255,200,80,0.1); border: 1px solid rgba(255,200,80,0.3); border-radius:8px; padding:10px; margin-bottom:12px;">
                <div style="font-size:13px; color:#ffd080;">파티에 소속되어 있지 않습니다.</div>
                <button onclick="partyManager.createParty().then(() => { if(typeof localPlayer !== 'undefined' && typeof networkManager !== 'undefined') partyManager._renderPanel(localPlayer, networkManager.remotePlayers); });" style="
                    margin-top:8px; padding:6px 14px; background: rgba(80,200,255,0.2); border: 1px solid rgba(80,200,255,0.5);
                    color:#80d0ff; border-radius:6px; cursor:pointer; font-size:12px;
                ">파티 생성</button>
            </div>`;
        }

        // 초대 알림
        if (this.lastInvite) {
            html += `<div style="background: rgba(255,215,0,0.15); border: 1px solid rgba(255,215,0,0.4); border-radius:8px; padding:10px; margin-bottom:12px;">
                <div style="font-size:13px; color:#ffd700;">✉️ ${this.lastInvite.from}님의 초대</div>
                <button onclick="partyManager.acceptLastInvite().then(() => partyManager._closePanel());" style="
                    margin-top:8px; padding:6px 14px; background: rgba(80,255,120,0.2); border: 1px solid rgba(80,255,120,0.5);
                    color:#80ff80; border-radius:6px; cursor:pointer; font-size:12px;
                ">수락</button>
            </div>`;
        }

        // 근처 플레이어 목록 (초대 가능)
        if (localPlayer && remotePlayers) {
            const nearby = this.getNearbyPlayers(localPlayer, remotePlayers);
            if (nearby.length > 0) {
                html += `<div style="margin-bottom:12px;">
                    <div style="font-size:12px; color:#a098cc; margin-bottom:6px;">🔍 근처 플레이어 (5타일 이내)</div>`;
                
                nearby.forEach(np => {
                    html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:rgba(255,255,255,0.05); border-radius:6px; margin-bottom:4px;">
                        <span style="font-size:13px;">🧑 ${np.nickname} <span style="color:#8888cc; font-size:11px;">Lv.${np.level} ${np.job}</span></span>
                        <button onclick="partyManager.sendInvite('${np.uid}', '${localPlayer.nickname}').then(r => { if(window.showGameMessage) window.showGameMessage(r.message, r.success ? '#80ff80' : '#ff8080'); });" style="
                            padding:3px 10px; background: rgba(80,200,255,0.2); border: 1px solid rgba(80,200,255,0.4);
                            color:#80d0ff; border-radius:4px; cursor:pointer; font-size:11px;
                        ">초대</button>
                    </div>`;
                });
                html += `</div>`;
            } else {
                html += `<div style="font-size:12px; color:#666; margin-bottom:8px;">근처에 초대할 수 있는 플레이어가 없습니다.</div>`;
            }
        }

        // EXP 보너스 표시
        if (this.isInParty()) {
            const ratio = this.getExpShareRatio();
            html += `<div style="font-size:11px; color:#a0ffa0; text-align:center; border-top: 1px solid rgba(180,160,255,0.2); padding-top:8px;">
                🌟 파티 EXP 보너스: ×${ratio.toFixed(1)} (${this.members.size}인 파티)
            </div>`;
        }

        panel.innerHTML = html;
        document.body.appendChild(panel);
    }

    /**
     * 파티 패널 닫기
     */
    _closePanel() {
        this.isPanelOpen = false;
        const existing = document.getElementById('party-panel');
        if (existing) existing.remove();
    }
}

// 전역 싱글톤
const partyManager = new PartyManager();
