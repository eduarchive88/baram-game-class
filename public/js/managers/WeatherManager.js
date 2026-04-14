/**
 * WeatherManager.js - 맵별 환경 효과 (눈, 불꽃, 낙엽 등) 관리자
 */
class WeatherManager {
    constructor() {
        this.particles = [];
        this.type = 'none'; // 'none', 'snow', 'lava', 'leaves'
        this.active = false;
    }

    setWeather(type) {
        if (this.type === type) return;
        this.type = type;
        this.particles = [];
        this.active = (type !== 'none');
        console.log(`[WeatherManager] 날씨 변경: ${type}`);
    }

    update(dt, canvas) {
        if (!this.active) return;

        // 파티클 생성
        if (this.particles.length < 50) {
            this._createParticle(canvas);
        }

        // 파티클 업데이트
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            // 화면 밖으로 나가거나 수명 다하면 제거
            if (p.life <= 0 || p.y > canvas.height + 50 || p.x < -50 || p.x > canvas.width + 50) {
                this.particles.splice(i, 1);
            }
        }
    }

    _createParticle(canvas) {
        const p = {
            x: Math.random() * canvas.width,
            y: -20,
            vx: 0,
            vy: 0,
            size: 2,
            color: '#fff',
            life: 3 + Math.random() * 2,
            alpha: 1
        };

        switch (this.type) {
            case 'snow':
                p.vx = (Math.random() - 0.5) * 20;
                p.vy = 30 + Math.random() * 40;
                p.size = 2 + Math.random() * 3;
                p.color = 'rgba(255, 255, 255, 0.8)';
                break;
            case 'lava':
                p.y = canvas.height + 10;
                p.vx = (Math.random() - 0.5) * 30;
                p.vy = -(40 + Math.random() * 60);
                p.size = 1 + Math.random() * 2;
                p.color = Math.random() < 0.5 ? '#ff4000' : '#ff8000';
                p.life = 1 + Math.random() * 1.5;
                break;
            case 'leaves':
                p.vx = -40 - Math.random() * 60;
                p.vy = 20 + Math.random() * 30;
                p.size = 3 + Math.random() * 2;
                p.color = Math.random() < 0.5 ? '#408000' : '#a0a000';
                p.x = canvas.width + 20;
                p.y = Math.random() * canvas.height;
                break;
        }
        this.particles.push(p);
    }

    render(ctx) {
        if (!this.active) return;

        ctx.save();
        this.particles.forEach(p => {
            ctx.globalAlpha = Math.min(1, p.life);
            ctx.fillStyle = p.color;
            if (this.type === 'leaves') {
                ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.restore();
    }
}

if (typeof window !== 'undefined') {
    window.WeatherManager = WeatherManager;
}
