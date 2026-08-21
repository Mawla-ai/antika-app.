/* Antika - Chat Engine v3.0
   - Multi-device voice notes via Base64 DataURL audio
   - Automatic Canvas Image Compression for fast & reliable Firebase delivery
   - Persistent 6-Days Mode across sessions & reloads
   - Interactive Voice Player with progress bar & waveform
*/
class AntikaChatEngine {
  constructor() {
    this.chatList = document.getElementById('chat-messages-list');
    this.inputField = document.getElementById('chat-input-field');
    this.sendBtn = document.getElementById('send-msg-btn');
    this.voiceRecBtn = document.getElementById('voice-rec-btn');
    this.recordingBar = document.getElementById('recording-bar');
    this.recTimerDisplay = document.getElementById('rec-timer-display');

    // Attach & Image type
    this.attachImgBtn = document.getElementById('attach-image-btn');
    this.fileInput = document.getElementById('image-file-input');
    this.imageTypeModal = document.getElementById('image-type-modal');
    this.selectRegularImgBtn = document.getElementById('select-regular-image-btn');
    this.selectViewOnceImgBtn = document.getElementById('select-view-once-image-btn');
    this.closeImageTypeModalBtn = document.getElementById('close-image-type-modal-btn');
    this.isTimedImageSelected = false;

    // 6 Days Mode
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

    // Voice recording
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recInterval = null;
    this.recSeconds = 0;
    this.isRecording = false;
    this.recordStartX = 0;
    this.recordCancelled = false;

    // Active contact & channels
    this.activeContactId = null;
    this.myChannelId = localStorage.getItem('antika_my_invite_code');
    this.partnerChannelId = null;

    // Fallback broadcast
    this.mySessionId = 'sess-' + Math.random().toString(36).substring(2, 9);
    this.channel = null;

    this._initBroadcastChannel();
    this._initFirebase();
    this.initEvents();
    this.initEmojiBar();
    this.check6DaysActiveOnLoad();
    this.checkInitialEmptyState();
  }

