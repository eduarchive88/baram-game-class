/**
 * RemotePlayer.js - 원격(다른) 플레이어 엔티티
 * 서버에서 수신한 데이터를 바탕으로 보간(interpolation) 렌더링
 */

class RemotePlayer {
    constructor(uid, data) {
        this.uid = uid;
        this.nickname = data.nickname || '???';
        this.job = data.job || '전사';
        this.level = data.level || 1;

        // 현재 서버 위치 (픽셀)
        this.serverX = data.x || 0;
        this.serverY = data.y || 0;

        // 렌더링용 보간 위치
        this.x = this.serverX;
        this.y = this.serverY;

        // 타일 좌표
        this.tileX = data.tileX || 0;
        this.tileY = data.tileY || 0;

        // 방향 / 이동 상태
        this.direction = data.direction || 'down';
        this.isMoving = data.isMoving || false;

        // HP
        this.hp = data.hp || 150;
        this.maxHp = data.maxHp || 150;

        // 사망(유령) 상태
        this.isDead = data.isDead || false;

        // 애니메이션
        this.animFrame = 0;
        this.animTimer = 0;
        this.ANIM_SPEED = 0.15; // 초

        // 보간 속도
        this.LERP_SPEED = 8; // 부드러운 이동 계수

        console.log(`[RemotePlayer] 생성: ${this.nickname} (${this.job})`);
    }

    /**
     * 서버 데이터로 상태 업데이트
     * @param {Object} data - RTDB에서 수신한 데이터
     */
    updateFromServer(data) {
        this.serverX = data.x;
        this.serverY = data.y;
        this.tileX = data.tileX || this.tileX;
        this.tileY = data.tileY || this.tileY;
        this.direction = data.direction || this.direction;
        this.isMoving = data.isMoving || false;
        this.level = data.level || this.level;
        this.hp = data.hp || this.hp;
        this.maxHp = data.maxHp || this.maxHp;
        this.isDead = (data.isDead === true); // 사망 상태 업데이트
        this.nickname = data.nickname || this.nickname;
        this.job = data.job || this.job;
    }

    /**
     * 매 프레임 업데이트 (보간 이동 + 애니메이션)
     * @param {number} dt - 델타 타임 (초)
     */
    update(dt) {
        // 서버 위치로 부드럽게 보간 이동 (Linear interpolation)
        const lerpFactor = Math.min(1, this.LERP_SPEED * dt);
        this.x += (this.serverX - this.x) * lerpFactor;
        this.y += (this.serverY - this.y) * lerpFactor;

        // 걷기 애니메이션
        if (this.isMoving) {
            this.animTimer += dt;
            if (this.animTimer >= this.ANIM_SPEED) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % 4;
            }
        } else {
            this.animFrame = 0;
            this.animTimer = 0;
        }
    }

    /**
     * 렌더링
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera - 카메라 { x, y }
     */
    render(ctx, camera) {
        const TILE_SIZE = 32;
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // 화면 밖이면 렌더링 스킵
        if (screenX < -TILE_SIZE || screenX > ctx.canvas.width + TILE_SIZE ||
            screenY < -TILE_SIZE || screenY > ctx.canvas.height + TILE_SIZE) {
            return;
        }

        // 방향 인덱스 매핑
        const dirMap = { down: 0, left: 1, right: 2, up: 3 };
        const dirIdx = dirMap[this.direction] || 0;

        ctx.save();
        
        // 유령 모드 연출 (반투명 + 깜빡임 + 붉은 색조)
        if (this.isDead) {
            // 투명도 범위를 조금 더 밝게 조정 (0.4 ~ 0.7)
            ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 250) * 0.2;
            
            // 붉은색 필터 효과 (미지원 시 대비하여 강렬하게)
            if (ctx.filter && ctx.filter !== 'none') {
                ctx.filter = 'sepia(1) saturate(10) hue-rotate(-50deg) brightness(1.2)';
            }
        }

        // 스프라이트 가져오기
        const sprite = assetManager.getSprite(this.job, dirIdx, this.animFrame);
        if (sprite) {
            ctx.drawImage(sprite, Math.floor(screenX), Math.floor(screenY), TILE_SIZE, TILE_SIZE);
        } else {
            // 폴백: 사각형으로 표시
            ctx.fillStyle = this.isDead ? '#ffaaaa' : '#808080';
            ctx.fillRect(Math.floor(screenX) + 8, Math.floor(screenY) + 4, 16, 24);
        }

        if (ctx.filter) ctx.filter = 'none';
        ctx.restore();

        // 유령 아이콘 및 상태 표시
        if (this.isDead) {
            ctx.save();
            // 아이콘 크기 확대 및 그림자 추가
            ctx.font = '20px sans-serif'; 
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
            ctx.shadowBlur = 10;
            ctx.fillText('👻', screenX + TILE_SIZE / 2, screenY - 18);
            
            // '유령' 텍스트 추가
            ctx.font = 'bold 9px "Noto Sans KR", sans-serif';
            ctx.fillStyle = '#ff4040';
            ctx.shadowBlur = 0;
            ctx.fillText('Ghost', screenX + TILE_SIZE / 2, screenY - 5);
            ctx.restore();
        }

        // 닉네임 표시
        ctx.save();
        ctx.font = 'bold 10px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillText(this.nickname, screenX + TILE_SIZE / 2 + 1, screenY - 12);
        ctx.fillStyle = this.isDead ? '#ff8080' : '#a0d0ff'; // 사망 시 닉네임 색상 변경
        ctx.fillText(this.nickname, screenX + TILE_SIZE / 2, screenY - 13);
        ctx.restore();

        // HP 바
        this._renderHPBar(ctx, screenX, screenY);
    }

    /**
     * HP 바 렌더링
     */
    _renderHPBar(ctx, screenX, screenY) {
        if (this.isDead) return; // 사망 시 HP 바 숨김

        const barW = 28;
        const barH = 3;
        const barX = screenX + 2;
        const barY = screenY - 2;
        const ratio = Math.max(0, this.hp / this.maxHp);

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX, barY, barW, barH);

        // HP 비율에 따른 색상
        const color = ratio > 0.5 ? '#40d040' : ratio > 0.25 ? '#e0c020' : '#e02020';
        ctx.fillStyle = color;
        ctx.fillRect(barX, barY, barW * ratio, barH);
    }
}
