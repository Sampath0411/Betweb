const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security: JWT secret from env, fallback only for dev
const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(64).toString('hex');
const SALT_ROUNDS = 12;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors());

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: 'Rate limit exceeded' },
});

const betLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: 'Too many bets, slow down' },
});

// Database setup with busy timeout for concurrency
// Use /tmp for Vercel serverless (only writable location), local file for dev
const DB_PATH = process.env.VERCEL ? '/tmp/database.sqlite' : './database.sqlite';
const db = new sqlite3.Database(DB_PATH);
db.run('PRAGMA busy_timeout = 5000');
db.run('PRAGMA foreign_keys = ON');
console.log('Database path:', DB_PATH);

// Health check endpoint for Vercel
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Input sanitization
const sanitize = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim().slice(0, 100);
};

const validateUsername = (username) => /^[a-zA-Z0-9_]{3,20}$/.test(username);
const validateName = (name) => /^[a-zA-Z0-9_\s]{2,50}$/.test(name);
const validatePassword = (password) => password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
const validateOdds = (n) => typeof n === 'number' && n > 1 && n < 100;
const validateStake = (n) => Number.isInteger(n) && n >= 10 && n <= 100000;

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    balance INTEGER DEFAULT 1000 CHECK(balance >= 0),
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_a TEXT NOT NULL,
    team_b TEXT NOT NULL,
    odds_a REAL NOT NULL CHECK(odds_a > 1),
    odds_draw REAL NOT NULL CHECK(odds_draw > 1),
    odds_b REAL NOT NULL CHECK(odds_b > 1),
    status TEXT DEFAULT 'live',
    result TEXT CHECK(result IN ('A', 'draw', 'B')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    settled_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    match_id INTEGER NOT NULL,
    pick TEXT NOT NULL,
    odds REAL NOT NULL,
    stake INTEGER NOT NULL CHECK(stake > 0),
    payout INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'won', 'lost')),
    settled_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (match_id) REFERENCES matches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('credit', 'debit', 'loss')),
    amount INTEGER NOT NULL CHECK(amount >= 0),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Seed admin with secure password hash
  db.get("SELECT * FROM users WHERE username = 'admin'", async (err, row) => {
    if (!row) {
      const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123ChangeMe!', SALT_ROUNDS);
      db.run(`INSERT INTO users (name, username, password, is_admin, balance) VALUES (?, ?, ?, 1, 0)`,
        ['Admin', 'admin', hashed]);
    }
  });

  db.get("SELECT COUNT(*) as count FROM matches WHERE status = 'live'", (err, row) => {
    if (row.count === 0) {
      const matches = [
        ['India', 'Australia', 1.85, 3.40, 2.10],
        ['Mumbai Indians', 'Chennai Super Kings', 1.90, 3.20, 1.95],
        ['Royal Challengers Bangalore', 'Rajasthan Royals', 2.05, 3.30, 1.80],
        ['Delhi Capitals', 'Kolkata Knight Riders', 1.75, 3.50, 2.30],
        ['Punjab Kings', 'Gujarat Titans', 2.20, 3.10, 1.75]
      ];
      const stmt = db.prepare(`INSERT INTO matches (team_a, team_b, odds_a, odds_draw, odds_b) VALUES (?, ?, ?, ?, ?)`);
      matches.forEach(m => stmt.run(m));
      stmt.finalize();
    }
  });
});

// Middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const adminOnly = (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
};

// Auth routes with rate limiting
app.post('/api/register', authLimiter, async (req, res) => {
  let { name, username, password } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Validation
  if (!validateName(name)) {
    return res.status(400).json({ error: 'Name: 2-50 chars, alphanumeric only' });
  }
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username: 3-20 chars, alphanumeric and underscore only' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'Password: 8+ chars, uppercase, lowercase, number required' });
  }

  // Sanitize
  name = sanitize(name);
  username = username.toLowerCase();

  try {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    db.run(`INSERT INTO users (name, username, password) VALUES (?, ?, ?)`,
      [name, username, hashed],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username taken' });
          return res.status(500).json({ error: 'Database error' });
        }
        const userId = this.lastID;
        db.run(`INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'credit', 1000, 'Welcome bonus')`,
          [userId]);
        res.json({ message: 'Registered', userId });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  const sanitizedUsername = username.toLowerCase().trim();

  db.get(`SELECT * FROM users WHERE username = ?`, [sanitizedUsername], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, isAdmin: user.is_admin === 1 },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        balance: user.balance,
        isAdmin: user.is_admin === 1
      }
    });
  });
});

