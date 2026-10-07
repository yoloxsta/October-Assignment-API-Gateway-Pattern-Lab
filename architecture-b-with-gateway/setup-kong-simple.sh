#!/bin/bash

# Kong Gateway Configuration Script
# No jq dependency - just curl

set -e

KONG_ADMIN_URL="http://localhost:8001"

echo "Waiting for Kong to be ready..."
until curl -s "$KONG_ADMIN_URL/status" > /dev/null 2>&1; do
  sleep 2
done
echo "Kong is ready!"
echo ""

echo "=== Adding Services ==="

# User Service
echo "Adding user-service..."
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d "name=user-service" \
  -d "url=http://user-service:3001" > /dev/null && echo "  OK" || echo "  Already exists"

# Order Service
echo "Adding order-service..."
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d "name=order-service" \
  -d "url=http://order-service:3002" > /dev/null && echo "  OK" || echo "  Already exists"

# Product Service
echo "Adding product-service..."
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d "name=product-service" \
  -d "url=http://product-service:3003" > /dev/null && echo "  OK" || echo "  Already exists"

echo ""
echo "=== Adding Routes ==="

# User Service Routes
echo "Adding routes for user-service..."
curl -s -X POST "$KONG_ADMIN_URL/services/user-service/routes" \
  -d "name=user-health" \
  -d "paths[]=/health" \
  -d "methods[]=GET" \
  -d "strip_path=false" > /dev/null 2>&1 && echo "  OK: /health" || echo "  SKIP: /health"

curl -s -X POST "$KONG_ADMIN_URL/services/user-service/routes" \
  -d "name=user-login" \
  -d "paths[]=/login" \
  -d "methods[]=POST" \
  -d "methods[]=OPTIONS" \
  -d "strip_path=false" > /dev/null 2>&1 && echo "  OK: /login" || echo "  SKIP: /login"

curl -s -X POST "$KONG_ADMIN_URL/services/user-service/routes" \
  -d "name=user-list" \
  -d "paths[]=/users" \
  -d "methods[]=GET" \
  -d "methods[]=OPTIONS" \
  -d "strip_path=false" > /dev/null 2>&1 && echo "  OK: /users" || echo "  SKIP: /users"

# Order Service Routes
echo "Adding routes for order-service..."
curl -s -X POST "$KONG_ADMIN_URL/services/order-service/routes" \
  -d "name=order-health" \
  -d "paths[]=/orders/health" \
  -d "methods[]=GET" \
  -d "strip_path=false" > /dev/null 2>&1 && echo "  OK: /orders/health" || echo "  SKIP: /orders/health"

curl -s -X POST "$KONG_ADMIN_URL/services/order-service/routes" \
  -d "name=order-list" \
  -d "paths[]=/orders" \
  -d "methods[]=GET" \
  -d "methods[]=OPTIONS" \
  -d "strip_path=false" > /dev/null 2>&1 && echo "  OK: /orders" || echo "  SKIP: /orders"

curl -s -X POST "$KONG_ADMIN_URL/services/order-service/routes" \
  -d "name=order-create" \
  -d "paths[]=/orders" \
  -d "methods[]=POST" \
  -d "methods[]=OPTIONS" \
  -d "strip_path=false" > /dev/null 2>&1 && echo "  OK: POST /orders" || echo "  SKIP: POST /orders"

# Product Service Routes
echo "Adding routes for product-service..."
curl -s -X POST "$KONG_ADMIN_URL/services/product-service/routes" \
  -d "name=product-list" \
  -d "paths[]=/products" \
  -d "methods[]=GET" \
  -d "strip_path=false" > /dev/null 2>&1 && echo "  OK: /products" || echo "  SKIP: /products"

curl -s -X POST "$KONG_ADMIN_URL/services/product-service/routes" \
  -d "name=product-detail" \
  -d "paths[]=/products/(?<id>[0-9]+)" \
  -d "methods[]=GET" \
  -d "strip_path=false" > /dev/null 2>&1 && echo "  OK: /products/:id" || echo "  SKIP: /products/:id"

echo ""
echo "=== Adding CORS Plugin ==="

curl -s -X POST "$KONG_ADMIN_URL/plugins" \
  -d "name=cors" \
  -d "config.origins[]=*" \
  -d "config.methods[]=GET" \
  -d "config.methods[]=POST" \
  -d "config.methods[]=PUT" \
  -d "config.methods[]=PATCH" \
  -d "config.methods[]=DELETE" \
  -d "config.methods[]=OPTIONS" \
  -d "config.headers[]=Content-Type" \
  -d "config.headers[]=Authorization" \
  -d "config.headers[]=apikey" \
  -d "config.exposed_headers[]=*" \
  -d "config.credentials=true" > /dev/null 2>&1 && echo "  OK" || echo "  Already exists"

# Global Rate Limiting
echo "Adding global rate limiting (100 req/min)..."
curl -s -X POST "$KONG_ADMIN_URL/plugins" \
  -d "name=rate-limiting" \
  -d "config.minute=100" \
  -d "config.policy=local" > /dev/null 2>&1 && echo "  OK" || echo "  Already exists"

# Key Auth for Order Service
echo "Adding key authentication for order-service..."
curl -s -X POST "$KONG_ADMIN_URL/services/order-service/plugins" \
  -d "name=key-auth" > /dev/null 2>&1 && echo "  OK" || echo "  Already exists"

# Create Consumer
echo "Creating API consumer..."
curl -s -X POST "$KONG_ADMIN_URL/consumers" \
  -d "username=api-user" > /dev/null 2>&1 && echo "  OK" || echo "  Already exists"

# Create API Key
echo "Creating API key..."
curl -s -X POST "$KONG_ADMIN_URL/consumers/api-user/key-auth" \
  -d "key=my-secret-api-key-123" > /dev/null 2>&1 && echo "  OK" || echo "  Already exists"

echo ""
echo "========================================="
echo "  Kong Configuration Complete!"
echo "========================================="
echo ""
echo "Gateway URL:  http://localhost:8000"
echo "Admin API:    http://localhost:8001"
echo ""
echo "Test Commands:"
echo "  curl http://localhost:8000/health"
echo "  curl http://localhost:8000/products"
echo "  curl -X POST http://localhost:8000/login -H 'Content-Type: application/json' -d '{\"email\":\"alice@example.com\"}'"
echo "  curl -H 'apikey: my-secret-api-key-123' http://localhost:8000/orders"
echo ""
