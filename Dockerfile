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

EXPOSE ${PORT:-4000}

CMD ["npx", "nodemon", "index.js"]

# ============================================================
# Stage 3: Production image
# ============================================================
FROM node:20-alpine AS production

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Remove dev dependencies if present
RUN npm prune --omit=dev

EXPOSE ${PORT:-4000}

CMD ["node", "index.js"]
