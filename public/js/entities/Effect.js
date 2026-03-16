/**
 * Effect.js - 공통 전투 이펙트 클래스 모음
 * 로컬 플레이어와 원격 플레이어 모두가 동일한 이펙트 시스템을 사용하도록 함
 */

class Effect {
    constructor(x, y, duration) {
        this.x = x;
        this.y = y;
        this.timer = 0;
        this.duration = duration;
        this.isFinished = false;
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.duration) {
            this.isFinished = true;
        }
    }

    render(ctx, camera) {
        // 하위 클래스에서 구현
    }
}

/**
 * 근접 공격(슬래시) 이펙트
 */
class SlashEffect extends Effect {
    constructor(x, y, dir, color = '#FF6B35', glow = '#FFA500', type = 'heavy_slash') {
        super(x, y, 0.4);
        this.dir = dir;
        this.color = color;
        this.glow = glow;
        this.type = type;
    }

    render(ctx, camera) {
        const sx = this.x - camera.x;
        const sy = this.y - camera.y;
        const progress = this.timer / this.duration;

        ctx.save();
        const alpha = 1 - progress;
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.type === 'heavy_slash' ? 4 : 2;
        ctx.shadowColor = this.glow || this.color;
        ctx.shadowBlur = 15;

        const startAngle = { up: Math.PI, down: 0, left: Math.PI / 2, right: -Math.PI / 2 };
        const angle = startAngle[this.dir] || 0;
        const sweep = Math.PI * progress * 1.5;
        const radius = 14 + progress * 12;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, angle - sweep / 2, angle + sweep / 2);
        ctx.stroke();

        if (this.type === 'heavy_slash') {
            ctx.beginPath();
            ctx.arc(sx, sy, radius * 0.7, angle - sweep / 2.5, angle + sweep / 2.5);
            ctx.stroke();
        }

        ctx.restore();
    }
}

/**
 * 파티클 이펙트
 */
class ParticleEffect extends Effect {
    constructor(x, y, vx, vy, duration, color, size) {
        super(x, y, duration);
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
    }

    update(dt) {
        super.update(dt);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    render(ctx, camera) {
        const sx = this.x - camera.x;
        const sy = this.y - camera.y;
        const progress = this.timer / this.duration;

        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(sx, sy, this.size * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 전역 변수로 노출 (기존 코드와의 호환성)
window.SlashEffect = SlashEffect;
window.ParticleEffect = ParticleEffect;
