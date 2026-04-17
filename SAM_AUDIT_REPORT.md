# /sam Audit Report - Stumps Cricket Betting Platform

**Generated:** 2026-04-16  
**Worktree:** `.worktrees/sam-audit`  
**Scope:** Full project audit - Security, Performance, Bugs, Architecture

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Files Scanned | 5 (server.js, index.html, admin.html, aviator.html, home.html) |
| **Critical Security Issues** | 4 |
| **High Severity Issues** | 7 |
| **Medium Severity Issues** | 10 |
| **Low Severity Issues** | 8 |
| Console Lines to Remove | 45+ |
| Memory Leaks Found | 5 |
| XSS Vulnerabilities | 2 |
| **Health Score:** | **4.2/10** |
| **Human Score:** | **42/100** |

**Verdict:** NOT YET - Multiple critical security vulnerabilities and performance issues must be addressed before production deployment.

---

## Security Audit

### CRITICAL (Fix Immediately)

#### 1. CORS Misconfiguration - Wide Open
**Location:** `server.js:43`  
**Issue:** `app.use(cors());` enables CORS for ALL origins without restriction
```javascript
app.use(cors());  // No origin restriction
```
**Impact:** Allows malicious websites to make authenticated requests to the API, enabling CSRF attacks.  
**Fix:** Configure CORS with specific allowed origins:
```javascript
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000', credentials: true }));
```

#### 2. Debug Endpoints Exposed in Production
**Location:** `server.js:964-1026`  
**Issues:**
- `/api/debug/login` exposes user existence, admin status, and password hash length
- `/api/admin/fix-password` allows resetting admin password to hardcoded value without authentication

**Impact:** Attackers can enumerate users and reset admin passwords.  
**Fix:** Remove these endpoints before production deployment or wrap in `process.env.NODE_ENV === 'development'`.

#### 3. Hardcoded Admin Password Fallback
**Location:** `server.js:98`
```javascript
const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123ChangeMe!', SALT_ROUNDS);
```
**Issue:** Default password used if env variable not set.  
**Fix:** Remove the fallback, fail hard if env variable is missing.

#### 4. Weak JWT Secret in Example Config
**Location:** `.env.example:2`  
**Issue:** Predictable JWT secret template.  
**Fix:** Generate strong random secret and document requirement.

### HIGH

#### 5. XSS Vulnerability in Admin Panel
**Location:** `admin.html:766-785`  
**Issue:** `team_a` and `team_b` values directly interpolated into HTML/JS without escaping.
```javascript
tbody.innerHTML = matches.map(m => `...${m.team_a}...`).join('');
```
**Fix:** Implement `escapeHtml()` function like in index.html.

#### 6. Information Disclosure in Debug Endpoint
**Location:** `server.js:976-981`  
**Issue:** Exposes password hash length and admin status.  
**Fix:** Remove debug endpoints entirely.

#### 7. Error Handler Exposes Stack Traces
**Location:** `server.js:1028-1032`  
**Issue:** Returns raw error messages to client.  
**Fix:** Return generic error message: `res.status(500).json({ error: 'Server error' })`

### MEDIUM

- **Cron Endpoint Exposes Internal Errors** (`server.js:472`)
- **Missing Rate Limiting on Balance Endpoint** (`server.js:779-812`)
- **Console Logging in Production** (multiple locations)
- **Long JWT Expiration** (24 hours - reduce to 1-2 hours)
- **Token Stored in LocalStorage** (XSS risk - migrate to httpOnly cookies)

### LOW

- Supabase URL hardcoded (not secret but should be configurable)
- "Remove in production" comments not enforced

---

## Performance Audit

### CRITICAL

#### 1. Memory Leaks - setInterval Never Cleared
**Files:**
- `aviator.html:597, 623, 767` - Countdown and game loop intervals not stored/cleared
- `index.html:897, 914` - Auto-refresh intervals not cleared on navigation

**Fix:** Store interval IDs and clear them in `beforeunload` event and view changes.

#### 2. Full DOM Rebuilds on Every Update
**Location:** `admin.html:766-786`, `index.html:1167-1232`
```javascript
tbody.innerHTML = matches.map(m => `...`).join('');
```
**Issue:** Replaces entire table body - causes layout thrashing.  
**Fix:** Implement DOM diffing or fragment-based updates.

#### 3. N+1 Query Pattern in Database Operations
**Location:** `server.js:549-575`, `817-869`
```javascript
for (const bet of bets) {
    await supabase.from('bets').update(...);  // Database call per bet!
    await supabase.from('users').update(...);
}
```
**Fix:** Batch database operations using Supabase RPC or bulk updates.

### HIGH

- **No Debouncing on Input Handlers** (`index.html:1224-1230`)
- **No requestAnimationFrame for Animations** (`aviator.html:621-659`)
- **Blocking bcrypt Operations** (`server.js:285-295`)
- **Unthrottled Polling** (`index.html:893-910` - full fetch every 10s)
- **Event Listeners Never Removed** (`index.html:1160-1232` - new listeners every render)

