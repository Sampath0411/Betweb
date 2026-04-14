# Stumps - Cricket Betting Platform

Educational cricket betting simulation platform. Learn how betting works before trying real platforms. Virtual currency only - no real money involved.

## Features

### Landing Page
- Educational warning about responsible gambling
- Open source disclosure
- Feature highlights

### User Features

**Authentication**
- Register/login with secure JWT tokens
- ₹100 welcome bonus on signup
- ₹50 referral bonus for both referrer and new user
- Edit profile (name and password)

**Dashboard**
- Top navigation with Matches, History, Wallet, Profile tabs
- Mobile-responsive design
- Live balance display in header

**Betting**
- Browse live matches with Indian/International teams
- Three-way betting: Team A, Draw, Team B
- Quick bet buttons: ₹50, ₹100, ₹500
- Sound effects on bet placement
- Real-time balance updates
- Match countdown timer

**Wallet & History**
- Transaction log with all activity
- Bet history with win/loss/pending status
- Filter by status

**Gamification**
- **Daily Login Bonus**: ₹50 every day
- **Win Streaks**: 3 consecutive wins = ₹100 bonus
- **Badges System**:
  - 🎯 First Bet
  - 💰 High Roller (₹1000+ profit)
  - 🔥 3 Win Streak
  - ⚡ 5 Win Streak
  - 🏆 Big Winner

**Referral System**
- Share your username as referral code
- Both parties get ₹50 when someone signs up

### Admin Portal

**Dashboard**
- Live stats: Total users, live matches, total bets, pending bets
- Tabbed interface: Matches, Users, Bets

**Match Management**
- Create matches manually
- Generate random matches (auto-teams and odds)
- Settle matches (Team A / Draw / Team B)
- Settle ALL pending bets at once (random results)

**User Management**
- View all users with balances
- Add money to users: ₹10, ₹500, ₹1000
- View transaction history

**Bet Management**
- View all platform bets
- See pending/win/loss counts
- Bulk settle pending bets

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express |
| Database | Supabase PostgreSQL |
| Frontend | Vanilla HTML/CSS/JS |
| Auth | JWT (24h expiry) |
| Password Hashing | bcrypt |
| Rate Limiting | express-rate-limit |
| Security | Helmet.js |

## Quick Start

```bash
# Clone repository
git clone <repo-url>
cd cricket-bet-full

# Install dependencies
npm install

# Setup environment
copy .env.example .env
# Edit .env with your Supabase credentials

# Start server
npm start
```

Server runs on http://localhost:3000

## Default Credentials

**Admin:**
- Username: `admin`
- Password: `admin123` (or set via ADMIN_PASSWORD env)

Access admin at: http://localhost:3000/admin.html

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_SERVICE_ROLE_KEY | Yes | Supabase service role key |
| JWT_SECRET | Yes | JWT signing secret |
| ADMIN_PASSWORD | No | Admin password (default: admin123) |
| PORT | No | Server port (default: 3000) |

## API Endpoints

### Public
| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/register | POST | Create account |
| /api/login | POST | Login |
| /api/health | GET | Health check |

### Protected (Auth Required)
| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/me | GET | Get current user |
| /api/matches | GET | Get live matches |
| /api/bets | POST | Place bet |
| /api/bets | GET | Get my bets |
| /api/transactions | GET | Get transaction log |
| /api/profile | POST | Update profile |

### Admin Only
| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/admin/matches | GET | Get all matches |
| /api/admin/matches | POST | Create match |
| /api/admin/matches/:id/settle | POST | Settle match |
| /api/admin/bets | GET | Get all bets |
| /api/admin/bets/settle-all | POST | Settle all pending |
| /api/admin/users | GET | Get all users |
| /api/admin/users/:id/add-balance | POST | Add money to user |

## Security Features

- **Rate Limiting**: Auth (20/15min), Bets (10/min), API (60/min)
- **Password Policy**: 8+ chars, uppercase, lowercase, number
- **Input Sanitization**: XSS prevention on all inputs
- **SQL Injection Protection**: Parameterized queries
- **CORS**: Configured for allowed origins
- **Security Headers**: Helmet.js (CSP, HSTS, etc)
- **JWT**: 24h expiry with secure secret

## Database Schema

```sql
users:
  - id, name, username, password, balance, is_admin, created_at

matches:
  - id, team_a, team_b, odds_a, odds_draw, odds_b, status, result, created_at

bets:
  - id, user_id, match_id, pick, odds, stake, payout, status, created_at

transactions:
  - id, user_id, type, amount, description, created_at
```

## Team Pool

**International:** India, Australia, England, Pakistan, South Africa, New Zealand, Sri Lanka, Bangladesh, West Indies, Afghanistan

**IPL:** Mumbai Indians, Chennai Super Kings, Royal Challengers Bangalore, Kolkata Knight Riders, Delhi Capitals, Punjab Kings, Rajasthan Royals, Sunrisers Hyderabad, Gujarat Titans, Lucknow Super Giants

## How Betting Works

1. **Register** → Get ₹100 welcome bonus
2. **Refer Friends** → Both get ₹50
3. **Daily Login** → Get ₹50 bonus
4. **Browse Matches** → See live matches with odds
5. **Place Bet** → Stake deducted, potential win calculated
6. **Win Streak** → 3 wins = ₹100 bonus
7. **Collect Badges** → Earn achievements
8. **Admin Settles** → Match results decided, winners paid

## Gamification Rules

| Achievement | Reward | Condition |
|-------------|--------|-----------|
| Welcome Bonus | ₹100 | Sign up |
| Referral | ₹50 each | Friend uses your code |
| Daily Login | ₹50 | Once per day |
| Win Streak | ₹100 | 3 consecutive wins |
| First Bet | Badge | Place 1st bet |
| High Roller | Badge | ₹1000+ total profit |
| 3 Win Streak | Badge | 3 wins in row |
| 5 Win Streak | Badge | 5 wins in row |
| Big Winner | Badge | First win |

## License

Open source - Educational purposes only. Not for real gambling.

---

**Disclaimer**: This platform uses virtual currency only. No real money deposits or withdrawals. Built for learning betting mechanics in a risk-free environment.
