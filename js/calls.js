/* Antika - HD Voice & Video Call Engine */
class AntikaCallEngine {
  constructor() {
    this.callModal = document.getElementById('call-modal');
    this.callStatusLabel = document.getElementById('call-status-label');
    this.callPartnerName = document.getElementById('call-partner-display-name');
    this.remoteVideo = document.getElementById('remote-video-el');
    this.localVideo = document.getElementById('local-video-el');

    this.localStream = null;
    this.isMicMuted = false;
    this.isCamOff = false;
    this.callTimer = null;
    this.callSeconds = 0;
  }

  async startCall(type) {
    if (!this.callModal) return;

    // Update partner name in call overlay
    const partnerName = document.getElementById('active-partner-name');
    if (partnerName && this.callPartnerName) {
      this.callPartnerName.textContent = partnerName.textContent;
    }

    this.callModal.classList.add('active');
    if (this.callStatusLabel) this.callStatusLabel.textContent = 'جاري الاتصال...';

    if (type === 'video') {
      this.callModal.classList.add('video-mode');
    } else {
      this.callModal.classList.remove('video-mode');
    }

    try {
      const constraints = type === 'video'
        ? { audio: true, video: { facingMode: 'user' } }
        : { audio: true, video: false };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (type === 'video' && this.localVideo) {
        this.localVideo.srcObject = this.localStream;
      }

      // Simulate connecting after 1.5 seconds
      setTimeout(() => {
        if (this.callStatusLabel) {
          this.callSeconds = 0;
          this.callStatusLabel.textContent = '00:00';
          clearInterval(this.callTimer);
          this.callTimer = setInterval(() => {
            this.callSeconds++;
            const m = String(Math.floor(this.callSeconds / 60)).padStart(2, '0');
            const s = String(this.callSeconds % 60).padStart(2, '0');
            if (this.callStatusLabel) this.callStatusLabel.textContent = `${m}:${s}`;
          }, 1000);
        }
      }, 1500);

    } catch (err) {
      // Show call screen even without device access (no microphone/camera)
      if (this.callStatusLabel) this.callStatusLabel.textContent = 'لا يمكن الوصول للكاميرا / الميكروفون';
    }
  }

  endCall() {
    clearInterval(this.callTimer);
    this.callTimer = null;
    this.callSeconds = 0;

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.localVideo) this.localVideo.srcObject = null;
    if (this.remoteVideo) this.remoteVideo.srcObject = null;

    if (this.callModal) {
      this.callModal.classList.remove('active');
      this.callModal.classList.remove('video-mode');
    }

    this.isMicMuted = false;
    this.isCamOff = false;
  }

  toggleMic(btn) {
    this.isMicMuted = !this.isMicMuted;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => { t.enabled = !this.isMicMuted; });
    }

    if (btn) {
      btn.innerHTML = this.isMicMuted
        ? '<i class="fa-solid fa-microphone-slash"></i>'
        : '<i class="fa-solid fa-microphone"></i>';
      btn.style.background = this.isMicMuted ? 'rgba(255,71,126,0.3)' : '';
    }
  }

  toggleCamera(btn) {
    this.isCamOff = !this.isCamOff;

    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => { t.enabled = !this.isCamOff; });
    }

    if (btn) {
      btn.innerHTML = this.isCamOff
        ? '<i class="fa-solid fa-video-slash"></i>'
        : '<i class="fa-solid fa-video"></i>';
      btn.style.background = this.isCamOff ? 'rgba(255,71,126,0.3)' : '';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.antikaCallEngine = new AntikaCallEngine();
});
