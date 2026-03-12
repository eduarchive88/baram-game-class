/**
 * main.js - 게임 진입 및 인증 로직 (Phase 1)
 * Firebase Auth 로그인/회원가입, 캐릭터 생성(닉네임/직업 선택)
 * Phase 2+ 에서 게임 루프, 렌더링, 입력 매니저 등이 추가됨
 */

// ============================================================
// DOM 요소 참조
// ============================================================
const MainDOM = {
    // 화면 전환
    authScreen: document.getElementById('auth-screen'),
    characterScreen: document.getElementById('character-screen'),
    gameContainer: document.getElementById('game-container'),

    // 로그인 폼
    loginForm: document.getElementById('login-form'),
    signupForm: document.getElementById('signup-form'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    btnLogin: document.getElementById('btn-login'),
    authError: document.getElementById('auth-error'),
    linkSignup: document.getElementById('link-signup'),
    linkLogin: document.getElementById('link-login'),

    // 회원가입 폼
    signupEmail: document.getElementById('signup-email'),
    signupPassword: document.getElementById('signup-password'),
    signupPasswordConfirm: document.getElementById('signup-password-confirm'),
    btnSignup: document.getElementById('btn-signup'),
    signupError: document.getElementById('signup-error'),

    // 캐릭터 생성
    charNickname: document.getElementById('char-nickname'),
    jobCards: document.querySelectorAll('.job-card'),
    btnStartGame: document.getElementById('btn-start-game'),
    charError: document.getElementById('char-error'),
    btnGameLogout: document.getElementById('btn-game-logout'),
};

// 선택된 직업 상태
let selectedJob = null;

// ============================================================
// 1. 로그인/회원가입 탭 전환
// ============================================================
MainDOM.linkSignup.addEventListener('click', (e) => {
    e.preventDefault();
    MainDOM.loginForm.style.display = 'none';
    MainDOM.signupForm.style.display = 'block';
    MainDOM.authError.textContent = '';
});

MainDOM.linkLogin.addEventListener('click', (e) => {
    e.preventDefault();
    MainDOM.signupForm.style.display = 'none';
    MainDOM.loginForm.style.display = 'block';
    MainDOM.signupError.textContent = '';
});

// ============================================================
// 2. 로그인 처리
// ============================================================
MainDOM.btnLogin.addEventListener('click', async () => {
    const email = MainDOM.loginEmail.value.trim();
    const password = MainDOM.loginPassword.value.trim();

    if (!email || !password) {
        MainDOM.authError.textContent = '이메일과 비밀번호를 모두 입력하세요.';
        return;
    }

    MainDOM.btnLogin.disabled = true;
    MainDOM.authError.textContent = '';

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        const errMsg = {
            'auth/user-not-found': '등록되지 않은 이메일입니다.',
            'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
            'auth/invalid-email': '올바른 이메일 형식이 아닙니다.',
            'auth/too-many-requests': '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.',
            'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
        };
        MainDOM.authError.textContent = errMsg[error.code] || error.message;
    } finally {
        MainDOM.btnLogin.disabled = false;
    }
});

// Enter 키로 로그인
MainDOM.loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') MainDOM.btnLogin.click();
});

// ============================================================
// 3. 회원가입 처리
// ============================================================
MainDOM.btnSignup.addEventListener('click', async () => {
    const email = MainDOM.signupEmail.value.trim();
    const password = MainDOM.signupPassword.value.trim();
    const confirmPassword = MainDOM.signupPasswordConfirm.value.trim();

    MainDOM.signupError.textContent = '';

    // 유효성 검증
    if (!email || !password || !confirmPassword) {
        MainDOM.signupError.textContent = '모든 항목을 입력하세요.';
        return;
    }
    if (password.length < 6) {
        MainDOM.signupError.textContent = '비밀번호는 6자 이상이어야 합니다.';
        return;
    }
    if (password !== confirmPassword) {
        MainDOM.signupError.textContent = '비밀번호가 일치하지 않습니다.';
        return;
    }

    MainDOM.btnSignup.disabled = true;

    try {
        await auth.createUserWithEmailAndPassword(email, password);
        // 성공 시 onAuthStateChanged에서 화면 전환 처리
    } catch (error) {
        const errMsg = {
            'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
            'auth/invalid-email': '올바른 이메일 형식이 아닙니다.',
            'auth/weak-password': '비밀번호가 너무 약합니다. 6자 이상 입력하세요.',
        };
        MainDOM.signupError.textContent = errMsg[error.code] || error.message;
    } finally {
        MainDOM.btnSignup.disabled = false;
    }
});

