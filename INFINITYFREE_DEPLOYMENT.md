# 🚀 InfinityFree Deployment Guide

## Step-by-Step Deployment to InfinityFree Hosting

This guide will walk you through deploying the MegaWeb Orchestrator PHP application to InfinityFree free hosting.

---

## Prerequisites

- InfinityFree account (sign up at https://infinityfree.net/)
- FTP client (FileZilla recommended) or use built-in File Manager
- Basic understanding of cPanel

---

## Step 1: Create InfinityFree Account

1. Go to https://infinityfree.net/
2. Click "Sign Up" and create an account
3. Verify your email address
4. Log into the client area

---

## Step 2: Create a Website

1. In the InfinityFree client area, click "Create Account"
2. Choose a subdomain (e.g., `megaweb-orchestrator`)
   - Full URL will be: `megaweb-orchestrator.infinityfreeapp.com`
   - Or use your own domain if you have one
3. Leave other settings as default
4. Click "Create Account"
5. Wait for account creation (usually 1-5 minutes)

---

## Step 3: Access cPanel

1. Once account is created, click "Control Panel" or "cPanel"
2. You'll be logged into your hosting cPanel
3. Note your hosting credentials shown on the page

---

## Step 4: Create MySQL Database

1. In cPanel, find "MySQL Databases" icon
2. Click "MySQL Databases"
3. Under "Create New Database":
   - Enter database name: `megaweb` (or any name you prefer)
   - Click "Create Database"
4. Note the full database name (format: `epiz_XXXXXXXX_megaweb`)
5. Under "MySQL Users", create a new user:
   - Username: `megauser` (or any name)
   - Password: Generate a strong password
   - Click "Create User"
6. Note the full username (format: `epiz_XXXXXXXX_megauser`)
7. Under "Add User to Database":
   - Select the user you created
   - Select the database you created
   - Click "Add"
8. On privileges page, check "ALL PRIVILEGES"
9. Click "Make Changes"

**Important**: Save these credentials - you'll need them!
- Database Name: `epiz_XXXXXXXX_megaweb`
- Database User: `epiz_XXXXXXXX_megauser`
- Database Password: (the password you set)
- Database Host: `localhost`

---

## Step 5: Upload Files

### Option A: Using File Manager (Easier)

1. In cPanel, click "File Manager"
2. Navigate to `htdocs` folder (this is your web root)
3. Delete any default files (index.html, etc.)
4. Click "Upload" button
5. Upload all files from the `php/` directory:
   - Upload entire `api/` folder
   - Upload entire `config/` folder
   - Upload entire `includes/` folder
   - Upload entire `public/` folder
   - Upload `.htaccess` file
   - Upload `install.php` file
   - Upload `install-process.php` file
6. Also upload `database/schema.sql` to a temporary location
7. Ensure directory structure is:
   ```
   htdocs/
   ├── api/
   │   └── index.php
   ├── config/
   │   ├── config.php
   │   └── .env.example
   ├── includes/
   │   ├── database.php
   │   └── orchestrator.php
   ├── public/
   │   └── index.php
   ├── .htaccess
   ├── install.php
   └── install-process.php
   ```

### Option B: Using FTP (Advanced)

1. Download FileZilla from https://filezilla-project.org/
2. Get your FTP credentials from InfinityFree client area
3. Connect to FTP:
   - Host: `ftpupload.net` (or the hostname shown)
   - Username: Your InfinityFree username
   - Password: Your FTP password
   - Port: 21
4. Navigate to `htdocs` folder on the server
5. Delete any default files
6. Upload all files from `php/` directory
7. Ensure correct directory structure (same as Option A)

---

## Step 6: Set File Permissions

1. In File Manager, select the `config/` folder
2. Click "Permissions" or "Change Permissions"
3. Set to `755` (rwxr-xr-x)
4. Do the same for `includes/` and `api/` folders
5. For `.htaccess`, set to `644` (rw-r--r--)

---

## Step 7: Run Installation

1. Open your browser
2. Go to: `https://your-subdomain.infinityfreeapp.com/install.php`
3. Fill in the installation form:
   - **Database Host**: `localhost`
   - **Database Name**: `epiz_XXXXXXXX_megaweb` (your full DB name)
   - **Database Username**: `epiz_XXXXXXXX_megauser` (your full username)
   - **Database Password**: (your DB password)
   - **Application URL**: `https://your-subdomain.infinityfreeapp.com`
   - **Environment**: `production`
   - **Debug Mode**: Leave unchecked
4. Ensure all checkboxes are checked:
   - ✓ Create database tables
   - ✓ Insert sample data
   - ✓ Generate configuration file
5. Click "🚀 Install Now"
6. Wait for installation to complete (may take 30-60 seconds)
7. You should see "✅ Installation Successful!"

---

## Step 8: Secure Your Installation

**CRITICAL SECURITY STEP:**

1. Go back to File Manager in cPanel
2. Navigate to `htdocs`
3. Delete the following files:
   - `install.php`
   - `install-process.php`
4. These files contain installation code and should not be accessible after setup

---

## Step 9: Test Your Installation

1. Visit your main URL: `https://your-subdomain.infinityfreeapp.com/`
2. You should see the MegaWeb Orchestrator control panel
3. Test the API:
   - Go to: `https://your-subdomain.infinityfreeapp.com/api/health`
   - Should return JSON: `{"status":"healthy","database":"healthy",...}`
4. Test creating a session:
   - Click "Create Session" button
   - Enter URL: `https://example.com`
   - Click "Create Session"
   - Should appear in the session grid

---

## Step 10: Start Using!

You're now ready to use the MegaWeb Orchestrator:

1. **Create Sessions**: Click "Create Session" to add individual sites
2. **Bulk Embed**: Click "Bulk Embed Sites" to add multiple sites at once
3. **Scale Up**: Click "Scale to 1M Sessions" to create many sessions
4. **Monitor**: Watch real-time metrics in the dashboard

---

## Troubleshooting

### Issue: 404 Error on All Pages

**Solution:**
- Check `.htaccess` file is in the root directory
- Verify mod_rewrite is enabled (usually is on InfinityFree)
- Check file permissions on `.htaccess` (should be 644)

### Issue: Database Connection Failed

**Solution:**
- Verify database credentials in config
- Check database exists in cPanel
- Ensure database user has correct privileges
- Try recreating the database user

### Issue: 500 Internal Server Error

**Solution:**
- Check PHP error logs in cPanel (under "Error Logs")
- Verify file permissions (folders: 755, files: 644)
- Check `.htaccess` syntax
- Ensure PHP version is 7.4+ (check in cPanel under "PHP Version")

### Issue: API Returns Errors

**Solution:**
- Check error logs in cPanel
- Verify `api/index.php` exists
- Check database connection
- Try accessing `api/health` endpoint directly

### Issue: Installation Hangs

**Solution:**
- Check MySQL database is running
- Verify sufficient disk space
- Try manual installation using phpMyAdmin
- Check PHP execution time limits

### Issue: Slow Performance

**Solution:**
- Limit concurrent sessions to ~100K for free hosting
- Enable query caching (already enabled in code)
- Optimize database regularly
- Consider upgrading to premium InfinityFree plan for better performance

---

## Performance Tips for InfinityFree

1. **Session Limits**
   - Free hosting works best with 10K-100K sessions
   - For 1M sessions, consider premium hosting
   - Use bulk operations for better efficiency

2. **Database Optimization**
   - Run cleanup procedures weekly
   - Optimize tables monthly via phpMyAdmin
   - Monitor database size (free plan has 400MB limit)

3. **Caching**
   - Query caching is enabled by default
   - Responses are cached for 5 minutes
   - Clear cache on major updates

4. **Resource Management**
   - Auto-refresh updates every 5 seconds
   - Disable if not needed to save resources
   - Use batch operations instead of individual API calls

---

## Upgrading Free Plan

If you need better performance:

1. **InfinityFree Premium** ($1.99-4.99/month)
   - More resources
   - Better performance
   - Priority support

2. **Alternative Hosts**
   - HostGator, Bluehost, etc.
   - Similar deployment process
   - Better for high-volume usage

---

## Backup & Migration

### Creating Backups

1. **Database Backup**:
   - cPanel → phpMyAdmin
   - Select database → Export
   - Save SQL file

2. **File Backup**:
   - cPanel → File Manager
   - Select all files → Compress
   - Download ZIP file

### Migrating to Another Host

1. Upload files to new host
2. Import database SQL file
3. Update `config/config.php` with new credentials
4. Test functionality

---

## Additional Resources

- InfinityFree Documentation: https://forum.infinityfree.net/
- InfinityFree Support: https://infinityfree.net/support
- PHP Manual: https://php.net/manual/
- MySQL Manual: https://dev.mysql.com/doc/

---

## Support

For InfinityFree-specific issues:
- Visit: https://forum.infinityfree.net/
- Search existing topics or create a new one
- InfinityFree community is very helpful!

For application issues:
- Check PHP_README.md for detailed documentation
- Review error logs in cPanel
- Check database connection and permissions

---

## Checklist

- [ ] InfinityFree account created
- [ ] Website/subdomain created
- [ ] MySQL database created
- [ ] Database user created with all privileges
- [ ] Files uploaded to `htdocs`
- [ ] File permissions set correctly
- [ ] Installation completed successfully
- [ ] install.php and install-process.php deleted
- [ ] Control panel accessible
- [ ] API health check passing
- [ ] First session created and visible
- [ ] Ready to scale! 🎉

---

**Congratulations! Your MegaWeb Orchestrator is now live on InfinityFree! 🚀**
