# Architecture B: With API Gateway (Kong)

## Overview

Client communicates with a single gateway (Kong) that handles:
- **Routing** - Maps URLs to backend services
- **Rate Limiting** - Centralized throttling
- **Authentication** - Single point for auth validation
- **Request Transformation** - Header manipulation, request/response modification

## Architecture Diagram

```
┌──────────────┐
│    Client    │
│  (Browser)   │
└──────┬───────┘
       │ Single endpoint
       │ http://localhost:8000
       ▼
┌─────────────────────────────────────┐
│        Kong API Gateway             │
│           Port 8000                 │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Rate Limiting (100/min)     │   │
│  │ Key Auth (for /orders)      │   │
│  │ Request Routing             │   │
│  │ Load Balancing              │   │
│  │ Logging & Metrics           │   │
│  └─────────────────────────────┘   │
└──────┬──────────┬──────────┬───────┘
       │          │          │
       ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│  User   │ │  Order  │ │ Product │
│ Service │ │ Service │ │ Service │
│  :3001  │ │  :3002  │ │  :3003  │
│         │ │         │ │         │
│ NO:     │ │ NO:     │ │ NO:     │
│ - Auth  │ │ - Auth  │ │ - Auth  │
│ - Rate  │ │ - Rate  │ │ - Rate  │
│ - CORS  │ │ - CORS  │ │ - CORS  │
└─────────┘ └─────────┘ └─────────┘
```

## Key Benefits

### 1. Centralized Cross-Cutting Concerns

| Concern | Architecture A | Architecture B |
|---------|---------------|---------------|
| Rate Limiting | Each service implements | Gateway handles globally |
| Authentication | Each service validates | Gateway validates once |
| Logging | Scattered | Centralized |
| CORS | Each service handles | Gateway handles |

### 2. Simplified Services

Services in Architecture B are **leaner** - they focus on business logic only:

```javascript
// Architecture A: Service must handle auth
app.get('/users', authenticate, checkRateLimit, (req, res) => { ... });

// Architecture B: Service just handles the request
app.get('/users', (req, res) => { ... });
```

### 3. Client Simplicity

**Architecture A:**
```
Client must know:
  - http://localhost:3001/users
  - http://localhost:3002/orders
  - http://localhost:3003/products
```

**Architecture B:**
```
Client knows only:
  - http://localhost:8000/users
  - http://localhost:8000/orders
  - http://localhost:8000/products
```

### 4. Security

- Services are **not exposed** to the internet (only gateway is)
- Single point for security policies
- Centralized API key management
- Easy to add OAuth, JWT validation, IP whitelisting

## Running Architecture B

### Step 1: Start the Services

```powershell
cd architecture-b-with-gateway
docker-compose up -d
```

Wait for all services to be healthy:

```powershell
docker-compose ps
```

### Step 2: Configure Kong

```powershell
# Run the Kong setup script
.\setup-kong.ps1
```

This script configures:
- 3 services (user, order, product)
- Routes for each service
- Global rate limiting (100 requests/minute)
- Key authentication for order-service

### Step 3: Test the Gateway

```powershell
# 1. Health check (routes to user-service)
Invoke-WebRequest -Uri 'http://localhost:8000/health' | Select-Object -ExpandProperty Content

# 2. Get products (public endpoint)
Invoke-WebRequest -Uri 'http://localhost:8000/products' | Select-Object -ExpandProperty Content

# 3. Get product by ID
Invoke-WebRequest -Uri 'http://localhost:8000/products/1' | Select-Object -ExpandProperty Content

# 4. Login
$body = @{email='alice@example.com'} | ConvertTo-Json
Invoke-WebRequest -Uri 'http://localhost:8000/login' -Method POST -Body $body -ContentType 'application/json'

# 5. Get orders (REQUIRES API KEY - this will fail)
Invoke-WebRequest -Uri 'http://localhost:8000/orders' -ErrorAction SilentlyContinue

# 6. Get orders WITH API KEY
$headers = @{'apikey'='my-secret-api-key-123'}
Invoke-WebRequest -Uri 'http://localhost:8000/orders' -Headers $headers | Select-Object -ExpandProperty Content
```

### Step 4: Test Rate Limiting

```powershell
# Run 101 requests rapidly to hit rate limit
1..101 | ForEach-Object {
    $response = Invoke-WebRequest -Uri 'http://localhost:8000/products' -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "Request $_ : OK" -ForegroundColor Green
    } else {
        Write-Host "Request $_ : Rate Limited!" -ForegroundColor Red
        break
    }
}
```

## Kong Admin API

You can inspect and modify Kong configuration via Admin API:

```powershell
# List all services
Invoke-WebRequest -Uri 'http://localhost:8001/services' | Select-Object -ExpandProperty Content

# List all routes
Invoke-WebRequest -Uri 'http://localhost:8001/routes' | Select-Object -ExpandProperty Content

# List all plugins
Invoke-WebRequest -Uri 'http://localhost:8001/plugins' | Select-Object -ExpandProperty Content

# Check gateway status
Invoke-WebRequest -Uri 'http://localhost:8001/status' | Select-Object -ExpandProperty Content
```

## Clean Up

```powershell
docker-compose down -v
```

## Tradeoffs

### Benefits
- ✓ Centralized security, rate limiting, logging
- ✓ Services can be simplified (focus on business logic)
- ✓ Client has single endpoint
- ✓ Easy to add/remove services without client changes
- ✓ Better observability (all traffic through one point)

### Costs
- ✗ Additional infrastructure (Kong + database)
- ✗ Extra network hop (slight latency increase)
- ✗ Single point of failure (use multiple gateway replicas)
- ✗ More complex setup and maintenance
- ✗ Learning curve for gateway configuration
