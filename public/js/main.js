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
let isInitializing = false;   // 게임 초기화 중 로딩 중복 방지 플래그

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
    
    // --- 터치 기기 및 강제 모바일 모드 감지 (1280px 이하 또는 터치 지원 시 활성화) ---
    const urlParams = new URLSearchParams(window.location.search);
    const forceMobile = urlParams.get('mobile') === 'true';
    const isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const isSmallScreen = window.innerWidth <= 1280;

    if (forceMobile || isTouchDevice || isSmallScreen) {
        document.body.classList.add('is-touch');
        console.log('[Main] 모바일/태블릿 모드 활성화됨 (Force:', forceMobile, 'Touch:', isTouchDevice, 'Screen:', window.innerWidth, ')');
    }


    setupAuthUI();

    // Firebase Auth 상태 감지 (학생은 익명 로그인 대신 localStorage 기반 세션 유지로 변경)
    auth.onAuthStateChanged(async (user) => {
        const savedStudentUid = localStorage.getItem('studentUid');
        const savedStudentName = localStorage.getItem('studentName');

        if (user && !user.isAnonymous) {
            console.log(`[Main] 교사 로그인됨: ${user.uid}`);
            await handleLoginSuccess(user.uid, 'teacher', user.email.split('@')[0]);
        } else if (savedStudentUid) {
            console.log(`[Main] 학생(로컬) 세션 유지: ${savedStudentUid}`);
            await handleLoginSuccess(savedStudentUid, 'student', savedStudentName);
        } else {
            console.log('[Main] 로그아웃 상태');
            showScreen('auth-screen');
            stopGame();
        }
    });

    // 로그아웃 버튼들 초기 연결 (어디서든 작동하도록)
    setupLogoutButtons();
});

/**
 * 로그아웃 버튼들 이벤트 연결
 */
function setupLogoutButtons() {
    ['hud-btn-logout', 'btn-side-logout', 'btn-game-logout'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            // 기존 리스너 제거 위해 클론 교체 (중복 방지)
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('정말로 로그아웃 하시겠습니까?')) {
                    globalLogout();
                }
            });
        }
    });
}

async function handleLoginSuccess(uid, role, name) {
    console.log(`[Main] 로그인 성공 핸들러 실행: ${uid} (${role})`);
    const charData = await loadCharacterData(uid);
    const sessionCode = localStorage.getItem('lastSessionCode');

    if (role === 'student' && sessionCode) {
        console.log(`[Main] 학생 세션 감시 시작: ${sessionCode}`);
        const sessionRef = rtdb.ref(`sessions/${sessionCode}`);
        
        // 기존 리스너가 있다면 제거 (중복 방지)
        sessionRef.off('value');

        sessionRef.on('value', async (snapshot) => {
            const sessionData = snapshot.val();
            const isActive = sessionData && sessionData.is_active === true;
            console.log(`[Main] 세션 상태 업데이트 - ${sessionCode}: ${isActive ? '활성' : '비활성'}`);

            if (isActive) {
                hideWaitingOverlay();
                
                // 캐릭터 데이터가 없는 경우 (최초 진입)
                if (!charData) {
                    // 데이터가 실제로 아직 없는지 재확인 (방금 생성했을 수 있음)
                    const freshCharData = await loadCharacterData(uid);
                    if (!freshCharData) {
                        console.log('[Main] 캐릭터 데이터 없음, 캐릭터 생성 화면으로 이동');
                        showScreen('character-screen');
                        setupCharacterCreation(uid, role, name);
                        return;
                    }
                    charData = freshCharData;
                }

                // 게임이 이미 실행 중이거나 초기화 중이면 중복 실행 방지
                if (gameRunning || isInitializing) return;

                console.log('[Main] 세션 활성화 - 게임 접속/복귀');
                showScreen('game-container');
                startGame(charData, uid);
            } else {
                console.log('[Main] 세션 비활성 상태 - 접근 차단');
                stopGame(); // 게임 루프 및 네트워크 중단
                showScreen('auth-screen'); // 먼저 인증 화면으로 보냄
                showWaitingOverlay(); // 그 위에 최상위 오버레이 표시
            }
        });
    } else if (role === 'teacher') {
        // 교사는 세션 체크 없이 즉시 진입 가능
        if (charData) {
            showScreen('game-container');
            startGame(charData, uid);
        } else {
            showScreen('character-screen');
            setupCharacterCreation(uid, role, name);
        }
    } else {
        // 학생인데 세션 코드가 없는 경우 (에러 상황)
        console.warn('[Main] 학생인데 세션 코드가 없음');
        stopGame();
        showScreen('auth-screen');
    }
}

