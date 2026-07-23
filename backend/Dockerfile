FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev

COPY . .

RUN npx prisma generate

EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run seed && node src/server.js"]
