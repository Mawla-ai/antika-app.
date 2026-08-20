/* Antika - Main Application, Tab Navigation & Single-Use Contacts Controller */
class AntikaAppController {
  constructor() {
    this.camouflageScreen = document.getElementById('camouflage-screen');
    this.clockTrigger = document.getElementById('aya-clock-trigger');
    this.digitalClock = document.getElementById('digital-clock');
    this.hourHand = document.getElementById('hour-hand');
    this.minuteHand = document.getElementById('minute-hand');
    this.secondHand = document.getElementById('second-hand');

    // Passcode Modal Elements
    this.passcodeModal = document.getElementById('passcode-modal');
    this.passcodeTitle = document.getElementById('passcode-header-title');
    this.passcodeDesc = document.getElementById('passcode-header-desc');
    this.pinDotsContainer = document.getElementById('pin-dots-container');

    // Tab Navigation & Views
    this.tabChatBtn = document.getElementById('tab-chat-btn');
    this.tabContactsBtn = document.getElementById('tab-contacts-btn');
    this.chatViewSection = document.getElementById('chat-view-section');
    this.contactsViewSection = document.getElementById('contacts-view-section');
    this.contactsListContainer = document.getElementById('contacts-list-container');

    // Add Contact / Single-Use Invite Code Modal Elements
    this.addContactModal = document.getElementById('add-contact-modal');
    this.fabAddContactBtn = document.getElementById('fab-add-contact-btn');
    this.openAddContactHeaderBtn = document.getElementById('open-add-contact-btn');
    this.closeAddContactModalBtn = document.getElementById('close-add-contact-modal-btn');
    this.shareMyInviteBtn = document.getElementById('share-my-invite-btn');
    this.myInviteNumberDisplay = document.getElementById('my-invite-number');
    this.partnerInviteInput = document.getElementById('partner-invite-input');
    this.confirmAddPartnerBtn = document.getElementById('confirm-add-partner-btn');

    this.enteredPin = '';
    this.storedPin = localStorage.getItem('antika_passcode') || null;
    this.isSettingUpPin = !this.storedPin;

    this.longPressTimer = null;
    this.longPressDuration = 1500; // 1.5 seconds

    // Contacts Storage
    this.myInviteCode = this.getOrGenerateInviteCode();
    this.contacts = this.loadContacts();

    this.initClock();
    this.bindLongPressEvents();
    this.bindNumpadEvents();
    this.bindTabNavigation();
    this.bindAddContactEvents();
    this.renderContactsList();
    this.registerServiceWorker();
  }

  /* 1. Real-time Luxury Clock */
  initClock() {
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();

      const secondDeg = (seconds / 60) * 360;
      const minuteDeg = ((minutes + seconds / 60) / 60) * 360;
      const hourDeg = (((hours % 12) + minutes / 60) / 12) * 360;

      if (this.secondHand) this.secondHand.style.transform = `rotate(${secondDeg}deg)`;
      if (this.minuteHand) this.minuteHand.style.transform = `rotate(${minuteDeg}deg)`;
      if (this.hourHand) this.hourHand.style.transform = `rotate(${hourDeg}deg)`;

      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      const sStr = String(seconds).padStart(2, '0');
      if (this.digitalClock) this.digitalClock.textContent = `${hStr}:${mStr}:${sStr}`;
    };