// ============================================================
// 4. Auth 상태 변화 리스너
// ============================================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log('[Auth] 로그인됨:', user.email, isGM(user) ? '(GM)' : '');

        // 로그인 상태 → 캐릭터 생성 화면 또는 게임으로 이동
        MainDOM.authScreen.style.display = 'none';

        // Realtime DB에서 기존 유저 데이터 확인
        const userDataRef = rtdb.ref(`userData/${user.uid}`);
        const snapshot = await userDataRef.once('value');
        const userData = snapshot.val();

        if (userData && userData.nickname) {
            // 이미 캐릭터가 있으면 → 게임 진입 준비 (Phase 2에서 게임 시작)
            MainDOM.characterScreen.style.display = 'none';
            MainDOM.gameContainer.style.display = 'block';
            // Phase 2: startGame(user, userData);
            showGamePlaceholder(user, userData);
        } else {
            // 캐릭터 없으면 → 캐릭터 생성 화면
            MainDOM.characterScreen.style.display = 'flex';
            MainDOM.gameContainer.style.display = 'none';
        }
    } else {
        // 로그아웃 상태
        MainDOM.authScreen.style.display = 'flex';
        MainDOM.characterScreen.style.display = 'none';
        MainDOM.gameContainer.style.display = 'none';
        selectedJob = null;
    }
});

// ============================================================
// 5. 직업 선택 UI
// ============================================================
MainDOM.jobCards.forEach(card => {
    card.addEventListener('click', () => {
        // 기존 선택 해제
        MainDOM.jobCards.forEach(c => c.classList.remove('selected'));
        // 새 선택
        card.classList.add('selected');
        selectedJob = card.dataset.job;
        // 게임 시작 버튼 활성화 체크
        checkStartReady();
    });
});

// 닉네임 입력 시 게임 시작 버튼 활성화 체크
MainDOM.charNickname.addEventListener('input', checkStartReady);

/**
 * 닉네임과 직업이 모두 선택되었는지 확인하여 게임 시작 버튼 활성/비활성
 */
function checkStartReady() {
    const nickname = MainDOM.charNickname.value.trim();
    const ready = nickname.length >= 2 && nickname.length <= 8 && selectedJob !== null;
    MainDOM.btnStartGame.disabled = !ready;
}

// ============================================================
// 6. 게임 시작 (캐릭터 데이터 생성)
// ============================================================
MainDOM.btnStartGame.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const nickname = MainDOM.charNickname.value.trim();

    if (!nickname || nickname.length < 2 || nickname.length > 8) {
        MainDOM.charError.textContent = '닉네임은 2~8자로 입력하세요.';
        return;
    }
    if (!selectedJob) {
        MainDOM.charError.textContent = '직업을 선택하세요.';
        return;
    }

    MainDOM.btnStartGame.disabled = true;
    MainDOM.charError.textContent = '';

    try {
        // 닉네임 중복 체크 (간단 버전: userData 노드 전체 스캔)
        const allUsersSnapshot = await rtdb.ref('userData').once('value');
        const allUsers = allUsersSnapshot.val() || {};
        const isDuplicate = Object.entries(allUsers).some(
            ([uid, data]) => uid !== user.uid && data.nickname === nickname
        );

        if (isDuplicate) {
            MainDOM.charError.textContent = '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력하세요.';
            MainDOM.btnStartGame.disabled = false;
            return;
        }

        // 직업별 초기 스탯 설정
        const jobStats = getInitialJobStats(selectedJob);

        // Realtime DB에 유저 데이터 생성
        const newUserData = {
            nickname: nickname,
            job: selectedJob,
            gold: 100,  // 초기 금전
            exp: 0,
            level: 1,
            ...jobStats,
            inventory: { "도토리": 5 },  // 초기 아이템
            learnedSkills: [],
            currentMap: 'beginner_field',  // 왕초보 사냥터에서 시작
            isGM: isGM(user),
        };

        await rtdb.ref(`userData/${user.uid}`).set(newUserData);

        // 왕초보 사냥터에 플레이어 스폰
        const playerMapData = {
            nickname: nickname,
            job: selectedJob,
            x: 5,
            y: 5,
            direction: 'down',
            hp: jobStats.maxHp,
            maxHp: jobStats.maxHp,
            mp: jobStats.maxMp,
            maxMp: jobStats.maxMp,
            level: 1,
            isGhost: false,
            equippedWeapon: '',
            action: 'idle',
            lastUpdated: firebase.database.ServerValue.TIMESTAMP,
        };

        await rtdb.ref(`maps/beginner_field/players/${user.uid}`).set(playerMapData);

        console.log('[Main] 캐릭터 생성 완료:', nickname, selectedJob);

        // 캐릭터 생성 화면 숨기고 게임 컨테이너 표시
        MainDOM.characterScreen.style.display = 'none';
        MainDOM.gameContainer.style.display = 'block';

        // Phase 2: startGame(user, newUserData);
        showGamePlaceholder(user, newUserData);

    } catch (err) {
        console.error('[Main] 캐릭터 생성 에러:', err);
        MainDOM.charError.textContent = '캐릭터 생성 중 오류가 발생했습니다.';
        MainDOM.btnStartGame.disabled = false;
    }
});

