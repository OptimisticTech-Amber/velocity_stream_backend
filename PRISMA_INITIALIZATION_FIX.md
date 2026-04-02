# PrismaClientInitializationError Troubleshooting Guide

## Problem

```
Error uploading movie video: PrismaClientInitializationError:
```

This error occurs when:

1. `DATABASE_URL` environment variable is not set
2. Prisma migrations haven't been run on the database
3. Prisma Client can't connect to the PostgreSQL database

## Root Causes Fixed

### 1. **Missing DATABASE_URL in Docker Compose**

**Issue**: The `app` service wasn't passing `DATABASE_URL` to the container.

**Fix**: Updated `docker-compose.yml` to include:

```yaml
environment:
  DATABASE_URL: "postgresql://postgres:postgres@postgres:5432/video_db"
```

### 2. **Duplicate PostgreSQL Service**

**Issue**: `docker-compose.yml` had two `postgres:` service definitions, causing YAML parsing errors.

**Fix**: Removed the duplicate postgres service definition.

### 3. **Migrations Not Running**

**Issue**: Docker container starts the app before Prisma migrations are applied to the database.

**Fix**: Updated Dockerfile to run migrations before app startup:

```dockerfile
RUN echo '#!/bin/sh\nset -e\necho "Running Prisma migrations..."\nnpx prisma migrate deploy\necho "Starting application..."\nexec npm start' > /app/start.sh && chmod +x /app/start.sh
CMD ["/app/start.sh"]
```

### 4. **Prisma Client Not Generated**

**Issue**: Generated Prisma Client might be missing or outdated.

**Fix**: Build stage in Dockerfile now includes:

```dockerfile
RUN npx prisma generate
```

### 5. **Poor Error Messaging**

**Issue**: When DATABASE_URL is missing, error message is not clear.

**Fix**: Updated `src/config/prisma.ts` to check and report:

```typescript
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  throw new Error("DATABASE_URL environment variable is required");
}
```

## How to Fix

### For Local Development (docker-compose)

1. **Start services with proper order**:

```bash
docker-compose down -v  # Remove old volumes if needed
docker-compose up -d postgres
sleep 5
docker-compose up -d kafka zookeeper redis elasticsearch
sleep 10
docker-compose up -d app
```

2. **Verify DATABASE_URL is set**:

```bash
docker-compose exec app printenv DATABASE_URL
# Should output: postgresql://postgres:postgres@postgres:5432/video_db
```

3. **Check Prisma migrations status**:

```bash
docker-compose exec app npx prisma migrate status
```

### For AWS ECS Deployment

1. **Add to ECS Task Definition**:

```json
{
  "name": "DATABASE_URL",
  "value": "postgresql://username:password@rds-endpoint.amazonaws.com:5432/video_db"
}
```

2. **Or use Secrets Manager**:

```json
{
  "name": "DATABASE_URL",
  "valueFrom": "arn:aws:secretsmanager:region:account:secret:rds/db-url:::"
}
```

3. **Ensure Migrations Run**:
   The Docker container now automatically runs `npx prisma migrate deploy` before starting the app.

## Verification Steps

1. **Check logs for environment setup**:

```bash
docker-compose logs app | grep -i database
# Look for: ✅ Set or ❌ Not Set
```

2. **Test database connection**:

```bash
docker-compose exec app node -e "require('./dist/config/prisma').getPrisma().user.findFirst()"
```

3. **Check Prisma migrations**:

```bash
docker-compose exec app npx prisma migrate status
MIGRATIONS
Migrations to apply: 0
Migrations pending on database: 0
```

## Files Modified

- ✅ `Dockerfile` - Added startup script for migrations
- ✅ `docker-compose.yml` - Fixed duplicate postgres, added app service config
- ✅ `src/config/prisma.ts` - Added DATABASE_URL validation and error handling
- ✅ `src/server.ts` - Added environment logging on startup

## Common Errors & Solutions

### Error: "relations not found"

**Cause**: Migrations haven't been applied
**Fix**: Run `docker-compose exec app npx prisma migrate deploy`

### Error: "ECONNREFUSED 127.0.0.1:5432"

**Cause**: Database not ready when app starts
**Fix**: Database now has 10s startup delay + app waits for postgres service to be healthy

### Error: "no password was provided"

**Cause**: PostgreSQL credentials mismatch
**Fix**: Verify DATABASE_URL matches postgres service credentials:

```yaml
POSTGRES_USER: postgres
POSTGRES_PASSWORD: postgres
# DATABASE_URL should be: postgresql://postgres:postgres@...
```

## Prevention

1. **Always validate DATABASE_URL** on app startup ✅ (implemented)
2. **Run migrations in Docker startup** ✅ (implemented)
3. **Wait for database health** ✅ (implemented)
4. **Clear logging of environment setup** ✅ (implemented)
