/**
 * SoundManager.js - 게임 사운드 관리자 (Web Audio API 프로시저럴 사운드)
 * 외부 CDN 없이 코드만으로 다양한 게임 효과음을 즉석 생성·재생
 */

class SoundManager {
    constructor() {
        this.isMuted = false;
        this.masterVolume = 0.5;
        this.audioCtx = null; // AudioContext (사용자 상호작용 후 생성)
        this.initialized = false;

        // 기존 CDN 사운드 (폴백용으로 유지)
        this.sounds = {};
        this.soundBank = {
            'attack': 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
            'hit': 'https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3',
            'skill': 'https://assets.mixkit.co/active_storage/sfx/2205/2205-preview.mp3',
            'levelup': 'https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3',
            'item': 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
            'death': 'https://assets.mixkit.co/active_storage/sfx/2536/2536-preview.mp3',
            'click': 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
        };

        console.log('[SoundManager] 프로시저럴 사운드 엔진 준비');
    }

    /**
     * 초기화 (사용자 상호작용 후 호출 — 브라우저 오토플레이 정책)
     */
    init() {
        if (this.initialized) return;

        // Web Audio API 컨텍스트 생성
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[SoundManager] AudioContext 생성 완료');
        } catch (e) {
            console.warn('[SoundManager] AudioContext 생성 실패, CDN 폴백 사용:', e);
        }

        // CDN 사운드 미리 로드 (폴백)
        for (const [name, url] of Object.entries(this.soundBank)) {
            const audio = new Audio(url);
            audio.preload = 'auto';
            this.sounds[name] = audio;
        }

