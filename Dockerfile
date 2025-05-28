# Usage:
# - Build: docker build -t <image-name> .
# - Run: docker run -it --env-file <env-file> <image-name>
#   OR
#   docker run -it -e KEY1=value1 -e KEY2=value2 <image-name>
#   OR
#   docker run -it --env-file .env <image-name>
#
# To backfill leverage tokens, set the BACKFILL_LEVERAGE_TOKENS environment variable to an array of addresses

# -------------------------------------
# ---------- 1️⃣  Build stage ----------
# -------------------------------------

FROM node:22-alpine AS builder

WORKDIR /app

# Only copy what is needed to calculate the dependency tree
COPY package*.json ./

# Install all deps (incl. dev) so TypeScript, ESLint, etc. can run
RUN npm ci

# Bring in the source and build the JS bundle
COPY . .
RUN npm run build

# Strip dev dependencies out of node_modules so the next stage only gets prod deps to reduce image size
RUN npm prune --omit=dev

# ---------------------------------------
# ---------- 2️⃣  Runtime stage ----------
# ---------------------------------------

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy the compiled output *and* the pruned node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .

RUN if [ -n "$BACKFILL_LEVERAGE_TOKENS" ]; then npm run backfill:leverage-token $BACKFILL_LEVERAGE_TOKENS; fi

# Environment variables will be passed through from the host to the container
# and will be available as process.env in the Node.js application
CMD ["npm", "start"]