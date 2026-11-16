# Qwipo Delivery Partner — front-end replica

A clickable, browser-based replica of the **Qwipo DP** Android app (`qwipo-delivery-partners`, branch `main`, NativeScript 8 + Angular 19), running on synthetic data. No backend, no real accounts, no build step.

## Run it

```bash
node serve.js 5180
```

Then open <http://localhost:5180>. It needs only Node (no `npm install`), and any static web server pointed at this folder works too.

## Sign in

Use the phone exactly like the real app: enter a mobile number, tap **Continue**, enter OTP **123456**. The **Roles** tab in the side panel can also sign you in directly, skipping the OTP step.

| Person | Mobile | Type | What they see |
|---|---|---|---|
| Ravi Teja Kumar | 9876543210 | Driver | Lands on **Hops**. Trips: one in progress, one not started, one completed, one cancelled. |
| Suresh Babu | 9123456780 | Helper | Lands on **Hops**. Same trips as Ravi. |
| Mahesh Yadav | 9000011111 | Rider (any other type) | Lands on **Trips**. One trip with every hop done, ready to finish. |
| Prakash Goud | 9000022222 | Helper | Lands on **Hops** (Mahesh's trips). |
| Anil Varma | 9988776655 | Driver, **inactive** | “Thank You” screen with the Home / My Account footer. |
| Kiran Rao | 9012345678 | Driver | No trips today: empty Trips and Hops. |
| anyone else | e.g. 9555512345 | — | “Field Agent not found. Please register.” |

## What's covered

Every route in `app-routes.ts` and every bottom sheet in `Bottomsheet`:

- **Sign in:** splash, loading, mobile number (validation, counter), OTP (6 boxes, 30-second timer, resend, edit number), Terms & Conditions web view, update-required screen, inactive-partner greeting.
- **Trips:** list (sorted In progress → Created → Completed → others), trip details with Summary / Hops tabs, Start → In-Progress → Trip Completed. Location, mock-GPS and 150 m seller-distance checks, plus “All Hops are not completed”.
- **Hops:** list with search (name or 10-digit number, with the app's exact validation toasts), map and call links, and hop details with Summary / Products / Returns tabs. Tabs vary by hop type: pickup, delivery or return to seller.
- **Delivery hop:** Arrived at Location → Complete. Requires the pickup hop to be done first. Completing asks for the retailer's OTP, except after a whole-hop return. The Action → Send OTP sheet sends that OTP to the retailer.
- **Returns:** per-product **Edit** (quantity + reason), per-order **Edit**, whole-hop **Action**. Returns are held on the device until the hop is completed, then posted. Leaving the hop with unsent returns shows **Pending Returns**.
- **My Account:** profile, Contact Us, Terms & Conditions, Logout sheet. The Android back button follows `app.component.ts` exactly, including “Do you want to exit from Qwipo?”.
- **System:** location permission prompt, success, warning and error alerts (SweetAlert style), toasts, loading dialog, “Internet Connection Lost.” snackbar, phone dialer, Home/Back/Recents.

The **Device** tab sets location (at seller, 2 km away, off, fake GPS), forces the update screen, drops the network, and resets all data. The **Screens** tab jumps straight to any screen or state. The **Inbox** tab shows the OTP texts the app would send.

## Fidelity notes

- Layout is ported from the app's NativeScript templates and resolved styles (`app.android.scss` + `tailwind.config.js`) at 1 CSS px = 1 dp. It uses the app's own fonts, images and icons, copied from the repo.
- Behaviour follows the source as written, quirks included. Examples: `text-danger-500` isn't a defined colour, so the mobile-number error shows in the default grey. `font-sans` loads the bundled Roboto Black file. Tapping a grey “Arrived at Location” after arrival still opens the OTP sheet.
- Data is synthetic and resets daily. Trips are always “today”. Changes persist in the browser's local storage until you use **Reset all data**.
- The Terms & Conditions page loads the live `https://qwipo.com/terms-conditions` inside the web view, as the production app does.
