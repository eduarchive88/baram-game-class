/**
 * admin.js - 교사 관리자 대시보드 로직
 * 기능: Firebase Auth 인증, SheetJS 엑셀 파싱, Firestore 퀴즈 CRUD, 학생 통계
 */

// ============================================================
// 전역 변수
// ============================================================
let parsedQuizData = []; // 퀴즈용 엑셀 파싱 결과 임시 저장
let parsedStudentData = []; // 학생 명단용 엑셀 파싱 결과 임시 저장

// ============================================================
// DOM 요소 참조
// ============================================================
const DOM = {
    // 인증 관련
    authOverlay: document.getElementById('auth-overlay'),
    accessDenied: document.getElementById('access-denied'),
    adminMain: document.getElementById('admin-main'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    btnLogin: document.getElementById('btn-login'),
    btnLogout: document.getElementById('btn-logout'),
    btnLogoutDenied: document.getElementById('btn-logout-denied'),
    authError: document.getElementById('auth-error'),
    userEmail: document.getElementById('user-email'),
    userName: document.getElementById('user-name'),

    // 엑셀 업로드 관련
    uploadZone: document.getElementById('upload-zone'),
    fileInput: document.getElementById('file-input'),
    previewSection: document.getElementById('preview-section'),
    previewCount: document.getElementById('preview-count'),
    previewBody: document.getElementById('preview-body'),
    btnCancelUpload: document.getElementById('btn-cancel-upload'),
    btnConfirmUpload: document.getElementById('btn-confirm-upload'),
    uploadStatus: document.getElementById('upload-status'),
    uploadStatusText: document.getElementById('upload-status-text'),

    // 학생 명단 업로드 관련
    sessionCodeInput: document.getElementById('session-code-input'),
    btnGenerateSession: document.getElementById('btn-generate-session'),
    studentUploadZone: document.getElementById('student-upload-zone'),
    studentFileInput: document.getElementById('student-file-input'),
    studentPreviewSection: document.getElementById('student-preview-section'),
    studentPreviewCount: document.getElementById('student-preview-count'),
    studentPreviewBody: document.getElementById('student-preview-body'),
    btnCancelStudentUpload: document.getElementById('btn-cancel-student-upload'),
    btnConfirmStudentUpload: document.getElementById('btn-confirm-student-upload'),
    studentUploadStatus: document.getElementById('student-upload-status'),
    studentUploadStatusText: document.getElementById('student-upload-status-text'),

    // 통계 관련
    statTotalStudents: document.getElementById('stat-total-students'),
    statTotalAnswers: document.getElementById('stat-total-answers'),
    statAvgRate: document.getElementById('stat-avg-rate'),
    statQuizCount: document.getElementById('stat-quiz-count'),
    btnRefreshStats: document.getElementById('btn-refresh-stats'),
    studentStatsBody: document.getElementById('student-stats-body'),
    wrongStatsBody: document.getElementById('wrong-stats-body'),
    currentQuizBody: document.getElementById('current-quiz-body'),
    currentSessionsBody: document.getElementById('current-sessions-body'),
    quizSessionUnit: document.getElementById('quiz-session-unit'),
    filterSessionUnit: document.getElementById('filter-session-unit'),
    btnDeleteGroup: document.getElementById('btn-delete-group'),
};

// ============================================================
// 1. Firebase Auth - 로그인/인증 처리
// ============================================================

/**
 * 로그인 버튼 클릭 핸들러
 * 이메일/비밀번호로 Firebase Auth 로그인 수행
 */
DOM.btnLogin.addEventListener('click', async () => {
    const email = DOM.loginEmail.value.trim();
    const password = DOM.loginPassword.value.trim();

    if (!email || !password) {
        DOM.authError.textContent = '이메일과 비밀번호를 모두 입력하세요.';
        return;
    }

    DOM.btnLogin.disabled = true;
    DOM.authError.textContent = '';

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        // 한글 에러 메시지 매핑
        const errorMessages = {
            'auth/user-not-found': '등록되지 않은 이메일입니다.',
            'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
            'auth/invalid-email': '올바른 이메일 형식이 아닙니다.',
            'auth/too-many-requests': '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.',
            'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
        };
        DOM.authError.textContent = errorMessages[error.code] || error.message;
    } finally {
        DOM.btnLogin.disabled = false;
    }
});

