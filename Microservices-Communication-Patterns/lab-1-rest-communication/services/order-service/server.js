const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3002;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003';

app.use(express.json());

// HTTP client with timeout
const productClient = axios.create({
  baseURL: PRODUCT_SERVICE_URL,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' }
});

// Simulated order database
const orders = [];

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'order-service',
    port: PORT,
    timestamp: new Date().toISOString()
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

// Create order - calls product-service
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
    console.log(`[Order Service] Calling Product Service at ${PRODUCT_SERVICE_URL}`);
    
    // Call product-service to get product details
    const productResponse = await productClient.get(`/products/${productId}`);
    const product = productResponse.data.product;
    
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
      calledService: 'product-service'
    });
    
  } catch (error) {
    console.error(`[Order Service] Error: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Product service unavailable',
        service: 'order-service',
        details: 'Could not connect to product-service'
      });
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Product service timeout',
        service: 'order-service',
        details: 'Product service did not respond in time'
      });
    }
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        error: 'Product not found',
        service: 'order-service',
        productId: productId
      });
    }
    
    res.status(error.response?.status || 500).json({
      error: 'Failed to create order',
      service: 'order-service',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
  console.log(`Product Service URL: ${PRODUCT_SERVICE_URL}`);
});
