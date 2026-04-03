# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Generate Prisma Client
RUN npx prisma generate

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install ffmpeg
RUN apk add --no-cache ffmpeg

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose port (adjust based on your server port)
EXPOSE 5000

# Accept DATABASE_URL as build/runtime argument
ENV DATABASE_URL=""

# Create startup script with Prisma migrate
RUN echo '#!/bin/sh\nset -e\necho "Waiting for database..."\nsleep 10\necho "Running Prisma migrations..."\nnpx prisma migrate deploy\necho "Starting application..."\nexec npm start' > /app/start.sh && chmod +x /app/start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application with migrations
CMD ["/bin/sh", "/app/start.sh"]
