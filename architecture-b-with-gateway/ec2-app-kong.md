# Deploy API Gateway Lab on EC2 with Cloudflare DNS

## Overview

This guide shows how to deploy the API Gateway lab on an AWS EC2 instance with custom domains managed by Cloudflare:

- **Frontend**: `frontend.example.com`
- **API Gateway**: `kong.example.com`

## Architecture

```
┌──────────────────┐
│     Client       │
│    (Browser)     │
└────────┬─────────┘
         │
         ├─────────────────────────────────┐
         │                                 │
         ▼                                 ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│  https://frontend.      │    │  https://kong.          │
│  example.com            │    │  example.com            │
│  (Frontend Web App)     │    │  (API Gateway)          │
└────────┬────────────────┘    └────────┬────────────────┘
         │                              │
         │                              │
         └──────────┬───────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│         Cloudflare DNS + SSL                 │
│  • DDoS Protection                           │
│  • WAF (Web Application Firewall)            │
│  • SSL/TLS Termination                       │
│  • Caching & CDN                             │
└────────┬─────────────────────────────────────┘
         │
         │ Proxy (HTTP)
         │
         ▼
┌──────────────────────────────────────────────┐
│          AWS EC2 Instance                    │
│          Ubuntu 22.04 LTS                    │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │        Docker Network                   │ │
│  │                                         │ │
│  │  ┌──────────────────┐  ┌─────────────┐ │ │
│  │  │  Frontend        │  │ Kong Gateway│ │ │
│  │  │  (Nginx)         │  │  Port 8000  │ │ │
│  │  │  Port 80         │  └──────┬──────┘ │ │
│  │  └──────────────────┘         │        │ │
│  │                               │        │ │
│  │         ┌─────────────────────┤        │ │
│  │         │                     │        │ │
│  │         ▼                     ▼        │ │
│  │  ┌────────────┐      ┌─────────────┐  │ │
│  │  │ PostgreSQL │      │  Micro-     │  │ │
│  │  │ (Kong DB)  │      │  services   │  │ │
│  │  │ Port 5432  │      │             │  │ │
│  │  └────────────┘      │ • User:3001 │  │ │
│  │                      │ • Order:3002│  │ │
│  │                      │ • Prod:3003 │  │ │
│  │                      │ • Prod2:3004│  │ │
│  │                      └─────────────┘  │ │
│  │                                        │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Konga UI (Port 1337)                  │ │
│  │  Kong Admin API (Port 8001)            │ │
│  └────────────────────────────────────────┘ │
│                                              │
└──────────────────────────────────────────────┘

Data Flow:
==========
1. User opens frontend.example.com
2. Frontend loads from Nginx container
3. Frontend makes API calls to kong.example.com
4. Kong routes to appropriate microservice
5. Microservice responds through Kong back to frontend

Security Flow:
==============
1. Cloudflare handles HTTPS (SSL/TLS)
2. Cloudflare DDoS & WAF protection
3. Kong handles authentication (API Key, JWT)
4. Kong handles rate limiting (100 req/min)
5. Services are isolated in Docker network
```

## Prerequisites

### 1. AWS EC2 Instance

- **Instance Type**: t3.medium (2 vCPU, 4 GB RAM) or larger
- **OS**: Ubuntu 22.04 LTS
- **Security Group**: Allow ports 22, 80, 443, 3000, 8000, 8001, 8443, 1337
- **Elastic IP**: Recommended for stable IP address

### 2. Domain and DNS

- Domain registered (e.g., `example.com`)
- AWS Route 53 hosted zone configured
- Subdomains to be used:
  - `frontend.example.com` - Frontend web application
  - `kong.example.com` - API Gateway

### 3. Local Tools

- SSH client
- Git
- AWS CLI (optional, for Route 53 management)

---

## Step 1: Prepare EC2 Instance

### 1.1 SSH into EC2

```bash
ssh -i /path/to/your-key.pem ubuntu@your-ec2-public-ip
```

### 1.2 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Install Docker and Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 1.4 Clone Project

```bash
# Clone your project repository
cd ~
git clone <your-repo-url> app-architecture-lab
cd app-architecture-lab/api-gateway-lab/architecture-b-with-gateway
```

