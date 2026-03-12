/**
 * main.js - 게임 진입 + 게임 루프 통합 컨트롤러
 * 바람의 나라 교육용 RPG - Phase 3 멀티플레이/전투/퀴즈 통합
 */

// ============================================================
// 전역 상태
// ============================================================
let localPlayer = null;       // 로컬 플레이어 엔티티
let mapManager = null;        // 맵 관리자
let inputManager = null;      // 입력 관리자
let combatManager = null;     // 전투 관리자
let gameCanvas = null;        // 게임 캔버스
let gameCtx = null;           // 캔버스 컨텍스트
let gameRunning = false;      // 게임 루프 실행 중 여부
let lastTime = 0;             // 이전 프레임 시간
let hudUpdateCounter = 0;     // HUD 업데이트 카운터

// 게임 UI 전역 객체 (NPC 대화 등)
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
            console.log(`[Main] 로그인됨: ${user.uid}`);

            const savedStudentUid = localStorage.getItem('studentUid');
            const savedStudentName = localStorage.getItem('studentName');

            if (user.isAnonymous && savedStudentUid) {
                // 학생 로그인
                await handleLoginSuccess(savedStudentUid, 'student', savedStudentName);
            } else if (!user.isAnonymous) {
                // 교사 로그인 -> 관리자 페이지로 (또는 교사도 캐릭터를 만들 수 있다면 그대로)
                // 만약 교사가 게임에 들어와버렸다면 admin.html로 이동할 수 있는 버튼을 띄우거나,
                // 여기서는 일단 같이 게임에 접속할 수 있게 하되, admin 이동 기능은 UI로 제공한다고 가정.
                // 편의상 곧바로 admin.html로 리다이렉트 시킬수도 있으나 교사도 테스트를 위해 게임을 할 수 있게 둠.
                await handleLoginSuccess(user.uid, 'teacher', user.email.split('@')[0]);
            }
        } else {
            console.log('[Main] 로그아웃 상태');
            localStorage.removeItem('studentUid');
            localStorage.removeItem('studentName');
            showScreen('auth-screen');
            stopGame();
        }
    });
});

async function handleLoginSuccess(uid, role, name) {
    const charData = await loadCharacterData(uid);
    if (charData) {
        showScreen('game-container');
        startGame(charData, uid);
    } else {
        showScreen('character-screen');
        setupCharacterCreation(uid, role, name);
    }
}

