# Advocate Billing — Santosh Keshav Patil

A single-page billing and ledger system for the advocate's office. It runs entirely in the browser, needs no server, no login and no internet connection once loaded, and can be published free on GitHub Pages.

## What it does

- **Clients** with address, phone, PAN and an opening balance
- **Quotations** (fee estimates) that convert into bills in one click
- **Invoices / Bills of Costs** separating professional fees from out of pocket expenses, with concession, amount in words and payment status
- **Receipts** for full or part payment, against a particular bill or on account, showing the running balance on the face of the receipt
- **Client ledger** in Dr/Cr form with opening balance, running balance, date filters, manual adjustments, a printable Statement of Account and CSV export
- **Dashboard** with billed, received, outstanding and quoted figures by financial year

Every document prints on an **A5 letterhead** carrying the name, qualification, designation, address, phone, PAN, the cheque instruction and the **signature with the round seal**.

## Output formats

- **PDF** — the PDF and Print buttons both open the browser print window. Choose *Save as PDF* as the destination, set **Margins to None** and switch **off** headers and footers. The page then comes out as an exact A5 sheet.
- **DOCX** — a real Word file, page size A5, with the signature and seal embedded as images. It opens in Word, LibreOffice and Google Docs and can be edited before sending.
- **CSV** — for the client ledger, to open in Excel.

Document numbering runs by financial year, for example `INV/2026-27/001`, `RCT/2026-27/004`. Prefixes are editable in Settings.

## Publishing on GitHub Pages

To put the records online as well, follow **SETUP-FIREBASE.md** instead; it covers Firebase and GitHub together. The steps below publish the site on its own.

1. Create a new repository on GitHub, for example `advocate-billing`.
2. Upload every file and folder from this package, keeping the folder structure (`index.html`, `css/`, `js/`, `assets/`, `.nojekyll`).
3. In the repository open **Settings → Pages**, set *Source* to **Deploy from a branch**, branch **main**, folder **/ (root)**, and save.
4. After a minute the site is live at `https://<your-username>.github.io/advocate-billing/`.
5. Open that address on the office computer and bookmark it. On a phone, use *Add to Home screen*.

A **private** repository on a free GitHub account will not publish Pages. If the repository must stay private, the same files also work by opening `index.html` directly from a folder on the computer, though Firebase sign-in then needs `localhost` or the published address.

## Online, or this device only

The application runs in two modes.

**Online (recommended).** Follow **SETUP-FIREBASE.md**. You sign in with an email and password, and the records live in your own Firebase project: the office computer, the laptop and the phone all show the same clients, bills, receipts and ledgers, updating live. It keeps working while the internet is down and syncs on its own when the line returns. Free of cost on Firebase's Spark plan.

**This device only.** Leave `js/firebase-config.js` as it is and the records stay in that browser, with no account and no internet. The badge in the top bar says *This device only*. Each computer then holds a separate set, and clearing browsing data erases them.

The badge in the top bar always shows which mode is running: *Synced*, *Saving*, *Offline — saved here, will sync*, or *This device only*. Settings → Storage lets you switch between modes, and offers to upload records entered offline once you sign in.

Either way, use **Backup** in the top bar from time to time. It downloads a single `.json` file holding everything, and **Restore** reads it back. Firebase holds the live data; the backup is your own copy in your own hands.

## Settings worth setting once

- Address, phone, email, PAN and enrolment number as they should appear on the letterhead
- Bank name, account number, IFSC and UPI, if these are to be printed on bills
- The cheque instruction line (set to *All cheques to be drawn in favour of SANTOSH KESHAV PATIL only*)
- Whether to print the signature block, and whether to add a second round seal beside it
- Paper size A5 or A4
- Switch **off** "Print letterhead" when printing on pre-printed stationery; the rest of the document stays as it is

## Replacing the signature or the seal

Both images are embedded in `js/assets.js` as base64 PNGs with a transparent background (`signBlock` is the signature with the seal, name and designation; `seal` is the round seal alone; `signOnly` is the signature and seal without text). To change one, convert a new transparent PNG to base64 and replace the corresponding string, keeping the `data:image/png;base64,` prefix. Update the matching width and height in `signBlockWH`, `sealWH` and `signOnlyWH` so the proportions stay correct. The originals also sit in `assets/` for reference.

## Files

```
index.html             screens and layout
SETUP-FIREBASE.md      step by step guide to putting it online
css/style.css          interface and the A5 letterhead
js/firebase-config.js  paste the Firebase settings here (the only file to edit)
js/cloud.js            storage: Firestore when signed in, this browser when not
js/assets.js           signature and seal, embedded
js/zipdocx.js          ZIP and Word writer, written from scratch, no libraries
js/documents.js        renders each document to the letterhead and to Word
js/app.js              data, calculations, ledger and all screens
assets/                the signature and seal image files
```

The only outside code is Firebase itself, and only when it is configured. The PDF and Word output, the letterhead and every calculation are built into these files, so they keep working with no internet.
