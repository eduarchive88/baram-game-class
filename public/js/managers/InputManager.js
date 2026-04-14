class InputManager {
    constructor() {
        this.keys = {};
        this.direction = null;
        this.actionPressed = false;
        
        // 조이스틱 상태
        this.joystick = {
            active: false,
            startX: 0,
            startY: 0,
            moveX: 0,
            moveY: 0,
            maxDistance: 60,
            angle: null,
            distance: 0
        };
        
        this._setupKeyboard();
        this._setupMobileControls();
    }

    /**
     * 키보드 이벤트 설정
     */
    _setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            // 스페이스바/엔터: 액션/대화
            if (e.code === 'Space' || e.code === 'Enter') {
                this.actionPressed = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            
            if (e.code === 'Space' || e.code === 'Enter') {
                this.actionPressed = false;
            }
        });
    }

    /**
     * 모바일 대응: 클릭/터치 기반 인터랙션 (기본 버튼 전용)
     */
    _setupMobileControls() {
        // 1. 가상 조이스틱 (드래그)
        const joystickBase = document.getElementById('joystick-container');
        const joystickKnob = document.getElementById('joystick-knob');

        if (joystickBase && joystickKnob) {
            const handleStart = (e) => {
                const touch = e.touches ? e.touches[0] : e;
                this.joystick.active = true;
                this.joystick.startX = touch.clientX;
                this.joystick.startY = touch.clientY;
                e.preventDefault();
            };

            const handleMove = (e) => {
                if (!this.joystick.active) return;
                const touch = e.touches ? e.touches[0] : e;
                
                const dx = touch.clientX - this.joystick.startX;
                const dy = touch.clientY - this.joystick.startY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // 최대 거리 제한
                const limitedDist = Math.min(dist, this.joystick.maxDistance);
                const angle = Math.atan2(dy, dx);
                
                this.joystick.moveX = Math.cos(angle) * limitedDist;
                this.joystick.moveY = Math.sin(angle) * limitedDist;
                this.joystick.angle = angle;
                this.joystick.distance = limitedDist;

                // 시각적 업데이트
                joystickKnob.style.transform = `translate(${this.joystick.moveX}px, ${this.joystick.moveY}px)`;
                e.preventDefault();
            };

            const handleEnd = () => {
                this.joystick.active = false;
                this.joystick.moveX = 0;
                this.joystick.moveY = 0;
                this.joystick.angle = null;
                this.joystick.distance = 0;
                joystickKnob.style.transform = `translate(0, 0)`;
            };

            joystickBase.addEventListener('touchstart', handleStart, { passive: false });
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd);
            
            joystickBase.addEventListener('mousedown', handleStart);
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
        }

        // 1.5 상단 시스템 버튼
        const btnMenu = document.getElementById('hud-btn-menu');
        if (btnMenu) {
            btnMenu.addEventListener('click', () => {
                const sidebar = document.getElementById('game-side-panel');
                if (sidebar) {
                    sidebar.style.display = (sidebar.style.display === 'flex') ? 'none' : 'flex';
                }
            });
        }
        
        // hud-btn-settings는 setupHUDButtons()에서 openSettingsPanel로 연결됨


        // 2. 공격 버튼 (⚔️)
        const attackBtn = document.getElementById('hud-btn-attack');
        if (attackBtn) {
            const press = (e) => { 
                this.actionPressed = true; 
                e.preventDefault(); 
            };
            const release = () => { this.actionPressed = false; };
            
            attackBtn.addEventListener('pointerdown', press);
            attackBtn.addEventListener('pointerup', release);
            attackBtn.addEventListener('pointerleave', release);
            attackBtn.addEventListener('pointercancel', release);
        }

        // 3. 상호작용 버튼 (💬)
        const interactBtn = document.getElementById('hud-btn-interact');
        if (interactBtn) {
            interactBtn.addEventListener('pointerdown', (e) => {
                this.actionPressed = true;
                setTimeout(() => { this.actionPressed = false; }, 150);
                e.preventDefault();
            });
        }

        // 4. 스킬 버튼 (0~3)
        for (let i = 0; i < 4; i++) {
            const skillBtn = document.getElementById(`hud-skill-${i}`);
            if (skillBtn) {
                skillBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (window.localPlayer && window.combatManager) {
                        const result = skillManager.useSkill(i, window.localPlayer, window.combatManager);
                        if (!result.success && window.combatManager._addDamageText) {
                            // 스킬 사용 실패(미배치, 쿨다운, MP부족 등) 시 피드백 제공
                            window.combatManager._addDamageText(
                                window.localPlayer.x + 16, 
                                window.localPlayer.y - 16, 
                                result.message, 
                                '#ff4444'
                            );
                        }
                    }
                });
            }
        }
    }

    /**
     * 매 프레임 입력 상태 업데이트
     */
    update() {
        // 키보드 입력을 통해 최종 방향 결정
        let dir = null;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            dir = 'up';
        } else if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            dir = 'down';
        } else if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            dir = 'left';
        } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            dir = 'right';
        }

        // 조이스틱 (키보드 입력 없을 때)
        if (!dir && this.joystick.active && this.joystick.distance > 20) {
            const angle = this.joystick.angle * (180 / Math.PI); // Degree conversion
            if (angle > -45 && angle <= 45) {
                dir = 'right';
            } else if (angle > 45 && angle <= 135) {
                dir = 'down';
            } else if (angle > -135 && angle <= -45) {
                dir = 'up';
            } else {
                dir = 'left';
            }
        }

        this.direction = dir;
    }

    /**
     * 리소스 정리
     */
    destroy() {
        this.keys = {};
        this.direction = null;
        this.actionPressed = false;
    }
}

// 전역에서 접근 가능하도록 내보내기 (모듈화 전 단계 대응)
if (typeof window !== 'undefined') {
    window.InputManager = InputManager;
}
