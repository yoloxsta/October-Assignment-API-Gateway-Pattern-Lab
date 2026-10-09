const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3002';

app.use(express.json());

// HTTP client with timeout
const orderClient = axios.create({
  baseURL: ORDER_SERVICE_URL,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' }
});

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

// Get user by ID
app.get('/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      service: 'user-service'
    });
  }
  
  res.json({
    user: user,
    service: 'user-service'
  });
});

// Create order - calls order-service
app.post('/orders', async (req, res) => {
  const { userId, productId, quantity } = req.body;
  
  // Validate user
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      service: 'user-service'
    });
  }
  
  try {
    console.log(`[User Service] Creating order for user ${userId}`);
    console.log(`[User Service] Calling Order Service at ${ORDER_SERVICE_URL}`);
    
    // Call order-service
    const response = await orderClient.post('/orders', {
      userId,
      productId,
      quantity
    });
    
    console.log(`[User Service] Order created successfully`);
    
    res.status(201).json({
      order: response.data.order,
      user: { id: user.id, name: user.name, email: user.email },
      service: 'user-service',
      calledService: 'order-service'
    });
    
  } catch (error) {
    console.error(`[User Service] Error: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Order service unavailable',
        service: 'user-service',
        details: 'Could not connect to order-service'
      });
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Order service timeout',
        service: 'user-service',
        details: 'Order service did not respond in time'
      });
    }
    
    res.status(error.response?.status || 500).json({
      error: 'Failed to create order',
      service: 'user-service',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
  console.log(`Order Service URL: ${ORDER_SERVICE_URL}`);
});
