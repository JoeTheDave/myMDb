FROM node:24-alpine AS builder
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci

# Install client dependencies
COPY client/package*.json ./client/
RUN cd client && npm ci

# Copy source
COPY server/ ./server/
COPY client/ ./client/

# Generate Prisma client, build server and client
RUN cd server && npm run db:generate
RUN cd server && npm run build
RUN cd client && npm run build

# Production stage — only what's needed to run
FROM node:24-alpine AS runner
WORKDIR /app

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/src/prisma ./server/src/prisma
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3001
CMD ["node", "server/dist/index.js"]
