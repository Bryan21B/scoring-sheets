# Image de production. Fonctionne avec podman build ou docker build.
#
# Bun installe et build ; Node fait tourner le serveur. Ce partage n'est pas une
# hésitation : Next.js sous Node est le chemin éprouvé, et Bun 1.3.14 segfault en
# buildant Next dans un conteneur Linux (voir docs/adr/0001). libSQL tourne
# indifféremment sur les deux, donc le même code sert ici et sous `bun test`.
#
# Debian slim plutôt qu'Alpine : @libsql/client publie des prebuilds gnu et musl,
# mais l'image Bun officielle est déjà Debian et éviter un changement de libc
# supprime une variable.

# ---------- builder ----------
FROM node:22-bookworm-slim AS builder

RUN npm install --global bun@1.3.14

WORKDIR /app

# Couche de dépendances séparée : elle n'est réinvalidée que si le lockfile bouge.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Déclenche `output: standalone` (voir next.config.ts) uniquement ici.
ENV BUILD_STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Le volume est monté ici ; le chemin n'est jamais codé en dur ailleurs.
ENV DATABASE_PATH=/data/app.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Utilisateur non-root. L'UID est fixe pour que le propriétaire du volume côté
# hôte reste prévisible d'un build à l'autre.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /data \
  && chown -R nextjs:nodejs /data

# Le serveur standalone embarque ses dépendances tracées, @libsql/client compris
# (il est listé dans serverExternalPackages).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migrations SQL + runner, pour lancer `node scripts/migrate.mjs` dans le
# conteneur avant de démarrer le serveur.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs

# Next bundle drizzle-orm dans les chunks du serveur, donc le tracer ne le laisse
# pas dans .next/standalone/node_modules — mais migrate.mjs, lui, l'importe au
# runtime. On le copie explicitement (paquet pur JS, zéro dépendance).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

USER nextjs

VOLUME ["/data"]
EXPOSE 3000

# Podman ignore cette directive au format OCI (son défaut) — voir
# docs/deployment.md pour l'équivalent Quadlet. Docker, lui, l'honore.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
