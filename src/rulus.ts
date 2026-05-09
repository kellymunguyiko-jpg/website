// Firebase Firestore rules for WebCraft.
// Copy FIREBASE_RULUS into Firebase Console > Firestore Database > Rules, then Publish.
// This file is for keeping the rules inside the project as a reusable reference.

export const FIREBASE_RULUS = String.raw`rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function userPath(uid) {
      return /databases/$(database)/documents/users/$(uid);
    }

    function userExists() {
      return signedIn() && exists(userPath(request.auth.uid));
    }

    function userData() {
      return get(userPath(request.auth.uid)).data;
    }

    function isActive() {
      return userExists() && userData().status == 'active';
    }

    function isManager() {
      return isActive() && userData().role == 'manager';
    }

    function isAdmin() {
      return isActive() && userData().role == 'admin';
    }

    function isManagerOrAdmin() {
      return isManager() || isAdmin();
    }

    function isOwner(uid) {
      return signedIn() && request.auth.uid == uid;
    }

    function isValidString(value, min, max) {
      return value is string && value.size() >= min && value.size() <= max;
    }

    function optionalString(value, max) {
      return value == null || (value is string && value.size() <= max);
    }

    // Manager is superadmin and can manage all app data.
    match /{document=**} {
      allow read, write: if isManager();
    }

    match /users/{userId} {
      // User signup creates a pending account.
      allow create: if isOwner(userId)
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.email == request.auth.token.email
        && request.resource.data.role == 'user'
        && request.resource.data.status == 'pending'
        && request.resource.data.keys().hasOnly([
          'uid', 'email', 'displayName', 'role', 'photoURL',
          'createdAt', 'emailVerified', 'status'
        ]);

      // Supports current frontend admin/manager role forms.
      // For production, move this bootstrap to Cloud Functions.
      allow create, update: if isOwner(userId)
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.email == request.auth.token.email
        && request.resource.data.role in ['admin', 'manager']
        && request.resource.data.status == 'active'
        && request.resource.data.keys().hasOnly([
          'uid', 'email', 'displayName', 'role', 'photoURL',
          'createdAt', 'emailVerified', 'status'
        ]);

      allow update: if isOwner(userId)
        && request.resource.data.role in ['admin', 'manager']
        && request.resource.data.status == 'active'
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'role', 'status', 'displayName', 'photoURL', 'emailVerified', 'createdAt'
        ]);

      allow read: if isOwner(userId) || isManagerOrAdmin();

      allow update: if isOwner(userId)
        && isActive()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'displayName', 'photoURL'
        ]);

      allow update: if isAdmin()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'status', 'role'
        ]);

      allow update: if isManager()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'status', 'role'
        ]);

      allow delete: if isManagerOrAdmin();
    }

    match /pendingUsers/{pendingId} {
      allow read, create, update, delete: if isManager();
    }

    match /projects/{projectId} {
      allow read: if true;

      allow create: if isManagerOrAdmin()
        && request.resource.data.createdBy == request.auth.uid
        && isValidString(request.resource.data.title, 2, 120)
        && optionalString(request.resource.data.desc, 500)
        && isValidString(request.resource.data.tag, 2, 80)
        && optionalString(request.resource.data.image, 2000000)
        && optionalString(request.resource.data.link, 700)
        && optionalString(request.resource.data.price, 40)
        && request.resource.data.placement in ['project', 'sale', 'both']
        && request.resource.data.keys().hasOnly([
          'title', 'desc', 'tag', 'image', 'link', 'price', 'placement', 'createdBy', 'createdAt'
        ]);

      allow update, delete: if isManagerOrAdmin();
    }

    match /buyWebsites/{websiteId} {
      allow read: if true;

      allow create: if isManagerOrAdmin()
        && request.resource.data.createdBy == request.auth.uid
        && isValidString(request.resource.data.title, 2, 120)
        && optionalString(request.resource.data.desc, 800)
        && isValidString(request.resource.data.category, 2, 80)
        && isValidString(request.resource.data.price, 1, 40)
        && optionalString(request.resource.data.image, 2000000)
        && optionalString(request.resource.data.link, 700)
        && request.resource.data.keys().hasOnly([
          'title', 'desc', 'category', 'price', 'image', 'link',
          'createdBy', 'createdAt'
        ]);

      allow update, delete: if isManagerOrAdmin();
    }

    match /contacts/{contactId} {
      allow create: if request.resource.data.status == 'new'
        && isValidString(request.resource.data.name, 2, 80)
        && isValidString(request.resource.data.email, 5, 120)
        && isValidString(request.resource.data.message, 2, 1000)
        && request.resource.data.keys().hasOnly([
          'name', 'email', 'message', 'status', 'createdAt'
        ]);

      allow read: if isManagerOrAdmin();

      allow update: if isManager()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'reply', 'status', 'repliedBy', 'repliedAt'
        ]);

      allow delete: if isAdmin();
    }

    match /notifications/{notificationId} {
      allow read: if isActive();

      allow create: if isManager()
        && request.resource.data.sentBy == request.auth.uid
        && isValidString(request.resource.data.message, 2, 500)
        && request.resource.data.keys().hasOnly([
          'message', 'sentBy', 'createdAt'
        ]);

      allow update, delete: if isManager();
    }

    match /youtubeAds/{adId} {
      allow read: if true;
      allow create: if isManager()
        && request.resource.data.createdBy == request.auth.uid
        && isValidString(request.resource.data.url, 8, 700)
        && isValidString(request.resource.data.videoId, 6, 80)
        && isValidString(request.resource.data.title, 1, 120)
        && optionalString(request.resource.data.thumbnail, 700)
        && request.resource.data.keys().hasOnly([
          'url', 'videoId', 'title', 'thumbnail', 'createdBy', 'createdAt'
        ]);
      allow update, delete: if isManager();
    }

    match /sites/{siteId} {
      allow read: if isManagerOrAdmin()
        || (isActive() && resource.data.ownerId == request.auth.uid);

      allow create: if isActive()
        && request.resource.data.ownerId == request.auth.uid
        && isValidString(request.resource.data.name, 1, 120)
        && optionalString(request.resource.data.description, 800)
        && optionalString(request.resource.data.image, 2000000)
        && optionalString(request.resource.data.ownerName, 120)
        && optionalString(request.resource.data.ownerEmail, 160)
        && request.resource.data.plan in ['free', 'premium', 'vip']
        && request.resource.data.status in ['active', 'paused']
        && request.resource.data.keys().hasOnly([
          'name', 'description', 'image', 'plan', 'status',
          'ownerId', 'ownerName', 'ownerEmail', 'hosted', 'createdAt'
        ]);

      allow update: if isAdmin()
        || (
          isActive()
          && resource.data.ownerId == request.auth.uid
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
            'name', 'description', 'image', 'plan', 'status', 'ownerName', 'ownerEmail', 'hosted'
          ])
        );

      allow delete: if isAdmin()
        || (isActive() && resource.data.ownerId == request.auth.uid);
    }

    match /inviteLinks/{linkId} {
      // Frontend admin passkey checker reads these keys.
      // For production, validate passkeys in a Cloud Function instead.
      allow read: if true;

      allow create: if isManager()
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.used == false
        && request.resource.data.role == 'admin'
        && request.resource.data.type == 'admin-passkey'
        && isValidString(request.resource.data.code, 8, 80)
        && request.resource.data.keys().hasOnly([
          'code', 'role', 'type', 'createdBy', 'createdAt', 'used'
        ]);

      allow update: if signedIn()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'used', 'usedBy', 'usedAt'
        ])
        && request.resource.data.used == true;

      allow delete: if isManager();
    }

    match /analytics/{docId} {
      allow read: if isActive() || isManagerOrAdmin();
      allow create, update, delete: if isManagerOrAdmin();
    }

    match /settings/{docId} {
      allow read: if true;
      allow write: if isManager();
    }
  }
}`;

export const FIREBASE_RULUS_NOTES = [
  'Paste FIREBASE_RULUS into Firebase Console > Firestore Database > Rules.',
  'Manager must have role: manager and status: active in /users/{uid}.',
  'Public users can read projects and buyWebsites without login.',
  'New signups are created as pending and need manager/admin confirmation.',
  'For production, move admin and manager passkey logic to Cloud Functions.',
] as const;

export default FIREBASE_RULUS;