# AI Prompt: Build RateDeed Web Application

## Your Task
Build a Next.js web application for RateDeed - a contractor marketplace platform. The design reference is already at `/Users/tamim/Downloads/workspace-266fad55-a7b5-4f92-863c-f497408c718e` and uses Next.js + Tailwind CSS, so you can copy and modify directly - NO conversion needed.

## IMPORTANT: Why Build Web Instead of Converting Mobile App?
The design reference is ALREADY in Next.js + Tailwind. If you try to convert it to React Native:
- Colors and spacing will look similar but NOT identical
- Icons from lucide-react vs FontAwesome5 render differently
- CSS flexbox vs React Native flexbox have subtle differences
- Typography rendering differs between web and native

**By building the web version, you get a PIXEL-PERFECT match to the design reference.**

## What is RateDeed?
RateDeed is a platform where homeowners find and hire contractors for home improvement projects. Key features:
- Browse contractors by category and location
- View contractor profiles, reviews, portfolios
- Request quotes and make payments (escrow-protected)
- Messaging between homeowners and contractors
- Job tracking for both parties

## Source Materials
- **Design Reference**: `/Users/tamim/Downloads/workspace-266fad55-a7b5-4f92-863c-f497408c718e` - Contains all pages/components in Next.js + Tailwind
- **Backend API**: `/Users/tamim/Desktop/ratedeedmobile/backend/` - Node.js/Express API on port 3001
- **Database**: MongoDB (schemas in backend/models/)

## Step-by-Step Instructions

### 1. Setup Next.js Project
```bash
npx create-next-app@latest ratedeed-web --typescript --tailwind --eslint --app
cd ratedeed-web
npm install axios socket.io-client @tanstack/react-query
```

### 2. Copy Design Reference
Copy all components and pages from the design reference into your Next.js app:
```bash
cp -r /Users/tamim/Downloads/workspace-266fad55-a7b5-4f92-863c-f497408c718e/src/* ./src/
```

### 3. Setup API Client
Create `src/lib/api.ts` to connect to existing backend:
```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### 4. Create API Wrapper Functions
For each feature area, create wrapper functions:
```typescript
// src/lib/contractors.ts
export const getContractors = (params: any) => api.get('/contractors/browse', { params });
export const getContractorDetail = (id: string) => api.get(`/contractors/${id}`);
```

### 5. Pages to Build
Copy and adapt these pages from the design reference:
1. **HomePage** (`/`) - Hero search, category icons, featured contractors, feed posts
2. **SearchPage** (`/search`) - Filters, sort options, contractor grid
3. **BusinessDetailPage** (`/contractor/[id]`) - Full profile, portfolio, reviews, services
4. **ProfilePage** (`/profile`) - User settings, stats, saved items
5. **MessagesPage** (`/messages`) - Conversation list, real-time chat
6. **ActiveJobsPage** (`/jobs`) - Job status tracking
7. **ContractorDashboard** (`/contractor/dashboard`) - Posts, earnings, leads, quotes

### 6. Authentication
- Copy auth logic from `backend/routes/auth.js`
- Create login/signup pages from design reference
- Store JWT in localStorage
- Protect routes with middleware

### 7. Environment Variables
Create `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Key Design Patterns to Preserve

### Color Palette
- Primary: `indigo-600` (#4F46E5)
- Background: `gray-50` (#f9fafb)
- Text: `gray-900` (#111827)
- Accent: `rose-500` (#f43f5e) for CTAs

### Components from Design Reference
- `ListingCard` - Contractor card with image, rating, verified badge
- `CategoryIcon` - Colorful gradient icons for service categories
- `ReviewCard` - Star ratings, user avatars
- `CreatePostCard` - For contractor posts
- `BottomSheet` - For mobile-like interactions

### Search UI
- Split search bar: zip code + contractor name
- Category chips with active states
- Sort dropdown (Rating, Price, Distance)

## Backend Endpoints to Use
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/contractors/browse?zip=&category=&sort=
GET    /api/contractors/:id
GET    /api/posts/feed
POST   /api/posts
GET    /api/quotes
POST   /api/leads
GET    /api/jobs
WS     /socket.io (for real-time messaging)
```

## Important Notes
1. The design reference is COMPLETE - all pages exist, just copy and connect to API
2. Do NOT convert to React Native - keep as Next.js/Tailwind
3. Preserve all Tailwind classes as-is - they work directly in Next.js
4. The existing backend uses MongoDB - connect via Mongoose or direct API calls
5. For real-time chat, use socket.io client connecting to port 3001

## Success Criteria
- [ ] Next.js app runs at localhost:3000
- [ ] HomePage displays with search and categories
- [ ] Can browse contractors
- [ ] Can view contractor details
- [ ] Auth flow works (login/logout)
- [ ] Web app connects to backend at port 3001
- [ ] UI looks EXACTLY like the design reference (no conversion needed)

## Questions to Ask if Stuck
- Check design reference at `/Users/tamim/Downloads/workspace-266fad55-a7b5-4f92-863c-f497408c718e/src/components/pages/`
- Check backend routes at `/Users/tamim/Desktop/ratedeedmobile/backend/routes/`
- Check database models at `/Users/tamim/Desktop/ratedeedmobile/backend/models/`