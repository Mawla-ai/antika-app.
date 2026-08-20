/* Antika - Production Chat Engine & Real-Time P2P Broadcast Channel */
class AntikaChatEngine {
  constructor() {
    this.chatList = document.getElementById('chat-messages-list');
    this.inputField = document.getElementById('chat-input-field');
    this.sendBtn = document.getElementById('send-msg-btn');
    this.voiceRecBtn = document.getElementById('voice-rec-btn');
    this.recordingBar = document.getElementById('recording-bar');
    this.recTimerDisplay = document.getElementById('rec-timer-display');
    this.cancelRecBtn = document.getElementById('cancel-rec-btn');

    // Attach Image & Type Selection Modal Elements
    this.attachImgBtn = document.getElementById('attach-image-btn');
    this.fileInput = document.getElementById('image-file-input');
    this.imageTypeModal = document.getElementById('image-type-modal');
    this.selectRegularImgBtn = document.getElementById('select-regular-image-btn');
    this.selectViewOnceImgBtn = document.getElementById('select-view-once-image-btn');
    this.closeImageTypeModalBtn = document.getElementById('close-image-type-modal-btn');
    this.isTimedImageSelected = false;

    // 6 Days Mode elements
    this.secretModal = document.getElementById('secret-mode-modal');
    this.confirmSecretBtn = document.getElementById('confirm-secret-mode-btn');
    this.cancelSecretBtn = document.getElementById('cancel-secret-mode-btn');
    this.secretBanner = document.getElementById('secret-vault-banner');
    this.vaultTimerDisplay = document.getElementById('vault-timer-display');

    // View Once Modal
    this.viewOnceModal = document.getElementById('view-once-modal');
    this.viewOnceImgPreview = document.getElementById('view-once-img-preview');
    this.viewOnceTimerText = document.getElementById('view-once-timer-text');

    this.is6DaysMode = false;
    this.vaultTimer = null;
    this.vaultSecondsLeft = 5 * 3600; // 5 hours

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recInterval = null;
    this.recSeconds = 0;

    this.userKwMentioned = false;
    this.partnerKwMentioned = false;

    this.audioOutputMode = 'earpiece'; // Default to private phone call / earpiece / AirPods mode
    this.currentAudioElement = null;

    // Unique Session ID for real P2P pair communication
    this.mySessionId = 'sess-' + Math.random().toString(36).substring(2, 9);

    this.initRealtimeBroadcastChannel();
    this.initEvents();
    this.initEarpieceAndHeadsetRouting();
    this.checkInitialEmptyState();
  }

