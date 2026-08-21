/* Antika - Firebase Realtime & WebRTC Signaling Engine v3.0
   - Multi-device real-time messaging with Base64 audio & images
   - Live WebRTC Call Signaling (Ring, Offer, Answer, ICE, Hangup)
   - Real-time profile & presence synchronization
*/
class AntikaRealtimeEngine {
  constructor() {
    this.db = null;
    this.myChannelId = null;
    this.partnerChannelId = null;
    this.myUserId = window.antikaMyUserId;

    this.messageListener = null;
    this.callSignalListener = null;
    this.partnerProfileListener = null;

    this.onMessageCallback = null;
    this.onCallSignalCallback = null;
    this.onPresenceCallback = null;
    this.lastTimestamp = Date.now() - 5000;
    this.connected = false;

    this._init();
  }

  _init() {
    try {
      if (
        typeof ANTIKA_FIREBASE_CONFIG === 'undefined' ||
        !ANTIKA_FIREBASE_CONFIG.apiKey ||
        ANTIKA_FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY'
      ) {
        console.warn('Antika: Firebase not configured. Using local fallback.');
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

      console.log('Antika: Firebase Realtime initialized ✅');
    } catch (e) {
      console.warn('Antika: Firebase init failed:', e.message);
    }
  }

  isConnected() { return this.connected && !!this.db; }

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

    if (!this.db || !myChannelId) return;

    this._removeListeners();

    // 1. Listen for incoming messages on MY channel
    this.lastTimestamp = Date.now() - 2000;
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

    // 2. Listen for incoming call signals on MY channel
    const callRef = this.db.ref(`channels/${myChannelId}/call_signals`);
    this.callSignalListener = callRef.on('child_added', (snap) => {
      const signal = snap.val();
      if (signal && signal.senderId !== this.myUserId && this.onCallSignalCallback) {
        this.onCallSignalCallback(signal);
      }
      // Remove signal after processing to keep channel clean
      snap.ref.remove().catch(() => {});
    });

    // 3. Announce and track online presence
    this._writePresence(myChannelId, true);

    // 4. Watch partner's profile in real time
    if (partnerChannelId) {
      this.watchPartnerProfile(partnerChannelId);
    }
  }

  /* ── Send Message ──────────────────────────────────────── */
  sendMessage(msgObj) {
    if (!this.db || !this.partnerChannelId) return false;

    const payload = {
      ...msgObj,
      senderId: this.myUserId,
      senderChannel: this.myChannelId,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    this.db.ref(`channels/${this.partnerChannelId}/messages`).push(payload);
    return true;
  }

  /* ── WebRTC Call Signaling ─────────────────────────────── */
  sendCallSignal(targetChannel, signalData) {
    if (!this.db || !targetChannel) return false;
    const payload = {
      ...signalData,
      senderId: this.myUserId,
      senderChannel: this.myChannelId,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    this.db.ref(`channels/${targetChannel}/call_signals`).push(payload);
    return true;
  }

  /* ── Profile System ────────────────────────────────────── */
  saveProfile(inviteCode, profile) {
    if (!this.db || !inviteCode) return;
    this.db.ref(`profiles/${inviteCode}`).set({
      ...profile,
      userId: this.myUserId,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  watchPartnerProfile(partnerCode) {
    if (!this.db || !partnerCode) return;
    if (this.partnerProfileListener) {
      this.db.ref(`profiles/${this.partnerChannelId}`).off('value', this.partnerProfileListener);
    }
    this.partnerProfileListener = this.db.ref(`profiles/${partnerCode}`).on('value', (snap) => {
      const profile = snap.val();
      if (profile && window.antikaAppController) {
        window.antikaAppController.onPartnerProfileReceived(profile, partnerCode);
      }
    });
  }

  loadProfile(inviteCode, callback) {
    if (!this.db) { callback(null); return; }
    this.db.ref(`profiles/${inviteCode}`).once('value', (snap) => {
      callback(snap.val());
    });
  }

  /* ── Online Presence ───────────────────────────────────── */
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

  /* ── Callbacks ────────────────────────────────────────── */
  onMessage(cb) { this.onMessageCallback = cb; }
  onCallSignal(cb) { this.onCallSignalCallback = cb; }
  onPresence(cb) { this.onPresenceCallback = cb; }

  _removeListeners() {
    if (this.db && this.myChannelId) {
      if (this.messageListener) {
        this.db.ref(`channels/${this.myChannelId}/messages`).off('child_added', this.messageListener);
        this.messageListener = null;
      }
      if (this.callSignalListener) {
        this.db.ref(`channels/${this.myChannelId}/call_signals`).off('child_added', this.callSignalListener);
        this.callSignalListener = null;
      }
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

document.addEventListener('DOMContentLoaded', () => {
  window.antikaRealtime = new AntikaRealtimeEngine();
});
