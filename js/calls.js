/* Antika - Live WebRTC HD Voice & Video Call Engine v3.0
   - Real-time signaling via Firebase Realtime Engine
   - Automatic Ringtone audio synthesis via Web Audio API
   - Real P2P audio & video streams using Google STUN servers
*/
class AntikaCallEngine {
  constructor() {
    this.callModal = document.getElementById('call-modal');
    this.incomingModal = document.getElementById('incoming-call-modal');
    this.callStatusLabel = document.getElementById('call-status-label');
    this.callPartnerName = document.getElementById('call-partner-display-name');
    this.remoteVideo = document.getElementById('remote-video-el');
    this.localVideo = document.getElementById('local-video-el');

    this.peerConnection = null;
    this.localStream = null;
    this.callTimer = null;
    this.callSeconds = 0;
    this.currentCallType = 'voice'; // 'voice' | 'video'
    this.partnerChannel = null;
    this.isInitiator = false;

    this.isMicMuted = false;
    this.isCamOff = false;

    // Web Audio Ringtone
    this.ringtoneContext = null;
    this.ringtoneInterval = null;

    // ICE servers
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    this._initSignalListener();
  }

  /* ── Signal Listener from Firebase ─────────────────────── */
  _initSignalListener() {
    const setupListener = () => {
      if (!window.antikaRealtime) {
        setTimeout(setupListener, 300);
        return;
      }
      window.antikaRealtime.onCallSignal((signal) => {
        this._handleIncomingSignal(signal);
      });
    };
    setupListener();
  }

  async _handleIncomingSignal(signal) {
    if (!signal || !signal.type) return;

    if (signal.type === 'call_invite') {
      // Someone is calling us!
      this.partnerChannel = signal.senderChannel;
      this.currentCallType = signal.callType || 'voice';
      this._showIncomingCallModal(signal);
    } else if (signal.type === 'call_accepted') {
      // Partner accepted our call!
      this._stopRingtone();
      if (this.callStatusLabel) this.callStatusLabel.textContent = 'متصل';
      if (signal.sdp && this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      }
      this._startCallTimer();
    } else if (signal.type === 'ice_candidate') {
      if (this.peerConnection && signal.candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    } else if (signal.type === 'call_ended' || signal.type === 'call_rejected') {
      this._endCallLocal();
    }
  }

  /* ── Ringtone Generator ────────────────────────────────── */
  _playRingtone(isOutgoing = false) {
    this._stopRingtone();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ringtoneContext = new AudioCtx();

      const playBeep = () => {
        if (!this.ringtoneContext || this.ringtoneContext.state === 'closed') return;
        const osc = this.ringtoneContext.createOscillator();
        const gain = this.ringtoneContext.createGain();
        osc.connect(gain);
        gain.connect(this.ringtoneContext.destination);

        const freq = isOutgoing ? 440 : 800;
        osc.frequency.setValueAtTime(freq, this.ringtoneContext.currentTime);
        gain.gain.setValueAtTime(0.15, this.ringtoneContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ringtoneContext.currentTime + 0.8);

        osc.start();
        osc.stop(this.ringtoneContext.currentTime + 0.8);
      };

      playBeep();
      this.ringtoneInterval = setInterval(playBeep, isOutgoing ? 2500 : 1800);
      if (!isOutgoing && navigator.vibrate) {
        navigator.vibrate([300, 200, 300, 200, 300]);
      }
    } catch (e) {
      console.log('Ringtone note:', e);
    }
  }

