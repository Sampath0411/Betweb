# Stumps - Cricket Betting Platform

Full-stack cricket betting website with admin portal. Admin manually decides match results.

## Features

### User Site
- Register/login with ₹1000 starting balance
- Browse live matches with Indian teams
- Place bets on Team A, Draw, or Team B
- Real-time balance updates
- Bet history with win/loss status
- Transaction log

### Admin Portal
- Secure admin login
- Create new matches
- **Manually settle matches** (decide who wins)
- Automatic payout calculation
- View all users and their balances
- View all bets across platform
- Dashboard stats

## Tech Stack

- Node.js + Express
- SQLite database
- Vanilla HTML/CSS/JS frontend
- JWT authentication
- bcrypt password hashing

## Quick Start

```bash
cd cricket-bet-full
npm install

# Copy env file and edit
COPY .env.example .env

npm start
```

Server runs on http://localhost:3000

## Default Credentials

**Admin:**
- Username: `admin`
- Password: `admin123`

Access admin portal at: http://localhost:3000/admin.html

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| /api/register | POST | No | Create account |
| /api/login | POST | No | Login |
| /api/me | GET | Yes | Get current user |
| /api/matches | GET | Yes | Get live matches |
| /api/bets | POST | Yes | Place bet |
| /api/bets | GET | Yes | Get my bets |
| /api/transactions | GET | Yes | Get transaction log |
| /api/admin/matches | GET | Admin | Get all matches |
| /api/admin/matches | POST | Admin | Create match |
| /api/admin/matches/:id/settle | POST | Admin | Settle match |
| /api/admin/users | GET | Admin | Get all users |
| /api/admin/bets | GET | Admin | Get all bets |

## Security Features

- **Rate limiting** on auth (5 attempts per 15 min), bets (10 per min), API (60 per min)
- **Password requirements**: 8+ chars, uppercase, lowercase, number
- **Input sanitization** on all user inputs (XSS prevention)
- **SQL injection protection** via parameterized queries
- **Transaction safety** for bets and settlements (prevents partial execution)
- **Row locking** on balance updates (prevents race conditions / double spend)
- **Security headers** via Helmet (CSP, HSTS, X-Frame-Options, etc)
- **CORS** configured for allowed origins only
- **JWT tokens** with 24h expiry, secure random secret
- **Input validation** on odds, stakes, match IDs
- **SQLite foreign keys** and CHECK constraints

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| JWT_SECRET | Yes | Random | JWT signing secret |
| ADMIN_PASSWORD | Yes | admin123ChangeMe! | Admin password |
| ALLOWED_ORIGIN | No | http://localhost:3000 | CORS origin |
| PORT | No | 3000 | Server port |

## Database Schema

**users** - id, name, username, password, balance, is_admin, created_at

**matches** - id, team_a, team_b, odds_a, odds_draw, odds_b, status, result, created_at, settled_at

**bets** - id, user_id, match_id, pick, odds, stake, payout, status, settled_at

**transactions** - id, user_id, type, amount, description, created_at

## Indian Teams Included

- India
- Australia
- Mumbai Indians
- Chennai Super Kings
- Royal Challengers Bangalore
- Rajasthan Royals
- Delhi Capitals
- Kolkata Knight Riders
- Punjab Kings
- Gujarat Titans

## How It Works

1. User registers → gets ₹1000
2. User places bet → stake deducted immediately
3. Admin views matches in admin portal
4. Admin clicks result button (Team A wins / Draw / Team B wins)
5. All pending bets auto-settled
6. Winners paid automatically
7. Transaction log updated
