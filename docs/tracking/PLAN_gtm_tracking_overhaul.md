# GTM Tracking Overhaul — OneForma
**Created:** 2026-04-13
**Status:** Ready to implement
**Principle:** Everything runs in GTM + GA4. Zero external backend dependency. Standalone.

---

## PART 1: FIX EXISTING ISSUES (Day 1)

### Fix 1.1 — `urm_content` typo → `utm_content`
- **Variable 17** (`Query Parameter – utm_content`) has `queryKey = urm_content`
- Fix: Change to `utm_content`
- Impact: Recruiter channel tracking via utm_content has been silently broken

### Fix 1.2 — `apply_click` sends to wrong property
- **Tag 43** (`GA4 – Apply Click`) sends to `G-D36BJJJV7S` (MyOneforma internal)
- Fix: Either duplicate the tag to ALSO send to `G-QYQZLRHQFR`, or change the measurementIdOverride
- Note: GA4 may already be picking this up via the config tag — verify first

### Fix 1.3 — Mark key events as GA4 conversions
- In GA4 Admin → Events → Mark as conversion:
  - `apply_click` ← currently not a conversion
  - `job_apply_click` ← currently not a conversion
  - `survey_complete` ← verify if marked
  - `Start Humus Survey` ← verify if marked
- This is a GA4 UI change, not GTM

### Fix 1.4 — Tighten Survey_Completion trigger
- **Trigger 22** fires on ANY `/thank-you` URL across the entire site
- Fix: Add additional filter for Humus-specific paths
- OR: Keep broad but add a custom parameter `survey_type` derived from the page path

---

## PART 2: ADD MISSING EVENT TAGS (Day 1-2)

### Add 2.1 — `job_apply_click` GTM tag
- Currently fired by OneForma platform JS, NOT managed by GTM
- Add explicit GA4 Event tag → `G-QYQZLRHQFR`
- Trigger: Custom Event matching the platform's dataLayer push
- Benefit: Controlled, consistent, auditable

### Add 2.2 — `register_click` GTM tag
- Same as above — currently platform-only
- Add GA4 Event tag with relevant parameters (page_path, referrer)

### Add 2.3 — `login_click` GTM tag
- Same pattern

### Add 2.4 — Survey type parameter
- On the `survey_complete` tag, add event parameter: `survey_type`
- Value: Lookup Table variable based on Page Path
  - `/humus-new-participant-demographics-survey/thank-you` → `humus_adult`
  - `/humus-minor-demographics-survey-copy/thank-you` → `humus_minor`
  - Default → `other`
- Also add `survey_parent_page` parameter = `{{Page Path}}` minus `/thank-you`

---

## PART 3: ENHANCED UTM PERSISTENCE (Day 2)

### Problem
UTM parameters are lost after the landing page. User clicks tracked link → lands on `/humus-twins/` with UTMs → navigates to `/jobs/humus-3-adults/` → UTMs are gone from URL.

### Solution: Cookie-Based UTM Persistence (Custom HTML Tag)

Deploy a lightweight Custom HTML tag in GTM that:
1. On any page with UTM params → saves them to a first-party cookie (`_of_utm`, 30-day expiry)
2. On any page WITHOUT UTM params → reads from cookie
3. Passes values as GA4 custom dimensions on every event

```
Cookie: _of_utm = {
  source: "job_board",
  medium: "referral",
  campaign: "humus-adults",
  content: "indeed",
  term: "recruiter01",
  landing: "/jobs/humus-3-adults/",
  timestamp: 1712000000
}
```

### GA4 Custom Dimensions to Create
| Dimension Name | Scope | Source | Purpose |
|---|---|---|---|
| `original_utm_source` | Session | Cookie | Persisted source across pages |
| `original_utm_medium` | Session | Cookie | Persisted medium |
| `original_utm_campaign` | Session | Cookie | Persisted campaign |
| `original_utm_content` | Session | Cookie | Persisted content (recruiter channel) |
| `original_utm_term` | Session | Cookie | Persisted term (recruiter ID) |
| `landing_page_path` | Session | Cookie | Where user first entered |

---

## PART 4: STANDALONE CROSS-DEVICE IDENTITY (Day 2-3)

### The Vyra Extraction — What We Take

Extract ONLY these functions from Vyra's tracking pixel into a standalone GTM Custom HTML tag. No Vyra API, no external server. Everything stores in GA4 via custom dimensions.

### 4.1 — Persistent Visitor ID (from vyra-tracking.js)

