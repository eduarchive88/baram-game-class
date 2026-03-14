/**
 * QuizManager.js - 퀴즈 시스템 관리자
 * Firestore에서 퀴즈 데이터 로드 + 게임 내 팝업 + 보상 지급
 */

class QuizManager {
    constructor() {
        // 퀴즈 데이터 캐시 (Firestore에서 로드)
        this.quizzes = [];
        // 이미 출제된 퀴즈 ID (중복 방지)
        this.usedQuizIds = new Set();
        // 현재 활성 퀴즈
        this.activeQuiz = null;
        // 퀴즈 UI 표시 여부
        this.isVisible = false;
        // 정답 후 보상 콜백
        this.onRewardCallback = null;
        // 로드 상태
        this.loaded = false;

        console.log('[QuizManager] 초기화 완료');
    }

    /**
     * Firestore에서 퀴즈 데이터 로드
     */
    async loadQuizzes() {
        try {
            const snapshot = await db.collection('quizzes').get();
            this.quizzes = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // answer 필드를 항상 정수로 변환 (Firestore에서 문자열로 올 수 있음)
                this.quizzes.push({
                    id: doc.id,
                    ...data,
                    answer: parseInt(data.answer, 10) || 0,
                    options: Array.isArray(data.options) ? data.options : [],
                });
            });
            this.loaded = true;
            console.log(`[QuizManager] 퀴즈 ${this.quizzes.length}개 로드 완료`);
        } catch (err) {
            console.warn('[QuizManager] 퀴즈 로드 실패:', err);
            // 기본 퀴즈 세트 (Firestore 데이터 없을 때 폴백)
            this.quizzes = this._getDefaultQuizzes();
            this.loaded = true;
        }
    }

    /**
     * 기본 퀴즈 (Firestore에 데이터 없을 때)
     */
    _getDefaultQuizzes() {
        return [
            { id: 'def_1', question: '지구에서 달까지의 평균 거리는 약 얼마인가요?', options: ['38만 km', '15만 km', '100만 km', '5만 km'], answer: 0, category: '지구과학' },
            { id: 'def_2', question: '태양계에서 가장 큰 행성은?', options: ['토성', '목성', '해왕성', '천왕성'], answer: 1, category: '지구과학' },
            { id: 'def_3', question: '물의 화학식은?', options: ['CO2', 'H2O', 'NaCl', 'O2'], answer: 1, category: '화학' },
            { id: 'def_4', question: '지진의 세기를 나타내는 단위는?', options: ['리히터', '데시벨', '파스칼', '옹스트롬'], answer: 0, category: '지구과학' },
            { id: 'def_5', question: '광합성에 필요한 기체는?', options: ['산소', '질소', '이산화탄소', '수소'], answer: 2, category: '생물' },
            { id: 'def_6', question: '지구의 자전 주기는 약?', options: ['12시간', '24시간', '36시간', '48시간'], answer: 1, category: '지구과학' },
            { id: 'def_7', question: '화산 활동으로 분출되는 용암의 주성분은?', options: ['규산염', '탄산칼슘', '산화철', '염화나트륨'], answer: 0, category: '지구과학' },
            { id: 'def_8', question: '빛의 속도는 초속 약 얼마인가요?', options: ['30만 km', '15만 km', '3만 km', '100만 km'], answer: 0, category: '물리' },
            { id: 'def_9', question: '대기권에서 오존층이 있는 곳은?', options: ['대류권', '성층권', '중간권', '열권'], answer: 1, category: '지구과학' },
            { id: 'def_10', question: '별의 탄생이 시작되는 곳은?', options: ['블랙홀', '성운', '백색왜성', '초신성'], answer: 1, category: '지구과학' },
        ];
    }

    /**
     * 퀴즈 트리거 (몬스터 처치 후 호출)
     * @param {Player} player - 보상 수령 플레이어
     */
    triggerQuiz(player) {
        if (this.isVisible || this.quizzes.length === 0) return;

        // 아직 미출제 퀴즈 필터
        let available = this.quizzes.filter(q => !this.usedQuizIds.has(q.id));
        if (available.length === 0) {
            // 모든 퀴즈 출제 완료 → 초기화
            this.usedQuizIds.clear();
            available = this.quizzes;
        }

        // 랜덤 선택
        const quiz = available[Math.floor(Math.random() * available.length)];
        this.usedQuizIds.add(quiz.id);

        this.activeQuiz = {
            ...quiz,
            selectedAnswer: -1,
            answered: false,
            correct: false,
            player: player,
        };
        this.isVisible = true;

        // 게임 루프에 퀴즈 UI 표시 요청
        this._showQuizUI(quiz);

        console.log(`[QuizManager] 퀴즈 출제: ${quiz.question}`);
    }

    /**
     * 퀴즈 UI DOM 표시
     */
    _showQuizUI(quiz) {
        const overlay = document.getElementById('quiz-overlay');
        const questionEl = document.getElementById('quiz-question');
        const optionsEl = document.getElementById('quiz-options');
        const resultEl = document.getElementById('quiz-result');
        const categoryEl = document.getElementById('quiz-category');

        if (!overlay) return;

        overlay.style.display = 'flex';
        questionEl.textContent = quiz.question;
        categoryEl.textContent = quiz.category || '일반';
        resultEl.textContent = '';
        resultEl.className = 'quiz-result';

        // 보기 생성
        optionsEl.innerHTML = '';
        quiz.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option';
            btn.textContent = `${['①', '②', '③', '④'][idx]} ${opt}`;
            btn.dataset.index = idx;
            btn.addEventListener('click', () => this._selectAnswer(idx));
            optionsEl.appendChild(btn);
        });
    }

    /**
     * 답 선택 처리
     * @param {number} idx - 선택 인덱스
     */
    _selectAnswer(idx) {
        if (!this.activeQuiz || this.activeQuiz.answered) return;

        this.activeQuiz.answered = true;
        this.activeQuiz.selectedAnswer = idx;
        // answer를 정수로 강제 변환하여 비교
        const correctIdx = parseInt(this.activeQuiz.answer, 10) || 0;
        this.activeQuiz.correct = (idx === correctIdx);

        const resultEl = document.getElementById('quiz-result');
        const optionBtns = document.querySelectorAll('.quiz-option');

        // 정답/오답 표시
        optionBtns.forEach((btn, i) => {
            btn.disabled = true;
            if (i === correctIdx) {
                btn.classList.add('correct');
            }
            if (i === idx && !this.activeQuiz.correct) {
                btn.classList.add('wrong');
            }
        });

        if (this.activeQuiz.correct) {
            resultEl.textContent = '🎉 정답! 보너스 경험치 +30, 골드 +20 지급!';
            resultEl.className = 'quiz-result correct';
            this._giveReward(this.activeQuiz.player, true);
        } else {
            // 안전하게 정답 텍스트 가져오기 (undefined 방지)
            const correctText = (this.activeQuiz.options && this.activeQuiz.options[correctIdx])
                ? this.activeQuiz.options[correctIdx]
                : `${correctIdx + 1}번`;
            resultEl.textContent = `❌ 오답! 정답은 "${correctText}" 입니다.`;
            resultEl.className = 'quiz-result wrong';
            this._giveReward(this.activeQuiz.player, false);
        }

        // Firestore에 답변 기록 저장
        this._saveAnswer(this.activeQuiz);

        // 2초 후 자동 닫기
        setTimeout(() => this.closeQuiz(), 2500);
    }

    /**
     * 보상 지급
     * @param {Player} player
     * @param {boolean} isCorrect
     */
    _giveReward(player, isCorrect) {
        if (isCorrect) {
            // 정답 보상: 골드 + 경험치 보너스
            const bonusExp = 30;
            const bonusGold = 20;
            player.exp = (player.exp || 0) + bonusExp;
            player.gold = (player.gold || 0) + bonusGold;

            console.log(`[QuizManager] 정답! +${bonusExp}EXP +${bonusGold}G`);
        } else {
            // 오답: 소량 경험치만
            const consolationExp = 5;
            player.exp = (player.exp || 0) + consolationExp;

            console.log('[QuizManager] 오답. +5EXP 위로 보상');
        }

        // RTDB 저장
        if (player.uid) {
            rtdb.ref('userData/' + player.uid).update({
                exp: player.exp,
                gold: player.gold,
            });
        }
    }

    /**
     * 퀴즈 답변 Firestore 기록
     */
    async _saveAnswer(quizData) {
        try {
            const user = auth.currentUser;
            if (!user) return;

            await db.collection('quiz_answers').add({
                userId: user.uid,
                userEmail: user.email,
                quizId: quizData.id,
                question: quizData.question,
                selectedAnswer: quizData.selectedAnswer,
                correctAnswer: quizData.answer,
                isCorrect: quizData.correct,
                category: quizData.category || '',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } catch (err) {
            console.warn('[QuizManager] 답변 기록 실패:', err);
        }
    }

    /**
     * 퀴즈 닫기
     */
    closeQuiz() {
        this.isVisible = false;
        this.activeQuiz = null;
        const overlay = document.getElementById('quiz-overlay');
        if (overlay) overlay.style.display = 'none';
    }
}

// 전역 싱글톤
const quizManager = new QuizManager();
