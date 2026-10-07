const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3002;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

// Middleware
app.use(express.json());

// NOTE: No rate limiting - gateway handles this
// NOTE: No authentication - gateway handles this

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

// Get all orders - Gateway handles auth
app.get('/orders', async (req, res) => {
  const userEmail = req.headers['x-user-email'] || 'unknown';
  const userId = req.headers['x-user-id'] || '1';
  
  try {
    // Fetch user details from user-service (internal call)
    const userResponse = await axios.get(`${USER_SERVICE_URL}/users/${userId}`, {
      headers: { 'x-user-email': userEmail }
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
      requestedBy: userEmail
    });
  } catch (err) {
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
      requestedBy: userEmail
    });
  }
});

// Get order by ID
app.get('/orders/:id', (req, res) => {
  const userEmail = req.headers['x-user-email'] || 'unknown';
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
    requestedBy: userEmail
  });
});

// Create order
app.post('/orders', (req, res) => {
  const userEmail = req.headers['x-user-email'] || 'unknown';
  const userId = req.headers['x-user-id'] || '1';
  const { productId, quantity } = req.body;
  
  if (!productId || !quantity) {
    return res.status(400).json({
      error: 'Missing productId or quantity',
      service: 'order-service'
    });
  }
  
  const newOrder = {
    id: orders.length + 1,
    userId: parseInt(userId),
    productId: productId,
    quantity: quantity,
    status: 'pending'
  };
  
  orders.push(newOrder);
  
  res.status(201).json({
    order: newOrder,
    service: 'order-service',
    createdBy: userEmail
  });
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
  console.log(`Gateway handles: rate limiting, authentication, routing`);
});