// ============================================================
// 화면 전환
// ============================================================
function showScreen(screenId) {
    ['auth-screen', 'character-screen', 'game-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === screenId ? (id === 'game-container' ? 'block' : '') : 'none';
    });
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
    // 탭 전환 로직
    const tabStudent = document.getElementById('tab-student');
    const tabTeacher = document.getElementById('tab-teacher');
    const studentForm = document.getElementById('student-login-form');
    const teacherLoginForm = document.getElementById('teacher-login-form');
    const teacherSignupForm = document.getElementById('teacher-signup-form');

    if (tabStudent && tabTeacher) {
        tabStudent.addEventListener('click', () => {
            tabStudent.classList.add('active');
            tabTeacher.classList.remove('active');
            tabStudent.style.borderBottom = '3px solid var(--primary-color)';
            tabTeacher.style.borderBottom = '3px solid transparent';
            tabStudent.style.color = 'var(--text-primary)';
            tabTeacher.style.color = 'var(--text-muted)';

            if (studentForm) studentForm.style.display = 'block';
            if (teacherLoginForm) teacherLoginForm.style.display = 'none';
            if (teacherSignupForm) teacherSignupForm.style.display = 'none';
        });

        tabTeacher.addEventListener('click', () => {
            tabTeacher.classList.add('active');
            tabStudent.classList.remove('active');
            tabTeacher.style.borderBottom = '3px solid var(--primary-color)';
            tabStudent.style.borderBottom = '3px solid transparent';
            tabTeacher.style.color = 'var(--text-primary)';
            tabStudent.style.color = 'var(--text-muted)';

            if (studentForm) studentForm.style.display = 'none';
            if (teacherLoginForm) teacherLoginForm.style.display = 'block';
            if (teacherSignupForm) teacherSignupForm.style.display = 'none';
        });
    }

    const linkSignup = document.getElementById('link-signup');
    const linkLogin = document.getElementById('link-login');

    if (linkSignup) {
        linkSignup.addEventListener('click', (e) => {
            e.preventDefault();
            if (teacherLoginForm) teacherLoginForm.style.display = 'none';
            if (teacherSignupForm) teacherSignupForm.style.display = 'block';
        });
    }
    if (linkLogin) {
        linkLogin.addEventListener('click', (e) => {
            e.preventDefault();
            if (teacherSignupForm) teacherSignupForm.style.display = 'none';
            if (teacherLoginForm) teacherLoginForm.style.display = 'block';
        });
    }

    // 학생 로그인 버튼
    const btnStudentLogin = document.getElementById('btn-student-login');
    if (btnStudentLogin) {
        btnStudentLogin.addEventListener('click', async (e) => {
            e.preventDefault();
            const code = document.getElementById('student-session').value.trim();
            const grade = document.getElementById('student-grade').value.trim();
            const cls = document.getElementById('student-class').value.trim();
            const num = document.getElementById('student-num').value.trim();
            const name = document.getElementById('student-name').value.trim();
            const errorEl = document.getElementById('student-auth-error');
            errorEl.textContent = '';

            if (!code || !grade || !cls || !num || !name) {
                errorEl.textContent = '모든 정보를 입력해주세요.'; return;
            }

            try {
                btnStudentLogin.disabled = true;
                btnStudentLogin.textContent = '로그인 중...';

                // 세션 존재 여부 및 학생 확인
                const studentId = `${grade}_${cls}_${num}_${name}`;
                const studentRef = rtdb.ref(`sessions/${code}/students/${studentId}`);
                const snapshot = await studentRef.once('value');

                if (!snapshot.exists()) {
                    errorEl.textContent = '등록되지 않은 학생이거나 세션 코드가 잘못되었습니다.';
                    return;
                }

                const studentUid = `session_${code}_${studentId}`;
                localStorage.setItem('studentUid', studentUid);
                localStorage.setItem('studentName', name);

                // 익명 로그인으로 RTDB 쓰기 권한 확보
                await auth.signInAnonymously();
            } catch (err) {
                errorEl.textContent = '로그인 중 오류가 발생했습니다.';
                console.error(err);
            } finally {
                btnStudentLogin.disabled = false;
                btnStudentLogin.textContent = '🚀 게임 접속';
            }
        });
    }

    // 교사 로그인 버튼
    const btnTeacherLogin = document.getElementById('btn-teacher-login');
    if (btnTeacherLogin) {
        btnTeacherLogin.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const pw = document.getElementById('login-password').value;
            const errorEl = document.getElementById('teacher-auth-error');
            errorEl.textContent = '';
            if (!email || !pw) { errorEl.textContent = '이메일과 비밀번호를 입력하세요.'; return; }
            try {
                btnTeacherLogin.disabled = true;
                btnTeacherLogin.textContent = '로그인 중...';
                await auth.signInWithEmailAndPassword(email, pw);
                window.location.href = 'admin.html';
            } catch (err) {
                errorEl.textContent = getAuthErrorMessage(err.code);
            } finally {
                btnTeacherLogin.disabled = false;
                btnTeacherLogin.textContent = '교사 로그인';
            }
        });
    }

    // 교사 회원가입 버튼
    const btnTeacherSignup = document.getElementById('btn-teacher-signup');
    if (btnTeacherSignup) {
        btnTeacherSignup.addEventListener('click', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const pw = document.getElementById('signup-password').value;
            const pwConfirm = document.getElementById('signup-password-confirm').value;
            const errorEl = document.getElementById('teacher-signup-error');
            errorEl.textContent = '';
            
            if (!name) { errorEl.textContent = '이름을 입력하세요.'; return; }
            if (!email || !pw) { errorEl.textContent = '이메일과 비밀번호를 입력하세요.'; return; }
            if (pw.length < 6) { errorEl.textContent = '비밀번호는 6자 이상이어야 합니다.'; return; }
            if (pw !== pwConfirm) { errorEl.textContent = '비밀번호가 일치하지 않습니다.'; return; }
            
            try {
                btnTeacherSignup.disabled = true;
                btnTeacherSignup.textContent = '가입 중...';
                const userCredential = await auth.createUserWithEmailAndPassword(email, pw);
                
                // 가입 성공 후 프로필(이름) 업데이트
                await userCredential.user.updateProfile({
                    displayName: name
                });
                
                window.location.href = 'admin.html';
            } catch (err) {
                errorEl.textContent = getAuthErrorMessage(err.code);
            } finally {
                btnTeacherSignup.disabled = false;
                btnTeacherSignup.textContent = '가입하기';
            }
        });
    }
}

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
function setupCharacterCreation(uid, role, name) {
    let selectedJob = null;
    document.querySelectorAll('.job-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.job-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedJob = card.dataset.job;
            document.getElementById('btn-start-game').disabled = false;
        });
    });

    const nicknameInput = document.getElementById('char-nickname');
    if (nicknameInput && name) {
        nicknameInput.value = name;
        if (role === 'student') {
            nicknameInput.readOnly = true; // 학생은 본인 이름 그대로 사용
        }
    }

    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
        // 중복 이벤트 리스너 방지
        const newBtnStart = btnStart.cloneNode(true);
        btnStart.parentNode.replaceChild(newBtnStart, btnStart);

        newBtnStart.addEventListener('click', async () => {
            const nickname = document.getElementById('char-nickname').value.trim();
            const errorEl = document.getElementById('char-error');
            errorEl.textContent = '';
            if (!nickname || nickname.length < 2 || nickname.length > 8) {
                errorEl.textContent = '닉네임은 2~8자로 입력하세요.'; return;
            }
            if (!selectedJob) { errorEl.textContent = '직업을 선택하세요.'; return; }

            try {
                newBtnStart.disabled = true;
                newBtnStart.textContent = '캐릭터 생성 중...';

                // 학생은 sessionUid를 쓰기 때문에 닉네임 중복 체크 우회 또는 이름 그대로 사용
                if (role !== 'student') {
                    const snapshot = await rtdb.ref('nicknames/' + nickname).once('value');
                    if (snapshot.exists()) {
                        errorEl.textContent = '이미 사용 중인 닉네임입니다.';
                        newBtnStart.disabled = false; newBtnStart.textContent = '🎮 게임 시작'; return;
                    }
                }

                const charData = {
                    nickname, job: selectedJob, level: 1, exp: 0, gold: 100,
                    map: 'map_000', x: 15, y: 15, createdAt: Date.now(),
                    role: role
                };
                await rtdb.ref('userData/' + uid).set(charData);
                if (role !== 'student') {
                    await rtdb.ref('nicknames/' + nickname).set(uid);
                }
                console.log(`[Main] 캐릭터 생성 완료: ${nickname} (${selectedJob})`);
                showScreen('game-container');
                startGame(charData, uid);
            } catch (err) {
                console.error('[Main] 캐릭터 생성 오류:', err);
                errorEl.textContent = '캐릭터 생성 중 오류가 발생했습니다.';
            } finally {
                newBtnStart.disabled = false; newBtnStart.textContent = '🎮 게임 시작';
            }
        });
    }

    const btnLogout = document.getElementById('btn-game-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
    }
}

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

    // 퀴즈 데이터 로드 (비동기, 게임 시작을 블록하지 않음)
    quizManager.loadQuizzes();

    // 매니저 초기화
    mapManager = new MapManager(gameCanvas, gameCtx);
    inputManager = new InputManager();
    combatManager = new CombatManager();

    // 플레이어 생성
    localPlayer = new Player(charData.nickname, charData.job, uid);
    localPlayer.level = charData.level || 1;
    localPlayer.exp = charData.exp || 0;
    localPlayer.gold = charData.gold || 100;

    // 인벤토리/장비 로드
    inventoryManager.loadFromData(charData);
    localPlayer.equipment = { ...inventoryManager.equipment };

    // 스킬 로드
    skillManager.loadFromData(charData, localPlayer);

    // 맵 로드
    const spawnMap = charData.map || 'map_000';
    mapManager.loadMap(spawnMap);
    const spawnX = charData.x || mapManager.currentMap.spawnX;
    const spawnY = charData.y || mapManager.currentMap.spawnY;
    localPlayer.setPosition(spawnX, spawnY);

    // 몬스터 스폰
    combatManager.spawnMonsters(mapManager.currentMap);

    // 네트워크 접속
    networkManager.joinMap(spawnMap, uid, {
        nickname: charData.nickname,
        job: charData.job,
        x: localPlayer.x,
        y: localPlayer.y,
        direction: 'down',
        level: localPlayer.level,
        hp: localPlayer.stats.hp,
        maxHp: localPlayer.stats.maxHp,
    });

    // 접속자 수 표시
    updatePlayerCount();

    // HUD 초기화
    updateHUD();
    skillManager.updateSkillBarHUD();

    // 모바일 인벤토리 버튼
    const btnInv = document.getElementById('btn-inventory');
    if (btnInv) {
        btnInv.addEventListener('click', () => {
            if (inventoryManager.isOpen) inventoryManager.close();
            else inventoryManager.open(localPlayer);
        });
    }

    // 모바일 스킬북 버튼
    const btnSkillbook = document.getElementById('btn-skillbook');
    if (btnSkillbook) {
        btnSkillbook.addEventListener('click', () => {
            if (skillManager.isBookOpen) skillManager.closeBook();
            else skillManager.openBook(localPlayer);
        });
    }

    // 게임 루프 시작
    gameRunning = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);

    console.log(`[Main] 🎮 게임 시작! ${charData.nickname} (${charData.job}) @ ${mapManager.currentMap.name}`);
}

