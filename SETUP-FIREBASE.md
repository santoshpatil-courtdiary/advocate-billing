# Putting the billing system online — step by step

This takes about twenty minutes, once. After it, the office records live in your own Google Firebase project: you sign in on the office computer, the laptop or the phone and see the same clients, bills, receipts and ledgers, updating live. It keeps working when the internet is down and syncs when the line returns.

Everything used here is on Firebase's free **Spark** plan. No card is needed, and an advocate's office will not come anywhere near the free limits.

---

## What you need

- A Google account
- The files from this package
- A GitHub account, if the site is to be published on GitHub Pages

---

## Step 1 — Create the Firebase project

1. Open **https://console.firebase.google.com** and sign in with your Google account.
2. Click **Create a project** (or *Add project*).
3. Project name: `advocate-billing`. Click **Continue**.
4. Google Analytics is not needed. Switch it **off** and click **Create project**.
5. Wait for it to finish, then click **Continue**.

## Step 2 — Register the web app and copy the configuration

1. On the project home page, click the **web icon** `</>` (*Add app → Web*).
2. App nickname: `Billing`. Leave *Also set up Firebase Hosting* **unticked**. Click **Register app**.
3. A block of code appears containing `const firebaseConfig = { apiKey: "...", ... }`. Keep this screen open.
4. Open the file **`js/firebase-config.js`** from this package in Notepad or any text editor.
5. Copy each value from the console into the matching line, keeping the quotation marks. It should end up looking like this, with your own values:

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyB-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "advocate-billing-1a2b3.firebaseapp.com",
  projectId: "advocate-billing-1a2b3",
  storageBucket: "advocate-billing-1a2b3.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
window.OFFICE_ID = "";
```

6. Save the file. Click **Continue to console**.

These values are not a password. A web Firebase configuration is meant to be visible; the records are protected by the sign-in in Step 3 and the rules in Step 5.

## Step 3 — Switch on sign-in

1. In the left menu click **Build → Authentication**, then **Get started**.
2. Under *Sign-in method*, click **Email/Password**.
3. Turn on the **first** switch (Email/Password). Leave *Email link* off. Click **Save**.

## Step 4 — Create your own login

1. Go to the **Users** tab in Authentication and click **Add user**.
2. Enter the email address you will sign in with and a password you will remember. Click **Add user**.
3. The user now appears in the list with a **User UID** that looks like `kJ3n...`. Copy that UID and keep it; Step 5 can use it.

Creating the account here, rather than letting the app register people, means nobody else can make an account on your project.

## Step 5 — Create the database and lock it down

1. Left menu: **Build → Firestore Database**, then **Create database**.
2. Choose **Start in production mode**, click Next.
3. Location: choose **asia-south1 (Mumbai)**. This cannot be changed later. Click **Enable**.
4. When the database opens, go to the **Rules** tab, delete everything in the box and paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Each signed-in account can read and write only its own office records.
    match /offices/{officeId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == officeId;
    }

  }
}
```

5. Click **Publish**.

Only a signed-in account can touch the records, and only its own. Anyone who finds the web address sees nothing but a sign-in screen.

## Step 6 — Put the files on GitHub

1. On **https://github.com**, click **New repository**. Name it `advocate-billing`, keep it **Public** (GitHub Pages needs public on a free account), and create it.
2. On the repository page click **Add file → Upload files**.
3. Drag in **everything** from this package, keeping the folders: `index.html`, the `css`, `js` and `assets` folders, `.nojekyll`, and the markdown files. Make sure the edited `js/firebase-config.js` is the one being uploaded.
4. Click **Commit changes**.

## Step 7 — Publish the site

1. In the repository, go to **Settings → Pages**.
2. *Source*: **Deploy from a branch**. Branch: **main**, folder: **/ (root)**. Click **Save**.
3. Wait a minute and refresh. The address appears at the top, in the form `https://<your-username>.github.io/advocate-billing/`.

## Step 8 — Tell Firebase to trust that address

1. Back in the Firebase console: **Authentication → Settings → Authorised domains**.
2. Click **Add domain** and enter just the host part, `your-username.github.io`, without `https://` and without the folder.
3. Click **Add**.

Skipping this gives the error *this web address is not in the Firebase list of authorised domains* when you try to sign in.

## Step 9 — First sign-in

1. Open the GitHub Pages address.
2. The sign-in screen appears. Enter the email and password from Step 4.
3. The dashboard opens and the badge in the top bar reads **Synced**.
4. Go to **Settings**, check the letterhead details, and click **Save settings**. This writes the letterhead to the project so every device picks it up.
5. If you had already entered clients or bills on this device before setting up Firebase, open **Settings → Storage**; a button offers to upload those records. Click it once.

## Step 10 — Use it on the phone and the other computers

1. Open the same address on the phone, sign in with the same email and password.
2. In Chrome, use the menu and **Add to Home screen** so it opens like an app.
3. Enter a test client on one device and watch it appear on the other within a second or two.
4. Switch the phone to flight mode, add a receipt, switch the internet back on; the badge moves from *Offline — saved here, will sync* to *Synced* on its own.

## Step 11 — Optional: letting an assistant use the same records

By default each account has its own separate set of records. To let a junior or a clerk work on **the same** office records:

1. Create a second user in **Authentication → Users** and copy that User UID as well.
2. In `js/firebase-config.js` set a fixed office name on every device, for example:

```js
window.OFFICE_ID = "skp-office";
```

3. In **Firestore → Rules**, replace the rules with this, putting both UIDs in the list:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /offices/{officeId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid in [
        "PASTE_YOUR_UID_HERE",
        "PASTE_ASSISTANT_UID_HERE"
      ];
    }

  }
}
```

4. Publish, upload the edited `firebase-config.js` to GitHub, and both of you will see one shared set of records.

If you change `OFFICE_ID` after records already exist, take a **Backup** first, change it, sign in, then **Restore** the backup so the records move into the shared space.

---

## What it costs

The free Spark plan allows 50,000 document reads, 20,000 writes and 1 GiB of storage per day. A busy day in a litigation office might use a few hundred. Nothing is charged, and no card is on file, so there is no risk of a bill.

## Keeping it safe

- Use a password you do not use elsewhere, and keep the Google account that owns the project secure.
- Take a **Backup** from the top bar now and then and keep the json file. Firebase holds the live data; the backup is your own copy in your own hands.
- Clearing browser data no longer destroys the records once you are signed in; they are in the project.
- Signing out on a shared or borrowed computer clears the records from that screen.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| *This web address is not in the Firebase list of authorised domains* | Step 8. Add `your-username.github.io` under Authentication → Settings → Authorised domains. |
| *Email sign-in is not switched on* | Step 3. Enable the Email/Password provider. |
| *Email or password is not correct* | Check the user exists in Authentication → Users. Use **Forgot password** on the sign-in screen to get a reset link. |
| *Permission denied by the database rules* | Step 5. Re-paste the rules and click Publish. If you set `OFFICE_ID`, use the Step 11 rules instead. |
| Badge reads **This device only** | `js/firebase-config.js` is still empty, or this device was switched to offline-only. Open Settings → Storage to switch back. |
| Badge reads **Offline** and stays there | The device has no internet. Work carries on; it syncs by itself when the line returns. |
| Page loads but nothing happens | The Firebase scripts could not be fetched. Check the internet connection; the app falls back to this-device-only in the meantime. |

## Working without Firebase

Leaving `apiKey` empty keeps everything exactly as before: records stay in that browser, and **Backup** and **Restore** move them between machines. Nothing else in the application changes.
