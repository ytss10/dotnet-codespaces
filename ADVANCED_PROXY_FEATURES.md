# Advanced Proxy System - Enhanced Capabilities

## Overview

The MegaWeb Orchestrator now includes an **enterprise-grade proxy management system** with advanced capabilities to prevent connections from unauthorized service providers and enable custom proxy configurations. This system provides complete control over proxy selection, verification, and security.

---

## 🔒 Key Security Features

### 1. Provider Filtering
- **Whitelist Mode**: Only allow proxies from specific providers
- **Blacklist Mode**: Block proxies from untrusted providers
- **Per-Pool Configuration**: Different rules for different proxy pools
- **Automatic Enforcement**: Filters applied during proxy selection

### 2. Proxy Verification System
- **Automated Verification**: Test proxy connectivity before use
- **Status Tracking**: pending, verified, failed, expired
- **Response Time Monitoring**: Track proxy performance
- **Periodic Re-verification**: Configurable auto-verify intervals
- **Bulk Verification**: Test all proxies in a pool at once

### 3. Connection Isolation
- **Dedicated Connections**: Limit connections per proxy
- **Session Isolation**: Separate sessions for different users
- **Domain Filtering**: Allow/block specific domains per proxy
- **Custom Headers**: Inject custom HTTP headers per proxy

### 4. Reputation System
- **Dynamic Scoring**: 0-100 reputation score based on performance
- **Multi-Factor Calculation**: Success rate, response time, anonymity
- **Automatic Adjustment**: Score updates after each use
- **Reputation-Based Selection**: Choose best-performing proxies

### 5. Anonymity Detection
- **Three Levels**: Transparent, Anonymous, Elite
- **Minimum Requirements**: Set per pool
- **Leak Detection**: Check for IP/DNS leaks (in production)
- **WebRTC Protection**: Prevent browser leaks

---

## 📊 Enhanced Proxy Features

### Database Schema Enhancements

New fields in `proxies` table:
- `provider` - Proxy service provider name
- `is_dedicated` - Dedicated IP flag
- `is_residential` - Residential IP flag
- `anonymity_level` - Transparency level
- `reputation_score` - Performance score (0-100)
- `max_concurrent_connections` - Connection limit
- `current_connections` - Active connections
- `allowed_domains` - Whitelisted domains
- `blocked_domains` - Blacklisted domains
- `custom_headers` - JSON custom headers
- `isolation_enabled` - Isolation flag
- `verification_status` - Verification state
- `last_verification_at` - Last check timestamp
- `response_time_ms` - Average response time
- `bandwidth_limit_mbps` - Bandwidth cap

New fields in `proxy_pools` table:
- `allowed_providers` - JSON array of allowed providers
- `blocked_providers` - JSON array of blocked providers
- `require_verification` - Verification required flag
- `min_reputation_score` - Minimum score threshold
- `require_dedicated` - Dedicated IP requirement
- `require_residential` - Residential IP requirement
- `min_anonymity_level` - Minimum anonymity level
- `enable_connection_isolation` - Enable isolation
- `max_connections_per_proxy` - Per-proxy connection limit
- `auto_verify_interval_hours` - Verification frequency

---

## 🎯 Advanced Rotation Strategies

### 1. Round-Robin (Default)
- Distributes load evenly across all proxies
- Uses least recently used proxy first
- Good for general purpose usage

### 2. Reputation-Based
- Selects highest reputation proxies first
- Considers response time as secondary factor
- Best for quality-critical operations

### 3. Intelligent
- Combines reputation and success rate
- Weighted algorithm: `(reputation * 0.5 + success_rate * 50)`
- Balances quality and reliability

### 4. Burst Mode
- Prioritizes proxies with fewest active connections
- Good for high-throughput scenarios
- Prevents proxy overload

---

## 💻 API Reference

### Verify Single Proxy
```http
POST /api/proxies/{proxy_id}/verify
```

**Response:**
```json
{
  "proxy_id": "uuid",
  "verified": true,
  "response_time_ms": 45
}
```

### Bulk Verify Pool
```http
POST /api/proxy-pools/{pool_id}/verify
```

**Response:**
```json
{
  "total": 100,
  "verified": 95,
  "failed": 5
}
```

### Configure Provider Restrictions
```http
PUT /api/proxy-pools/{pool_id}/providers
Content-Type: application/json

{
  "allowed_providers": ["CustomProvider1", "CustomProvider2"],
  "blocked_providers": ["UntrustedProvider"]
}
```

### Set Security Requirements
```http
PUT /api/proxy-pools/{pool_id}/security
Content-Type: application/json

{
  "require_verification": true,
  "min_reputation_score": 60.0,
  "require_dedicated": false,
  "require_residential": true,
  "min_anonymity_level": "elite",
  "enable_connection_isolation": true
}
```

