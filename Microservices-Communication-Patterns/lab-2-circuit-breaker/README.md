# Lab 2: Circuit Breaker Pattern

## Objective

Learn how to handle service failures gracefully using the Circuit Breaker pattern.

## What is Circuit Breaker?

Circuit Breaker prevents cascade failures by detecting when a service is down and failing fast without waiting for timeouts.

### Circuit States

```
CLOSED → OPEN → HALF-OPEN → CLOSED
  ↓        ↓         ↓
Normal  Failing   Testing
```

**CLOSED (Normal):**
- Requests flow through
- Failures are counted
- If failures exceed threshold → OPEN

**OPEN (Failing):**
- Requests fail immediately (no actual call)
- Wait for timeout period
- After timeout → HALF-OPEN

**HALF-OPEN (Testing):**
- Allow one test request
- If success → CLOSED
- If fail → OPEN again

## Architecture

```
Order Service
     ↓
[Circuit Breaker] ← Monitors failures
     ↓
Product Service
     ↓
  If Product Service down:
  - Circuit opens after 5 failures
  - Returns fallback response immediately
  - No timeout waiting
```

## What You'll Learn

1. **Circuit Breaker concept**
2. **State transitions**
3. **Fallback responses**
4. **Configuration parameters**
5. **Monitoring circuit state**

## Libraries

We use **Opossum** - Circuit Breaker for Node.js

```javascript
const CircuitBreaker = require('opossum');

const breaker = new CircuitBreaker(callProductService, {
  timeout: 3000, // 3 seconds
  errorThresholdPercentage: 50, // 50% errors
  resetTimeout: 30000 // 30 seconds
});
```

## Configuration Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `timeout` | Request timeout | 10000ms |
| `errorThresholdPercentage` | % errors to open circuit | 50% |
| `resetTimeout` | Time to try again | 30000ms |
| `volumeThreshold` | Min requests before calculating % | 0 |
| `rollingCountTimeout` | Time window for counting | 10000ms |

## Running the Lab

```bash
docker-compose up --build
```

## Testing Scenarios

### Scenario 1: Normal Operation (Circuit CLOSED)

```bash
# All services running
curl http://localhost:3001/health

# Create order - circuit is CLOSED
curl -X POST http://localhost:3002/orders \
  -H 'Content-Type: application/json' \
  -d '{"userId":1,"productId":1,"quantity":2}'
```

**Expected:** Order created successfully

### Scenario 2: Service Failure (Circuit Opens)

```bash
# Stop product service
docker-compose stop product-service

# Try multiple requests - circuit will OPEN after failures
for i in {1..10}; do
  echo "Request $i:"
  curl -s http://localhost:3002/orders -X POST \
    -H 'Content-Type: application/json' \
    -d '{"userId":1,"productId":1,"quantity":2}'
  echo ""
done
```

**Expected:** After 5 failures, circuit opens. Subsequent requests fail immediately.

### Scenario 3: Circuit Half-Open

```bash
# Wait 30 seconds (resetTimeout)
# Circuit goes to HALF-OPEN state

# Start product service
docker-compose start product-service

# Try one request - circuit tests if service is back
curl -X POST http://localhost:3002/orders \
  -H 'Content-Type: application/json' \
  -d '{"userId":1,"productId":1,"quantity":2}'
```

**Expected:** If success → Circuit CLOSES. If fail → Circuit OPENS again.

### Scenario 4: Fallback Response

When circuit is OPEN, order service returns fallback:

```json
{
  "error": "Service temporarily unavailable",
  "fallback": true,
  "circuitState": "OPEN",
  "message": "Please try again later"
}
```

## Monitoring Circuit State

### Via API

```bash
# Get circuit breaker stats
curl http://localhost:3002/circuit-breaker/stats
```

Response:
```json
{
  "state": "CLOSED",
  "stats": {
    "failures": 0,
    "fallbacks": 0,
    "successes": 5,
    "rejects": 0,
    "fires": 5
  }
}
```

### Via Logs

```bash
docker logs lab-2-circuit-breaker-order-service-1 -f
```

You'll see:
```
[Circuit Breaker] State: CLOSED
[Circuit Breaker] Failure: Product service unavailable
[Circuit Breaker] State changed: CLOSED → OPEN
[Circuit Breaker] Fallback response sent
[Circuit Breaker] State changed: OPEN → HALF-OPEN
[Circuit Breaker] Test request succeeded
[Circuit Breaker] State changed: HALF-OPEN → CLOSED
```

## Benefits

✓ **Fail Fast** - Don't wait for timeouts
✓ **Prevent Cascade** - Stop failures spreading
✓ **Save Resources** - No waiting threads
✓ **Auto Recovery** - Tests service periodically
✓ **Fallback** - Provide degraded functionality

## Code Example

**Order Service with Circuit Breaker:**

```javascript
const CircuitBreaker = require('opossum');
const axios = require('axios');

// Function to call product service
async function callProductService(productId) {
  const response = await axios.get(`http://product-service:3003/products/${productId}`);
  return response.data;
}

// Fallback function
async function fallback(productId) {
  return {
    error: 'Product service unavailable',
    fallback: true,
    message: 'Please try again later'
  };
}

// Create circuit breaker
const breaker = new CircuitBreaker(callProductService, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

// Set fallback
breaker.fallback(fallback);

// Monitor events
breaker.on('open', () => console.log('[Circuit Breaker] OPENED'));
breaker.on('halfOpen', () => console.log('[Circuit Breaker] HALF-OPEN'));
breaker.on('close', () => console.log('[Circuit Breaker] CLOSED'));

// Use circuit breaker
app.post('/orders', async (req, res) => {
  const result = await breaker.fire(productId);
  res.json(result);
});
```

## Real-World Example

**Netflix Hystrix** (Java):

```java
@HystrixCommand(
  fallbackMethod = "getProductFallback",
  commandProperties = {
    @HystrixProperty(name = "execution.isolation.thread.timeoutInMilliseconds", value = "3000"),
    @HystrixProperty(name = "circuitBreaker.errorThresholdPercentage", value = "50")
  }
)
public Product getProduct(Long id) {
  return productService.getProduct(id);
}

public Product getProductFallback(Long id) {
  return new Product(id, "Fallback Product", 0.0);
}
```

## Comparison: With vs Without Circuit Breaker

### Without Circuit Breaker

```
Request → Wait 30 seconds → Timeout → Error
Request → Wait 30 seconds → Timeout → Error
Request → Wait 30 seconds → Timeout → Error
Request → Wait 30 seconds → Timeout → Error

Total: 120 seconds wasted
```

### With Circuit Breaker

```
Request → Wait 3 seconds → Error (OPEN)
Request → Immediate → Fallback
Request → Immediate → Fallback
Request → Immediate → Fallback

Total: 3 seconds + immediate failures
```

## Clean Up

```bash
docker-compose down
```

## Next Lab

**Lab 3: Retry & Timeout Strategies** - Implement retry logic with exponential backoff
