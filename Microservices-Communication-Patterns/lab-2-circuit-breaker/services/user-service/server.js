const express = require('express');
const axios = require('axios');
const CircuitBreaker = require('opossum');

const app = express();
const PORT = process.env.PORT || 3001;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3002';

app.use(express.json());

// HTTP client
const orderClient = axios.create({
  baseURL: ORDER_SERVICE_URL,
  timeout: 3000,
  headers: { 'Content-Type': 'application/json' }
});

// Simulated user database
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'user' }
];

// Function to call order service
async function callOrderService(orderData) {
  console.log('[User Service] Calling order service...');
  const response = await orderClient.post('/orders', orderData);
  return response.data;
}

// Fallback function when circuit is open
async function orderFallback(orderData) {
  console.log('[User Service] Circuit breaker fallback triggered');
  return {
    error: 'Order service temporarily unavailable',
    fallback: true,
    circuitState: 'OPEN',
    message: 'Please try again later',
    orderData: orderData
  };
}

// Create circuit breaker
const orderCircuitBreaker = new CircuitBreaker(callOrderService, {
  timeout: 3000, // 3 seconds timeout
  errorThresholdPercentage: 50, // Open circuit if 50% errors
  resetTimeout: 30000, // Try again after 30 seconds
  volumeThreshold: 5 // Minimum requests before calculating error %
});

// Set fallback
orderCircuitBreaker.fallback(orderFallback);

// Circuit breaker events
orderCircuitBreaker.on('open', () => {
  console.log('[User Service] Circuit breaker OPENED');
});

orderCircuitBreaker.on('halfOpen', () => {
  console.log('[User Service] Circuit breaker HALF-OPEN');
});

orderCircuitBreaker.on('close', () => {
  console.log('[User Service] Circuit breaker CLOSED');
});

orderCircuitBreaker.on('fallback', () => {
  console.log('[User Service] Fallback executed');
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user-service',
    port: PORT,
    circuitBreaker: {
      state: orderCircuitBreaker.status.state,
      stats: orderCircuitBreaker.stats
    },
    timestamp: new Date().toISOString()
  });
});

// Circuit breaker stats endpoint
app.get('/circuit-breaker/stats', (req, res) => {
  res.json({
    state: orderCircuitBreaker.status.state,
    stats: orderCircuitBreaker.stats,
    config: {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    }
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

// Create order - uses circuit breaker
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
    
    // Use circuit breaker to call order service
    const result = await orderCircuitBreaker.fire({ userId, productId, quantity });
    
    res.status(result.fallback ? 503 : 201).json({
      ...result,
      user: { id: user.id, name: user.name, email: user.email },
      service: 'user-service',
      circuitBreakerState: orderCircuitBreaker.status.state
    });
    
  } catch (error) {
    console.error(`[User Service] Error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to create order',
      service: 'user-service',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
  console.log(`Order Service URL: ${ORDER_SERVICE_URL}`);
  console.log(`Circuit Breaker: timeout=3000ms, errorThreshold=50%, resetTimeout=30000ms`);
});
