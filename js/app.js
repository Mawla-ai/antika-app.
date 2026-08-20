/* Antika - WhatsApp-Style Home Screen & App Controller */
class AntikaAppController {
  constructor() {
    // Clock elements
    this.camouflageScreen = document.getElementById('camouflage-screen');
    this.clockTrigger = document.getElementById('aya-clock-trigger');
    this.digitalClock = document.getElementById('digital-clock');
    this.hourHand = document.getElementById('hour-hand');
    this.minuteHand = document.getElementById('minute-hand');
    this.secondHand = document.getElementById('second-hand');

    // Screens
    this.homeScreen = document.getElementById('whatsapp-home-screen');
    this.chatScreen = document.getElementById('whatsapp-chat-screen');

    // Passcode elements
    this.passcodeModal = document.getElementById('passcode-modal');
    this.passcodeTitle = document.getElementById('passcode-header-title');
    this.passcodeDesc = document.getElementById('passcode-header-desc');
    this.pinDotsContainer = document.getElementById('pin-dots-container');

    // Add Contact Modal
    this.addContactModal = document.getElementById('add-contact-modal');
    this.myInviteNumberDisplay = document.getElementById('my-invite-number');
    this.partnerNicknameInput = document.getElementById('partner-nickname-input');
    this.partnerInviteInput = document.getElementById('partner-invite-input');

    // Passcode state
    this.enteredPin = '';
    this.storedPin = localStorage.getItem('antika_passcode') || null;
    this.isSettingUpPin = !this.storedPin;

    // Long press state
    this.longPressTimer = null;
    this.longPressDuration = 800;
    this.clickCount = 0;
    this.clickResetTimer = null;

    // Data
    this.myInviteCode = this.getOrGenerateInviteCode();
    this.contacts = this.loadContacts();
    this.activeContactId = null;

    this.initClock();
    this.bindLongPressEvents();
    this.bindNumpadEvents();
    this.bindAddContactEvents();
    this.bindHomeScreenEvents();
    this.bindBackButton();
    this.bindSearchAndFilter();
    this.registerServiceWorker();
    this.loadActivePartnerName();
    this.renderChatList();
  }

