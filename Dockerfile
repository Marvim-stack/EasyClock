FROM node:22-bookworm
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
RUN npx playwright install --with-deps chromium
COPY . .
RUN npm run build
CMD ["npm", "start"]