```javascript
// Standalone — no Vyra dependency
(function() {
  var COOKIE_NAME = '_of_vid';
  var COOKIE_DAYS = 365;

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax;Secure';
  }

  function generateId() {
    return 'of_' + 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, function() {
      return (Math.random() * 16 | 0).toString(16);
    });
  }

  // Get or create visitor ID
  var vid = getCookie(COOKIE_NAME) || localStorage.getItem(COOKIE_NAME);
  if (!vid) {
    vid = generateId();
  }
  setCookie(COOKIE_NAME, vid, COOKIE_DAYS);
  localStorage.setItem(COOKIE_NAME, vid);

  // Push to dataLayer for GA4
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    'of_visitor_id': vid,
    'of_is_new_visitor': !getCookie(COOKIE_NAME + '_seen'),
  });

  if (!getCookie(COOKIE_NAME + '_seen')) {
    setCookie(COOKIE_NAME + '_seen', '1', COOKIE_DAYS);
  }
})();
```

- **Deployed as:** GTM Custom HTML tag, fires on All Pages, priority 100 (before GA4)
- **Data flows to:** GA4 custom dimension `of_visitor_id` via dataLayer variable
- **No external dependency**

### 4.2 — Session ID with Rolling Window

```javascript
(function() {
  var SESSION_COOKIE = '_of_sid';
  var SESSION_TTL = 30; // minutes

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function setCookie(name, value, minutes) {
    var d = new Date();
    d.setTime(d.getTime() + minutes * 60000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax;Secure';
  }

  function generateId() {
    return 'os_' + 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, function() {
      return (Math.random() * 16 | 0).toString(16);
    });
  }

  var sid = getCookie(SESSION_COOKIE) || sessionStorage.getItem(SESSION_COOKIE);
  if (!sid) {
    sid = generateId();
  }
  // Rolling 30-min window
  setCookie(SESSION_COOKIE, sid, SESSION_TTL);
  sessionStorage.setItem(SESSION_COOKIE, sid);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'of_session_id': sid });
})();
```

### 4.3 — Identity Stitch on Registration/Login (from vyra identity.py)

```javascript
// Fires ONLY on registration/login success pages
(function() {
  // Wait for email field to be available
  function getEmail() {
    // Adjust selector to match OneForma's registration form
    var emailField = document.querySelector('input[type="email"], input[name="email"]');
    return emailField ? emailField.value : null;
  }

  async function hashEmail(email) {
    var normalized = email.toLowerCase().trim();
    var encoded = new TextEncoder().encode(normalized);
    var hash = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // On form submit
  document.addEventListener('submit', async function(e) {
    var email = getEmail();
    if (email && email.includes('@')) {
      var emailHash = await hashEmail(email);
      var vid = getCookie('_of_vid') || localStorage.getItem('_of_vid');

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        'event': 'of_identity_stitch',
        'of_email_hash': emailHash,
        'of_visitor_id': vid,
        'of_stitch_type': 'registration'
      });
    }
  });
})();
```

- **GA4 receives:** `of_email_hash` as user-scoped custom dimension
- **Cross-device stitch:** When same email registers on different devices, GA4's User-ID feature + `of_email_hash` dimension links them
- **Privacy:** Only SHA-256 hash transmitted, never raw email

### 4.4 — Cross-Domain Linker (from vyra crosstrex_handoff.py)

For oneforma.com ↔ aidaform.com survey flow:

```javascript
(function() {
  var ALLOWED_HOSTS = ['oneforma.com', 'www.oneforma.com', 'oneforma.aidaform.com'];
  var PARAM_NAME = '_ofxd';

  function getIds() {
    return {
      vid: getCookie('_of_vid') || localStorage.getItem('_of_vid') || '',
      sid: getCookie('_of_sid') || sessionStorage.getItem('_of_sid') || ''
    };
  }

  // On page load: check for incoming handoff
  var url = new URL(window.location.href);
  var token = url.searchParams.get(PARAM_NAME);
  if (token) {
    try {
      var decoded = JSON.parse(atob(token));
      if (decoded.vid) {
        setCookie('_of_vid', decoded.vid, 365);
        localStorage.setItem('_of_vid', decoded.vid);
      }
      if (decoded.sid) {
        setCookie('_of_sid', decoded.sid, 30);
        sessionStorage.setItem('_of_sid', decoded.sid);
      }
      // Clean URL
      url.searchParams.delete(PARAM_NAME);
      history.replaceState(null, '', url.toString());

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        'event': 'of_cross_domain_entry',
        'of_source_domain': decoded.src || 'unknown'
      });
    } catch(e) {}
  }

  // Decorate outbound links to allowed hosts
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;

    try {
      var href = new URL(link.href);
      var targetHost = href.hostname.replace('www.', '');
      var currentHost = window.location.hostname.replace('www.', '');

      if (targetHost !== currentHost && ALLOWED_HOSTS.some(h => targetHost.includes(h))) {
        var ids = getIds();
        var payload = btoa(JSON.stringify({
          vid: ids.vid,
          sid: ids.sid,
          src: currentHost,
          t: Date.now()
        }));
        href.searchParams.set(PARAM_NAME, payload);
        link.href = href.toString();
      }
    } catch(e) {}
  }, true);
})();
```

