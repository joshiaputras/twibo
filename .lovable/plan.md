

## Plan: 8 UI/UX Improvements

### 1. "Hapus Watermark" Button Style (Dashboard)
Change the button from `gold-glow` filled style to `variant="outline"` with same border/text styling as sibling buttons (`border-border text-muted-foreground`). Add Crown icon but keep outline style.

**File:** `src/pages/Dashboard.tsx` (lines 273-281)

### 2. Admin Campaign Table: User Name/Email + Conditional Featured Button
- Add two new columns (User Name, Email) to the campaigns data table by cross-referencing `users` state (profiles) with `c.user_id`.
- Show "Set Featured" button only if the campaign's `user_id` belongs to an admin (check against `users` list where `is_admin === true`).

**File:** `src/pages/Admin.tsx` (lines 326-413)

### 3. Infinite Loop Carousel on Homepage
Duplicate the featured campaigns array (already done with `[...campaigns, ...campaigns]`) but implement true seamless infinite scroll: when `scrollLeft` reaches the midpoint (original list width), instantly reset to 0 without visible jump. Slow down speed from `0.5` to `0.3`.

**File:** `src/pages/Index.tsx` (lines 24-41, 170-203)

### 4. Public Campaign Page: Avatar Fix, Divider, H3 Heading
- The avatar/name only shows when `creatorName` is truthy. Need to verify the profile query works — likely the issue is the profile fetch returns empty for some users. Will add a fallback so it always shows (even with fallback initial).
- Add `<hr>` or `<Separator>` divider before "Tentang Campaign Ini".
- Change heading from `<h3 className="text-sm ...">` to `<h3 className="text-lg font-display font-semibold ...">`.

**File:** `src/pages/CampaignPublic.tsx` (lines 686-720)

### 5. Voucher Error Message in PaymentConfirmDialog
Add red error text state below the voucher input field when validation fails, instead of just using toast.

**File:** `src/components/PaymentConfirmDialog.tsx` — add `voucherError` state, show `<p className="text-xs text-destructive">` below input.

### 6. Add "Upload Custom Banner" to Premium Features
Add a new premium feature item across all locations:
- `src/i18n/en.json` and `src/i18n/id.json`: Add `"f6": "Upload Custom Banner Image"` / `"f6": "Upload banner kustom"`
- `src/components/PaymentConfirmDialog.tsx`: Add to features list
- No code changes needed for Pricing/Index as they dynamically render from i18n `premiumFeatures`

### 7. Remove Copy Caption Button Below Interactive Preview
Remove the "Salin Caption" button in the caption section that appears below the interactive preview (after photo upload). Keep the caption text, remove only the button.

**File:** `src/pages/CampaignPublic.tsx` (lines 877-886) — remove the `<Button>` for copy caption. Also remove the copy caption button in the static preview section (lines 749-757).

### 8. Dark Watermark with White Border
Change watermark badge styling across all three locations:
- **PhotoComposerPreview.tsx**: Change `bg-white/95` → dark background (e.g., `rgba(15,15,15,0.9)`), add white border, change text color from gold to white or keep gold on dark.
- **renderTemplate.ts**: Change `fillStyle: 'rgba(255,255,255,0.94)'` → dark fill + white stroke for badge.
- **CampaignPublic.tsx** (baked preview): Same dark fill + white stroke.

All three locations: badge background becomes dark (matching site theme ~`hsl(20, 14.3%, 4.1%)`), border becomes white/light, text remains gold.

### Files to Edit
1. `src/pages/Dashboard.tsx` — button style
2. `src/pages/Admin.tsx` — user columns + conditional featured
3. `src/pages/Index.tsx` — infinite carousel
4. `src/pages/CampaignPublic.tsx` — avatar fix, divider, heading, remove copy caption buttons
5. `src/components/PaymentConfirmDialog.tsx` — voucher error + banner feature
6. `src/components/PhotoComposerPreview.tsx` — dark watermark
7. `src/utils/renderTemplate.ts` — dark watermark canvas
8. `src/i18n/en.json` + `src/i18n/id.json` — add banner feature text

