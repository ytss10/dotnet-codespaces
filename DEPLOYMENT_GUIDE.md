# 🚀 Deployment Guide - MegaWeb Orchestrator (Pure PHP)

## 📋 Pre-Deployment Checklist

- [x] TypeScript/JavaScript removed
- [x] Pure PHP codebase ready
- [x] Database schemas prepared
- [x] Advanced features implemented
- [x] Real-time streaming configured
- [x] API endpoints complete

---

## 🎯 Quick Deployment (3 Steps)

### **Step 1: Upload Files**
Upload the entire `/php` directory to your web server:
```
your-hosting/public_html/
├── api/
├── config/
├── includes/
├── public/
├── install.php
└── install-process.php
```

### **Step 2: Run Installer**
Visit: `https://your-domain.com/install.php`

Fill in:
- Database host (usually `localhost`)
- Database name
- Database username
- Database password
- Admin credentials (optional)

Click "Install Now" and wait for completion.

### **Step 3: Access Control Panel**
Visit: `https://your-domain.com/public/control-panel.php`

**🎉 You're live with 1M session capability!**

---

## 📁 File Structure After Deployment

```
public_html/
├── api/
│   ├── index.php           # RESTful API router
│   └── stream.php          # SSE real-time endpoint
├── config/
│   └── config.php          # Configuration (edit this)
├── includes/
│   ├── database.php        # Database manager
│   ├── orchestrator.php    # Core engine
│   ├── proxy-pool-manager.php      # Proxy system
│   ├── hypergrid-synthesizer.php   # Visualization
│   ├── realtime-multiplexer.php    # Real-time updates
│   └── [other includes]
├── public/
│   ├── control-panel.php   # ⭐ Main control panel (NEW)
│   ├── index.php           # Classic interface
│   ├── admin.php           # Admin panel
│   └── automation-panel.php
├── .htaccess               # URL rewriting
├── install.php             # Installer
└── install-process.php     # Install handler
```

---

## ⚙️ Configuration

### **Basic Configuration** (`config/config.php`)
```php
<?php
// Database Configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_username');
define('DB_PASS', 'your_password');
define('DB_CHARSET', 'utf8mb4');

// Application Settings
define('APP_NAME', 'MegaWeb Orchestrator');
define('APP_DEBUG', false); // Set to false in production
define('APP_TIMEZONE', 'UTC');

// CORS Settings
define('CORS_ALLOWED_ORIGINS', '*'); // Restrict in production
define('CORS_ALLOWED_METHODS', 'GET, POST, PUT, DELETE, OPTIONS');
define('CORS_ALLOWED_HEADERS', 'Content-Type, Authorization');

// Performance Settings
define('MAX_BULK_OPERATIONS', 10000);
define('DEFAULT_PROXY_POOL', 'global-pool');
define('SESSION_TIMEOUT', 3600);

// JSON Options
define('JSON_OPTIONS', JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
```

### **Advanced Configuration**
```php
// Enable/Disable Features
define('ENABLE_HYPERGRID', true);
define('ENABLE_REAL_TIME_UPDATES', true);
define('ENABLE_PROXY_ROTATION', true);
define('ENABLE_EVENT_SOURCING', true);

// Performance Tuning
define('HYPERGRID_CACHE_TTL', 300); // 5 minutes
define('METRICS_UPDATE_INTERVAL', 2); // 2 seconds
define('SSE_HEARTBEAT_INTERVAL', 30); // 30 seconds

// Proxy Settings
define('PROXY_HEALTH_CHECK_INTERVAL', 30000); // 30 seconds
define('PROXY_ROTATION_INTERVAL', 60000); // 60 seconds
define('MAX_PROXY_CONCURRENT', 100000);
```

---

## 🌐 URL Structure

After deployment, your URLs will be:

### **Public Interfaces**
- `https://your-domain.com/public/control-panel.php` - Main control panel ⭐
- `https://your-domain.com/public/index.php` - Classic interface
- `https://your-domain.com/public/admin.php` - Admin panel
- `https://your-domain.com/public/automation-panel.php` - Automation

### **API Endpoints**
- `https://your-domain.com/api/sessions` - Session management
- `https://your-domain.com/api/stream` - Real-time updates (SSE)
- `https://your-domain.com/api/hypergrid` - Hypergrid data
- `https://your-domain.com/api/metrics/global` - Global metrics
- `https://your-domain.com/api/embed/bulk` - Bulk operations
- `https://your-domain.com/api/embed/scale-million` - Scale to 1M

---

## 🔧 Server Requirements

### **Minimum Requirements**
- **PHP**: 7.4 or higher
- **MySQL**: 5.7 or higher
- **Web Server**: Apache 2.4+ or Nginx 1.18+
- **Memory**: 512MB PHP memory limit
- **Storage**: 1GB minimum

### **Recommended Requirements**
- **PHP**: 8.0 or higher
- **MySQL**: 8.0 or higher
- **Memory**: 2GB+ PHP memory limit
- **Storage**: 5GB+ for large datasets
- **CPU**: 2+ cores

### **Required PHP Extensions**
- `pdo_mysql` - Database connectivity
- `json` - JSON encoding/decoding
- `mbstring` - Multi-byte string support
- `openssl` - Encryption support
- `curl` - HTTP requests

---

## 📊 Database Setup

### **Option 1: Automatic (via Installer)**
1. Visit `install.php`
2. Enter database credentials
3. Installer creates all tables automatically

### **Option 2: Manual**
```bash
# Import core schema
mysql -u username -p database_name < database/schema.sql

# Import advanced features
mysql -u username -p database_name < database/schema-advanced.sql
```

