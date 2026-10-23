FROM node:22-bookworm
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
RUN npx playwright install --with-deps chromium
RUN command -v flock
COPY . .
RUN npm run build
CMD ["node", "apps/api/dist/main.js"]