### Add Proxy with Advanced Config
```http
POST /api/proxies
Content-Type: application/json

{
  "pool_id": "global-pool",
  "host": "proxy.example.com",
  "port": 8080,
  "provider": "CustomProvider",
  "is_dedicated": true,
  "is_residential": false,
  "anonymity_level": "elite",
  "max_concurrent_connections": 20,
  "allowed_domains": ["example.com", "trusted.com"],
  "blocked_domains": ["spam.com"],
  "custom_headers": {
    "X-Custom-Header": "value"
  },
  "isolation_enabled": true,
  "bandwidth_limit_mbps": 100
}
```

### Update Proxy Configuration
```http
PUT /api/proxies/{proxy_id}/config
Content-Type: application/json

{
  "allowed_domains": ["newdomain.com"],
  "isolation_enabled": true,
  "max_concurrent_connections": 50
}
```

### Release Proxy Connection
```http
POST /api/proxies/{proxy_id}/release
```

### Get Provider Statistics
```http
GET /api/proxies/providers
```

**Response:**
```json
{
  "providers": [
    {
      "provider": "CustomProvider1",
      "total_proxies": 50,
      "active_proxies": 48,
      "avg_reputation": 85.5,
      "avg_response_time": 45,
      "total_success": 10000,
      "total_failures": 200,
      "countries_covered": 25
    }
  ],
  "total": 1
}
```

---

## 🔧 PHP Usage Examples

### Initialize Proxy Manager
```php
<?php
require_once 'includes/proxy-manager.php';

$proxyManager = new ProxyPoolManager();
```

### Get Proxy with Provider Filter
```php
// Get proxy from allowed providers only
$proxy = $proxyManager->getNextProxy('secure-pool', 'US');
// Returns proxy matching all pool criteria including provider whitelist
```

### Add Custom Proxy
```php
$proxyId = $proxyManager->addProxy('my-pool', 'proxy.example.com', 8080, [
    'provider' => 'MyCustomProvider',
    'is_dedicated' => true,
    'is_residential' => false,
    'anonymity_level' => 'elite',
    'reputation_score' => 90.0,
    'max_concurrent_connections' => 50,
    'allowed_domains' => ['trusted.com', 'example.com'],
    'custom_headers' => [
        'X-Forwarded-For' => '1.2.3.4',
        'X-Custom-Auth' => 'token123'
    ],
    'isolation_enabled' => true
]);
```

### Configure Pool Security
```php
$proxyManager->setPoolSecurityRequirements('secure-pool', [
    'require_verification' => true,
    'min_reputation_score' => 70.0,
    'require_dedicated' => true,
    'min_anonymity_level' => 'elite',
    'enable_connection_isolation' => true
]);
```

### Block Untrusted Provider
```php
// Block globally
$proxyManager->blockProvider('UntrustedProvider');

// Block in specific pool
$proxyManager->blockProvider('UntrustedProvider', 'my-pool');
```

### Configure Provider Whitelist
```php
$proxyManager->configurePoolProviders('secure-pool', 
    ['TrustedProvider1', 'TrustedProvider2'], // allowed
    ['BadProvider1', 'BadProvider2']          // blocked
);
```

### Verify Proxies
```php
// Verify single proxy
$result = $proxyManager->verifyProxy($proxyId);
echo "Verified: " . ($result['verified'] ? 'Yes' : 'No');
echo "Response time: {$result['response_time_ms']}ms";

// Bulk verify pool
$results = $proxyManager->bulkVerifyProxies('my-pool');
echo "Verified: {$results['verified']} / {$results['total']}";
```

### Update Proxy Reputation
```php
$newScore = $proxyManager->updateProxyReputation($proxyId);
echo "New reputation score: $newScore";
```

### Get Provider Stats
```php
$stats = $proxyManager->getProviderStatistics();
foreach ($stats as $provider) {
    echo "{$provider['provider']}: ";
    echo "{$provider['active_proxies']} active, ";
    echo "avg reputation: {$provider['avg_reputation']}\n";
}
```

### Custom Proxy Configuration
```php
$proxyManager->setProxyCustomConfig($proxyId, [
    'allowed_domains' => ['example.com', 'trusted.com'],
    'blocked_domains' => ['spam.com', 'malicious.com'],
    'custom_headers' => [
        'User-Agent' => 'CustomBot/1.0',
        'X-API-Key' => 'secret123'
    ],
    'isolation_enabled' => true,
    'max_concurrent_connections' => 100,
    'bandwidth_limit_mbps' => 500
]);
```

### Release Connection
```php
// After using proxy, release the connection
$proxyManager->releaseProxy($proxyId);
```

---

## 🎨 Use Cases

