/**
 * SoundManager.js - 게임 사운드 관리자
 * 오디오 재생, 볼륨 조절, 사운드 뱅크 관리
 */

class SoundManager {
    constructor() {
        this.sounds = {};
        this.isMuted = false;
        this.masterVolume = 0.5;
        
        // 사운드 뱅크 (파일명 또는 CDN URL)
        this.soundBank = {
            'attack': 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3', // 스윙
            'hit': 'https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3',    // 타격
            'skill': 'https://assets.mixkit.co/active_storage/sfx/2205/2205-preview.mp3',  // 마법
            'levelup': 'https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3', // 레벨업
            'item': 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',    // 아이템 획득
            'death': 'https://assets.mixkit.co/active_storage/sfx/2536/2536-preview.mp3',   // 사망
            'click': 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',   // 클릭
        };

        this.initialized = false;
    }

    /**
     * 초기화 (사용자 상호작용 후 호출 필요 - 브라우저 정책)
     */
    init() {
        if (this.initialized) return;
        
        console.log('[SoundManager] 초기화 중...');
        // 사운드 미리 로드
        for (const [name, url] of Object.entries(this.soundBank)) {
            const audio = new Audio(url);
            audio.preload = 'auto';
            this.sounds[name] = audio;
        }
        
        this.initialized = true;
        console.log('[SoundManager] 초기화 완료');
    }

    /**
     * 사운드 재생
     * @param {string} name - 사운드 이름
     * @param {number} volumeMultiplier - 개별 볼륨 배율
     */
    play(name, volumeMultiplier = 1.0) {
        if (this.isMuted) return;
        
        const sound = this.sounds[name];
        if (sound) {
            // 여러 번 겹쳐 날 수 있도록 새 Audio 객체 생성 또는 currentTime 리셋
            const s = sound.cloneNode();
            s.volume = this.masterVolume * volumeMultiplier;
            s.play().catch(e => console.warn('[SoundManager] 재생 실패:', e));
        } else if (this.soundBank[name]) {
            // 로드 안 된 경우 즉시 생성 후 재생
            const s = new Audio(this.soundBank[name]);
            s.volume = this.masterVolume * volumeMultiplier;
            s.play().catch(e => console.warn('[SoundManager] 재생 실패:', e));
        }
    }

    setMute(mute) {
        this.isMuted = mute;
    }

    setVolume(vol) {
        this.masterVolume = Math.max(0, Math.min(1, vol));
    }
}

// 전역 싱글톤
const soundManager = new SoundManager();
