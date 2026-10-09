# Lab 1: REST Communication

## Objective

Learn how microservices communicate using REST APIs.

## Architecture

```
Client Request
     ↓
User Service (3001) ────HTTP────► Order Service (3002) ────HTTP────► Product Service (3003)
     ↓                            ↓                                  ↓
  Get user                    Create order                      Get product details
  Create order                Get order                         Update inventory
```

## What You'll Learn

1. **Service-to-service HTTP calls**
2. **Request/response patterns**
3. **Error handling between services**
4. **HTTP client configuration**
5. **Timeout management**

## Services

### User Service (Port 3001)
- Manages user data
- Endpoints:
  - `GET /health` - Health check
  - `GET /users/:id` - Get user by ID
  - `POST /orders` - Create order (calls order-service)

### Order Service (Port 3002)
- Manages orders
- Calls product-service for product details
- Endpoints:
  - `GET /health` - Health check
  - `GET /orders` - Get all orders
  - `POST /orders` - Create order
  - `GET /orders/:id` - Get order by ID

### Product Service (Port 3003)
- Manages product catalog
- Endpoints:
  - `GET /health` - Health check
  - `GET /products` - Get all products
  - `GET /products/:id` - Get product by ID

## Running the Lab

```bash
# Start all services
docker-compose up --build

# Check services are running
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

## Testing Service Communication

### Test 1: Direct Service Call
```bash
# Get user directly
curl http://localhost:3001/users/1

# Get product directly
curl http://localhost:3003/products/1
```

### Test 2: Service-to-Service Call
```bash
# User service calls order service
curl -X POST http://localhost:3001/orders \
  -H 'Content-Type: application/json' \
  -d '{"userId":1,"productId":1,"quantity":2}'
```

### Test 3: Chain of Calls
```bash
# Order service calls product service
curl -X POST http://localhost:3002/orders \
  -H 'Content-Type: application/json' \
  -d '{"userId":1,"productId":2,"quantity":1}'
```

## Communication Flow

**Scenario: Create Order**

1. Client → User Service: `POST /orders`
2. User Service validates user
3. User Service → Order Service: `POST /orders`
4. Order Service → Product Service: `GET /products/1`
5. Product Service returns product details
6. Order Service creates order
7. Order Service returns order to User Service
8. User Service returns order to client

**Total: 3 service calls, 2 HTTP hops**

## Error Scenarios

### Scenario 1: Product Service Down
```bash
# Stop product service
docker-compose stop product-service

# Try to create order
curl -X POST http://localhost:3002/orders \
  -H 'Content-Type: application/json' \
  -d '{"userId":1,"productId":1,"quantity":2}'

# Result: Error from order-service
```

### Scenario 2: Timeout
```bash
# All services running
# But product-service takes too long to respond
# Order-service will timeout after 5 seconds
```

## Code Structure

```
lab-1-rest-communication/
├── docker-compose.yml
├── README.md
└── services/
    ├── user-service/
    │   ├── server.js
    │   ├── package.json
    │   └── Dockerfile
    ├── order-service/
    │   ├── server.js
    │   ├── package.json
    │   └── Dockerfile
    └── product-service/
        ├── server.js
        ├── package.json
        └── Dockerfile
```

## Key Concepts

### 1. HTTP Client Configuration
```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'http://order-service:3002',
  timeout: 5000, // 5 seconds timeout
  headers: { 'Content-Type': 'application/json' }
});
```

### 2. Error Handling
```javascript
try {
  const response = await client.post('/orders', orderData);
  return response.data;
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    // Service unavailable
  } else if (error.code === 'ETIMEDOUT') {
    // Timeout occurred
  }
  throw error;
}
```

### 3. Service Discovery (Docker DNS)
```javascript
// Docker Compose automatically resolves service names
const ORDER_SERVICE_URL = 'http://order-service:3002';
// 'order-service' resolves to the container IP
```

## Challenges

1. **What happens when product-service is slow?**
   - Order service waits
   - User service waits
   - Client waits
   - Bad user experience

2. **What happens when product-service crashes?**
   - Order service gets connection error
   - Error propagates to user service
   - Client gets error

3. **How to handle failures gracefully?**
   - See Lab 4: Circuit Breaker Pattern
   - See Lab 5: Retry & Timeout Strategies

## Clean Up

```bash
docker-compose down
```

## Next Lab

**Lab 2: gRPC Communication** - Learn high-performance RPC communication
