FROM node:18-alpine AS base

WORKDIR /app

COPY package.json ./

RUN npm install --production

COPY . .

EXPOSE 3850

ENV NODE_ENV=production

CMD ["npm", "start"]
