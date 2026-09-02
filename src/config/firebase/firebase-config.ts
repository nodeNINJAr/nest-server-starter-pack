import * as admin from 'firebase-admin';

// Firebase push notifications are optional — don't crash the whole app at
// boot if FIREBASE_SERVICE_ACCOUNT isn't configured. FirebaseService checks
// `isFirebaseConfigured` and fails loudly only when a push is actually sent.
export const isFirebaseConfigured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);

if (isFirebaseConfigured) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT as string,
  ) as admin.ServiceAccount;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
