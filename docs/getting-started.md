# Getting Started

## Prerequisites
- Node.js 20+
- npm or pnpm
- Firebase project with Firestore, Storage, and Auth enabled
- Mapbox access token (with Static + GL JS access)

## Environment Variables
Configure the following files before running the stack.

### `frontend/.env`
```
VITE_API_BASE=http://localhost:4000
VITE_MAPBOX_TOKEN=pk....
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### `backend/.env`
```
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> 💡 Load the backend `.env` before running the Express server so the Firebase Admin SDK can authenticate using your service account.

## Install Dependencies
```
cd frontend && npm install
cd ../backend && npm install
```

## Run the Development Stack
1. **Backend** – `cd backend && npm run dev`
   - Starts the Express API at `http://localhost:4000`.
2. **Frontend** – `cd ../frontend && npm run dev`
   - Vite serves the PWA at `http://localhost:5173` and proxies `/api` calls to the backend.

Open the app in a browser. The map is centered on Shibuya, category filters live in the header, and a posting form + feed appear in the sidebar.

## Authenticating Users for the MVP
- Use Firebase Auth (Email/Password or OAuth providers) to obtain an **ID token**.
- Paste the token into the "Firebase IDトークン" field of the posting form. The backend middleware verifies this token before accepting spot/comment/like actions.
- Example for manual testing with the Firebase JS SDK:
  ```ts
  import { signInWithEmailAndPassword } from "firebase/auth";
  const credential = await signInWithEmailAndPassword(auth, "demo@example.com", "password123");
  const idToken = await credential.user.getIdToken();
  ```

## Posting a Spot (UI Flow)
1. Click the map to drop a teal marker (lat/lng appears in the form).
2. Fill in title, description, category, start/end time, and optional image URL.
3. Paste a valid Firebase ID token.
4. Submit the form. The new spot appears in the feed and a marker is rendered on the map.
5. Use "地図で見る" in the feed to fly the map to an existing spot.

## Posting via API (optional cURL)
```
curl -X POST http://localhost:4000/api/spots \ 
  -H "Content-Type: application/json" \ 
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \ 
  -d '{
        "title": "渋谷駅前ライブ",
        "description": "毎週金曜20時スタート",
        "category": "live",
        "lat": 35.6581,
        "lng": 139.7016,
        "startTime": "2025-09-20T11:00:00.000Z",
        "endTime": "2025-09-20T13:00:00.000Z"
      }'
```

## Firebase Emulators (Optional)
Run `firebase emulators:start --only firestore,storage,functions` to develop without touching production data. Update `VITE_API_BASE` and backend `.env` to point at the emulator host/ports when needed.

## Deployment Notes
- **Frontend**: deploy the `frontend` build output to Vercel/Netlify. Remember to set the same environment variables in the hosting platform.
- **Backend**: run the Express server on your preferred host (Render/Fly.io) or wrap it in Firebase Functions using `firebase/functions/src/index.ts`.
