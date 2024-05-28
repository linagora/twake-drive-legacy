---
description: >-
  You want to add new routes in an existing service, for instance add a feature
  to our channel service ? You are in the right place !
---

# What is a service in Twake Drive ?

The backend is developed using a **software component approach** in order to compose and adapt the platform based on needs and constraints. The current section describes this approach, and how to extend it by creating new components.

The platform has the following properties:

- A platform is composed of multiple components
- A component has an unique name in the platform
- A component can provide a `service`
- A component can consume `services` from other components
- A component has a lifecycle composed of several states: `ready`, `initialized`, `started`, `stopped`
- A component lifecycle changes when a lifecycle event is triggered by the platform: `init`, `start`, `stop`
- By creating links between components \(service producers and consumers\), components lifecycles **are also linked together**: A component going from `ready` to `initialized` will wait for all its dependencies to be in `initialized` state. This is automatically handled by the platform.

The platform currently have some limitations:

- Components can not have cyclic dependencies: if `component X` requires a component which requires `component X` directly or in one of its dependencies, the platform will not start
- Components can only have local dependencies.

## Discover what is in a service

To unfold the internal ways of services in Twake Drive, we will follow a simple request journey into our framework.

1. The requests starts from Twake Drive Frontend or Postman for instance,
2. it then goes to a controller which validate the request parameters and extract them for the services,
3. the services uses the given parameters to get/set entities in database and returns a proper reply.

### /web/controllers : where everything starts

This is where you declare the routing you want to use.

### /services : where the magic happen

This is where you work for real, calling databases, sending events, using tasks pushers etc.

### /entities : where we keep the data

If you store data, you must define its data model and how it is stored in our database middleware.

::: danger
This document is not finished, you can contribute to it on our Github.
:::
