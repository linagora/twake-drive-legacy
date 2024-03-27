# Tdrive backend

## Developer guide

### Getting started

1. Clone and install dependencies (assumes that you have Node.js 12 and npm installed. If not, we suggest to use [nvm](https://github.com/nvm-sh/nvm/)):

```sh
git clone git@github.com:linagora/twake-drive.git
cd twake-drive/tdrive/backend/node
npm install
```

2. Run in developer mode (will restart on each change)

```sh
npm run dev
```

3. Backend is now running and available on [http://localhost:3000](http://localhost:3000)

### Docker

Run all tests

```sh
docker-compose -f ./docker-compose.test.yml up
```

Run specific tests

```sh
docker-compose -f ./docker-compose.test.yml run node npm run test:unit
```

will run unit tests only (`test:unit`). For possible tests to run, check the `package.json` scripts.

### Command Line Interface (CLI)
 
The Tdrive backend CLI provides a set of commands to manage/use/develop Tdrive from the `tdrive-cli` binary.
Before to use the CLI, you must `compile` Tdrive with `npm run build`. Once done, you can get help on on any command with the `--help` flag like `./bin/tdrive-cli console --help`.

#### The 'console merge' command

This command allows to connect to the database configured in the `./config/default.json` file and to "merge" the Tdrive users and companies into the "Tdrive Console".

```sh
./bin/tdrive-cli console merge --url http://console.tdrive.app --client tdrive-app --secret supersecret
```

The simplified console workflow is like (some parts are done in parallel):

1. Get all the companies
2. Iterate over companies and create them in the console side
3. For each company, get all the users
4. Iterate over all the users and create them in the console (if the user is in several companies, create once, add it to all the companies)
5. For each company, get all the admins and choose the oldest one which will be 'marked' as the owner on the console side

At the end of the 'merge', a report will be displayed.

### Component Framework

The backend is developed using a software component approach in order to compose and adapt the platform based on needs and constraints.
The current section describes this approach, and how to extend it by creating new components.

The platform has the following properties:

- A platform is composed of multiple components
- A component has an unique name in the platform
- A component can provide a `service`
- A component can consume `services` from other components
- A component has a lifecycle composed of several states: `ready`, `initialized`, `started`, `stopped`
- A component lifecycle changes when a lifecycle event is triggered by the platform: `init`, `start`, `stop`
- By creating links between components (service producers and consumers), components lifecycles **are also linked together**: A component going from `ready` to `initialized` will wait for all its dependencies to be in `initialized` state. This is automatically handled by the platform.

The platform currently have some limitations:

- Components can not have cyclic dependencies: if `component X` requires a component which requires `component X` directly or in one of its dependencies, the platform will not start
- Components can only have local dependencies.

#### Creating a new component

To create a new component, a new folder must be created under the `src/services` one and an `index.ts` file must export the a class. This class will be instantiated by the platform and will be linked to the required services automatically.

In order to illustrate how to create a component, let's create a fake Notification service.

1. Create the folder `src/services/notification`
2. Create an `index.ts` file which exports a `NotificationService` class

```js
// File src/services/notification/index.ts
import { TdriveService } from "../../core/platform/framework";
import NotificationServiceAPI from "./api.ts";

export default class NotificationService extends TdriveService<NotificationServiceAPI> {
  version = "1";
  name = "notification";
  service: NotificationServiceAPI;

  api(): NotificationServiceAPI {
    return this.service;
  }
}
```

3. Our `NotificationService` class extends the generic `TdriveService` class and we defined the `NotificationServiceAPI` as its generic type parameter. It means that in the platform, the other components will be able to retrieve the component from its name and then consume the API defined in the `NotificationServiceAPI` interface and exposed by the `api` method.
   We need to create this `NotificationServiceAPI` interface which must extend the `TdriveServiceProvider` from the platform like:

```js
// File src/services/notification/api.ts
import { TdriveServiceProvider } from "../../core/platform/framework/api";

export default interface NotificationServiceAPI extends TdriveServiceProvider {

  /**
   * Send a message to a list of recipients
   */
  send(message: string, recipients: string[]): Promise<string>;
}
```

4. Now that the interfaces are defined, we need to create the `NotificationServiceAPI` implementation (this is a dummy implementation which does nothing but illustrates the process):

```js
// File src/services/notification/services/api.ts
import NotificationServiceAPI from "../api";

export class NotificationServiceImpl implements NotificationServiceAPI {
  version = "1";

  async send(message: string, recipients: string[]): Promise<string> {
    return Promise.resolve(`${message} sent`);
  }
}
```

5. `NotificationServiceImpl` now needs to be instanciated from the `NotificationService` class since this is where we choose to keep its reference and expose it. There are several places which can be used to instanciate it, in the constructor itself, or in one of the `TdriveService` lifecycle hooks. The `TdriveService` abstract class has several lifecycle hooks which can be extended by the service implementation for customization pusposes:

- `public async doInit(): Promise<this>;` Customize the `init` step of the component. This is generally the place where services are instanciated. From this step, you can retrieve services consumed by the current component which have been already initialized by the platform.
- `public async doStart(): Promise<this>;` Customize the `start` step of the component. You have access to all other services which are already started.

```js
// File src/services/notification/index.ts
import { TdriveService } from "../../core/platform/framework";
import NotificationServiceAPI from "./api.ts";
import NotificationServiceImpl from "./services/api.ts";

export default class NotificationService extends TdriveService<NotificationServiceAPI> {
  version = "1";
  name = "notification";
  service: NotificationServiceAPI;

  api(): NotificationServiceAPI {
    return this.service;
  }

  public async doInit(): Promise<this> {
    this.service = new NotificationServiceImpl();

    return this;
  }
}
```

6. Now that the service is fully created, we can consume it from any other service in the platform. To do this, we rely on Typescript decorators to define the links between components. For example, let's say that the a `MessageService` needs to call the `NotificationServiceAPI`, we can create the link with the help of the `@Consumes` decorator and get a reference to the `NotificationServiceAPI` by calling the `getProvider` on the component context like:

```js
import { TdriveService, Consumes } from "../../core/platform/framework";
import MessageServiceAPI from "./providapier";
import NotificationServiceAPI from "../notification/api";

@Consumes(["notification"])
export default class MessageService extends TdriveService<MessageServiceAPI> {

  public async doInit(): Promise<this> {
    const notificationService = this.context.getProvider<NotificationServiceAPI>("notification");

    // You can not call anything defined in the NotificationServiceAPI interface from here or from inner services by passing down the reference to notificationService.
  }
}
```

#### Configuration

The platform and services configuration is defined in the `config/default.json` file. It uses [node-config](https://github.com/lorenwest/node-config) under the hood and to configuration file inheritence is supported in the platform.

The list of services to start is defined in the `services` array like:

```json
{
  "services": ["auth", "user", "channels", "webserver", "websocket", "database", "realtime"]
}
```

Then each service can have its own configuration block which is accessible from its service name i.e. `websocket` service configuration is defined in the `websocket` element like:

```json
{
  "services": ["auth", "user", "channels", "webserver", "websocket", "orm"],
  "websocket": {
    "path": "/socket",
    "adapters": {
      "types": [],
      "redis": {
        "host": "redis",
        "port": 6379
      }
    }
  }
}
```

On the component class side, the configuration object is directly accessible from the `configuration` property like:

```js
export default class WebSocket extends TdriveService<WebSocketAPI> {
  async doInit(): Promise<this> {
    // get the "path" value, defaults to "/socket" if not defined
    const path = this.configuration.get < string > ("path", "/socket");

    // The "get" method is generic and can accept custom types like
    const adapters = this.configuration.get < AdaptersConfiguration > "adapters";
  }
}

interface AdaptersConfiguration {
  types: Array<string>;
  redis: SocketIORedis.SocketIORedisOptions;
}
```

### Platform

The Tdrive Platform is built using the component framework described just before and so, is composed of several technical services on which business services can rely on to provide a micro-services based platform.

The current chapter describes the technical services of the plaform, how to use them, how to build business services on top of them...

Current technical services are located in `src/core/platform/services`:

- `auth`: To manage authentication
- `database`: To manage database connections
- `realtime`: To provide realtime notification on platform resources
- `webserver`: To expose services as REST ones
- `websocket`: To communicate between client and server using websockets

#### Database Technical Service

Database technical service provides an abstraction layer over several databases to get a connection through the help of drivers and to use them in any other services.

Supported databases are currently [MongoDB](https://www.mongodb.com/) and [Cassandra](https://cassandra.apache.org/). Switching from one to other one is achieved from the database configuration document by switching the `database.type` flag:

```json
{
  "database": {
    "type": "cassandra",
    "mongodb": {
      "uri": "mongodb://localhost:27017",
      "database": "tdrive"
    },
    "cassandra": {
      "contactPoints": ["localhost:9042"],
      "localDataCenter": "datacenter1",
      "keyspace": "tdrive"
    }
  }
}
```

In the example above, the `type` is set to `cassandra`, so the `database.cassandra` document will be used to connect to cassandra.

##### Cassandra
<!-- TODO[NOT UP TO DATE] -->
In order to use Cassandra, we will have to:

1. Create a keyspace. From the configuration above, the keyspace is `tdrive`
2. Create all the required tables

To achieve these steps, you have to use [cqlsh](https://cassandra.apache.org/doc/latest/tools/cqlsh.html) from a terminal then:

1. Create the keyspace:

```sh
CREATE KEYSPACE tdrive WITH replication = {'class': 'NetworkTopologyStrategy', 'datacenter1': '2'} AND durable_writes = true;
```

2. Create the required tables

```sh
USE tdrive;

CREATE TABLE channels(company_id uuid, workspace_id uuid, id uuid, archivation_date date, archived boolean, channel_group text, description text, icon text, is_default boolean, name text, owner uuid, visibility text, PRIMARY KEY ((company_id, workspace_id), id));
```

##### MongoDB

There are no special steps to achieve to use MongoDB.