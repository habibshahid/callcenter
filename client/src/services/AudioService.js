// src/services/AudioService.js
class AudioService {
  constructor() {
    this.ringTone = new Audio('/assets/audio/ring.mp3');
    this.ringTone.loop = true;
    this.isPlaying = false;
  }

  init() {
    return new Promise((resolve, reject) => {
      this.ringTone.addEventListener('loadeddata', () => {
        console.log('Ring tone loaded successfully');
        resolve();
      });

      this.ringTone.addEventListener('error', (error) => {
        console.error('Error loading ring tone:', error);
        reject(error);
      });
    });
  }

  async playRing() {
    try {
      if (!this.isPlaying) {
        await this.ringTone.play();
        this.isPlaying = true;
      }
    } catch (error) {
      console.error('Error playing ring tone:', error);
    }
  }

  stopRing() {
    this.ringTone.pause();
    this.ringTone.currentTime = 0;
    this.isPlaying = false;
  }
}

export default new AudioService();