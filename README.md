# LifeTrack

A habit and task accountability tracker built for **pairs**. Two people connect,
then share a dashboard, each other's weekly planners, a calendar and a chat.
A single user cannot use the app alone — everything past sign-in is gated on
having a partner.

## How pairing works

1. Sign in (email/password or Google) and pick a display name and theme colour.
2. Search for your partner by name or email and send a connection request.
3. They accept. Both accounts are linked and a shared workspace is created.
4. Either person can end the connection from **Settings**, which deletes the
   shared calendar and chat and frees both accounts to pair with someone else.

Each account can be in at most one pair, and the two members of a pair may never
use the same theme colour. Colours available: pink, purple, blue, green, red,
orange, dark pink, dark purple.

## Prerequisites

- Node.js 18+
- A Firebase project with **Firestore** and **Authentication** enabled
  - In Authentication → Sign-in method, enable **Email/Password** and **Google**

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your Firebase values
npm run dev
```

`.env.local` needs at minimum:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

`VITE_FIREBASE_FIRESTORE_DATABASE_ID` is optional — leave it blank to use the
project's default database.

## Deploying the security rules

The rules in [`firestore.rules`](firestore.rules) enforce the pairing model:
you can only read your partner's tracker, only write to the shared collections
of a pair you belong to, and only link yourself to someone who invited you.

```bash
firebase deploy --only firestore:rules
```

## Data model

See [`firebase-blueprint.json`](firebase-blueprint.json) for the full schema.

```
users/{uid}                      profile + pairing state
trackers/{uid}                   habits & weekly plan (partner can read)
pairs/{pairId}                   { members: [uidA, uidB] }
pairs/{pairId}/activities/{id}   shared calendar
pairs/{pairId}/messages/{id}     shared ChatDesk
connectionRequests/{from_to}     pending invitations
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Type-check with `tsc --noEmit` |
