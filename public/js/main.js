/**
 * main.js - 게임 진입 + 게임 루프 통합 컨트롤러
 * 바람의 나라 교육용 RPG - Phase 2 게임 엔진 통합
 * 
 * 역할: Firebase Auth → 캐릭터 생성/로드 → 게임 루프 시작
 */

// ============================================================
// 전역 상태
// ============================================================
let localPlayer = null;       // 로컬 플레이어 엔티티
let mapManager = null;        // 맵 관리자
let inputManager = null;      // 입력 관리자
let gameCanvas = null;        // 게임 캔버스
let gameCtx = null;           // 캔버스 컨텍스트
let gameRunning = false;      // 게임 루프 실행 중 여부
let lastTime = 0;             // 이전 프레임 시간

// 게임 UI 전역 객체 (NPC 대화 등에서 사용)
window.gameUI = {
    dialogVisible: false,
    dialogName: '',
    dialogText: '',
    showDialog(name, text) {
        this.dialogVisible = true;
        this.dialogName = name;
        this.dialogText = text;
        renderDialogUI();
    },
    hideDialog() {
        this.dialogVisible = false;
        renderDialogUI();
    }
};

// ============================================================
// DOM 로드 시 초기화
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Main] 게임 초기화 시작');
    setupAuthUI();

    // Firebase Auth 상태 감지
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log(`[Main] 로그인됨: ${user.email}`);
            // 기존 캐릭터 데이터 확인
            const charData = await loadCharacterData(user.uid);
            if (charData) {
                // 캐릭터가 이미 있으면 바로 게임 시작
                showScreen('game-container');
                startGame(charData, user.uid);
            } else {
                // 캐릭터 생성 화면 표시
                showScreen('character-screen');
                setupCharacterCreation(user);
            }
        } else {
            console.log('[Main] 로그아웃 상태');
            showScreen('auth-screen');
            stopGame();
        }
    });
});

// ============================================================
// 화면 전환
// ============================================================
function showScreen(screenId) {
    ['auth-screen', 'character-screen', 'game-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === screenId ? (id === 'game-container' ? 'block' : '') : 'none';
    });

    // game-container일 때 auth-screen과 character-screen 완전 숨김
    if (screenId === 'game-container') {
        const authScreen = document.getElementById('auth-screen');
        const charScreen = document.getElementById('character-screen');
        if (authScreen) authScreen.style.display = 'none';
        if (charScreen) charScreen.style.display = 'none';
    }
}

// ============================================================
// 인증 UI 설정
// ============================================================
function setupAuthUI() {
    // 로그인/회원가입 탭 전환
    const linkSignup = document.getElementById('link-signup');
    const linkLogin = document.getElementById('link-login');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (linkSignup) {
        linkSignup.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
        });
    }
    if (linkLogin) {
        linkLogin.addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.style.display = 'none';
            loginForm.style.display = 'block';
        });
    }

    // 로그인 버튼
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value.trim();
            const pw = document.getElementById('login-password').value;
            const errorEl = document.getElementById('auth-error');
            errorEl.textContent = '';

            if (!email || !pw) { errorEl.textContent = '이메일과 비밀번호를 입력하세요.'; return; }

            try {
                btnLogin.disabled = true;
                btnLogin.textContent = '로그인 중...';
                await auth.signInWithEmailAndPassword(email, pw);
            } catch (err) {
                errorEl.textContent = getAuthErrorMessage(err.code);
            } finally {
                btnLogin.disabled = false;
                btnLogin.textContent = '로그인';
            }
        });
    }

    // 회원가입 버튼
    const btnSignup = document.getElementById('btn-signup');
    if (btnSignup) {
        btnSignup.addEventListener('click', async () => {
            const email = document.getElementById('signup-email').value.trim();
            const pw = document.getElementById('signup-password').value;
            const pwConfirm = document.getElementById('signup-password-confirm').value;
            const errorEl = document.getElementById('signup-error');
            errorEl.textContent = '';

            if (!email || !pw) { errorEl.textContent = '이메일과 비밀번호를 입력하세요.'; return; }
            if (pw.length < 6) { errorEl.textContent = '비밀번호는 6자 이상이어야 합니다.'; return; }
            if (pw !== pwConfirm) { errorEl.textContent = '비밀번호가 일치하지 않습니다.'; return; }

            try {
                btnSignup.disabled = true;
                btnSignup.textContent = '가입 중...';
                await auth.createUserWithEmailAndPassword(email, pw);
            } catch (err) {
                errorEl.textContent = getAuthErrorMessage(err.code);
            } finally {
                btnSignup.disabled = false;
                btnSignup.textContent = '회원가입';
            }
        });
    }
}

