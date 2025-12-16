"""Database migration runner - like golang-migrate for Python."""
import os
import asyncio
from pathlib import Path
from lib.db_connection import db_connection

async def run_migrations():
    """Run all SQL migrations in order."""
    migrations_dir = Path(__file__).parent / "sql"
    
    if not migrations_dir.exists():
        print("❌ Migrations directory not found")
        return
    
    # Get all .sql files sorted by name
    sql_files = sorted(migrations_dir.glob("*.sql"))
    
    if not sql_files:
        print("ℹ️  No migrations found")
        return
    
    print(f"🔄 Running {len(sql_files)} migrations...")
    
    async with db_connection.get_connection() as conn:
        for sql_file in sql_files:
            print(f"  📄 Applying {sql_file.name}...")
            
            sql_content = sql_file.read_text()
            
            if db_connection.use_postgres:
                # PostgreSQL - execute directly
                await conn.execute(sql_content)
            else:
                # SQLite - execute with cursor
                await conn.executescript(sql_content)
                await conn.commit()
            
            print(f"  ✅ {sql_file.name} applied")
    
    print("✅ All migrations completed")

async def main():
    """Main entry point for migration runner."""
    try:
        # Initialize connection pool if using PostgreSQL
        if db_connection.use_postgres:
            await db_connection.init_postgres_pool()
        
        await run_migrations()
        
        # Close pool if using PostgreSQL
        if db_connection.use_postgres:
            await db_connection.close_postgres_pool()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
