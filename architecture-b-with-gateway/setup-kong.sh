#!/bin/bash

# Kong Gateway Configuration Script
# This script configures Kong with services, routes, and plugins

set -e

KONG_ADMIN_URL="http://localhost:8001"

echo "Waiting for Kong to be ready..."
until curl -s "$KONG_ADMIN_URL/status" > /dev/null; do
  sleep 2
done
echo "Kong is ready!"

echo ""
echo "=== Adding Services ==="

# User Service
echo "Adding user-service..."
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d "name=user-service" \
  -d "url=http://user-service:3001" | jq .

# Order Service
echo "Adding order-service..."
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d "name=order-service" \
  -d "url=http://order-service:3002" | jq .

# Product Service
echo "Adding product-service..."
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d "name=product-service" \
  -d "url=http://product-service:3003" | jq .

echo ""
echo "=== Adding Routes ==="

# User Service Routes
echo "Adding routes for user-service..."
curl -s -X POST "$KONG_ADMIN_URL/services/user-service/routes" \
  -d "name=user-health" \
  -d "paths[]=/health" \
  -d "methods[]=GET" | jq .

curl -s -X POST "$KONG_ADMIN_URL/services/user-service/routes" \
  -d "name=user-login" \
  -d "paths[]=/login" \
  -d "methods[]=POST" | jq .

curl -s -X POST "$KONG_ADMIN_URL/services/user-service/routes" \
  -d "name=user-list" \
  -d "paths[]=/users" \
  -d "methods[]=GET" | jq .

curl -s -X POST "$KONG_ADMIN_URL/services/user-service/routes" \
  -d "name=user-detail" \
  -d "paths[]=/users/[0-9]+" \
  -d "methods[]=GET" | jq .

# Order Service Routes
echo "Adding routes for order-service..."
curl -s -X POST "$KONG_ADMIN_URL/services/order-service/routes" \
  -d "name=order-health" \
  -d "paths[]=/orders/health" \
  -d "methods[]=GET" | jq .

curl -s -X POST "$KONG_ADMIN_URL/services/order-service/routes" \
  -d "name=order-list" \
  -d "paths[]=/orders" \
  -d "methods[]=GET" \
  -d "methods[]=POST" | jq .

curl -s -X POST "$KONG_ADMIN_URL/services/order-service/routes" \
  -d "name=order-detail" \
  -d "paths[]=/orders/[0-9]+" \
  -d "methods[]=GET" | jq .

# Product Service Routes
echo "Adding routes for product-service..."
curl -s -X POST "$KONG_ADMIN_URL/services/product-service/routes" \
  -d "name=product-list" \
  -d "paths[]=/products" \
  -d "methods[]=GET" \
  -d "methods[]=POST" | jq .

curl -s -X POST "$KONG_ADMIN_URL/services/product-service/routes" \
  -d "name=product-detail" \
  -d "paths[]=/products/[0-9]+" \
  -d "methods[]=GET" \
  -d "methods[]=PATCH" | jq .

echo ""
echo "=== Adding Rate Limiting Plugin ==="

# Global rate limiting (all services)
echo "Adding global rate limiting..."
curl -s -X POST "$KONG_ADMIN_URL/plugins" \
  -d "name=rate-limiting" \
  -d "config.minute=100" \
  -d "config.policy=local" | jq .

echo ""
echo "=== Adding Key Authentication Plugin (for protected routes) ==="

# Add key-auth plugin to order-service routes (requires API key)
curl -s -X POST "$KONG_ADMIN_URL/services/order-service/plugins" \
  -d "name=key-auth" | jq .

# Create a consumer
curl -s -X POST "$KONG_ADMIN_URL/consumers" \
  -d "username=api-user" | jq .

# Create API key for consumer
curl -s -X POST "$KONG_ADMIN_URL/consumers/api-user/key-auth" \
  -d "key=my-secret-api-key-123" | jq .

echo ""
echo "=== Kong Configuration Complete ==="
echo ""
echo "Gateway is ready at: http://localhost:8000"
echo "Admin API at: http://localhost:8001"
echo ""
echo "Test commands:"
echo "  curl http://localhost:8000/health"
echo "  curl http://localhost:8000/products"
echo "  curl -X POST http://localhost:8000/login -H 'Content-Type: application/json' -d '{\"email\":\"alice@example.com\"}'"
echo "  curl http://localhost:8000/orders -H 'apikey: my-secret-api-key-123'"