function resizeCanvas() {
    if (!gameCanvas) return;
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;
    gameCtx.imageSmoothingEnabled = false;
}

// ============================================================
// 메인 게임 루프
// ============================================================
function gameLoop(timestamp) {
    if (!gameRunning) return;

    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    // 퀴즈/상점/인벤토리/스킬북 팝업 중에는 게임 일시정지
    if (quizManager.isVisible || shopManager.isOpen || inventoryManager.isOpen || skillManager.isBookOpen) {
        requestAnimationFrame(gameLoop);
        return;
    }

    update(dt);
    render();
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // 입력 업데이트
    inputManager.update();

    // 플레이어 업데이트
    localPlayer.update(dt, inputManager, mapManager);

    // 카메라 업데이트
    mapManager.updateCamera(localPlayer.x, localPlayer.y);

    // 전투 업데이트 (몬스터 AI + 데미지)
    combatManager.update(dt, mapManager, localPlayer);

    // 스킬 업데이트 (쿨다운 및 버프)
    skillManager.update(dt, localPlayer);

    // 네트워크: 위치 동기화
    networkManager.syncPosition(localPlayer);
    networkManager.updateRemotePlayers(dt);

    // 공격 키 처리 (Space가 NPC 대화가 아닐 때)
    if (inputManager.actionPressed && !window.gameUI.dialogVisible) {
        combatManager.playerAttack(localPlayer);
    }

    // 포털 체크
    const portal = mapManager.checkPortal(localPlayer.tileX, localPlayer.tileY);
    if (portal && !localPlayer.isMoving) {
        handlePortal(portal);
    }

    // NPC 인터랙션 (주모 NPC는 HP 회복)
    if (inputManager.actionPressed && !window.gameUI.dialogVisible) {
        const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const [ox, oy] = offsets[localPlayer.direction] || [0, 1];
        const npc = mapManager.checkNPC(localPlayer.tileX + ox, localPlayer.tileY + oy);
        if (npc) {
            handleNPCInteraction(npc);
        }
    }

    // HUD 업데이트 (매 15프레임)
    hudUpdateCounter++;
    if (hudUpdateCounter >= 15) {
        hudUpdateCounter = 0;
        updateHUD();
    }
}

