# Use an official Node.js runtime as the base image
FROM node:bullseye

run apt update && apt -y dist-upgrade
RUN apt install dirmngr

RUN echo "deb http://ppa.launchpad.net/nextcloud-devs/client/ubuntu zesty main" >> /etc/apt/sources.list.d/nextcloud-client.list
RUN echo "deb-src http://ppa.launchpad.net/nextcloud-devs/client/ubuntu zesty main" >> /etc/apt/sources.list.d/nextcloud-client.list

RUN apt-key adv --recv-key --keyserver keyserver.ubuntu.com AD3DD469

RUN apt update

RUN apt install --assume-yes nextcloud-desktop-cmd

RUN apt install ldap-utils

RUN apt autoremove && apt clean && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy app
COPY backend/utils/nextcloud-migration/src/** ./src/
COPY backend/utils/nextcloud-migration/.nvmrc ./
COPY backend/utils/nextcloud-migration/*.json ./

RUN npm i && npm run build

# Run the Node.js application
CMD ["npm", "run", "start"]
