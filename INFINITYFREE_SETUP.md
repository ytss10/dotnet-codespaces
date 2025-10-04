# InfinityFree Hosting Setup Guide

## 🚀 Quick Setup for InfinityFree

### Step 1: Upload Files
1. Upload the **entire project** to your InfinityFree `htdocs` folder
2. Or upload only the `php` directory if you want a cleaner setup

### Step 2: Database Configuration
InfinityFree provides free MySQL databases:

1. Go to your InfinityFree control panel
2. Create a new MySQL database
3. Note down:
   - Database Host (usually `sql###.infinityfree.com`)
   - Database Name (e.g., `if0_#######_dbname`)
   - Database Username (e.g., `if0_#######`)
   - Database Password

### Step 3: Run Installation
1. Visit: `https://yourdomain.infinityfreeapp.com/install`
2. Enter your database details
3. Click "Install Now"
4. Wait for completion

### Step 4: Access Your Panel
- Control Panel: `https://yourdomain.infinityfreeapp.com/control-panel`
- Admin Panel: `https://yourdomain.infinityfreeapp.com/admin`
- API: `https://yourdomain.infinityfreeapp.com/api/health`

---

## 🔧 InfinityFree Limitations & Solutions

### 1. No `ini_set()` Allowed
**Solution**: Code automatically wraps all `ini_set()` calls in try-catch blocks
```php
try {
    @ini_set('memory_limit', '512M');
} catch (Exception $e) {
    // Continue without it
}
```

### 2. Limited Memory (256MB)
**Solution**: Reduced batch operations
- MAX_BULK_OPERATIONS reduced to 512
- Pagination implemented for large queries
- Memory-efficient streaming for real-time data

### 3. Limited Execution Time (30s)
**Solution**: 
- Background job processing
- Chunked operations
- Progress tracking
- Auto-resume on timeout

### 4. No Shell Commands
**Solution**: Pure PHP implementation
- No `exec()`, `shell_exec()`, or `system()` calls
- cURL used for HTTP requests
- Native PHP functions only

### 5. No Cron Jobs
**Solution**: 
- Web-based task scheduler
- Client-side polling
- Manual trigger endpoints

### 6. File Upload Limit
**Solution**:
- Chunked file uploads
- Base64 encoding for small files
- External storage integration ready

---

## 📁 Optimal File Structure for InfinityFree

```
htdocs/
├── .htaccess              # Root routing
├── php/
│   ├── .htaccess          # PHP-specific routing
│   ├── api/               # API endpoints
│   ├── config/            # Configuration
│   ├── includes/          # Core classes
│   ├── public/            # Web pages
│   ├── install.php        # Installer
│   └── install-process.php
```

---

## 🔒 Security Best Practices

### 1. Secure Configuration
```php
// In config/config.php
define('APP_DEBUG', false);  // Always FALSE in production
define('DB_HOST', 'sql###.infinityfree.com');
define('DB_NAME', 'if0_#######_dbname');
```

### 2. Protect Sensitive Files
Already configured in `.htaccess`:
- Blocks access to `.env`, `.sql`, `.log` files
- Prevents directory listing
- Hides database and config folders

### 3. Use Environment Variables
```php
// Optionally create config/env.php
<?php
putenv('DB_HOST=sql###.infinityfree.com');
putenv('DB_NAME=if0_#######_dbname');
putenv('DB_USER=if0_#######');
putenv('DB_PASS=your_password');
```

---

## ⚡ Performance Optimization

### 1. Enable Caching
InfinityFree supports OpCache:
```php
// Already enabled in config.php
define('CACHE_ENABLED', true);
define('CACHE_TTL', 300); // 5 minutes
```

### 2. Database Optimization
```sql
-- Run these queries in phpMyAdmin
OPTIMIZE TABLE sessions;
OPTIMIZE TABLE custom_proxy_servers;
OPTIMIZE TABLE dynamic_ip_pool;
```

### 3. Reduce Database Queries
- Connection pooling enabled
- Query result caching implemented
- Persistent connections used

---

## 🐛 Common Issues & Fixes

### Issue 1: "Database connection failed"
**Solution**: 
- Verify database credentials
- Check if database exists in InfinityFree control panel
- Ensure IP is not blacklisted

### Issue 2: "500 Internal Server Error"
**Solution**:
- Check error logs in InfinityFree control panel
- Verify .htaccess syntax
- Ensure PHP version is 7.4+

### Issue 3: "API endpoints not found"
**Solution**:
- Check `.htaccess` is uploaded to root
- Verify mod_rewrite is working
- Test: `https://yourdomain.com/api/health`

### Issue 4: "Slow performance"
**Solution**:
- Enable caching in config
- Reduce MAX_BULK_OPERATIONS
- Use pagination for large datasets
- Consider upgrading to premium InfinityFree

---

## 📊 Testing Your Installation

### 1. Health Check
```bash
curl https://yourdomain.infinityfreeapp.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "healthy",
  "proxy_servers": 0,
  "available_ips": 0
}
```

### 2. Create Test Session
```bash
curl -X POST https://yourdomain.infinityfreeapp.com/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "status": "steady"}'
```

### 3. List Sessions
```bash
curl https://yourdomain.infinityfreeapp.com/api/sessions
```

---

## 🆙 Upgrading from Free to Premium

When ready to scale beyond InfinityFree limitations:

1. **Shared Hosting** (Namecheap, Hostinger, etc.)
   - More memory (512MB - 1GB)
   - Longer execution time (60s+)
   - Better performance

2. **VPS Hosting** (DigitalOcean, Linode, Vultr)
   - Full control
   - No restrictions
   - Can handle 100k+ sessions

3. **Cloud Hosting** (AWS, Google Cloud, Azure)
   - Auto-scaling
   - Global distribution
   - True 1M+ capacity

---

## 📞 Support

- Documentation: See `DEPLOYMENT_GUIDE.md`
- Issues: Check `PROJECT_STATUS.md`
- Updates: See `PHP_MIGRATION_COMPLETE.md`

---

## ✅ Checklist

- [ ] Files uploaded to InfinityFree
- [ ] Database created in control panel
- [ ] Installation wizard completed
- [ ] Health check returns "healthy"
- [ ] Control panel accessible
- [ ] API endpoints responding
- [ ] Test session created successfully

**You're ready to orchestrate millions of sessions! 🎉**
