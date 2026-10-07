# Architecture A: No API Gateway

## Overview

Client communicates directly with each service. Each service handles its own:
- Authentication
- Rate limiting
- CORS
- Logging

## Architecture Diagram

```
┌──────────────┐
│    Client    │
│  (Browser)   │
└──────┬───────┘
       │
       ├──────────────────┬──────────────────┐
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ User Service│   │Order Service│   │Product Svc  │
│   :3001     │   │   :3002     │   │   :3003     │
│             │   │             │   │             │
│ - Auth      │   │ - Auth      │   │ - Auth     │
│ - Rate Limit│   │ - Rate Limit│   │ - Rate Limit│
│ - CORS      │   │ - CORS      │   │ - CORS     │
└─────────────┘   └─────────────┘   └─────────────┘
```

## Key Characteristics

### Problems with This Approach

1. **Duplicate Code**
   - Each service implements authentication middleware
   - Each service implements rate limiting
   - Each service handles CORS

2. **Client Complexity**
   - Client must know all service URLs
   - Client must manage multiple base URLs
   - Client must handle different ports

3. **Security Concerns**
   - All services exposed to internet
   - Token validation on every request in every service
   - No central point for security policies

4. **Operational Overhead**
   - Rate limits not coordinated across services
   - Logging scattered across services
   - No unified request tracing

### Benefits

1. **Simplicity**
   - Fewer moving parts
   - Easier to understand for small teams

2. **Performance**
   - One less network hop
   - Direct communication

3. **Independence**
   - Services can be deployed independently
   - No gateway dependency

## Running Architecture A

```powershell
# Start all services
docker-compose up --build

# In another terminal, test the services:
```

### Test Commands

```powershell
# 1. Health checks (no auth required)
Invoke-WebRequest -Uri http://localhost:3001/health | Select-Object -ExpandProperty Content
Invoke-WebRequest -Uri http://localhost:3002/health | Select-Object -ExpandProperty Content
Invoke-WebRequest -Uri http://localhost:3003/health | Select-Object -ExpandProperty Content

# 2. Login to get token (from user-service)
$loginBody = @{email='alice@example.com'} | ConvertTo-Json
$loginResponse = Invoke-WebRequest -Uri http://localhost:3001/login -Method POST -Body $loginBody -ContentType 'application/json'
$token = ($loginResponse | ConvertFrom-Json).token
Write-Host "Token: $token"

# 3. Get users (from user-service with auth)
$headers = @{Authorization="Bearer $token"}
Invoke-WebRequest -Uri http://localhost:3001/users -Headers $headers | Select-Object -ExpandProperty Content

# 4. Get orders (from order-service with auth)
Invoke-WebRequest -Uri http://localhost:3002/orders -Headers $headers | Select-Object -ExpandProperty Content

# 5. Get products (from product-service - no auth required)
Invoke-WebRequest -Uri http://localhost:3003/products | Select-Object -ExpandProperty Content

# 6. Test rate limiting (run this 11 times quickly)
1..11 | ForEach-Object {
    $response = Invoke-WebRequest -Uri http://localhost:3003/products -ErrorAction SilentlyContinue
    Write-Host "Request $_ : Status $($response.StatusCode)"
}
```

## Observations to Note

1. **Client must track 3 different URLs**: localhost:3001, localhost:3002, localhost:3003
2. **Rate limits are per-service**: You can hit each service 10 times/min independently
3. **Auth validated on each service**: Token validated 3 times if you call 3 services
4. **No central logging**: Each service logs independently

## Clean Up

```powershell
docker-compose down
```
