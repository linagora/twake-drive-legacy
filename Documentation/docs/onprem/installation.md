# 🏗 Install on your server

## Use Twake Drive in SaaS

You can test or use Twake Drive in our SaaS : [chat.tdrive.app](https://chat.tdrive.app)

## Run Twake Drive in your server

1. First you'll need to [install docker and docker-compose](https://docs.docker.com/compose/install/).

2. Then you can install Twake Drive on your server with this command

```
git clone git@github.com:linagora/twake-drive.git
cd tdrive/tdrive
docker-compose -f docker-compose.onpremise.mongo.yml up -d
```

Twake Drive will be running on port 3000

### What's next ?

If you kept the default configuration, you can simply follow the signup steps, no email verification is required by default so you will get into Twake Drive right after the signup steps.

## Ship Twake Drive in production

See how to [manage configuration](./configuration/index.md)). And then how to [update security keys](./configuration/security.md).

### Update Twake Drive

```
docker-compose stop
docker-compose rm #Remove images (not volumes so your data is safe)
docker-compose pull #Get new images
docker-compose up -d
docker-compose exec nginx yarn build #If you have custom frontend configuration
```

## Requirements and scalability

Currently you'll need at least a **2 cpu + 4 gb of ram** machine for **20-50 users** depending on their usage and with ElasticSearch disabled.

If you enable ElasticSearch, use two machines, or limit the cpu/ram dedicated to it and use a larger machine (at least 2gb of ram and 1 cpu dedicated to ES for 20-50 users).

If you need to deploy Twake Drive for more users, you can use only one big machine up to 500 users (Will need something like **12 cpu and 32go of ram**), then you'll need to use multiple nodes.

---

# 🎡 Scale with Twake Drive
<!-- TODO[NOT UP TO DATE] -->
> We deployed Twake Drive on production for companies of 10 to 50 users in a single node. We also deployed Twake Drive in a scalable mode and we support currently thousands of concurrent users.
> If you deploy Twake Drive in your own company we would love to have your feedback here [https://github.com/TDriveApp/TDrive/issues/289](https://github.com/TDriveApp/TDrive/issues/289) to improve our requirements documentation.
> Now if you want to scale with Twake Drive and support thousand of users, continue reading.

Scaling with Twake Drive is possible if you install Twake Drive with **RabbitMQ, Redis, ElasticSearch and ScyllaDB**.

```
git clone git@github.com:linagora/twake-drive.git
cd twake-drive/tdrive

cp -n docker-compose.yml.dist.onpremise docker-compose.yml
cp -nR default-configuration/ configuration/

docker-compose pull

docker-compose up -d scylladb
sleep 5m #Wait scylladb to startup
docker-compose up -d php rabbitmq
sleep 10m #Wait php to create tables in scylladb

docker-compose up -d
```

> To run ElasticSearch (optional, but enabled by default in the Twake Drive docker-compose) you must increase the max_map_count of your system: [https://www.elastic.co/guide/en/elasticsearch/reference/current/docker.html#\_set_vm_max_map_count_to_at_least_262144](https://www.elastic.co/guide/en/elasticsearch/reference/current/docker.html#_set_vm_max_map_count_to_at_least_262144)
>
> To fix an other bug with ElasticSearch container, you must also run this command: `chmod 777 ./docker-data/es_tdrive` (create the folder if it doesn't exists in your docker-compose.yml folder)

Twake Drive will be running on port 8000 🎉