---

## Step 2: Configure Route 53 DNS

### 2.1 Create Hosted Zone (if not exists)

1. Log in to AWS Console
2. Go to **Route 53** → **Hosted zones**
3. Click **Create hosted zone**
4. Enter domain name: `example.com`
5. Type: **Public hosted zone**
6. Click **Create**

### 2.2 Add DNS Records

In your hosted zone, add two **A Records**:

**Record 1 - Frontend:**
```
Record name: frontend
Record type: A
Value: YOUR-EC2-ELASTIC-IP
TTL: 300
```

**Record 2 - Kong API Gateway:**
```
Record name: kong
Record type: A
Value: YOUR-EC2-ELASTIC-IP
TTL: 300
```

### 2.3 Update Domain Nameservers (if needed)

If your domain is not registered with AWS:

1. Copy the 4 nameservers from Route 53 hosted zone
2. Go to your domain registrar (GoDaddy, Namecheap, etc.)
3. Update nameservers to point to AWS Route 53

**Wait 24-48 hours for DNS propagation**

### 2.4 Verify DNS Resolution

```bash
# Test DNS resolution
nslookup frontend.example.com
nslookup kong.example.com

# Or use dig
dig frontend.example.com
dig kong.example.com
```

---

## Step 3: Choose Deployment Strategy

You have two options for SSL/TLS:

### Option A: Let's Encrypt on Host Nginx (Recommended)

```
Client → Route 53 → Nginx (Host:80/443) → Kong:8000 or Frontend
```

**Benefits:**
- Free SSL certificates
- Automatic renewal via Certbot
- Full control over Nginx configuration

### Option B: AWS Certificate Manager (ACM) + ALB

```
Client → Route 53 → ALB (HTTPS) → EC2 (HTTP)
```

**Benefits:**
- Managed SSL certificates
- Load balancing capabilities
- Health checks

