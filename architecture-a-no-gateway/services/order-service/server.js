const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3002;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

// Middleware
app.use(express.json());

// DUPLICATE rate limiting logic (same as user-service)
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000;

function checkRateLimit(req, res, next) {
  const clientId = req.ip;
  const now = Date.now();
  const clientRequests = rateLimitMap.get(clientId) || [];
  
  const recentRequests = clientRequests.filter(time => now - time < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      service: 'order-service',
      limit: RATE_LIMIT,
      window: '1 minute'
    });
  }
  
  recentRequests.push(now);
  rateLimitMap.set(clientId, recentRequests);
  next();
}

// DUPLICATE authentication logic (same as user-service)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing or invalid authorization header',
      service: 'order-service',
      hint: 'Include: Authorization: Bearer <token>'
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, 'shared-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      service: 'order-service'
    });
  }
}

// Simulated order database
const orders = [
  { id: 1, userId: 1, productId: 1, quantity: 2, status: 'completed' },
  { id: 2, userId: 1, productId: 3, quantity: 1, status: 'pending' },
  { id: 3, userId: 2, productId: 2, quantity: 5, status: 'completed' }
];

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'order-service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Get all orders (requires auth)
app.get('/orders', checkRateLimit, authenticate, async (req, res) => {
  try {
    // Fetch user details from user-service (service-to-service call)
    const userResponse = await axios.get(`${USER_SERVICE_URL}/users/${req.user.id}`, {
      headers: { Authorization: req.headers.authorization }
    });
    
    res.json({
      orders: orders.map(o => ({
        id: o.id,
        userId: o.userId,
        productId: o.productId,
        quantity: o.quantity,
        status: o.status
      })),
      user: userResponse.data.user,
      service: 'order-service',
      requestedBy: req.user.email
    });
  } catch (err) {
    // Still return orders even if user-service is down
    res.json({
      orders: orders.map(o => ({
        id: o.id,
        userId: o.userId,
        productId: o.productId,
        quantity: o.quantity,
        status: o.status
      })),
      userServiceError: err.message,
      service: 'order-service',
      requestedBy: req.user.email
    });
  }
});

// Get order by ID (requires auth)
app.get('/orders/:id', checkRateLimit, authenticate, (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  
  if (!order) {
    return res.status(404).json({
      error: 'Order not found',
      service: 'order-service'
    });
  }
  
  res.json({
    order: order,
    service: 'order-service',
    requestedBy: req.user.email
  });
});

// Create order (requires auth)
app.post('/orders', checkRateLimit, authenticate, (req, res) => {
  const { productId, quantity } = req.body;
  
  if (!productId || !quantity) {
    return res.status(400).json({
      error: 'Missing productId or quantity',
      service: 'order-service'
    });
  }
  
  const newOrder = {
    id: orders.length + 1,
    userId: req.user.id,
    productId: productId,
    quantity: quantity,
    status: 'pending'
  };
  
  orders.push(newOrder);
  
  res.status(201).json({
    order: newOrder,
    service: 'order-service',
    createdBy: req.user.email
  });
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Get orders: GET http://localhost:${PORT}/orders`);
});
