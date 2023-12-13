
## About

This is a service for migrating date from Nextcloud to Twake Drive

## Development

1. To build image locally
   ```sh
   docker build -t twakedrive/tdrive-nextcloud-migration -f docker/tdrive-nextcloud-migration/Dockerfile .
   ```
2. Run it with Docker
   ```sh
   docker run -p 4001:4001 \
     -e SERVER_PORT=4001 \
     -e LDAP_BASE=dc=example,dc=com \
     -e LDAP_HOST=ldap.twake.app \
     -e LDAP_PORT=389 \
     -e TMP_DIR=/tmp \
     -e NEXTCLOUD_URL=https://nextcloud.fr \
      twakedrive/tdrive-nextcloud-migration
   ```

2. Request example
   ```sh
   curl -X POST --data "username=luke&password=iamyourfather" http://localhost:4001/
   ```