// Protected routes
app.use('/api', apiLimiter);

app.get('/api/me', auth, (req, res) => {
  db.get(`SELECT id, name, username, balance FROM users WHERE id = ?`, [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

app.get('/api/matches', auth, (req, res) => {
  db.all(`SELECT * FROM matches WHERE status = 'live' ORDER BY created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.get('/api/admin/matches', auth, adminOnly, (req, res) => {
  db.all(`SELECT * FROM matches ORDER BY created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.post('/api/admin/matches', auth, adminOnly, (req, res) => {
  let { team_a, team_b, odds_a, odds_draw, odds_b } = req.body;

  // Validation
  if (!team_a || !team_b || !odds_a || !odds_draw || !odds_b) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  if (!validateName(team_a) || !validateName(team_b)) {
    return res.status(400).json({ error: 'Team names: 2-50 chars, alphanumeric' });
  }

  if (!validateOdds(odds_a) || !validateOdds(odds_draw) || !validateOdds(odds_b)) {
    return res.status(400).json({ error: 'Odds must be between 1 and 100' });
  }

  team_a = sanitize(team_a);
  team_b = sanitize(team_b);

  db.run(`INSERT INTO matches (team_a, team_b, odds_a, odds_draw, odds_b) VALUES (?, ?, ?, ?, ?)`,
    [team_a, team_b, odds_a, odds_draw, odds_b],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ id: this.lastID });
    }
  );
});

// Settle match with transaction safety
app.post('/api/admin/matches/:id/settle', auth, adminOnly, (req, res) => {
  const { result } = req.body;
  const matchId = parseInt(req.params.id);

  if (!result || !['A', 'draw', 'B'].includes(result)) {
    return res.status(400).json({ error: 'Invalid result. Use A, draw, or B' });
  }

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return res.status(400).json({ error: 'Invalid match ID' });
  }

  db.run('BEGIN TRANSACTION');

  db.get(`SELECT * FROM matches WHERE id = ?`, [matchId], (err, match) => {
    if (err) {
      db.run('ROLLBACK');
      return res.status(500).json({ error: 'Database error' });
    }
    if (!match) {
      db.run('ROLLBACK');
      return res.status(404).json({ error: 'Match not found' });
    }
    if (match.status !== 'live') {
      db.run('ROLLBACK');
      return res.status(400).json({ error: 'Match already settled' });
    }

    db.run(`UPDATE matches SET status = 'settled', result = ?, settled_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [result, matchId],
      (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Database error' });
        }

        db.all(`SELECT * FROM bets WHERE match_id = ? AND status = 'pending'`, [matchId], (err, bets) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Database error' });
          }

          let completed = 0;
          const total = bets.length;

          if (total === 0) {
            db.run('COMMIT');
            return res.json({ message: 'Match settled', result });
          }

          bets.forEach(bet => {
            let won = false;
            if (result === 'A' && bet.pick === match.team_a) won = true;
            else if (result === 'B' && bet.pick === match.team_b) won = true;
            else if (result === 'draw' && bet.pick === 'Draw') won = true;

            if (won) {
              db.run(`UPDATE bets SET status = 'won', settled_at = CURRENT_TIMESTAMP WHERE id = ?`, [bet.id], (err) => {
                if (err) console.error('Bet update error:', err);
              });
              db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [bet.payout, bet.user_id], (err) => {
                if (err) console.error('User balance update error:', err);
              });
              db.run(`INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'credit', ?, ?)`,
                [bet.user_id, bet.payout, `Won bet on ${match.team_a} vs ${match.team_b}`], (err) => {
                if (err) console.error('Transaction log error:', err);
              });
            } else {
              db.run(`UPDATE bets SET status = 'lost', settled_at = CURRENT_TIMESTAMP WHERE id = ?`, [bet.id], (err) => {
                if (err) console.error('Bet update error:', err);
              });
              db.run(`INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'loss', 0, ?)`,
                [bet.user_id, `Lost bet on ${match.team_a} vs ${match.team_b}`], (err) => {
                if (err) console.error('Transaction log error:', err);
              });
            }

            completed++;
            if (completed === total) {
              db.run('COMMIT');
              res.json({ message: 'Match settled', result, betsProcessed: total });
            }
          });
        });
      }
    );
  });
});

// Place bet with transaction safety and race condition protection
app.post('/api/bets', betLimiter, auth, (req, res) => {
  let { match_id, pick, odds, stake } = req.body;
  const userId = req.user.id;

  // Validation
  if (!match_id || !pick || !odds || !stake) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  match_id = parseInt(match_id);
  odds = parseFloat(odds);
  stake = parseInt(stake);

  if (!Number.isInteger(match_id) || match_id <= 0) {
    return res.status(400).json({ error: 'Invalid match ID' });
  }

  if (!validateStake(stake)) {
    return res.status(400).json({ error: 'Stake must be 10-100000' });
  }

  if (!validateOdds(odds)) {
    return res.status(400).json({ error: 'Invalid odds' });
  }

  pick = sanitize(pick);

  db.run('BEGIN IMMEDIATE TRANSACTION');

  // Lock user row to prevent race conditions
  db.get(`SELECT balance FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err) {
      db.run('ROLLBACK');
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      db.run('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.balance < stake) {
      db.run('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    db.get(`SELECT * FROM matches WHERE id = ? AND status = 'live'`, [match_id], (err, match) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'Database error' });
      }
      if (!match) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: 'Match not available' });
      }

      // Validate pick matches the match
      if (pick !== match.team_a && pick !== match.team_b && pick !== 'Draw') {
        db.run('ROLLBACK');
        return res.status(400).json({ error: 'Invalid pick for this match' });
      }

      const payout = Math.floor(stake * odds);

      // Insert bet
      db.run(`INSERT INTO bets (user_id, match_id, pick, odds, stake, payout) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, match_id, pick, odds, stake, payout],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to place bet' });
          }

          const betId = this.lastID;

          // Deduct stake
          db.run(`UPDATE users SET balance = balance - ? WHERE id = ?`, [stake, userId], (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Failed to update balance' });
            }

            // Log transaction
            db.run(`INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'debit', ?, ?)`,
              [userId, stake, `Bet on ${match.team_a} vs ${match.team_b}`], (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to log transaction' });
              }

              db.run('COMMIT');
              res.json({ betId, payout, message: 'Bet placed' });
            }
            );
          });
        }
      );
    });
  });
});

app.get('/api/bets', auth, (req, res) => {
  db.all(`
    SELECT bets.*, matches.team_a, matches.team_b, matches.result as match_result
    FROM bets
    JOIN matches ON bets.match_id = matches.id
    WHERE bets.user_id = ?
    ORDER BY bets.created_at DESC
  `, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.get('/api/transactions', auth, (req, res) => {
  db.all(`SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  db.all(`SELECT id, name, username, balance, created_at FROM users WHERE is_admin = 0`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.get('/api/admin/bets', auth, adminOnly, (req, res) => {
  db.all(`
    SELECT bets.*, users.username, users.name, matches.team_a, matches.team_b
    FROM bets
    JOIN users ON bets.user_id = users.id
    JOIN matches ON bets.match_id = matches.id
    ORDER BY bets.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.delete('/api/admin/matches/:id', auth, adminOnly, (req, res) => {
  const matchId = parseInt(req.params.id);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return res.status(400).json({ error: 'Invalid match ID' });
  }

  db.run(`DELETE FROM matches WHERE id = ?`, [matchId], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'Match deleted' });
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Export for Vercel serverless
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin login: admin / (see ADMIN_PASSWORD env or default)`);
  });
}
