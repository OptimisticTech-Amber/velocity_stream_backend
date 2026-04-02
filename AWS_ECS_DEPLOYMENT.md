# AWS ECS Deployment Guide

## Problem

The app fails with `Environment variable not found: DATABASE_URL` in AWS ECS because environment variables aren't being passed to the Docker container.

## Solution

### 1. Create .env File in Project Root

Create a `.env` file locally (don't commit to git):

```
DATABASE_URL="postgresql://username:password@rds-endpoint:5432/video_db"
KAFKA_BROKER="kafka-broker-address:9092"
REDIS_URL="redis://redis-endpoint:6379"
NODE_ENV="production"
```

### 2. AWS ECS Task Definition Configuration

In your ECS Task Definition, add the following **Container Environment Variables**:

```json
{
  "name": "backend-app",
  "image": "your-ecr-repo/backend:latest",
  "essential": true,
  "portMappings": [
    {
      "containerPort": 5000,
      "hostPort": 5000,
      "protocol": "tcp"
    }
  ],
  "environment": [
    {
      "name": "DATABASE_URL",
      "value": "postgresql://postgres:password@your-rds-endpoint:5432/video_db"
    },
    {
      "name": "KAFKA_BROKER",
      "value": "kafka-broker:9092"
    },
    {
      "name": "REDIS_URL",
      "value": "redis://your-redis-endpoint:6379"
    },
    {
      "name": "NODE_ENV",
      "value": "production"
    }
  ],
  "logConfiguration": {
    "logDriver": "awslogs",
    "options": {
      "awslogs-group": "/ecs/backend",
      "awslogs-region": "us-east-1",
      "awslogs-stream-prefix": "ecs"
    }
  }
}
```

### 3. Using AWS Secrets Manager (Recommended)

For sensitive data like passwords, use AWS Secrets Manager:

```json
"secrets": [
  {
    "name": "DATABASE_URL",
    "valueFrom": "arn:aws:secretsmanager:region:account-id:secret:rds/database-url:DATABASE_URL::"
  }
]
```

### 4. Docker Build & Push

```bash
# Build the image
docker build -t backend:latest .

# Tag for ECR
docker tag backend:latest your-ecr-repo/backend:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-ecr-repo
docker push your-ecr-repo/backend:latest
```

### 5. Verify Environment Variables in Logs

Check CloudWatch logs to confirm variables are loaded:

- Go to CloudWatch → Log Groups → `/ecs/backend`
- Look for environment variable output in logs

### 6. RDS Endpoint for DATABASE_URL

If using AWS RDS for PostgreSQL:

```
DATABASE_URL="postgresql://admin:password@backend-db.c123abc.us-east-1.rds.amazonaws.com:5432/video_db"
```

Format: `postgresql://username:password@host:port/database_name`

## Troubleshooting

### Issue: Still getting "DATABASE_URL not found"

1. Check ECS Task Definition - verify environment variable is present
2. Check ECS Service - ensure it's using the latest task definition revision
3. Check logs in CloudWatch for the actual error
4. Verify Prisma is reading from `process.env.DATABASE_URL`

### Issue: Connection refused

1. Verify RDS security groups allow inbound traffic on port 5432
2. Verify DATABASE_URL is correct format
3. Wait 1-2 minutes after service starts (database warm-up)

## Local Testing with docker-compose

Before deploying to ECS:

```bash
docker-compose up -d
# Check if app connects properly
docker-compose logs app
```
