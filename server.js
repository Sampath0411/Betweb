const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase setup
const SUPABASE_URL = 'https://lowdwzvaxxkmhylkgmko.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Security: JWT secret from env, fallback only for dev
const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(64).toString('hex');
const SALT_ROUNDS = 12;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
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

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
app.use(cors({ origin: allowedOrigins, credentials: true }));

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

// Input sanitization
const sanitize = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>'&]/g, '').trim().slice(0, 100);
};

const validateUsername = (username) => /^[a-zA-Z0-9_]{3,20}$/.test(username);
const validateName = (name) => /^[a-zA-Z0-9_\s]{2,50}$/.test(name);
const validatePassword = (password) => password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
const validateOdds = (n) => typeof n === 'number' && n > 1 && n < 100;
const validateStake = (n) => Number.isInteger(n) && n >= 10 && n <= 100000;

// Initialize database tables and seed data
async function initDatabase() {
  try {
    // Check if admin exists
    const { data: adminExists } = await supabase
      .from('users')
      .select('id')
      .eq('username', 'admin')
      .single();

    if (!adminExists) {
      if (!process.env.ADMIN_PASSWORD) {
        console.error('FATAL: ADMIN_PASSWORD environment variable not set');
        process.exit(1);
      }
      const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, SALT_ROUNDS);
      await supabase.from('users').insert({
        name: 'Admin',
        username: 'admin',
        password: hashed,
        is_admin: true,
        balance: 0
      });
      // Admin user created successfully
    }

  } catch (err) {
    console.error('Database init error:', err);
  }
}

// Auto-match system - separate international and IPL teams
const INTERNATIONAL_TEAMS = [
  'India', 'Australia', 'England', 'Pakistan', 'South Africa', 'New Zealand',
  'Sri Lanka', 'Bangladesh', 'West Indies', 'Afghanistan', 'Ireland', 'Zimbabwe'
];

const IPL_TEAMS = [
  'Mumbai Indians', 'Chennai Super Kings', 'Royal Challengers Bangalore',
  'Kolkata Knight Riders', 'Delhi Capitals', 'Punjab Kings',
  'Rajasthan Royals', 'Sunrisers Hyderabad', 'Gujarat Titans', 'Lucknow Super Giants'
];

function getRandomTeams() {
  // Pick category first (50/50 chance)
  const useInternational = Math.random() < 0.5;
  const teamPool = useInternational ? INTERNATIONAL_TEAMS : IPL_TEAMS;

  // Get two different teams from same pool
  const shuffled = [...teamPool].sort(() => 0.5 - Math.random());
  return [shuffled[0], shuffled[1]];
}

function getRandomOdds() {
  const baseA = 1.5 + Math.random() * 1.5;
  const baseB = 1.5 + Math.random() * 1.5;
  const draw = 3.0 + Math.random() * 1.5;
  return {
    odds_a: parseFloat(baseA.toFixed(2)),
    odds_draw: parseFloat(draw.toFixed(2)),
    odds_b: parseFloat(baseB.toFixed(2))
  };
}

async function createAutoMatches(count = 5) {
  try {
    const matches = [];
    for (let i = 0; i < count; i++) {
      const [teamA, teamB] = getRandomTeams();
      const odds = getRandomOdds();
      matches.push({
        team_a: teamA,
        team_b: teamB,
        odds_a: odds.odds_a,
        odds_draw: odds.odds_draw,
        odds_b: odds.odds_b,
        status: 'live',
        created_at: new Date().toISOString()
      });
    }
    const { data, error } = await supabase.from('matches').insert(matches).select();
    if (error) throw error;
    // Matches created successfully
  } catch (err) {
    console.error('Create matches error:', err);
  }
// Check and auto-create matches if none live
async function checkAndCreateMatches() {
  try {
    const { data: liveMatches, error } = await supabase
      .from('matches')
      .select('id')
      .eq('status', 'live');

    if (error) throw error;

    // If no live matches, create 10 new ones
    if (!liveMatches || liveMatches.length === 0) {
      // No live matches found, creating new ones
      await createAutoMatches(10);
    }
  } catch (err) {
    console.error('Check/create matches error:', err);
  }
}
}



// Health check endpoint for Vercel
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Middleware
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
};