- **No server required** — token is base64-encoded JSON (not HMAC signed, but sufficient for first-party cross-domain)
- **Simpler than Vyra** — no nonce replay protection needed for first-party use
- **Works for:** oneforma.com → aidaform.com survey flow and back

### GA4 Custom Dimensions for Identity

| Dimension | Scope | Purpose |
|---|---|---|
| `of_visitor_id` | User | Persistent cross-session visitor identity |
| `of_session_id` | Session | 30-min rolling session ID |
| `of_email_hash` | User | SHA-256 email for cross-device matching |
| `of_is_cross_domain` | Event | True when user arrived via cross-domain handoff |
| `of_stitch_type` | Event | How identity was resolved (registration, login) |

---

## PART 5: ENHANCED FUNNEL TRACKING (Day 3)

### 5.1 — Full Humus Funnel Events

Add tags for every step in the Humus journey:

| Step | Event Name | Trigger | Property |
|---|---|---|---|
| 1 | `humus_landing_view` | PV on /humus-twins/, /humus3-minors/ | G-QYQZLRHQFR |
| 2 | `humus_job_view` | PV on /jobs/humus-3-adults/, /jobs/humus-3-kids/ | G-QYQZLRHQFR |
| 3 | `apply_click` | Existing (fix property) | G-QYQZLRHQFR |
| 4 | `job_apply_click` | New tag (from dataLayer) | G-QYQZLRHQFR |
| 5 | `register_click` | New tag | G-QYQZLRHQFR |
| 6 | `humus_survey_start` | Existing survey_start_view (rename) | G-QYQZLRHQFR |
| 7 | `humus_survey_complete` | Existing Survey Completion (add survey_type param) | G-QYQZLRHQFR |

### 5.2 — Event Parameters on Every Tag

Every GA4 event tag should include these parameters (via GTM variables reading dataLayer + cookies):

```
of_visitor_id: {{DLV - of_visitor_id}}
of_session_id: {{DLV - of_session_id}}
of_utm_source: {{Cookie - _of_utm}}.source (or current page UTM)
of_utm_campaign: {{Cookie - _of_utm}}.campaign
of_utm_term: {{Cookie - _of_utm}}.term (recruiter ID)
page_path: {{Page Path}}
page_referrer: {{Referrer}}
```

---

## PART 6: RECRUITER ATTRIBUTION (Day 3)

### 6.1 — Recruiter ID Extraction

Create a GTM variable that extracts `recruiter_XX` from `utm_term`:

```javascript
function() {
  var term = {{Query Parameter – utm_term}} || '';
  if (term.match(/^recruiter\d+/)) {
    return term;
  }
  // Check persisted cookie
  try {
    var utm = JSON.parse(getCookie('_of_utm') || '{}');
    if (utm.term && utm.term.match(/^recruiter\d+/)) return utm.term;
  } catch(e) {}
  return '(none)';
}
```

### 6.2 — GA4 Custom Dimension
| Dimension | Scope | Source |
|---|---|---|
| `recruiter_id` | Session | Extracted from utm_term |
| `recruiter_channel` | Session | Extracted from utm_content |

---

## IMPLEMENTATION CHECKLIST

### Day 1 — Fixes
- [ ] Fix Variable 17: `urm_content` → `utm_content`
- [ ] Fix Tag 43: Add `G-QYQZLRHQFR` as additional measurement ID for apply_click
- [ ] Mark `apply_click`, `job_apply_click`, `survey_complete` as GA4 conversions
- [ ] Add `survey_type` parameter to Survey Completion tag (Lookup Table from Page Path)
- [ ] Add `survey_parent_page` parameter (Page Path minus /thank-you)

