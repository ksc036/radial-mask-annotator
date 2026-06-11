FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173
ENV DATA_DIR=/data

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY server ./server

EXPOSE 4173
CMD ["node", "server/index.mjs"]
