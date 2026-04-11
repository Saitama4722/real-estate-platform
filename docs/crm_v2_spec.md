# CRM v2 — Employee cabinet and product specification

## Document control

| Field | Value |
|--------|--------|
| **Purpose** | Single implementation-ready product and technical specification for the next evolution of internal CRM |
| **Supersedes (for CRM UX scope)** | Ad-hoc CRM-as-`/crm` + mixed Django Admin workflows for day-to-day operations |
| **Does not replace** | `docs/project-rules.md`, `docs/mvp-scope.md` — this document narrows and extends **CRM and employee-facing** behavior only; geography, sale-only domain, and global exclusions remain governed by those documents unless explicitly updated there |
| **Stack assumption** | Existing repository: Django + DRF backend, Next.js (App Router) frontend, PostgreSQL, JWT session for staff (`/api/auth/login/`, bearer tokens) |

---

## 1. Product overview

### 1.1 What the product is

The platform is a **public real-estate showcase** (sale only, Krasnodar Krai scope per project rules) plus an **employee-facing product**: a **separate Employee cabinet** where administrators and realtors manage listings, **client inquiries**, profiles, and limited homepage content.

### 1.2 Core product decision

**CRM is not Django Admin.** Django Admin may remain installed for exceptional technical or data-maintenance tasks, but **all routine work** (objects, inquiries, staff, permissions, homepage text blocks, activity review) happens in the **Employee cabinet** UI.

### 1.3 Transformation summary

| Aspect | Previous direction (legacy) | Target (CRM v2) |
|--------|------------------------------|-----------------|
| Staff UI | CRM routes under `/crm`, articles/users partly “use Django Admin” | Unified **cabinet** under `/account` (names below), first-class UI for all daily tasks |
| Mental model | Internal tools + admin | **Product**: cabinet is the operational surface |
| Registration | Already absent for public users | **Unchanged**: no public signup; **realtors do not self-register** |
| Administrator | Superuser + admin roles in DB | **Administrator** capability: full visibility and staff control (maps to existing `superadmin` + `admin` roles) |
| Realtor | Scoped property/lead access | **Unchanged principle**: sees **only** own scope in cabinet; public site still shows full catalog |

---

## 2. MVP scope (strict)

### 2.1 In scope for CRM v2 MVP

1. **Employee cabinet** at route prefix **`/account`** (see §6): login, dashboard, properties, client inquiries, staff (admin only), profile, settings, activity/session visibility for admins.
2. **Authentication**: email + password only; **no** registration flows; accounts created only by an Administrator.
3. **Roles**: **Administrator** and **Realtor** as the only two **product** roles in MVP (see §3); implementation continues to use existing `User.Role` values (`superadmin`, `admin`, `realtor`) with **Administrator = `superadmin` ∪ `admin`**, **Realtor = `realtor`**.
4. **Realtor management** (Administrators): CRUD for realtor accounts, activate/deactivate, assign **CRM public IDs** (§7), set **MVP permission overrides** (§3.3).
5. **Property management** in cabinet: same business rules as today (draft / publish / archive, photos, videos, duplicate check on create) with **explicit CRM IDs** on properties (§8).
6. **Auto-generated listing title** for realtor-created (and admin-created) objects: system-generated from attributes; realtors do not type a free-form marketing title in MVP (aligns with existing `Property.title_generated` concept).
7. **Client inquiries** as the **core CRM entity**: unified model evolving from current **`Lead`** — website forms (object + general “ask a question”), captcha on public forms, assignment rules, statuses, notes, phone reveal + logging, sound alert for new items.
8. **Activity**: **login and logout** (or session end) logging visible to Administrators (§13).
9. **Homepage**: **limited inline editing** of predefined **text blocks** by Administrators only — not a page builder (§15).
10. **Public realtor pages**: profile card on site + **dedicated public page** per public realtor with their published listings (§16).
11. **Address + map + geocoding** in property form: address field, suggestions, geocode, map pin, manual adjust — **provider-agnostic** in spec (§17).
12. **Public site adjustments**: remove any **rent** entry points; add **Employee login** and **Ask a question** entry points (§15).

### 2.2 Explicitly out of MVP (see also §19)

- Public user accounts and client cabinet.
- In-site messaging or chat between client and staff; **phone-only** outbound contact from staff.
- Rent / lease deal type in UI and navigation.
- Full visual site builder, drag-and-drop layout editing, arbitrary new sections from the cabinet.
- Full granular ACL matrix (dozens of flags); **only** the small override set in §3.3.
- Moderator / third role behavior beyond reserving extensibility.
- Real-time push infrastructure mandatory for MVP (polling is sufficient for notifications).
- Multi-tenant marketplace, external agency onboarding, call-center suite, email drip campaigns, advanced analytics.

