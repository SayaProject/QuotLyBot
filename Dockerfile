FROM node:22-bookworm

WORKDIR /app

# Install dependencies for native modules
RUN apt-get update && apt-get install -y \
    build-essential \
    libvips-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source
COPY . .

# Default command for Railway and other single-container hosts.
CMD ["npm", "start"]
