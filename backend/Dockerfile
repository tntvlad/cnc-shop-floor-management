FROM node:18-alpine

WORKDIR /app

# Install system dependencies for admin operations
# - postgresql-client: for pg_dump and psql (database backup/restore)
# - git: for git pull operations
# - docker-cli and docker-compose: for service restart
RUN apk add --no-cache postgresql-client git docker-cli docker-cli-compose

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "server.js"]
