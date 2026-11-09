# Stage 1: Build React frontend
FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS builder
WORKDIR /opt/app-root/src

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS runner
WORKDIR /opt/app-root/src

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY collector.js ./
COPY public/ ./public/
COPY --from=builder /opt/app-root/src/dist ./dist

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "server.js"]
