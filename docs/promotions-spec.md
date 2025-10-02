# Promotions & Scheduled Announcements Spec

This document outlines the tiered poster model, announcement types, and required backend changes before implementation.

## 1. Poster Tiers
| Tier | Description | Capabilities | Entry Criteria |
| --- | --- | --- | --- |
| `tier_c` | General users | Real-time posts, same-day short heads-up (≤ 6h) | Default for all sign-ups |
| `tier_b` | Trusted/Popular creators | All of tier C + short-term announcements (≤ 48h ahead) | Auto-upgrade when follower count & engagement thresholds met (eg. 2k followers, 100 cumulative likes) or manual review |
| `tier_a` | Official / Sponsored promoters | All of tier B + long-lead campaigns (up to 90 days), promoted banners | Manual approval or paid subscription |

Additional metadata on `users/{uid}`:
```json
poster_tier: "tier_c" | "tier_b" | "tier_a"
followers_count: number
engagement_score: number  // rolling average likes/comments per spot
promotion_quota: {
  short_term: number,  // posts per 7 days
  long_term: number    // posts per 30 days (tier_a only)
}
flags: {
  is_verified: boolean,
  is_sponsor: boolean
}
```

## 2. Announcement Types
| Type | Window | Eligible Tiers | Storage |
| --- | --- | --- | --- |
| `realtime_spot` | Publish immediately | All tiers | `spots` collection |
| `short_term_notice` | Publish within 6–48h | `tier_b`+ (≤48h), `tier_c` (≤6h) | `scheduled_spots` (publish_at present day) |
| `long_term_campaign` | Publish 3–90 days in advance | `tier_a` | `scheduled_spots` + `promotions` banner |

`scheduled_spots` document shape:
```json
{
  "title": "",
  "description": "",
  "category": "live" | "event" | "cafe",
  "lat": number,
  "lng": number,
  "start_time": timestamp,
  "end_time": timestamp,
  "publish_at": timestamp,
  "owner_id": string,
  "announcement_type": "short_term_notice" | "long_term_campaign",
  "status": "pending" | "approved" | "published" | "rejected",
  "created_at": timestamp,
  "review_notes": string
}
```

`promotions` collection (for long-lead banner content):
```json
{
  "spot_id": string,          // optional - real spot after publish
  "owner_id": string,
  "publish_at": timestamp,
  "expires_at": timestamp,
  "headline": string,
  "cta_url": string | null,
  "image_url": string | null,
  "priority": number,
  "status": "scheduled" | "active" | "expired"
}
```

## 3. Firestore Rules Impact
- `users/{uid}` write: allow updating `poster_tier`, `promotion_quota`, `flags` only via Cloud Functions / admin.
- `scheduled_spots`: creation allowed if authenticated and passes tier window checks; updates restricted to owner (pre-publish) and system (status changes).
- `promotions`: read public, write restricted to admin Functions.

Pseudo-rule additions:
```text
match /scheduled_spots/{id} {
  allow create: if auth != null && canSchedule(auth.uid, request.resource.data);
  allow update: if isOwner(auth.uid, resource.data) && beforePublish(resource.data.status);
  allow update: if isSystem(request.auth) && status transitions valid;
  allow read: if true; // show pending? maybe owner-only until publish
}

match /promotions/{id} {
  allow read: if true;
  allow write: if isSystem(request.auth);
}
```

The `canSchedule` helper needs to enforce:
- `poster_tier` retrieved via security rules (`get(/databases/.../users/{uid})`).
- For `long_term_campaign`, require `tier_a` and `(publish_at - now) <= 90d` (and >= 3d).
- For `short_term_notice`, allow ≤6h for tier C, ≤48h for tier B+, min 1h lead.
- Enforce quotas via accumulated counts (may need Cloud Functions because Firestore rules cannot do complex aggregation).

## 4. API Surface
- `POST /api/scheduled_spots`: create request; backend validates tier, window, quota; status `pending` if manual review required.
- `PUT /api/scheduled_spots/{id}`: owner cancel or update details before approval.
- `GET /api/scheduled_spots?scope=mine|upcoming`: owner dashboard + admin review feed.
- `POST /api/promotions/approve` (admin only): mark scheduled spot as approved, optionally create promotion banner.
- `GET /api/promotions?now=true`: frontend fetch for banners.

Existing `/api/spots` remains for immediate posts. `createSpotHandler` should reject future `startTime` beyond allowed window for tier.

## 5. Functions & Jobs
- `processScheduledSpots` (every 5 minutes): move approved items whose `publish_at <= now` into `spots`; create `promotions` entry or activate existing.
- `expirePromotions` (daily): mark banners expired after `expires_at`.
- `refreshPosterMetrics` (daily): update `followers_count`, `engagement_score`, auto-tier upgrades/downgrades.

## 6. UI Hooks
- Dashboard panels showing remaining quota/time windows per tier.
- Map toggles for viewing or hiding long-term campaigns.
- Banner slot (carousel) pulling from `/api/promotions` (active status, ordered by priority and publish date).

## 7. Open Questions
- Manual approval flow vs auto-approval for tier B short-term: decide thresholds.
- Payment/billing integration for tier A or long-term campaigns (placeholder in scope?).
- Should long-term campaigns appear on map before publish date, or only as banners until the event is near?

This document acts as the contract for Phase 2 backend implementation.
