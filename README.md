# API Gateway Pattern Lab

## Lab Objective

Compare two architecture approaches:
- **Architecture A**: Client calls multiple services directly
- **Architecture B**: Client calls services through an API Gateway

## What You'll Learn

1. **Client complexity** - How much logic each approach pushes to the client
2. **Security** - Centralized vs distributed authentication
3. **Rate limiting** - Per-service vs centralized throttling
4. **Routing flexibility** - URL structure and service discovery
5. **Single point of failure** - Tradeoffs of adding a gateway layer

## Architecture Comparison

```
Architecture A (No Gateway):
┌────────┐     ┌─────────────┐
│ Client │────▶│ User Service│ :3001
│        │     └─────────────┘
│        │     ┌─────────────┐
│        │────▶│ Order Service│ :3002
│        │     └─────────────┘
│        │     ┌─────────────┐
│        │────▶│ Product Svc │ :3003
└────────┘     └─────────────┘

Architecture B (With API Gateway):
┌────────┐     ┌─────────────┐     ┌─────────────┐
│ Client │────▶│ Kong Gateway│────▶│ User Service│ :3001
└────────┘     │   :8000     │     └─────────────┘
               │             │     ┌─────────────┐
               │             │────▶│ Order Service│ :3002
               │             │     └─────────────┘
               │             │     ┌─────────────┐
               │             │────▶│ Product Svc │ :3003
               └─────────────┘     └─────────────┘
```

## Prerequisites

- Docker Desktop installed and running
- PowerShell terminal

## Quick Start

```powershell
# Architecture A - No Gateway
cd architecture-a-no-gateway
docker-compose up --build

# Architecture B - With Gateway (separate terminal)
cd architecture-b-with-gateway
docker-compose up --build
```

## Lab Exercises

### Exercise 1: Client Complexity
Compare how many endpoints the client needs to know in each architecture.

### Exercise 2: Authentication
Architecture A: Each service validates tokens independently
Architecture B: Gateway validates tokens before routing

### Exercise 3: Rate Limiting
Architecture A: Each service implements its own rate limiting
Architecture B: Centralized rate limiting at gateway

### Exercise 4: Failure Scenarios
What happens when a service goes down? How does each architecture handle it?

## Services Included

| Service | Port | Purpose |
|---------|------|---------|
| User Service | 3001 | User management, authentication |
| Order Service | 3002 | Order processing |
| Product Service | 3003 | Product catalog |
| Kong Gateway | 8000 | API Gateway (Architecture B only) |
