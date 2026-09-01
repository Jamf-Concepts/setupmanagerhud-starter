FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:frontend

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/public ./public
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/src ./src
VOLUME ["/data"]
ENV DB_PATH=/data/hud.sqlite
ENV PORT=8080
EXPOSE 8080
CMD ["node", "--experimental-strip-types", "src/server.ts"]