---

## 3. Roles and permissions system

### 3.1 Product roles

**Administrator**

- Full read/write on all properties, all inquiries, all staff records (within this product).
- Creates, edits, deactivates realtor accounts; sets permission overrides.
- Views **all** activity logs required in this spec (sessions, phone reveals, status changes).
- Edits **homepage text blocks** (§15).
- **Does not** impersonate realtor or send messages **as** realtor; **does not** operate in-app chat with clients (there is no chat).

**Realtor**

- In cabinet: sees **only** properties in scope per §9 (same ownership rules as today: `assigned_realtor` or, if unset, `created_by`).
- Sees **only** inquiries in scope: assigned to them or tied to a property they own in cabinet (same principle as current `crm_lead_queryset_for_user`).
- Updates inquiry status, adds notes, uses **Reveal phone** on client numbers where allowed.
- Edits **own profile** fields exposed in cabinet (public name, phone, photo, bio, visibility flag) — backed by `RealtorProfile` and user name fields.
- **Cannot** delete properties or inquiries unless **explicitly granted** by Administrator (§3.3).

### 3.2 Default capability matrix (MVP)

| Capability | Administrator | Realtor (default) |
|------------|---------------|-------------------|
| List/view all properties | Yes | No (scoped only) |
| Create property | Yes | Yes |
| Edit property (own) | Yes | Yes |
| Edit property (any) | Yes | No |
| Delete / archive per product rules | Yes | Archive only if business allows; **hard delete** No unless override |
| Publish / unpublish / draft | Yes | Yes if current API allows; otherwise align API with this matrix in implementation |
| List/view all inquiries | Yes | No (scoped) |
| Change inquiry status | Yes | Yes (own scope) |
| Add inquiry notes | Yes | Yes (own scope) |
| Reveal client phone (with audit) | Yes | Yes |
| Delete inquiry record | Yes | **No** (unless override) |
| Manage staff | Yes | No |
| Edit homepage blocks | Yes | No |
| View staff session logs | Yes | No |

Implementation must reconcile this matrix with existing DRF permissions (`IsCrmUser`, object checks) in one coherent pass.

### 3.3 Administrator-granted overrides (MVP — minimal)

Stored per realtor user (or attached profile), editable only by Administrator:

| Override key | Meaning | Default for realtor |
|--------------|---------|---------------------|
| `can_delete_own_property` | May permanently delete or execute destructive delete action on **own** listings where product allows | `false` |
| `can_delete_inquiry` | May delete **inquiry** rows they can access | `false` |

All other capabilities follow §3.2 until a future phase adds more flags. **No** per-field UI permission editor in MVP.

---

## 4. Authentication model

### 4.1 Rules

- **Identifiers**: email (unique) + password.
- **No** public registration, **no** self-service password reset in MVP unless already present; if added later, it must remain staff-only flows.
- **Account lifecycle**: Administrator creates user, sets role to `realtor` or promotes to `admin` / `superadmin` per business; **realtor never self-registers**.

### 4.2 Session

- MVP continues **JWT access** (and refresh if present) as today; tokens stored in client per current SPA pattern.
- **Logout** is an explicit client action that discards tokens and **records** session end server-side when the logout API is called (§13).

### 4.3 Route naming

- Employee login page: **`/account/login`** (replace `/crm/login` as canonical entry; may keep redirect from `/crm/login` for one release).

---

## 5. Employee cabinet architecture (`/account`)

### 5.1 URL map (canonical)

| Path | Audience | Purpose |
|------|----------|---------|
| `/account/login` | Staff | Login |
| `/account` | Staff | Dashboard / redirect to dashboard |
| `/account/dashboard` | Staff | Summary: counts, new inquiries, shortcuts |
| `/account/properties` | Staff | Property list + create + edit flows |
| `/account/properties/new` | Staff | Creation wizard |
| `/account/properties/[id]` | Staff | Edit existing |
| `/account/inquiries` | Staff | Client inquiries list (name TBD: “Клиенты и вопросы”) |
| `/account/inquiries/[id]` | Staff | Inquiry detail |
| `/account/staff` | Administrator only | Realtor/staff list + create + edit |
| `/account/staff/[id]` | Administrator only | Staff detail, overrides, activity snippet |
| `/account/profile` | Staff | Current user profile + realtor public fields |
| `/account/settings` | Staff | Password change (if in scope), notification prefs (minimal) |
| `/account/activity` | Administrator only | Session / security log |

