# Kong Gateway Configuration Script for PowerShell
# This script configures Kong with services, routes, and plugins

$KONG_ADMIN_URL = "http://localhost:8001"

Write-Host "Waiting for Kong to be ready..." -ForegroundColor Yellow

$ready = $false
$retries = 0
while (-not $ready -and $retries -lt 60) {
    try {
        $response = Invoke-WebRequest -Uri "$KONG_ADMIN_URL/status" -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        Start-Sleep -Seconds 2
        $retries++
        Write-Host "Waiting... ($retries/60)"
    }
}

if (-not $ready) {
    Write-Host "Kong did not become ready in time" -ForegroundColor Red
    exit 1
}

Write-Host "Kong is ready!" -ForegroundColor Green
Write-Host ""

# Function to make POST requests to Kong
function Add-KongResource {
    param(
        [string]$Endpoint,
        [hashtable]$Data
    )
    
    $bodyParts = @()
    foreach ($key in $Data.Keys) {
        $bodyParts += "$key=$($Data[$key])"
    }
    $body = $bodyParts -join "&"
    
    try {
        $response = Invoke-WebRequest -Uri "$KONG_ADMIN_URL$Endpoint" `
            -Method POST `
            -Body $body `
            -ContentType "application/x-www-form-urlencoded" `
            -ErrorAction Stop
        
        $json = $response.Content | ConvertFrom-Json
        Write-Host "  OK: $($json.name)" -ForegroundColor Green
        return $json
    } catch {
        $errorMsg = $_.Exception.Message
        if ($errorMsg -match "already exists") {
            Write-Host "  SKIP: Resource already exists" -ForegroundColor Yellow
        } else {
            Write-Host "  ERROR: $errorMsg" -ForegroundColor Red
        }
        return $null
    }
}

Write-Host "=== Adding Services ===" -ForegroundColor Cyan

Add-KongResource -Endpoint "/services" -Data @{
    name = "user-service"
    url = "http://user-service:3001"
}

Add-KongResource -Endpoint "/services" -Data @{
    name = "order-service"
    url = "http://order-service:3002"
}

Add-KongResource -Endpoint "/services" -Data @{
    name = "product-service"
    url = "http://product-service:3003"
}

Write-Host ""
Write-Host "=== Adding Routes ===" -ForegroundColor Cyan

# User Service Routes
Write-Host "User service routes:" -ForegroundColor Gray
Add-KongResource -Endpoint "/services/user-service/routes" -Data @{
    name = "user-health"
    "paths[]" = "/health"
    "methods[]" = "GET"
}

Add-KongResource -Endpoint "/services/user-service/routes" -Data @{
    name = "user-login"
    "paths[]" = "/login"
    "methods[]" = "POST"
}

Add-KongResource -Endpoint "/services/user-service/routes" -Data @{
    name = "user-list"
    "paths[]" = "/users"
    "methods[]" = "GET"
}

Add-KongResource -Endpoint "/services/user-service/routes" -Data @{
    name = "user-detail"
    "paths[]" = "/users/(?<id>\d+)"
    "methods[]" = "GET"
}

# Order Service Routes
Write-Host "Order service routes:" -ForegroundColor Gray
Add-KongResource -Endpoint "/services/order-service/routes" -Data @{
    name = "order-health"
    "paths[]" = "/orders/health"
    "methods[]" = "GET"
}

Add-KongResource -Endpoint "/services/order-service/routes" -Data @{
    name = "order-list"
    "paths[]" = "/orders"
    "methods[]" = "GET"
}

Add-KongResource -Endpoint "/services/order-service/routes" -Data @{
    name = "order-create"
    "paths[]" = "/orders"
    "methods[]" = "POST"
}

Add-KongResource -Endpoint "/services/order-service/routes" -Data @{
    name = "order-detail"
    "paths[]" = "/orders/(?<id>\d+)"
    "methods[]" = "GET"
}

# Product Service Routes
Write-Host "Product service routes:" -ForegroundColor Gray
Add-KongResource -Endpoint "/services/product-service/routes" -Data @{
    name = "product-list"
    "paths[]" = "/products"
    "methods[]" = "GET"
}

Add-KongResource -Endpoint "/services/product-service/routes" -Data @{
    name = "product-create"
    "paths[]" = "/products"
    "methods[]" = "POST"
}

Add-KongResource -Endpoint "/services/product-service/routes" -Data @{
    name = "product-detail"
    "paths[]" = "/products/(?<id>\d+)"
    "methods[]" = "GET"
}

Write-Host ""
Write-Host "=== Adding Rate Limiting Plugin ===" -ForegroundColor Cyan

Add-KongResource -Endpoint "/plugins" -Data @{
    name = "rate-limiting"
    "config.minute" = "100"
    "config.policy" = "local"
}

Write-Host ""
Write-Host "=== Adding Key Authentication ===" -ForegroundColor Cyan

# Add key-auth to order-service
Add-KongResource -Endpoint "/services/order-service/plugins" -Data @{
    name = "key-auth"
}

# Create a consumer
Write-Host "Creating API consumer..."
Add-KongResource -Endpoint "/consumers" -Data @{
    username = "api-user"
}

# Create API key for consumer
Write-Host "Creating API key..."
try {
    $body = "key=my-secret-api-key-123"
    $response = Invoke-WebRequest -Uri "$KONG_ADMIN_URL/consumers/api-user/key-auth" `
        -Method POST `
        -Body $body `
        -ContentType "application/x-www-form-urlencoded" `
        -ErrorAction Stop
    Write-Host "  OK: API Key created: my-secret-api-key-123" -ForegroundColor Green
} catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -match "already exists") {
        Write-Host "  SKIP: API key already exists" -ForegroundColor Yellow
    } else {
        Write-Host "  ERROR: $errorMsg" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Kong Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Gateway:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "Admin:    http://localhost:8001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test Commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host '  # Health check'
Write-Host '  Invoke-WebRequest -Uri "http://localhost:8000/health"' -ForegroundColor Gray
Write-Host ""
Write-Host '  # Get products (public)'
Write-Host '  Invoke-WebRequest -Uri "http://localhost:8000/products"' -ForegroundColor Gray
Write-Host ""
Write-Host '  # Login'
Write-Host '  $body = @{email="alice@example.com"} | ConvertTo-Json' -ForegroundColor Gray
Write-Host '  Invoke-WebRequest -Uri "http://localhost:8000/login" -Method POST -Body $body -ContentType "application/json"' -ForegroundColor Gray
Write-Host ""
Write-Host '  # Get orders (requires API key)'
Write-Host '  $headers = @{"apikey"="my-secret-api-key-123"}' -ForegroundColor Gray
Write-Host '  Invoke-WebRequest -Uri "http://localhost:8000/orders" -Headers $headers' -ForegroundColor Gray
Write-Host ""