**Note:** This guide uses **Option A (Let's Encrypt)** for simplicity and cost-effectiveness.

---

## Step 4: Install and Configure Nginx with SSL

### 4.1 Install Nginx and Certbot

```bash
# Install Nginx
sudo apt update
sudo apt install nginx -y

# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Enable Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 4.2 Configure Nginx for Domains

Create frontend directory:

```bash
# Create frontend directory
sudo mkdir -p /var/www/frontend

# Copy frontend files from project
sudo cp -r ~/app-architecture-lab/api-gateway-lab/architecture-b-with-gateway/frontend/* /var/www/frontend/

# Set permissions
sudo chown -R www-data:www-data /var/www/frontend
sudo chmod -R 755 /var/www/frontend
```

Create configuration for frontend:

```bash
sudo nano /etc/nginx/sites-available/frontend.example.com
```

Add:

```nginx
server {
    listen 80;
    server_name frontend.example.com;

    root /var/www/frontend;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Create configuration for Kong:

```bash
sudo nano /etc/nginx/sites-available/kong.example.com
```

Add:

```nginx
server {
    listen 80;
    server_name kong.example.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Enable sites:

```bash
sudo ln -s /etc/nginx/sites-available/frontend.example.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/kong.example.com /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 4.3 Obtain SSL Certificates

```bash
# Get certificate for frontend
sudo certbot --nginx -d frontend.example.com

# Get certificate for Kong
sudo certbot --nginx -d kong.example.com

# Test auto-renewal
sudo certbot renew --dry-run
```

Certbot will automatically:
- Obtain Let's Encrypt certificates
- Configure Nginx for HTTPS
- Set up auto-renewal (via systemd timer)

### 4.4 Verify HTTPS

```bash
# Test frontend
curl -I https://frontend.example.com

# Test Kong
curl -I https://kong.example.com/health
```

You should see `HTTP/2 200` response.

---

## Step 5: Configure Kong for Production

### 5.1 Create Production docker-compose.yml

Create a file `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  kong-database:
    image: postgres:13
    container_name: kong-database
    environment:
      POSTGRES_USER: kong
      POSTGRES_DB: kong
      POSTGRES_PASSWORD: kong_pass
    volumes:
      - kong-data:/var/lib/postgresql/data
    networks:
      - kong-network
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "kong"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always

  kong-migration:
    image: kong:3.4
    container_name: kong-migration
    depends_on:
      kong-database:
        condition: service_healthy
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-database
      KONG_PG_USER: kong
      KONG_PG_PASSWORD: kong_pass
      KONG_PG_DATABASE: kong
    command: kong migrations bootstrap
    networks:
      - kong-network
    restart: on-failure

  kong:
    image: kong:3.4
    container_name: kong
    depends_on:
      kong-migration:
        condition: service_completed_successfully
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-database
      KONG_PG_USER: kong
      KONG_PG_PASSWORD: kong_pass
      KONG_PG_DATABASE: kong
      KONG_PROXY_LISTEN: 0.0.0.0:8000, 0.0.0.0:8443 ssl
      KONG_ADMIN_LISTEN: 0.0.0.0:8001
      KONG_PLUGINS: bundled,jwt
    ports:
      - "8000:8000"   # HTTP proxy
      - "8443:8443"   # HTTPS proxy
      - "8001:8001"   # Admin API
    networks:
      - kong-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/status"]
      interval: 10s
      timeout: 10s
      retries: 10
    restart: always

  user-service:
    build: ./services/user-service
    container_name: user-service
    environment:
      - PORT=3001
      - NODE_ENV=production
      - JWT_SECRET=your-super-secret-jwt-key-change-in-production
    networks:
      - kong-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: always

  order-service:
    build: ./services/order-service
    container_name: order-service
    environment:
      - PORT=3002
      - NODE_ENV=production
    networks:
      - kong-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: always

  product-service:
    build: ./services/product-service
    container_name: product-service
    environment:
      - PORT=3003
      - NODE_ENV=production
    networks:
      - kong-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: always

  product-2-service:
    build: ./services/product-2-service
    container_name: product-2-service
    environment:
      - PORT=3004
      - NODE_ENV=production
    networks:
      - kong-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3004/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: always

  frontend:
    image: nginx:alpine
    container_name: frontend
    ports:
      - "3000:80"
    volumes:
      - ./frontend:/usr/share/nginx/html:ro
      - ./frontend-nginx.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - kong-network
    restart: always

  konga:
    image: pantsel/konga:latest
    container_name: konga
    environment:
      NODE_ENV: production
      DB_ADAPTER: sqlite
    volumes:
      - konga-data:/app/kongadata
    ports:
      - "1337:1337"
    networks:
      - kong-network
    restart: always

networks:
  kong-network:
    driver: bridge

volumes:
  kong-data:
  konga-data:
```

### 4.2 (Optional) Add Host Nginx if using Option B

**Why Host Nginx is Better for Production:**

- ✅ Better performance (no Docker overhead)
- ✅ Direct SSL certificate management with Certbot
- ✅ Can serve multiple applications
- ✅ Easier log access

**Install Nginx on Host:**

```bash
# Install Nginx on EC2 host
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/kong
```

**Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name testing.example.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    location / {
        limit_req zone=api_limit burst=20 nodelay;

        # Proxy to Kong (running in Docker)
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Disable caching for API
        proxy_buffering off;
    }

    # Health check endpoint
    location /nginx-health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

**Enable Nginx Site:**

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/kong /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable auto-start on boot
sudo systemctl enable nginx
```

**SSL Configuration (if NOT using Cloudflare SSL):**

```bash
# Get SSL certificate from Let's Encrypt
sudo certbot --nginx -d testing.example.com

# Auto-renewal test
sudo certbot renew --dry-run
```

**Note:** If using Cloudflare SSL (recommended), you only need HTTP (port 80) on your server. Cloudflare will handle HTTPS.

**View Nginx Logs:**

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

---

---

## Step 6: Deploy on EC2

### 6.1 Deploy Services

```bash
cd ~/app-architecture-lab/api-gateway-lab/architecture-b-with-gateway

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 6.2 Run Kong Setup

```bash
# Make script executable
chmod +x setup-kong-prod.sh

# Run setup
./setup-kong-prod.sh
```

Create a file `setup-kong-prod.sh`:

```bash
#!/bin/bash

KONG_ADMIN_URL="http://localhost:8001"

echo "=== Setting up Kong for Production ==="

# Wait for Kong to be ready
echo "Waiting for Kong to be ready..."
until curl -s "$KONG_ADMIN_URL/status" > /dev/null; do
  sleep 2
done
echo "Kong is ready!"

# Services
echo "Creating services..."

# User Service
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d "name=user-service" \
  -d "url=http://user-service:3001"

# Order Service
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d "name=order-service" \
  -d "url=http://order-service:3002"

# Product Service
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d "name=product-service" \
  -d "url=http://product-service:3003"

# Product 2 Service
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d "name=product-2-service" \
  -d "url=http://product-2-service:3004"

echo "✓ Services created"

# Routes
echo "Creating routes..."

# User Service Routes
curl -s -X POST "$KONG_ADMIN_URL/services/user-service/routes" \
  -d "name=user-health" \
  -d "paths[]=/health" \
  -d "methods[]=GET" \
  -d "strip_path=false"

curl -s -X POST "$KONG_ADMIN_URL/services/user-service/routes" \
  -d "name=user-login" \
  -d "paths[]=/login" \
  -d "methods[]=POST,OPTIONS" \
  -d "strip_path=false"

curl -s -X POST "$KONG_ADMIN_URL/services/user-service/routes" \
  -d "name=user-profile" \
  -d "paths[]=/users" \
  -d "strip_path=false"

# Order Service Routes
curl -s -X POST "$KONG_ADMIN_URL/services/order-service/routes" \
  -d "name=order-list" \
  -d "paths[]=/orders" \
  -d "methods[]=GET,POST,OPTIONS" \
  -d "strip_path=false"

curl -s -X POST "$KONG_ADMIN_URL/services/order-service/routes" \
  -d "name=order-detail" \
  -d "paths[]=/orders/[0-9]+" \
  -d "strip_path=false"

# Product Service Routes
curl -s -X POST "$KONG_ADMIN_URL/services/product-service/routes" \
  -d "name=product-list" \
  -d "paths[]=/products" \
  -d "methods[]=GET,POST" \
  -d "strip_path=false"

curl -s -X POST "$KONG_ADMIN_URL/services/product-service/routes" \
  -d "name=product-detail" \
  -d "paths[]=/products/[0-9]+" \
  -d "strip_path=false"

# Product 2 Service Routes
curl -s -X POST "$KONG_ADMIN_URL/services/product-2-service/routes" \
  -d "name=product-2-list" \
  -d "paths[]=/product-2" \
  -d "methods[]=GET" \
  -d "strip_path=false"

echo "✓ Routes created"

# Global Plugins
echo "Adding global plugins..."

# CORS Plugin (Global)
curl -s -X POST "$KONG_ADMIN_URL/plugins" \
  -d "name=cors" \
  -d "config.origins[*]=https://frontend.example.com" \
  -d "config.methods[]=GET" \
  -d "config.methods[]=POST" \
  -d "config.methods[]=PUT" \
  -d "config.methods[]=DELETE" \
  -d "config.methods[]=OPTIONS" \
  -d "config.headers[]=Accept" \
  -d "config.headers[]=Accept-Version" \
  -d "config.headers[]=Content-Length" \
  -d "config.headers[]=Content-MD5" \
  -d "config.headers[]=Content-Type" \
  -d "config.headers[]=Date" \
  -d "config.headers[]=X-Auth-Token" \
  -d "config.headers[]=Authorization" \
  -d "config.headers[]=apikey" \
  -d "config.exposed_headers[]=X-Auth-Token" \
  -d "config.credentials=true" \
  -d "config.max_age=3600"

# Rate Limiting Plugin (Global)
curl -s -X POST "$KONG_ADMIN_URL/plugins" \
  -d "name=rate-limiting" \
  -d "config.minute=100" \
  -d "config.policy=local"

# Request Size Limiting
curl -s -X POST "$KONG_ADMIN_URL/plugins" \
  -d "name=request-size-limiting" \
  -d "config.allowed_payload_size=10"

echo "✓ Global plugins added"

# Key Auth for Order Service
echo "Adding authentication to order service..."

curl -s -X POST "$KONG_ADMIN_URL/services/order-service/plugins" \
  -d "name=key-auth"

# Create consumer
curl -s -X POST "$KONG_ADMIN_URL/consumers" \
  -d "username=api-user"

# Create API key
curl -s -X POST "$KONG_ADMIN_URL/consumers/api-user/key-auth" \
  -d "key=my-secret-api-key-123"

echo "✓ Authentication configured"

# JWT Auth for Product 2 Service
echo "Adding JWT authentication to product-2 service..."

curl -s -X POST "$KONG_ADMIN_URL/services/product-2-service/plugins" \
  -d "name=jwt"

curl -s -X POST "$KONG_ADMIN_URL/consumers" \
  -d "username=jwt-user"

curl -s -X POST "$KONG_ADMIN_URL/consumers/jwt-user/jwt" \
  -d "key=my-jwt-issuer" \
  -d "secret=your-super-secret-jwt-key-change-in-production" \
  -d "algorithm=HS256"

echo "✓ JWT authentication configured"

echo ""
echo "=== Kong Setup Complete ==="
echo ""
echo "Frontend URL: https://frontend.example.com"
echo "API Gateway URL: https://kong.example.com"
echo "Kong Admin API: http://localhost:8001"
echo "Konga UI: http://localhost:1337"
echo ""
echo "API Key for orders: my-secret-api-key-123"
echo ""
echo "Test endpoints:"
echo "  curl https://kong.example.com/health"
echo "  curl https://kong.example.com/products"
echo "  curl -H 'apikey: my-secret-api-key-123' https://kong.example.com/orders"
echo ""
echo "Open frontend in browser:"
echo "  https://frontend.example.com"
echo ""

---

## Step 5: Deploy on EC2

### 5.1 Deploy Services

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 5.2 Run Kong Setup

```bash
# Make script executable
chmod +x setup-kong-prod.sh

# Run setup
./setup-kong-prod.sh
```

---

## Step 7: Test Your Deployment

### 7.1 Basic API Tests

```bash
# Test from EC2 instance
curl http://localhost:8000/health
curl http://localhost:8000/products

# Test with API key
curl -H "apikey: my-secret-api-key-123" http://localhost:8000/orders
```

### 7.2 Test HTTPS Endpoints

```bash
# Test frontend
curl -I https://frontend.example.com

# Test Kong API
curl https://kong.example.com/health
curl https://kong.example.com/products

# Test with API key
curl -H "apikey: my-secret-api-key-123" https://kong.example.com/orders
```

### 7.3 Test Frontend

1. Open browser and go to: `https://frontend.example.com`
2. You should see the frontend application
3. Test all features:
   - ✅ Health check
   - ✅ Login (User Service)
   - ✅ View Products (Product Service)
   - ✅ View Orders with API key (Order Service)
   - ✅ View Product-2 with JWT (Product-2 Service)

### 7.4 Complete End-to-End Test

**Test User Flow:**

1. **Open Frontend**
   ```
   URL: https://frontend.example.com
   ```

2. **Test Health Check**
   - Click "Health Check" button
   - Should show: `{"status":"healthy","service":"user-service"}`

3. **Test Login**
   - Enter email: `alice@example.com`
   - Click "Login" button
   - Should receive JWT token

4. **Test Products**
   - Click "Get Products" button
   - Should show product list

5. **Test Orders (requires API key)**
   - Enter API key: `my-secret-api-key-123`
   - Click "Get Orders" button
   - Should show orders list

6. **Test Product-2 (requires JWT)**
   - Use JWT token from login
   - Click "Get Product-2" button
   - Should show product-2 data

### 7.5 Test API Endpoints via curl

```bash
# From your local machine
curl https://kong.example.com/products

# With API key
curl -H "apikey: my-secret-api-key-123" https://kong.example.com/orders

# Login
curl -X POST https://kong.example.com/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com"}'
```

### 7.6 Access Konga UI

1. Open: `http://your-ec2-ip:1337`
2. Create admin user
3. Add Kong connection:
   - Name: `Kong Production`
   - Kong Admin URL: `http://kong:8001`

---

## Step 8: Production Checklist

### Security

- [ ] Change all default passwords (JWT secret, API keys)
- [ ] SSL certificates installed and auto-renewing
- [ ] Configure firewall to allow only necessary ports
  - Port 80 (HTTP) - For Certbot challenges
  - Port 443 (HTTPS) - Public access
  - Port 22 (SSH) - Your IP only
  - Port 8001 (Kong Admin) - Localhost only
  - Port 1337 (Konga) - Your IP only or VPN
- [ ] Set up EC2 security groups properly
- [ ] Review and limit CORS origins in Kong plugins
- [ ] Use environment variables for secrets (create .env file)
- [ ] Configure UFW firewall on EC2
  ```bash
  sudo ufw allow 22
  sudo ufw allow 80
  sudo ufw allow 443
  sudo ufw enable
  ```

### Monitoring

- [ ] Set up Kong logs (consider ELK or CloudWatch)
- [ ] Monitor EC2 CPU and memory usage
- [ ] Set up alerts for service health
- [ ] Configure Cloudflare analytics

### Backup

- [ ] Set up automated backups for Kong database
- [ ] Document restore procedures
- [ ] Keep Docker images in private registry

### Maintenance

- [ ] Schedule regular security updates
- [ ] Document deployment process
- [ ] Set up staging environment
- [ ] Create runbooks for common issues

---

## Step 9: Troubleshooting

### Common Issues

**1. Services not accessible**

```bash
# Check if services are running
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs kong
docker-compose -f docker-compose.prod.yml logs user-service
```

**2. Kong not responding**

```bash
# Check Kong status
curl http://localhost:8001/status

# Restart Kong
docker-compose -f docker-compose.prod.yml restart kong
```

**3. Database connection issues**

```bash
# Check PostgreSQL
docker-compose -f docker-compose.prod.yml logs kong-database

# Test connection
docker exec -it kong-database psql -U kong -d kong -c "SELECT 1;"
```

**4. DNS not resolving**

```bash
# Test DNS resolution
nslookup frontend.example.com
nslookup kong.example.com

# Check Route 53 records
# Ensure A records point to correct EC2 IP
# Wait for DNS propagation (up to 48 hours)
```

**5. SSL certificate errors**

```bash
# Check certificate status
sudo certbot certificates

# Renew certificates manually
sudo certbot renew

# Check Nginx configuration
sudo nginx -t

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

**6. CORS errors**

```bash
# Check CORS plugin configuration
curl http://localhost:8001/plugins

# Update CORS if needed
curl -X PATCH http://localhost:8001/plugins/{plugin-id} \
  -d "config.origins[*]=https://frontend.example.com"
```

### Useful Commands

```bash
# View all Kong services
curl http://localhost:8001/services

# View all routes
curl http://localhost:8001/routes

# View all plugins
curl http://localhost:8001/plugins

# Reset Kong configuration
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
./setup-kong-prod.sh

# View container resource usage
docker stats
```

---

## Security Recommendations

### 1. Use Secrets Management

Never hardcode secrets in docker-compose.yml:

```yaml
environment:
  - JWT_SECRET=${JWT_SECRET}
```

Create `.env` file:

```bash
JWT_SECRET=your-very-long-random-secret-here
```

### 2. Restrict Admin Access

Kong Admin API (port 8001) should not be publicly accessible:

```bash
# Option 1: SSH tunnel
ssh -i your-key.pem -L 8001:localhost:8001 ubuntu@your-ec2-ip

# Option 2: Only bind to localhost
# In docker-compose.prod.yml, change:
ports:
  - "127.0.0.1:8001:8001"
```

### 3. Enable Cloudflare Security Features

- **Bot Fight Mode**: Block malicious bots
- **Browser Integrity Check**: Block suspicious browsers
- **Security Level**: Set to "Medium" or "High"
- **Challenge Page**: Show CAPTCHA for suspicious traffic

### 4. Regular Updates

```bash
# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Update system packages
sudo apt update && sudo apt upgrade -y

# Renew SSL certificates (automatic, but can test)
sudo certbot renew --dry-run
```

---

## Cost Estimation (AWS)

### Monthly Costs (Approximate)

| Resource | Specification | Cost (USD/month) |
|----------|--------------|------------------|
| EC2 t3.medium | 2 vCPU, 4 GB RAM | $30-40 |
| EBS Volume | 20 GB gp3 | $1-2 |
| Elastic IP | 1 IP | $0-4 |
| Data Transfer | 100 GB | $8-10 |
| **Total** | | **$40-60/month** |

### Cost Optimization Tips

1. Use Reserved Instances (save up to 40%)
2. Use Spot Instances for non-critical workloads
3. Right-size your instance based on actual usage
4. Use Cloudflare caching to reduce bandwidth
5. Set up AWS Budgets for cost alerts

---

## Summary

You now have:

✅ API Gateway (Kong) running on EC2  
✅ Custom domain with Cloudflare DNS  
✅ SSL/TLS via Cloudflare  
✅ Multiple microservices behind the gateway  
✅ Authentication (API Key + JWT)  
✅ Rate limiting and CORS  
✅ Konga UI for gateway management  

**Optional:** Nginx reverse proxy for additional security layer (included in guide).

Your API is accessible at: `https://testing.example.com`

---

## Frontend Integration Checklist

- [ ] Update `API_URL` in `frontend/app.js` to `https://kong.example.com`
- [ ] Test all API endpoints from frontend
- [ ] Verify CORS is configured in Kong for `https://frontend.example.com`
- [ ] Test login and JWT authentication
- [ ] Test API key authentication for orders
- [ ] Verify all buttons work correctly
- [ ] Check browser console for errors
- [ ] Test on mobile devices

---

## Quick Reference: All URLs

| Service | URL | Port | Authentication |
|---------|-----|------|----------------|
| Frontend | https://frontend.example.com | 80/443 | None |
| API Gateway | https://kong.example.com | 80/443 | Various |
| Health Check | https://kong.example.com/health | 80/443 | None |
| Login | https://kong.example.com/login | 80/443 | None |
| Products | https://kong.example.com/products | 80/443 | None |
| Orders | https://kong.example.com/orders | 80/443 | API Key |
| Product-2 | https://kong.example.com/product-2 | 80/443 | JWT |
| Kong Admin | http://localhost:8001 | 8001 | Localhost only |
| Konga UI | http://your-ec2-ip:1337 | 1337 | Basic Auth |

---

## Summary

You now have a complete end-to-end application:

✅ **Frontend** - Web application on port 3000  
✅ **API Gateway** - Kong on port 80/443  
✅ **Microservices** - User, Order, Product, Product-2  
✅ **Authentication** - API Key + JWT  
✅ **Security** - Cloudflare SSL, rate limiting, CORS  
✅ **Monitoring** - Konga UI for gateway management  

**Architecture Flow:**

```
┌──────────────────────────────────────────────────────┐
│                   USER FLOW                          │
└──────────────────────────────────────────────────────┘

1. User Opens Browser
   └─> https://frontend.example.com

2. Frontend Loads (Nginx Container)
   └─> HTML/CSS/JS served from Docker

3. Frontend Makes API Call
   └─> fetch('https://kong.example.com/products')

4. Request Goes Through Cloudflare
   └─> SSL termination
   └─> DDoS protection
   └─> WAF rules

5. Kong Gateway Receives Request
   └─> Rate limiting check
   └─> Authentication check (if required)
   └─> Route to microservice

6. Microservice Processes Request
   └─> User Service (:3001)
   └─> Order Service (:3002)
   └─> Product Service (:3003)
   └─> Product-2 Service (:3004)

7. Response Returns Same Path
   └─> Microservice → Kong → Cloudflare → Frontend → User


┌──────────────────────────────────────────────────────┐
│              SECURITY LAYERS                         │
└──────────────────────────────────────────────────────┘

Layer 1: Cloudflare (Edge)
   • HTTPS/SSL
   • DDoS protection
   • WAF rules
   • Geo-blocking (optional)

Layer 2: Kong Gateway (Application)
   • Rate limiting (100 req/min)
   • API Key authentication
   • JWT validation
   • CORS policies

Layer 3: Docker Network (Infrastructure)
   • Services not exposed to internet
   • Internal network isolation
   • Only Kong port 8000 exposed
```

Your application is now production-ready! 🚀