/**
 * Firebase Auth 에러 메시지 한글 변환
 */
function getAuthErrorMessage(code) {
    const msgs = {
        'auth/user-not-found': '등록되지 않은 이메일입니다.',
        'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
        'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
        'auth/invalid-email': '올바른 이메일 형식이 아닙니다.',
        'auth/weak-password': '비밀번호가 너무 약합니다.',
        'auth/too-many-requests': '너무 많은 시도입니다. 잠시 후 다시 시도하세요.',
        'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    };
    return msgs[code] || '오류가 발생했습니다. 다시 시도하세요.';
}

// ============================================================
// 캐릭터 생성
// ============================================================
function setupCharacterCreation(user) {
    let selectedJob = null;

    // 직업 카드 선택
    document.querySelectorAll('.job-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.job-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedJob = card.dataset.job;
            document.getElementById('btn-start-game').disabled = false;
        });
    });

    // 게임 시작 버튼 (캐릭터 생성)
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
        btnStart.addEventListener('click', async () => {
            const nickname = document.getElementById('char-nickname').value.trim();
            const errorEl = document.getElementById('char-error');
            errorEl.textContent = '';

            if (!nickname || nickname.length < 2 || nickname.length > 8) {
                errorEl.textContent = '닉네임은 2~8자로 입력하세요.';
                return;
            }
            if (!selectedJob) {
                errorEl.textContent = '직업을 선택하세요.';
                return;
            }

            try {
                btnStart.disabled = true;
                btnStart.textContent = '캐릭터 생성 중...';

                // 닉네임 중복 체크
                const snapshot = await rtdb.ref('nicknames/' + nickname).once('value');
                if (snapshot.exists()) {
                    errorEl.textContent = '이미 사용 중인 닉네임입니다.';
                    btnStart.disabled = false;
                    btnStart.textContent = '🎮 게임 시작';
                    return;
                }

                // 캐릭터 데이터 저장
                const charData = {
                    nickname: nickname,
                    job: selectedJob,
                    level: 1,
                    exp: 0,
                    gold: 100,
                    map: 'map_000',
                    x: 15,
                    y: 15,
                    createdAt: Date.now(),
                };

                await rtdb.ref('userData/' + user.uid).set(charData);
                await rtdb.ref('nicknames/' + nickname).set(user.uid);

                console.log(`[Main] 캐릭터 생성 완료: ${nickname} (${selectedJob})`);

                // 게임 시작
                showScreen('game-container');
                startGame(charData, user.uid);

            } catch (err) {
                console.error('[Main] 캐릭터 생성 오류:', err);
                errorEl.textContent = '캐릭터 생성 중 오류가 발생했습니다.';
            } finally {
                btnStart.disabled = false;
                btnStart.textContent = '🎮 게임 시작';
            }
        });
    }

    // 로그아웃 버튼
    const btnLogout = document.getElementById('btn-game-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut();
        });
    }
}

/**
 * RTDB에서 캐릭터 데이터 로드
 */
async function loadCharacterData(uid) {
    try {
        const snapshot = await rtdb.ref('userData/' + uid).once('value');
        return snapshot.exists() ? snapshot.val() : null;
    } catch (err) {
        console.error('[Main] 캐릭터 데이터 로드 오류:', err);
        return null;
    }
}