**`/crm/*`**: deprecated aliases; redirect to `/account/*` until removed.

### 5.2 Technical boundaries

- **Frontend**: Next.js App Router under `src/app/account/...`; shared layout with role-based nav.
- **Backend**: existing `/api/crm/...` namespaces may remain; prefer **clear cabinet API** prefix `/api/account/...` only if migration is staged — spec-level requirement is **behavior**, not URL string, but **no** reliance on Django Admin for these flows.

### 5.3 Separation from Django Admin

- Staff daily work **never** requires opening `/admin/`.
- Django Admin may still register models for emergency use; documentation should state it is **not** the CRM product.

---

## 6. Realtor management (administrator side)

### 6.1 Administrator actions

- **Create** realtor: email, password (or invite flow out of MVP — use direct password set by admin in MVP), first/last name, phone, role `realtor`, optional agency link, `is_active`.
- **Edit** same fields + `RealtorProfile` public fields.
- **Deactivate** user (`is_active=false`): cannot log in; existing data retained.
- **Delete** user: **product decision** — soft-delete or block only in MVP; hard delete is dangerous; recommend **deactivate** as default action. If hard delete is required, it is Administrator-only and out of default MVP unless legally mandated.

### 6.2 Realtor public profile flags

- `RealtorProfile.is_public` controls appearance on public pages.
- Administrator can toggle visibility; realtor can request fields but Administrator may enforce policy.

---

## 7. CRM public ID system (RID / PID)

### 7.1 Goals

- Human-friendly, **unique**, **immutable** identifiers for UI, phone calls, and support.
- Distinct prefixes for **people** vs **properties** to avoid confusion.

### 7.2 Realtor ID (RID)

- **Format**: `RID` + 6-digit zero-padded decimal, e.g. `RID000042`.
- **Uniqueness**: global; enforced in DB with unique constraint.
- **Generation**: on realtor profile creation (or first role=realtor assignment), single transaction, sequence or `SELECT MAX` + retry — implementation detail; **no** manual edit.

### 7.3 Property ID (PID)

- **Format**: `PID` + 6-digit zero-padded decimal, e.g. `PID000104`.
- **Uniqueness**: global; immutable; shown in cabinet and optionally on internal printouts — **not** replacing public SEO `slug` for URLs.
- **Generation**: on `Property` insert.

### 7.4 Internal numeric PK

- Database integer PKs remain; **RID/PID** are additional stable business identifiers.

---

## 8. Property management logic (administrator vs realtor)

### 8.1 Scope of visibility

- **Administrator**: all properties.
- **Realtor**: properties where `assigned_realtor == user` OR (`assigned_realtor` IS NULL AND `created_by == user`) — same rule as `crm_property_queryset_for_user`.

### 8.2 Create / edit

- Both roles use the same form components; **title** is **system-generated** from structured fields (type, rooms, area, district/city, deal type sale-only) and stored in `title_generated` (and drives public title where applicable).
- **Address**: §17; coordinates feed public approximate map rules already in project.

### 8.3 Delete and archive

- **Archive** follows existing publication state machine (`archived`, `archived_at`, etc.).
- **Hard delete**: Administrator-only in MVP; realtor **only** if `can_delete_own_property` is true and product allows delete for that state.

### 8.4 Assignment

- Administrator may set `assigned_realtor` on any property.
- Realtor may suggest or leave default on create (implementation: default `assigned_realtor` = creator unless admin flow).

---

## 9. Client inquiries system (core CRM entity)

### 9.1 Definition

A **client inquiry** is a record created when a visitor submits:

- **Object inquiry**: from property card / property page — must link `property` FK.
- **General question**: from homepage (or header) — `property` is null.

**Implementation note**: extend existing **`Lead`** model and APIs; add `source` or `kind` distinction if needed (`website_property`, `website_general`).

### 9.2 Public form: “Ask a question”

- **Fields**: client name (required), client phone (required), message text (required).
- **Captcha**: required on this form — MVP implementation: **simple** challenge (e.g. server-signed honeypot + arithmetic, or lightweight widget); must stop naive bots; upgrade path to enterprise captcha later.
- **Consent**: keep GDPR-style consent checkbox aligned with existing lead form pattern; server may store consent flag in same step as future hardening.
- **Throttle**: retain IP-based throttling analogous to existing public lead throttle.

### 9.3 Assignment

