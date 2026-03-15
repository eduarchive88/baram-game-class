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
        // 리스너 추적 배열 (초기화 누락 수정)
        this._listeners = [];

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
            isDead: player.isDead, // 사망(유령) 상태 추가
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
     * 마스터 클라이언트 UID 반환
     * 1. 교사가 있으면 교사가 마스터
     * 2. 교사가 없으면 접속자 중 UID가 사전순으로 가장 앞선 사람이 마스터
     */
    getMasterUid() {
        // 교사가 접속 중이면 교사가 1순위
        if (this.teacherPresent) {
            // 교사의 UID는 보통 고정되어 있거나 teachers/ 경로에서 확인 가능하지만,
            // 현재 시스템에서는 교사가 접속 시 teacher_online에 기록하므로
            // 교사인 클라이언트 자신이 마스터가 됨.
            if (this.isTeacher) return this.localUid;
            
            // 학생 입장에서는 교사가 마스터이므로, 
            // 몬스터 AI 제어권은 '교사'에게 있음을 알림.
            // (구체적인 교사 UID를 몰라도 '교사 존재' 만으로 학생은 AI 중단 가능)
            return 'TEACHER_OR_UNKNOWN'; 
        }

        // 교사가 없으면 접속자(나 포함) 중 UID 최소값 선출
        let allUids = [this.localUid, ...this.remotePlayers.keys()];
        allUids.sort();
        return allUids[0];
    }

    /**
     * 현재 내가 마스터인지 확인
     */
    isMaster() {
        if (this.isTeacher && this.teacherPresent) return true;
        if (this.teacherPresent && !this.isTeacher) return false;
        return this.getMasterUid() === this.localUid;
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
