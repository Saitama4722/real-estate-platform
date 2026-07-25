# Centreal — Full Visual Audit (Discovery Pass)

**Purpose:** Complete route/page inventory with screenshots, ahead of a future design
overhaul. **Discovery only — no source, style, component, config, or data was modified.**

- **Date:** 2026-07-22
- **Environment:** local native dev — Django on `127.0.0.1:8001`, Next.js on `localhost:3000`
  (`NODE_ENV=development`). Servers were relaunched cleanly (`stop_local.ps1` first, which
  cleared **5 stale duplicate processes** — 2× Django, 2× Next.js, 1× Celery).
- **Method:** disposable Playwright + Chromium (installed in a temp scratch dir, **not** added
  to the repo). Each page captured full-page at **desktop 1440×900** and **mobile 390×844**.
  Real seeded data was used (property `PID000001`/#18, real articles, real district guides,
  realtor `RID000003`). Property #18 was only ever **read** — never edited.
- **CRM auth:** the documented default password failed for all real accounts (see
  [§5](#5-crm-authentication-note)); with the user's approval, the CRM was captured by injecting
  a **locally-minted dev JWT** for the `admin@admin.ru` superadmin — read-only, **no accounts
  created, no password reset, no auth-logic or DB changes.**
- **Screenshots:** [`design-audit/screenshots/`](screenshots/) — **66 PNGs**.

> **The little dark "N" circle floating on the left/centre edge of most screenshots is the
> Next.js dev-mode indicator overlay — a development artifact, NOT a real UI element.** It does
> not appear in production builds. Ignore it when reviewing.

---

## 1. Public site

| # | Page | Route | Screenshots | Notes |
|---|------|-------|-------------|-------|
| 01 | Homepage | `/` | [desktop](screenshots/01-homepage-desktop.png) · [mobile](screenshots/01-homepage-mobile.png) | Dark navy hero + white search card (Продажа/Аренда tabs; type/city/district/price/rooms/market/text filters). Sections: «Остались вопросы?» band, «Категории» (4 plain text cards, no icons), «Новые объекты», «Объекты на карте» (2GIS), blue «Продать недвижимость» CTA band, «Статьи» (3 cards), SEO text, «Популярные запросы». |
| 02 | Catalog — list view | `/catalog` | [desktop](screenshots/02-catalog-list-desktop.png) · [mobile](screenshots/02-catalog-list-mobile.png) | Breadcrumbs + `PageHeading` + full `SearchBar` + Списком/На карте toggle + sort dropdown + count + 3-col property grid. Only **1 real listing** → sparse grid. |
| 02b | Catalog — map view | `/catalog` (toggle) | [desktop](screenshots/02b-catalog-map-desktop.png) · [mobile](screenshots/02b-catalog-map-mobile.png) | Same route, «На карте» toggle — full-width 2GIS map with marker. |
| 03 | Property detail | `/catalog/[slug]` | [desktop](screenshots/03-property-detail-desktop.png) · [mobile](screenshots/03-property-detail-mobile.png) | 2/3 gallery+facts / 1/3 «Связаться с агентом» card. Gallery, price, Характеристики table, История цены («Показать график»), О квартире, Расположение (2GIS map). |
| 04 | Favorites (empty) | `/favorites` | [desktop](screenshots/04-favorites-empty-desktop.png) · [mobile](screenshots/04-favorites-empty-mobile.png) | Dashed empty-state card + «Перейти в каталог». localStorage-based (empty by design). |
| 05 | Compare (empty) | `/compare` | [desktop](screenshots/05-compare-empty-desktop.png) · [mobile](screenshots/05-compare-empty-mobile.png) | Same empty-state pattern as Favorites (mirrored architecture). |
| 06 | Articles index (blog) | `/articles` | [desktop](screenshots/06-articles-index-desktop.png) · [mobile](screenshots/06-articles-index-mobile.png) | 3-col grid of article cards (date/title/excerpt/«Читать далее»). **No cover images** (deliberate). |
| 07 | Article detail | `/articles/[slug]` | [desktop](screenshots/07-article-detail-desktop.png) · [mobile](screenshots/07-article-detail-mobile.png) | Prose body + «Каталог недвижимости» SEO-links block + «Другие статьи». Bullet lists render as literal `- ` dashes. |
| 08 | Districts index | `/districts` | [desktop](screenshots/08-districts-index-desktop.png) · [mobile](screenshots/08-districts-index-mobile.png) | «Районы» grouped by city (Краснодар/Геленджик), 3-col guide cards. Card heights vary within rows (ragged). |
| 09 | District guide detail | `/districts/[slug]` | [desktop](screenshots/09-district-detail-desktop.png) · [mobile](screenshots/09-district-detail-mobile.png) | Long-form district guide. |
| 10 | Sell-property form | `/sell` | [desktop](screenshots/10-sell-form-desktop.png) · [mobile](screenshots/10-sell-form-mobile.png) | Bordered form card + captcha. **Native, unstyled, English `Choose Files` input** (see issues). |
| 11 | Realtor public page | `/realtors/[crmId]` | [desktop](screenshots/11-realtor-public-desktop.png) · [mobile](screenshots/11-realtor-public-mobile.png) | Avatar, «РИЭЛТОР», name, bio, phone card + «Связаться», «Объекты риэлтора» toggle. |
| 11b | Realtor contact modal | `/realtors/[crmId]` (modal) | [desktop](screenshots/11b-realtor-contact-modal-desktop.png) | `RealtorContactModal` → `PublicLeadInquiryForm`. |
| 12 | SEO landing page | `/[city]/[catalogSegment]` | [desktop](screenshots/12-seo-landing-krasnodar-kupit-kvartiru-desktop.png) · [mobile](screenshots/12-seo-landing-krasnodar-kupit-kvartiru-mobile.png) | e.g. `/krasnodar/kupit-kvartiru`. Reuses the catalog page template. |
| 13 | Privacy policy | `/privacy` | [desktop](screenshots/13-privacy-desktop.png) · [mobile](screenshots/13-privacy-mobile.png) | Static legal text. |
| 14 | Terms of use | `/terms` | [desktop](screenshots/14-terms-desktop.png) · [mobile](screenshots/14-terms-mobile.png) | Static legal text. |
| 15 | Employee login | `/account/login` | [desktop](screenshots/15-account-login-desktop.png) · [mobile](screenshots/15-account-login-mobile.png) | `CrmLoginForm` on a **slate-50** band. Heading left-aligned, form centered (see issues). |
| 16 | CRM login (alt) | `/crm/login` | [desktop](screenshots/16-crm-login-desktop.png) · [mobile](screenshots/16-crm-login-mobile.png) | **Same form**, heading «Вход в CRM», **white** background. Two routes → one purpose. |
| 17 | Lead inquiry modal | `/catalog/[slug]` (modal) | [desktop](screenshots/17-lead-modal-desktop.png) | `PublicLeadInquiryForm` in `ui/modal` — shared with homepage & realtor flows. |

---

## 2. Realtor CRM / dashboard

**All CRM pages share:** the **public marketing `Header`** at top (Каталог/Районы/Статьи + «Продать
недвижимость» CTA, now with the logged-in avatar/name) **plus** the cabinet's own left
**`AccountSidebar`** — a double-chrome worth reconsidering. Background is **slate-50**, container is
**wide (1536px)**. Captured as `admin@admin.ru` (superadmin → all admin-only pages visible).

### 2a. Primary cabinet — `/account/(cabinet)/*`

| # | Page | Route | Screenshots | Notes |
|---|------|-------|-------------|-------|
| 20 | Dashboard | `/account` | [desktop](screenshots/20-account-dashboard-desktop.png) · [mobile](screenshots/20-account-dashboard-mobile.png) | «Панель» — just a user-summary card + text links. **Very sparse** (no stats/metrics/widgets). |
| 21 | Objects list | `/account/properties` | [desktop](screenshots/21-account-properties-desktop.png) · [mobile](screenshots/21-account-properties-mobile.png) | «Добавить объект» + search/type/status filters + Активные/Архив tabs + table. **Raw price `5000000.00`, English status `published`** (see issues). |
| 22 | Create property | `/account/properties/new` | [desktop](screenshots/22-account-property-new-desktop.png) · [mobile](screenshots/22-account-property-new-mobile.png) | Full `CrmPropertyFullForm` — реалтор/собственник, characteristics, description, 2GIS address map, photos. Photo picker = styled Russian **«Выбрать файлы»**. |
| 23 | Edit property | `/account/properties/[id]` | [desktop](screenshots/23-account-property-edit-desktop.png) · [mobile](screenshots/23-account-property-edit-mobile.png) | Same full form populated (id 18). |
| 24 | Leads («Заявки») | `/account/inquiries` | [desktop](screenshots/24-account-inquiries-desktop.png) · [mobile](screenshots/24-account-inquiries-mobile.png) | Table w/ Источник column, masked phone + reveal, «Новый» status dropdown. **«Показать телефон» button is BLACK here** vs blue on property detail (see issues). |
| 27 | Sale requests | `/account/sale-requests` | [desktop](screenshots/27-account-sale-requests-desktop.png) · [mobile](screenshots/27-account-sale-requests-mobile.png) | Filter tabs + **empty state** («Заявок на продажу пока нет»). Detail page `/account/sale-requests/[id]` **not captured — zero records exist.** |
| 26 | Owner registry | `/account/owners` | [desktop](screenshots/26-account-owners-desktop.png) · [mobile](screenshots/26-account-owners-mobile.png) | Search + «Добавить собственника» + table (avatar/phone/objects/note). Owner avatars are duplicate placeholder photos; status badge «Опубликован» (Russian). |
| 31 | Profile | `/account/profile` | [desktop](screenshots/31-account-profile-desktop.png) · [mobile](screenshots/31-account-profile-mobile.png) | Имя/Фамилия/Телефон/О себе. **Photo upload = native English `Choose File`** (see issues). |
| 29 | Staff (admin only) | `/account/staff` | [desktop](screenshots/29-account-staff-desktop.png) · [mobile](screenshots/29-account-staff-mobile.png) | `AccountStaffRealtorsPanel` — realtor accounts table (CRM ID, role, status, Изменить/Отключить/Удалить). |
| 30 | Activity log (admin only) | `/account/activity-logs` | [desktop](screenshots/30-account-activity-logs-desktop.png) · [mobile](screenshots/30-account-activity-logs-mobile.png) | Login/logout audit table (сотрудник/действие/время/IP). The one genuinely dense table. |

### 2b. Legacy / parallel CRM — `/crm/*`
A **second, older CRM surface** rendering the **same components** with **no sidebar**, in a
**narrower** default container. Redundant with 2a; a redesign should consolidate.

| # | Page | Route | Screenshots | Notes |
|---|------|-------|-------------|-------|
| 40 | Панель управления | `/crm/dashboard` | [desktop](screenshots/40-crm-dashboard-desktop.png) · [mobile](screenshots/40-crm-dashboard-mobile.png) | `CrmDashboardPanel`. |
| 41 | Объекты | `/crm/properties` | [desktop](screenshots/41-crm-properties-desktop.png) · [mobile](screenshots/41-crm-properties-mobile.png) | Same `PropertyCreateForm` + `CrmPropertyTable` as `/account/properties`, **no sidebar**. |
| 42 | Лиды | `/crm/leads` | [desktop](screenshots/42-crm-leads-desktop.png) · [mobile](screenshots/42-crm-leads-mobile.png) | `CrmLeadsTable`. |
| 43 | Статьи | `/crm/articles` | [desktop](screenshots/43-crm-articles-desktop.png) · [mobile](screenshots/43-crm-articles-mobile.png) | Placeholder text — «правки через Django Admin». |
| 44 | Пользователи | `/crm/users` | [desktop](screenshots/44-crm-users-desktop.png) · [mobile](screenshots/44-crm-users-mobile.png) | Placeholder text — «через Django Admin». |

### 2c. Redirect aliases (not distinct pages)
- `/crm` → `/account` · `/account/clients` → `/account/inquiries` (the latter isn't in the sidebar nav).

---

## 3. Shared / reused components

Redesigning these once covers many pages. **Bold = highest reuse / highest leverage.**

| Component | File | Where it appears |
|-----------|------|------------------|
| **`Header`** | `layout/header.tsx` | **Every page — public AND CRM** (root layout). Wordmark + nav + «Продать» CTA + account controls (login button or avatar). |
| **`Footer`** | `layout/footer.tsx` | **Every page.** |
| **`Container`** | `layout/container.tsx` | Nearly every page. `default` 1152px / `wide` 1536px (cabinet). |
| **`PageHeading`** | `layout/page-heading.tsx` | Catalog, sell, districts, all CRM pages. |
| **`Button`** | `ui/button.tsx` | Forms, toggles, cabinet. Variants primary/secondary/outline/ghost × sm/md/lg. |
| **`SearchBar`** | `home/SearchBar.tsx` | Homepage hero **and** catalog **and** SEO landing. Contains `DistrictCombobox`, `PriceInput`. |
| **`PropertyCard`** | `home/PropertyCard.tsx` | Homepage, catalog, similar, favorites, compare, realtor objects. Heart + compare toggles + price-drop badge. |
| **`PublicLeadInquiryForm`** | `inquiry/PublicLeadInquiryForm.tsx` | Property-detail modal, homepage inquiry, realtor contact modal. |
| **`AccountSidebar`** | `account/AccountSidebar.tsx` | All `/account/(cabinet)/*` pages. |
| `CrmPropertyFullForm` | `crm/CrmPropertyFullForm.tsx` | `/account/properties/new` + `/…/[id]` (create & edit). |
| `CrmPropertyTable` | `crm/CrmPropertyTable.tsx` | `/account/properties` **and** `/crm/properties`. |
| `PropertyCreateForm` | `crm/PropertyCreateForm.tsx` | `/account/properties` **and** `/crm/properties`. |
| `ui/modal` | `ui/modal.tsx` | Lead modal, realtor contact, duplicate-warning, owner modal. |
| `Breadcrumbs` | `layout/breadcrumbs.tsx` | Catalog, property detail, article detail, realtor, SEO landing. |
| `ArticlePreviewCard` / `ArticlesSection` | `articles/…`, `home/ArticlesSection.tsx` | Blog index **and** homepage «Статьи» — **two separate components** for the same data. |
| Empty-state card | Favorites / Compare / Sale-requests | Shared dashed-card empty state pattern. |
| 2GIS map (Leaflet) | `catalog/CatalogMap`, `property/PropertyMap`, `home/MapSection`, `crm/CrmPropertyAddressMap` | Homepage, catalog, property detail, CRM address picker. |
| ui primitives | `ui/{input,select,checkbox,radio-group,badge,card,pagination,section,upload-progress}.tsx` | Forms and tables across the site. |

---

## 4. Inconsistencies & issues spotted (visual + structural)

Ranked roughly by design impact. **None were fixed — discovery only.**

1. **Header is not responsive — no mobile menu.** At 390px the full nav + two buttons cram/wrap
   into the top bar (`01-homepage-mobile`, `03-property-detail-mobile`). No hamburger/drawer.
   **Highest-priority mobile fix.**

2. **CRM shows the public marketing header on top of the cabinet sidebar** (double chrome). Admin
   screens still carry the Каталог/Районы/«Продать недвижимость» marketing nav — a redesign should
   give the CRM its own shell.

3. **Two parallel CRM UIs** (`/account/(cabinet)/*` vs `/crm/*`) rendering the same components with
   different chrome (sidebar vs none). Redundant; consolidate to one.

4. **Two neutral+accent color systems.** Public = **gray-200 borders + blue-600**; cabinet =
   **slate borders + slate-50 bg + sky-700 links** (but its `Button` is still blue-600). Unify.

5. **Primary "button" hand-rolled in ≥3 places** instead of the shared `Button`: header CTA
   (inline `bg-blue-600` `Link`), `PropertyCard`'s «Открыть объект» (`PRIMARY_LINK_CLASS`), and the
   real `Button` component — they will drift.

6. **Same action, different button color.** «Показать телефон» is **blue** on the property detail
   card (`03`) but **black/dark** in the CRM inquiries table (`24`).

7. **Native, unstyled, English file inputs** on `/sell` («Фотографии» → `Choose Files`) **and**
   `/account/profile` («Фотография» → `Choose File`) — jarring against the Russian UI. Meanwhile the
   CRM property form (`22`) does it right with a styled Russian «Выбрать файлы». Inconsistent even
   within the app.

8. **CRM table values are unformatted.** `/account/properties` shows price `5000000.00` (no
   ₽, no thousands separators — vs the public site's `5 000 000 ₽`) and status `published` in raw
   English. Yet the owners table localizes status to «Опубликован» → status localization is
   inconsistent between CRM tables.

9. **Two map controls on the catalog page** — a «На карте» button inside the `SearchBar` filter card
   **and** a separate Списком/На карте results toggle. Duplicated affordance.

10. **Sparse dashboard.** `/account` («Панель») is just a profile card + text links — no metrics,
    counts, or recent-activity widgets a realtor dashboard would normally lead with.

11. **Login page: heading vs form alignment.** `/account/login` heading is left-aligned, form is
    centered; and `/account/login` (slate band) vs `/crm/login` (white) style the same form
    differently.

12. **Article body renders markdown lists as literal `- ` dashes** (not styled `<ul>`) — `07`.

13. **Ragged card heights** in the districts grid (`08`) — no height equalization.

14. **Duplicate placeholder owner avatars** in `/account/owners` (`26`) — both rows show the same
    stock photo.

15. **Sparse listing grids** (homepage «Новые объекты», catalog) — only one real property exists, so
    grids show a single left-aligned card with large empty space. A **data** limitation, but worth an
    intentional low-inventory state.

16. **Minor: same `PropertyCard`, different props** — homepage «Новые объекты» omits the
    characteristics line the catalog card shows.

17. **Orphan/aliased routes** — `/account/clients` and `/crm` are redirects; `/account/clients` isn't
    in the sidebar nav. Clean up the IA in a redesign.

**No hard rendering errors** were observed — every public and CRM route returned HTTP 200, none of
the authenticated pages bounced back to login, and no blocking console/hydration errors surfaced
during the crawl. (The «N» overlay is the Next.js dev indicator, not a bug.)

---

## 5. CRM authentication note

The only password documented anywhere in the project is the seed default `12345678`
(`create_initial_admin.py`, which targets `admin@admin.com` — an account that does **not** exist in
this DB). The three real accounts are `daitama@yandex.ru` (superadmin), `admin@admin.ru`
(superadmin), `vl@vl.ru` (realtor). Logging in through the app's own `/account/login` form with
`12345678` for all three returned **HTTP 401** (confirmed in the Django log) — the password is
genuinely wrong (matching the project's own "do not assume a default password" warning). Test files
only contain ephemeral `@example.com` accounts that live in the test DB, not the dev DB.

With the user's explicit approval, the CRM screenshots were then captured by minting a normal
SimpleJWT session token for the existing `admin@admin.ru` superadmin (`RefreshToken.for_user`) and
injecting it as the `centreal_access` cookie + localStorage — exactly what a real login would store.
**This is read-only: no account was created, no password was reset, and no auth logic or database
data was changed.**

---

## 6. Count summary

- **Distinct rendered page types found: 32**
  - **Public: 16** — homepage, catalog (list & map views = one route), property detail, favorites,
    compare, articles index, article detail, districts index, district detail, sell, realtor public,
    SEO landing, privacy, terms, `/account/login`, `/crm/login`.
    *(+ 2 shared overlay modals: lead inquiry, realtor contact.)*
  - **CRM cabinet (`/account/*`): 11** — dashboard, properties list, property new, property edit,
    inquiries, sale-requests list, sale-request **detail** (not shot — zero records), owners, profile,
    staff, activity-logs.
  - **Legacy CRM (`/crm/*`): 5** — dashboard, properties, leads, articles, users.
  - *(+ 2 redirect aliases, not counted: `/crm`, `/account/clients`.)*
- **Screenshots captured: 66** — 36 public (all 16 page types × desktop+mobile, catalog map view,
  2 modals) + 30 CRM (15 of 16 CRM routes × desktop+mobile; only the sale-request **detail** page is
  absent, because no sale-request records exist to open).
</content>