function render() {
    // 화면 클리어
    gameCtx.fillStyle = '#000000';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    // 맵 렌더링
    mapManager.render();

    // 몬스터 렌더링
    combatManager.renderMonsters(gameCtx, mapManager.camera);

    // 원격 플레이어 렌더링
    networkManager.renderRemotePlayers(gameCtx, mapManager.camera);

    // 로컬 플레이어 렌더링
    localPlayer.render(gameCtx, mapManager.camera);

    // 데미지 텍스트 렌더링
    combatManager.renderDamageTexts(gameCtx, mapManager.camera);

    // 맵 이름 + 접속자 수
    if (mapManager.currentMap) {
        gameCtx.save();
        gameCtx.fillStyle = 'rgba(0,0,0,0.5)';
        gameCtx.fillRect(8, 8, 200, 24);
        gameCtx.fillStyle = '#FFD700';
        gameCtx.font = 'bold 11px "Noto Sans KR", sans-serif';
        gameCtx.fillText(`📍 ${mapManager.currentMap.name} | 👥 ${networkManager.getPlayerCount()}명`, 16, 24);
        gameCtx.restore();
    }

    // 대화 UI 렌더링
    if (window.gameUI.dialogVisible) {
        renderDialogBox();
    }
}

// ============================================================
// NPC 인터랙션
// ============================================================
function handleNPCInteraction(npc) {
    window.gameUI.showDialog(npc.name, npc.dialog);

    // 주모 → HP 회복
    if (npc.id === 'npc_innkeeper') {
        localPlayer.stats.hp = localPlayer.stats.maxHp;
        localPlayer.stats.mp = localPlayer.stats.maxMp;
    }

    // 대장장이 → 상점 오픈
    if (npc.id === 'npc_smith') {
        setTimeout(() => {
            window.gameUI.hideDialog();
            shopManager.open(localPlayer);
        }, 800);
    }

    // 퀴즈 마스터 → 퀴즈 트리거
    if (npc.id === 'npc_quiz') {
        setTimeout(() => {
            window.gameUI.hideDialog();
            quizManager.triggerQuiz(localPlayer);
        }, 1500);
    }
}

