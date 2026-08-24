# Dockerfile de développement — hot reload via volume monté par docker-compose.
# Pour un build de production, utiliser plutôt un Dockerfile multi-stage avec
# "npm run build" puis un serveur statique (nginx, etc.), non fourni ici.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
