const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(express.json());

// DUPLICATE rate limiting logic (third time!)
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
      service: 'product-service',
      limit: RATE_LIMIT,
      window: '1 minute'
    });
  }
  
  recentRequests.push(now);
  rateLimitMap.set(clientId, recentRequests);
  next();
}

// DUPLICATE authentication logic (third time!)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing or invalid authorization header',
      service: 'product-service',
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
      service: 'product-service'
    });
  }
}

// Simulated product database
const products = [
  { id: 1, name: 'Laptop', price: 999.99, category: 'Electronics', stock: 50 },
  { id: 2, name: 'Headphones', price: 149.99, category: 'Electronics', stock: 200 },
  { id: 3, name: 'Coffee Maker', price: 79.99, category: 'Kitchen', stock: 100 },
  { id: 4, name: 'Running Shoes', price: 129.99, category: 'Sports', stock: 75 }
];

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'product-service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Get all products (public endpoint - no auth required for catalog browsing)
app.get('/products', checkRateLimit, (req, res) => {
  res.json({
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category,
      stock: p.stock
    })),
    service: 'product-service'
  });
});

// Get product by ID (public)
app.get('/products/:id', checkRateLimit, (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  
  if (!product) {
    return res.status(404).json({
      error: 'Product not found',
      service: 'product-service'
    });
  }
  
  res.json({
    product: product,
    service: 'product-service'
  });
});

// Update product stock (requires auth)
app.patch('/products/:id/stock', checkRateLimit, authenticate, (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  
  if (!product) {
    return res.status(404).json({
      error: 'Product not found',
      service: 'product-service'
    });
  }
  
  const { quantity } = req.body;
  
  if (quantity === undefined || quantity < 0) {
    return res.status(400).json({
      error: 'Invalid quantity',
      service: 'product-service'
    });
  }
  
  product.stock = quantity;
  
  res.json({
    product: product,
    service: 'product-service',
    updatedBy: req.user.email
  });
});

app.listen(PORT, () => {
  console.log(`Product Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Get products: GET http://localhost:${PORT}/products`);
});
