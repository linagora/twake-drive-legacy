# Use an official Node.js runtime as the base image
FROM node:lts-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy app
COPY backend/utils/ldap-sync/*.json ./
COPY backend/utils/ldap-sync/src/** ./src/
COPY backend/utils/ldap-sync/.nvmrc ./

RUN npm i && npm run build

# Run the Node.js application
CMD ["npm", "run", "sync"]
