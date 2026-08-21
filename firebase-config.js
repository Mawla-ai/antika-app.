// ================================================================
// ANTIKA - Firebase Configuration
// ================================================================
// خطوات إعداد Firebase (مرة واحدة فقط - 5 دقائق):
// 1. اذهب إلى https://console.firebase.google.com
// 2. أنشئ مشروعاً جديداً (اختر اسماً مثل "antika-app")
// 3. من القائمة الجانبية → Realtime Database → Create Database
//    اختر "Start in test mode"
// 4. اذهب إلى Project Settings (⚙️) → Your apps → Add web app (</>)
// 5. انسخ الـ config وضعه هنا بدل القيم الموجودة
// ================================================================

const ANTIKA_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR-PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR-PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR-PROJECT-ID",
  storageBucket: "YOUR-PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ================================================================
// Firebase Database Rules (ضع هذه القواعد في Firebase Console):
// ================================================================
// {
//   "rules": {
//     "channels": {
//       "$channelId": {
//         ".read": true,
//         ".write": true
//       }
//     },
//     "profiles": {
//       ".read": true,
//       ".write": true
//     }
//   }
// }
// ================================================================
