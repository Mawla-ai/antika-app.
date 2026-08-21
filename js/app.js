/* Antika - App Controller v2.0
   - Profile system (name + photo like WhatsApp)
   - Firebase partner discovery
   - Settings with change passcode
*/
class AntikaAppController {
  constructor() {
    // Clock
    this.camouflageScreen = document.getElementById('camouflage-screen');
    this.clockTrigger = document.getElementById('aya-clock-trigger');
    this.digitalClock = document.getElementById('digital-clock');
    this.hourHand = document.getElementById('hour-hand');
    this.minuteHand = document.getElementById('minute-hand');
    this.secondHand = document.getElementById('second-hand');

    // Screens
    this.homeScreen = document.getElementById('whatsapp-home-screen');
    this.chatScreen = document.getElementById('whatsapp-chat-screen');
    this.settingsScreen = document.getElementById('settings-screen');

    // Modals
    this.passcodeModal = document.getElementById('passcode-modal');
    this.passcodeTitle = document.getElementById('passcode-header-title');
    this.passcodeDesc = document.getElementById('passcode-header-desc');
    this.pinDotsContainer = document.getElementById('pin-dots-container');
    this.addContactModal = document.getElementById('add-contact-modal');
    this.myInviteNumberDisplay = document.getElementById('my-invite-number');
    this.partnerNicknameInput = document.getElementById('partner-nickname-input');
    this.partnerInviteInput = document.getElementById('partner-invite-input');

    // Passcode state
    this.enteredPin = '';
    this.storedPin = localStorage.getItem('antika_passcode') || null;
    this.isSettingUpPin = !this.storedPin;
    this.isChangingPin = false;
    this._awaitingNewPin = false;

    // Long press
    this.longPressTimer = null;
    this.longPressDuration = 800;
    this.clickCount = 0;
    this.clickResetTimer = null;

    // Data
    this.myInviteCode = this.getOrGenerateInviteCode();
    this.contacts = this.loadContacts();
    this.activeContactId = null;

    // Profile
    this.myProfile = this.loadMyProfile();

    this.initClock();
    this.bindLongPressEvents();
    this.bindNumpadEvents();
    this.bindAddContactEvents();
    this.bindHomeScreenEvents();
    this.bindBackButtons();
    this.bindSearchAndFilter();
    this.bindSettingsEvents();
    this.registerServiceWorker();
    this.renderChatList();

    // Sync profile to Firebase after realtime engine loads
    setTimeout(() => this.syncProfileToFirebase(), 1000);
  }