// Enter 키로 로그인
DOM.loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') DOM.btnLogin.click();
});

// 로그아웃 버튼들
DOM.btnLogout.addEventListener('click', () => auth.signOut());
DOM.btnLogoutDenied.addEventListener('click', () => auth.signOut());

/**
 * Auth 상태 변화 리스너
 * 로그인/로그아웃 시 UI를 적절히 전환
 */
auth.onAuthStateChanged((user) => {
    if (user) {
        // 로그인 상태 → GM 권한 확인
        if (isGM(user)) {
            // GM 확인됨 → 대시보드 표시
            DOM.authOverlay.style.display = 'none';
            DOM.accessDenied.style.display = 'none';
            DOM.adminMain.style.display = 'block';
            
            const teacherName = user.displayName || user.email.split('@')[0];
            if (DOM.userName) {
                DOM.userName.textContent = `${teacherName} 선생님 환영합니다!`;
            }
            DOM.userEmail.textContent = `(${user.email})`;
            // 통계 데이터 로드
            loadAllStats();
            loadCurrentQuizzes();
            loadCurrentSessions();
        } else {
            // GM이 아닌 일반 유저 → 접근 차단
            DOM.authOverlay.style.display = 'none';
            DOM.accessDenied.style.display = 'flex';
            DOM.adminMain.style.display = 'none';
        }
    } else {
        // 로그아웃 상태 → 로그인 폼 표시
        DOM.authOverlay.style.display = 'flex';
        DOM.accessDenied.style.display = 'none';
        DOM.adminMain.style.display = 'none';
    }
});

// ============================================================
// 2. 엑셀 파싱 (SheetJS) 및 업로드
// ============================================================

/**
 * 드래그 앤 드롭 이벤트 처리
 */
DOM.uploadZone.addEventListener('click', () => DOM.fileInput.click());

DOM.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.uploadZone.classList.add('drag-over');
});

DOM.uploadZone.addEventListener('dragleave', () => {
    DOM.uploadZone.classList.remove('drag-over');
});

DOM.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processExcelFile(file);
});

DOM.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processExcelFile(file);
});

/**
 * 엑셀 파일을 SheetJS로 파싱하여 JSON 데이터로 변환
 * @param {File} file - 엑셀 파일 (.xlsx / .xls)
 */
