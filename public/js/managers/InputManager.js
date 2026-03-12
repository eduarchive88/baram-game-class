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

        // 이벤트 바인딩
        this._bindKeyboard();
        if (this.isMobile) {
            this._setupMobileControls();
        }
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
     * 모바일 가상 조이스틱 + 액션 버튼 설정
     */
    _setupMobileControls() {
        // 모바일 컨트롤 UI 표시
        const mobileUI = document.getElementById('mobile-controls');
        if (mobileUI) mobileUI.style.display = 'flex';

        // 조이스틱 영역
        const joystickZone = document.getElementById('joystick-zone');
        if (!joystickZone) return;

        // 터치 시작
        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            this.joystick.active = true;
            this.joystick.touchId = touch.identifier;

            const rect = joystickZone.getBoundingClientRect();
            this.joystick.startX = rect.left + rect.width / 2;
            this.joystick.startY = rect.top + rect.height / 2;
            this.joystick.currentX = touch.clientX;
            this.joystick.currentY = touch.clientY;

            this._updateJoystickVisual();
        }, { passive: false });

        // 터치 이동
        joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier === this.joystick.touchId) {
                    this.joystick.currentX = touch.clientX;
                    this.joystick.currentY = touch.clientY;
                    this._updateJoystickVisual();
                }
            }
        }, { passive: false });

        // 터치 종료
        const touchEndHandler = (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === this.joystick.touchId) {
                    this.joystick.active = false;
                    this.joystick.touchId = null;
                    this.direction = null;
                    this._resetJoystickVisual();
                }
            }
        };
        joystickZone.addEventListener('touchend', touchEndHandler);
        joystickZone.addEventListener('touchcancel', touchEndHandler);

        // 액션 버튼 (공격/인터랙션)
        const actionBtn = document.getElementById('btn-action');
        if (actionBtn) {
            actionBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.actionPressed = true;
                actionBtn.classList.add('pressed');
            }, { passive: false });
            actionBtn.addEventListener('touchend', (e) => {
                this.actionPressed = false;
                actionBtn.classList.remove('pressed');
            });
        }
    }

    /**
     * 조이스틱 비주얼 업데이트
     */
    _updateJoystickVisual() {
        const knob = document.getElementById('joystick-knob');
        if (!knob) return;

        const dx = this.joystick.currentX - this.joystick.startX;
        const dy = this.joystick.currentY - this.joystick.startY;
        const maxRadius = 40;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clampedDist = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);

        const clampedX = Math.cos(angle) * clampedDist;
        const clampedY = Math.sin(angle) * clampedDist;

        knob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
    }

    /**
     * 조이스틱 비주얼 리셋
     */
    _resetJoystickVisual() {
        const knob = document.getElementById('joystick-knob');
        if (knob) {
            knob.style.transform = 'translate(0px, 0px)';
        }
    }

    /**
     * 매 프레임 입력 상태 업데이트
     * 키보드 또는 조이스틱에서 방향 결정
     */
    update() {
        if (this.isMobile && this.joystick.active) {
            // 모바일 조이스틱 방향 계산
            const dx = this.joystick.currentX - this.joystick.startX;
            const dy = this.joystick.currentY - this.joystick.startY;
            const deadzone = 15;

            if (Math.abs(dx) < deadzone && Math.abs(dy) < deadzone) {
                this.direction = null;
                return;
            }

            // 4방향 중 가장 큰 축 선택
            if (Math.abs(dx) > Math.abs(dy)) {
                this.direction = dx > 0 ? 'right' : 'left';
            } else {
                this.direction = dy > 0 ? 'down' : 'up';
            }
        } else if (!this.isMobile) {
            // PC 키보드 방향 처리 (WASD + 방향키)
            if (this.keys['ArrowUp'] || this.keys['KeyW']) {
                this.direction = 'up';
            } else if (this.keys['ArrowDown'] || this.keys['KeyS']) {
                this.direction = 'down';
            } else if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
                this.direction = 'left';
            } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
                this.direction = 'right';
            } else {
                this.direction = null;
            }
        } else {
            this.direction = null;
        }
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