// ============================================================
// 포털 맵 이동 처리
// ============================================================
function handlePortal(portal) {
    console.log(`[Main] 포털 이동: ${portal.targetMap}`);

    // 네트워크: 이전 맵 퇴장
    networkManager.leaveMap();

    // 새 맵 로드
    mapManager.loadMap(portal.targetMap);
    localPlayer.setPosition(portal.targetX, portal.targetY);

    // 몬스터 리스폰
    combatManager.spawnMonsters(mapManager.currentMap);

    // 네트워크: 새 맵 접속
    networkManager.joinMap(portal.targetMap, localPlayer.uid, {
        nickname: localPlayer.nickname,
        job: localPlayer.job,
        x: localPlayer.x,
        y: localPlayer.y,
        direction: localPlayer.direction,
        level: localPlayer.level,
        hp: localPlayer.stats.hp,
        maxHp: localPlayer.stats.maxHp,
    });

    // RTDB에 위치 저장
    if (localPlayer.uid) {
        rtdb.ref('userData/' + localPlayer.uid).update({
            map: portal.targetMap, x: portal.targetX, y: portal.targetY,
        });
    }

    updateHUD();
    updatePlayerCount();
}

function stopGame() {
    gameRunning = false;
    if (inputManager) { inputManager.destroy(); inputManager = null; }
    if (combatManager) { combatManager.destroy(); combatManager = null; }
    networkManager.destroy();
    localPlayer = null;
    mapManager = null;
}