- **With property**: assign `assigned_realtor` from property’s effective public contact realtor (`PropertyContact` / `RealtorProfile` rules); if none, fallback to agency default or administrator round-robin — **MVP rule**: assign to **`assigned_realtor`** on property, else **`created_by`** of property, else **unassigned** pool visible only to Administrators until manually assigned.
- **General**: **unassigned** queue for Administrators; Administrators manually assign to a realtor.

### 9.4 Administrator visibility

- View all inquiries, all fields, all notes, status history, who revealed phone, session context if needed.
- **No** “reply as realtor” and no chat UI.

### 9.5 Realtor visibility

- Same rules as leads today: assigned to them OR property in their scoped queryset.

---

## 10. Status lifecycle for inquiries (leads)

### 10.1 MVP statuses

Canonical workflow states (align labels with Russian UI):

| Code | Label (example) | Meaning |
|------|------------------|---------|
| `new` | Новый | Just created |
| `in_progress` | В работе | Realtor opened / started handling |
| `called` | Связались с клиентом | Successful contact attempt completed |
| `no_answer` | Нет ответа | Did not reach |
| `recall_later` | Перезвонить позже | Scheduled follow-up |
| `closed` | Обработано / завершено | Successfully completed (use clear Russian label in UI, e.g. «Завершено») |
| `rejected` | Отклонён | Spam / invalid / not pursued |

### 10.2 “Viewed” state

- **Do not** require a separate DB status for “viewed” in MVP if it duplicates noise.
- **Requirement**: persist **first_viewed_at** (inquiry row or activity table) when a realtor or admin opens the detail screen.

### 10.3 Transitions

- Valid transitions are **liberal** in MVP: any status → any other, logged in history (§12).
- **UI copy** for primary actions (e.g. **«Связался с клиентом»**, **«Завершить обработку»**) maps to transitions into `called` / `closed` as product defines in UI layer.

### 10.4 History

- Retain and extend **`LeadStatusHistory`** pattern: each change stores `previous_status`, `new_status`, `changed_by`, timestamp.

---

## 11. Phone reveal + logging (client)

### 11.1 Behavior

- Client phone is **masked** in list and initial detail until user clicks **«Показать телефон»**.
- On click, server returns full number and writes an **audit row**: inquiry id, user id, timestamp, IP, user-agent (same pattern as `PhoneRevealLog` for property).

### 11.2 Rate limiting

- Apply per-IP and/or per-user throttle consistent with property reveal policy.

---

## 12. Notes system

### 12.1 Inquiry notes

- **Thread** of text notes on an inquiry, append-only in MVP (no edit/delete except Administrator optional — default **no delete**).
- **`LeadComment`** model can serve this; display author and timestamp.

### 12.2 Internal vs visible

- MVP: single note type; **no** complex visibility levels. Administrators’ notes are visible to all who can see the inquiry (future: `is_admin_only` flag — **not** in MVP).

---

## 13. Activity logs (login / logout tracking)

### 13.1 Staff session events

For each login and logout:

- `user`, `event` (`login` | `logout`), `created_at`, `ip_address`, `user_agent`, optional `session_id` / JWT `jti` if used.

### 13.2 Administrator UI

- Filterable list: user, time range, event type.
- **Session duration**: derived from login to next logout for same session identifier; if client closes browser without logout, **idle timeout** may create implicit session end — MVP acceptable approach: record **logout** only on explicit API call; show “last seen” from last authenticated request optionally as phase 1.5.

### 13.3 Security

- Retain logs for at least **90 days** (configurable); access Administrator-only.

---

## 14. Notifications (sound alert)

### 14.1 Trigger

- When a **new** inquiry is assigned to a realtor, play a **short** notification sound on cabinet load or on next **poll** detection of unseen count increase.

### 14.2 Implementation (MVP)

- **Polling** every N seconds (e.g. 30–60) for `count(new inquiries since last_ack)` or server flag `has_unseen`.
- **Sound**: single bundled asset (brief “message-in” style); user preference **mute** in `/account/settings` (persist per user).

### 14.3 Non-goals

- No WebSocket requirement in MVP.
- No mobile push.

---

## 15. Homepage editable content (limited inline editing)

### 15.1 What it is

- **Not** a Wix-like builder. **Not** layout editing.
- **Yes**: Administrator, on the **public homepage** (while authenticated with Administrator role), can click **predefined** text regions and edit **rich/plain text** in-place, **Save** to backend, immediate public effect.

### 15.2 Block model

