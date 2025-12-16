# Database Migrations

This directory contains SQL migrations for the chatbot database.

## Structure

```
migrations/
├── migrate.py          # Migration runner (like golang-migrate)
└── sql/
    ├── 001_create_conversations.sql
    └── 002_create_files.sql
```

## Usage

### Automatic (on server startup)

Migrations run automatically when the server starts.

### Manual

```bash
cd mock-backend
python -m migrations.migrate
```

## Environment Variables

### SQLite (default)

```bash
USE_POSTGRES=false
DB_PATH_CHATBOT="mock.db"
```

### PostgreSQL (for production)

```bash
USE_POSTGRES=true
POSTGRES_URL=postgresql://user:password@host:5432/dbname
```

## Azure PostgreSQL Setup

1. Create Azure Database for PostgreSQL Flexible Server
2. Get connection string from Azure Portal
3. Set environment variables in Azure App Service:

   ```
   USE_POSTGRES=true
   POSTGRES_URL=postgresql://username:password@servername.postgres.database.azure.com:5432/dbname?sslmode=require
   ```

## Creating New Migrations

1. Create new SQL file with incremental number:

   ```bash
   touch migrations/sql/003_add_new_table.sql
   ```

2. Write SQL (supports both PostgreSQL and SQLite syntax):

   ```sql
   -- Migration: Add new feature
   -- Version: 003
   
   CREATE TABLE IF NOT EXISTS new_table (
       id TEXT PRIMARY KEY,
       data TEXT NOT NULL
   );
   ```

3. Migrations run in alphabetical order automatically.

## Performance

- **SQLite on Azure**: ~5000ms TTFB (slow disk I/O)
- **PostgreSQL on Azure**: ~50-200ms TTFB (connection pooling)

Use PostgreSQL for production deployments on Azure!
