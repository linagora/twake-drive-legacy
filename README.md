<p align="center">
  <a href="https://github.com/linagora/TDrive">
   <img src="https://github.com/linagora/TDrive/assets/14924963/23b216dc-5331-440c-a28d-b07019e90f91" alt="Logo">
  </a>

  <h3 align="center">twakedrive.app (🚀coming soon)</h3>

  <p align="center">
    <b align="center">The open-source alternative to Google Drive.</b>
    <br />
    <a href="https://twake.app"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="https://t.me/+HIWCtSkvTpxiNjcy">Telegram</a>
    |
    <a href="https://twakedrive.app">Website</a>
    |
    <a href="https://github.com/linagora/TDrive/issues">Issues</a>
    |
    <a href="https://github.com/linagora/TDrive/milestones">Roadmap</a>
  </p>
</p>

## About

<img width="100%!" alt="booking-screen" src="https://github.com/linagora/TDrive/assets/14924963/e19079c6-99c4-41f5-83a2-b4ed4a8816d7">

## Getting Started

To get a local copy up and running, please follow these simple steps.

1. Clone the repo
   ```sh
   git clone https://github.com/linagora/TDrive
   ```
2. Run it with Docker
   ```sh
   docker-compose up -d
   ```


## Development

### Prerequisites

- Node.js (Version: >=18.x)
- MongoDB
- Yarn _(recommended)_

### Setup

1. Launch MongoDB using
   ```sh
   docker run -p 27017:27017 -d mongo
   ```

2. Launch frontend with

   ```sh
   cd tdrive/frontend/; yarn dev:start
   ```

3. Launch backend with

   ```sh
   cd tdrive/backend/node/; SEARCH_DRIVER=mongodb DB_DRIVER=mongodb PUBSUB_TYPE=local \
   DB_MONGO_URI=mongodb://localhost:27017 STORAGE_LOCAL_PATH=/[full-path-to-store-documents]/documents \
   NODE_ENV=development yarn dev
   ```
   > If you need more parameters, create/edit ```tdrive/backend/node/config/development.json``` file

6. App will be running on port 3000


## License

Tdrive is licensed under [Affero GPL v3](https://github.com/linagora/TDrive/blob/main/LICENSE)
