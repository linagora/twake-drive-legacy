#!/bin/bash

if [ "$1" = "dev" ]
then
  if test -f "/tdrive-react/src/app/environment/environment.ts"; then
    echo "Configuration exists, doing nothing."
  else
    cp /tdrive-react/src/app/environment/environment.ts.dist.dev /tdrive-react/src/app/environment/environment.ts
  fi
else
  if test -f "/configuration/environment.ts"; then
    cp /configuration/environment.ts /tdrive-react/src/app/environment/environment.ts
  else
    cp /tdrive-react/src/app/environment/environment.ts.dist /tdrive-react/src/app/environment/environment.ts
  fi
fi

[[ -d "/etc/nginx/sites-enabled" ]] || mkdir /etc/nginx/sites-enabled

function _selfsigned() {
    self-signed.sh
    export NGINX_LISTEN="443 ssl"
    ln -sf /etc/nginx/sites-available/redirect /etc/nginx/sites-enabled/
}

case $SSL_CERTS in
  selfsigned)
    _selfsigned
    ;;
  off|no|non|none|false)
    export NGINX_LISTEN="80"
    sed -i '/ *ssl_/d' /etc/nginx/sites-available/site.template
    ;;
  *)
    echo "SSL_CERTS var not defined setting selfsigned"
    export SSL_CERTS=selfsigned
    _selfsigned
    ;;
esac

NODE_HOST="${NODE_HOST:-http://node:3000}"
export NODE_HOST
envsubst '$${NODE_HOST} $${NGINX_LISTEN}' < /etc/nginx/sites-available/site.template > /etc/nginx/sites-enabled/site

nginx -g "daemon off;"
