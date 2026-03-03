

# TWIBO.id — Full Implementation Plan

## Overview
TWIBO.id is a private twibbon/campaign frame creator platform inspired by Twibbonize, with a dark futuristic glassmorphism design. Users create campaigns with frame/background overlays, share via private links, and supporters upload photos to generate branded images.

---

## Phase 1: Foundation & Design System

### Dark Futuristic Theme
- Deep navy/black background with grid pattern and gold (#FFD700) accent glows
- Glassmorphism cards (backdrop-blur, transparency, subtle borders)
- Gradient neon glow effects, smooth animations
- Font: Inter / Space Grotesk via Google Fonts
- Lucide icons throughout

### Navbar & Footer
- Logo "TWIBO.id", links: Pricing, Login/Sign Up
- Language toggle (ID/EN) saved to localStorage
- Navbar transforms to user dropdown menu after login
- Footer with links and branding

### Multi-Language System (ID/EN)
- Language context provider with JSON translation files
- Switcher in navbar, persisted in localStorage

---

## Phase 2: Authentication (Supabase)

### Sign Up & Login
- Email + Password signup with OTP email verification
- Google OAuth login
- Forgot password flow with reset page
- Profile: name, email, phone, avatar (required)

### User Profile Management
- Edit name, password (with current password confirmation)
- Avatar upload
- Dropdown menu in navbar when logged in

### Database: profiles table, user_roles table (separate)
- RLS policies for all user data

---

## Phase 3: Homepage

### Hero Section
- Glassmorphism hero with tagline & "Mulai Campaign" CTA
- Animated floating twibbon examples in background (like Twibbonize)
- Highlight: "All campaigns are PRIVATE — accessible only via link"

### Content Sections
- "Cara Kerja" — 3 steps with futuristic icons
- Key features section (Frame & Background Twibbon)
- Homepage content editable from Admin Dashboard (stored in site_settings)

---

## Phase 4: Pricing Page

### Two Glassmorphism Cards
- **FREE ACCESS**: Watermark, ads, no stats, basic editor
- **PREMIUM ACCESS**: ~~Rp 149.000~~ → Rp 50.000/campaign — No watermark, no ads, full stats, all features

### Feature Comparison Table
- Side-by-side feature breakdown

---

## Phase 5: User Dashboard

### Campaign Management
- Grid/list view toggle
- Status badges: Draft / Published / Free / Premium
- CRUD: Create, Edit, Delete, Copy Link
- Stats (supporters/downloads) — Premium only, Free users get upgrade prompt
- Filter & sort functionality

---

## Phase 6: Campaign Editor (Mini Canva)

### Step 1: Campaign Details
- Name, description, caption & hashtags (optional)
- Custom URL slug (one-time only, with warning, reserved word validation)

### Step 2: Choose Size
- Square (1080×1080), Portrait (1080×1350), Story (1080×1920)

### Step 3: Choose Type
- Frame Twibbon or Background Twibbon

### Step 4: Canvas Editor
- HTML5 Canvas-based editor with:
  - Drag & drop elements on canvas
  - Layer management (reorder, visibility)
  - Import assets: upload images, stickers, shapes
  - Text tool: Google Fonts selection, color, size
  - Transform: resize, rotate, flip, crop
  - Undo/Redo history
  - Zoom & pan
  - Special placeholder shape (square, rounded square, circle) — one per campaign, marks where user photo goes
  - Upload example photo for preview
  - Auto-save draft

### Step 5: Publish Settings
- Draft or Published toggle
- Preview final result

---

## Phase 7: Campaign Public Page (`/c/[slug]`)

### Campaign Display
- Campaign info + example result photo
- Upload photo interface

### Frame Mode
- User photo placed into the placeholder shape → composite result

### Background Mode  
- Client-side background removal (JavaScript, no API)
- Merge subject onto campaign background

### Result Handling
- Preview with position/scale adjustment
- Download (with watermark if free campaign)
- Share buttons (WhatsApp, Twitter, Facebook, Copy Link) — icons only
- Caption & hashtag copy button
- AdSense ad slots for free campaigns (hidden for premium)

---

## Phase 8: Payment (Midtrans)

### Per-Campaign Payment
- Midtrans integration via Supabase Edge Function
- Payment locked to specific campaign_id (anti-abuse)
- Payment status tracking in database

---

## Phase 9: Admin Dashboard

### Campaign Management
- List all campaigns, view details, edit status, block, delete
- See free/premium status

### User Management
- List all users, view profiles, edit, block, delete

### Transaction List
- All successful transactions with filters

### Site Settings
- Edit homepage content, logo
- Midtrans API key configuration
- AdSense ID configuration
- Chat button link (WhatsApp/Telegram)
- VPS storage URL configuration

### Default admin credentials created on setup

---

## Phase 10: Supporting Features

### Floating Chat Button
- Fixed bottom-right on all pages
- Redirects to WhatsApp/Telegram (configurable from Admin)

### Google AdSense Integration
- Ad slots on free campaign pages
- Hidden for premium campaigns
- AdSense ID configurable from Admin

### Storage Architecture
- Supabase Storage for now (Lovable Cloud)
- Upload via Edge Function → designed for easy VPS migration
- Documentation for Nginx + Node.js file server setup

---

## Database Schema

| Table | Purpose |
|-------|---------|
| profiles | User profile data (name, email, phone, avatar) |
| user_roles | Separate roles table (admin, user) |
| campaigns | Campaign data, settings, slug, type, size, status |
| campaign_assets | Canvas elements, layers, uploaded assets |
| payments | Midtrans transaction records |
| site_settings | Admin-configurable site content & keys |

All tables with RLS policies.

---

## Routes

| Path | Page |
|------|------|
| `/` | Homepage |
| `/pricing` | Pricing page |
| `/login` | Login |
| `/signup` | Sign up |
| `/forgot-password` | Password reset |
| `/dashboard` | User campaign dashboard |
| `/profile` | User profile |
| `/campaign/new` | Campaign editor (new) |
| `/campaign/:id/edit` | Campaign editor (edit) |
| `/c/:slug` | Public campaign page |
| `/admin` | Admin dashboard |

---

## Tech Decisions
- **Canvas Editor**: Fabric.js library for the mini-Canva editor
- **Background Removal**: @imgly/background-removal (client-side, free)
- **Payment**: Midtrans Snap via Edge Function
- **i18n**: Custom React context with JSON translation files
- **Responsive**: Mobile-first with Tailwind

