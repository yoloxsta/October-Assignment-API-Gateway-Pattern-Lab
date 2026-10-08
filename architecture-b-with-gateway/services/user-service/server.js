const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// JWT Secret (must match Kong consumer secret)
const JWT_SECRET = 'shared-secret-key';

// Simulated user database
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'user' }
];

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user-service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Login - generates JWT token
app.post('/login', (req, res) => {
  const { email } = req.body;
  
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      service: 'user-service'
    });
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { 
      expiresIn: '1h',
      issuer: 'user-service'
    }
  );
  
  res.json({
    user: { id: user.id, name: user.name, email: user.email },
    token: token,
    service: 'user-service'
  });
});

// Get all users
app.get('/users', (req, res) => {
  const userEmail = req.headers['x-user-email'] || 'unknown';
  
  res.json({
    users: users.map(u => ({ id: u.id, name: u.name, email: u.email })),
    service: 'user-service',
    requestedBy: userEmail
  });
});

// Get user by ID
app.get('/users/:id', (req, res) => {
  const userEmail = req.headers['x-user-email'] || 'unknown';
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
    requestedBy: userEmail
  });
});

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
  console.log(`Gateway handles: rate limiting, authentication, routing`);
});
