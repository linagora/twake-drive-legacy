# Use an official Node.js runtime as the base image
FROM node:bullseye-slim AS updated

RUN apt update && apt -y dist-upgrade
RUN apt install -y gnupg

RUN echo "deb http://ppa.launchpad.net/nextcloud-devs/client/ubuntu zesty main" >> /etc/apt/sources.list.d/nextcloud-client.list
RUN echo "deb-src http://ppa.launchpad.net/nextcloud-devs/client/ubuntu zesty main" >> /etc/apt/sources.list.d/nextcloud-client.list

RUN apt-key adv --recv-key --keyserver keyserver.ubuntu.com AD3DD469

RUN apt update -y

RUN apt install --assume-yes nextcloud-desktop-cmd

RUN apt install -y ldap-utils

RUN apt autoremove && apt clean && rm -rf /var/lib/apt/lists/*

FROM updated

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy app
COPY backend/utils/nextcloud-migration/src/** ./src/
COPY backend/utils/nextcloud-migration/.nvmrc ./
COPY backend/utils/nextcloud-migration/*.json ./
COPY backend/utils/nextcloud-migration/rollup.config.js ./

RUN npm i && npm run build && npm cache clean --force && rm -rf node_modules

# Don't rebuild on start
RUN perl -i -ne 'print unless/prestart/' package.json

# Run the Node.js application
#CMD ["npm", "run", "start"]

FROM updated

COPY --from=1 /usr/src/app/dist/* /
RUN mv express_server.js express_server.mjs

CMD ["node","express_server.mjs"]
