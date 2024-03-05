# Common node machine
FROM node:lts-alpine as node-base

### Install dependencies
RUN apk add --update-cache \
      ghostscript \
      graphicsmagick \
    && rm -rf /var/cache/apk/*


### Install TDrive
WORKDIR /usr/src/app
COPY backend/node/package*.json ./

# Test Stage
FROM node-base as test

RUN npm install
COPY backend/node/ .

# Add frontend Stage
FROM node-base as installed-libs

COPY backend/node/ .
#Install dev dependancies for build
RUN export NODE_ENV=development
RUN npm install

#Build in production mode
RUN export NODE_ENV=production
RUN npm run build
RUN rm -rf node_modules
#Install prod dependancies after build
RUN npm install --legacy-peer-deps

# Development Stage
FROM installed-libs as development

ENV NODE_ENV=development
RUN npm install -g pino-pretty && \
    npm install -g tsc-watch && \
    yarn install
CMD ["npm", "run", "dev:debug"]

# Production Stage
FROM installed-libs as production

EXPOSE 4000
CMD ["npm", "run", "serve"]
