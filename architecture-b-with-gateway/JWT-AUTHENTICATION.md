# JWT Authentication with Kong Gateway

## Overview

This document explains how JWT (JSON Web Token) authentication works with Kong API Gateway in Architecture B.

## What is JWT?

JWT (JSON Web Token) is a compact, URL-safe means of representing claims between two parties. It's **signed** (not encrypted) using a secret key.

### JWT Structure

```
HEADER.PAYLOAD.SIGNATURE
```

**Example Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhbGljZUBleGFtcGxlLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5MTQyNzMwMSwiZXhwIjoxNzkxNDMwOTAxLCJpc3MiOiJ1c2VyLXNlcnZpY2UifQ.iVbkRjHeHPoWMxzIe8uUpJpFZPiBu9KOpLYLVu-9lTE
```

### Decoded JWT

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload (Data):**
```json
{
  "id": 1,
  "email": "alice@example.com",
  "role": "admin",
  "iat": 1791427301,
  "exp": 1791430901,
  "iss": "user-service"
}
```

**Signature:**
```
iVbkRjHeHPoWMxzIe8uUpJpFZPiBu9KOpLYLVu-9lTE
```

## How JWT Authentication Works

### Architecture Flow

```
User Service          Kong Gateway          Product-2 Service
     ↓                     ↓                       ↓
Generate JWT          Verify JWT              Serve Request
with secret A         with secret A           (no auth code!)
     ↓                     ↓                       ↓
  Token              If match → Forward      Return Data
                     If not → Reject
```

### Step-by-Step Process

#### Step 1: User Login - Generate JWT Token

**Client Request:**
```bash
curl -X POST http://localhost:8000/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com"}'
```

**User Service Code (server.js):**
```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'shared-secret-key';

app.post('/login', (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role }, // Payload
    JWT_SECRET, // Secret key for signing
    { 
      expiresIn: '1h', // Token expires in 1 hour
      issuer: 'user-service' // Issuer identifier
    }
  );
  
  res.json({
    user: { id: user.id, name: user.name, email: user.email },
    token: token,
    service: 'user-service'
  });
});
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "service": "user-service"
}
```

#### Step 2: Kong JWT Plugin Configuration

**In Konga UI:**

1. Navigate to **SERVICES** → `product-2-service`
2. Go to **PLUGINS** tab → **ADD PLUGIN**
3. Select **JWT** plugin
4. Configure:
   - **Service**: product-2-service
   - **maximum expiration**: `3600` (1 hour in seconds)

#### Step 3: Kong Consumer JWT Credential

**In Konga UI:**

1. Navigate to **CONSUMERS** → `api-user`
2. Go to **Credentials** tab → **JWT**
3. Click **+ ADD JWT**
4. Configure:
   - **Key**: `user-service` (must match `iss` claim in token)
   - **Secret**: `shared-secret-key` (must match user service secret)

**Credential JSON:**
```json
{
  "algorithm": "HS256",
  "key": "user-service",
  "secret": "shared-secret-key"
}
```

#### Step 4: Client Request with JWT Token

**Client Request:**
```bash
curl http://localhost:8000/products-2 \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

#### Step 5: Kong Gateway Verification Process

**Kong JWT Plugin Steps:**

1. **Extract Token** from `Authorization: Bearer <token>` header

2. **Decode Payload** to read claims:
   ```json
   {
     "iss": "user-service",
     "exp": 1791430901,
     ...
   }
   ```

3. **Find Credential** by `iss` (issuer) claim:
   - Kong looks up credential where `key` = `"user-service"`
   - Found credential has `secret` = `"shared-secret-key"`

4. **Verify Signature**:
   ```
   Calculated = HMACSHA256(
     base64(header) + "." + base64(payload),
     "shared-secret-key"
   )
   
   Compare with token signature:
   - Calculated: iVbkRjHeHPoWMxzIe8uUpJpFZPiBu9KOpLYLVu-9lTE
   - From token: iVbkRjHeHPoWMxzIe8uUpJpFZPiBu9KOpLYLVu-9lTE
   ```

5. **Verify Claims**:
   - Check `exp` (expiration) - token not expired
   - Check `iss` (issuer) - matches credential key

6. **Decision**:
   - ✅ **Valid** → Forward request to product-2-service
   - ❌ **Invalid** → Return error response

#### Step 6: Service Response

**If Valid Token:**
```json
{
  "products": [
    {
      "id": 1,
      "name": "Wireless Mouse",
      "price": 29.99,
      "category": "Accessories",
      "stock": 150
    },
    ...
  ],
  "service": "product-2-service"
}
```

**If Invalid Token:**
```json
{
  "message": "Unauthorized"
}
```

## Why Secrets Must Match

### Secret Key Role

The secret key is used to:
1. **Sign** the token (user service)
2. **Verify** the token signature (Kong gateway)

### Signature Creation (User Service)

```javascript
signature = HMACSHA256(
  base64(header) + "." + base64(payload),
  "shared-secret-key" // Secret A
)
```

### Signature Verification (Kong)

```javascript
calculatedSignature = HMACSHA256(
  base64(header) + "." + base64(payload),
  "shared-secret-key" // Secret B (must match Secret A)
)

if (calculatedSignature === tokenSignature) {
  // Token is valid
} else {
  // Invalid signature
}
```

### If Secrets Don't Match

**Scenario:**
- User service signs with: `secret-A`
- Kong verifies with: `secret-B`

