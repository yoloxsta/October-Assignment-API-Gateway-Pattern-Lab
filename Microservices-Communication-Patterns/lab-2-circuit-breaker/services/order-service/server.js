const express = require('express');
const axios = require('axios');
const CircuitBreaker = require('opossum');

const app = express();
const PORT = process.env.PORT || 3002;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003';

app.use(express.json());

// HTTP client
const productClient = axios.create({
  baseURL: PRODUCT_SERVICE_URL,
  timeout: 3000,
  headers: { 'Content-Type': 'application/json' }
});

// Simulated order database
const orders = [];

// Function to call product service
async function callProductService(productId) {
  console.log(`[Order Service] Calling product service for product ${productId}...`);
  const response = await productClient.get(`/products/${productId}`);
  return response.data;
}

// Fallback function when circuit is open
async function productFallback(productId) {
  console.log('[Order Service] Circuit breaker fallback triggered');
  return {
    error: 'Product service temporarily unavailable',
    fallback: true,
    circuitState: 'OPEN',
    message: 'Please try again later',
    productId: productId
  };
}

// Create circuit breaker - Simplified configuration for demo
const productCircuitBreaker = new CircuitBreaker(callProductService, {
  timeout: 3000,           // 3 seconds timeout
  errorThresholdPercentage: 1, // Very low threshold - opens after 1% errors
  resetTimeout: 30000,     // Try again after 30 seconds
  volumeThreshold: 1       // Minimum 1 request before calculating error %
});

// Set fallback
productCircuitBreaker.fallback(productFallback);

// Circuit breaker events
productCircuitBreaker.on('open', () => {
  console.log('[Order Service] Circuit breaker OPENED');
});

productCircuitBreaker.on('halfOpen', () => {
  console.log('[Order Service] Circuit breaker HALF-OPEN');
});

productCircuitBreaker.on('close', () => {
  console.log('[Order Service] Circuit breaker CLOSED');
});

productCircuitBreaker.on('fallback', () => {
  console.log('[Order Service] Fallback executed');
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'order-service',
    port: PORT,
    circuitBreaker: {
      state: productCircuitBreaker.status.state,
      stats: productCircuitBreaker.stats
    },
    timestamp: new Date().toISOString()
  });
});

// Circuit breaker stats endpoint
app.get('/circuit-breaker/stats', (req, res) => {
  const stats = productCircuitBreaker.stats;
  const errorPercentage = stats.fires > 0 ? ((stats.failures + stats.timeouts) / stats.fires * 100).toFixed(2) : 0;

  res.json({
    state: productCircuitBreaker.opened ? 'OPEN' : (productCircuitBreaker.halfOpen ? 'HALF_OPEN' : 'CLOSED'),
    stats: stats,
    analysis: {
      totalRequests: stats.fires,
      failedRequests: stats.failures + stats.timeouts,
      successRequests: stats.successes,
      errorPercentage: errorPercentage + '%',
      volumeThreshold: 3,
      errorThreshold: '100%',
      circuitOpenCondition: `Need ${3 - stats.fires} more requests to meet volume threshold`
    },
    config: {
      timeout: 3000,
      errorThresholdPercentage: 100,
      resetTimeout: 30000,
      volumeThreshold: 3
    }
  });
});

// Get all orders
app.get('/orders', (req, res) => {
  res.json({
    orders: orders,
    count: orders.length,
    service: 'order-service'
  });
});

// Get order by ID
app.get('/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  
  if (!order) {
    return res.status(404).json({
      error: 'Order not found',
      service: 'order-service'
    });
  }
  
  res.json({
    order: order,
    service: 'order-service'
  });
});

// Create order - uses circuit breaker
app.post('/orders', async (req, res) => {
  const { userId, productId, quantity } = req.body;
  
  if (!userId || !productId || !quantity) {
    return res.status(400).json({
      error: 'Missing required fields',
      service: 'order-service',
      required: ['userId', 'productId', 'quantity']
    });
  }
  
  try {
    console.log(`[Order Service] Creating order for product ${productId}`);
    
    // Use circuit breaker to call product service
    const productResult = await productCircuitBreaker.fire(productId);
    
    // If fallback was triggered, return error
    if (productResult.fallback) {
      return res.status(503).json({
        error: 'Product service unavailable',
        service: 'order-service',
        circuitBreakerState: productCircuitBreaker.status.state,
        fallback: true
      });
    }
    
    const product = productResult.product;
    console.log(`[Order Service] Product found: ${product.name}`);
    
    // Create order
    const order = {
      id: orders.length + 1,
      userId: userId,
      productId: productId,
      productName: product.name,
      price: product.price,
      quantity: quantity,
      total: product.price * quantity,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    orders.push(order);
    
    console.log(`[Order Service] Order created: ${order.id}`);
    
    res.status(201).json({
      order: order,
      product: product,
      service: 'order-service',
      circuitBreakerState: productCircuitBreaker.status.state
    });
    
  } catch (error) {
    console.error(`[Order Service] Error: ${error.message}`);
    
    res.status(500).json({
      error: 'Failed to create order',
      service: 'order-service',
      details: error.message,
      circuitBreakerState: productCircuitBreaker.status.state
    });
  }
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
  console.log(`Product Service URL: ${PRODUCT_SERVICE_URL}`);
  console.log(`Circuit Breaker: timeout=3000ms, errorThreshold=50%, resetTimeout=30000ms`);
});
