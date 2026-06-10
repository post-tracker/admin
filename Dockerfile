# --- Build stage: install all deps and build the Vite bundle into web/ ---
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage: only the server + built assets + production deps ---
FROM node:22-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY queues.js ./
COPY bullBoard.js ./
COPY twitch.js ./
COPY --from=builder /usr/src/app/web ./web

EXPOSE 4000

CMD [ "node", "server.js" ]
