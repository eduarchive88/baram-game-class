/**
 * NetworkManager.js - 실시간 멀티플레이 네트워크 관리자
 * Firebase Realtime Database를 통한 위치/상태 동기화
 * 
 * 역할: 로컬 플레이어 위치 브로드캐스트 + 원격 플레이어 수신/관리
 */

class NetworkManager {
    constructor() {
        // 현재 맵의 플레이어들 참조
        this.playersRef = null;
        // 접속 상태 참조
        this.presenceRef = null;
        // 원격 플레이어 맵 (uid -> RemotePlayer)
        this.remotePlayers = new Map();
        // 로컬 유저 UID
        this.localUid = null;
        // 현재 맵 ID
        this.currentMapId = null;
        // 위치 업데이트 주기 (ms)
        this.SYNC_INTERVAL = 100; // 100ms = 초당 10번
        // 세션 관련
        this.sessionCode = null;
        this.isTeacher = false;
        this.envRef = null;
        this.teacherPresent = false;

        console.log('[NetworkManager] 초기화 완료');
    }

    /**
     * 세션 정보 설정 및 환경 Ref 초기화
     * @param {string} sessionCode 
     * @param {boolean} isTeacher 
     */
    initSession(sessionCode, isTeacher) {
        this.sessionCode = sessionCode;
        this.isTeacher = isTeacher;
        this.envRef = rtdb.ref(`sessions/${sessionCode}/environment`);
        
        // 교사 존재 여부 감시 (실제로 교사가 접속 중인지)
        const teacherPresenceRef = rtdb.ref(`sessions/${sessionCode}/teacher_online`);
        
        if (this.isTeacher) {
            teacherPresenceRef.set(true);
            teacherPresenceRef.onDisconnect().remove(); // 교사 종료 시 제거
            this.teacherPresent = true;
        } else {
            teacherPresenceRef.on('value', (snap) => {
                this.teacherPresent = snap.val() === true;
                console.log(`[NetworkManager] 교사 접속 상태: ${this.teacherPresent}`);
            });
        }
    }

    /**
     * 맵 접속 - RTDB 리스너 바인딩
     * @param {string} mapId - 맵 ID
     * @param {string} uid - 로컬 유저 UID
     * @param {Object} playerData - 초기 플레이어 데이터
     */
    joinMap(mapId, uid, playerData) {
        // 이전 맵 리스너 정리
        this.leaveMap();

        this.localUid = uid;
        this.currentMapId = mapId;
        
        // 맵별 플레이어 정보 (세션 하위로 관리)
        this.playersRef = rtdb.ref(`sessions/${this.sessionCode}/maps/${mapId}/players`);

        // 로컬 플레이어 접속 등록
        const myRef = this.playersRef.child(uid);
        myRef.set({
            nickname: playerData.nickname,
            job: playerData.job,
            x: playerData.x,
            y: playerData.y,
            direction: playerData.direction || 'down',
            isMoving: false,
            level: playerData.level || 1,
            hp: playerData.hp || 150,
            maxHp: playerData.maxHp || 150,
            lastUpdate: firebase.database.ServerValue.TIMESTAMP,
        });

        // 접속 해제 시 자동 삭제 (presence 시스템)
        myRef.onDisconnect().remove();

        // 원격 플레이어 추가 리스너
        const onChildAdded = this.playersRef.on('child_added', (snap) => {
            if (snap.key === this.localUid) return; // 자기 자신 무시
            const data = snap.val();
            if (data) {
                this._addRemotePlayer(snap.key, data);
            }
        });

        // 원격 플레이어 업데이트 리스너
        const onChildChanged = this.playersRef.on('child_changed', (snap) => {
            if (snap.key === this.localUid) return;
            const data = snap.val();
            if (data) {
                this._updateRemotePlayer(snap.key, data);
            }
        });

        // 원격 플레이어 퇴장 리스너
        const onChildRemoved = this.playersRef.on('child_removed', (snap) => {
            if (snap.key === this.localUid) return;
            this._removeRemotePlayer(snap.key);
        });

        // 리스너 추적 (해제용)
        this._listeners.push(
            { ref: this.playersRef, event: 'child_added', cb: onChildAdded },
            { ref: this.playersRef, event: 'child_changed', cb: onChildChanged },
            { ref: this.playersRef, event: 'child_removed', cb: onChildRemoved }
        );

        console.log(`[NetworkManager] 맵 접속: ${mapId} / UID: ${uid}`);
    }

    /**
     * 맵 퇴장 - 리스너 해제 + 데이터 삭제
     */
    leaveMap() {
        // 리스너 해제
        this._listeners.forEach(({ ref, event }) => {
            ref.off(event);
        });
        this._listeners = [];

        // 로컬 플레이어 데이터 삭제
        if (this.playersRef && this.localUid) {
            this.playersRef.child(this.localUid).remove();
        }

        // 원격 플레이어 초기화
        this.remotePlayers.clear();
        this.playersRef = null;
        this.currentMapId = null;
    }

    /**
     * 로컬 플레이어 위치 브로드캐스트 (주기적 호출)
     * @param {Player} player - 로컬 플레이어 엔티티
     */
    syncPosition(player) {
        if (!this.playersRef || !this.localUid) return;

        const now = Date.now();
        if (now - this.lastSyncTime < this.SYNC_INTERVAL) return;
        this.lastSyncTime = now;

        // RTDB에 위치 업데이트
        this.playersRef.child(this.localUid).update({
            x: player.x,
            y: player.y,
            tileX: player.tileX,
            tileY: player.tileY,
            direction: player.direction,
            isMoving: player.isMoving,
            level: player.level,
            hp: player.stats.hp,
            maxHp: player.stats.maxHp,
            lastUpdate: firebase.database.ServerValue.TIMESTAMP,
        });
    }

    /**
     * 원격 플레이어 추가
     */
    _addRemotePlayer(uid, data) {
        if (this.remotePlayers.has(uid)) return;
        const remote = new RemotePlayer(uid, data);
        this.remotePlayers.set(uid, remote);
        console.log(`[NetworkManager] 원격 플레이어 추가: ${data.nickname || uid}`);
    }

    /**
     * 원격 플레이어 업데이트
     */
    _updateRemotePlayer(uid, data) {
        const remote = this.remotePlayers.get(uid);
        if (remote) {
            remote.updateFromServer(data);
        }
    }

    /**
     * 원격 플레이어 제거
     */
    _removeRemotePlayer(uid) {
        const remote = this.remotePlayers.get(uid);
        if (remote) {
            console.log(`[NetworkManager] 원격 플레이어 퇴장: ${remote.nickname || uid}`);
            this.remotePlayers.delete(uid);
        }
    }

    /**
     * 모든 원격 플레이어 업데이트 (보간)
     * @param {number} dt - 델타 타임
     */
    updateRemotePlayers(dt) {
        this.remotePlayers.forEach(remote => remote.update(dt));
    }

    /**
     * 모든 원격 플레이어 렌더링
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera - 카메라 { x, y }
     */
    renderRemotePlayers(ctx, camera) {
        this.remotePlayers.forEach(remote => remote.render(ctx, camera));
    }

    /**
     * 현재 접속 중인 플레이어 수 (나 포함)
     */
    getPlayerCount() {
        return this.remotePlayers.size + 1;
    }

    /**
     * 자원 정리
     */
    destroy() {
        this.leaveMap();
        console.log('[NetworkManager] 자원 정리 완료');
    }
}

// 전역 싱글톤
const networkManager = new NetworkManager();
