/* Antika - Disguised Notification Engine */
class DisguisedNotificationManager {
  constructor() {
    this.hasPermission = false;
    this.init();
  }

  async init() {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        this.hasPermission = true;
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        this.hasPermission = (permission === 'granted');
      }
    }
  }

  /**
   * Send a completely disguised notification to protect privacy
   * Disguises chat messages as generic system alarms: "لديك تنبيه"
   */
  sendDisguisedNotification() {
    if (!this.hasPermission && 'Notification' in window) {
      Notification.requestPermission().then(p => {
        if (p === 'granted') this._dispatchAlert();
      });
    } else {
      this._dispatchAlert();
    }
  }

  _dispatchAlert() {
    if (!('Notification' in window)) return;

    try {
      const options = {
        body: 'تنبيه جديد من النظام',
        icon: 'assets/logo.jpg',
        badge: 'assets/logo.jpg',
        tag: 'system-alarm-' + Date.now(),
        silent: false,
        vibrate: [200, 100, 200]
      };

      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification('لديك تنبيه', options);
        });
      } else {
        new Notification('لديك تنبيه', options);
      }
    } catch (e) {
      console.log('Notification dispatch note:', e);
    }
  }
}

window.notificationManager = new DisguisedNotificationManager();
