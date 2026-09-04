FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/frontend ./frontend
COPY --from=build /app/drizzle ./drizzle
RUN mkdir -p uploads data
EXPOSE 3000 4000
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/src/index.js"]
