/* Antika - HD Voice & Video Call Engine */
class AntikaCallEngine {
  constructor() {
    this.callModal = document.getElementById('call-modal');
    this.statusLabel = document.getElementById('call-status-label');
    this.localVideo = document.getElementById('local-video-el');
    this.remoteVideo = document.getElementById('remote-video-el');
    this.avatarWrap = document.getElementById('call-avatar-wrap');
    
    this.toggleMicBtn = document.getElementById('toggle-mic-btn');
    this.toggleCamBtn = document.getElementById('toggle-cam-btn');
    this.endCallBtn = document.getElementById('end-call-btn');

    this.localStream = null;
    this.callTimer = null;
    this.secondsElapsed = 0;
    this.isMuted = false;
    this.isVideoOff = false;

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('start-voice-call-btn').addEventListener('click', () => this.startCall(false));
    document.getElementById('start-video-call-btn').addEventListener('click', () => this.startCall(true));
    
    this.endCallBtn.addEventListener('click', () => this.endCall());
    this.toggleMicBtn.addEventListener('click', () => this.toggleMic());
    this.toggleCamBtn.addEventListener('click', () => this.toggleCam());
  }

  async startCall(isVideo = false) {
    this.callModal.classList.add('active');
    if (isVideo) {
      this.callModal.classList.add('video-mode');
      this.statusLabel.textContent = 'جاري الاتصال بالفيديو عالية الجودة HD...';
    } else {
      this.callModal.classList.remove('video-mode');
      this.statusLabel.textContent = 'جاري اتصال صلب عالي الجودة HD...';
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: 1280, height: 720 } : false
      });

      if (isVideo && this.localVideo) {
        this.localVideo.srcObject = this.localStream;
      }
    } catch (err) {
      console.log('Media access note (using HD simulated stream):', err);
    }

    // Connect call after 2 seconds simulation
    setTimeout(() => {
      this.statusLabel.textContent = 'متصل (عالي الجودة HD) • 00:00';
      this.startCallTimer();

      // Trigger disguised notification on call connected
      if (window.notificationManager) {
        window.notificationManager.sendDisguisedNotification();
      }
    }, 2000);
  }

  startCallTimer() {
    this.secondsElapsed = 0;
    clearInterval(this.callTimer);
    this.callTimer = setInterval(() => {
      this.secondsElapsed++;
      const mins = String(Math.floor(this.secondsElapsed / 60)).padStart(2, '0');
      const secs = String(this.secondsElapsed % 60).padStart(2, '0');
      this.statusLabel.textContent = `متصل (عالي الجودة HD) • ${mins}:${secs}`;
    }, 1000);
  }

  toggleMic() {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => t.enabled = !this.isMuted);
    }
    this.toggleMicBtn.style.background = this.isMuted ? 'var(--accent-rose)' : 'rgba(255,255,255,0.12)';
    this.toggleMicBtn.innerHTML = this.isMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
  }

  toggleCam() {
    this.isVideoOff = !this.isVideoOff;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => t.enabled = !this.isVideoOff);
    }
    this.toggleCamBtn.style.background = this.isVideoOff ? 'var(--accent-rose)' : 'rgba(255,255,255,0.12)';
    this.toggleCamBtn.innerHTML = this.isVideoOff ? '<i class="fa-solid fa-video-slash"></i>' : '<i class="fa-solid fa-video"></i>';
  }

  endCall() {
    clearInterval(this.callTimer);
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.statusLabel.textContent = 'تم إنهاء المكالمة';
    setTimeout(() => {
      this.callModal.classList.remove('active', 'video-mode');
    }, 800);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.antikaCallEngine = new AntikaCallEngine();
});
