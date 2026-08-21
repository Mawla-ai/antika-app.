/* Antika - Firebase Realtime Engine v2.0
   Architecture:
   - Each user has an inviteCode = their "mailbox" (they LISTEN here)
   - To SEND to partner: write to partner's channel (their invite code)
   - /channels/{inviteCode}/messages  ← incoming messages
   - /profiles/{inviteCode}           ← user profile
   - /channels/{inviteCode}/presence  ← online status
*/
class AntikaRealtimeEngine {
  constructor() {
    this.db = null;
    this.myChannelId = null;     // My invite code = where I receive
    this.partnerChannelId = null; // Partner's invite code = where I send
    this.myUserId = window.antikaMyUserId;
    this.messageListener = null;
    this.presenceListener = null;
    this.onMessageCallback = null;
    this.onPresenceCallback = null;
    this.lastTimestamp = Date.now();
    this.connected = false;

    this._init();
  }

  _init() {
    try {
      if (
        typeof ANTIKA_FIREBASE_CONFIG === 'undefined' ||
        ANTIKA_FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY'
      ) {
        console.warn('Antika: Firebase not configured → using BroadcastChannel only (same device)');
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(ANTIKA_FIREBASE_CONFIG);
      }
      this.db = firebase.database();
      this.connected = true;

      // Monitor connection state
      this.db.ref('.info/connected').on('value', (snap) => {
        const online = snap.val() === true;
        this._updateConnectionUI(online);
      });

      console.log('Antika: Firebase Realtime connected ✅');
    } catch (e) {
      console.warn('Antika: Firebase init failed:', e.message);
    }
  }

  isConnected() { return this.connected; }

  _updateConnectionUI(online) {
    const dot = document.getElementById('firebase-status-dot');
    const label = document.getElementById('firebase-status-label');
    if (dot) dot.style.background = online ? '#25d366' : '#ff477e';
    if (label) label.textContent = online ? 'متصل' : 'غير متصل';
  }

  /* ── Channel Setup ─────────────────────────────────────── */
  setupChannels(myChannelId, partnerChannelId) {
    this.myChannelId = myChannelId;
    this.partnerChannelId = partnerChannelId;

    if (!this.db) return;

    // Remove old listeners
    this._removeListeners();

    // Start listening on MY channel for incoming messages
    this.lastTimestamp = Date.now();
    const msgRef = this.db
      .ref(`channels/${myChannelId}/messages`)
      .orderByChild('timestamp')
      .startAt(this.lastTimestamp);

    this.messageListener = msgRef.on('child_added', (snap) => {
      const msg = snap.val();
      if (msg && msg.senderId !== this.myUserId && this.onMessageCallback) {
        this.onMessageCallback(msg);
      }
    });

    // Write online presence
    this._writePresence(myChannelId, true);

    // Watch partner's presence (on my channel's member list)
    if (partnerChannelId) {
      this._watchPartnerProfile(myChannelId);
    }
  }

  _writePresence(channelId, online) {
    if (!this.db || !channelId) return;
    const ref = this.db.ref(`channels/${channelId}/presence/${this.myUserId}`);
    ref.set({
      online,
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
      userId: this.myUserId
    });
    if (online) {
      ref.onDisconnect().update({
        online: false,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
      });
    }
  }

  _watchPartnerProfile(myChannelId) {
    if (!this.db) return;
    // Partner writes their profile to our channel's members
    this.db.ref(`channels/${myChannelId}/members`).on('child_added', (snap) => {
      const member = snap.val();
      if (member && member.userId !== this.myUserId) {
        // Partner announced themselves! Update their contact info
        if (window.antikaAppController) {
          window.antikaAppController.onPartnerProfileReceived(member);
        }
        // Now we know their channelId → set it
        if (member.channelId && member.channelId !== this.partnerChannelId) {
          this.partnerChannelId = member.channelId;
        }
      }
    });
  }

  /* ── Send Message ──────────────────────────────────────── */
  sendMessage(msgObj) {
    if (!this.db || !this.partnerChannelId) return false;

    // If media is very large (> 700KB base64), warn and skip
    const mediaSize = (msgObj.media || '').length;
    if (mediaSize > 700000) {
      console.warn('Antika: Media too large for Firebase, sending locally only');
      return false;
    }

    const payload = {
      ...msgObj,
      senderId: this.myUserId,
      senderChannel: this.myChannelId,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    // Remove blob URLs (can't sync)
    if (payload.media && payload.media.startsWith('blob:')) {
      delete payload.media;
      if (payload.type === 'voice') payload.text = '🎙️ رسالة صوتية (محلية فقط)';
      payload.type = 'text';
    }

    this.db.ref(`channels/${this.partnerChannelId}/messages`).push(payload);
    return true;
  }

  /* ── Write My Profile to Partner's Channel ──────────────── */
  announceToPartner(myProfile) {
    if (!this.db || !this.partnerChannelId) return;
    const ref = this.db.ref(`channels/${this.partnerChannelId}/members/${this.myUserId}`);
    ref.set({
      ...myProfile,
      userId: this.myUserId,
      channelId: this.myChannelId,
      joinedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  /* ── Profile sync ─────────────────────────────────────── */
  saveProfile(inviteCode, profile) {
    if (!this.db) return;
    this.db.ref(`profiles/${inviteCode}`).set({
      ...profile,
      userId: this.myUserId,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  loadProfile(inviteCode, callback) {
    if (!this.db) { callback(null); return; }
    this.db.ref(`profiles/${inviteCode}`).once('value', (snap) => {
      callback(snap.val());
    });
  }

  /* ── Callbacks ────────────────────────────────────────── */
  onMessage(cb) { this.onMessageCallback = cb; }
  onPresence(cb) { this.onPresenceCallback = cb; }

  _removeListeners() {
    if (this.db && this.myChannelId && this.messageListener) {
      this.db.ref(`channels/${this.myChannelId}/messages`).off('child_added', this.messageListener);
      this.messageListener = null;
    }
  }

  destroy() {
    this._removeListeners();
    if (this.db && this.myChannelId) {
      this._writePresence(this.myChannelId, false);
    }
  }
}

// ── Bootstrap ──────────────────────────────────────────────
window.antikaMyUserId = localStorage.getItem('antika_user_id');
if (!window.antikaMyUserId) {
  window.antikaMyUserId = 'u-' + Math.random().toString(36).substring(2, 10);
  localStorage.setItem('antika_user_id', window.antikaMyUserId);
}

// Initialize after DOM is ready and Firebase SDKs are loaded
document.addEventListener('DOMContentLoaded', () => {
  window.antikaRealtime = new AntikaRealtimeEngine();
});
