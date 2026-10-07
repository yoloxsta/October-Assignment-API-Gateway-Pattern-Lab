# Architecture Comparison: A vs B

## Side-by-Side Comparison

| Aspect | Architecture A (No Gateway) | Architecture B (With Gateway) |
|--------|---------------------------|------------------------------|
| **Client Endpoints** | 3 different URLs/ports | 1 URL |
| **Authentication** | Each service validates | Gateway validates centrally |
| **Rate Limiting** | Per-service, not coordinated | Global, coordinated |
| **Code Duplication** | High (auth, rate limit in each service) | Low (gateway handles concerns) |
| **Service Exposure** | All services exposed | Only gateway exposed |
| **Client Complexity** | Must know all service URLs | Single base URL |
| **Infrastructure** | Simple (just services) | Complex (gateway + DB) |
| **Latency** | Lower (direct) | Higher (extra hop) |
| **SPOF Risk** | Distributed | Gateway is SPOF |
| **Observability** | Scattered logs | Centralized logs |
| **Scaling** | Scale each service | Scale gateway + services |

## Decision Framework

### Choose Architecture A When:

- ✓ Small team, simple application
- ✓ 2-3 services maximum
- ✓ Services have different security requirements
- ✓ Latency is critical
- ✓ Want to minimize infrastructure
- ✓ Team unfamiliar with gateways

### Choose Architecture B When:

- ✓ 3+ services with similar auth needs
- ✓ Need centralized rate limiting
- ✓ Want unified API surface for clients
- ✓ Security policies must be consistent
- ✓ Need better observability
- ✓ Planning to scale to many services

## Practical Exercise: Compare Side-by-Side

### Setup

Open two PowerShell windows:

**Window 1 - Architecture A:**
```powershell
cd d:\2026\saa\api-gateway-lab\architecture-a-no-gateway
docker-compose up --build
```

**Window 2 - Architecture B:**
```powershell
cd d:\2026\saa\api-gateway-lab\architecture-b-with-gateway
docker-compose up --build

# Wait for services to start, then configure Kong:
.\setup-kong.ps1
```

### Comparison Tests

Run these tests and observe the differences:

#### Test 1: Client Complexity

**Architecture A:**
```powershell
# Client must know 3 different ports
Invoke-WebRequest -Uri 'http://localhost:3001/users'
Invoke-WebRequest -Uri 'http://localhost:3002/orders'
Invoke-WebRequest -Uri 'http://localhost:3003/products'
```

**Architecture B:**
```powershell
# Client knows only 1 port
Invoke-WebRequest -Uri 'http://localhost:8000/users'
Invoke-WebRequest -Uri 'http://localhost:8000/orders'
Invoke-WebRequest -Uri 'http://localhost:8000/products'
```

**Observation:** Architecture B client code is simpler.

---

#### Test 2: Authentication Implementation

**Architecture A:**
```powershell
# Check the code - each service has authenticate() function
# Open: architecture-a-no-gateway/services/user-service/server.js
# Open: architecture-a-no-gateway/services/order-service/server.js
# Open: architecture-a-no-gateway/services/product-service/server.js
```

**Architecture B:**
```powershell
# Check the code - services have NO authenticate() function
# Open: architecture-b-with-gateway/services/user-service/server.js
# Open: architecture-b-with-gateway/services/order-service/server.js
# Open: architecture-b-with-gateway/services/product-service/server.js
```

**Observation:** Architecture B has ~30% less code per service.

---

#### Test 3: Rate Limiting Coordination

**Architecture A:**
```powershell
# Each service tracks its own rate limit
# Hit user-service 10 times
1..11 | ForEach-Object {
    Invoke-WebRequest -Uri 'http://localhost:3001/users' -Headers @{Authorization='Bearer test'} -ErrorAction SilentlyContinue
    Write-Host "User service request $_"
}

# You can still hit order-service 10 more times!
1..11 | ForEach-Object {
    Invoke-WebRequest -Uri 'http://localhost:3002/orders' -Headers @{Authorization='Bearer test'} -ErrorAction SilentlyContinue
    Write-Host "Order service request $_"
}
```

**Architecture B:**
```powershell
# Rate limit is global - tracked across all services
# Hit the gateway 100 times
1..101 | ForEach-Object {
    $r = Invoke-WebRequest -Uri 'http://localhost:8000/products' -ErrorAction SilentlyContinue
    if ($r.StatusCode -ne 200) {
        Write-Host "Rate limited at request $_" -ForegroundColor Red
        break
    }
}

# Now ALL services are rate-limited
Invoke-WebRequest -Uri 'http://localhost:8000/users' -ErrorAction SilentlyContinue
```

**Observation:** Architecture B has coordinated rate limiting.

---

#### Test 4: Security Surface Area

**Architecture A:**
```powershell
# All services are directly accessible
# If attacker finds one service, they can bypass others
Invoke-WebRequest -Uri 'http://localhost:3001/users'  # Exposed
Invoke-WebRequest -Uri 'http://localhost:3002/orders' # Exposed
Invoke-WebRequest -Uri 'http://localhost:3003/products' # Exposed
```

**Architecture B:**
```powershell
# Only gateway is accessible
# Services are on internal network, not exposed
Invoke-WebRequest -Uri 'http://localhost:8000/users'  # Only this works
# Services are not accessible from outside Docker network
```

**Observation:** Architecture B has smaller attack surface.

---

#### Test 5: Failure Scenarios

**Architecture A:**
```powershell
# Stop one service
docker-compose stop order-service

# Other services still work
Invoke-WebRequest -Uri 'http://localhost:3001/users'  # Works
Invoke-WebRequest -Uri 'http://localhost:3003/products'  # Works
```

**Architecture B:**
```powershell
# Stop one service
docker-compose stop order-service

# Other services still work through gateway
Invoke-WebRequest -Uri 'http://localhost:8000/users'  # Works
Invoke-WebRequest -Uri 'http://localhost:8000/products'  # Works

# Stop the gateway
docker-compose stop kong-gateway

# ALL services become unreachable!
Invoke-WebRequest -Uri 'http://localhost:8000/users'  # Fails
```

**Observation:** Architecture B gateway is a single point of failure.

---

## Key Learnings

### What You Should Take Away

1. **Gateway Pattern trades simplicity for control**
   - More infrastructure complexity
   - But centralized control over cross-cutting concerns

2. **Client code is simpler with gateway**
   - One base URL instead of many
   - Consistent error handling

3. **Services are simpler with gateway**
   - No auth/rate limiting code
   - Focus on business logic

4. **Gateway is a SPOF**
   - Must run multiple gateway replicas in production
   - Add health checks and failover

5. **Rate limiting is coordinated with gateway**
   - Prevents abuse across all services
   - But requires shared state (Redis) for distributed setups

## Clean Up

```powershell
# Architecture A
cd d:\2026\saa\api-gateway-lab\architecture-a-no-gateway
docker-compose down

# Architecture B
cd d:\2026\saa\api-gateway-lab\architecture-b-with-gateway
docker-compose down -v
```
