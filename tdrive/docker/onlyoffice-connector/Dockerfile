FROM node:16

WORKDIR /usr/src/app

COPY connectors/onlyoffice-connector/package*.json ./
RUN npm install

COPY connectors/onlyoffice-connector/ .
RUN npm run build

CMD [ "npm", "start" ]