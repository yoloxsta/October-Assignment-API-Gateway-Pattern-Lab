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
         ├───── https://frontend.example.com (Frontend Web App)
         │
         └───── https://kong.example.com (API Gateway)
                │
                ▼
┌──────────────────────────┐
│   Cloudflare DNS         │
│   + SSL Certificates     │
└────────┬─────────────────┘
         │ Proxy through Cloudflare
         │
         ▼
┌──────────────────────────┐
│   AWS EC2 Instance       │
│   Ubuntu 22.04 LTS       │
│                          │
│   ┌──────────────────┐   │
│   │  Frontend (Nginx)│   │
│   │  Port 80/3000    │   │
│   └──────────────────┘   │
│                          │
│   ┌──────────────────┐   │
│   │  Kong Gateway    │   │
│   │  Port 8000       │   │
│   │  Port 8443 (SSL) │   │
│   └─────┬────────────┘   │
│         │                │
│   ┌─────┴────────────┐   │
│   │  Docker Network  │   │
│   │  ┌────────────┐  │   │
│   │  │ User Svc   │  │   │
│   │  │ :3001      │  │   │
│   │  └────────────┘  │   │
│   │  ┌────────────┐  │   │
│   │  │ Order Svc  │  │   │
│   │  │ :3002      │  │   │
│   │  └────────────┘  │   │
│   │  ┌────────────┐  │   │
│   │  │ Product Svc│  │   │
│   │  │ :3003      │  │   │
│   │  └────────────┘  │   │
│   └─────────────────┘   │
└──────────────────────────┘
```

## Prerequisites

### 1. AWS EC2 Instance

- **Instance Type**: t3.medium (2 vCPU, 4 GB RAM) or larger
- **OS**: Ubuntu 22.04 LTS
- **Security Group**: Allow ports 22, 80, 443, 3000, 8000, 8001, 8443, 1337
- **Elastic IP**: Recommended for stable IP address

### 2. Domain and DNS

- Domain registered (e.g., `example.com`)
- Cloudflare account configured for the domain
- Subdomains to be used:
  - `frontend.example.com` - Frontend web application
  - `kong.example.com` - API Gateway

### 3. Local Tools

- SSH client
- Git

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

## Step 2: Configure Cloudflare DNS

### 2.1 Add DNS Records

1. Log in to Cloudflare Dashboard
2. Select your domain (`example.com`)
3. Go to **DNS** → **Records**
4. Add two **A Records**:

   **Record 1 - Frontend:**
   ```
   Type: A
   Name: frontend
   IPv4 address: YOUR-EC2-ELASTIC-IP
   Proxy status: Proxied (orange cloud)
   TTL: Auto
   ```

   **Record 2 - Kong API Gateway:**
   ```
   Type: A
   Name: kong
   IPv4 address: YOUR-EC2-ELASTIC-IP
   Proxy status: Proxied (orange cloud)
   TTL: Auto
   ```

5. Save the records

**Result:**
- `frontend.example.com` → Frontend Web Application
- `kong.example.com` → Kong API Gateway

### 2.2 Configure SSL/TLS

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to **Full (Strict)**

This ensures:
- Cloudflare handles HTTPS from client
- Cloudflare connects to EC2 via HTTPS or HTTP (your choice)

---

## Step 3: Choose Deployment Strategy

You have two options:

### Option A: Cloudflare Direct to Kong (Recommended for simplicity)

```
Client → Cloudflare (HTTPS) → Kong:8000
         frontend.example.com
         kong.example.com
```

**No Nginx required**. Cloudflare handles SSL and connects directly to services.

### Option B: Nginx as Reverse Proxy (More control)

```
Client → Cloudflare (HTTPS) → Nginx:80 → Kong:8000 or Frontend
         frontend.example.com → Nginx → /var/www/frontend
         kong.example.com → Nginx → Kong:8000
