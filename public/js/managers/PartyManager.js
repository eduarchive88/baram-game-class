/**
 * PartyManager.js - 파티 시스템 관리자
 * Firebase Realtime Database를 이용한 실시간 파티 공유 및 상태 동기화
 */

class PartyManager {
    constructor() {
        this.partyId = null;
        this.members = new Map(); // uid -> { nickname, job, hp, maxHp, mp, maxMp, level, mapId }
        this.partyRef = null;
        this.invitesRef = null;
        this.localUid = null;
        this.onPartyUpdate = null; // UI 업데이트 콜백

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

        const inviteData = {
            partyId: this.partyId,
            from: nickname,
            fromUid: this.localUid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        await rtdb.ref(`sessions/${this.sessionCode}/invites/${targetUid}`).push(inviteData);
        return { success: true, message: '초대를 보냈습니다.' };
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
            // 동기화 데이터 제거
            this.partyRef.child('stats').child(this.localUid).remove();
            // 멤버 목록에서 제거
            await this.partyRef.child('members').child(this.localUid).remove();
        }

        this.partyId = null;
        this.partyRef = null;
        this.members.clear();
        
        if (this.onPartyUpdate) this.onPartyUpdate();
    }

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
            mapId: window.game?.mapManager?.currentMapId || 'unknown',
            lastUpdate: firebase.database.ServerValue.TIMESTAMP
        });
    }

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

    /**
     * 파티 HUD 렌더링
     */
    renderPartyHUD() {
        const container = document.getElementById('party-hud');
        if (!container) return;

        if (!this.partyId || this.members.size === 0) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        this.members.forEach((m, uid) => {
            const isMe = uid === this.localUid;
            const hpRatio = (m.hp / m.maxHp) * 100;
            const mpRatio = (m.mp / m.maxMp) * 100;

            html += `
                <div class="party-member-card" style="${isMe ? 'border-left-color: var(--gold);' : ''}">
                    <div class="party-member-header">
                        <span class="party-member-name">${isMe ? '👤 ' : ''}${m.nickname}</span>
                        <span class="party-member-level">Lv.${m.level}</span>
                    </div>
                    <div class="party-stats-bars">
                        <div class="party-bar-container" title="HP: ${m.hp}/${m.maxHp}">
                            <div class="party-bar-fill hp" style="width: ${hpRatio}%"></div>
                        </div>
                        <div class="party-bar-container" title="MP: ${m.mp}/${m.maxMp}">
                            <div class="party-bar-fill mp" style="width: ${mpRatio}%"></div>
                        </div>
                    </div>
                    <div class="party-member-map">${m.mapId}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * 초대 시스템 감시
     */
    _setupInviteListener() {
        if (!this.invitesRef) return;

        this.invitesRef.on('child_added', (snap) => {
            const invite = snap.val();
            const inviteKey = snap.key;

            // UI 알림 (기존 팝업 시스템 사용 권장)
            if (window.showGameMessage) {
                window.showGameMessage(`✉️ ${invite.from}님으로부터 파티 초대! (수락: P키)`, '#FFD700');
            }
            
            // 전역 상태에 임시 저장 (키 입력으로 수락하기 위함)
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
}

// 전역 싱글톤
const partyManager = new PartyManager();
