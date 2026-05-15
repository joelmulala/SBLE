FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client curl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p uploads \
  && chmod +x scripts/docker-entrypoint.sh scripts/wait-for-postgres.sh

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5000/api/health || exit 1

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