  /* ── Clock ─────────────────────────────────────────────── */
  initClock() {
    const tick = () => {
      const now = new Date();
      const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(), ms = now.getMilliseconds();
      if (this.secondHand) this.secondHand.style.transform = `rotate(${((s + ms / 1000) / 60) * 360}deg)`;
      if (this.minuteHand) this.minuteHand.style.transform = `rotate(${((m + s / 60) / 60) * 360}deg)`;
      if (this.hourHand) this.hourHand.style.transform = `rotate(${(((h % 12) + m / 60) / 12) * 360}deg)`;
      if (this.digitalClock) this.digitalClock.textContent =
        `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── Long Press to Unlock ──────────────────────────────── */
  bindLongPressEvents() {
    const trigger = () => {
      if (navigator.vibrate) navigator.vibrate(80);
      this.openPasscodeModal();
    };
    const start = () => {
      if (this.longPressTimer) clearTimeout(this.longPressTimer);
      this.longPressTimer = setTimeout(trigger, this.longPressDuration);
    };
    const cancel = () => {
      if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
    };

    if ('PointerEvent' in window) {
      this.clockTrigger.addEventListener('pointerdown', start);
      this.clockTrigger.addEventListener('pointerup', cancel);
      this.clockTrigger.addEventListener('pointercancel', cancel);
    } else {
      this.clockTrigger.addEventListener('touchstart', start, { passive: true });
      this.clockTrigger.addEventListener('touchend', cancel);
      this.clockTrigger.addEventListener('mousedown', start);
      this.clockTrigger.addEventListener('mouseup', cancel);
    }

    this.clockTrigger.addEventListener('click', () => {
      this.clickCount++;
      clearTimeout(this.clickResetTimer);
      if (this.clickCount >= 3) { this.clickCount = 0; cancel(); trigger(); }
      else this.clickResetTimer = setTimeout(() => { this.clickCount = 0; }, 800);
    });
  }

  /* ── Passcode ──────────────────────────────────────────── */
  openPasscodeModal(forChange = false) {
    this.enteredPin = '';
    this.isChangingPin = forChange;
    this._awaitingNewPin = false;
    this.updatePinDots();

    if (!this.storedPin) {
      this.isSettingUpPin = true;
      this.passcodeTitle.textContent = 'تعيين رمز الدخول أول مرة';
      this.passcodeDesc.textContent = 'أنشئ رمز دخول سري مكون من 4 أرقام';
    } else if (forChange) {
      this.isSettingUpPin = false;
      this.passcodeTitle.textContent = 'أدخل الرمز القديم أولاً';
      this.passcodeDesc.textContent = 'تحقق من رمزك الحالي قبل تغييره';
    } else {
      this.isSettingUpPin = false;
      this.passcodeTitle.textContent = 'أدخل رمز الدخول';
      this.passcodeDesc.textContent = 'ادخل الباسورد الخاص بك';
    }
    this.passcodeModal.classList.add('active');
  }

  bindNumpadEvents() {
    document.querySelectorAll('.num-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleNumpadInput(btn.getAttribute('data-val')));
    });
  }

  handleNumpadInput(val) {
    if (val === 'clear') this.enteredPin = this.enteredPin.slice(0, -1);
    else if (val === 'enter') this.submitPin();
    else if (this.enteredPin.length < 4) this.enteredPin += val;
    this.updatePinDots();
    if (this.enteredPin.length === 4) setTimeout(() => this.submitPin(), 250);
  }

  updatePinDots() {
    this.pinDotsContainer.querySelectorAll('.dot').forEach((dot, i) => {
      dot.classList.toggle('filled', i < this.enteredPin.length);
    });
  }

  submitPin() {
    if (this.enteredPin.length < 4) return;
    if (this.isSettingUpPin) {
      this.storedPin = this.enteredPin;
      localStorage.setItem('antika_passcode', this.storedPin);
      this.passcodeModal.classList.remove('active');
      this.unlockAppShell();
    } else if (this.isChangingPin) {
      if (!this._awaitingNewPin) {
        if (this.enteredPin === this.storedPin) {
          this._awaitingNewPin = true;
          this.enteredPin = '';
          this.updatePinDots();
          this.passcodeTitle.textContent = 'أدخل الرمز الجديد';
          this.passcodeDesc.textContent = 'اختر رمزاً جديداً مكوناً من 4 أرقام';
        } else { this._shakeError('رمز خاطئ'); }
      } else {
        this.storedPin = this.enteredPin;
        localStorage.setItem('antika_passcode', this.storedPin);
        this._awaitingNewPin = false;
        this.isChangingPin = false;
        this.passcodeModal.classList.remove('active');
        this.showToast('✅ تم تغيير رمز الدخول بنجاح');
      }
    } else {
      if (this.enteredPin === this.storedPin) {
        this.passcodeModal.classList.remove('active');
        this.unlockAppShell();
      } else { this._shakeError('رمز خاطئ، حاول مجدداً'); }
    }
  }

  _shakeError(msg) {
    this.passcodeTitle.textContent = msg;
    this.passcodeTitle.style.color = 'var(--accent-rose)';
    this.enteredPin = '';
    this.updatePinDots();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setTimeout(() => {
      this.passcodeTitle.style.color = 'var(--accent-gold)';
      this.passcodeTitle.textContent = this.isChangingPin ? 'أدخل الرمز القديم' : 'أدخل رمز الدخول';
    }, 1500);
  }

  unlockAppShell() { this.camouflageScreen.classList.add('hidden'); }

  /* ── Invite Codes ──────────────────────────────────────── */
  getOrGenerateInviteCode() {
    let code = localStorage.getItem('antika_my_invite_code');
    if (!code) {
      code = 'ANT-' + Math.floor(100000 + Math.random() * 900000);
      localStorage.setItem('antika_my_invite_code', code);
    }
    return code;
  }

  regenerateInviteCode() {
    const used = JSON.parse(localStorage.getItem('antika_used_codes') || '[]');
    used.push(this.myInviteCode);
    localStorage.setItem('antika_used_codes', JSON.stringify(used));
    this.myInviteCode = 'ANT-' + Math.floor(100000 + Math.random() * 900000);
    localStorage.setItem('antika_my_invite_code', this.myInviteCode);
    if (this.myInviteNumberDisplay) this.myInviteNumberDisplay.textContent = this.myInviteCode;
  }

  /* ── Profile System ────────────────────────────────────── */
  loadMyProfile() {
    const saved = localStorage.getItem('antika_my_profile');
    if (saved) return JSON.parse(saved);
    return { name: '', photo: null, inviteCode: this.myInviteCode };
  }

  saveMyProfile(profile) {
    this.myProfile = { ...profile, inviteCode: this.myInviteCode };
    localStorage.setItem('antika_my_profile', JSON.stringify(this.myProfile));
    this.syncProfileToFirebase();
  }

  syncProfileToFirebase() {
    if (!window.antikaRealtime?.isConnected()) return;
    window.antikaRealtime.saveProfile(this.myInviteCode, {
      name: this.myProfile.name || 'مستخدم Antika',
      photo: this.myProfile.photo || null,
      inviteCode: this.myInviteCode
    });
  }

  onPartnerProfileReceived(memberData) {
    // Called when partner writes their profile to our Firebase channel
    if (!memberData || !memberData.channelId) return;
    const contact = this.contacts.find(c => c.code === memberData.channelId);
    if (contact) {
      if (memberData.name) contact.name = memberData.name;
      if (memberData.photo) contact.avatar = memberData.photo;
      this.saveContacts();
      this.renderChatList();
      // Update chat header if currently open
      if (this.activeContactId === contact.id) {
        const nameEl = document.getElementById('active-partner-name');
        const avatarEl = document.getElementById('chat-partner-avatar');
        if (nameEl && memberData.name) nameEl.textContent = memberData.name;
        if (avatarEl && memberData.photo) avatarEl.src = memberData.photo;
      }
    }
  }

  /* ── Contacts ──────────────────────────────────────────── */
  loadContacts() { return JSON.parse(localStorage.getItem('antika_contacts_list') || '[]'); }
  saveContacts() { localStorage.setItem('antika_contacts_list', JSON.stringify(this.contacts)); }

  updateContactLastMsg(contactId, msg) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!contact) return;
    contact.lastMsg = msg.text || (msg.type === 'voice' ? '🎙️ رسالة صوتية' : '📸 صورة');
    contact.lastTime = msg.time;
    if (msg.sender === 'received') contact.unread = (contact.unread || 0) + 1;
    this.saveContacts();
  }

  /* ── Chat List Rendering ───────────────────────────────── */
  renderChatList(filterFn = null) {
    const container = document.getElementById('wa-chats-list-container');
    if (!container) return;
    container.innerHTML = '';
    const list = filterFn ? this.contacts.filter(filterFn) : this.contacts;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="wa-empty-state">
          <i class="fa-solid fa-heart" style="font-size:3rem;color:var(--accent-gold);opacity:0.5;margin-bottom:14px;"></i>
          <p style="font-size:0.95rem;color:var(--text-muted);text-align:center;max-width:240px;line-height:1.6;">
            لا توجد محادثات بعد.<br>اضغط على <strong style="color:var(--accent-green);">+</strong> لإضافة شريكك والبدء.
          </p>
        </div>`;
      return;
    }

    list.forEach(contact => {
      const row = document.createElement('div');
      row.className = 'wa-chat-row';
      row.setAttribute('data-contact-id', contact.id);
      row.innerHTML = `
        <div class="wa-chat-row-left">
          <div class="wa-avatar-wrap">
            <img class="wa-avatar" src="${contact.avatar || 'assets/logo_192.png'}" alt="${contact.name}">
          </div>
          <div class="wa-chat-details">
            <h4>${contact.name}</h4>
            <div class="wa-chat-preview">
              <i class="fa-solid fa-check-double" style="color:var(--accent-cyan);font-size:0.7rem;"></i>
              ${contact.lastMsg || 'تم الاقتران بنجاح ❤️'}
            </div>
          </div>
        </div>
        <div class="wa-chat-meta">
          <span class="wa-time">${contact.lastTime || ''}</span>
          ${contact.unread ? `<span class="wa-badge">${contact.unread}</span>` : ''}
        </div>`;
      row.addEventListener('click', () => this.openChat(contact));
      container.appendChild(row);
    });
  }

