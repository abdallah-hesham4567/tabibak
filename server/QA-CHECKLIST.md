# Tabibak Manual QA Checklist

Run after each refactor phase against `http://localhost:3000/tabibak.html`.

## Smoke (automated)

```bash
cd server
node check-page.js
```

## Visual / navigation

- [ ] Welcome splash animates and dismisses on tap
- [ ] Light/dark theme toggle works on all screens
- [ ] All nav tabs activate correct screen: landing, meds, history, food, medical-test, bmi, pharmacist, mentor
- [ ] Arrow-key and swipe navigation between tabs (RTL)
- [ ] RTL layout intact on mobile width

## Triage

- [ ] Start triage from landing with symptom text
- [ ] Chat messages, suggestion chips, progress bar
- [ ] Red-flag banner on emergency terms
- [ ] Results screen with copy report
- [ ] Session saved when logged in

## Medications

- [ ] Med list renders (empty + with data)
- [ ] Add medication modal (dose count, save/cancel)
- [ ] Mark dose taken / delete med
- [ ] FCM panel toggle and test notification (if permission granted)

## Food & medical test

- [ ] Food mood chips and AI recommendations (Groq)
- [ ] Food follow-up chat
- [ ] Food PDF export
- [ ] Medical test image/PDF upload and analysis

## Auth & profile

- [ ] Login / register with password constraints
- [ ] Google sign-in button renders (if configured)
- [ ] Profile edit and avatar upload
- [ ] Logout

## History & pharmacist

- [ ] History filters (all, triage, medical-test, nutrition)
- [ ] Open session detail modal, delete, print PDF
- [ ] Pharmacist WhatsApp quick ask and report

## Mentor

- [ ] Add/remove mentor, mentee detail tabs

## Breathing & BMI

- [ ] Breathing exercise cycle and audio
- [ ] BMI calculate and reset