// ============================================================
// 게임 시작 / 게임 루프
// ============================================================
async function startGame(charData, uid) {
    console.log('[Main] 게임 시작 준비...');

    // 캔버스 설정
    gameCanvas = document.getElementById('game-canvas');
    gameCtx = gameCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 에셋 로딩
    await assetManager.loadAll();

    // 매니저 초기화
    mapManager = new MapManager(gameCanvas, gameCtx);
    inputManager = new InputManager();

    // 플레이어 생성
    localPlayer = new Player(charData.nickname, charData.job, uid);
    const spawnMap = charData.map || 'map_000';
    mapManager.loadMap(spawnMap);

    // 스폰 위치 설정
    const spawnX = charData.x || mapManager.currentMap.spawnX;
    const spawnY = charData.y || mapManager.currentMap.spawnY;
    localPlayer.setPosition(spawnX, spawnY);

    // HUD 초기화
    updateHUD();

    // 게임 루프 시작
    gameRunning = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);

    console.log(`[Main] 🎮 게임 시작! ${charData.nickname} (${charData.job}) @ ${mapManager.currentMap.name}`);
}

/**
 * 캔버스 크기 조정 (반응형)
 */
function resizeCanvas() {
    if (!gameCanvas) return;
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;

    // 픽셀아트 렌더링 품질 보장
    gameCtx.imageSmoothingEnabled = false;
}

/**
 * 메인 게임 루프 (requestAnimationFrame)
 */
function gameLoop(timestamp) {
    if (!gameRunning) return;

    // 델타 타임 계산 (초 단위)
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // 최대 50ms cap
    lastTime = timestamp;

    // === UPDATE ===
    update(dt);

    // === RENDER ===
    render();

    // 다음 프레임
    requestAnimationFrame(gameLoop);
}

/**
 * 게임 로직 업데이트
 */
function update(dt) {
    // 입력 업데이트
    inputManager.update();

    // 플레이어 업데이트
    localPlayer.update(dt, inputManager, mapManager);

    // 카메라 업데이트 (플레이어 추적)
    mapManager.updateCamera(localPlayer.x, localPlayer.y);

    // 포털 체크
    const portal = mapManager.checkPortal(localPlayer.tileX, localPlayer.tileY);
    if (portal && !localPlayer.isMoving) {
        handlePortal(portal);
    }

    // HUD 업데이트 (매 30프레임에 1번)
    if (Math.random() < 0.03) updateHUD();
}

/**
 * 게임 렌더링
 */
function render() {
    // 화면 클리어
    gameCtx.fillStyle = '#000000';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    // 맵 렌더링
    mapManager.render();

    // 플레이어 렌더링
    localPlayer.render(gameCtx, mapManager.camera);

    // 맵 이름 표시 (좌측 상단)
    if (mapManager.currentMap) {
        gameCtx.save();
        gameCtx.fillStyle = 'rgba(0,0,0,0.5)';
        gameCtx.fillRect(8, 8, 160, 24);
        gameCtx.fillStyle = '#FFD700';
        gameCtx.font = 'bold 12px "Noto Sans KR", sans-serif';
        gameCtx.fillText(`📍 ${mapManager.currentMap.name}`, 16, 24);
        gameCtx.restore();
    }

    // 대화 UI 렌더링
    if (window.gameUI.dialogVisible) {
        renderDialogBox();
    }
}

/**
 * 포털 맵 이동 처리
 */
function handlePortal(portal) {
    console.log(`[Main] 포털 이동: ${portal.targetMap} (${portal.targetX}, ${portal.targetY})`);

    // 새 맵 로드
    mapManager.loadMap(portal.targetMap);
    localPlayer.setPosition(portal.targetX, portal.targetY);

    // RTDB에 위치 저장
    if (localPlayer.uid) {
        rtdb.ref('userData/' + localPlayer.uid).update({
            map: portal.targetMap,
            x: portal.targetX,
            y: portal.targetY,
        });
    }

    updateHUD();
}

/**
 * 게임 중지
 */
function stopGame() {
    gameRunning = false;
    if (inputManager) {
        inputManager.destroy();
        inputManager = null;
    }
    localPlayer = null;
    mapManager = null;
}

