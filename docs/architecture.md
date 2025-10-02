# Architecture Overview

The MVP is split into a React PWA frontend, an Express API (deployable to Firebase Functions), and Firebase-managed services.

## Frontend
- React + Vite for rapid iteration
- Mapbox GL JS for map rendering
- SWR for data fetching against `/api` endpoints
- Firebase SDK for Auth and Storage integration

## Backend
- Express REST API with Firebase Admin SDK for Auth and Firestore
- Zod validates request payloads before touching Firestore
- Structure: `routes` → `controllers` → `services`

## Firebase
- Firestore holds collections: `users`, `spots`, `comments`, `likes`, `scheduled_spots`, `promotions`, `leaderboards`
- Storage hosts spot/comment images (folders: `spots/`, `comments/`, `avatars/`)
- Auth issues ID tokens consumed by backend middleware（管理者はカスタムクレーム `admin` を付与）
- Cloud Functions: `api` (Express), `refreshPopularSpots`, `processScheduledSpots`, `tidyPromotions`

## Deployment Strategy
- Frontend: Vercel/Netlify with `.env` referencing Firebase + Mapbox keys
- Backend: Node server or Firebase Functions (the Express app can be wrapped via `functions.https.onRequest`)
- Firebase provides real-time listeners for maps and offline cache

## Future Enhancements
- Firebase Cloud Messaging for push notifications
- Scheduled Functions for venue scraping and trending ranking
- Directions API integration for itinerary planning
- Stripe等による有料プロモーション枠課金