```

**Benefits:**
- Additional security layer
- Can serve static files
- Better SSL termination control
- Can load balance multiple Kong instances

---

## Step 4: Configure Kong for Production

### 4.1 Create Production docker-compose.yml

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

### 4.3 Configure Frontend for Production

Update `frontend/app.js` to use the Kong API domain:

```javascript
// Update this line in frontend/app.js
const API_URL = 'https://kong.example.com';
```

**Note:** Replace `kong.example.com` with your actual domain.

Create `frontend-nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Main app
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

---

### 4.4 Create Production Setup Script

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

## Step 6: Test Your Deployment

### 6.1 Basic API Tests

```bash
# Test from EC2 instance
curl http://localhost:8000/health
curl http://localhost:8000/products

# Test with API key
curl -H "apikey: my-secret-api-key-123" http://localhost:8000/orders
```

### 6.2 Test Frontend

1. Open browser and go to: `https://frontend.example.com`
2. You should see the frontend application
3. Test all features:
   - ✅ Health check
   - ✅ Login (User Service)
   - ✅ View Products (Product Service)
   - ✅ View Orders with API key (Order Service)
   - ✅ View Product-2 with JWT (Product-2 Service)

### 6.3 Test API Endpoints from Browser

1. Open: `https://kong.example.com/health`
2. You should see user service health response

### 6.4 Complete End-to-End Test

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

### 6.5 Test API Endpoints via curl

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

### 6.6 Access Konga UI

1. Open: `http://your-ec2-ip:1337`
2. Create admin user
3. Add Kong connection:
   - Name: `Kong Production`
   - Kong Admin URL: `http://kong:8001`

---

## Step 7: Production Checklist

### Security

- [ ] Change all default passwords (JWT secret, API keys)
- [ ] Enable Cloudflare SSL (Full Strict mode)
- [ ] Configure firewall to allow only necessary ports
  - Port 80 (HTTP) - Cloudflare IPs only
  - Port 443 (HTTPS) - Cloudflare IPs only
  - Port 3000 (Frontend) - Public access OR restrict to specific IPs
  - Port 8001 (Kong Admin) - Localhost only
  - Port 1337 (Konga) - Your IP only or VPN
  - Port 22 (SSH) - Your IP only
- [ ] Set up EC2 security groups properly
- [ ] Enable Cloudflare bot protection
- [ ] Review and limit CORS origins in Kong plugins
- [ ] Use environment variables for secrets (create .env file)

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

## Step 8: Troubleshooting

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
nslookup testing.example.com
dig testing.example.com

# Check Cloudflare DNS settings
# Ensure A record points to correct IP
```

**5. SSL/HTTPS issues**

- Verify Cloudflare SSL mode is set to "Full (Strict)"
- Check if Cloudflare is proxying (orange cloud enabled)
- Review Cloudflare SSL/TLS settings

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

## Alternative: Serve Frontend via Nginx on Host

If you prefer to serve the frontend via Host Nginx instead of Docker:

### Configure Nginx for Frontend

```bash
# Create frontend directory
sudo mkdir -p /var/www/frontend

# Copy frontend files
sudo cp -r ~/app-architecture-lab/api-gateway-lab/architecture-b-with-gateway/frontend/* /var/www/frontend/

# Update Nginx config
sudo nano /etc/nginx/sites-available/kong
```

**Updated Nginx Config:**

```nginx
# Frontend
server {
    listen 80;
    server_name frontend.example.com;

    root /var/www/frontend;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# API Gateway
server {
    listen 80;
    server_name kong.example.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

Now your application is accessible at:
- Frontend: `https://frontend.example.com`
- API Gateway: `https://kong.example.com`

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
User Browser
     ↓
https://frontend.example.com (Frontend Web App)
     ↓
https://kong.example.com (Kong API Gateway)
     ↓
Docker Network (Microservices)
     ├── User Service (:3001)
     ├── Order Service (:3002)
     ├── Product Service (:3003)
     └── Product-2 Service (:3004)
```

Your application is now production-ready! 🚀