// ============================================================
// HUD (Heads-Up Display) 업데이트
// ============================================================
function updateHUD() {
    if (!localPlayer) return;

    const s = localPlayer.stats;

    // HP 바
    const hpFill = document.getElementById('hud-hp-fill');
    const hpText = document.getElementById('hud-hp-text');
    if (hpFill) hpFill.style.width = `${(s.hp / s.maxHp) * 100}%`;
    if (hpText) hpText.textContent = `${s.hp} / ${s.maxHp}`;

    // MP 바
    const mpFill = document.getElementById('hud-mp-fill');
    const mpText = document.getElementById('hud-mp-text');
    if (mpFill) mpFill.style.width = `${(s.mp / s.maxMp) * 100}%`;
    if (mpText) mpText.textContent = `${s.mp} / ${s.maxMp}`;

    // 레벨 / 경험치
    const lvEl = document.getElementById('hud-level');
    if (lvEl) lvEl.textContent = `Lv.${localPlayer.level}`;

    // 금전
    const goldEl = document.getElementById('hud-gold');
    if (goldEl) goldEl.textContent = localPlayer.gold;

    // 닉네임
    const nameEl = document.getElementById('hud-name');
    if (nameEl) nameEl.textContent = `${localPlayer.nickname} (${localPlayer.job})`;
}

// ============================================================
// 대화 UI
// ============================================================
function renderDialogUI() {
    const dialogBox = document.getElementById('dialog-box');
    if (!dialogBox) return;

    if (window.gameUI.dialogVisible) {
        dialogBox.style.display = 'block';
        document.getElementById('dialog-name').textContent = window.gameUI.dialogName;
        document.getElementById('dialog-text').textContent = window.gameUI.dialogText;
    } else {
        dialogBox.style.display = 'none';
    }
}

/**
 * 캔버스 위 대화 박스 렌더링 (폴백)
 */
function renderDialogBox() {
    const ui = window.gameUI;
    const boxW = Math.min(gameCanvas.width - 40, 500);
    const boxH = 80;
    const boxX = (gameCanvas.width - boxW) / 2;
    const boxY = gameCanvas.height - boxH - 80;

    // 반투명 배경
    gameCtx.save();
    gameCtx.fillStyle = 'rgba(10, 10, 30, 0.9)';
    gameCtx.strokeStyle = '#FFD700';
    gameCtx.lineWidth = 2;
    gameCtx.beginPath();
    gameCtx.roundRect(boxX, boxY, boxW, boxH, 8);
    gameCtx.fill();
    gameCtx.stroke();

    // NPC 이름
    gameCtx.fillStyle = '#FFD700';
    gameCtx.font = 'bold 13px "Noto Sans KR", sans-serif';
    gameCtx.fillText(ui.dialogName, boxX + 16, boxY + 22);

    // 대화 내용
    gameCtx.fillStyle = '#e0e0e0';
    gameCtx.font = '12px "Noto Sans KR", sans-serif';
    // 줄바꿈 지원
    const words = ui.dialogText.split('');
    let line = '';
    let lineY = boxY + 44;
    const maxLineW = boxW - 32;
    for (const ch of words) {
        const testLine = line + ch;
        if (gameCtx.measureText(testLine).width > maxLineW) {
            gameCtx.fillText(line, boxX + 16, lineY);
            line = ch;
            lineY += 18;
        } else {
            line = testLine;
        }
    }
    gameCtx.fillText(line, boxX + 16, lineY);

    // 닫기 안내
    gameCtx.fillStyle = '#808090';
    gameCtx.font = '10px "Noto Sans KR", sans-serif';
    gameCtx.fillText('[Space / 터치하여 닫기]', boxX + boxW - 140, boxY + boxH - 10);
    gameCtx.restore();
}

// 대화 닫기 (Space 또는 터치)
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && window.gameUI.dialogVisible) {
        window.gameUI.hideDialog();
        e.preventDefault();
    }
});
document.addEventListener('touchstart', () => {
    if (window.gameUI.dialogVisible) {
        window.gameUI.hideDialog();
    }
}, { passive: true });

console.log('[Main] main.js 로드 완료 (Phase 2 게임 엔진 통합)');