// ============================================================
// HUD 업데이트
// ============================================================
function updateHUD() {
    if (!localPlayer) return;
    const s = localPlayer.stats;

    const hpFill = document.getElementById('hud-hp-fill');
    const hpText = document.getElementById('hud-hp-text');
    if (hpFill) hpFill.style.width = `${(s.hp / s.maxHp) * 100}%`;
    if (hpText) hpText.textContent = `${s.hp} / ${s.maxHp}`;

    const mpFill = document.getElementById('hud-mp-fill');
    const mpText = document.getElementById('hud-mp-text');
    if (mpFill) mpFill.style.width = `${(s.mp / s.maxMp) * 100}%`;
    if (mpText) mpText.textContent = `${s.mp} / ${s.maxMp}`;

    const lvEl = document.getElementById('hud-level');
    if (lvEl) lvEl.textContent = `Lv.${localPlayer.level}`;

    const goldEl = document.getElementById('hud-gold');
    if (goldEl) goldEl.textContent = localPlayer.gold;

    const nameEl = document.getElementById('hud-name');
    if (nameEl) nameEl.textContent = `${localPlayer.nickname} (${localPlayer.job})`;

    // EXP 바
    const expFill = document.getElementById('hud-exp-fill');
    const expText = document.getElementById('hud-exp-text');
    const requiredExp = localPlayer.level * 100;
    const expRatio = Math.min(1, (localPlayer.exp || 0) / requiredExp);
    if (expFill) expFill.style.width = `${expRatio * 100}%`;
    if (expText) expText.textContent = `${localPlayer.exp || 0} / ${requiredExp}`;

    // 장비 보너스 스탯 표시
    const atkEl = document.getElementById('hud-atk');
    const defEl = document.getElementById('hud-def');
    if (atkEl || defEl) {
        const eff = localPlayer.getEffectiveStats ? localPlayer.getEffectiveStats() : localPlayer.stats;
        if (atkEl) atkEl.textContent = eff.atk;
        if (defEl) defEl.textContent = eff.def;
    }
}

function updatePlayerCount() {
    const countEl = document.getElementById('hud-player-count');
    if (countEl) countEl.textContent = `${networkManager.getPlayerCount()}명`;
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

function renderDialogBox() {
    const ui = window.gameUI;
    const boxW = Math.min(gameCanvas.width - 40, 500);
    const boxH = 80;
    const boxX = (gameCanvas.width - boxW) / 2;
    const boxY = gameCanvas.height - boxH - 80;

    gameCtx.save();
    gameCtx.fillStyle = 'rgba(10, 10, 30, 0.9)';
    gameCtx.strokeStyle = '#FFD700';
    gameCtx.lineWidth = 2;
    gameCtx.beginPath();
    gameCtx.roundRect(boxX, boxY, boxW, boxH, 8);
    gameCtx.fill();
    gameCtx.stroke();

    gameCtx.fillStyle = '#FFD700';
    gameCtx.font = 'bold 13px "Noto Sans KR", sans-serif';
    gameCtx.fillText(ui.dialogName, boxX + 16, boxY + 22);

    gameCtx.fillStyle = '#e0e0e0';
    gameCtx.font = '12px "Noto Sans KR", sans-serif';
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

    gameCtx.fillStyle = '#808090';
    gameCtx.font = '10px "Noto Sans KR", sans-serif';
    gameCtx.fillText('[Space / 터치하여 닫기]', boxX + boxW - 140, boxY + boxH - 10);
    gameCtx.restore();
}

// 대화 닫기
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

// 단축키 처리 (인벤토리, 스킬북, 스킬 사용)
window.addEventListener('keydown', (e) => {
    if (!localPlayer || shopManager.isOpen || quizManager.isVisible || window.gameUI.dialogVisible || document.activeElement.tagName === 'INPUT') return;

    if (e.code === 'KeyI' && !skillManager.isBookOpen) {
        if (inventoryManager.isOpen) inventoryManager.close();
        else inventoryManager.open(localPlayer);
        e.preventDefault();
    } else if (e.code === 'KeyK' && !inventoryManager.isOpen) {
        if (skillManager.isBookOpen) skillManager.closeBook();
        else skillManager.openBook(localPlayer);
        e.preventDefault();
    } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code) && !inventoryManager.isOpen && !skillManager.isBookOpen) {
        const slotIndex = parseInt(e.key) - 1;
        skillManager.useSkill(slotIndex, localPlayer, combatManager);
        e.preventDefault();
    }
});

console.log('[Main] main.js 로드 완료 (Phase 5 스킬 시스템 통합)');
