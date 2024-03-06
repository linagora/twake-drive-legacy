# First stage: building frontend
FROM node:lts-alpine AS build

RUN yarn global add webpack webpack-cli
COPY frontend /tdrive-react/

WORKDIR /tdrive-react/

ENV GENERATE_SOURCEMAP=false
RUN cp /tdrive-react/src/app/environment/environment.ts.dist /tdrive-react/src/app/environment/environment.ts && \
    yarn install --network-timeout 1000000000 && \
    # cat /tdrive-react/src/app/environment/environment.ts.dist && \
    # cat /tdrive-react/src/app/environment/environment.ts && \
    yarn build && \
    rm -rf node_modules

# Second stage: configuring nginx and copying build artifacts
FROM nginx:latest
COPY docker/tdrive-frontend/nginx.conf /etc/nginx/nginx.conf
COPY docker/tdrive-frontend/site.conf /etc/nginx/sites-available/site.template
COPY docker/tdrive-frontend/redirect.conf /etc/nginx/sites-available/redirect
COPY docker/tdrive-frontend/entrypoint.sh /
COPY docker/tdrive-frontend/self-signed.sh /usr/local/bin/
COPY --from=build /tdrive-react /tdrive-react

RUN chmod +x /entrypoint.sh && rm /etc/nginx/conf.d/default.conf

ENTRYPOINT ["/entrypoint.sh", "$DEV"]

EXPOSE 80
EXPOSE 443