### **Database Size Planning**
- **1,000 sessions**: ~5MB
- **10,000 sessions**: ~50MB
- **100,000 sessions**: ~500MB
- **1,000,000 sessions**: ~5GB

---

## 🔐 Security Hardening

### **1. After Installation**
```bash
# Delete installer files
rm install.php
rm install-process.php
```

### **2. Restrict API Access**
Edit `config/config.php`:
```php
// Restrict CORS
define('CORS_ALLOWED_ORIGINS', 'https://your-domain.com');

// Add API key authentication
define('API_KEY_ENABLED', true);
define('API_KEY', 'your-secret-key-here');
```

### **3. Secure Config File**
```bash
# Set restrictive permissions
chmod 600 config/config.php
```

### **4. Enable HTTPS**
Always use HTTPS in production. Configure your web server:
```apache
# Apache .htaccess
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### **5. Database User Permissions**
Create a dedicated database user with minimal permissions:
```sql
CREATE USER 'megaweb_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON megaweb_db.* TO 'megaweb_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## 🚀 Performance Optimization

### **1. Enable OPcache**
Add to `php.ini`:
```ini
opcache.enable=1
opcache.memory_consumption=256
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0
```

### **2. Increase PHP Limits**
```ini
memory_limit = 2G
max_execution_time = 300
max_input_time = 300
post_max_size = 100M
upload_max_filesize = 100M
```

### **3. MySQL Optimization**
```sql
-- Add indexes for common queries
CREATE INDEX idx_sessions_status_created ON sessions(status, created_at);
CREATE INDEX idx_replicas_session_status ON session_replicas(session_id, status);
CREATE INDEX idx_events_aggregate_time ON events(aggregate_id, timestamp);
```

### **4. Enable Compression**
Apache `.htaccess`:
```apache
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css application/json application/javascript
</IfModule>
```

### **5. Browser Caching**
```apache
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType image/png "access plus 1 year"
</IfModule>
```

---

## 🧪 Testing After Deployment

### **1. Test API Endpoints**
```bash
# Check API is working
curl https://your-domain.com/api/sessions

# Create a test session
curl -X POST https://your-domain.com/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "target_replica_count": 1}'

# Get metrics
curl https://your-domain.com/api/metrics/global
```

### **2. Test Real-time Streaming**
Open browser console at control panel and check:
```javascript
// Should see SSE connection
// Look for: EventSource connected to /api/stream
```

### **3. Test Bulk Operations**
1. Go to control panel
2. Switch to "Bulk Create" view
3. Enter 10 test URLs
4. Click "Create All Sessions"
5. Verify all created successfully

---

## 📈 Monitoring & Maintenance

### **1. Monitor Logs**
```bash
# PHP error log
tail -f /var/log/php/error.log

# Apache access log
tail -f /var/log/apache2/access.log

# MySQL slow query log
tail -f /var/log/mysql/slow-queries.log
```

### **2. Database Maintenance**
```sql
-- Run weekly
OPTIMIZE TABLE sessions;
OPTIMIZE TABLE session_replicas;
OPTIMIZE TABLE events;

-- Clean old events (older than 30 days)
DELETE FROM events WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### **3. Backup Strategy**
```bash
# Daily database backup
mysqldump -u user -p database_name > backup-$(date +%Y%m%d).sql

# Weekly full backup including files
tar -czf backup-$(date +%Y%m%d).tar.gz /path/to/php/
```

---

## 🐛 Troubleshooting

### **Issue: "Database connection failed"**
- Check credentials in `config/config.php`
- Verify MySQL is running: `service mysql status`
- Check database exists: `SHOW DATABASES;`
- Verify user permissions: `SHOW GRANTS FOR 'user'@'localhost';`

### **Issue: "Session not creating"**
- Check PHP error log for details
- Verify database tables exist
- Check PHP memory limit
- Verify MySQL max_allowed_packet size

### **Issue: "Real-time updates not working"**
- Check browser console for SSE errors
- Verify `/api/stream` is accessible
- Check server timeout settings
- Disable output buffering in php.ini

### **Issue: "Slow performance with many sessions"**
- Add database indexes (see optimization section)
- Increase PHP memory limit
- Enable OPcache
- Consider database replication
- Implement caching layer (Redis/Memcached)

---

## 📞 Support & Resources

### **Documentation**
- `PHP_MIGRATION_COMPLETE.md` - Migration details
- `PHP_README.md` - Original PHP documentation
- `README.md` - Project overview

### **Database Schemas**
- `database/schema.sql` - Core tables
- `database/schema-advanced.sql` - Advanced features

### **Configuration Files**
- `php/config/config.php` - Main configuration
- `php/.htaccess` - Apache rewrite rules

---

## ✅ Deployment Checklist

- [ ] Files uploaded to server
- [ ] Database created
- [ ] Installer run successfully
- [ ] Installer files deleted
- [ ] Config file secured (chmod 600)
- [ ] HTTPS enabled
- [ ] API tested
- [ ] Control panel accessible
- [ ] Real-time updates working
- [ ] Backups configured
- [ ] Monitoring enabled
- [ ] Performance optimized

---

## 🎉 You're Ready!

Your MegaWeb Orchestrator is now deployed and ready to manage **1 million concurrent sessions**!

**Access Points:**
- 🎮 Control Panel: `https://your-domain.com/public/control-panel.php`
- 🔌 API Base: `https://your-domain.com/api/`
- 📊 Metrics: `https://your-domain.com/api/metrics/global`
- 🌐 Hypergrid: `https://your-domain.com/api/hypergrid`

**Start creating sessions and scaling to millions! 🚀**