// 로그아웃 버튼
MainDOM.btnGameLogout.addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut();
});

// ============================================================
// 7. 직업별 초기 스탯 정의
// ============================================================

/**
 * 직업별 초기 HP/MP/STR/INT 스탯 반환
 * @param {string} job - '전사' | '도적' | '주술사' | '도사'
 * @returns {Object} 초기 스탯 객체
 */
function getInitialJobStats(job) {
    const stats = {
        '전사': { maxHp: 200, maxMp: 30, str: 12, int: 3, attackPower: 15 },
        '도적': { maxHp: 150, maxMp: 50, str: 10, int: 5, attackPower: 12 },
        '주술사': { maxHp: 100, maxMp: 150, str: 4, int: 14, attackPower: 6 },
        '도사': { maxHp: 120, maxMp: 120, str: 5, int: 12, attackPower: 5 },
    };
    return stats[job] || stats['전사'];
}

// ============================================================
// 8. 게임 플레이스홀더 (Phase 2에서 교체될 임시 화면)
// ============================================================

/**
 * Phase 1에서는 캔버스 대신 임시 정보 화면을 표시
 * Phase 2에서 실제 게임 루프로 교체됨
 */
function showGamePlaceholder(user, userData) {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // 배경
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 제목
    ctx.fillStyle = '#f0c040';
    ctx.font = 'bold 32px "Noto Serif KR", serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚔️ 바람의 나라 RPG', canvas.width / 2, canvas.height / 2 - 100);

    // GM 표시
    if (isGM(user)) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 20px "Noto Sans KR", sans-serif';
        ctx.fillText('👑 [GM] 모드 활성화', canvas.width / 2, canvas.height / 2 - 60);
    }

    // 캐릭터 정보
    ctx.fillStyle = '#e8e8f0';
    ctx.font = '18px "Noto Sans KR", sans-serif';
    ctx.fillText(`닉네임: ${userData.nickname}`, canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillText(`직업: ${userData.job} | 레벨: ${userData.level || 1}`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText(`HP: ${userData.maxHp} | MP: ${userData.maxMp}`, canvas.width / 2, canvas.height / 2 + 50);

    // Phase 2 안내
    ctx.fillStyle = '#8890b0';
    ctx.font = '16px "Noto Sans KR", sans-serif';
    ctx.fillText('Phase 2에서 게임 월드가 구현됩니다.', canvas.width / 2, canvas.height / 2 + 110);
    ctx.fillText('캐릭터 생성이 성공적으로 완료되었습니다! 🎉', canvas.width / 2, canvas.height / 2 + 140);

    // 리사이즈 대응
    window.addEventListener('resize', () => {
        if (document.getElementById('game-container').style.display !== 'none') {
            showGamePlaceholder(user, userData);
        }
    });
}

console.log('[Main] 게임 진입점 초기화 완료');
