FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 5173

# Start dev server (bind to 0.0.0.0 for Docker)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
