const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Simulated rate limiting per service
const rateLimitMap = new Map();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(req, res, next) {
  const clientId = req.ip;
  const now = Date.now();
  const clientRequests = rateLimitMap.get(clientId) || [];
  
  // Filter requests within the window
  const recentRequests = clientRequests.filter(time => now - time < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      service: 'user-service',
      limit: RATE_LIMIT,
      window: '1 minute'
    });
  }
  
  recentRequests.push(now);
  rateLimitMap.set(clientId, recentRequests);
  next();
}

// Authentication middleware - EACH SERVICE VALIDATES INDEPENDENTLY
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing or invalid authorization header',
      service: 'user-service',
      hint: 'Include: Authorization: Bearer <token>'
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // In real app, verify with shared secret or public key
    const decoded = jwt.verify(token, 'shared-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      service: 'user-service'
    });
  }
}

// Simulated user database
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'user' }
];

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user-service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Login (no auth required)
app.post('/login', checkRateLimit, (req, res) => {
  const { email } = req.body;
  
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      service: 'user-service'
    });
  }
  
  // Generate token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    'shared-secret-key',
    { expiresIn: '1h' }
  );
  
  res.json({
    user: { id: user.id, name: user.name, email: user.email },
    token: token,
    service: 'user-service'
  });
});

// Get all users (requires auth)
app.get('/users', checkRateLimit, authenticate, (req, res) => {
  res.json({
    users: users.map(u => ({ id: u.id, name: u.name, email: u.email })),
    service: 'user-service',
    requestedBy: req.user.email
  });
});

// Get user by ID (requires auth)
app.get('/users/:id', checkRateLimit, authenticate, (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      service: 'user-service'
    });
  }
  
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    service: 'user-service',
    requestedBy: req.user.email
  });
});

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Login: POST http://localhost:${PORT}/login`);
  console.log(`Get users: GET http://localhost:${PORT}/users`);
});