### Day 2 — Missing Tags + UTM Persistence
- [ ] Add `job_apply_click` GA4 event tag
- [ ] Add `register_click` GA4 event tag
- [ ] Add `login_click` GA4 event tag
- [ ] Deploy UTM persistence cookie tag (Custom HTML)
- [ ] Create GA4 custom dimensions for persisted UTMs
- [ ] Deploy standalone visitor_id tag (Custom HTML)
- [ ] Deploy standalone session_id tag (Custom HTML)
- [ ] Create GA4 custom dimensions: of_visitor_id, of_session_id

### Day 3 — Cross-Domain + Identity + Funnel
- [ ] Deploy cross-domain linker tag for oneforma.com ↔ aidaform.com
- [ ] Deploy identity stitch tag on registration/login pages
- [ ] Create GA4 custom dimension: of_email_hash (user-scoped)
- [ ] Add humus_landing_view and humus_job_view tags
- [ ] Add consistent event parameters (visitor_id, session_id, UTMs) to ALL tags
- [ ] Create recruiter_id and recruiter_channel variables + dimensions
- [ ] QA: Test full funnel in GTM Preview mode
- [ ] Publish new version

---

## WHAT THIS GIVES US (without Vyra dashboard)

### In GA4 Explore reports:
- Segment by `of_visitor_id` to see cross-session journeys
- Segment by `of_email_hash` to see cross-device users
- Filter by `recruiter_id` for recruiter-level attribution
- `survey_type` dimension distinguishes adult vs minor surveys
- Persisted UTMs show original acquisition source on every event

### In Looker Studio:
- Build recruiter leaderboard dashboard connected to GA4
- Full funnel visualization: landing → job view → apply → survey start → survey complete
- Cross-domain journey: oneforma.com → aidaform.com → thank-you tracked as one session
- First-touch attribution using persisted UTM dimensions

### What we CAN'T do without Vyra backend:
- True multi-touch attribution model comparison (first, last, linear, time_decay, markov)
- Journey-level path analysis (individual user journeys)
- HIE behavioral data (heatmaps, session replay, scroll depth per user)
- Real-time handoff monitoring
- Server-side identity resolution

These are Phase 2 (Vyra deployment) capabilities. Phase 1 (this plan) gives us 80% of the value with zero infrastructure dependency.

---

## ARCHITECTURE DIAGRAM

```
                    GTM Container (GTM-NR965959)
                    ┌─────────────────────────────────────┐
                    │                                     │
  User clicks       │  Custom HTML Tags (standalone):     │
  recruiter link    │  ├─ Visitor ID generator            │
  with UTMs         │  ├─ Session ID (30-min rolling)     │
       ↓            │  ├─ UTM persistence cookie          │
  Lands on          │  ├─ Cross-domain linker             │
  oneforma.com      │  └─ Identity stitch (on reg/login)  │
       ↓            │                                     │
  GTM fires         │  GA4 Event Tags:                    │
  tags              │  ├─ humus_landing_view              │
       ↓            │  ├─ humus_job_view                  │
  User navigates    │  ├─ apply_click (FIXED property)    │
  to job page       │  ├─ job_apply_click (NEW)           │
       ↓            │  ├─ register_click (NEW)            │
  Clicks apply      │  ├─ login_click (NEW)               │
       ↓            │  ├─ humus_survey_start              │
  Redirects to      │  └─ humus_survey_complete           │
  aidaform.com      │      + survey_type param            │
  (cross-domain     │      + survey_parent_page param     │
   linker passes    │                                     │
   _ofxd token)     │  All tags include:                  │
       ↓            │  ├─ of_visitor_id                   │
  Completes         │  ├─ of_session_id                   │
  survey            │  ├─ persisted UTM params             │
       ↓            │  ├─ recruiter_id                    │
  Redirects back    │  └─ recruiter_channel               │
  to thank-you      │                                     │
  page              └─────────────────────────────────────┘
       ↓                            │
  survey_complete                   ↓
  fires with ALL             GA4 Property
  context params          G-QYQZLRHQFR (330157295)
                          ┌──────────────────────┐
                          │ Custom Dimensions:    │
                          │ ├─ of_visitor_id      │
                          │ ├─ of_session_id      │
                          │ ├─ of_email_hash      │
                          │ ├─ original_utm_*     │
                          │ ├─ recruiter_id       │
                          │ ├─ recruiter_channel  │
                          │ ├─ survey_type        │
                          │ └─ is_cross_domain    │
                          │                      │
                          │ Marked as Conversions:│
                          │ ├─ apply_click        │
                          │ ├─ job_apply_click    │
                          │ └─ survey_complete    │
                          └──────────────────────┘
                                    │
                                    ↓
                           Looker Studio / GA4 Explore
                           (no custom app needed)
```
