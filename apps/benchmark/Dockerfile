FROM node:20-slim

WORKDIR /workspace

# Copy the package
COPY packages/nuxt-auto-api ./packages/nuxt-auto-api

# Build the package
WORKDIR /workspace/packages/nuxt-auto-api
RUN npm install
RUN npm run prepack

# Copy the app
COPY benchmark/app /workspace/benchmark/app

WORKDIR /workspace/benchmark/app

# Install dependencies
RUN npm install

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

# Run seed and then start the server
# using jiti to execute the typescript seed file directly
CMD mkdir -p .data && npm run db:push && npx jiti ./server/database/seed.ts && node .output/server/index.mjs
