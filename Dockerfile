FROM node:20-alpine
WORKDIR /app
COPY backend/package.json .
RUN npm install --omit=dev
COPY backend/src/ src/
EXPOSE 3000
CMD ["node", "src/server.js"]
