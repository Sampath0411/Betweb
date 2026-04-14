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
      const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123ChangeMe!', SALT_ROUNDS);
      await supabase.from('users').insert({
        name: 'Admin',
        username: 'admin',
        password: hashed,
        is_admin: true,
        balance: 0
      });
      console.log('Admin user created');
    }

    // Check if matches exist
    const { data: matchesCount } = await supabase
      .from('matches')
      .select('id', { count: 'exact' })
      .eq('status', 'live');

    if (!matchesCount || matchesCount.length === 0) {
      const matches = [
        { team_a: 'India', team_b: 'Australia', odds_a: 1.85, odds_draw: 3.40, odds_b: 2.10 },
        { team_a: 'Mumbai Indians', team_b: 'Chennai Super Kings', odds_a: 1.90, odds_draw: 3.20, odds_b: 1.95 },
        { team_a: 'Royal Challengers Bangalore', team_b: 'Rajasthan Royals', odds_a: 2.05, odds_draw: 3.30, odds_b: 1.80 },
        { team_a: 'Delhi Capitals', team_b: 'Kolkata Knight Riders', odds_a: 1.75, odds_draw: 3.50, odds_b: 2.30 },
        { team_a: 'Punjab Kings', team_b: 'Gujarat Titans', odds_a: 2.20, odds_draw: 3.10, odds_b: 1.75 }
      ];
      await supabase.from('matches').insert(matches);
      console.log('Seed matches created');
    }
  } catch (err) {
    console.error('Database init error:', err);
  }
}

// Auto-match system
const TEAMS = [
  'India', 'Australia', 'England', 'Pakistan', 'South Africa', 'New Zealand',
  'Sri Lanka', 'Bangladesh', 'West Indies', 'Afghanistan',
  'Mumbai Indians', 'Chennai Super Kings', 'Royal Challengers Bangalore',
  'Kolkata Knight Riders', 'Delhi Capitals', 'Punjab Kings',
  'Rajasthan Royals', 'Sunrisers Hyderabad', 'Gujarat Titans', 'Lucknow Super Giants'
];

function getRandomTeams() {
  const shuffled = [...TEAMS].sort(() => 0.5 - Math.random());
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

async function createAutoMatches() {
  try {
    const matches = [];
    for (let i = 0; i < 5; i++) {
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
    console.log('Auto-created 5 matches:', data.map(m => `${m.team_a} vs ${m.team_b}`));
    // Schedule auto-settle in 1 minute
    setTimeout(() => autoSettleMatches(data), 60000);
  } catch (err) {
    console.error('Auto-create matches error:', err);
  }
}

async function autoSettleMatches(matches) {
  try {
    for (const match of matches) {
      const results = ['a', 'draw', 'b'];
      const result = results[Math.floor(Math.random() * results.length)];
      // Settle match and payout
      await settleMatchWithPayout(match.id, result);
    }
    console.log('Auto-settled 5 matches');
    // Create new matches after settling
    setTimeout(createAutoMatches, 5000);
  } catch (err) {
    console.error('Auto-settle error:', err);
  }
}

async function settleMatchWithPayout(matchId, result) {
  try {
    // Update match result
    await supabase
      .from('matches')
      .update({ status: 'settled', result: result })
      .eq('id', matchId);
    // Get all bets for this match
    const { data: bets } = await supabase
      .from('bets')
      .select('*')
      .eq('match_id', matchId)
      .eq('status', 'pending');
    if (!bets || bets.length === 0) return;
    // Process each bet
    for (const bet of bets) {
      const won = bet.pick === result;
      const payout = won ? bet.stake * bet.odds : 0;
      // Update bet status
      await supabase
        .from('bets')
        .update({
          status: won ? 'won' : 'lost',
          payout: won ? payout : 0
        })
        .eq('id', bet.id);
      // Credit winner
      if (won) {
        const { data: user } = await supabase
          .from('users')
          .select('balance')
          .eq('id', bet.user_id)
          .single();
        if (user) {
          await supabase
            .from('users')
            .update({ balance: user.balance + payout })
            .eq('id', bet.user_id);
          // Add transaction
          await supabase.from('transactions').insert({
            user_id: bet.user_id,
            type: 'credit',
            amount: payout - bet.stake,
            description: `Won bet on match #${matchId} (${result})`,
            created_at: new Date().toISOString()
          });
        }
      }
    }
  } catch (err) {
    console.error('Settle match error:', err);
  }
}

// Check matches every 30 seconds
setInterval(async () => {
  try {
    const { data: liveMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('status', 'live');
    if (!liveMatches || liveMatches.length === 0) {
      console.log('No live matches - auto-creating...');
      await createAutoMatches();
    }
  } catch (err) {
    console.error('Match check error:', err);
  }
}, 30000);

// Health check endpoint for Vercel
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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
  let { name, username, password, referral_code } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
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

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ name, username, password: hashed, balance: welcomeBonus, referred_by: referrerId })
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

// Debug login (development only - remove in production)
app.post('/api/debug/login', async (req, res) => {
  const { username } = req.body;
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .single();
    if (!user) {
      return res.json({ exists: false, message: 'User not found' });
    }
    res.json({
      exists: true,
      is_admin: user.is_admin,
      has_password: !!user.password,
      password_length: user.password ? user.password.length : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin password reset (development only - remove in production)
app.get('/api/admin/fix-password', async (req, res) => {
  try {
    const hashed = await bcrypt.hash('admin123', SALT_ROUNDS);

    // Check if admin exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', 'admin')
      .single();

    if (existing) {
      // Update password
      const { data, error } = await supabase
        .from('users')
        .update({ password: hashed })
        .eq('username', 'admin')
        .select();
      if (error) throw error;
      return res.json({ message: 'Admin password reset to: admin123', data });
    } else {
      // Create admin
      const { data, error } = await supabase
        .from('users')
        .insert({
          name: 'Admin',
          username: 'admin',
          password: hashed,
          is_admin: true,
          balance: 0
        })
        .select();
      if (error) throw error;
      return res.json({ message: 'Admin created with password: admin123', data });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset', details: err.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Initialize and start
async function startServer() {
  await initDatabase();
  // Check if matches exist, if not create auto matches
  const { data: liveMatches } = await supabase
    .from('matches')
    .select('id')
    .eq('status', 'live');
  if (!liveMatches || liveMatches.length === 0) {
    console.log('No live matches on startup - creating auto matches...');
    await createAutoMatches();
  }
}

// Export for Vercel serverless
if (process.env.VERCEL) {
  module.exports = app;
  startServer();
} else {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin login: admin / (see ADMIN_PASSWORD env or default)`);
    console.log('Auto-match system: 5 matches every 1 minute with random results');
    startServer();
  });
}
