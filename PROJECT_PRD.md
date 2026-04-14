# Project PRD: Stumps Cricket Betting Platform

---

## 1. Document Meta-Information

| Field | Value |
|-------|-------|
| **Project Title** | Stumps - Elite Cricket Exchange |
| **Document Version** | 1.0 |
| **Date** | 2026-04-14 |
| **Author(s)** | Sampath Satya Saran |
| **Status** | Approved |
| **Stakeholders / Approvers** | Development Team, Product Owner |

---

## 2. Executive Summary

**Purpose:** Stumps is a modern cricket betting platform designed for Indian cricket enthusiasts. It provides a seamless, secure, and visually appealing interface for users to place bets on live cricket matches, track their betting history, and manage their wallet.

**Key Highlights:**
- Real-time match listings with dynamic odds
- Simple three-way betting (Team A, Draw, Team B)
- Wallet management with transaction history
- Referral system (₹50 bonus per successful referral)
- Admin dashboard for match settlement and user management
- Welcome bonus of ₹100 for new users

**Target Audience:** Cricket fans in India aged 18+ who enjoy casual betting on matches.

---

## 3. Problem Statement / Opportunity

### Current Situation
- Existing betting platforms are cluttered, confusing, or have poor UX
- Many platforms lack transparency in odds and settlement
- Mobile experience is often subpar on existing platforms
- No clean, India-focused cricket betting interface exists

### Negative Consequences
- Users abandon platforms due to poor UX
- Lack of trust in settlement process
- Difficulty tracking bets and wallet history
- Complex onboarding drives away new users

### Opportunity
Build a **clean, fast, mobile-first** cricket betting platform specifically designed for Indian users with:
- Transparent odds display
- Simple, intuitive betting flow
- Clear bet settlement and history tracking
- Responsive design that works on all devices

---

## 4. Goals & Objectives (SMART)

### Primary Goal
Launch a fully functional cricket betting platform with core betting features and admin management within 2 weeks.

### Specific Objectives

| Objective | Target | Timeline |
|-----------|--------|----------|
| User registration & onboarding | 100% functional with referral system | Week 1 |
| Match listing & betting | Live match display with real odds | Week 1 |
| Wallet & transaction tracking | Complete balance management | Week 1 |
| Bet history & filters | Full bet tracking with status filters | Week 2 |
| Admin match settlement | Admin can settle matches, view all bets | Week 2 |
| Mobile responsiveness | Works perfectly on mobile devices | Week 2 |

---

## 5. Target Audience / Users

### Primary Users: Cricket Bettors

**Persona: "Arjun, 24, IT Professional"**
- **Demographics:** Male, 22-35 years, urban India
- **Behavior:** Watches IPL, international matches
- **Needs:** Quick betting, clear odds, fast settlement
- **Pain Points:** Confusing interfaces, slow payouts
- **Tech Comfort:** High, primarily mobile user

**Persona: "Rahul, 28, College Student"**
- **Demographics:** Male, 20-25 years
- **Behavior:** Bets small amounts (₹50-200) for fun
- **Needs:** Low minimum bets, referral bonuses
- **Pain Points:** High minimum deposits elsewhere

### Secondary Users: Administrators

**Admin Persona: Platform Manager**
- Manage match listings
- Settle completed matches
- View user and bet analytics
- Monitor platform activity

---

## 6. Solution Overview

### What Is It?
Stumps is a web-based cricket betting platform with a dark, premium UI theme. It allows users to register, deposit (virtual), place bets on matches, and track their winnings.

### How Does It Work?

**User Flow:**
1. User registers/logs in → Gets ₹100 welcome bonus
2. Browses live matches → Sees 3-way odds (Team A / Draw / Team B)
3. Selects odds → Opens bet slip → Enters stake
4. Places bet → Amount deducted from wallet
5. Admin settles match → Winners credited automatically
6. User can view history, track wins/losses

**Referral Flow:**
1. Existing user shares referral code (their username)
2. New user signs up with code
3. Both users get ₹50 bonus

### Key Differentiators
- **Minimalist Design:** Clean dark UI with amber accents
- **Fast Experience:** Single-page app feel
- **Transparency:** Clear odds, settlement, history
- **Mobile-First:** Optimized for smartphone use
- **No Clutter:** Only cricket, no casino/slots/other games

---

## 7. Key Features & Functionality

### MVP Features (Must Have for Launch)

#### 7.1 Authentication System
| Feature | Description | User Value | Business Value |
|---------|-------------|------------|----------------|
| User Registration | Name, username, password, optional referral code | Easy onboarding | User acquisition |
| Login/Logout | Secure JWT-based auth | Account security | Data protection |
| Password Toggle | Show/hide password | Better UX | Reduced login errors |

