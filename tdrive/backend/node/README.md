# Tdrive backend

## Developer guide

### Getting started

1. Clone and install dependencies (assumes that you have Node.js 12 and npm installed. If not, we suggest to use [nvm](https://github.com/nvm-sh/nvm/)):

```sh
git clone git@github.com:Tdrive/Tdrive.git
cd Tdrive/Tdrive/backend/node
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

The Twake backend CLI

The Twake backend CLI provides a set of commands to manage/use/develop Tdrive from the `twake-cli` executable.
Before using the CLI, you must `compile` Tdrive with `npm run build`. Once done, you can get help on on any command with the `--help` flag like `bin/twake-cli --help`.

To have prettied output when using verbose, you can use the npm script instead, (but don't forget the `--` before
arguments): `npm run cli -- --help`. You still need to compile the cli separately.

It uses the same configuration as the Tdrive backend application. Including environment variables and the `./config/default.json` file.

#### The 'search index' command

This command re-indexes entities of the given repository from the database to the search service.

```sh
bin/twake-cli search index --repository users --repairEntities
```

- The `--repairEntities` flag means different actions for different repositories, see the output of `--help` for more details.

#### Bash completion

It's a bit awkward to do real completion from a configuration since this isn't really a node module we recommend to install globally.
This should setup a shell if you're in the right path however. It's yarg's auto generated completion though; so eg: it mixes up commands and
choices (or we're using it wrong).

```sh
eval "$(bin/twake-cli completion)"
```

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

#### Realtime Technical Service

The framework provides simple way to create CRUD Services which will notify clients using Websockets by following some conventions:

1. The service must implement the `CRUDService` generic interface
2. In order to push notification to clients, Typescript decorators must be added on methods (Create, Update, Delete methods)

For example, let's say that we want to implement a CRUD Service for `messages`:

```js
import {
  CRUDService,
  CreateResult,
  DeleteResult,
  UpdateResult,
  EntityId,
} from "@/core/platform/framework/api/crud-service";

class Message {
  text: string;
  createdAt: Date;
  author: string;
}

class MessageService implements CRUDService<Message> {
  async create(item: Message): Promise<CreateResult<Message>> {
    // save the message then return a CreateResult instance
  }

  async get(id: EntityId): Promise<Message> {
    // get the message from its ID and return it
  }

  async update(id: EntityId, item: Message): Promise<UpdateResult<Message>> {
    // update the message with the given id, patch it with `item` values
    // then return an instance of UpdateResult
  }

  async delete(id: EntityId): Promise<DeleteResult<Message>> {
    // delete the message from its id then return a DeleteResult instance
  }

  async list(): Promise<Message[]> {
    // get a list of messages
  }
}
```

By implementing the CRUD service following the API, we can now add realtime message to clients connected to Websocket on a selected collection of CRUD operations. For example, if we want to just notify when a `message` is created, we just have to add the right decorator on the `create` method like:

```js
import { RealtimeCreated } from "@/core/platform/framework/decorators";

// top and bottom code removed for clarity
class MessageService implements CRUDService<Message> {

  @RealtimeCreated<Message>({
    room: "/messages",
    path: message => `/messages/${message.id}`
  })
  async create(item: Message): Promise<CreateResult<Message>> {
    // save the message then return a CreateResult instance
    const created: Message = new Message(/* */);

    return new CreateResult<Message>("message", created)
  }
  // ...
}
```

The `RealtimeCreated` decorator will intercept the `create` call and will publish an event in an internal event bus with the creation result, the input data and the `"/messages"` path. On the other side of the event bus, an event listener will be in charge of delivering the event to the right Websocket clients as described next.

The Realtime\* decorators to add on methods to intercept calls and publish data are all following the same API.
A decorator takes two parameters as input:

- First one is the room name to publish the notification to (`/messages` in the example above)
- Second one is the full path of the resource linked to the action (`message => /messages/${message.id}` in the example above)

Both parameters can take a string or an arrow function as parameter. If arrow function is used, the input parameter will be the result element. By doing this, the paths can be generated dynamically at runtime.

#### Websocket Technical Service

Services annotated as described above automatically publish events to WebSockets. Under the hood, it uses Socket.IO rooms to send events to the right clients.

##### Authentication

- Client have to provide a valid JWT token to be able to connect and be authenticated by providing it as string in the `authenticate` event like `{ token: "the jwt token value" }`
- If the JWT token is valid, the client will receive a `authenticated` event
- If the JWT token is not valid or empty, the client will receive a `unauthorized` event

**Example**

```js
const io = require("socket.io-client");

// Get a JWT token from the Tdrive API first
const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOjEsImlhdCI6MTYwMzE5ODkzMn0.NvQoV9KeWuTNzRvzqbJ5uZCQ8Nmi2rCYQzcKk-WsJJ8";
const socket = io.connect("http://localhost:3000", { path: "/socket" });

socket.on("connect", () => {
  socket
    .emit("authenticate", { token })
    .on("authenticated", () => {
      console.log("User Authenticated");
    })
    .on("unauthorized", err => {
      console.log("User is not authorized", err);
    });
});

socket.on("disconnected", () => console.log("Disconnected"));
```

##### Joining rooms

CRUD operations on resources are pushing events in Socket.io rooms. In order to receive events, clients must subscribe to rooms by sending an `realtime:join` on an authenticated socket with the name of the room to join and with a valid JWT token like `{ name: "room name", token: "the jwt token for this room" }`: Users can not subscribe to arbitratry rooms, they have to be authorized to.

As a result, the client will receive events:

- `realtime:join:success` when join is succesful with data containing the name of the linked room like `{ name: "room" }`.
- `realtime:join:error` when join failed with data containing the name of the linked room and the error details like `{ name: "room", error: "some error message" }`.

**Example**

```js
const io = require("socket.io-client");

const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOjEsImlhdCI6MTYwMzE5ODkzMn0.NvQoV9KeWuTNzRvzqbJ5uZCQ8Nmi2rCYQzcKk-WsJJ8";
const socket = io.connect("http://localhost:3000", { path: "/socket" });

socket.on("connect", () => {
  socket
    .emit("authenticate", { token })
    .on("authenticated", () => {
      // join the /channels room
      socket.emit("realtime:join", { name: "/channels", token: "tdrive" });
      socket.on("realtime:join:error", message => {
        // will fire when join does not provide a valid token
        console.log("Error on join", message);
      });

      // will be fired on each successful join.
      // As event based, this event is not linked only to the join above
      // but to all joins. So you have to dig into the message to know which one
      // is successful.
      socket.on("realtime:join:success", message => {
        console.log("Successfully joined room", message.name);
      });
    })
    .on("unauthorized", err => {
      console.log("Unauthorized", err);
    });
});

socket.on("disconnected", () => console.log("Disconnected"));
```

##### Leaving rooms

The client can leave the room by emitting a `realtime:leave` event with the name of the room given as `{ name: "the room to leave" }`.

As a result, the client will receive events:

- `realtime:leave:success` when leave is succesful with data containing the name of the linked room like `{ name: "room" }`.
- `realtime:leave:error` when leave failed with data containing the name of the linked room and the error details like `{ name: "room", error: "some error message" }`.

Note: Asking to leave a room which has not been joined will not fire any error.

**Example**

```js
socket.on("connect", () => {
  socket.emit("authenticate", { token }).on("authenticated", () => {
    // leave the "/channels" room
    socket.emit("realtime:leave", { name: "/channels" });

    socket.on("realtime:leave:error", message => {
      // will fire when join does not provide a valid token
      console.log("Error on leave", message);
    });

    // will be fired on each successful leave.
    // As event based, this event is not linked only to the leave above
    // but to all leaves. So you have to dig into the message to know which one
    // is successful.
    socket.on("realtime:leave:success", message => {
      console.log("Successfully left room", message.name);
    });
  });
});
```

##### Subscribe to resource events

Once the given room has been joined, the client will receive `realtime:resource` events with the resource linked to the event as data:

```json
{
  "action": "created",
  "room": "/channels",
  "type": "channel",
  "path": "/channels/5f905327e3e1626399aaad79",
  "resource": {
    "name": "My channel",
    "id": "5f905327e3e1626399aaad79"
  }
```

**Example:**

```js
socket.on("connect", () => {
  socket
    .emit("authenticate", { token })
    .on("authenticated", () => {
      // join the "/channels" room
      socket.emit("realtime:join", { name: "/channels", token: "tdrive" });

      // will only occur when an action occured on a resource
      // and if and only if the client joined the room
      // in which the resource is linked
      socket.on("realtime:resource", event => {
        console.log("Resource has been ${event.action}", event.resource);
      });
    })
    .on("unauthorized", err => {
      console.log("Unauthorized", err);
    });
});
```
