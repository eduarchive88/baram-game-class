/**
 * InputManager.js - PC 키보드 + 모바일 가상 조이스틱 통합 입력 관리자
 * 바람의 나라 교육용 RPG - 조작계 (PC/Mobile 분리)
 */

class InputManager {
    constructor() {
        // 현재 입력 상태
        this.keys = {};              // 키보드 키 상태
        this.direction = null;       // 현재 이동 방향 ('up', 'down', 'left', 'right' 또는 null)
        this.actionPressed = false;  // 공격/인터랙션 버튼
        this.isMobile = false;       // 모바일 여부

        // 가상 조이스틱 상태
        this.joystick = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            touchId: null,
        };

        // 모바일 감지
        this._detectMobile();

        // 이벤트 바인딩 (PC, 모바일 모두 설정하여 크로스 플랫폼 지원)
        this._bindKeyboard();
        this._setupMobileControls();
    }

    /**
     * 모바일 디바이스 감지
     */
    _detectMobile() {
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || ('ontouchstart' in window)
            || (navigator.maxTouchPoints > 0);
        console.log(`[InputManager] 입력 모드: ${this.isMobile ? '모바일 (터치)' : 'PC (키보드)'}`);
    }

    /**
     * PC 키보드 이벤트 바인딩
     */
    _bindKeyboard() {
        // 키 다운
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            // 스페이스바로 공격/인터랙션
            if (e.code === 'Space') {
                this.actionPressed = true;
                e.preventDefault();
            }
            // 방향키 스크롤 방지
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });

        // 키 업
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'Space') {
                this.actionPressed = false;
            }
        });
    }

    /**
     * 모바일 대응: 클릭/터치 기반 인터랙션 (기본 버튼 전용)
     */
    _setupMobileControls() {
        // 공격 버튼
        const attackBtn = document.getElementById('btn-attack');
        if (attackBtn) {
            const handleAttack = (e) => {
                e.preventDefault();
                this.actionPressed = true;
                setTimeout(() => { this.actionPressed = false; }, 100);
            };
            attackBtn.addEventListener('mousedown', handleAttack);
            attackBtn.addEventListener('touchstart', handleAttack, { passive: false });
        }

        // 대화/인터랙션 버튼
        const interactBtn = document.getElementById('btn-interact');
        if (interactBtn) {
            const handleInteract = (e) => {
                e.preventDefault();
                this.actionPressed = true;
                setTimeout(() => { this.actionPressed = false; }, 100);
            };
            interactBtn.addEventListener('mousedown', handleInteract);
            interactBtn.addEventListener('touchstart', handleInteract, { passive: false });
        }
    }

    /**
     * 매 프레임 입력 상태 업데이트
     */
    update() {
        // 키보드 입력을 통해 최종 방향 결정 (사이드 패널에서는 조이스틱 미사용)
        let dir = null;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) dir = 'up';
        else if (this.keys['ArrowDown'] || this.keys['KeyS']) dir = 'down';
        else if (this.keys['ArrowLeft'] || this.keys['KeyA']) dir = 'left';
        else if (this.keys['ArrowRight'] || this.keys['KeyD']) dir = 'right';

        this.direction = dir;
    }
}
            if (this.keys['ArrowUp'] || this.keys['KeyW']) {
                dir = 'up';
            } else if (this.keys['ArrowDown'] || this.keys['KeyS']) {
                dir = 'down';
            } else if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
                dir = 'left';
            } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
                dir = 'right';
            }
        }

        this.direction = dir;
    }

    /**
     * 리소스 정리
     */
    destroy() {
        // 이벤트 리스너 정리는 필요 시 구현
        this.keys = {};
        this.direction = null;
        this.actionPressed = false;
    }
}
