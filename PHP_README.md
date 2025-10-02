# MegaWeb Orchestrator - PHP/MySQL Edition

## Complete Transformation for InfinityFree Hosting

This is the **advanced PHP/MySQL version** of the MegaWeb Orchestrator platform, fully optimized for InfinityFree free hosting while maintaining the capability to manage **1 million concurrent website sessions**.

---

## 🚀 Features

### Core Capabilities
- ✅ **1M Concurrent Sessions**: Manage up to 1 million website sessions simultaneously
- ✅ **Multi-Country Proxy Support**: Route traffic through 195+ countries
- ✅ **Real-time Metrics**: Live monitoring of all sessions and replicas
- ✅ **Bulk Operations**: Create thousands of sessions in seconds
- ✅ **Advanced Scaling**: Auto-scale from 1 to 1M sessions
- ✅ **Event Sourcing**: Complete audit trail of all operations
- ✅ **Hypergrid Visualization**: Spatial grid view of all active sessions

### Technical Stack
- **Backend**: PHP 7.4+ with advanced OOP patterns
- **Database**: MySQL 5.7+ with stored procedures and triggers
- **Frontend**: Vanilla JavaScript with advanced UI
- **API**: RESTful API with JSON responses
- **Hosting**: Optimized for InfinityFree shared hosting

---

## 📋 Pre-Installation Requirements

