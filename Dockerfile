FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=10000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js zugang.js olymp.js spiele.js index.html hub.js hub.css icon.svg datenschutz.html ./
COPY fonts ./fonts
EXPOSE 10000
CMD ["node", "server.js"]