  _stopRingtone() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (this.ringtoneContext) {
      try { this.ringtoneContext.close(); } catch (e) {}
      this.ringtoneContext = null;
    }
  }

  /* ── Start Outgoing Call ───────────────────────────────── */
  async startCall(type = 'voice') {
    const partnerCode = window.antikaChatEngine?.partnerChannelId;
    if (!partnerCode) {
      alert('يرجى اختيار شريك والتأكد من الاقتران أولاً.');
      return;
    }

    this.currentCallType = type;
    this.partnerChannel = partnerCode;
    this.isInitiator = true;

    const partnerName = document.getElementById('active-partner-name')?.textContent || 'الشريك ❤️';
    if (this.callPartnerName) this.callPartnerName.textContent = partnerName;

    // Show call overlay
    this.callModal.classList.add('active');
    if (type === 'video') this.callModal.classList.add('video-mode');
    else this.callModal.classList.remove('video-mode');

    if (this.callStatusLabel) this.callStatusLabel.textContent = 'جاري الاتصال... 📞';

    this._playRingtone(true);

    try {
      // Get Media
      const constraints = {
        audio: true,
        video: type === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false
      };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (type === 'video' && this.localVideo) {
        this.localVideo.srcObject = this.localStream;
      }

      // Create Peer Connection
      this._createPeerConnection();

      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Create Offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send Call Invite signal to Partner via Firebase
      const myProfile = window.antikaAppController?.myProfile || {};
      window.antikaRealtime?.sendCallSignal(this.partnerChannel, {
        type: 'call_invite',
        callType: type,
        callerName: myProfile.name || 'الشريك ❤️',
        callerAvatar: myProfile.photo || null,
        sdp: offer
      });

    } catch (err) {
      console.warn('Call start failed:', err);
      if (this.callStatusLabel) this.callStatusLabel.textContent = 'تعذر الوصول للميكروفون أو الكاميرا';
    }
  }

  /* ── Incoming Call UI & Actions ────────────────────────── */
  _showIncomingCallModal(signal) {
    this._playRingtone(false);

    const modal = document.getElementById('incoming-call-modal');
    const nameEl = document.getElementById('incoming-caller-name');
    const typeEl = document.getElementById('incoming-call-type-label');
    const avatarEl = document.getElementById('incoming-caller-avatar');

    if (nameEl) nameEl.textContent = signal.callerName || 'الشريك ❤️';
    if (typeEl) typeEl.textContent = signal.callType === 'video' ? 'مكالمة فيديو واردة... 📹' : 'مكالمة صوتية واردة... 📞';
    if (avatarEl && signal.callerAvatar) avatarEl.src = signal.callerAvatar;

    if (modal) modal.classList.add('active');
    this.pendingOfferSignal = signal;
  }

  async acceptIncomingCall() {
    this._stopRingtone();
    const modal = document.getElementById('incoming-call-modal');
    if (modal) modal.classList.remove('active');

    const signal = this.pendingOfferSignal;
    if (!signal) return;

    this.isInitiator = false;
    this.currentCallType = signal.callType || 'voice';
    this.partnerChannel = signal.senderChannel;

    const partnerName = signal.callerName || 'الشريك ❤️';
    if (this.callPartnerName) this.callPartnerName.textContent = partnerName;

    // Show Active Call Modal
    this.callModal.classList.add('active');
    if (this.currentCallType === 'video') this.callModal.classList.add('video-mode');
    else this.callModal.classList.remove('video-mode');

    if (this.callStatusLabel) this.callStatusLabel.textContent = 'جاري التوصيل...';

    try {
      const constraints = {
        audio: true,
        video: this.currentCallType === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false
      };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.currentCallType === 'video' && this.localVideo) {
        this.localVideo.srcObject = this.localStream;
      }

      this._createPeerConnection();

      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send Answer signal back to caller
      window.antikaRealtime?.sendCallSignal(this.partnerChannel, {
        type: 'call_accepted',
        sdp: answer
      });

      this._startCallTimer();

    } catch (e) {
      console.warn('Accept call error:', e);
      this.endCall();
    }
  }

  rejectIncomingCall() {
    this._stopRingtone();
    const modal = document.getElementById('incoming-call-modal');
    if (modal) modal.classList.remove('active');

    if (this.partnerChannel) {
      window.antikaRealtime?.sendCallSignal(this.partnerChannel, {
        type: 'call_rejected'
      });
    }
    this.pendingOfferSignal = null;
  }

  /* ── Peer Connection Setup ─────────────────────────────── */
  _createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.partnerChannel) {
        window.antikaRealtime?.sendCallSignal(this.partnerChannel, {
          type: 'ice_candidate',
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        if (this.remoteVideo) {
          this.remoteVideo.srcObject = event.streams[0];
          this.remoteVideo.play().catch(() => {});
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection.connectionState === 'disconnected' ||
          this.peerConnection.connectionState === 'failed' ||
          this.peerConnection.connectionState === 'closed') {
        this._endCallLocal();
      }
    };
  }

  /* ── End Call ──────────────────────────────────────────── */
  endCall() {
    if (this.partnerChannel) {
      window.antikaRealtime?.sendCallSignal(this.partnerChannel, {
        type: 'call_ended'
      });
    }
    this._endCallLocal();
  }

  _endCallLocal() {
    this._stopRingtone();
    clearInterval(this.callTimer);
    this.callTimer = null;
    this.callSeconds = 0;

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    if (this.localVideo) this.localVideo.srcObject = null;
    if (this.remoteVideo) this.remoteVideo.srcObject = null;

    if (this.callModal) {
      this.callModal.classList.remove('active', 'video-mode');
    }
    const incoming = document.getElementById('incoming-call-modal');
    if (incoming) incoming.classList.remove('active');

    this.isMicMuted = false;
    this.isCamOff = false;
  }

  _startCallTimer() {
    this.callSeconds = 0;
    if (this.callStatusLabel) this.callStatusLabel.textContent = '00:00';
    clearInterval(this.callTimer);
    this.callTimer = setInterval(() => {
      this.callSeconds++;
      const m = String(Math.floor(this.callSeconds / 60)).padStart(2, '0');
      const s = String(this.callSeconds % 60).padStart(2, '0');
      if (this.callStatusLabel) this.callStatusLabel.textContent = `${m}:${s}`;
    }, 1000);
  }

  toggleMic(btn) {
    this.isMicMuted = !this.isMicMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => { t.enabled = !this.isMicMuted; });
    }
    if (btn) {
      btn.innerHTML = this.isMicMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
      btn.style.background = this.isMicMuted ? 'rgba(255,71,126,0.35)' : '';
    }
  }

  toggleCamera(btn) {
    this.isCamOff = !this.isCamOff;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => { t.enabled = !this.isCamOff; });
    }
    if (btn) {
      btn.innerHTML = this.isCamOff ? '<i class="fa-solid fa-video-slash"></i>' : '<i class="fa-solid fa-video"></i>';
      btn.style.background = this.isCamOff ? 'rgba(255,71,126,0.35)' : '';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.antikaCallEngine = new AntikaCallEngine();
});