/**
 * 선선생님 대기 오버레이 표시
 */
function showWaitingOverlay() {
    let overlay = document.getElementById('waiting-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'waiting-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.95);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000;
            color: white;
            text-align: center;
            backdrop-filter: blur(8px);
        `;
        overlay.innerHTML = `
            <div class="waiting-box" style="padding: 40px; border: 2px solid #f0c040; border-radius: 12px; background: #141828; box-shadow: 0 0 30px rgba(0,0,0,0.8); max-width: 400px; width: 90%;">
                <div class="waiting-icon" style="font-size: 3rem; margin-bottom: 20px;">⏳</div>
                <h2 style="font-family: 'Noto Serif KR', serif; color: #f0c040; margin-bottom: 15px;">선생님이 게임을 닫았습니다.</h2>
                <p style="color: #8890b0; line-height: 1.6; margin-bottom: 25px;">선생님께서 게임 세션을 활성화하시면<br>자동으로 다시 입장하실 수 있습니다.</p>
                
                <div class="waiting-spinner" style="width: 40px; height: 40px; border: 4px solid #2a3055; border-top-color: #f0c040; border-radius: 50%; margin: 0 auto 30px; animation: spin 1s linear infinite;"></div>
                
                <button id="btn-waiting-logout" style="width: 100%; padding: 12px; background: #2a3055; border: 1px solid #3d4a8a; border-radius: 8px; color: #e8e8f0; font-weight: bold; cursor: pointer;">게임 종료 및 로그아웃</button>
            </div>
            <style>
                @keyframes spin { to { transform: rotate(360deg); } }
            </style>
        `;
        document.body.appendChild(overlay);

        // 오버레이 내부 로그아웃 버튼 이벤트
        const btnLogout = overlay.querySelector('#btn-waiting-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                if (confirm('게임을 종료하고 로그아웃 하시겠습니까?')) {
                    globalLogout();
                }
            });
        }
    }
    overlay.style.display = 'flex';
}

/**
 * 대기 오버레이 숨김
 */
function hideWaitingOverlay() {
    const overlay = document.getElementById('waiting-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ============================================================
// 화면 전환
// ============================================================
function showScreen(screenId) {
    const screens = ['auth-screen', 'character-screen', 'game-container'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === screenId) {
                el.style.display = (id === 'game-container') ? 'flex' : 'block';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
                el.style.zIndex = '10'; // 기본 레이어
            } else {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.opacity = '0';
            }
        }
    });

    // 화면 전환 시마다 잠재적인 팝업들 닫기
    if (screenId !== 'game-container') {
        const overlays = document.querySelectorAll('.overlay, .shop-overlay, .inventory-overlay, .quiz-overlay');
        overlays.forEach(o => o.style.display = 'none');
        // 로그인/캐릭터 화면으로 완전히 나갈 때 대기 오버레이를 숨길 수 있으나,
        // 세션 비활성화 시에는 showWaitingOverlay가 showScreen 이후에 호출되어야 함을 보장.
    }
}

/**
 * 전역 로그아웃 함수
 */
function globalLogout() {
    console.log('[Main] 전역 로그아웃 실행');
    
    // 로컬 저장소 완전 초기화
    localStorage.removeItem('studentUid');
    localStorage.removeItem('studentName');
    localStorage.removeItem('lastSessionCode');
    localStorage.removeItem('characterData');
    localStorage.removeItem('userRole');
    
    const finish = () => {
        auth.signOut().finally(() => {
            console.log('[Main] 로그아웃 완료, 페이지 새로고침');
            // 캐시 방지를 위해 타임스탬프 추가하여 리로드
            window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
        });
    };

    if (localPlayer && typeof localPlayer.saveUserData === 'function') {
        localPlayer.saveUserData().then(finish).catch(finish);
    } else {
        finish();
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

                // (변경) Firebase 설정 우회를 위해 익명 로그인 호출 제거
                // RTDB 보안 규칙(.read, .write = true)을 통해 직접 접근 허용

                // 세션 존재 여부 및 학생 확인
                const studentId = `${grade}_${cls}_${num}_${name}`;
                const studentRef = rtdb.ref(`sessions/${code}/students/${studentId}`);
                const snapshot = await studentRef.once('value');

                if (!snapshot.exists()) {
                    errorEl.textContent = '등록되지 않은 학생이거나 세션 코드가 잘못되었습니다.';
                    return;
                }

                const studentUid = `session_${code}_${studentId}`;

                // (추가) 세션 활성화 상태 직접 확인
                const sessionSnapshot = await rtdb.ref(`sessions/${code}`).once('value');
                const sessionData = sessionSnapshot.val();
                if (sessionData && sessionData.is_active !== true) {
                    errorEl.textContent = '선생님의 활성화를 기다려주세요. (현재 비활성 상태)';
                    btnStudentLogin.disabled = false;
                    btnStudentLogin.textContent = '🚀 게임 접속';
                    // 대기 오버레이는 handleLoginSuccess 내부 리스너에서 처리되지만,
                    // 로그인 시도 시점에도 정보를 저장하고 감시를 시작해야 함
                    localStorage.setItem('studentUid', studentUid);
                    localStorage.setItem('studentName', name);
                    localStorage.setItem('lastSessionCode', code);
                    await handleLoginSuccess(studentUid, 'student', name);
                    return;
                }

                localStorage.setItem('studentUid', studentUid);
                localStorage.setItem('studentName', name);
                localStorage.setItem('lastSessionCode', code); // 세션 코드 저장

                // 명시적으로 로그인 성공 핸들러 호출 (onAuthStateChanged는 localStorage가 설정되기 전에 호출될 수 있으므로)
                await handleLoginSuccess(studentUid, 'student', name);

            } catch (err) {
                errorEl.textContent = '로그인 오류: ' + (err.message || err.code || '알 수 없는 오류');
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
        btnLogout.addEventListener('click', (e) => { 
            e.preventDefault(); 
            if (confirm('로그아웃 하시겠습니까?')) {
                globalLogout();
            }
        });
    }
}

/**
 * 캐릭터 데이터 로드
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

/**
 * 게임 시작 핵심 로직
 */
async function startGame(charData, uid) {
    if (gameRunning || isInitializing) return;
    
    // (중요) 세션 코드 확인
    const sessionCode = localStorage.getItem('lastSessionCode');
    const role = localStorage.getItem('userRole') || charData.role;

    console.log('[Main] 게임 시작 준비...');
    isInitializing = true;

    // UI 상태 리셋 (이전 세션의 찌꺼기 제거)
    if (typeof quizManager !== 'undefined' && quizManager) quizManager.closeQuiz();
    if (typeof shopManager !== 'undefined' && shopManager) shopManager.close();
    if (typeof inventoryManager !== 'undefined' && inventoryManager) inventoryManager.close();
    if (typeof skillManager !== 'undefined' && skillManager) skillManager.closeBook();

    try {
        // 캔버스 설정
        gameCanvas = document.getElementById('game-canvas');
        if (!gameCanvas) throw new Error('Canvas not found');
        gameCtx = gameCanvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // 에셋 로딩
        await assetManager.loadAll();
        
        // 로딩 후 세션이 비활성화되었는지 재체크 (학생인 경우)
        if (role === 'student' && sessionCode) {
            const activeSnapshot = await rtdb.ref(`sessions/${sessionCode}/is_active`).once('value');
            if (activeSnapshot.val() !== true) {
                console.log('[Main] 로딩 중 세션 비활성화됨 - 중단');
                return;
            }
        }

        // 퀴즈 데이터 로드 (비동기)
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
        await mapManager.loadMap(spawnMap);
        
        // 맵 로드 후 세션 또 체크 (긴 로딩 대비)
        if (role === 'student' && sessionCode) {
            const activeSnapshot = await rtdb.ref(`sessions/${sessionCode}/is_active`).once('value');
            if (activeSnapshot.val() !== true) {
                console.log('[Main] 맵 로딩 중 세션 비활성화됨 - 중단');
                return;
            }
        }

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

        // UI 업데이트
        updatePlayerCount();
        updateHUD();
        skillManager.updateSkillBarHUD();

        // 모바일 HUD 버튼들 연결
        setupHUDButtons();

        // 게임 루프 시작
        lastTime = performance.now();
        gameRunning = true;
        requestAnimationFrame(gameLoop);
        
        window.focus();
        console.log(`[Main] 🎮 게임 시작! ${charData.nickname} (${charData.job})`);

        // 사운드 초기화 리스너
        setupSoundInit();

    } catch (err) {
        console.error('[Main] 게임 시작 오류:', err);
        alert('게임 시작 중 오류가 발생했습니다: ' + err.message);
        stopGame();
    } finally {
        isInitializing = false;
    }
}

/**
 * HUD 버튼들 이벤트 연결 (startGame에서 분리)
 */
function setupHUDButtons() {
    const btnInv = document.getElementById('hud-btn-inventory');
    if (btnInv) {
        const newBtn = btnInv.cloneNode(true);
        btnInv.parentNode.replaceChild(newBtn, btnInv);
        newBtn.addEventListener('click', () => {
            if (inventoryManager.isOpen) inventoryManager.close();
            else inventoryManager.open(localPlayer);
        });
    }

    const btnSkillbook = document.getElementById('hud-btn-skillbook');
    if (btnSkillbook) {
        const newBtn = btnSkillbook.cloneNode(true);
        btnSkillbook.parentNode.replaceChild(newBtn, btnSkillbook);
        newBtn.addEventListener('click', () => {
            if (skillManager.isBookOpen) skillManager.closeBook();
            else skillManager.openBook(localPlayer);
        });
    }

    // 스킬 슬롯 터치/클릭 지원
    for (let i = 0; i < 4; i++) {
        const slotEl = document.getElementById(`hud-skill-${i}`);
        if (slotEl) {
            const newSlot = slotEl.cloneNode(true);
            slotEl.parentNode.replaceChild(newSlot, slotEl);
            newSlot.addEventListener('pointerdown', (e) => {
                if (localPlayer && !inventoryManager.isOpen && !skillManager.isBookOpen && gameRunning) {
                    skillManager.useSkill(i, localPlayer, combatManager);
                    e.preventDefault();
                }
            });
        }
    }
}

/**
 * 사운드 초기화 리스너 등록
 */
function setupSoundInit() {
    const initSound = () => {
        soundManager.init();
        soundManager.play('click');
        window.removeEventListener('click', initSound);
        window.removeEventListener('touchstart', initSound);
    };
    window.addEventListener('click', initSound);
    window.addEventListener('touchstart', initSound);
}

function resizeCanvas() {
    if (!gameCanvas || !gameCanvas.parentElement) return;

    const parent = gameCanvas.parentElement;
    const rect = parent.getBoundingClientRect();

    // 픽셀 아트 비율 유지 (줌 배율 1.5로 고정)
    const zoom = 1.5; 

    // 실제 캔버스 드로잉 해상도 설정
    gameCanvas.width = Math.floor(rect.width / zoom);
    gameCanvas.height = Math.floor(rect.height / zoom);
    
    // CSS 크기는 부모 영역에 맞춤
    gameCanvas.style.width = '100%';
    gameCanvas.style.height = '100%';
    
    if (gameCtx) {
        gameCtx.imageSmoothingEnabled = false;
        gameCtx.msImageSmoothingEnabled = false;
        gameCtx.webkitImageSmoothingEnabled = false;
    }
    
    if (mapManager) mapManager.onResize?.();
}

// ============================================================
// 메인 게임 루프
// ============================================================
function gameLoop(timestamp) {
    if (!gameRunning) return;

    try {
        const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;

        update(dt);
        render();
    } catch (err) {
        console.error('[GameLoop] Error:', err);
        // 치명적 오류 발생 시 게임 중단 고려 가능하지만, 일단 에러 로그만 남기고 루프는 유지 시도
    }
    
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // 입력 업데이트
    inputManager.update();

    // 플레이어 업데이트 (UI 열려있으면 이동 입력 무시)
    const isUIOpen = (quizManager.isVisible || shopManager.isOpen || inventoryManager.isOpen || skillManager.isBookOpen);
    const activeInput = isUIOpen ? null : inputManager; 
    localPlayer.update(dt, activeInput, mapManager);

    // 카메라 업데이트
    mapManager.updateCamera(localPlayer.x, localPlayer.y);

    // 전투 업데이트 (몬스터 AI + 데미지)
    combatManager.update(dt, mapManager, localPlayer, networkManager);

    // 퀴즈 업데이트 (사망 체크 등)
    quizManager.update(localPlayer);

    // 스킬 업데이트 (쿨다운 및 버프)
    skillManager.update(dt, localPlayer);

    // 네트워크: 위치 동기화
    networkManager.syncPosition(localPlayer);
    networkManager.updateRemotePlayers(dt);

    // 공격 키 처리 (UI가 닫혀있고 Space가 NPC 대화가 아닐 때)
    if (!isUIOpen && inputManager.actionPressed && !window.gameUI.dialogVisible) {
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

    // ===== 유령 모드 배너 =====
    if (localPlayer && localPlayer.isDead) {
        gameCtx.save();
        // 반투명 빨간 오버레이
        gameCtx.fillStyle = 'rgba(80, 0, 0, 0.35)';
        gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

        // 사망 배너
        const bannerY = gameCanvas.height / 2 - 30;
        gameCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        gameCtx.fillRect(0, bannerY, gameCanvas.width, 60);

        gameCtx.textAlign = 'center';
        gameCtx.fillStyle = '#ff4040';
        gameCtx.font = 'bold 18px "Noto Sans KR", sans-serif';
        gameCtx.fillText('👻 유령 상태', gameCanvas.width / 2, bannerY + 24);

        gameCtx.fillStyle = '#ffffff';
        gameCtx.font = '12px "Noto Sans KR", sans-serif';
        gameCtx.fillText(
            `부활까지 ${Math.ceil(localPlayer.deathTimer)}초 | 이동만 가능합니다`,
            gameCanvas.width / 2, bannerY + 44
        );
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
        localPlayer.saveUserData(); // 즉시 저장
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

// 캐릭터 정보 UI 업데이트
function updateCharacterUI(player) {
    if (!player) return;

    // 레벨/이름
    const lvEl = document.getElementById('player-level');
    const nameEl = document.getElementById('player-name');
    if (lvEl) lvEl.innerText = `Lv.${player.level}`;
    if (nameEl) nameEl.innerText = player.nickname; // Use nickname for player name

    // HP
    const hpFill = document.getElementById('hp-fill');
    const hpText = document.getElementById('hp-text');
    if (hpFill) hpFill.style.width = `${(player.stats.hp / player.stats.maxHp) * 100}%`;
    if (hpText) hpText.innerText = `${player.stats.hp}/${player.stats.maxHp}`;

    // MP
    const mpFill = document.getElementById('mp-fill');
    const mpText = document.getElementById('mp-text');
    if (mpFill) mpFill.style.width = `${(player.stats.mp / player.stats.maxMp) * 100}%`;
    if (mpText) mpText.innerText = `${player.stats.mp}/${player.stats.maxMp}`;

    // EXP
    const expFill = document.getElementById('exp-fill');
    const expText = document.getElementById('exp-text');
    if (expFill) {
        const nextExp = player.level * 100; // 예시 경험치 테이블
        const percent = Math.min((player.exp / nextExp) * 100, 100);
        expFill.style.width = `${percent}%`;
        if (expText) expText.innerText = `${Math.floor(percent)}%`;
    }

    // 골드
    const goldEl = document.getElementById('player-gold');
    if (goldEl) goldEl.innerText = (player.gold || 0).toLocaleString();

    // 장비 보너스 스탯 표시 (공격력, 방어력)
    const atkEl = document.getElementById('player-atk');
    const defEl = document.getElementById('player-def');
    if (atkEl || defEl) {
        const eff = player.getEffectiveStats ? player.getEffectiveStats() : player.stats;
        if (atkEl) atkEl.innerText = eff.atk;
        if (defEl) defEl.innerText = eff.def;
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
    localPlayer.saveUserData(); // 이동 후 위치 즉시 저장

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
    console.log('[Main] 게임 중단 시도 (Stop Game)');
    gameRunning = false;
    isInitializing = false; // 진행 중인 초기화도 중단된 것으로 간주

    // UI 상태 리셋 (입력 차단 방지)
    if (typeof quizManager !== 'undefined' && quizManager) quizManager.closeQuiz();
    if (typeof shopManager !== 'undefined' && shopManager) shopManager.close();
    if (typeof inventoryManager !== 'undefined' && inventoryManager) inventoryManager.close();
    if (typeof skillManager !== 'undefined' && skillManager) skillManager.closeBook();
    
    // 네트워크 연결 해제
    if (typeof networkManager !== 'undefined' && networkManager && typeof networkManager.leaveMap === 'function') {
        networkManager.leaveMap();
        if (typeof networkManager.destroy === 'function') networkManager.destroy();
    }
    
    // 전투 자원 정리
    if (typeof combatManager !== 'undefined' && combatManager && typeof combatManager.destroy === 'function') {
        combatManager.destroy();
    }
    
    // 입력 관리자 정리
    if (typeof inputManager !== 'undefined' && inputManager && typeof inputManager.destroy === 'function') {
        inputManager.destroy();
    }

    // 참조 제거 (가급적 let 변수만)
    localPlayer = null;
    mapManager = null;
    
    window.removeEventListener('resize', resizeCanvas);
    console.log('[Main] 게임 중단 완료');
}

// ============================================================
// HUD 업데이트
// ============================================================
function updateHUD() {
    if (!localPlayer) return;
    const s = localPlayer.stats;

    // --- 기존 사이드 패널 업데이트 (데스크탑 하위 호환) ---
    const hpFill = document.getElementById('hp-fill');
    const hpText = document.getElementById('hp-text');
    if (hpFill) hpFill.style.width = `${(s.hp / s.maxHp) * 100}%`;
    if (hpText) hpText.textContent = `${s.hp} / ${s.maxHp}`;

    const mpFill = document.getElementById('mp-fill');
    const mpText = document.getElementById('mp-text');
    if (mpFill) mpFill.style.width = `${(s.mp / s.maxMp) * 100}%`;
    if (mpText) mpText.textContent = `${s.mp} / ${s.maxMp}`;

    // --- 신규 모바일 전용 HUD 오버레이 업데이트 ---
    const mHpFill = document.getElementById('hud-hp-fill');
    if (mHpFill) mHpFill.style.width = `${(s.hp / s.maxHp) * 100}%`;

    const mMpFill = document.getElementById('hud-mp-fill');
    if (mMpFill) mMpFill.style.width = `${(s.mp / s.maxMp) * 100}%`;

    const mLv = document.getElementById('hud-level');
    if (mLv) mLv.textContent = `Lv.${localPlayer.level}`;

    const mName = document.getElementById('hud-name');
    if (mName) mName.textContent = localPlayer.nickname;

    const mGold = document.getElementById('hud-gold');
    if (mGold) mGold.textContent = (localPlayer.gold || 0).toLocaleString();

    const mExpPct = document.getElementById('hud-exp-pct');
    if (mExpPct) {
        const requiredExp = localPlayer.level * 100;
        const percent = Math.floor(Math.min(1, (localPlayer.exp || 0) / requiredExp) * 100);
        mExpPct.textContent = percent;
    }

    // --- 직업 아이콘 업데이트 ---
    const avatarEl = document.getElementById('hud-avatar');
    if (avatarEl && localPlayer.job) {
        const jobIcons = {
            '전사': '⚔️',
            '도적': '🗡️',
            '주술사': '🪄',
            '도사': '🌿',
            '평민': '👤'
        };
        avatarEl.textContent = jobIcons[localPlayer.job] || '👤';
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
        window.focus(); // 대화 닫은 후 키보드 입력 위해 포커스
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
