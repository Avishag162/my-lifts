# For Google Cloud Run (or any container host). The data lives in Turso: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm install --no-save libsql
COPY . .
RUN npm run build
ENV SECURE_COOKIES=true \
    DB_PATH=/tmp/my-lifts/replica.db
EXPOSE 8080
CMD ["npm", "start"]
