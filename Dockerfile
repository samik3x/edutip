FROM node:20-slim

# Install build tools required for better-sqlite3 compilation on Linux
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Ensure /data exists for Railway volume storage
RUN mkdir -p /data

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