// Auth routes with rate limiting
app.post('/api/register', authLimiter, async (req, res) => {
  let { name, username, email, password, referral_code } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Validate email if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (!validateName(name)) {
    return res.status(400).json({ error: 'Name: 2-50 chars, alphanumeric only' });
  }
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username: 3-20 chars, alphanumeric and underscore only' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'Password: 8+ chars, uppercase, lowercase, number required' });
  }

  name = sanitize(name);
  username = username.toLowerCase();

  try {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    let welcomeBonus = 100;
    let referrerId = null;

    // Check referral code if provided
    if (referral_code) {
      const { data: referrer } = await supabase
        .from('users')
        .select('id')
        .eq('username', referral_code.toLowerCase())
        .single();

      if (referrer) {
        referrerId = referrer.id;
        welcomeBonus += 50; // New user gets extra ₹50
      }
    }

    const insertData = { name, username, password: hashed, balance: welcomeBonus, referred_by: referrerId };
    if (email) insertData.email = email;

    const { data: newUser, error } = await supabase
      .from('users')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.message.includes('unique')) return res.status(400).json({ error: 'Username taken' });
      return res.status(500).json({ error: 'Database error' });
    }

    // Add welcome transaction
    await supabase.from('transactions').insert({
      user_id: newUser.id,
      type: 'credit',
      amount: welcomeBonus,
      description: referrerId ? 'Welcome bonus + Referral reward' : 'Welcome bonus'
    });

    // Give ₹50 to referrer
    if (referrerId) {
      const { data: refData } = await supabase.from('users').select('balance').eq('id', referrerId).single();
      if (refData) {
        await supabase.from('users').update({ balance: refData.balance + 50 }).eq('id', referrerId);
        await supabase.from('transactions').insert({
          user_id: referrerId,
          type: 'credit',
          amount: 50,
          description: `Referral bonus: ${username}`
        });
      }
    }

    res.json({ message: 'Registered', userId: newUser.id });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  const sanitizedUsername = username.toLowerCase().trim();

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', sanitizedUsername)
      .single();

    if (error || !user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, isAdmin: user.is_admin },
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
        isAdmin: user.is_admin
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Protected routes
app.use('/api', apiLimiter);