        this.initialized = true;
        console.log('[SoundManager] 초기화 완료 (프로시저럴 + CDN 폴백)');
    }

    // ============================================================
    // 공통 재생 인터페이스
    // ============================================================

    /**
     * 사운드 재생 (프로시저럴 우선, CDN 폴백)
     * @param {string} name - 사운드 이름
     * @param {number} volumeMultiplier - 개별 볼륨 배율
     */
    play(name, volumeMultiplier = 1.0) {
        if (this.isMuted) return;
        if (!this.initialized) return;

        const vol = this.masterVolume * volumeMultiplier;

        // ① 프로시저럴 사운드 시도
        if (this.audioCtx && this._playProcedural(name, vol)) {
            return; // 성공
        }

        // ② CDN 폴백
        this._playCDN(name, vol);
    }

    /** CDN 오디오 재생 (기존 로직) */
    _playCDN(name, vol) {
        const sound = this.sounds[name];
        if (sound) {
            const s = sound.cloneNode();
            s.volume = vol;
            s.play().catch(() => {});
        } else if (this.soundBank[name]) {
            const s = new Audio(this.soundBank[name]);
            s.volume = vol;
            s.play().catch(() => {});
        }
    }

    setMute(mute) { this.isMuted = mute; }
    setVolume(vol) { this.masterVolume = Math.max(0, Math.min(1, vol)); }

    // ============================================================
    // Web Audio API 유틸리티
    // ============================================================

    /** 마스터 게인 노드 생성 */
    _gain(vol) {
        const g = this.audioCtx.createGain();
        g.gain.value = vol;
        g.connect(this.audioCtx.destination);
        return g;
    }

    /** 오실레이터 생성 헬퍼 */
    _osc(type, freq, gain, startTime, endTime) {
        const ctx = this.audioCtx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = gain;
        o.connect(g);
        g.connect(ctx.destination);
        o.start(startTime);
        o.stop(endTime);
        return { osc: o, gain: g };
    }

    /** 노이즈 버퍼 생성 (화이트 노이즈) */
    _noiseBuffer(duration) {
        const ctx = this.audioCtx;
        const sr = ctx.sampleRate;
        const len = sr * duration;
        const buf = ctx.createBuffer(1, len, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buf;
    }

    /** 엔벨로프 곡선 적용 (ADSR 간략화) */
    _envelope(gainNode, vol, attack, sustain, release, startTime) {
        const g = gainNode.gain;
        g.setValueAtTime(0, startTime);
        g.linearRampToValueAtTime(vol, startTime + attack);
        g.setValueAtTime(vol, startTime + attack + sustain);
        g.linearRampToValueAtTime(0, startTime + attack + sustain + release);
    }

    // ============================================================
    // 프로시저럴 사운드 라이브러리 (20종+)
    // ============================================================

    /**
     * 프로시저럴 사운드 재생 (이름 기반 디스패치)
     * @returns {boolean} 재생 성공 여부
     */
    _playProcedural(name, vol) {
        const fn = this._proceduralMap[name];
        if (fn) {
            try { fn.call(this, vol); return true; }
            catch (e) { console.warn('[SoundManager] 프로시저럴 재생 실패:', name, e); }
        }
        return false;
    }

    /** 프로시저럴 사운드 이름 → 함수 매핑 테이블 */
    get _proceduralMap() {
        return {
            // --- 평타 ---
            'attack':       this._snd_slashHeavy,
            'slash_heavy':  this._snd_slashHeavy,
            'slash_fast':   this._snd_slashFast,
            'magic_cast':   this._snd_magicCast,

            // --- 피격/타격 ---
            'hit':          this._snd_hit,
            'monster_hit':  this._snd_monsterHit,
            'monster_attack': this._snd_monsterAttack,
            'monster_die':  this._snd_monsterDie,
            'critical':     this._snd_critical,
            'player_hurt':  this._snd_playerHurt,

            // --- 스킬 ---
            'skill':        this._snd_skillGeneric,
            'skill_heal':   this._snd_skillHeal,
            'skill_buff':   this._snd_skillBuff,
            'skill_fire':   this._snd_skillFire,
            'skill_ice':    this._snd_skillIce,
            'skill_thunder': this._snd_skillThunder,
            'skill_aoe':    this._snd_skillAoe,
            'skill_debuff': this._snd_skillDebuff,

            // --- UI ---
            'levelup':      this._snd_levelUp,
            'item':         this._snd_itemPickup,
            'death':        this._snd_death,
            'click':        this._snd_click,
            'portal_enter': this._snd_portalEnter,
            'equip':        this._snd_equip,
            'coin':         this._snd_coin,
            'exp_gain':     this._snd_expGain,
        };
    }

    // ---------- 평타 사운드 ----------

    /** 전사 강타 — 무거운 금속 충격 */
    _snd_slashHeavy(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        // 노이즈 버스트 (충격감)
        const nBuf = this._noiseBuffer(0.12);
        const ns = ctx.createBufferSource();
        ns.buffer = nBuf;
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(vol * 0.5, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        // 로우패스 필터 (무겁게)
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 800;
        ns.connect(lp); lp.connect(nGain); nGain.connect(ctx.destination);
        ns.start(t); ns.stop(t + 0.12);

        // 저음 톤 (찰칵)
        const { gain: g1 } = this._osc('sawtooth', 120, vol * 0.3, t, t + 0.08);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    }

    /** 도적 빠른 참격 — 날카로운 스윙 */
    _snd_slashFast(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        // 고주파 스윙 (슉!)
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(1200, t);
        o.frequency.exponentialRampToValueAtTime(200, t + 0.06);
        g.gain.setValueAtTime(vol * 0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.06);

        // 짧은 노이즈
        const nBuf = this._noiseBuffer(0.04);
        const ns = ctx.createBufferSource(); ns.buffer = nBuf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vol * 0.15, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 2000;
        ns.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
        ns.start(t); ns.stop(t + 0.04);
    }

    /** 마법 발사 — 충전 + 발사 */
    _snd_magicCast(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        // 상승 사인파 (충전)
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(300, t);
        o.frequency.exponentialRampToValueAtTime(800, t + 0.15);
        g.gain.setValueAtTime(vol * 0.2, t);
        g.gain.linearRampToValueAtTime(vol * 0.35, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.25);

        // 하이 하모닉
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.type = 'triangle';
        o2.frequency.setValueAtTime(600, t);
        o2.frequency.exponentialRampToValueAtTime(1600, t + 0.15);
        g2.gain.setValueAtTime(vol * 0.1, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o2.connect(g2); g2.connect(ctx.destination);
        o2.start(t); o2.stop(t + 0.2);
    }

    // ---------- 피격/타격 ----------

    /** 기본 타격음 */
    _snd_hit(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const nBuf = this._noiseBuffer(0.08);
        const ns = ctx.createBufferSource(); ns.buffer = nBuf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol * 0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = 1;
        ns.connect(bp); bp.connect(g); g.connect(ctx.destination);
        ns.start(t); ns.stop(t + 0.08);
    }

    /** 몬스터 피격 (둔탁) */
    _snd_monsterHit(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const { gain: g } = this._osc('square', 180, vol * 0.3, t, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        const nBuf = this._noiseBuffer(0.05);
        const ns = ctx.createBufferSource(); ns.buffer = nBuf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vol * 0.2, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        ns.connect(ng); ng.connect(ctx.destination);
        ns.start(t); ns.stop(t + 0.05);
    }

    /** 몬스터 공격 (으르렁) */
    _snd_monsterAttack(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(100, t);
        o.frequency.linearRampToValueAtTime(60, t + 0.15);
        g.gain.setValueAtTime(vol * 0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 400;
        o.connect(lp); lp.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.2);
    }

    /** 몬스터 사망 (하강음 + 파열) */
    _snd_monsterDie(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        // 하강 톤
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(400, t);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.3);
        g.gain.setValueAtTime(vol * 0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.3);

        // 파열 노이즈
        const nBuf = this._noiseBuffer(0.15);
        const ns = ctx.createBufferSource(); ns.buffer = nBuf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vol * 0.2, t + 0.05);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        ns.connect(ng); ng.connect(ctx.destination);
        ns.start(t + 0.05); ns.stop(t + 0.2);
    }

    /** 크리티컬 히트 (강한 임팩트) */
    _snd_critical(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        // 저음 임팩트
        const { gain: g1 } = this._osc('sine', 80, vol * 0.4, t, t + 0.15);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        // 고음 임팩트
        const { gain: g2 } = this._osc('sawtooth', 600, vol * 0.2, t, t + 0.08);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        // 노이즈 크래시
        const nBuf = this._noiseBuffer(0.1);
        const ns = ctx.createBufferSource(); ns.buffer = nBuf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vol * 0.3, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        ns.connect(ng); ng.connect(ctx.destination);
        ns.start(t); ns.stop(t + 0.1);
    }

    /** 플레이어 피격 */
    _snd_playerHurt(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(500, t);
        o.frequency.exponentialRampToValueAtTime(200, t + 0.12);
        g.gain.setValueAtTime(vol * 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.12);
    }

    // ---------- 스킬 사운드 ----------

    /** 일반 스킬 (기본 마법음) */
    _snd_skillGeneric(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const freqs = [440, 554, 659];
        freqs.forEach((f, i) => {
            const { gain: g } = this._osc('sine', f, vol * 0.15, t + i * 0.04, t + 0.25);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        });
    }

    /** 힐 (맑은 상승 종소리) */
    _snd_skillHeal(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const notes = [523, 659, 784, 1047]; // C5-E5-G5-C6
        notes.forEach((f, i) => {
            const delay = i * 0.06;
            const { gain: g } = this._osc('sine', f, vol * 0.18, t + delay, t + delay + 0.3);
            g.gain.setValueAtTime(vol * 0.18, t + delay);
            g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.3);
        });
    }

    /** 버프 (상승 화음) */
    _snd_skillBuff(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const notes = [262, 330, 392, 523]; // C4-E4-G4-C5
        notes.forEach((f, i) => {
            const delay = i * 0.08;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'triangle';
            o.frequency.value = f;
            g.gain.setValueAtTime(vol * 0.15, t + delay);
            g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.35);
            o.connect(g); g.connect(ctx.destination);
            o.start(t + delay); o.stop(t + delay + 0.35);
        });
    }

    /** 화염 마법 (불 크래클 + 우웅) */
    _snd_skillFire(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        // 저음 우웅
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(100, t);
        o.frequency.linearRampToValueAtTime(200, t + 0.2);
        g.gain.setValueAtTime(vol * 0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 600;
        o.connect(lp); lp.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.35);

        // 크래클 노이즈
        const nBuf = this._noiseBuffer(0.3);
        const ns = ctx.createBufferSource(); ns.buffer = nBuf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vol * 0.15, t + 0.05);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 2;
        ns.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
        ns.start(t + 0.05); ns.stop(t + 0.3);
    }

    /** 빙결 마법 (유리 깨지는 느낌) */
    _snd_skillIce(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        // 고음 글래스 톤
        const notes = [2000, 2500, 3000];
        notes.forEach((f, i) => {
            const delay = i * 0.03;
            const { gain: g } = this._osc('sine', f, vol * 0.12, t + delay, t + delay + 0.15);
            g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.15);
        });

        // 크리스탈 노이즈
        const nBuf = this._noiseBuffer(0.1);
        const ns = ctx.createBufferSource(); ns.buffer = nBuf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vol * 0.15, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 4000;
        ns.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
        ns.start(t); ns.stop(t + 0.1);
    }

    /** 번개 마법 (찌직 전기음) */
    _snd_skillThunder(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        // 빠른 주파수 변동 (전기 스파크)
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(80, t);
        // 빠른 랜덤 피치 변동 시뮬레이션
        for (let i = 0; i < 8; i++) {
            const time = t + i * 0.02;
            o.frequency.setValueAtTime(60 + Math.random() * 2000, time);
        }
        g.gain.setValueAtTime(vol * 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.2);

        // 크래시 노이즈
        const nBuf = this._noiseBuffer(0.15);
        const ns = ctx.createBufferSource(); ns.buffer = nBuf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vol * 0.25, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        ns.connect(ng); ng.connect(ctx.destination);
        ns.start(t); ns.stop(t + 0.15);
    }

    /** 광역 폭발 (깊은 쿵 + 파열) */
    _snd_skillAoe(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        // 초저음 임팩트
        const { gain: g1 } = this._osc('sine', 50, vol * 0.4, t, t + 0.3);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        // 중음 파열
        const { gain: g2 } = this._osc('sawtooth', 200, vol * 0.2, t, t + 0.15);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        // 대형 노이즈 버스트
        const nBuf = this._noiseBuffer(0.25);
        const ns = ctx.createBufferSource(); ns.buffer = nBuf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vol * 0.3, t + 0.02);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1500;
        ns.connect(lp); lp.connect(ng); ng.connect(ctx.destination);
        ns.start(t + 0.02); ns.stop(t + 0.25);
    }

    /** 저주/디버프 (불길한 하강음) */
    _snd_skillDebuff(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const notes = [400, 350, 280, 200]; // 하강 불협화음
        notes.forEach((f, i) => {
            const delay = i * 0.07;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sawtooth';
            o.frequency.value = f;
            g.gain.setValueAtTime(vol * 0.12, t + delay);
            g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.2);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 800;
            o.connect(lp); lp.connect(g); g.connect(ctx.destination);
            o.start(t + delay); o.stop(t + delay + 0.2);
        });
    }

    // ---------- UI 사운드 ----------

    /** 레벨업 (팡파레) */
    _snd_levelUp(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const notes = [523, 659, 784, 1047, 1319]; // C5→E6 상승
        notes.forEach((f, i) => {
            const delay = i * 0.1;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.value = f;
            g.gain.setValueAtTime(vol * 0.2, t + delay);
            g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.4);
            o.connect(g); g.connect(ctx.destination);
            o.start(t + delay); o.stop(t + delay + 0.4);
        });
    }

    /** 아이템 획득 (짧은 띵) */
    _snd_itemPickup(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const { gain: g } = this._osc('sine', 880, vol * 0.2, t, t + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        const { gain: g2 } = this._osc('sine', 1320, vol * 0.12, t + 0.05, t + 0.18);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    }

    /** 사망 (하강 불협화음) */
    _snd_death(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(300, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.6);
        g.gain.setValueAtTime(vol * 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.6);
    }

    /** 클릭 (짧은 틱) */
    _snd_click(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const { gain: g } = this._osc('sine', 1000, vol * 0.15, t, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    }

    /** 포탈 진입 (신비로운 슈웅) */
    _snd_portalEnter(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        // 상승 스윕
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(200, t);
        o.frequency.exponentialRampToValueAtTime(1200, t + 0.4);
        g.gain.setValueAtTime(vol * 0.2, t);
        g.gain.linearRampToValueAtTime(vol * 0.3, t + 0.2);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.5);

        // 하이 하모닉
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.type = 'triangle';
        o2.frequency.setValueAtTime(400, t);
        o2.frequency.exponentialRampToValueAtTime(2400, t + 0.4);
        g2.gain.setValueAtTime(vol * 0.08, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        o2.connect(g2); g2.connect(ctx.destination);
        o2.start(t); o2.stop(t + 0.45);
    }

    /** 장비 착용 (금속 딸그락) */
    _snd_equip(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const { gain: g1 } = this._osc('triangle', 800, vol * 0.2, t, t + 0.05);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        const { gain: g2 } = this._osc('triangle', 1200, vol * 0.15, t + 0.03, t + 0.08);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    }

    /** 골드 획득 (코인 딸랑) */
    _snd_coin(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const { gain: g1 } = this._osc('sine', 1500, vol * 0.15, t, t + 0.08);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        const { gain: g2 } = this._osc('sine', 2000, vol * 0.1, t + 0.04, t + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    }

    /** 경험치 획득 (가벼운 띵) */
    _snd_expGain(vol) {
        const ctx = this.audioCtx, t = ctx.currentTime;
        const { gain: g } = this._osc('sine', 660, vol * 0.1, t, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    }
}

// 전역 싱글톤
const soundManager = new SoundManager();