### InfinityFree Account Setup
1. Create a free account at [InfinityFree](https://infinityfree.net/)
2. Create a new website/hosting account
3. Note your cPanel credentials

### Database Setup
1. Log into your cPanel
2. Navigate to "MySQL Databases"
3. Create a new database (e.g., `epiz_12345678_megaweb`)
4. Create a database user with all privileges
5. Note the database credentials

### System Requirements
- PHP 7.4 or higher
- MySQL 5.7 or higher
- PDO MySQL extension enabled
- mod_rewrite enabled (usually enabled on InfinityFree)
- Memory limit: 512MB+ (set in code)
- Max execution time: 60 seconds (set in code)

---

## 🔧 Installation Guide

### Method 1: Automatic Installation (Recommended)

1. **Upload Files**
   - Download all files from the `php/` directory
   - Upload to your InfinityFree hosting via FTP or File Manager
   - Recommended structure:
     ```
     public_html/
     ├── api/
     ├── config/
     ├── includes/
     ├── public/
     ├── .htaccess
     ├── install.php
     └── install-process.php
     ```

2. **Run Installation**
   - Visit `https://your-site.infinityfreeapp.com/install.php`
   - Fill in your database credentials
   - Configure application settings
   - Click "Install Now"
   - Wait for installation to complete

3. **Security**
   - **IMPORTANT**: Delete `install.php` and `install-process.php` after installation
   - These files contain sensitive installation routines

4. **Access Panel**
   - Visit `https://your-site.infinityfreeapp.com/`
   - You should see the MegaWeb Orchestrator control panel

### Method 2: Manual Installation

1. **Upload Files** (same as Method 1)

2. **Import Database Schema**
   - Access phpMyAdmin in cPanel
   - Select your database
   - Import `database/schema.sql`
   - Wait for completion (may take 1-2 minutes)

3. **Configure Application**
   - Edit `config/config.php`
   - Update database credentials:
     ```php
     define('DB_HOST', 'localhost');
     define('DB_NAME', 'your_database_name');
     define('DB_USER', 'your_database_user');
     define('DB_PASS', 'your_database_password');
     ```

4. **Set Permissions**
   - Ensure `config/` directory is writable (chmod 755)
   - Ensure `.htaccess` is in root directory

5. **Test Installation**
   - Visit `https://your-site.infinityfreeapp.com/api/health`
   - Should return: `{"status":"healthy","database":"healthy",...}`

---

## 📖 Usage Guide

### Control Panel Overview

The main control panel provides:

1. **Global Metrics Dashboard**
   - Total active sessions
   - Total replicas
   - Active proxies
   - Countries covered
   - Average latency

2. **Quick Actions**
   - Bulk Embed Sites
   - Scale to 1M Sessions
   - Create Single Session
   - Refresh Metrics
   - Clear All Sessions

3. **Live Session Grid**
   - Visual grid of all active sessions
   - Real-time status updates
   - Click sessions for details

### Creating Sessions

#### Single Session
1. Click "Create Session" button
2. Enter website URL
3. Set target replica count
4. Select region (optional)
5. Click "Create Session"

#### Bulk Embed
1. Click "Bulk Embed Sites" button
2. Enter URLs (one per line)
3. Set replicas per URL
4. Select region
5. Click "Launch Sites"

#### Scale to Million
1. Click "Scale to 1M Sessions"
2. Set target session count (default: 1,000,000)
3. Click "Start Scaling"
4. Wait for completion (progress bar shows status)

---

## 🔌 API Reference

Base URL: `https://your-site.infinityfreeapp.com/api`

### Endpoints

#### Sessions

**GET /api/sessions**
- List all sessions
- Query parameters: `status`, `region`, `proxy_pool_id`
- Response: Array of session blueprints

**POST /api/sessions**
- Create a single session
- Body: `{ "url": "https://example.com", "target_replica_count": 1, ... }`
- Response: Created session object

**GET /api/sessions/{id}**
- Get session by ID
- Response: Session blueprint

**PUT /api/sessions/{id}**
- Update session
- Body: Fields to update
- Response: Updated session

**DELETE /api/sessions/{id}**
- Delete session
- Response: `{ "success": true, "id": "..." }`

**POST /api/sessions/{id}/scale**
- Scale session replicas
- Body: `{ "target_replicas": 100 }`
- Response: Updated session

**POST /api/sessions/batch**
- Create multiple sessions
- Body: Array of session definitions
- Response: `{ "created": [...], "failed": [...] }`

#### Bulk Operations

**POST /api/embed/bulk**
- Bulk embed multiple URLs
- Body:
  ```json
  {
    "urls": ["https://site1.com", "https://site2.com"],
    "bulkOptions": { "replicasPerUrl": 1, "region": "us-east" },
    "proxyRequirements": {},
    "renderingOptions": {}
  }
  ```
- Response: `{ "totalProcessed": 2, "createdSessionIds": [...], ... }`

**POST /api/embed/scale-million**
- Scale to 1M sessions
- Body: `{ "targetSessions": 1000000 }`
- Response: `{ "targetReached": true, "currentSessions": 1000000, ... }`

#### Metrics

**GET /api/metrics/global**
- Get global system metrics
- Response: Comprehensive metrics object

**GET /api/hypergrid**
- Get hypergrid snapshot
- Response: Spatial grid data with tiles

**GET /api/events**
- Get event stream
- Query parameters: `aggregate_id`, `event_type`, `since`
- Response: Array of events

#### Proxies

**GET /api/proxies**
- List all proxies with performance metrics
- Response: Array of proxies

**POST /api/proxies**
- Add a new proxy
- Body: `{ "pool_id": "global-pool", "host": "proxy.com", "port": 8080, ... }`
- Response: Created proxy ID

#### Health

**GET /api/health**
- Check system health
- Response: `{ "status": "healthy", "database": "healthy", ... }`

---

## 🗄️ Database Schema

### Core Tables

1. **sessions** - Main session storage
   - 19 columns including URL, status, region, replica counts
   - Indexes on status, region, proxy_pool_id

2. **replicas** - Individual replica instances
   - Linked to sessions via foreign key
   - Auto-updates session replica counts via triggers

3. **proxies** - Proxy server information
   - Country, region, city, coordinates
   - Success/failure tracking

4. **proxy_pools** - Proxy pool management
   - Regional grouping
   - Rotation strategies

5. **metrics** - Performance metrics
   - Time-series data
   - JSON storage for complex metrics

6. **events** - Event sourcing
   - Complete audit trail
   - Vector clock for distributed sync

7. **hypergrid_tiles** - Spatial visualization
   - Grid-based session grouping
   - Dominant status/country per tile

### Advanced Features

- **Stored Procedures**: `sp_create_bulk_sessions`, `sp_scale_session_replicas`, etc.
- **Triggers**: Auto-update replica counts, event logging
- **Views**: Performance optimized aggregations
- **Indexes**: Composite indexes for common query patterns

---

## ⚡ Performance Optimization

### InfinityFree Optimizations

1. **Query Caching**
   - 5-minute TTL for SELECT queries
   - Automatic cache invalidation on writes

2. **Connection Pooling**
   - Persistent PDO connections
   - Auto-reconnect on connection loss

3. **Batch Operations**
   - Process 1000 items per batch
   - 10ms pause between batches to prevent timeouts

4. **Memory Management**
   - 512MB memory limit
   - Efficient data structures
   - Garbage collection hints

5. **Database Optimization**
   - Stored procedures for complex operations
   - Indexed columns for fast lookups
   - View-based aggregations

### Scaling Strategies

For 1M sessions:
- Uses batch creation (1000 sessions per batch)
- Implements pause mechanism to prevent timeouts
- Leverages stored procedures for bulk operations
- Auto-scales with resource monitoring

---

## 🔒 Security Features

1. **SQL Injection Prevention**
   - Prepared statements for all queries
   - Input validation and sanitization

2. **CORS Configuration**
   - Configurable allowed origins
   - Secure headers

3. **Error Handling**
   - Production mode hides detailed errors
   - All errors logged to server logs

4. **File Protection**
   - `.htaccess` blocks access to sensitive files
   - Config files protected from direct access

5. **Input Validation**
   - Type checking on all inputs
   - Max limits on bulk operations

---

## 🐛 Troubleshooting

### Database Connection Failed
- Check database credentials in `config/config.php`
- Verify database exists in cPanel
- Ensure database user has proper privileges

### 500 Internal Server Error
- Check PHP error logs in cPanel
- Verify `.htaccess` is in root directory
- Check file permissions (755 for directories, 644 for files)

### API Returns 404
- Verify mod_rewrite is enabled
- Check `.htaccess` routing rules
- Ensure API files are in `/api` directory

### Slow Performance
- Check database indexes are created
- Verify query cache is enabled
- Monitor MySQL query logs in cPanel

### Sessions Not Creating
- Check available disk space
- Verify database connection
- Check error logs for specific issues

---

## 📊 Monitoring

### Built-in Monitoring
- Real-time metrics updated every 5 seconds
- Event log tracks all operations
- Resource utilization tracking (CPU, memory, disk)

### Database Monitoring
- Check table sizes:
  ```sql
  SELECT table_name, 
         ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb
  FROM information_schema.tables 
  WHERE table_schema = 'your_database_name';
  ```

### Performance Views
- `v_active_sessions` - Active session summary
- `v_proxy_performance` - Proxy success rates
- `v_global_metrics` - System-wide statistics

---

## 🔄 Maintenance

### Regular Tasks

1. **Cleanup Old Metrics** (weekly)
   ```sql
   CALL sp_cleanup_old_metrics(30);
   ```

2. **Optimize Tables** (monthly)
   ```sql
   OPTIMIZE TABLE sessions, replicas, metrics, events;
   ```

3. **Backup Database** (daily recommended)
   - Use cPanel backup tools
   - Or phpMyAdmin export

4. **Monitor Disk Space**
   - Check via cPanel File Manager
   - Delete old log files if needed

### Upgrading

1. Backup current database
2. Upload new PHP files
3. Run any migration scripts
4. Test functionality
5. Monitor for errors

---

## 🌟 Advanced Features

### Event Sourcing
All operations emit events stored in the `events` table:
- `session.created`
- `session.updated`
- `session.scaled`
- `session.deleted`
- `session.status.changed`

Query events via API: `/api/events?event_type=session.created`

### Hypergrid Visualization
Sessions organized in spatial grid:
- 1000 sessions per tile (configurable)
- Tracks dominant status per tile
- Country-based visualization
- Access via: `/api/hypergrid`

### Proxy Mesh Networking
Automatic proxy rotation:
- Round-robin strategy
- Sticky session support
- Burst mode for high-throughput
- Geo-routing by country/region

---

## 📝 Configuration Reference

### Environment Variables
Set in `config/config.php` or via `putenv()`:
- `DB_HOST` - Database host
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASS` - Database password
- `APP_URL` - Application URL
- `APP_ENV` - Environment (production/development)
- `APP_DEBUG` - Debug mode (true/false)

### Application Constants
- `MAX_SESSIONS` - Maximum concurrent sessions (1,000,000)
- `MAX_REPLICAS_PER_SESSION` - Max replicas per session (10,000)
- `MAX_BULK_OPERATIONS` - Batch operation limit (512)
- `CACHE_TTL` - Query cache TTL in seconds (300)
- `API_RATE_LIMIT` - API requests per minute (1000)

---

## 🎯 Best Practices

### For InfinityFree Hosting

1. **Resource Management**
   - Keep sessions under 100K for optimal performance
   - Use batch operations for large-scale creation
   - Enable query caching
   - Monitor memory usage

2. **Database Optimization**
   - Regularly clean old metrics
   - Optimize tables monthly
   - Use stored procedures for complex operations
   - Leverage indexes for queries

3. **API Usage**
   - Implement client-side throttling
   - Cache responses where possible
   - Use bulk endpoints for multiple operations
   - Handle errors gracefully

4. **Security**
   - Never commit sensitive credentials
   - Delete installation files after setup
   - Use production mode in live environment
   - Regularly update PHP version

---

## 📞 Support

### Getting Help
- Check this documentation first
- Review error logs in cPanel
- Check InfinityFree forums for hosting-specific issues
- Review PHP/MySQL documentation for technical questions

### Common Resources
- InfinityFree Help: https://forum.infinityfree.net/
- PHP Documentation: https://php.net/manual/
- MySQL Documentation: https://dev.mysql.com/doc/

---

## 📜 License

MIT License - Use freely for any purpose

---

## 🚀 Quick Start Checklist

- [ ] InfinityFree account created
- [ ] MySQL database created in cPanel
- [ ] Files uploaded to hosting
- [ ] Installation completed successfully
- [ ] Installation files deleted
- [ ] Control panel accessible
- [ ] API health check passing
- [ ] First session created successfully
- [ ] Metrics updating in real-time
- [ ] Ready to scale! 🎉

---

**Congratulations! You now have a fully functional MegaWeb Orchestrator platform capable of managing 1 million concurrent website sessions, all running on free InfinityFree hosting!**
