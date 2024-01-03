# Common node machine
FROM node:lts as node-base

### Install dependancies
RUN apt-get update && \
    apt-get install -y ghostscript graphicsmagick wget unoconv libxml2-dev ffmpeg python-is-python3 && \
    # upgrade unoconv
    wget -N https://raw.githubusercontent.com/dagwieers/unoconv/master/unoconv -O /usr/bin/unoconv && \
    chmod +x /usr/bin/unoconv
#Docker mac issue
# RUN apt-get update && apt-get install -y libc6
# RUN ln -s /lib/libc.musl-x86_64.so.1 /lib/ld-linux-x86-64.so.2

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