  /* ── BroadcastChannel (same-device fallback) ───────────── */
  _initBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('antika_p2p_channel');
      this.channel.onmessage = (e) => {
        const data = e.data;
        if (!data) return;
        if (data.type === 'NEW_MESSAGE' && data.senderId !== this.mySessionId) {
          const msg = { ...data.msg, sender: 'received' };
          this.renderMessage(msg);
          this.persistMessage(msg);
          this.check6DaysKeyword(data.msg.text, 'received');
          window.notificationManager?.sendDisguisedNotification();
        } else if (data.type === 'ACTIVATE_6DAYS' && data.senderId !== this.mySessionId) {
          this.activate6DaysMode(true, data.expiry);
        } else if (data.type === 'TYPING' && data.senderId !== this.mySessionId) {
          this.showTypingIndicator();
        }
      };
    }
  }

  /* ── Firebase Listener ─────────────────────────────────── */
  _initFirebase() {
    const trySetup = () => {
      if (!window.antikaRealtime) { setTimeout(trySetup, 300); return; }
      window.antikaRealtime.onMessage((msg) => {
        const rendered = { ...msg, sender: 'received' };
        this.renderMessage(rendered);
        this.persistMessage(rendered);
        this.check6DaysKeyword(msg.text, 'received');
        window.notificationManager?.sendDisguisedNotification();
      });
      if (this.myChannelId && this.partnerChannelId) {
        window.antikaRealtime.setupChannels(this.myChannelId, this.partnerChannelId);
      }
    };
    trySetup();
  }

  /* ── Message Persistence ───────────────────────────────── */
  _storageKey() {
    return this.activeContactId ? `antika_msgs_${this.activeContactId}` : null;
  }

  loadMessages(contactId, partnerChannelId) {
    this.activeContactId = contactId;
    this.partnerChannelId = partnerChannelId;
    this.myChannelId = localStorage.getItem('antika_my_invite_code');

    // Setup Firebase channels
    if (window.antikaRealtime && this.myChannelId) {
      window.antikaRealtime.setupChannels(this.myChannelId, partnerChannelId);
    }

    // Render saved messages
    this.chatList.innerHTML = `
      <div class="date-divider"><span>الدفء ينبض هنا • Antika</span></div>`;

    const saved = JSON.parse(localStorage.getItem(this._storageKey()) || '[]');
    const now = Date.now();
    const expiry = parseInt(localStorage.getItem('antika_6days_expiry') || '0', 10);
    const is6DaysExpired = expiry > 0 && now >= expiry;

    const filtered = saved.filter(m => {
      if (m.mode6 && is6DaysExpired) return false;
      return true;
    });

    if (filtered.length !== saved.length) {
      localStorage.setItem(this._storageKey(), JSON.stringify(filtered));
    }

    if (filtered.length === 0) {
      this.renderSystemMessage('💌 ابدأ محادثتك مع من تحب...');
    } else {
      filtered.forEach(m => this.renderMessage(m, false));
    }
    setTimeout(() => { this.chatList.scrollTop = this.chatList.scrollHeight; }, 60);
  }

  persistMessage(msgObj) {
    const key = this._storageKey();
    if (!key) return;
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    saved.push(msgObj);
    localStorage.setItem(key, JSON.stringify(saved.slice(-200)));

    // Update contact preview
    window.antikaAppController?.updateContactLastMsg(this.activeContactId, msgObj);
  }

  clearMessages() {
    const key = this._storageKey();
    if (key) localStorage.removeItem(key);
    this.chatList.innerHTML = `<div class="date-divider"><span>الدفء ينبض هنا • Antika</span></div>`;
    this.renderSystemMessage('🗑️ تم مسح جميع الرسائل.');
  }

  /* ── Events ────────────────────────────────────────────── */
  initEvents() {
    let typingTimeout;
    this.inputField.addEventListener('input', () => {
      const v = this.inputField.value.trim();
      this.sendBtn.style.display = v.length ? 'flex' : 'none';
      this.voiceRecBtn.style.display = v.length ? 'none' : 'flex';
      if (v.length && this.channel) {
        clearTimeout(typingTimeout);
        this.channel.postMessage({ type: 'TYPING', senderId: this.mySessionId });
        typingTimeout = setTimeout(() => {}, 2000);
      }
    });

    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendMessage(); });

    // Voice record bind
    this._bindVoiceRecording();

    // Image attachments
    this.attachImgBtn.addEventListener('click', () => {
      this.imageTypeModal ? this.imageTypeModal.classList.add('active') : this.fileInput.click();
    });
    this.selectRegularImgBtn?.addEventListener('click', () => {
      this.isTimedImageSelected = false;
      this.imageTypeModal.classList.remove('active');
      this.fileInput.click();
    });
    this.selectViewOnceImgBtn?.addEventListener('click', () => {
      this.isTimedImageSelected = true;
      this.imageTypeModal.classList.remove('active');
      this.fileInput.click();
    });
    this.closeImageTypeModalBtn?.addEventListener('click', () => this.imageTypeModal.classList.remove('active'));
    this.fileInput.addEventListener('change', (e) => this.handleImageSelect(e));

    // 6 Days Mode
    this.confirmSecretBtn.addEventListener('click', () => {
      const expiry = Date.now() + (5 * 3600 * 1000);
      this.activate6DaysMode(false, expiry);
      this.channel?.postMessage({ type: 'ACTIVATE_6DAYS', senderId: this.mySessionId, expiry });
    });
    this.cancelSecretBtn.addEventListener('click', () => this.secretModal.classList.remove('active'));

    // Clear chat
    document.getElementById('clear-chat-btn')?.addEventListener('click', () => {
      if (confirm('هل تريد مسح كل الرسائل نهائياً؟')) this.clearMessages();
    });
  }

  /* ── WhatsApp Voice Recording (Hold + Slide to Cancel) ── */
  _bindVoiceRecording() {
    const btn = this.voiceRecBtn;
    if (!btn) return;

    const slideHint = document.getElementById('voice-slide-hint');
    const CANCEL_THRESHOLD = -60;

    const onStart = (clientX) => {
      this.recordStartX = clientX;
      this.recordCancelled = false;
      this._startVoiceRecording();
      if (slideHint) slideHint.classList.add('active');
    };

    const onMove = (clientX) => {
      if (!this.isRecording) return;
      const delta = clientX - this.recordStartX;
      if (slideHint) {
        slideHint.style.opacity = Math.max(0, 1 + delta / 100);
      }
      if (delta < CANCEL_THRESHOLD) {
        btn.classList.add('recording-cancel');
      } else {
        btn.classList.remove('recording-cancel');
      }
    };

    const onEnd = (clientX) => {
      if (!this.isRecording) return;
      const delta = clientX - this.recordStartX;
      if (slideHint) { slideHint.classList.remove('active'); slideHint.style.opacity = ''; }
      btn.classList.remove('recording-cancel');

      if (delta < CANCEL_THRESHOLD) {
        this._cancelVoiceRecording();
      } else {
        this._stopVoiceRecording();
      }
    };

    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onStart(e.touches[0].clientX);
    }, { passive: false });
    btn.addEventListener('touchmove', (e) => {
      e.preventDefault();
      onMove(e.touches[0].clientX);
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      onEnd(e.changedTouches[0].clientX);
    }, { passive: false });

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onStart(e.clientX);
      const onMv = (ev) => onMove(ev.clientX);
      const onUp = (ev) => {
        onEnd(ev.clientX);
        document.removeEventListener('mousemove', onMv);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMv);
      document.addEventListener('mouseup', onUp);
    });
  }

  async _startVoiceRecording() {
    if (this.isRecording) return;
    this.isRecording = true;

    this.voiceRecBtn.innerHTML = '<i class="fa-solid fa-microphone" style="color:var(--accent-rose);"></i>';
    this.voiceRecBtn.classList.add('recording-active');

    this.recSeconds = 0;
    this.recTimerDisplay.textContent = '00:00';
    clearInterval(this.recInterval);
    this.recInterval = setInterval(() => {
      this.recSeconds++;
      const m = String(Math.floor(this.recSeconds / 60)).padStart(2, '0');
      const s = String(this.recSeconds % 60).padStart(2, '0');
      this.recTimerDisplay.textContent = `${m}:${s}`;
    }, 1000);

    document.getElementById('text-input-wrapper').style.display = 'none';
    this.recordingBar.style.display = 'flex';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (!this.recordCancelled && this.audioChunks.length) {
          const blob = new Blob(this.audioChunks, { type: mimeType });
          // Convert to Base64 DataURL so it transmits reliably to other devices
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result;
            this._dispatchVoiceNote(base64Audio, this.recSeconds);
          };
          reader.readAsDataURL(blob);
        }
        this.audioChunks = [];
      };

      this.mediaRecorder.start();
    } catch (e) {
      console.warn('Microphone error:', e);
    }
  }

  _stopVoiceRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    this.recordCancelled = false;
    clearInterval(this.recInterval);
    this._resetVoiceUI();

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  _cancelVoiceRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    this.recordCancelled = true;
    clearInterval(this.recInterval);
    this._resetVoiceUI();

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    if (navigator.vibrate) navigator.vibrate(80);
  }

  _resetVoiceUI() {
    this.voiceRecBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    this.voiceRecBtn.classList.remove('recording-active', 'recording-cancel');
    this.recordingBar.style.display = 'none';
    document.getElementById('text-input-wrapper').style.display = 'flex';
  }

  _dispatchVoiceNote(base64Audio, durationSeconds) {
    this.sendMessage(null, true, base64Audio, false, durationSeconds);
  }

  /* ── Send Message ──────────────────────────────────────── */
  sendMessage(customText = null, isVoice = false, mediaData = null, isTimedMedia = false, voiceDuration = 0) {
    const text = customText || this.inputField.value.trim();
    if (!text && !isVoice && !mediaData) return;

    if (!customText && !isVoice) {
      this.inputField.value = '';
      this.sendBtn.style.display = 'none';
      this.voiceRecBtn.style.display = 'flex';
    }

    document.getElementById('emoji-quick-bar')?.classList.remove('active');
    document.getElementById('emoji-toggle-btn')?.classList.remove('active');

    const msgObj = {
      id: 'msg-' + Date.now(),
      type: isVoice
        ? 'voice'
        : (mediaData ? (isTimedMedia ? 'image_timed' : 'image_regular') : 'text'),
      text: text || '',
      media: mediaData || null,
      duration: voiceDuration,
      sender: 'sent',
      senderId: window.antikaMyUserId,
      time: this._formatTime(),
      mode6: this.is6DaysMode
    };

    this.renderMessage(msgObj);
    this.persistMessage(msgObj);
    this.check6DaysKeyword(text, 'sent');

    // Send via Firebase
    window.antikaRealtime?.sendMessage(msgObj);

    // BroadcastChannel fallback
    this.channel?.postMessage({ type: 'NEW_MESSAGE', senderId: this.mySessionId, msg: msgObj });
  }

  /* ── 6 Days Mode ───────────────────────────────────────── */
  check6DaysActiveOnLoad() {
    const expiry = parseInt(localStorage.getItem('antika_6days_expiry') || '0', 10);
    if (expiry > Date.now()) {
      this.activate6DaysMode(false, expiry);
    } else if (expiry > 0) {
      this.expire6DaysMode();
    }
  }

  check6DaysKeyword(text, sender) {
    if (this.is6DaysMode) return;
    const lower = (text || '').toLowerCase();
    if (lower.includes('6 أيام') || lower.includes('6 ايام')) {
      setTimeout(() => this.secretModal.classList.add('active'), 600);
    }
  }

  activate6DaysMode(isRemote = false, expiryTimestamp = null) {
    this.secretModal.classList.remove('active');
    this.is6DaysMode = true;
    document.getElementById('main-app').classList.add('mode-6days');
    this.secretBanner.style.display = 'flex';

    const expiry = expiryTimestamp || (Date.now() + (5 * 3600 * 1000));
    localStorage.setItem('antika_6days_expiry', expiry);

    clearInterval(this.vaultTimer);
    const updateCountdown = () => {
      const remainingMs = expiry - Date.now();
      if (remainingMs <= 0) {
        this.expire6DaysMode();
      } else {
        const totalSecs = Math.floor(remainingMs / 1000);
        const h = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
        const s = String(totalSecs % 60).padStart(2, '0');
        this.vaultTimerDisplay.textContent = `${h}:${m}:${s}`;
      }
    };

    updateCountdown();
    this.vaultTimer = setInterval(updateCountdown, 1000);

    if (!isRemote) {
      this.renderSystemMessage('✨ تم تفعيل موود 6 أيام! الشات المؤقت سيتدمر تلقائياً بعد 5 ساعات.');
    }
  }

  expire6DaysMode() {
    clearInterval(this.vaultTimer);
    this.is6DaysMode = false;
    localStorage.removeItem('antika_6days_expiry');
    document.getElementById('main-app').classList.remove('mode-6days');
    this.secretBanner.style.display = 'none';

    // Remove all 6-days messages from DOM and storage
    document.querySelectorAll('.msg-mode-6').forEach(el => el.remove());
    if (this.activeContactId) {
      const key = this._storageKey();
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = saved.filter(m => !m.mode6);
      localStorage.setItem(key, JSON.stringify(filtered));
    }
    this.renderSystemMessage('🔒 انتهت فترة موود 6 أيام وتم حذف الرسائل المؤقتة.');
  }

  /* ── Typing Indicator ──────────────────────────────────── */
  showTypingIndicator() {
    const existing = document.getElementById('typing-indicator');
    if (existing) {
      clearTimeout(existing._t);
      existing._t = setTimeout(() => existing.remove(), 3000);
      return;
    }
    const el = document.createElement('div');
    el.id = 'typing-indicator';
    el.className = 'typing-indicator';
    el.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div><span class="typing-label">يكتب...</span>`;
    this.chatList.appendChild(el);
    this.chatList.scrollTop = this.chatList.scrollHeight;
    el._t = setTimeout(() => el.remove(), 3000);
  }

  /* ── Emoji Bar ─────────────────────────────────────────── */
  initEmojiBar() {
    const bar = document.getElementById('emoji-quick-bar');
    if (!bar) return;
    const emojis = ['❤️', '😍', '🔥', '😘', '🥰', '💕', '✨', '😂', '👏', '💯', '🌹', '💋', '😊', '🎉', '💫', '🤍'];
    bar.innerHTML = emojis.map(e => `<button class="emoji-btn" data-emoji="${e}">${e}</button>`).join('');
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-btn');
      if (!btn) return;
      this.inputField.value += btn.getAttribute('data-emoji');
      this.inputField.dispatchEvent(new Event('input'));
      this.inputField.focus();
      btn.classList.add('emoji-bounce');
      setTimeout(() => btn.classList.remove('emoji-bounce'), 300);
    });
    document.getElementById('emoji-toggle-btn')?.addEventListener('click', () => {
      bar.classList.toggle('active');
      document.getElementById('emoji-toggle-btn').classList.toggle('active');
    });
  }

  /* ── Render Messages ───────────────────────────────────── */
  renderMessage(msg, scroll = true) {
    document.getElementById('empty-chat-banner')?.remove();
    document.getElementById('typing-indicator')?.remove();

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${msg.sender} ${msg.mode6 ? 'msg-mode-6' : ''}`;
    bubble.id = msg.id;
    bubble.setAttribute('data-msg-id', msg.id);
    bubble.setAttribute('data-msg-raw', JSON.stringify(msg));

    if (msg.type === 'text') {
      bubble.innerHTML = `
        <div class="msg-text">${this._escapeHTML(msg.text)}</div>
        <div class="message-time">${msg.time} <i class="fa-solid fa-check-double"></i></div>`;
    } else if (msg.type === 'voice') {
      const dur = this._formatDuration(msg.duration || 0);
      bubble.innerHTML = `
        <div class="voice-bubble">
          <button class="voice-play-btn" onclick="AntikaVoicePlayer.toggle(this)">
            <i class="fa-solid fa-play"></i>
          </button>
          <div class="voice-body">
            <div class="voice-bars-wrap">
              ${Array.from({length: 20}, () => {
                const h = 4 + Math.floor(Math.random() * 16);
                return `<span class="vbar" style="height:${h}px"></span>`;
              }).join('')}
              <div class="voice-progress-fill"></div>
            </div>
            <div class="voice-meta">
              <span class="voice-duration">${dur}</span>
            </div>
          </div>
        </div>
        <div class="message-time">${msg.time} <i class="fa-solid fa-check-double"></i></div>`;
    } else if (msg.type === 'image_regular') {
      bubble.innerHTML = `
        <div style="border-radius:var(--radius-md);overflow:hidden;max-width:230px;">
          <img src="${msg.media}" style="width:100%;display:block;border:1px solid rgba(230,200,117,0.3);border-radius:var(--radius-md);">
        </div>
        <div class="message-time">${msg.time} <i class="fa-solid fa-check-double"></i></div>`;
    } else if (msg.type === 'image_timed') {
      bubble.innerHTML = `
        <div class="timed-media-card" onclick="window.antikaChatEngine.openViewOnceImage('${msg.media}')">
          <div class="media-lock-overlay">
            <i class="fa-solid fa-eye" style="font-size:1.5rem;"></i>
            <span>اضغط للعرض المؤقت (5 ثواني)</span>
          </div>
          <img src="${msg.media}" style="filter:blur(10px);">
        </div>
        <div class="message-time">${msg.time} <i class="fa-solid fa-check-double"></i></div>`;
    }

    this._bindLongPress(bubble, msg);
    this.chatList.appendChild(bubble);
    if (scroll) this.chatList.scrollTop = this.chatList.scrollHeight;
  }

  _bindLongPress(bubble, msg) {
    let timer;
    bubble.addEventListener('pointerdown', () => {
      timer = setTimeout(() => {
        this._showCtxMenu(bubble, msg);
        if (navigator.vibrate) navigator.vibrate(60);
      }, 600);
    });
    ['pointerup', 'pointercancel', 'pointermove'].forEach(ev =>
      bubble.addEventListener(ev, () => clearTimeout(timer))
    );
  }

  _showCtxMenu(bubble, msg) {
    document.querySelectorAll('.msg-ctx-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'msg-ctx-menu';
    menu.innerHTML = `
      <div class="ctx-reaction-row">
        ${['❤️','😍','😂','🔥','😢','👏'].map(e =>
          `<button class="ctx-reaction-btn" data-e="${e}">${e}</button>`
        ).join('')}
      </div>
      <button class="ctx-menu-item" id="ctx-del"><i class="fa-solid fa-trash"></i> حذف الرسالة</button>
      <button class="ctx-menu-item" id="ctx-copy"><i class="fa-solid fa-copy"></i> نسخ النص</button>
    `;
    bubble.style.position = 'relative';
    bubble.appendChild(menu);

    menu.querySelectorAll('.ctx-reaction-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._addReaction(bubble, btn.getAttribute('data-e'));
        menu.remove();
      });
    });
    menu.querySelector('#ctx-del').addEventListener('click', () => {
      bubble.classList.add('msg-deleting');
      setTimeout(() => { bubble.remove(); this._saveMessages(); }, 300);
      menu.remove();
    });
    menu.querySelector('#ctx-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(msg.text || '').catch(() => {});
      menu.remove();
    });
    setTimeout(() => {
      document.addEventListener('pointerdown', function d(e) {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', d); }
      });
    }, 100);
  }

  _addReaction(bubble, emoji) {
    let row = bubble.querySelector('.msg-reactions');
    if (!row) { row = document.createElement('div'); row.className = 'msg-reactions'; bubble.appendChild(row); }
    const chip = document.createElement('span');
    chip.className = 'reaction-chip';
    chip.textContent = emoji;
    row.appendChild(chip);
  }

  _saveMessages() {
    const key = this._storageKey();
    if (!key) return;
    const msgs = [];
    this.chatList.querySelectorAll('.message-bubble[data-msg-raw]').forEach(el => {
      try { msgs.push(JSON.parse(el.getAttribute('data-msg-raw'))); } catch (e) {}
    });
    localStorage.setItem(key, JSON.stringify(msgs.slice(-200)));
  }

  renderSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'date-divider';
    div.innerHTML = `<span style="border-color:var(--accent-gold);color:var(--accent-gold);">${text}</span>`;
    this.chatList.appendChild(div);
    this.chatList.scrollTop = this.chatList.scrollHeight;
  }

  openViewOnceImage(src) {
    if (!src) return;
    this.viewOnceImgPreview.src = src;
    this.viewOnceModal.classList.add('active');
    let count = 5;
    this.viewOnceTimerText.textContent = `سيتم التدمير خلال ${count} ثواني`;
    const t = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(t);
        this.viewOnceModal.classList.remove('active');
        this.viewOnceImgPreview.src = '';
      } else {
        this.viewOnceTimerText.textContent = `سيتم التدمير خلال ${count} ثواني`;
      }
    }, 1000);
  }

  /* ── Image Compression & Sending ───────────────────────── */
  handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    this._compressImage(file, 800, 0.7, (compressedBase64) => {
      this.sendMessage(null, false, compressedBase64, this.isTimedImageSelected);
    });
    e.target.value = '';
  }

  _compressImage(file, maxDimension, quality, callback) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        callback(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  checkInitialEmptyState() {
    const contacts = JSON.parse(localStorage.getItem('antika_contacts_list') || '[]');
    if (contacts.length === 0) {
      const div = document.createElement('div');
      div.id = 'empty-chat-banner';
      div.style.cssText = 'text-align:center;padding:40px 20px;color:var(--text-muted);margin:auto 0;';
      div.innerHTML = `
        <i class="fa-solid fa-user-plus" style="font-size:2.8rem;color:var(--accent-gold);margin-bottom:14px;opacity:0.85;"></i>
        <h3 style="font-size:1.1rem;color:var(--text-main);margin-bottom:6px;">لا توجد محادثة نشطة بعد</h3>
        <p style="font-size:0.84rem;line-height:1.5;max-width:280px;margin:0 auto;">
          اضغط على <i class="fa-solid fa-user-plus" style="color:var(--accent-gold);"></i> لإضافة شريكك والبدء.
        </p>`;
      this.chatList.appendChild(div);
    }
  }

  _formatTime() {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    const ap = d.getHours() >= 12 ? 'م' : 'ص';
    return `${h}:${m} ${ap}`;
  }

  _formatDuration(secs) {
    const m = Math.floor(secs / 60);
    const s = String(Math.floor(secs % 60)).padStart(2, '0');
    return `${m}:${s}`;
  }

  _escapeHTML(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

/* ── Voice Note Player (Singleton) ────────────────────────── */
class AntikaVoicePlayer {
  static _current = null;

  static toggle(btn) {
    const bubble = btn.closest('.message-bubble');
    if (!bubble) return;

    let rawData = {};
    try {
      rawData = JSON.parse(bubble.getAttribute('data-msg-raw') || '{}');
    } catch(e) {}

    const src = rawData.media;
    if (!src) return;

    if (AntikaVoicePlayer._current?.bubble === bubble) {
      const audio = AntikaVoicePlayer._current.audio;
      if (audio.paused) {
        audio.play();
        btn.querySelector('i').className = 'fa-solid fa-pause';
      } else {
        audio.pause();
        btn.querySelector('i').className = 'fa-solid fa-play';
      }
      return;
    }

    if (AntikaVoicePlayer._current) {
      AntikaVoicePlayer._current.audio.pause();
      const prevBtn = AntikaVoicePlayer._current.bubble?.querySelector('.voice-play-btn i');
      if (prevBtn) prevBtn.className = 'fa-solid fa-play';
    }

    const audio = new Audio(src);
    AntikaVoicePlayer._current = { audio, bubble };

    btn.querySelector('i').className = 'fa-solid fa-pause';

    audio.addEventListener('timeupdate', () => {
      const fill = bubble.querySelector('.voice-progress-fill');
      const dur = bubble.querySelector('.voice-duration');
      if (fill && audio.duration) {
        fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
      }
      if (dur) {
        const s = Math.floor(audio.currentTime);
        const m = Math.floor(s / 60);
        dur.textContent = `${m}:${String(s % 60).padStart(2,'0')}`;
      }
    });

    audio.addEventListener('ended', () => {
      btn.querySelector('i').className = 'fa-solid fa-play';
      const fill = bubble.querySelector('.voice-progress-fill');
      if (fill) fill.style.width = '0%';
      AntikaVoicePlayer._current = null;
    });

    audio.play().catch((err) => {
      console.warn('Audio playback error:', err);
      btn.querySelector('i').className = 'fa-solid fa-play';
    });
  }
}

window.AntikaVoicePlayer = AntikaVoicePlayer;

document.addEventListener('DOMContentLoaded', () => {
  window.antikaChatEngine = new AntikaChatEngine();
});