**Result:**
```
Calculated signature (with secret-B) ≠ Token signature (with secret-A)
→ "Invalid signature" error
```

## Configuration Requirements

### User Service Configuration

**package.json:**
```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2"
  }
}
```

**server.js:**
```javascript
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'shared-secret-key';

// Must match Kong consumer credential secret
```

### Kong Configuration

**JWT Plugin:**
```json
{
  "name": "jwt",
  "service": { "id": "product-2-service-id" },
  "config": {
    "maximum_expiration": 3600
  }
}
```

**Consumer Credential:**
```json
{
  "key": "user-service", // Matches token "iss" claim
  "secret": "shared-secret-key", // Matches user service secret
  "algorithm": "HS256"
}
```

## Common Errors

### Error 1: "No JWT token found in request"

**Cause:** Authorization header missing or incorrect format

**Solution:**
```bash
# Correct format
curl -H 'Authorization: Bearer <token>' ...

# Incorrect format
curl -H 'Authorization: <token>' ...  # Missing "Bearer"
```

### Error 2: "Invalid signature"

**Cause:** Secret key mismatch

**Solution:**
1. Check user service `JWT_SECRET` value
2. Check Kong credential `secret` value
3. Ensure both values are identical

### Error 3: "exceeds maximum allowed expiration"

**Cause:** Token expiration time too long

**Solution:**
Update JWT plugin `maximum_expiration` config:
- Set to `3600` for 1 hour
- Set to `0` for unlimited

### Error 4: "Bad token; invalid JSON"

**Cause:** Token format incorrect

**Solution:**
Ensure token is valid JWT format (three base64 strings separated by dots)

## Testing JWT Authentication

### Test 1: Without Token (Should Fail)

```bash
curl http://localhost:8000/products-2
# Response: {"message":"Unauthorized"}
```

### Test 2: With Valid Token (Should Succeed)

```bash
# Login to get token
TOKEN=$(curl -s -X POST http://localhost:8000/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com"}' | jq -r '.token')

# Use token to access protected resource
curl http://localhost:8000/products-2 \
  -H "Authorization: Bearer $TOKEN"
# Response: {"products":[...], "service":"product-2-service"}
```

### Test 3: With Invalid Token (Should Fail)

```bash
curl http://localhost:8000/products-2 \
  -H 'Authorization: Bearer invalid-token'
# Response: {"message":"Bad token; invalid JSON"}
```

## Security Best Practices

### 1. Secret Key Management

**Don't hardcode secrets:**
```javascript
// ❌ Bad
const JWT_SECRET = 'shared-secret-key';

// ✅ Good
const JWT_SECRET = process.env.JWT_SECRET;
```

**Use environment variables:**
```bash
export JWT_SECRET='your-very-secure-secret-key-here'
```

### 2. Token Expiration

**Set reasonable expiration times:**
```javascript
jwt.sign(payload, secret, {
  expiresIn: '15m' // 15 minutes for sensitive operations
});
```

### 3. HTTPS Only

JWT tokens can be intercepted. Always use HTTPS in production.

### 4. Token Storage

**Frontend:**
```javascript
// ✅ Good - Store in memory
let token = null;

// ❌ Bad - Store in localStorage (vulnerable to XSS)
localStorage.setItem('token', token);

// ✅ Best - Use HttpOnly cookies (server-side)
```

### 5. Token Revocation

JWT tokens cannot be revoked easily. Consider:
- Short expiration times
- Token blacklist in Redis
- Refresh token rotation

## Comparison: API Key vs JWT

| Feature | API Key | JWT |
|---------|---------|-----|
| Complexity | Simple | Moderate |
| Revocation | Easy (delete key) | Hard (need blacklist) |
| Self-contained | No | Yes (contains user data) |
| Expiration | Manual | Built-in |
| Scalability | Good | Excellent (stateless) |
| Use case | Service-to-service | User authentication |

## Architecture Benefits

### Centralized Authentication

**Without Gateway (Architecture A):**
```
Each service implements:
- JWT verification
- Secret key management
- Token validation
- Error handling

Code duplication: High
Maintenance: Hard
Security: Inconsistent
```

**With Gateway (Architecture B):**
```
Kong Gateway handles:
- JWT verification
- Secret key management
- Token validation
- Error handling

Services:
- No auth code
- Focus on business logic
- Consistent security

Code duplication: None
Maintenance: Easy (Konga UI)
Security: Consistent
```

### Service Independence

Product-2 service code:
```javascript
// No authentication code needed!
app.get('/products-2', (req, res) => {
  res.json({
    products: products,
    service: 'product-2-service'
  });
});
```

Kong handles all authentication. Service just serves the request.

## Summary

JWT authentication with Kong Gateway provides:

1. **Centralized security** - One place to manage authentication
2. **Service simplicity** - Services don't need auth code
3. **Consistent policies** - Same rules for all services
4. **Easy management** - Konga UI for configuration
5. **Scalability** - Stateless authentication

**Key Configuration Points:**

1. User service secret must match Kong credential secret
2. Token `iss` claim must match Kong credential `key`
3. Token expiration must not exceed plugin's `maximum_expiration`
4. All services must use the same secret for token verification

**Testing Checklist:**

- [ ] Login endpoint returns valid JWT token
- [ ] Token payload contains correct claims (`iss`, `exp`, user data)
- [ ] Protected endpoint rejects requests without token
- [ ] Protected endpoint accepts requests with valid token
- [ ] Invalid tokens are properly rejected with error message