  openChat(contact) {
    this.activeContactId = contact.id;

    // Update header
    const nameEl = document.getElementById('active-partner-name');
    const callNameEl = document.getElementById('call-partner-display-name');
    const avatarEl = document.getElementById('chat-partner-avatar');
    if (nameEl) nameEl.textContent = contact.name;
    if (callNameEl) callNameEl.textContent = contact.name;
    if (avatarEl) avatarEl.src = contact.avatar || 'assets/logo_192.png';

    // Load messages from storage + setup Firebase
    window.antikaChatEngine?.loadMessages(contact.id, contact.code);

    // Announce our profile to partner via Firebase
    setTimeout(() => {
      window.antikaRealtime?.announceToPartner({
        name: this.myProfile.name || 'مستخدم Antika',
        photo: this.myProfile.photo || null,
        channelId: this.myInviteCode
      });
    }, 500);

    // Navigate
    this._showScreen(this.chatScreen);
    contact.unread = 0;
    this.saveContacts();
  }

  _showScreen(screen) {
    [this.homeScreen, this.chatScreen, this.settingsScreen].forEach(s => {
      if (s) s.classList.remove('active');
    });
    if (screen) {
      screen.classList.add('active');
      screen.classList.add('slide-in');
      setTimeout(() => screen.classList.remove('slide-in'), 350);
    }
  }

