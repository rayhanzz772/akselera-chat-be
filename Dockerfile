# ============================================================
# Stage 1: Install dependencies (shared by dev & production)
# ============================================================
FROM node:20-alpine AS deps

# argon2 requires build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ============================================================
# Stage 2: Development image
# ============================================================
FROM node:20-alpine AS development

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Entrypoint lives outside /app so volume mounts won't overwrite it
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE ${PORT:-4000}

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npx", "nodemon", "index.js"]

# ============================================================
# Stage 3: Production image
# ============================================================
FROM node:20-alpine AS production

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Entrypoint lives outside /app so volume mounts won't overwrite it
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Remove dev dependencies if present
RUN npm prune --omit=dev

EXPOSE ${PORT:-4000}

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "index.js"]
