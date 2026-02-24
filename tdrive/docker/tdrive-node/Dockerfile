# Common node machine
FROM node:22-alpine AS node-base

### Install dependencies
RUN apk add --update-cache \
      ghostscript \
      graphicsmagick \
      curl \
    && rm -rf /var/cache/apk/*


### Install TDrive
WORKDIR /usr/src/app
COPY backend/node/package*.json ./

# Test Stage
FROM node-base AS test

RUN npm install
COPY backend/node/ .

# Add frontend Stage
FROM node-base AS installed-libs

COPY backend/node/ .
#Install dev dependancies for build
ENV NODE_ENV=development
RUN npm ci

#Build in production mode
ENV NODE_ENV=production
RUN npm run build
RUN rm -rf node_modules
#Install prod dependancies after build
RUN npm ci --legacy-peer-deps

# Development Stage
FROM installed-libs AS development

ENV NODE_ENV=development
RUN npm install -g pino-pretty && \
    npm install -g tsc-watch && \
    npm ci
CMD ["npm", "run", "dev:debug"]

# Production Stage
FROM installed-libs AS production

EXPOSE 4000
CMD ["npm", "run", "serve"]