  /* ── Home Screen Events ────────────────────────────────── */
  bindHomeScreenEvents() {
    document.getElementById('wa-fab-add-btn')?.addEventListener('click', () => {
      if (this.myInviteNumberDisplay) this.myInviteNumberDisplay.textContent = this.myInviteCode;
      if (this.partnerNicknameInput) this.partnerNicknameInput.value = '';
      if (this.partnerInviteInput) this.partnerInviteInput.value = '';
      this.addContactModal.classList.add('active');
    });
    document.getElementById('wa-settings-btn')?.addEventListener('click', () => this._showScreen(this.settingsScreen));
  }

  bindBackButtons() {
    document.getElementById('back-to-home-btn')?.addEventListener('click', () => {
      this._showScreen(this.homeScreen);
      this.renderChatList();
    });
    document.getElementById('back-from-settings-btn')?.addEventListener('click', () => {
      this._showScreen(this.homeScreen);
    });
  }

  bindSearchAndFilter() {
    const search = document.getElementById('wa-search-input');
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase().trim();
        this.renderChatList(q ? c => c.name.toLowerCase().includes(q) || (c.lastMsg || '').toLowerCase().includes(q) : null);
      });
    }
    document.querySelectorAll('.wa-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.wa-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const f = pill.getAttribute('data-filter');
        if (f === 'all') this.renderChatList();
        else if (f === 'unread') this.renderChatList(c => c.unread > 0);
        else if (f === 'fav') this.renderChatList(c => c.fav);
        else this.renderChatList();
      });
    });
  }

  /* ── Add Contact / Pairing ─────────────────────────────── */
  bindAddContactEvents() {
    document.getElementById('close-add-contact-modal-btn')?.addEventListener('click', () =>
      this.addContactModal.classList.remove('active'));

    document.getElementById('share-my-invite-btn')?.addEventListener('click', () => {
      const text = `دعوة اقتران خاصة على تطبيق Antika ❤️\nرقم الدعوة المخصص لك: ${this.myInviteCode}\nافتح التطبيق وأضف هذا الرقم للاقتران الآمن.`;
      if (navigator.share) {
        navigator.share({ title: 'دعوة Antika', text });
      } else {
        navigator.clipboard.writeText(text).then(() => {
          const btn = document.getElementById('share-my-invite-btn');
          btn.innerHTML = '<i class="fa-solid fa-check"></i> تم نسخ رقم الدعوة!';
          setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-share-nodes" style="margin-left:8px;"></i> إرسال رقمك كدعوة لشريكك';
          }, 2000);
        });
      }
    });

    document.getElementById('confirm-add-partner-btn')?.addEventListener('click', () => {
      const code = (this.partnerInviteInput?.value || '').trim().toUpperCase();
      const name = (this.partnerNicknameInput?.value || '').trim();
      const partnerName = name || `الشريك (${code.slice(4, 8) || '❤️'})`;

      if (!code) { alert('يرجى كتابة رقم دعوة الشريك أولاً'); return; }

      const used = JSON.parse(localStorage.getItem('antika_used_codes') || '[]');
      if (used.includes(code)) { alert('هذا الرقم مستخدم سابقاً وغير صالح.'); return; }

      const now = new Date();
      const timeStr = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2,'0')} ${now.getHours() >= 12 ? 'م' : 'ص'}`;

      // Try to load partner's profile photo from Firebase
      const tryLoadPhoto = (callback) => {
        if (window.antikaRealtime?.isConnected()) {
          window.antikaRealtime.loadProfile(code, (profile) => {
            callback(profile?.photo || 'assets/logo_192.png', profile?.name || partnerName);
          });
        } else {
          callback('assets/logo_192.png', partnerName);
        }
      };

      tryLoadPhoto((photo, resolvedName) => {
        const newContact = {
          id: 'c-' + Date.now(),
          name: resolvedName,
          code,              // ← partner's invite code = channel to send TO
          avatar: photo,
          lastMsg: 'تم الاقتران بنجاح! ابدآ المحادثة ❤️',
          lastTime: timeStr,
          unread: 0,
          fav: true
        };

        this.contacts.unshift(newContact);
        this.saveContacts();
        localStorage.setItem('antika_partner_name', resolvedName);
        this.regenerateInviteCode();
        this.addContactModal.classList.remove('active');
        this.renderChatList();

        setTimeout(() => this.openChat(newContact), 300);
      });
    });

    document.getElementById('open-add-contact-btn')?.addEventListener('click', () => {
      if (this.myInviteNumberDisplay) this.myInviteNumberDisplay.textContent = this.myInviteCode;
      if (this.partnerNicknameInput) this.partnerNicknameInput.value = '';
      if (this.partnerInviteInput) this.partnerInviteInput.value = '';
      this.addContactModal.classList.add('active');
    });
  }

  /* ── Settings ──────────────────────────────────────────── */
  bindSettingsEvents() {
    // Profile name edit
    document.getElementById('profile-name-input')?.addEventListener('blur', (e) => {
      const name = e.target.value.trim();
      if (name) {
        this.saveMyProfile({ ...this.myProfile, name });
        this.showToast('✅ تم حفظ الاسم');
      }
    });

    // Profile photo
    document.getElementById('profile-photo-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const photo = ev.target.result;
        this.saveMyProfile({ ...this.myProfile, photo });
        const preview = document.getElementById('profile-photo-preview');
        if (preview) preview.src = photo;
        this.showToast('✅ تم تحديث الصورة الشخصية');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    document.getElementById('profile-photo-edit-btn')?.addEventListener('click', () => {
      document.getElementById('profile-photo-input')?.click();
    });

    // Change passcode
    document.getElementById('change-passcode-btn')?.addEventListener('click', () => {
      this.openPasscodeModal(true);
    });

    // Export
    document.getElementById('export-chat-btn')?.addEventListener('click', () => {
      if (!this.activeContactId) { this.showToast('افتح محادثة أولاً'); return; }
      const msgs = JSON.parse(localStorage.getItem(`antika_msgs_${this.activeContactId}`) || '[]');
      const text = msgs.map(m => `[${m.time}] ${m.sender === 'sent' ? 'أنا' : 'الشريك'}: ${m.text || '📎'}`).join('\n');
      navigator.clipboard.writeText(text).then(() => this.showToast('✅ تم نسخ المحادثة'));
    });

    // Reset
    document.getElementById('reset-app-btn')?.addEventListener('click', () => {
      if (confirm('⚠️ سيتم مسح جميع البيانات والرسائل. هل أنت متأكد؟')) {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith('antika_')) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
        window.location.reload();
      }
    });

    // Load profile into settings
    this._loadProfileUI();
  }

  _loadProfileUI() {
    const nameInput = document.getElementById('profile-name-input');
    const photoPreview = document.getElementById('profile-photo-preview');
    if (nameInput && this.myProfile.name) nameInput.value = this.myProfile.name;
    if (photoPreview && this.myProfile.photo) photoPreview.src = this.myProfile.photo;

    // Show my invite code
    const myCodeEl = document.getElementById('my-profile-invite-code');
    if (myCodeEl) myCodeEl.textContent = this.myInviteCode;
  }

  /* ── Toast ─────────────────────────────────────────────── */
  showToast(msg) {
    const old = document.getElementById('antika-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = 'antika-toast';
    t.className = 'antika-toast';
    t.textContent = msg;
    document.getElementById('app-viewport').appendChild(t);
    setTimeout(() => t.classList.add('show'), 50);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
  }

  /* ── Service Worker ────────────────────────────────────── */
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Antika SW:', reg.scope))
        .catch(err => console.log('SW:', err));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.antikaAppController = new AntikaAppController();
});