### 1. Prevent Third-Party Provider Connections
```php
// Only use your own proxies
$proxyManager->configurePoolProviders('my-pool', ['MyOwnProxies'], []);

// Block all external providers
$proxyManager->setPoolSecurityRequirements('my-pool', [
    'require_dedicated' => true,
    'require_verification' => true,
    'min_reputation_score' => 90.0
]);
```

### 2. High-Security Operations
```php
// Elite anonymity, verified, high reputation
$proxyManager->setPoolSecurityRequirements('secure-pool', [
    'require_verification' => true,
    'min_reputation_score' => 85.0,
    'min_anonymity_level' => 'elite',
    'require_residential' => true,
    'enable_connection_isolation' => true
]);
```

### 3. Domain-Specific Proxies
```php
// Proxy only for specific websites
$proxyManager->addProxy('specialized-pool', 'proxy.example.com', 8080, [
    'allowed_domains' => ['target-site.com'],
    'blocked_domains' => ['*'], // Block all others
    'isolation_enabled' => true
]);
```

### 4. Provider Performance Monitoring
```php
// Track provider performance
$stats = $proxyManager->getProviderStatistics();

// Block underperforming providers
foreach ($stats as $provider) {
    if ($provider['avg_reputation'] < 50) {
        $proxyManager->blockProvider($provider['provider']);
    }
}
```

### 5. Custom Provider Network
```php
// Build your own proxy network
$myProxies = [
    ['host' => 'proxy1.mydomain.com', 'port' => 8080, 'country' => 'US'],
    ['host' => 'proxy2.mydomain.com', 'port' => 8080, 'country' => 'GB'],
    ['host' => 'proxy3.mydomain.com', 'port' => 8080, 'country' => 'DE'],
];

foreach ($myProxies as $proxy) {
    $proxyManager->addProxy('my-network', $proxy['host'], $proxy['port'], [
        'provider' => 'MyOwnNetwork',
        'country' => $proxy['country'],
        'is_dedicated' => true,
        'anonymity_level' => 'elite',
        'isolation_enabled' => true
    ]);
}

// Only use your network
$proxyManager->configurePoolProviders('my-network', ['MyOwnNetwork'], []);
```

---

## 🔐 Security Best Practices

1. **Always Verify Proxies**: Enable `require_verification` in production
2. **Set Reputation Thresholds**: Use `min_reputation_score` ≥ 60
3. **Use Elite Proxies**: Set `min_anonymity_level` to 'elite' for sensitive operations
4. **Enable Isolation**: Turn on `enable_connection_isolation` for multi-tenant usage
5. **Whitelist Providers**: Use `allowed_providers` instead of `blocked_providers`
6. **Monitor Performance**: Regularly check provider statistics
7. **Update Reputations**: Call `updateProxyReputation()` after each use
8. **Limit Connections**: Set appropriate `max_concurrent_connections`
9. **Verify Periodically**: Use `auto_verify_interval_hours` for automatic checks
10. **Domain Filtering**: Use `allowed_domains` for strict control

---

## 📈 Performance Tips

1. **Use Reputation-Based Strategy**: Best quality proxies automatically selected
2. **Batch Verification**: Verify all proxies in pool at once with `bulkVerifyProxies()`
3. **Connection Pooling**: Reuse connections, release when done
4. **Provider Caching**: Store provider stats to avoid repeated queries
5. **Smart Rotation**: Use 'intelligent' strategy for balanced performance
6. **Monitor Response Times**: Track `response_time_ms` for optimization
7. **Auto-Deactivation**: Low reputation proxies automatically disabled
8. **Failover Pools**: Configure `failover_pool_ids` for high availability

---

## 🎯 Migration from Basic to Advanced

### Before (Basic):
```php
$proxy = $proxyManager->getNextProxy('global-pool');
```

### After (Advanced):
```php
// Configure security requirements
$proxyManager->setPoolSecurityRequirements('global-pool', [
    'require_verification' => true,
    'min_reputation_score' => 70.0,
    'min_anonymity_level' => 'anonymous'
]);

// Configure provider restrictions
$proxyManager->configurePoolProviders('global-pool', 
    ['TrustedProvider'], 
    ['UntrustedProvider']
);

// Get proxy with all filters applied
$proxy = $proxyManager->getNextProxy('global-pool');
```

---

## 🆘 Troubleshooting

### No Proxies Available
- Check provider filters aren't too restrictive
- Verify proxies meet reputation requirements
- Ensure proxies are verified if required
- Check connection limits aren't maxed out

### Poor Performance
- Lower `min_reputation_score` temporarily
- Use 'burst' strategy for high load
- Increase `max_concurrent_connections`
- Verify proxies aren't rate-limited

### Verification Failures
- Check proxy credentials are correct
- Ensure proxy is reachable
- Verify firewall rules
- Check proxy service is running

---

This advanced proxy system provides complete control over proxy usage, prevents unauthorized provider connections, and enables building your own custom proxy network with enterprise-grade features!
