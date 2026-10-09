# Microservices Communication Patterns Lab

## Overview

Learn how microservices communicate with each other and handle failures gracefully.

## Lab Topics

### Lab 1: REST Communication
- Service-to-service HTTP calls
- Request/response patterns
- Error handling
- HTTP client best practices

### Lab 2: gRPC Communication
- Protocol Buffers
- gRPC service definition
- Streaming (unary, server, client, bidirectional)
- Performance comparison with REST

### Lab 3: Service Discovery
- How services find each other
- Docker DNS-based discovery
- Consul service discovery
- Load balancing strategies

### Lab 4: Circuit Breaker Pattern
- Handle service failures
- Prevent cascade failures
- Circuit states (Closed, Open, Half-Open)
- Implementation with Opossum

### Lab 5: Retry & Timeout Strategies
- Retry patterns (exponential backoff)
- Timeout configuration
- Idempotency
- Retry budgets

### Lab 6: Service Mesh (Istio)
- Traffic management
- Mutual TLS
- Circuit breaking at infrastructure level
- Canary deployments

## Architecture

```
┌─────────────────────────────────────────────────┐
│         Client / API Gateway                     │
└───────────────┬─────────────────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
    ▼                       ▼
┌─────────┐            ┌─────────┐
│ Service │◄──────────►│ Service │
│    A    │   REST/    │    B    │
│         │   gRPC     │         │
└────┬────┘            └────┬────┘
     │                      │
     │   Circuit Breaker    │
     │   Retry & Timeout    │
     │                      │
     ▼                      ▼
┌─────────────────────────────┐
│    Service Discovery        │
│    (Docker DNS / Consul)    │
└─────────────────────────────┘
```

## Prerequisites

- Docker Desktop installed
- Basic knowledge of Docker Compose
- Understanding of HTTP/REST

## Quick Start

Each lab is in its own folder:

```bash
cd lab-1-rest-communication
docker-compose up --build
```

## Learning Path

1. Start with **Lab 1** (REST Communication)
2. Progress to **Lab 2** (gRPC)
3. Learn **Lab 3** (Service Discovery)
4. Master **Lab 4** (Circuit Breaker)
5. Practice **Lab 5** (Retry & Timeout)
6. Advanced **Lab 6** (Service Mesh)

## What You'll Learn

- ✓ Different communication patterns
- ✓ When to use REST vs gRPC
- ✓ How to handle service failures
- ✓ Building resilient microservices
- ✓ Production-ready patterns

## Tools & Technologies

- **Node.js** - Services
- **Express** - REST API
- **gRPC** - High-performance RPC
- **Opossum** - Circuit breaker
- **Axios** - HTTP client
- **Consul** - Service discovery
- **Istio** - Service mesh (optional)