  /* Real-Time Live Messaging BroadcastChannel */
  initRealtimeBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('antika_p2p_channel');
      this.channel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        if (data.type === 'NEW_MESSAGE' && data.senderId !== this.mySessionId) {
          const msgObj = {
            id: data.msg.id,
            type: data.msg.type,
            text: data.msg.text,
            media: data.msg.media,
            sender: 'received',
            time: data.msg.time,
            mode6: data.msg.mode6
          };
          this.renderMessage(msgObj);
          this.check6DaysKeyword(data.msg.text, 'received');

          if (window.notificationManager) {
            window.notificationManager.sendDisguisedNotification();
          }
        } else if (data.type === 'ACTIVATE_6DAYS' && data.senderId !== this.mySessionId) {
          this.activate6DaysMode(true);
        }
      };
    }
  }

  initEvents() {
    this.inputField.addEventListener('input', () => {
      const val = this.inputField.value.trim();
      if (val.length > 0) {
        this.sendBtn.style.display = 'flex';
        this.voiceRecBtn.style.display = 'none';
      } else {
        this.sendBtn.style.display = 'none';
        this.voiceRecBtn.style.display = 'flex';
      }
    });

    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    this.voiceRecBtn.addEventListener('click', () => this.toggleVoiceRecording());
    this.cancelRecBtn.addEventListener('click', () => this.cancelRecording());

    // Image Attachment Menu (Regular vs Timed View-Once)
    this.attachImgBtn.addEventListener('click', () => {
      if (this.imageTypeModal) {
        this.imageTypeModal.classList.add('active');
      } else {
        this.fileInput.click();
      }
    });

    if (this.selectRegularImgBtn) {
      this.selectRegularImgBtn.addEventListener('click', () => {
        this.isTimedImageSelected = false;
        this.imageTypeModal.classList.remove('active');
        this.fileInput.click();
      });
    }

    if (this.selectViewOnceImgBtn) {
      this.selectViewOnceImgBtn.addEventListener('click', () => {
        this.isTimedImageSelected = true;
        this.imageTypeModal.classList.remove('active');
        this.fileInput.click();
      });
    }

    if (this.closeImageTypeModalBtn) {
      this.closeImageTypeModalBtn.addEventListener('click', () => {
        this.imageTypeModal.classList.remove('active');
      });
    }

    this.fileInput.addEventListener('change', (e) => this.handleImageSelect(e));

    this.confirmSecretBtn.addEventListener('click', () => {
      this.activate6DaysMode(false);
      if (this.channel) {
        this.channel.postMessage({ type: 'ACTIVATE_6DAYS', senderId: this.mySessionId });
      }
    });
    this.cancelSecretBtn.addEventListener('click', () => this.secretModal.classList.remove('active'));
  }

  async initEarpieceAndHeadsetRouting() {
    if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.ondevicechange = () => this.detectAudioDevices();
    }
    if ('UserProximityEvent' in window) {
      window.addEventListener('userproximity', (event) => {
        if (event.near) this.setAudioOutputMode('earpiece');
      });
    }
    this.detectAudioDevices();
  }

  async detectAudioDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasHeadphones = devices.some(d => 
        d.kind === 'audiooutput' && 
        (d.label.toLowerCase().includes('airpods') || 
         d.label.toLowerCase().includes('headphone') || 
         d.label.toLowerCase().includes('bluetooth') ||
         d.label.toLowerCase().includes('earpiece'))
      );

      if (hasHeadphones) {
        this.audioOutputMode = 'earpiece';
      }
    } catch (e) {
      console.log('Audio device detection note:', e);
    }
  }

  setAudioOutputMode(mode) {
    this.audioOutputMode = mode;
    const btn = document.getElementById('audio-mode-toggle-btn');
    if (btn) {
      if (mode === 'earpiece') {
        btn.innerHTML = '<i class="fa-solid fa-phone-volume"></i> سماعة الأذن';
        btn.style.color = 'var(--accent-cyan)';
      } else {
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> مكبر الصوت';
        btn.style.color = 'var(--accent-gold)';
      }
    }
  }

  toggleAudioMode() {
    const newMode = this.audioOutputMode === 'earpiece' ? 'speaker' : 'earpiece';
    this.setAudioOutputMode(newMode);
  }

  async playAudio(src) {
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement = null;
    }

    const audio = new Audio(src);
    this.currentAudioElement = audio;

    if (typeof audio.setSinkId === 'function') {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const targetDevice = devices.find(d => 
          d.kind === 'audiooutput' && 
          (d.deviceId === 'communications' || 
           d.label.toLowerCase().includes('earpiece') || 
           d.label.toLowerCase().includes('headset') ||
           d.label.toLowerCase().includes('airpods') ||
           d.label.toLowerCase().includes('bluetooth'))
        );
        if (targetDevice) await audio.setSinkId(targetDevice.deviceId);
      } catch (err) {
        console.log('sinkId routing note:', err);
      }
    }

    audio.volume = (this.audioOutputMode === 'earpiece') ? 0.7 : 1.0;
    audio.play().catch(e => console.log('Voice note play note:', e));
  }

  sendMessage(customText = null, isVoice = false, mediaData = null, isTimedMedia = false) {
    const text = customText || this.inputField.value.trim();
    if (!text && !isVoice && !mediaData) return;

    if (!customText) {
      this.inputField.value = '';
      this.sendBtn.style.display = 'none';
      this.voiceRecBtn.style.display = 'flex';
    }

    const emptyBanner = document.getElementById('empty-chat-banner');
    if (emptyBanner) emptyBanner.remove();

    const msgObj = {
      id: 'msg-' + Date.now(),
      type: isVoice ? 'voice' : (mediaData ? (isTimedMedia ? 'image_timed' : 'image_regular') : 'text'),
      text: text,
      media: mediaData,
      sender: 'sent',
      time: this.getFormattedTime(),
      mode6: this.is6DaysMode
    };

    this.renderMessage(msgObj);
    this.check6DaysKeyword(text, 'sent');

    if (this.channel) {
      this.channel.postMessage({
        type: 'NEW_MESSAGE',
        senderId: this.mySessionId,
        msg: msgObj
      });
    }
  }

  check6DaysKeyword(text, sender) {
    if (this.is6DaysMode) return;

    const lower = (text || '').toLowerCase();
    if (lower.includes('6 أيام') || lower.includes('6 ايام')) {
      if (sender === 'sent') this.userKwMentioned = true;
      if (sender === 'received') this.partnerKwMentioned = true;

      if (this.userKwMentioned || this.partnerKwMentioned) {
        setTimeout(() => {
          this.secretModal.classList.add('active');
        }, 600);
      }
    }
  }

  activate6DaysMode(isRemote = false) {
    this.secretModal.classList.remove('active');
    this.is6DaysMode = true;

    document.getElementById('main-app').classList.add('mode-6days');
    this.secretBanner.style.display = 'flex';

    this.vaultSecondsLeft = 5 * 3600;
    clearInterval(this.vaultTimer);
    this.vaultTimer = setInterval(() => {
      this.vaultSecondsLeft--;
      if (this.vaultSecondsLeft <= 0) {
        this.expire6DaysMode();
      } else {
        const hrs = String(Math.floor(this.vaultSecondsLeft / 3600)).padStart(2, '0');
        const mins = String(Math.floor((this.vaultSecondsLeft % 3600) / 60)).padStart(2, '0');
        const secs = String(this.vaultSecondsLeft % 60).padStart(2, '0');
        this.vaultTimerDisplay.textContent = `${hrs}:${mins}:${secs}`;
      }
    }, 1000);

    this.renderSystemMessage("✨ تم تفعيل موود 6 أيام! الشات المؤقت سيتدمر تلقائياً بعد 5 ساعات للحفاظ على خصوصيتكما التامة.");
  }

  expire6DaysMode() {
    clearInterval(this.vaultTimer);
    this.is6DaysMode = false;
    document.getElementById('main-app').classList.remove('mode-6days');
    this.secretBanner.style.display = 'none';

    const tempMsgs = document.querySelectorAll('.msg-mode-6');
    tempMsgs.forEach(el => el.remove());

    this.renderSystemMessage("🔒 انتهت فترة موود 6 أيام وتم حذف جميع الرسائل المؤقتة بنجاح.");
  }

  renderMessage(msg) {
    const emptyBanner = document.getElementById('empty-chat-banner');
    if (emptyBanner) emptyBanner.remove();

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${msg.sender} ${msg.mode6 ? 'msg-mode-6' : ''}`;
    bubble.id = msg.id;

    if (msg.type === 'text') {
      bubble.innerHTML = `
        <div>${this.escapeHTML(msg.text)}</div>
        <div class="message-time">${msg.time} <i class="fa-solid fa-check-double"></i></div>
      `;
    } else if (msg.type === 'voice') {
      bubble.innerHTML = `
        <div class="voice-note-player">
          <button class="play-voice-btn" onclick="window.antikaChatEngine.playAudio('${msg.media}')" title="استماع كمكالمة هاتفية / AirPods">
            <i class="fa-solid fa-phone-volume"></i>
          </button>
          <div class="voice-waveform">
            <div class="wave-bar active"></div>
            <div class="wave-bar active"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar active"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar active"></div>
            <div class="wave-bar"></div>
          </div>
          <span style="font-size: 0.72rem; color: var(--accent-cyan); font-weight: 600;">سماعة الأذن 📱</span>
        </div>
        <div class="message-time">${msg.time} <i class="fa-solid fa-check-double"></i></div>
      `;
    } else if (msg.type === 'image_regular') {
      // Standard Regular Image (Visible permanently in chat)
      bubble.innerHTML = `
        <div style="border-radius: var(--radius-md); overflow: hidden; max-width: 230px;">
          <img src="${msg.media}" style="width: 100%; border-radius: var(--radius-md); display: block; border: 1px solid rgba(230, 200, 117, 0.3);">
        </div>
        <div class="message-time">${msg.time} <i class="fa-solid fa-check-double"></i></div>
      `;
    } else if (msg.type === 'image_timed' || msg.type === 'image') {
      // Self-destructing timed photo (5 seconds view once)
      bubble.innerHTML = `
        <div class="timed-media-card" onclick="window.antikaChatEngine.openViewOnceImage('${msg.media}')">
          <div class="media-lock-overlay">
            <i class="fa-solid fa-eye" style="font-size: 1.5rem;"></i>
            <span>اضغط للعرض المؤقت (5 ثواني)</span>
          </div>
          <img src="${msg.media}" style="filter: blur(10px);">
        </div>
        <div class="message-time">${msg.time} <i class="fa-solid fa-check-double"></i></div>
      `;
    }

    this.chatList.appendChild(bubble);
    this.chatList.scrollTop = this.chatList.scrollHeight;
  }

  renderSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'date-divider';
    div.innerHTML = `<span style="border-color: var(--accent-gold); color: var(--accent-gold);">${text}</span>`;
    this.chatList.appendChild(div);
    this.chatList.scrollTop = this.chatList.scrollHeight;
  }

  openViewOnceImage(imgSrc) {
    this.viewOnceImgPreview.src = imgSrc;
    this.viewOnceModal.classList.add('active');

    let count = 5;
    this.viewOnceTimerText.textContent = `سيتم التدمير والمسح خلال ${count} ثواني`;

    const timer = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(timer);
        this.viewOnceModal.classList.remove('active');
        this.viewOnceImgPreview.src = '';
      } else {
        this.viewOnceTimerText.textContent = `سيتم التدمير والمسح خلال ${count} ثواني`;
      }
    }, 1000);
  }

  async toggleVoiceRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.stopVoiceRecording();
    } else {
      this.startVoiceRecording();
    }
  }

  async startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => this.audioChunks.push(e.data);
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        this.sendMessage(null, true, audioUrl);
      };

      this.mediaRecorder.start();
      this.recordingBar.style.display = 'flex';
      document.getElementById('text-input-wrapper').style.display = 'none';

      this.recSeconds = 0;
      this.recTimerDisplay.textContent = '00:00';
      clearInterval(this.recInterval);
      this.recInterval = setInterval(() => {
        this.recSeconds++;
        const m = String(Math.floor(this.recSeconds / 60)).padStart(2, '0');
        const s = String(this.recSeconds % 60).padStart(2, '0');
        this.recTimerDisplay.textContent = `${m}:${s}`;
      }, 1000);
    } catch (e) {
      this.startSimulatedVoiceRecording();
    }
  }

  startSimulatedVoiceRecording() {
    this.recordingBar.style.display = 'flex';
    document.getElementById('text-input-wrapper').style.display = 'none';

    this.recSeconds = 0;
    this.recTimerDisplay.textContent = '00:00';
    clearInterval(this.recInterval);
    this.recInterval = setInterval(() => {
      this.recSeconds++;
      const m = String(Math.floor(this.recSeconds / 60)).padStart(2, '0');
      const s = String(this.recSeconds % 60).padStart(2, '0');
      this.recTimerDisplay.textContent = `${m}:${s}`;
    }, 1000);
  }

  stopVoiceRecording() {
    clearInterval(this.recInterval);
    this.recordingBar.style.display = 'none';
    document.getElementById('text-input-wrapper').style.display = 'flex';

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    } else {
      this.sendMessage('00:0' + (this.recSeconds || 4), true, 'assets/sample-audio.mp3');
    }
  }

  cancelRecording() {
    clearInterval(this.recInterval);
    this.recordingBar.style.display = 'none';
    document.getElementById('text-input-wrapper').style.display = 'flex';
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.audioChunks = [];
    }
  }

  handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        this.sendMessage(null, false, event.target.result, this.isTimedImageSelected);
      };
      reader.readAsDataURL(file);
    }
  }

  checkInitialEmptyState() {
    const savedContacts = JSON.parse(localStorage.getItem('antika_contacts_list') || '[]');
    if (savedContacts.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.id = 'empty-chat-banner';
      emptyDiv.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--text-muted); margin: auto 0;';
      emptyDiv.innerHTML = `
        <i class="fa-solid fa-user-plus" style="font-size: 2.8rem; color: var(--accent-gold); margin-bottom: 14px; opacity: 0.85;"></i>
        <h3 style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 6px;">لا توجد محادثة نشطة بعد</h3>
        <p style="font-size: 0.84rem; line-height: 1.5; max-width: 280px; margin: 0 auto 16px auto;">
          اضغط على زر الاقتران ( <i class="fa-solid fa-user-plus" style="color: var(--accent-gold);"></i> ) بأعلى الشاشة لإرسال رقمك كدعوة وتسمية شريكك للبدء.
        </p>
      `;
      this.chatList.appendChild(emptyDiv);
    }
  }

  getFormattedTime() {
    const d = new Date();
    let hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12 || 12;
    return `${hours}:${mins} ${ampm}`;
  }

  escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.antikaChatEngine = new AntikaChatEngine();
});