    updateClock();
    setInterval(updateClock, 1000);
  }

  /* 2. Camouflage Clock Long-Press Trigger */
  bindLongPressEvents() {
    const startPress = (e) => {
      e.preventDefault();
      this.longPressTimer = setTimeout(() => {
        this.openPasscodeModal();
      }, this.longPressDuration);
    };

    const cancelPress = () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    };

    this.clockTrigger.addEventListener('mousedown', startPress);
    this.clockTrigger.addEventListener('mouseup', cancelPress);
    this.clockTrigger.addEventListener('mouseleave', cancelPress);

    this.clockTrigger.addEventListener('touchstart', startPress, { passive: false });
    this.clockTrigger.addEventListener('touchend', cancelPress);
    this.clockTrigger.addEventListener('touchcancel', cancelPress);
  }

  /* 3. Passcode Setup & Verification Modal */
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
    const numBtns = document.querySelectorAll('.num-btn');
    numBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        this.handleNumpadInput(val);
      });
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

    if (this.enteredPin.length === 4) {
      setTimeout(() => this.submitPin(), 250);
    }
  }

  updatePinDots() {
    const dots = this.pinDotsContainer.querySelectorAll('.dot');
    dots.forEach((dot, idx) => {
      if (idx < this.enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
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

  /* 4. WhatsApp Style Tab Navigation */
  bindTabNavigation() {
    this.tabChatBtn.addEventListener('click', () => {
      this.switchTab('chat');
    });

    this.tabContactsBtn.addEventListener('click', () => {
      this.switchTab('contacts');
    });
  }

  switchTab(tabName) {
    if (tabName === 'chat') {
      this.tabChatBtn.classList.add('active');
      this.tabContactsBtn.classList.remove('active');
      this.chatViewSection.classList.add('active');
      this.contactsViewSection.classList.remove('active');
    } else {
      this.tabContactsBtn.classList.add('active');
      this.tabChatBtn.classList.remove('active');
      this.contactsViewSection.classList.add('active');
      this.chatViewSection.classList.remove('active');
    }
  }

  /* 5. Single-Use Exclusive Invite Code & Contacts Engine */
  getOrGenerateInviteCode() {
    let code = localStorage.getItem('antika_my_invite_code');
    if (!code) {
      code = 'ANT-' + Math.floor(100000 + Math.random() * 900000);
      localStorage.setItem('antika_my_invite_code', code);
    }
    return code;
  }

  regenerateInviteCode() {
    // Record old used code to prevent reuse by anyone
    const usedCodes = JSON.parse(localStorage.getItem('antika_used_codes') || '[]');
    usedCodes.push(this.myInviteCode);
    localStorage.setItem('antika_used_codes', JSON.stringify(usedCodes));

    // Generate brand new unique invite code
    this.myInviteCode = 'ANT-' + Math.floor(100000 + Math.random() * 900000);
    localStorage.setItem('antika_my_invite_code', this.myInviteCode);
    this.myInviteNumberDisplay.textContent = this.myInviteCode;
  }

  loadContacts() {
    const saved = localStorage.getItem('antika_contacts_list');
    if (saved) return JSON.parse(saved);

    // Default partner contact
    return [
      {
        id: 'c1',
        name: 'روحي ❤️',
        code: 'ANT-849201',
        avatar: 'assets/logo.jpg',
        status: 'قريبان بالقلب | متصل',
        lastMsg: 'أنت دائماً في بالي وفي قلبي ✨'
      }
    ];
  }

  saveContacts() {
    localStorage.setItem('antika_contacts_list', JSON.stringify(this.contacts));
    this.renderContactsList();
  }

  bindAddContactEvents() {
    const openModal = () => {
      this.myInviteNumberDisplay.textContent = this.myInviteCode;
      this.partnerInviteInput.value = '';
      this.addContactModal.classList.add('active');
    };

    if (this.fabAddContactBtn) this.fabAddContactBtn.addEventListener('click', openModal);
    if (this.openAddContactHeaderBtn) this.openAddContactHeaderBtn.addEventListener('click', openModal);

    if (this.closeAddContactModalBtn) {
      this.closeAddContactModalBtn.addEventListener('click', () => {
        this.addContactModal.classList.remove('active');
      });
    }

    if (this.shareMyInviteBtn) {
      this.shareMyInviteBtn.addEventListener('click', () => {
        const text = `دعوة اقتران خاصة على تطبيق Antika ❤️\nرقم الدعوة المخصص لك: ${this.myInviteCode}\nحمل التطبيق واضف هذا الرقم للاقتران الآمن.`;
        if (navigator.share) {
          navigator.share({ title: 'دعوة Antika', text: text });
        } else {
          navigator.clipboard.writeText(text).then(() => {
            this.shareMyInviteBtn.innerHTML = '<i class="fa-solid fa-check"></i> تم نسخ رقم الدعوة!';
            setTimeout(() => {
              this.shareMyInviteBtn.innerHTML = '<i class="fa-solid fa-share-nodes" style="margin-left: 8px;"></i> إرسال رقمك كدعوة لشريكك';
            }, 2000);
          });
        }
      });
    }

    if (this.confirmAddPartnerBtn) {
      this.confirmAddPartnerBtn.addEventListener('click', () => {
        const enteredCode = this.partnerInviteInput.value.trim().toUpperCase();
        if (!enteredCode) {
          alert('يرجى كتابة رقم دعوة الشريك أولاً');
          return;
        }

        // Check if code was already used
        const usedCodes = JSON.parse(localStorage.getItem('antika_used_codes') || '[]');
        if (usedCodes.includes(enteredCode)) {
          alert('هذا الرقم مستخدم سابقاً وغير صالح. يرجى طلب رقم دعوة جديد من الشريك.');
          return;
        }

        // Add partner contact
        const newContact = {
          id: 'c-' + Date.now(),
          name: 'الشريك المقترن (' + enteredCode.substring(4, 8) + ') ❤️',
          code: enteredCode,
          avatar: 'assets/logo.jpg',
          status: 'مقترن حديثاً | آمن',
          lastMsg: 'تم الاقتران بنجاح! يمكنكم التواصل الآن بحرية.'
        };

        this.contacts.unshift(newContact);
        this.saveContacts();

        // Single-Use Rule: Regenerate your invite code so no one else can reuse the previous one
        this.regenerateInviteCode();

        this.addContactModal.classList.remove('active');
        this.switchTab('chat');
        document.getElementById('active-partner-name').textContent = newContact.name;

        if (window.antikaChatEngine) {
          window.antikaChatEngine.renderSystemMessage(`✨ تم الاقتران بنجاح مع الشريك برقم الدعوة المخصص (${enteredCode})! تم تحديث وتجديد رقمك لضمان عدم إعادة استخدامه.`);
        }
      });
    }
  }

  renderContactsList() {
    if (!this.contactsListContainer) return;
    this.contactsListContainer.innerHTML = '';

    this.contacts.forEach(contact => {
      const card = document.createElement('div');
      card.className = 'contact-card';
      card.innerHTML = `
        <div class="contact-card-info">
          <img src="${contact.avatar}" class="contact-avatar">
          <div class="contact-details">
            <h4>${contact.name}</h4>
            <span class="contact-code-badge">${contact.code}</span>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 4px;">${contact.lastMsg}</div>
          </div>
        </div>
        <div class="contact-status-online" title="متصل"></div>
      `;

      card.addEventListener('click', () => {
        document.getElementById('active-partner-name').textContent = contact.name;
        this.switchTab('chat');
      });

      this.contactsListContainer.appendChild(card);
    });
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Antika Service Worker Registered:', reg.scope))
        .catch(err => console.log('SW registration note:', err));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.antikaAppController = new AntikaAppController();
});