  /* =========================================================
     1. Real-time Luxury Clock
     ========================================================= */
  initClock() {
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const millis = now.getMilliseconds();

      const secondDeg = ((seconds + millis / 1000) / 60) * 360;
      const minuteDeg = ((minutes + seconds / 60) / 60) * 360;
      const hourDeg = (((hours % 12) + minutes / 60) / 12) * 360;

      if (this.secondHand) this.secondHand.style.transform = `rotate(${secondDeg}deg)`;
      if (this.minuteHand) this.minuteHand.style.transform = `rotate(${minuteDeg}deg)`;
      if (this.hourHand) this.hourHand.style.transform = `rotate(${hourDeg}deg)`;

      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      const sStr = String(seconds).padStart(2, '0');
      if (this.digitalClock) this.digitalClock.textContent = `${hStr}:${mStr}:${sStr}`;

      requestAnimationFrame(updateClock);
    };
    requestAnimationFrame(updateClock);
  }

  /* =========================================================
     2. Camouflage Clock Long-Press Trigger
     ========================================================= */
  bindLongPressEvents() {
    const triggerUnlockModal = () => {
      if (navigator.vibrate) navigator.vibrate(80);
      this.openPasscodeModal();
    };

    const startPress = () => {
      if (this.longPressTimer) clearTimeout(this.longPressTimer);
      this.longPressTimer = setTimeout(() => triggerUnlockModal(), this.longPressDuration);
    };

    const cancelPress = () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    };

    if ('PointerEvent' in window) {
      this.clockTrigger.addEventListener('pointerdown', startPress);
      this.clockTrigger.addEventListener('pointerup', cancelPress);
      this.clockTrigger.addEventListener('pointercancel', cancelPress);
    } else {
      this.clockTrigger.addEventListener('touchstart', startPress, { passive: true });
      this.clockTrigger.addEventListener('touchend', cancelPress);
      this.clockTrigger.addEventListener('touchcancel', cancelPress);
      this.clockTrigger.addEventListener('mousedown', startPress);
      this.clockTrigger.addEventListener('mouseup', cancelPress);
    }

    this.clockTrigger.addEventListener('click', () => {
      this.clickCount++;
      clearTimeout(this.clickResetTimer);
      if (this.clickCount >= 3) {
        this.clickCount = 0;
        cancelPress();
        triggerUnlockModal();
      } else {
        this.clickResetTimer = setTimeout(() => { this.clickCount = 0; }, 800);
      }
    });
  }

  /* =========================================================
     3. Passcode Modal
     ========================================================= */
  openPasscodeModal() {
    this.enteredPin = '';
    this.updatePinDots();

    if (!this.storedPin) {
      this.isSettingUpPin = true;
      this.passcodeTitle.textContent = 'تعيين رمز الدخول أول مرة';
      this.passcodeDesc.textContent = 'أنشئ رمز دخول سري مكون من 4 أرقام لفتح التطبيق';
    } else {
      this.isSettingUpPin = false;
      this.passcodeTitle.textContent = 'أدخل رمز الدخول';
      this.passcodeDesc.textContent = 'ادخل الباسورد الخاص بك لدخول التطبيق';
    }

    this.passcodeModal.classList.add('active');
  }

  bindNumpadEvents() {
    document.querySelectorAll('.num-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleNumpadInput(btn.getAttribute('data-val')));
    });
  }

  handleNumpadInput(val) {
    if (val === 'clear') {
      this.enteredPin = this.enteredPin.slice(0, -1);
    } else if (val === 'enter') {
      this.submitPin();
    } else if (this.enteredPin.length < 4) {
      this.enteredPin += val;
    }
    this.updatePinDots();
    if (this.enteredPin.length === 4) setTimeout(() => this.submitPin(), 250);
  }

  updatePinDots() {
    this.pinDotsContainer.querySelectorAll('.dot').forEach((dot, idx) => {
      dot.classList.toggle('filled', idx < this.enteredPin.length);
    });
  }

  submitPin() {
    if (this.enteredPin.length < 4) return;

    if (this.isSettingUpPin) {
      this.storedPin = this.enteredPin;
      localStorage.setItem('antika_passcode', this.storedPin);
      this.passcodeModal.classList.remove('active');
      this.unlockAppShell();
    } else {
      if (this.enteredPin === this.storedPin) {
        this.passcodeModal.classList.remove('active');
        this.unlockAppShell();
      } else {
        this.passcodeTitle.textContent = 'رمز خاطئ، حاول مجدداً';
        this.passcodeTitle.style.color = 'var(--accent-rose)';
        this.enteredPin = '';
        this.updatePinDots();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setTimeout(() => {
          this.passcodeTitle.style.color = 'var(--accent-gold)';
          this.passcodeTitle.textContent = 'أدخل رمز الدخول';
        }, 1500);
      }
    }
  }

  unlockAppShell() {
    this.camouflageScreen.classList.add('hidden');
  }

  /* =========================================================
     4. Data: Contacts & Invite Codes
     ========================================================= */
  getOrGenerateInviteCode() {
    let code = localStorage.getItem('antika_my_invite_code');
    if (!code) {
      code = 'ANT-' + Math.floor(100000 + Math.random() * 900000);
      localStorage.setItem('antika_my_invite_code', code);
    }
    return code;
  }

  regenerateInviteCode() {
    const usedCodes = JSON.parse(localStorage.getItem('antika_used_codes') || '[]');
    usedCodes.push(this.myInviteCode);
    localStorage.setItem('antika_used_codes', JSON.stringify(usedCodes));
    this.myInviteCode = 'ANT-' + Math.floor(100000 + Math.random() * 900000);
    localStorage.setItem('antika_my_invite_code', this.myInviteCode);
    if (this.myInviteNumberDisplay) this.myInviteNumberDisplay.textContent = this.myInviteCode;
  }

  loadContacts() {
    return JSON.parse(localStorage.getItem('antika_contacts_list') || '[]');
  }

  saveContacts() {
    localStorage.setItem('antika_contacts_list', JSON.stringify(this.contacts));
  }

  loadActivePartnerName() {
    const savedName = localStorage.getItem('antika_partner_name');
    if (savedName) {
      const el1 = document.getElementById('active-partner-name');
      const el2 = document.getElementById('call-partner-display-name');
      if (el1) el1.textContent = savedName;
      if (el2) el2.textContent = savedName;
    }
  }

  /* =========================================================
     5. WhatsApp Home Screen: Chat List Rendering
     ========================================================= */
  renderChatList(filterFn = null) {
    const container = document.getElementById('wa-chats-list-container');
    if (!container) return;
    container.innerHTML = '';

    const list = filterFn ? this.contacts.filter(filterFn) : this.contacts;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="wa-empty-state">
          <i class="fa-solid fa-heart" style="font-size: 3rem; color: var(--accent-gold); opacity: 0.5; margin-bottom: 14px;"></i>
          <p style="font-size: 0.95rem; color: var(--text-muted); text-align: center; max-width: 240px; line-height: 1.6;">
            لا توجد محادثات بعد.<br>اضغط على <strong style="color: var(--accent-green);">+</strong> لإضافة شريكك والبدء.
          </p>
        </div>`;
      return;
    }

    list.forEach(contact => {
      const row = document.createElement('div');
      row.className = 'wa-chat-row';
      row.setAttribute('data-contact-id', contact.id);

      const now = new Date();
      const timeStr = contact.lastTime || `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'م' : 'ص'}`;

      row.innerHTML = `
        <div class="wa-chat-row-left">
          <img class="wa-avatar" src="${contact.avatar || 'assets/logo_192.png'}" alt="${contact.name}">
          <div class="wa-chat-details">
            <h4>${contact.name}</h4>
            <div class="wa-chat-preview">
              <i class="fa-solid fa-check-double" style="color: var(--accent-cyan); font-size: 0.7rem;"></i>
              ${contact.lastMsg || 'تم الاقتران بنجاح ❤️'}
            </div>
          </div>
        </div>
        <div class="wa-chat-meta">
          <span class="wa-time">${timeStr}</span>
          ${contact.unread ? `<span class="wa-badge">${contact.unread}</span>` : ''}
        </div>
      `;

      row.addEventListener('click', () => this.openChat(contact));
      container.appendChild(row);
    });
  }

  openChat(contact) {
    this.activeContactId = contact.id;

    // Update chat header with partner name
    const nameEl = document.getElementById('active-partner-name');
    const callNameEl = document.getElementById('call-partner-display-name');
    if (nameEl) nameEl.textContent = contact.name;
    if (callNameEl) callNameEl.textContent = contact.name;

    // Navigate to chat screen with slide animation
    this.homeScreen.classList.remove('active');
    this.chatScreen.classList.add('active');
    this.chatScreen.classList.add('slide-in');
    setTimeout(() => this.chatScreen.classList.remove('slide-in'), 350);

    // Reset unread count on open
    contact.unread = 0;
    this.saveContacts();
  }

  /* =========================================================
     6. Home Screen Events: FAB, Filter Pills, Search
     ========================================================= */
  bindHomeScreenEvents() {
    const fabBtn = document.getElementById('wa-fab-add-btn');
    if (fabBtn) {
      fabBtn.addEventListener('click', () => {
        if (this.myInviteNumberDisplay) this.myInviteNumberDisplay.textContent = this.myInviteCode;
        if (this.partnerNicknameInput) this.partnerNicknameInput.value = '';
        if (this.partnerInviteInput) this.partnerInviteInput.value = '';
        this.addContactModal.classList.add('active');
      });
    }
  }

  bindBackButton() {
    const backBtn = document.getElementById('back-to-home-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.chatScreen.classList.remove('active');
        this.homeScreen.classList.add('active');
        this.renderChatList(); // Refresh last message & time
      });
    }
  }

  bindSearchAndFilter() {
    const searchInput = document.getElementById('wa-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        if (!q) {
          this.renderChatList();
        } else {
          this.renderChatList(c => c.name.toLowerCase().includes(q) || (c.lastMsg || '').toLowerCase().includes(q));
        }
      });
    }

    document.querySelectorAll('.wa-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.wa-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const filter = pill.getAttribute('data-filter');
        if (filter === 'all') this.renderChatList();
        else if (filter === 'unread') this.renderChatList(c => c.unread > 0);
        else if (filter === 'fav') this.renderChatList(c => c.fav);
        else if (filter === 'private') this.renderChatList(); // All in private app
      });
    });
  }

  /* =========================================================
     7. Add Contact & Partner Pairing
     ========================================================= */
  bindAddContactEvents() {
    const closeBtn = document.getElementById('close-add-contact-modal-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.addContactModal.classList.remove('active'));

    const shareBtn = document.getElementById('share-my-invite-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const text = `دعوة اقتران خاصة على تطبيق Antika ❤️\nرقم الدعوة المخصص لك: ${this.myInviteCode}\nأضف هذا الرقم في التطبيق للاقتران الآمن.`;
        if (navigator.share) {
          navigator.share({ title: 'دعوة Antika', text });
        } else {
          navigator.clipboard.writeText(text).then(() => {
            shareBtn.innerHTML = '<i class="fa-solid fa-check"></i> تم نسخ رقم الدعوة!';
            setTimeout(() => {
              shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes" style="margin-left:8px;"></i> إرسال رقمك كدعوة لشريكك';
            }, 2000);
          });
        }
      });
    }

    const confirmBtn = document.getElementById('confirm-add-partner-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const enteredCode = (this.partnerInviteInput?.value || '').trim().toUpperCase();
        const customName = (this.partnerNicknameInput?.value || '').trim();
        const partnerName = customName || `الشريك (${enteredCode.slice(4, 8) || '❤️'})`;

        if (!enteredCode) { alert('يرجى كتابة رقم دعوة الشريك أولاً'); return; }

        const usedCodes = JSON.parse(localStorage.getItem('antika_used_codes') || '[]');
        if (usedCodes.includes(enteredCode)) {
          alert('هذا الرقم مستخدم سابقاً وغير صالح. يرجى طلب رقم دعوة جديد من الشريك.');
          return;
        }

        const now = new Date();
        const timeStr = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'م' : 'ص'}`;

        const newContact = {
          id: 'c-' + Date.now(),
          name: partnerName,
          code: enteredCode,
          avatar: 'assets/logo_192.png',
          status: 'مقترن | آمن',
          lastMsg: 'تم الاقتران بنجاح! ابدآ المحادثة ❤️',
          lastTime: timeStr,
          unread: 0,
          fav: true
        };

        this.contacts.unshift(newContact);
        this.saveContacts();
        localStorage.setItem('antika_partner_name', partnerName);
        this.regenerateInviteCode();
        this.addContactModal.classList.remove('active');
        this.renderChatList();

        // Auto-open chat with newly added partner
        setTimeout(() => this.openChat(newContact), 300);
      });
    }

    // Also open add contact from chat header button
    const openAddBtn = document.getElementById('open-add-contact-btn');
    if (openAddBtn) {
      openAddBtn.addEventListener('click', () => {
        if (this.myInviteNumberDisplay) this.myInviteNumberDisplay.textContent = this.myInviteCode;
        if (this.partnerNicknameInput) this.partnerNicknameInput.value = '';
        if (this.partnerInviteInput) this.partnerInviteInput.value = '';
        this.addContactModal.classList.add('active');
      });
    }
  }

  /* =========================================================
     8. Service Worker
     ========================================================= */
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Antika SW Registered:', reg.scope))
        .catch(err => console.log('SW note:', err));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.antikaAppController = new AntikaAppController();
});