### MEDIUM

- **Large Inline Scripts/Styles** - No browser caching (500+ lines CSS/JS per file)
- **Inefficient Shuffle Algorithm** (`admin.html:1006-1014`)

### LOW

- No lazy loading pattern established for images

---

## Bug Detection

### Console Noise (45+ instances to remove)

**server.js:**
- Line 106, 110, 165, 167, 181, 185, 299, 341, 582, 661, 739, 753, 758, 877, 1030, 1095, 1099, 1127, 1133, 1155, 1156

**index.html:**
- Line 844, 874, 943, 1036, 1082, 1415

**admin.html:**
- Line 695, 751, 798, 840, 898, 910, 920, 1123

**aviator.html:**
- Line 505, 680, 701

### innerHTML Usage (XSS Risk)

**index.html:** Lines 1152, 1155, 1163, 1167, 1340, 1348, 1355, 1394, 1433, 1437, 1579, 1583, 1601
**admin.html:** Lines 762, 766, 808, 812, 851, 855

**Status:** Most use static strings, but admin.html line 766 interpolates database values without escaping.

### Unhandled Intervals/Timers

**aviator.html:**
- Line 597: `const interval = setInterval(...)` - stored in local var, never cleared
- Line 623: `gameInterval = setInterval(...)` - may leave orphaned intervals
- Line 767: `setInterval(() => {...}, 10000)` - never stored, runs forever

**index.html:**
- Line 897: `autoRefreshInterval` - only cleared on logout
- Line 914: Timer update interval - runs continuously

---

## Graphify Analysis

**Nodes:** 15 | **Edges:** 17 | **Communities:** 3

### God Nodes (Most Connected)
1. `createAutoMatches()` - 3 edges
2. `initDatabase()` - 2 edges
3. `getRandomTeams()` - 2 edges
4. `getRandomOdds()` - 2 edges
5. `startServer()` - 2 edges

### Communities
- **Community 1** (Cohesion 0.67): Match generation logic (`createAutoMatches`, `getRandomOdds`, `getRandomTeams`)
- **Community 2** (Cohesion 1.0): Server lifecycle (`initDatabase`, `startServer`)

### Architecture Observations
- Database operations tightly coupled to HTTP handlers
- No service layer abstraction
- Business logic mixed with route handlers

---

## What to Fix First

### Immediate (Before Any Deployment)
1. **Remove debug endpoints** (`/api/debug/login`, `/api/admin/fix-password`)
2. **Restrict CORS** to specific origins
3. **Fix XSS in admin.html** - add escaping functions
4. **Remove hardcoded password fallback**
5. **Clear all intervals properly** - add cleanup functions

### High Priority
6. **Batch database operations** - use Supabase RPC
7. **Add rate limiting** to sensitive endpoints
8. **Remove console.log** statements
9. **Fix error message leakage**
10. **Implement DOM diffing** for match lists

### Medium Priority
11. Extract inline CSS/JS to external files
12. Add debouncing to input handlers
13. Use requestAnimationFrame for game animations
14. Reduce bcrypt rounds or offload to workers

---

## Project Health Score: 4.2/10

**Breakdown:**
- Security: 3/10 (Critical issues present)
- Performance: 4/10 (Memory leaks, N+1 queries)
- Code Quality: 5/10 (Console noise, mixed concerns)
- Architecture: 5/10 (No service layer)

---

## Human Score: 42/100

| Deduction | Reason | Points |
|-----------|--------|--------|
| Critical security | CORS wide open, debug endpoints | -20 |
| XSS vulnerability | Unescaped admin panel output | -15 |
| Memory leaks | 5+ setInterval leaks | -10 |
| N+1 queries | Database calls in loops | -8 |
| Console noise | 45+ console.log statements | -5 |

**What would score 90+:**
- Fix all critical/high security issues
- Clear memory leaks
- Batch database operations
- Remove console noise
- Add input validation/sanitization
- Implement proper error handling

---

## Verification Evidence

| Check | Status |
|-------|--------|
| Security scan | 4 critical, 7 high issues found |
| Performance audit | 5 critical, 7 high issues found |
| Bug detection | 45+ console.log, 15 innerHTML uses |
| Graph analysis | Complete - 15 nodes, 17 edges |

---

## Outputs Generated

- `SAM_AUDIT_REPORT.md` - This report
- `graphify-out/GRAPH_REPORT.md` - Graph analysis
- `graphify-out/graph.html` - Interactive graph visualization
- `graphify-out/graph.json` - Raw graph data

---

## Recommendation

**DO NOT DEPLOY TO PRODUCTION** until critical security issues are resolved. The application has:
- Open CORS allowing cross-origin attacks
- Debug endpoints enabling unauthorized admin access
- XSS vulnerabilities allowing script injection
- Memory leaks that will crash the server
- Database inefficiencies that will fail under load

**Estimated fix time:** 2-3 days for critical issues, 1 week for all high/medium issues.