- Data-driven **keyed blocks**, e.g. `hero_subtitle`, `seo_intro`, `benefits_column_1`, etc., stored in DB (`HomepageContentBlock`: `key`, `locale`, `body`, `updated_at`, `updated_by`).
- Only keys whitelisted in frontend may render edit chrome.

### 15.3 Out of scope

- Reordering sections, adding new sections, uploading arbitrary images inside WYSIWYG in MVP (hero image remains code/CMS phase 2 unless already a dedicated field).

### 15.4 Public site CTAs (MVP)

- **Remove** rent/scenario buttons that imply rental.
- **Add** “**Вход в личный кабинет**” → `/account/login`.
- **Add** “**Задать вопрос**” → modal with §9.2 form.

---

## 16. Public realtor pages

### 16.1 Requirements

- **API**: list `RealtorProfile` with `is_public=true` with slug or id for linking; include public name, photo URL, phone, agency.
- **Routes**: `/realtors` (optional index) and **`/realtors/[slug]`** detail with bio + grid of **published** listings for that realtor (filter `assigned_realtor` + published state).

### 16.2 Property card CTA

- From property public page, link “View all listings by this realtor” when profile public.

---

## 17. Address, map, and geocoding (abstract)

### 17.1 User flow

1. User types address in **Address** field.
2. System shows **suggestions** (autocomplete).
3. On select, system runs **geocoding** → obtains `latitude` / `longitude` (and normalized address string if provider returns it).
4. Map centers on point; user may **drag** pin to adjust.
5. Stored: structured address fields already on `Property` + coordinates used for public **approximate** map display per privacy rules.

### 17.2 Provider neutrality

- Spec assumes a **pluggable** `GeocodingProvider` interface (autocomplete + geocode). Choice of Google / Yandex / OSM is **deployment decision** based on cost, ToS, and accuracy; **no** provider named in business rules.

### 17.3 Geography constraints

- Autocomplete and validation must respect **project geography** (Krasnodar + Gelendzhik hierarchy); implementation may constrain bias region in provider options.

---

## 18. UX principles (administrator vs realtor)

### 18.1 Administrator

- **Density with control**: tables with filters (status, realtor, date, PID), bulk read, quick jump to staff and logs.
- **Transparency**: every sensitive action (phone reveal, status) traceable.
- **No clutter**: separate **Staff**, **Inquiries**, **Properties**, **Activity**, **Homepage blocks** (edit mode entry).

### 18.2 Realtor

- **Focus**: default dashboard shows **my new inquiries** and **my drafts**.
- **Mobile-first** responsive layout (per project rules).
- **Clear primary actions** on inquiry: reveal phone, change status, add note.
- **Tone**: operational, not marketing admin.

### 18.3 Shared

- Russian UI copy; consistent with existing component library (Tailwind, existing UI primitives).

---

## 19. What is not included in MVP (consolidated)

- Rental deal type and any “rent” navigation or filters on public site.
- Public registration and client cabinet.
- Chat, messaging threads, email-to-client from cabinet.
- Full ACL editor; more than two boolean overrides per realtor.
- Arbitrary homepage layout builder; new arbitrary dynamic page types.
- WebSocket / SSE real-time stack as a requirement.
- Call recording, telephony integration, automatic dialer.
- Multi-agency competitive listing across unrelated agencies (agency field may exist but marketplace dynamics are out).
- Import pipeline redesign (existing import remains as in project-rules 14.6).

---

## 20. Future scalability notes (short)

- **Real-time**: upgrade notification channel from polling to WebSocket or SSE with same event model.
- **Granular permissions**: role templates + many optional flags; department scopes.
- **Client portal**: optional logged-in client to see status (major product shift).
- **Moderator role**: content moderation, limited property edits without full admin.
- **Additional captcha providers** and fraud scoring.
- **Homepage blocks**: expand to JSON schema for controlled components (still not freeform builder).
- **Geocoding**: switch provider via settings without code changes beyond adapter config.

---

## Appendix A — Traceability to current codebase

| Spec area | Current anchor |
|-----------|----------------|
| User roles | `users.models.User.Role` |
| Property scope | `users.permissions.crm_property_queryset_for_user` |
| Lead scope | `users.permissions.crm_lead_queryset_for_user` |
| Lead model | `leads.models.Lead`, `LeadComment`, `LeadStatusHistory` |
| Property phone reveal | `PhoneRevealLog`, `reveal_phone` action |
| Auto title field | `Property.title_generated` |
| Staff JWT | `/api/auth/login/`, CRM APIs under `/api/crm/` |

This appendix is for engineers; the **source of truth** for product behavior is the numbered sections above.
