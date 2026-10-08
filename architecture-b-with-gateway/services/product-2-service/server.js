const express = require('express');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(express.json());

// Simulated product database
const products = [
  { id: 1, name: 'Wireless Mouse', price: 29.99, category: 'Accessories', stock: 150 },
  { id: 2, name: 'Mechanical Keyboard', price: 89.99, category: 'Accessories', stock: 80 },
  { id: 3, name: 'Monitor Stand', price: 49.99, category: 'Accessories', stock: 60 }
];

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'product-2-service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Get all products
app.get('/products-2', (req, res) => {
  res.json({
    products: products,
    service: 'product-2-service'
  });
});

// Get product by ID
app.get('/products-2/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  
  if (!product) {
    return res.status(404).json({
      error: 'Product not found',
      service: 'product-2-service'
    });
  }
  
  res.json({
    product: product,
    service: 'product-2-service'
  });
});

app.listen(PORT, () => {
  console.log(`Product 2 Service running on port ${PORT}`);
});
