FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/widget ./widget
RUN npm ci --omit=dev --workspace=server 2>/dev/null || npm ci --omit=dev --workspace=server --include=dev 2>/dev/null || (cd server && npm ci --omit=dev)
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1
ENV NODE_ENV=production
CMD ["node", "server/dist/index.js"]