app.get('/api/me', auth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, username, balance')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update profile
app.post('/api/profile', auth, async (req, res) => {
  const { name, currentPassword, newPassword } = req.body;

  if (!name || !currentPassword) {
    return res.status(400).json({ error: 'Name and current password required' });
  }

  try {
    // Verify current password
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    // Build update object
    const updates = { name: sanitize(name) };

    // Update password if provided
    if (newPassword) {
      if (!validatePassword(newPassword)) {
        return res.status(400).json({ error: 'New password: 8+ chars, uppercase, lowercase, number required' });
      }
      updates.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    }

    await supabase.from('users').update(updates).eq('id', req.user.id);
    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public routes (no auth required)
app.get('/api/matches', async (req, res) => {
  try {
    const { data: matches, error } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'live')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(matches || []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Alias for frontend compatibility
app.get('/api/my-bets', auth, async (req, res) => {
  try {
    const { data: bets, error } = await supabase
      .from('bets')
      .select('*, matches(team_a, team_b, result)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(bets || []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/matches', auth, adminOnly, async (req, res) => {
  try {
    const { data: matches, error } = await supabase
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(matches || []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create multiple matches at once
app.post("/api/admin/matches/bulk", auth, adminOnly, async (req, res) => {
  const { count = 10 } = req.body;
  try {
    await createAutoMatches(count);
    res.json({ message: `Created ${count} matches` });
  } catch (err) {
    res.status(500).json({ error: "Failed to create matches" });
  }
});

// Cron endpoint - can be called by Vercel cron or external scheduler
app.get("/api/cron/check-matches", async (req, res) => {
  // Simple auth via query param for cron jobs
  const { key } = req.query;
  if (key !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await checkAndCreateMatches();
    res.json({ message: "Check complete" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/admin/matches', auth, adminOnly, async (req, res) => {
  let { team_a, team_b, odds_a, odds_draw, odds_b } = req.body;

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

  try {
    const { data, error } = await supabase
      .from('matches')
      .insert({ team_a, team_b, odds_a, odds_draw, odds_b })
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Database error' });
    res.json({ id: data.id });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Settle match
app.post('/api/admin/matches/:id/settle', auth, adminOnly, async (req, res) => {
  const { result } = req.body;
  const matchId = parseInt(req.params.id);

  if (!result || !['A', 'draw', 'B'].includes(result)) {
    return res.status(400).json({ error: 'Invalid result. Use A, draw, or B' });
  }

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return res.status(400).json({ error: 'Invalid match ID' });
  }

  try {
    // Get match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) return res.status(404).json({ error: 'Match not found' });
    if (match.status !== 'live') return res.status(400).json({ error: 'Match already settled' });

    // Update match
    await supabase
      .from('matches')
      .update({ status: 'settled', result, settled_at: new Date().toISOString() })
      .eq('id', matchId);

    // Get pending bets
    const { data: bets } = await supabase
      .from('bets')
      .select('*')
      .eq('match_id', matchId)
      .eq('status', 'pending');

    let processed = 0;
    if (bets && bets.length > 0) {
      for (const bet of bets) {
        let won = false;
        if (result === 'A' && bet.pick === match.team_a) won = true;
        else if (result === 'B' && bet.pick === match.team_b) won = true;
        else if (result === 'draw' && bet.pick === 'Draw') won = true;

        if (won) {
          await supabase.from('bets').update({ status: 'won', settled_at: new Date().toISOString() }).eq('id', bet.id);
          // Get current balance and update
          const { data: userData } = await supabase.from('users').select('balance').eq('id', bet.user_id).single();
          if (userData) {
            await supabase.from('users').update({ balance: userData.balance + bet.payout }).eq('id', bet.user_id);
          }
          await supabase.from('transactions').insert({
            user_id: bet.user_id,
            type: 'credit',
            amount: bet.payout,
            description: `Won bet on ${match.team_a} vs ${match.team_b}`
          });
        } else {
          await supabase.from('bets').update({ status: 'lost', settled_at: new Date().toISOString() }).eq('id', bet.id);
          await supabase.from('transactions').insert({
            user_id: bet.user_id,
            type: 'loss',
            amount: 0,
            description: `Lost bet on ${match.team_a} vs ${match.team_b}`
          });
        }
        processed++;
      }
    }

    res.json({ message: 'Match settled', result, betsProcessed: processed });
n    // Check if we need to create new matches
    await checkAndCreateMatches();
  } catch (err) {
    console.error('Settle error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Place bet
app.post('/api/bets', betLimiter, auth, async (req, res) => {
  let { match_id, pick, odds, stake } = req.body;
  const userId = req.user.id;

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

  try {
    // Get user balance
    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.balance < stake) return res.status(400).json({ error: 'Insufficient balance' });

    // Get match
    const { data: match } = await supabase
      .from('matches')
      .select('*')
      .eq('id', match_id)
      .eq('status', 'live')
      .single();

    if (!match) return res.status(400).json({ error: 'Match not available' });

    if (pick !== match.team_a && pick !== match.team_b && pick !== 'Draw') {
      return res.status(400).json({ error: 'Invalid pick for this match' });
    }

    const payout = Math.floor(stake * odds);

    // Insert bet
    const { data: bet } = await supabase
      .from('bets')
      .insert({ user_id: userId, match_id, pick, odds, stake, payout })
      .select()
      .single();

    // Update balance
    await supabase.from('users').update({ balance: user.balance - stake }).eq('id', userId);

    // Log transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'debit',
      amount: stake,
      description: `Bet on ${match.team_a} vs ${match.team_b}`
    });

    res.json({ betId: bet.id, payout, message: 'Bet placed' });
  } catch (err) {
    console.error('Place bet error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/bets', auth, async (req, res) => {
  try {
    const { data: bets, error } = await supabase
      .from('bets')
      .select('*, matches(team_a, team_b, result)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(bets || []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/transactions', auth, async (req, res) => {
  try {
    const { data: txs, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(txs || []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
app.post('/api/change-password', auth, async (req, res) => {
  const { current, new: newPass } = req.body;

  if (!current || !newPass) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  if (!validatePassword(newPass)) {
    return res.status(400).json({ error: 'Password: 8+ chars, uppercase, lowercase, number required' });
  }

  try {
    // Get current user password
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('password')
      .eq('id', req.user.id)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const valid = await bcrypt.compare(current, userData.password);
    if (!valid) {
      return res.status(400).json({ error: 'Current password incorrect' });
    }

    // Hash new password
    const hashed = await bcrypt.hash(newPass, SALT_ROUNDS);

    // Update password
    const { error } = await supabase
      .from('users')
      .update({ password: hashed })
      .eq('id', req.user.id);

    if (error) return res.status(500).json({ error: 'Failed to update password' });

    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, username, balance, created_at')
      .eq('is_admin', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Users query error:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(users || []);
  } catch (err) {
    console.error('Users fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


app.get('/api/admin/bets', auth, adminOnly, async (req, res) => {
  try {
    const { data: bets, error } = await supabase
      .from('bets')
      .select('*, users(username, name), matches(team_a, team_b)')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(bets || []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add balance to user
app.post('/api/admin/users/:id/add-balance', auth, adminOnly, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { amount } = req.body;

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  if (!amount || amount <= 0 || amount > 10000) {
    return res.status(400).json({ error: 'Amount must be 1-10000' });
  }

  try {
    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const newBalance = user.balance + amount;
    await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'credit',
      amount: amount,
      description: `Admin added ₹${amount}`
    });

    res.json({ message: `Added ₹${amount}`, newBalance });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Settle all pending bets (random results)
app.post('/api/admin/bets/settle-all', auth, adminOnly, async (req, res) => {
  try {
    // Get all pending bets
    const { data: bets } = await supabase
      .from('bets')
      .select('*, matches!inner(*)')
      .eq('status', 'pending');

    if (!bets || bets.length === 0) {
      return res.json({ settled: 0, message: 'No pending bets' });
    }

    let settled = 0;
    for (const bet of bets) {
      const match = bet.matches;
      if (!match || match.status !== 'live') continue;

      // Random result
      const results = ['A', 'draw', 'B'];
      const result = results[Math.floor(Math.random() * results.length)];

      // Update match
      await supabase
        .from('matches')
        .update({ status: 'settled', result, settled_at: new Date().toISOString() })
        .eq('id', bet.match_id);

      // Determine win
      let won = false;
      if (result === 'A' && bet.pick === match.team_a) won = true;
      else if (result === 'B' && bet.pick === match.team_b) won = true;
      else if (result === 'draw' && bet.pick === 'Draw') won = true;

      if (won) {
        await supabase.from('bets').update({ status: 'won', settled_at: new Date().toISOString() }).eq('id', bet.id);
        const { data: user } = await supabase.from('users').select('balance').eq('id', bet.user_id).single();
        if (user) {
          await supabase.from('users').update({ balance: user.balance + bet.payout }).eq('id', bet.user_id);
        }
        await supabase.from('transactions').insert({
          user_id: bet.user_id,
          type: 'credit',
          amount: bet.payout,
          description: `Won bet on ${match.team_a} vs ${match.team_b}`
        });
      } else {
        await supabase.from('bets').update({ status: 'lost', settled_at: new Date().toISOString() }).eq('id', bet.id);
        await supabase.from('transactions').insert({
          user_id: bet.user_id,
          type: 'loss',
          amount: 0,
          description: `Lost bet on ${match.team_a} vs ${match.team_b}`
        });
      }
      settled++;
    }

    res.json({ settled, message: `Settled ${settled} bets` });

    // Check if we need to create new matches
    await checkAndCreateMatches();
  } catch (err) {
    console.error('Settle all error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Aviator game endpoints
app.post("/api/game/bet", auth, async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  if (!amount || amount <= 0 || amount > 10000) {
    return res.status(400).json({ error: "Invalid bet amount" });
  }

  try {
    const { data: user } = await supabase
      .from("users")
      .select("balance")
      .eq("id", userId)
      .single();

    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.balance < amount) return res.status(400).json({ error: "Insufficient balance" });

    const newBalance = user.balance - amount;
    await supabase.from("users").update({ balance: newBalance }).eq("id", userId);
    await supabase.from("transactions").insert({
      user_id: userId,
      type: "debit",
      amount: amount,
      description: "Aviator bet placed"
    });

    res.json({ message: "Bet placed", newBalance });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/game/cashout", auth, async (req, res) => {
  const { stake, multiplier } = req.body;
  const userId = req.user.id;

  if (!stake || !multiplier || multiplier < 1) {
    return res.status(400).json({ error: "Invalid cashout" });
  }

  const winAmount = Math.floor(stake * multiplier);
  const profit = winAmount - stake;

  try {
    const { data: user } = await supabase
      .from("users")
      .select("balance")
      .eq("id", userId)
      .single();

    if (!user) return res.status(404).json({ error: "User not found" });

    const newBalance = user.balance + winAmount;
    await supabase.from("users").update({ balance: newBalance }).eq("id", userId);
    await supabase.from("transactions").insert({
      user_id: userId,
      type: "credit",
      amount: winAmount,
      description: `Aviator cashout @ ${multiplier.toFixed(2)}x`
    });

    res.json({ message: "Cashout successful", winAmount, profit, newBalance });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
app.delete('/api/admin/matches/:id', auth, adminOnly, async (req, res) => {
  const matchId = parseInt(req.params.id);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return res.status(400).json({ error: 'Invalid match ID' });
  }

  try {
    await supabase.from('matches').delete().eq('id', matchId);
    res.json({ message: 'Match deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Debug endpoints removed - were only for development

// Error handler - never expose internal error details to client
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Server error' });
});

async function autoSettleMatches() {
  if (!autoSettleEnabled) return;

  try {
    // Get all live matches
    const { data: matches, error } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'live');

    if (error || !matches || matches.length === 0) return;

    // Settle each match with random result
    for (const match of matches) {
      const results = ['A', 'draw', 'B'];
      const result = results[Math.floor(Math.random() * results.length)];

      // Update match
      await supabase
        .from('matches')
        .update({ status: 'settled', result, settled_at: new Date().toISOString() })
        .eq('id', match.id);

      // Get pending bets for this match
      const { data: bets } = await supabase
        .from('bets')
        .select('*')
        .eq('match_id', match.id)
        .eq('status', 'pending');

      if (bets && bets.length > 0) {
        for (const bet of bets) {
          let won = false;
          if (result === 'A' && bet.pick === match.team_a) won = true;
          else if (result === 'B' && bet.pick === match.team_b) won = true;
          else if (result === 'draw' && bet.pick === 'Draw') won = true;

          if (won) {
            await supabase.from('bets').update({ status: 'won', settled_at: new Date().toISOString() }).eq('id', bet.id);
            const { data: user } = await supabase.from('users').select('balance').eq('id', bet.user_id).single();
            if (user) {
              await supabase.from('users').update({ balance: user.balance + bet.payout }).eq('id', bet.user_id);
            }
            await supabase.from('transactions').insert({
              user_id: bet.user_id,
              type: 'credit',
              amount: bet.payout,
              description: `Won bet on ${match.team_a} vs ${match.team_b}`
            });
          } else {
            await supabase.from('bets').update({ status: 'lost', settled_at: new Date().toISOString() }).eq('id', bet.id);
            await supabase.from('transactions').insert({
              user_id: bet.user_id,
              type: 'loss',
              amount: 0,
              description: `Lost bet on ${match.team_a} vs ${match.team_b}`
            });
          }
        }
      }
    }
    // Auto-settle complete
n    // Check if we need to create new matches
    await checkAndCreateMatches();
  } catch (err) {
    console.error('Auto-settle error:', err);
  }
}

// Manual settle endpoint for testing
app.post('/api/admin/settle-now', auth, adminOnly, async (req, res) => {
  try {
    await autoSettleMatches();
    res.json({ message: 'Settle triggered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle auto-settle endpoint
app.post('/api/admin/auto-settle', auth, adminOnly, async (req, res) => {
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be boolean' });
  }

  autoSettleEnabled = enabled;

  if (enabled) {
    if (!autoSettleInterval) {
      autoSettleInterval = setInterval(autoSettleMatches, 5000);
    }
    // Auto-settle enabled
  } else {
    if (autoSettleInterval) {
      clearInterval(autoSettleInterval);
      autoSettleInterval = null;
    }
    // Auto-settle disabled
  }

  res.json({ enabled: autoSettleEnabled });
});

// Get auto-settle status
app.get('/api/admin/auto-settle', auth, adminOnly, async (req, res) => {
  res.json({ enabled: autoSettleEnabled });
});

// Initialize and start
async function startServer() {
  await initDatabase();
}

// Export for Vercel serverless
if (process.env.VERCEL) {
  module.exports = app;
  startServer();
} else {
  app.listen(PORT, () => {
    // Server started
    startServer();
  });
}