**User Story:**
- As a new user, I want to register quickly so I can start betting immediately.
- Acceptance: Registration takes <30 seconds, ₹100 welcome bonus credited.

#### 7.2 Match Listing & Betting
| Feature | Description | Priority |
|---------|-------------|----------|
| Live Matches Display | Show current matches with team names | P0 |
| 3-Way Odds Display | Team A, Draw, Team B with odds | P0 |
| Bet Slip Modal | Floating panel for stake entry | P0 |
| Potential Winnings Calc | Auto-calculate based on odds | P1 |
| Place Bet Button | Confirm and place bet | P0 |

**User Story:**
- As a user, I want to see live matches and place a bet in under 10 seconds.
- Acceptance: Display match → Select odds → Enter stake → Confirm → Bet placed.

#### 7.3 Wallet Management
| Feature | Description | Priority |
|---------|-------------|----------|
| Balance Display | Header shows current balance | P0 |
| Wallet View | Large balance display + transaction history | P0 |
| Transaction Log | Bets, wins, referral bonuses listed | P0 |
| Virtual Currency | All amounts in ₹ (Indian Rupees) | P0 |

**User Story:**
- As a user, I want to see my balance and transaction history clearly.
- Acceptance: Balance visible on all screens, history shows last 10 transactions.

#### 7.4 Bet History
| Feature | Description | Priority |
|---------|-------------|----------|
| Bet List | All bets with match, pick, stake, odds | P0 |
| Status Badges | Pending / Won / Lost indicators | P0 |
| Filter Chips | Filter by All / Pending / Settled | P1 |
| Result Display | Payout amount with +/- indicators | P0 |

**User Story:**
- As a user, I want to track all my bets and see if I won or lost.
- Acceptance: Bets sorted by date, status clearly visible, profit/loss shown.

#### 7.5 Profile & Referrals
| Feature | Description | Priority |
|---------|-------------|----------|
| Profile Card | Name, username, balance, join date | P1 |
| Referral Code | User's username as referral code | P0 |
| Copy to Clipboard | One-click code copy | P1 |
| Referral Earnings | Total earned from referrals | P2 |

**User Story:**
- As a user, I want to invite friends and earn bonuses.
- Acceptance: Referral code visible, copy button works, bonus credited on friend signup.

#### 7.6 Admin Dashboard
| Feature | Description | Priority |
|---------|-------------|----------|
| Admin Login | Separate admin authentication | P0 |
| Stats Overview | Total users, live matches, bets | P0 |
| Match Management | Add new matches with odds | P0 |
| Match Settlement | Settle as Team A / Draw / Team B | P0 |
| Random Match Generator | Quick match creation for testing | P2 |
| Users Table | View all registered users | P1 |
| Bets Table | View all platform bets | P1 |

**User Story:**
- As an admin, I want to settle matches and see platform activity.
- Acceptance: Settlement triggers automatic payouts, stats update in real-time.

---

## 8. Scope Definition

### In Scope (MVP)
✅ User registration/login with referral codes  
✅ View live matches with odds  
✅ Place bets (Team A / Draw / Team B)  
✅ Wallet balance display  
✅ Bet history with status tracking  
✅ Referral system  
✅ Admin: Add/settle matches  
✅ Admin: View users and all bets  
✅ Mobile-responsive design  
✅ Dark theme UI  

### Out of Scope (Post-MVP)
❌ Real payment gateway integration (UPI/Paytm)  
❌ Real-time match data API (live scores)  
❌ Multiple sports (football, tennis, etc.)  
❌ Casino games / slots  
❌ Live streaming  
❌ In-play betting (during match)  
❌ Cash-out feature mid-bet  
❌ Withdraw to bank  
❌ KYC verification  
❌ Multi-language support  

---

## 9. Technical & Design Considerations

### Technical Requirements

| Component | Technology |
|-----------|------------|
| Frontend | Vanilla HTML, Tailwind CSS CDN, Vanilla JS |
| Backend | Node.js / Express |
| Database | Supabase PostgreSQL |
| Auth | JWT (JSON Web Tokens) |
| Hosting | Vercel (frontend), Supabase (backend) |

### API Endpoints Required
```
POST /api/register          - User registration
POST /api/login             - User login
GET  /api/me                - Current user info
GET  /api/matches           - List live matches
POST /api/bet               - Place a bet
GET  /api/my-bets           - User's bet history
GET  /api/admin/matches     - Admin: all matches
POST /api/admin/matches     - Admin: create match
POST /api/admin/matches/:id/settle - Admin: settle match
GET  /api/admin/users       - Admin: all users
GET  /api/admin/bets        - Admin: all bets
```

