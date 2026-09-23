# Multi-stage production image for EdgeHub (Section 7.1's Next.js/Postgres stack).
#
# Uses node:20-slim (Debian, glibc) rather than the smaller node:20-alpine
# (musl libc) deliberately: Prisma's default query-engine binary targets
# glibc, and alpine needs an extra `binaryTargets` entry in schema.prisma to
# avoid a runtime "engine not found for this platform" failure. Slim avoids
# that whole class of bug for a few extra MB.
#
# Build-time NEXT_PUBLIC_* args are baked into the client bundle - Next.js
# inlines them at build time, so they can't be changed by runtime env vars
# alone. Every other env var (DATABASE_URL, STRIPE_SECRET_KEY, etc.) is read
# at runtime and should be injected by the deploy platform, never baked in.

# node:20-slim strips out openssl entirely, not just an old version of it.
# Without it, Prisma's binary-target detection can't probe the installed
# libssl at all and silently falls back to a guess (debian-openssl-1.1.x)
# that doesn't exist on this image (bookworm ships openssl 3.0) - `prisma
# generate` succeeds either way (it doesn't need to load the engine), so
# this only breaks the moment something actually queries the database,
# which mock mode never does. Installing openssl before `npm ci` runs
# (its postinstall calls `prisma generate`) fixes detection at generate
# time; the runner stage below needs its own copy for the same reason at
# request time.
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_AUTH_PROVIDER=mock
ARG NEXT_PUBLIC_BILLING_PROVIDER=mock
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
ENV NEXT_PUBLIC_AUTH_PROVIDER=$NEXT_PUBLIC_AUTH_PROVIDER
ENV NEXT_PUBLIC_BILLING_PROVIDER=$NEXT_PUBLIC_BILLING_PROVIDER
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# Prisma's generated client + query engine binary are already inside
# .next/standalone/node_modules - Next's build-time file tracer detects
# Prisma's dynamic requires and bundles them. Migrations are run as a
# separate step against this same schema (see DEPLOYMENT.md), not from
# this slim runtime image, which never has the `prisma` CLI itself.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