function processExcelFile(file) {
    // 파일 확장자 확인
    const validExts = ['.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
        showToast('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // 시트 → JSON 배열 변환 (헤더 없이 2차원 배열)
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // 첫 번째 행이 헤더인지 데이터인지 판별
            // A열(문제), B~E열(보기), F열(정답번호), G열(보상금전)
            parsedQuizData = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                // 빈 행 건너뛰기
                if (!row || !row[0] || String(row[0]).trim() === '') continue;

                // 첫 행이 헤더("문제", "보기1" 등)면 건너뛰기
                if (i === 0 && isHeaderRow(row)) continue;

                const question = String(row[0] || '').trim();
                const option1 = String(row[1] || '').trim();
                const option2 = String(row[2] || '').trim();
                const option3 = String(row[3] || '').trim();
                const option4 = String(row[4] || '').trim();
                const correctAnswer = parseInt(row[5]) || 1;
                const rewardGold = parseInt(row[6]) || 10;

                // 유효성 검증
                if (!question || !option1 || !option2) {
                    console.warn(`[엑셀 파싱] ${i + 1}행: 문제 또는 보기가 비어있어 건너뜁니다.`);
                    continue;
                }

                if (correctAnswer < 1 || correctAnswer > 4) {
                    console.warn(`[엑셀 파싱] ${i + 1}행: 정답번호(${correctAnswer})가 1~4 범위가 아닙니다. 1로 설정합니다.`);
                }

                parsedQuizData.push({
                    question,
                    options: [option1, option2, option3, option4],
                    correct_answer: Math.min(Math.max(correctAnswer, 1), 4),
                    reward_gold: Math.max(rewardGold, 0),
                });
            }

            if (parsedQuizData.length === 0) {
                showToast('유효한 퀴즈 데이터가 없습니다. 엑셀 양식을 확인하세요.', 'error');
                return;
            }

            // 미리보기 렌더링
            renderPreview(parsedQuizData);
            showToast(`${parsedQuizData.length}개의 퀴즈가 파싱되었습니다.`, 'success');
        } catch (err) {
            console.error('[엑셀 파싱 에러]', err);
            showToast('엑셀 파일 파싱 중 오류가 발생했습니다.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * 첫 행이 헤더인지 판별하는 헬퍼
 */
function isHeaderRow(row) {
    const headerKeywords = ['문제', '보기', '정답', '보상', 'question', 'option', 'answer'];
    const firstCell = String(row[0] || '').toLowerCase();
    return headerKeywords.some(k => firstCell.includes(k));
}

/**
 * 파싱된 퀴즈 데이터를 미리보기 테이블에 렌더링
 * @param {Array} quizzes - 파싱된 퀴즈 배열
 */
function renderPreview(quizzes) {
    DOM.previewSection.style.display = 'block';
    DOM.previewCount.textContent = quizzes.length;

    DOM.previewBody.innerHTML = quizzes.map((q, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(q.question)}</td>
      <td>${escapeHtml(q.options[0])}</td>
      <td>${escapeHtml(q.options[1])}</td>
      <td>${escapeHtml(q.options[2])}</td>
      <td>${escapeHtml(q.options[3])}</td>
      <td><span class="badge badge-green">${q.correct_answer}</span></td>
      <td><span class="badge badge-gold">${q.reward_gold}전</span></td>
    </tr>
  `).join('');
}

// 미리보기 취소 버튼
DOM.btnCancelUpload.addEventListener('click', () => {
    parsedQuizData = [];
    DOM.previewSection.style.display = 'none';
    DOM.previewBody.innerHTML = '';
    DOM.fileInput.value = '';
});

/**
 * Firestore에 퀴즈 데이터를 업로드 (기존 데이터 완전 교체)
 * 1. 기존 quizzes 컬렉션의 모든 문서 삭제
 * 2. 파싱된 데이터로 새 문서 일괄 생성
 */
DOM.btnConfirmUpload.addEventListener('click', async () => {
    if (parsedQuizData.length === 0) {
        showToast('업로드할 데이터가 없습니다.', 'error');
        return;
    }

    const sessionUnit = DOM.quizSessionUnit.value.trim() || '기본';

    // 확인 다이얼로그
    if (!confirm(`[${sessionUnit}] 차시로 ${parsedQuizData.length}개의 퀴즈를 업로드합니다.\n기존 퀴즈는 그대로 유지되며, 새로운 퀴즈들이 추가됩니다. 계속하시겠습니까?`)) {
        return;
    }

    DOM.btnConfirmUpload.disabled = true;
    DOM.uploadStatus.style.display = 'block';
    DOM.uploadStatusText.textContent = '기존 퀴즈 삭제 중...';

    try {
        // Step 1: (기존 로직은 전체 삭제였으나, 요청에 따라 차시별로 관리하기 위해 삭제 로직 제거 또는 선택적 삭제 고려)
        // 사용자가 "매번 일일히 지우는게 아니라"라고 했으므로 추가하는 방식으로 변경
        console.log(`[Firestore] 새 퀴즈 업로드 시작 (차시: ${sessionUnit})`);

        // Step 2: 새 퀴즈 데이터 일괄 생성 (Batch Write, 500개 제한)
        DOM.uploadStatusText.textContent = '새 퀴즈 업로드 중...';
        const BATCH_SIZE = 450; // 안전 마진
        for (let i = 0; i < parsedQuizData.length; i += BATCH_SIZE) {
            const chunk = parsedQuizData.slice(i, i + BATCH_SIZE);
            const batch2 = db.batch();
            chunk.forEach(quiz => {
                const docRef = db.collection('quizzes').doc();
                batch2.set(docRef, {
                    ...quiz,
                    session_unit: sessionUnit,
                    is_active: true,
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch2.commit();
        }

        console.log(`[Firestore] 새 퀴즈 ${parsedQuizData.length}개 업로드 완료`);
        showToast(`✅ ${parsedQuizData.length}개의 퀴즈가 성공적으로 업로드되었습니다!`, 'success');

        // 초기화
        parsedQuizData = [];
        DOM.previewSection.style.display = 'none';
        DOM.previewBody.innerHTML = '';
        DOM.fileInput.value = '';
        DOM.quizSessionUnit.value = '';

        // 통계 및 퀴즈 목록 새로고침
        loadCurrentQuizzes();
        loadAllStats();

    } catch (err) {
        console.error('[Firestore 업로드 에러]', err);
        showToast('업로드 중 오류가 발생했습니다: ' + err.message, 'error');
    } finally {
        DOM.btnConfirmUpload.disabled = false;
        DOM.uploadStatus.style.display = 'none';
    }
});

// ============================================================
// 2.5 학생 명단 파싱 (SheetJS) 및 업로드
// ============================================================

DOM.btnGenerateSession.addEventListener('click', () => {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    DOM.sessionCodeInput.value = randomCode;
});

DOM.studentUploadZone.addEventListener('click', () => DOM.studentFileInput.click());

DOM.studentUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.studentUploadZone.classList.add('drag-over');
});

DOM.studentUploadZone.addEventListener('dragleave', () => {
    DOM.studentUploadZone.classList.remove('drag-over');
});

DOM.studentUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.studentUploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processStudentExcelFile(file);
});

DOM.studentFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processStudentExcelFile(file);
});

function processStudentExcelFile(file) {
    const validExts = ['.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
        showToast('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            parsedStudentData = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || !row[0] || String(row[0]).trim() === '') continue;

                const firstCell = String(row[0] || '').toLowerCase();
                if (i === 0 && (firstCell.includes('학년') || firstCell.includes('grade'))) continue;

                const grade = String(row[0] || '').trim();
                const cls = String(row[1] || '').trim();
                const num = String(row[2] || '').trim();
                const name = String(row[3] || '').trim();

                if (!grade || !cls || !num || !name) {
                    console.warn(`[학생 엑셀 파싱] ${i + 1}행: 정보 누락 건너뜀`);
                    continue;
                }

                parsedStudentData.push({
                    grade, class: cls, number: num, name,
                    id: `${grade}_${cls}_${num}_${name}`
                });
            }

            if (parsedStudentData.length === 0) {
                showToast('유효한 학생 데이터가 없습니다.', 'error');
                return;
            }

            // 학생 미리보기 렌더링
            DOM.studentPreviewSection.style.display = 'block';
            DOM.studentPreviewCount.textContent = parsedStudentData.length;
            DOM.studentPreviewBody.innerHTML = parsedStudentData.map((s, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${escapeHtml(s.grade)}학년</td>
                    <td>${escapeHtml(s.class)}반</td>
                    <td>${escapeHtml(s.number)}번</td>
                    <td><span class="badge badge-green">${escapeHtml(s.name)}</span></td>
                </tr>
            `).join('');

            showToast(`${parsedStudentData.length}명의 학생이 파싱되었습니다.`, 'success');
        } catch (err) {
            console.error('[학생 엑셀 파싱 에러]', err);
            showToast('엑셀 파일 파싱 중 오류가 발생했습니다.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

DOM.btnCancelStudentUpload.addEventListener('click', () => {
    parsedStudentData = [];
    DOM.studentPreviewSection.style.display = 'none';
    DOM.studentPreviewBody.innerHTML = '';
    DOM.studentFileInput.value = '';
});

DOM.btnConfirmStudentUpload.addEventListener('click', async () => {
    const sessionCode = DOM.sessionCodeInput.value.trim();
    if (!sessionCode) {
        showToast('세션 코드를 입력하세요.', 'error');
        return;
    }

    if (parsedStudentData.length === 0) {
        showToast('업로드할 학생 데이터가 없습니다.', 'error');
        return;
    }

    if (!confirm(`${parsedStudentData.length}명의 학생 명단을 [${sessionCode}] 세션으로 등록하시겠습니까?\n이전 동일 세션 데이터는 덮어씌워질 수 있습니다.`)) {
        return;
    }

    DOM.btnConfirmStudentUpload.disabled = true;
    DOM.studentUploadStatus.style.display = 'block';
    DOM.studentUploadStatusText.textContent = '학생 명단 데이터베이스(RTDB)에 등록 중...';

    try {
        const updates = {};
        parsedStudentData.forEach(student => {
            updates[`sessions/${sessionCode}/students/${student.id}`] = student;
        });

        // Firebase Realtime Database 트랜잭션 (일괄 업데이트)
        await rtdb.ref().update(updates);

        console.log(`[RTDB] 세션 ${sessionCode} 에 학생 ${parsedStudentData.length}명 등록 완료`);
        showToast(`✅ ${parsedStudentData.length}명의 학생이 성공적으로 등록되었습니다!`, 'success');

        loadCurrentSessions();

        parsedStudentData = [];
        DOM.studentPreviewSection.style.display = 'none';
        DOM.studentPreviewBody.innerHTML = '';
        DOM.studentFileInput.value = '';

    } catch (err) {
        console.error('[RTDB 업데이트 에러]', err);
        showToast('업로드 중 오류가 발생했습니다: ' + err.message, 'error');
    } finally {
        DOM.btnConfirmStudentUpload.disabled = false;
        DOM.studentUploadStatus.style.display = 'none';
    }
});

// ============================================================
// 3. 통계 데이터 집계 및 렌더링
// ============================================================

/**
 * 모든 통계를 로드하고 렌더링
 * quiz_logs 컬렉션에서 학생별/문제별 정답 데이터를 집계
 */
async function loadAllStats() {
    try {
        // quiz_logs 전체 조회
        const logsSnapshot = await db.collection('quiz_logs').get();
        const logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // quizzes 전체 조회 (문제 텍스트 매핑용)
        const quizzesSnapshot = await db.collection('quizzes').get();
        const quizMap = {};
        quizzesSnapshot.docs.forEach(doc => {
            quizMap[doc.id] = doc.data();
        });

        // --- 전체 요약 통계 ---
        const uniqueStudents = new Set(logs.map(l => l.uid));
        const totalCorrect = logs.filter(l => l.is_correct).length;
        const totalWrong = logs.filter(l => !l.is_correct).length;
        const totalAnswers = logs.length;
        const avgRate = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

        DOM.statTotalStudents.textContent = uniqueStudents.size;
        DOM.statTotalAnswers.textContent = totalAnswers;
        DOM.statAvgRate.textContent = avgRate + '%';
        DOM.statQuizCount.textContent = quizzesSnapshot.size;

        // --- 학생별 정답률 ---
        renderStudentStats(logs);

        // --- 오답률 높은 문제 Top 10 ---
        renderWrongStats(logs, quizMap);

    } catch (err) {
        console.error('[통계 로드 에러]', err);
        showToast('통계 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 학생별 정답률 테이블 렌더링
 * @param {Array} logs - quiz_logs 배열
 */
function renderStudentStats(logs) {
    // UID별로 그룹핑
    const studentMap = {};
    logs.forEach(log => {
        if (!studentMap[log.uid]) {
            studentMap[log.uid] = { nickname: log.nickname || log.uid, correct: 0, wrong: 0 };
        }
        if (log.is_correct) {
            studentMap[log.uid].correct++;
        } else {
            studentMap[log.uid].wrong++;
        }
    });

    const students = Object.values(studentMap);

    if (students.length === 0) {
        DOM.studentStatsBody.innerHTML = `
      <tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:32px;">
        아직 퀴즈 응답 데이터가 없습니다.
      </td></tr>`;
        return;
    }

    // 정답률 내림차순 정렬
    students.sort((a, b) => {
        const rateA = a.correct / (a.correct + a.wrong);
        const rateB = b.correct / (b.correct + b.wrong);
        return rateB - rateA;
    });

    DOM.studentStatsBody.innerHTML = students.map(s => {
        const total = s.correct + s.wrong;
        const rate = Math.round((s.correct / total) * 100);
        const barClass = rate >= 80 ? 'good' : rate >= 50 ? 'warning' : 'danger';
        return `
      <tr>
        <td>${escapeHtml(s.nickname)}</td>
        <td><span class="badge badge-green">${s.correct}</span></td>
        <td><span class="badge badge-red">${s.wrong}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="progress-bar" style="flex:1">
              <div class="progress-bar-fill ${barClass}" style="width:${rate}%"></div>
            </div>
            <span style="font-size:0.85rem; font-weight:600; min-width:40px;">${rate}%</span>
          </div>
        </td>
      </tr>
    `;
    }).join('');
}

/**
 * 오답률 높은 문제 Top 10 렌더링
 * @param {Array} logs - quiz_logs 배열
 * @param {Object} quizMap - quiz_id → quiz 데이터 매핑
 */
function renderWrongStats(logs, quizMap) {
    // 문제별로 그룹핑
    const questionMap = {};
    logs.forEach(log => {
        if (!questionMap[log.quiz_id]) {
            questionMap[log.quiz_id] = { total: 0, wrong: 0 };
        }
        questionMap[log.quiz_id].total++;
        if (!log.is_correct) {
            questionMap[log.quiz_id].wrong++;
        }
    });

    // 오답률 계산 후 내림차순 정렬
    const sorted = Object.entries(questionMap)
        .map(([quizId, data]) => ({
            quizId,
            question: quizMap[quizId]?.question || '(삭제된 문제)',
            wrongRate: Math.round((data.wrong / data.total) * 100),
            total: data.total,
        }))
        .sort((a, b) => b.wrongRate - a.wrongRate)
        .slice(0, 10);

    if (sorted.length === 0) {
        DOM.wrongStatsBody.innerHTML = `
      <tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:32px;">
        아직 퀴즈 응답 데이터가 없습니다.
      </td></tr>`;
        return;
    }

    DOM.wrongStatsBody.innerHTML = sorted.map((s, idx) => {
        const barClass = s.wrongRate >= 70 ? 'danger' : s.wrongRate >= 40 ? 'warning' : 'good';
        return `
      <tr>
        <td><span class="badge badge-gold">${idx + 1}</span></td>
        <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
            title="${escapeHtml(s.question)}">${escapeHtml(s.question)}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="progress-bar" style="flex:1; max-width:80px;">
              <div class="progress-bar-fill ${barClass}" style="width:${s.wrongRate}%"></div>
            </div>
            <span style="font-size:0.85rem; font-weight:600; color:var(--red-accent);">${s.wrongRate}%</span>
          </div>
        </td>
        <td>${s.total}회</td>
      </tr>
    `;
    }).join('');
}


/**
 * 등록된 퀴즈들로부터 유니크한 차시(session_unit) 목록을 추출하여 필터 드롭다운 업데이트
 */
async function updateSessionFilter() {
    try {
        const snapshot = await db.collection('quizzes').get();
        const units = new Set();
        snapshot.forEach(doc => {
            units.add(doc.data().session_unit || '기본');
        });

        const sortedUnits = Array.from(units).sort();
        const currentValue = DOM.filterSessionUnit.value;

        let html = '<option value="all">전체 차시</option>';
        sortedUnits.forEach(unit => {
            html += `<option value="${unit}">${escapeHtml(unit)}</option>`;
        });

        DOM.filterSessionUnit.innerHTML = html;
        // 이전에 선택했던 값이 있다면 유지 (없어졌으면 'all')
        if (Array.from(DOM.filterSessionUnit.options).some(opt => opt.value === currentValue)) {
            DOM.filterSessionUnit.value = currentValue;
        } else {
            DOM.filterSessionUnit.value = 'all';
        }
    } catch (err) {
        console.error('[차시 필터 업데이트 에러]', err);
    }
}

/**
 * 현재 등록된 퀴즈 목록을 Firestore에서 로드하여 렌더링 (필터링 적용)
 */
async function loadCurrentQuizzes() {
    try {
        const filterValue = DOM.filterSessionUnit.value;
        let query = db.collection('quizzes');
        
        const snapshot = await query.get();

        if (snapshot.empty) {
            DOM.currentQuizBody.innerHTML = `
        <tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:32px;">
          등록된 퀴즈가 없습니다. 엑셀 파일을 업로드하세요.
        </td></tr>`;
            return;
        }

        let quizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // 클라이언트 측 필터링
        if (filterValue !== 'all') {
            quizzes = quizzes.filter(q => (q.session_unit || '기본') === filterValue);
        }

        // 차시별로 정렬
        quizzes.sort((a, b) => {
            const unitA = String(a.session_unit || '기본');
            const unitB = String(b.session_unit || '기본');
            if (unitA !== unitB) return unitA.localeCompare(unitB);
            return 0;
        });

        if (quizzes.length === 0) {
            DOM.currentQuizBody.innerHTML = `
        <tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:16px;">
          해당 차시에 등록된 퀴즈가 없습니다.
        </td></tr>`;
            return;
        }

        DOM.currentQuizBody.innerHTML = quizzes.map((q) => {
            const isActive = q.is_active !== false; // 기본값 true
            const statusBadge = isActive 
                ? '<span class="badge badge-green">활성</span>' 
                : '<span class="badge badge-red">비활성</span>';
            const toggleText = isActive ? '끄기' : '켜기';
            
            const correctIdx = parseInt(q.correct_answer) - 1;
            const answerText = q.options?.[correctIdx] || '오류';

            return `
      <tr>
        <td><span class="badge badge-gold">${escapeHtml(q.session_unit || '기본')}</span></td>
        <td title="${escapeHtml(q.question)}">${escapeHtml(q.question)}</td>
        <td title="${escapeHtml(answerText)}">${escapeHtml(answerText)}</td>
        <td><span class="badge badge-gold">${q.reward_gold || 0}전</span></td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-sm ${isActive ? 'btn-secondary' : 'btn-primary'}" 
                    onclick="toggleQuizStatus('${q.id}', ${isActive})">${toggleText}</button>
            <button class="btn btn-sm btn-red" onclick="deleteQuiz('${q.id}')">삭제</button>
          </div>
        </td>
      </tr>
    `}).join('');

        // 퀴즈 목록 로드 후 필터 목록도 최신화 (새로 추가된 차시가 있을 수 있음)
        updateSessionFilter();

    } catch (err) {
        console.error('[퀴즈 목록 로드 에러]', err);
        DOM.currentQuizBody.innerHTML = `
      <tr><td colspan="6" style="text-align:center; color:var(--red-accent); padding:32px;">
        데이터 로드 실패: ${err.message}
      </td></tr>`;
    }
}

/**
 * 특정 차시(session_unit)의 모든 퀴즈 삭제
 */
async function deleteQuizGroup() {
    const filterValue = DOM.filterSessionUnit.value;
    if (filterValue === 'all') {
        showToast('삭제할 차시를 먼저 선택하세요.', 'info');
        return;
    }

    if (!confirm(`[${filterValue}] 차시의 모든 퀴즈를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    try {
        const snapshot = await db.collection('quizzes').where('session_unit', '==', filterValue === '기본' ? null : filterValue).get();
        // 참고: null 체크가 어려울 수 있으니 모든 퀴즈를 가져와서 필터링하는 것이 안전할 수 있음
        const allQuizzes = await db.collection('quizzes').get();
        const targets = allQuizzes.docs.filter(doc => (doc.data().session_unit || '기본') === filterValue);

        if (targets.length === 0) {
            showToast('삭제할 퀴즈가 없습니다.', 'info');
            return;
        }

        const batch = db.batch();
        targets.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        showToast(`[${filterValue}] 차시의 퀴즈 ${targets.length}개가 삭제되었습니다.`, 'success');
        
        // 필터를 'all'로 돌리고 새로고침
        DOM.filterSessionUnit.value = 'all';
        loadCurrentQuizzes();
    } catch (err) {
        console.error('[그룹 삭제 에러]', err);
        showToast('그룹 삭제 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 퀴즈 활성화/비활성화 토글
 */
window.toggleQuizStatus = async function(quizId, currentStatus) {
    try {
        await db.collection('quizzes').doc(quizId).update({
            is_active: !currentStatus
        });
        showToast(`퀴즈 상태가 변경되었습니다.`, 'success');
        loadCurrentQuizzes();
    } catch (err) {
        console.error('[퀴즈 상태 변경 에러]', err);
        showToast('상태 변경 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 퀴즈 개별 삭제
 */
window.deleteQuiz = async function(quizId) {
    if (!confirm('정말 이 퀴즈를 삭제하시겠습니까?')) return;
    
    try {
        await db.collection('quizzes').doc(quizId).delete();
        showToast('퀴즈가 삭제되었습니다.', 'success');
        loadCurrentQuizzes();
    } catch (err) {
        console.error('[퀴즈 삭제 에러]', err);
        showToast('퀴즈 삭제 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 현재 등록된 세션 및 학생 명단을 RTDB에서 로드하여 렌더링
 */
async function loadCurrentSessions() {
    try {
        const snapshot = await rtdb.ref('sessions').once('value');
        const sessions = snapshot.val();

        if (!sessions) {
            DOM.currentSessionsBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:32px;">
          등록된 세션이 없습니다. 엑셀 파일을 업로드해 세션을 생성하세요.
        </td></tr>`;
            return;
        }

        let html = '';
        for (const [sessionCode, sessionData] of Object.entries(sessions)) {
            const students = sessionData.students || {};
            const studentCount = Object.keys(students).length;
            const isActive = sessionData.is_active === true;
            
            const statusBadge = isActive 
                ? '<span class="badge badge-green">활성</span>' 
                : '<span class="badge badge-red">비활성</span>';
            const toggleText = isActive ? '비활성화' : '활성화';
            const btnClass = isActive ? 'btn-secondary' : 'btn-primary';

            // 대표 학생 정보 추출 (1명)
            let sampleGradeClass = '-';
            let sampleNames = [];
            
            const studentList = Object.values(students);
            if (studentList.length > 0) {
                sampleGradeClass = `${studentList[0].grade}학년 ${studentList[0].class}반`;
                sampleNames = studentList.slice(0, 3).map(s => s.name);
            }
            
            const nameDisplay = sampleNames.length > 0 
                ? sampleNames.join(', ') + (studentList.length > 3 ? ` 외 ${studentList.length - 3}명` : '')
                : '등록된 학생 없음';

            html += `
            <tr>
              <td><span class="badge badge-gold">${escapeHtml(sessionCode)}</span></td>
              <td>${escapeHtml(sampleGradeClass)}</td>
              <td>${escapeHtml(nameDisplay)}</td>
              <td>${statusBadge} (${studentCount}명)</td>
              <td>
                <div style="display:flex; gap:4px;">
                  <button class="btn btn-sm ${btnClass}" onclick="toggleSessionActive('${sessionCode}', ${isActive})">${toggleText}</button>
                  <button class="btn btn-sm btn-red" onclick="deleteSession('${sessionCode}')">삭제</button>
                </div>
              </td>
            </tr>
            `;
        }

        DOM.currentSessionsBody.innerHTML = html;

    } catch (err) {
        console.error('[세션 목록 로드 에러]', err);
        DOM.currentSessionsBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center; color:var(--red-accent); padding:32px;">
        데이터 로드 실패: ${err.message}
      </td></tr>`;
    }
}

/**
 * 세션 활성화/비활성화 토글
 */
window.toggleSessionActive = async function(sessionCode, currentStatus) {
    try {
        await rtdb.ref(`sessions/${sessionCode}`).update({
            is_active: !currentStatus
        });
        showToast(`세션 [${sessionCode}] 상태가 변경되었습니다.`, 'success');
        loadCurrentSessions();
    } catch (err) {
        console.error('[세션 상태 변경 에러]', err);
        showToast('상태 변경 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 전역으로 호출할 세션 삭제 함수
 */
window.deleteSession = async function(sessionCode) {
    if (!confirm(`정말 세션 [${sessionCode}] 을(를) 삭제하시겠습니까?\n해당 세션의 학생 명단이 모두 삭제됩니다.`)) return;
    
    try {
        await rtdb.ref('sessions/' + sessionCode).remove();
        showToast(`세션 [${sessionCode}] 이(가) 삭제되었습니다.`, 'success');
        loadCurrentSessions();
    } catch (err) {
        console.error('[세션 삭제 에러]', err);
        showToast('세션 삭제 중 오류가 발생했습니다.', 'error');
    }
}


// 통계 새로고침 버튼
DOM.btnRefreshStats.addEventListener('click', () => {
    showToast('통계를 새로고침합니다...', 'info');
    loadAllStats();
    loadCurrentQuizzes();
    loadCurrentSessions();
});

// 차시 필터 변경 이벤트
DOM.filterSessionUnit.addEventListener('change', () => {
    loadCurrentQuizzes();
});

// 그룹 삭제 버튼 이벤트
DOM.btnDeleteGroup.addEventListener('click', deleteQuizGroup);

// ============================================================
// 4. 유틸리티 함수
// ============================================================

/**
 * HTML 이스케이프 (XSS 방지)
 * @param {string} text - 이스케이프할 문자열
 * @returns {string} 이스케이프된 문자열
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 토스트 알림 표시
 * @param {string} message - 알림 메시지
 * @param {string} type - 'success' | 'error' | 'info'
 */
function showToast(message, type = 'info') {
    // 기존 토스트 제거
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 3초 후 자동 제거
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

console.log('[Admin] 관리자 대시보드 초기화 완료');