### UI/UX Design

**Design System:**
- **Colors:** Dark theme (#0f1419 bg, #ffc174 primary, #f59e0b accent)
- **Font:** Inter (Google Fonts)
- **Icons:** Material Symbols Outlined
- **Border Radius:** 2xl (16px) for cards, xl (12px) for inputs
- **Spacing:** Consistent 4px grid system

**Key Screens:**
1. **Auth Page:** Split login/register, modern card design
2. **Matches:** Match cards with team initials, 3-way odds buttons
3. **Wallet:** Hero balance card + transaction list
4. **Bet History:** Filterable list with status badges
5. **Profile:** User info + referral section
6. **Admin:** Stats cards, tabbed interface, data tables

### Performance Requirements
- Page load < 2 seconds
- Bet placement < 500ms response time
- Support 100+ concurrent users
- Mobile-first responsive (320px - 1920px)

### Security Requirements
- Password hashing (bcrypt)
- JWT token expiry (24 hours)
- Input validation on all forms
- SQL injection protection (parameterized queries)
- XSS protection (sanitize inputs)

---

## 10. Dependencies, Assumptions, Constraints, & Risks

### Dependencies
- Supabase database must be provisioned
- Vercel account for deployment
- Domain name (optional for MVP)

### Assumptions
- Users have stable internet connection
- Users access primarily via mobile devices
- Admin will manually settle matches promptly
- Virtual currency (no real money transactions in MVP)

### Constraints
- Budget: Free tier for Supabase + Vercel
- Timeline: 2 weeks for MVP
- Team: Solo developer
- Legal: Educational/demo purposes only

### Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tailwind CDN fails | High | Use inline critical CSS as fallback |
| Supabase downtime | High | Add error handling, retry logic |
| Browser caching issues | Medium | Version URLs, cache-busting meta tags |
| Mobile responsiveness bugs | Medium | Test on multiple screen sizes |
| Database rate limits | Low | Implement request batching |

---

## 11. Go-to-Market Strategy (High-Level)

### Launch Plan
1. **Development Phase:** Complete MVP features (2 weeks)
2. **Testing Phase:** Internal testing, fix bugs (3 days)
3. **Soft Launch:** Share with 10-20 friends for feedback
4. **Iterate:** Fix issues based on feedback
5. **Public Launch:** Share referral codes on social media

### Success Metrics
- 50+ registered users in first month
- Average 3+ bets per user
- <5% error rate on bet placement
- Admin settlement within 24 hours of match completion

---

## 12. Future Considerations / Backlog Ideas

### Phase 2 Features
- Real-time match data integration
- Live score updates on match cards
- Push notifications for match settlement
- Leaderboard (top winners)
- Multiple bet types (over/under, player performance)

### Phase 3 Features
- Real payment integration (Razorpay/Stripe)
- KYC verification
- Withdrawal requests
- Advanced analytics for users
- Dark/light theme toggle

---

## 13. Appendix / Supporting Documentation

### Design References
- Material Design 3 Guidelines
- Stumps UI Kit (based on provided zip file)

### Database Schema (Simplified)

**users table:**
- id, name, username, password_hash, balance, referral_earnings, created_at, is_admin

**matches table:**
- id, team_a, team_b, odds_a, odds_draw, odds_b, status, result, created_at

**bets table:**
- id, user_id, match_id, pick, stake, odds, payout, status, created_at

### Color Palette Reference
```
Primary:          #ffc174
Primary Container:#f59e0b
Background:       #0f1419
Surface:          #0f1419
Surface Container:#1b2025
Surface Container Low:   #171c21
Surface Container High:  #252a30
On Surface:       #dee3ea
Outline:          #a08e7a
Success:          #22c55e
Error:            #ffb4ab
```

---

## Implementation Checklist

### Week 1: Core Features
- [x] Project setup (Git, Vercel, Supabase)
- [x] Database schema created
- [x] Auth system (register/login)
- [x] Basic match display
- [x] Bet placement flow
- [x] Wallet display

### Week 2: Polish & Admin
- [x] Apply Stumps design system
- [x] Bet history with filters
- [x] Profile & referrals
- [x] Admin dashboard
- [x] Mobile responsiveness
- [x] Testing & bug fixes
- [ ] Final deployment

---

**END OF PRD**

*This document is a living document and may be updated as the project evolves.*
