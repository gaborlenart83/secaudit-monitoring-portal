FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src ./src

COPY prisma ./prisma
RUN npx prisma generate
COPY swagger.json ./

EXPOSE 5000

CMD ["npm", "run", "dev"]
