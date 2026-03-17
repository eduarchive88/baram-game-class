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
        // 리스너 추적 배열
        this._listeners = [];
        this.masterUid = null;

        // 세션 활성화 상태 (교사 제어)
        this.sessionActive = true; 
        
        // 지역 이벤트 큐 (최근 N개의 이벤트만 처리)
        this.eventQueueRef = null;

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
        this.eventQueueRef = rtdb.ref(`sessions/${sessionCode}/events`);
        
        // 교사 존재 여부 감시
        const teacherPresenceRef = rtdb.ref(`sessions/${sessionCode}/teacher_online`);
        // 세션 활성화 상태 감시
        const sessionStatusRef = rtdb.ref(`sessions/${sessionCode}/isActive`);
        
        if (this.isTeacher) {
            teacherPresenceRef.set(true);
            teacherPresenceRef.onDisconnect().remove();
            this.teacherPresent = true;
        } else {
            teacherPresenceRef.on('value', (snap) => {
                this.teacherPresent = snap.val() === true;
            });

            sessionStatusRef.on('value', (snap) => {
                this.sessionActive = (snap.val() !== false); // 기본값 true
                if (!this.sessionActive && window.showGameMessage) {
                    window.showGameMessage('🚫 교사가 멀티플레이 세션을 비활성화했습니다.', '#ff4444');
                }
            });
        }

        // 글로벌 이벤트 리스너 (스킬, 이펙트 등)
        this._setupEventListener();
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
            role: this.isTeacher ? 'teacher' : 'student', // 역할 추가
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

        // 5. 마스터 관리 리스너
        const masterRef = rtdb.ref(`sessions/${this.sessionCode}/maps/${mapId}/master`);
        const onMasterChanged = masterRef.on('value', (snap) => {
            this.masterUid = snap.val();
            console.log(`[NetworkManager] 현재 마스터: ${this.masterUid}`);
            
            // 학생인데 마스터가 없고 내가 1순위라면 마스터 시도
            if (!this.isTeacher && !this.masterUid) {
                this._claimMasterPower(masterRef);
            }
        });

        // 리스너 추적 (해제용)
        this._listeners.push(
            { ref: this.playersRef, event: 'child_added', cb: onChildAdded },
            { ref: this.playersRef, event: 'child_changed', cb: onChildChanged },
            { ref: this.playersRef, event: 'child_removed', cb: onChildRemoved },
            { ref: masterRef, event: 'value', cb: onMasterChanged }
        );

        // 교사라면 즉시 마스터 권한 탈취
        if (this.isTeacher) {
            masterRef.set(this.localUid);
            masterRef.onDisconnect().remove();
        }

        console.log(`[NetworkManager] 맵 접속: ${mapId} / UID: ${uid}`);
    }

    /**
     * 마스터 권한 획득 시도 (학생 간 경쟁 방지 Transaction)
     */
    _claimMasterPower(masterRef) {
        masterRef.transaction((currentMaster) => {
            if (currentMaster === null) {
                return this.localUid;
            }
            return; // 이미 누가 있으면 포기
        }, (error, committed, snapshot) => {
            if (committed) {
                console.log('[NetworkManager] 마스터 권한 획득 성공!');
                masterRef.onDisconnect().remove();
            }
        });
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
            
            // 내가 마스터였다면 마스터 비우기 (다음 사람을 위해)
            const masterRef = rtdb.ref(`sessions/${this.sessionCode}/maps/${this.currentMapId}/master`);
            masterRef.once('value').then(snap => {
                if (snap.val() === this.localUid) {
                    masterRef.remove();
                }
            });
        }

        // 원격 플레이어 초기화
        this.remotePlayers.clear();
        this.playersRef = null;
        this.currentMapId = null;
        this.masterUid = null;
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
            isAttacking: player.isAttacking || false, // 공격 상태 추가
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
        if (window.game && window.game.mapManager) {
            remote.scene = window.game.mapManager;
        }
        this.remotePlayers.set(uid, remote);
        console.log(`[NetworkManager] 원격 플레이어 추가: ${data.nickname || uid}`);
    }

    /**
     * 원격 플레이어 업데이트
     */
    _updateRemotePlayer(uid, data) {
        const remote = this.remotePlayers.get(uid);
        if (remote) {
            if (!remote.scene && window.game && window.game.mapManager) {
                remote.scene = window.game.mapManager;
            }
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

    getMasterUid() {
        return this.masterUid;
    }

    /**
     * 현재 내가 마스터인지 확인
     */
    isMaster() {
        if (!this.localUid || !this.masterUid) return false;
        return this.masterUid === this.localUid;
    }

    /**
     * 접속 중인 모든 플레이어 수 반환 (로컬 + 원격)
     */
    getPlayerCount() {
        return this.remotePlayers.size + 1; // 원격 + 나(로컬)
    }

    /**
     * 글로벌 이벤트 전송 (스킬 시전, 회복 등)
     * @param {string} type - 'skill', 'heal', 'buff', 'chat' 등
     * @param {Object} data - 관련 데이터
     */
    broadcastEvent(type, data) {
        if (!this.eventQueueRef || !this.sessionActive) return;

        this.eventQueueRef.push({
            type,
            data,
            senderUid: this.localUid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        // 이벤트 큐 관리 (너무 오래된 이벤트는 정리 - 마스터가 수행)
        if (this.isMaster()) {
            this.eventQueueRef.limitToLast(20).once('value', (snap) => {
                // 필요시 오래된 데이터 삭제 로직 구현
            });
        }
    }

    /**
     * 타 플레이어의 이벤트 수신 대기
     */
    _setupEventListener() {
        if (!this.eventQueueRef) return;

        // 최근 10초 이내의 이벤트만 실시간 수신
        const now = Date.now();
        this.eventQueueRef.orderByChild('timestamp').startAt(now).on('child_added', (snap) => {
            const event = snap.val();
            if (!event || event.senderUid === this.localUid) return;

            this._handleRemoteEvent(event);
        });
    }

    /**
     * 수신된 원격 이벤트 처리
     */
    _handleRemoteEvent(event) {
        const { type, data, senderUid } = event;
        const remote = this.remotePlayers.get(senderUid);
        
        if (remote && remote.processRemoteEvent) {
            remote.processRemoteEvent(type, data);
        }

        // 특정 이벤트에 대한 전역 처리 (예: 전체 공지 등)
        if (type === 'announcement' && window.showGameMessage) {
            window.showGameMessage(`📢 ${data.text}`, '#00EAFF');
        }
    }

    /**
     * 자원 정리
     */
    destroy() {
        if (this.eventQueueRef) this.eventQueueRef.off();
        this.leaveMap();
        console.log('[NetworkManager] 자원 정리 완료');
    }
}

// 전역 싱글톤
const networkManager = new NetworkManager();
