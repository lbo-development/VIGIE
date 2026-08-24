# Dockerfile de développement — hot reload via volume monté par docker-compose.
# Pour un déploiement (Railway), railway.json + npm run build / start sont utilisés
# directement sans passer par ce Dockerfile.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]
