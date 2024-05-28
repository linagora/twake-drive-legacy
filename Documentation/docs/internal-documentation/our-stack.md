---
description: Here is the list of our middlewares and their usages.
---

# 📚 Our stack

Write an article describing our stack at Twake Drive composed of:

- In full mode a docker containing: node, react behind nginx, Open Search, PostgreSQL, redis, rabbitmq
- In simple mode a docker containing: node, react and mongodb for db and search

### Simple mode

The simple mode of Twake Drive messaging app is designed for quick setup and development purposes. It is a more straightforward mode that uses a single container to deploy the components. The technical stack of this mode includes the following components:

- Node: A JavaScript runtime environment used to develop server-side applications.
- React: A JavaScript library used to build user interfaces.
- MongoDB: A cross-platform document-oriented database used to store and retrieve data.

The simple mode is great for companies that want a quick and easy setup for their messaging app. It requires less technical expertise and is ideal for small to medium-sized businesses.

### Full mode

The full mode of Twake Drive messaging app is designed to handle large-scale production loads with more than 1000 active users. It uses a container-based approach to deploy the components and ensure scalability. The technical stack of this mode includes the following components:

- Node: A JavaScript runtime environment used to develop server-side applications.
- React: A JavaScript library used to build user interfaces.
- Nginx: A web server used as a reverse proxy to distribute incoming requests to the appropriate backend service.
- OpenSearch: A distributed search and analytics engine used to perform advanced search operations.
- PostgreSQL: An advanced, open-source relational database management system known for its extensibility, SQL compliance, and robust performance.
- Redis: An in-memory data structure store used to implement caching, messaging, and pub/sub functionalities.
- Rabbitmq: An open-source message broker used to transmit messages between applications.

The full mode is ideal for companies with large-scale deployment requirements but requires more technical expertise to install and maintain the infrastructure.
