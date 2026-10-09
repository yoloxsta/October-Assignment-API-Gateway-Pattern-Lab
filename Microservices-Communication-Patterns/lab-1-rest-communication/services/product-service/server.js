const express = require('express');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

// Simulated product database
const products = [
  { id: 1, name: 'Laptop', price: 999.99, category: 'Electronics', stock: 50 },
  { id: 2, name: 'Headphones', price: 149.99, category: 'Electronics', stock: 200 },
  { id: 3, name: 'Coffee Maker', price: 79.99, category: 'Kitchen', stock: 100 },
  { id: 4, name: 'Running Shoes', price: 129.99, category: 'Sports', stock: 75 }
];

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'product-service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Get all products
app.get('/products', (req, res) => {
  res.json({
    products: products,
    count: products.length,
    service: 'product-service'
  });
});

// Get product by ID
app.get('/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  
  if (!product) {
    return res.status(404).json({
      error: 'Product not found',
      service: 'product-service',
      productId: req.params.id
    });
  }
  
  res.json({
    product: product,
    service: 'product-service'
  });
});

app.listen(PORT, () => {
  console.log(`Product Service running on port ${PORT}`);
});
