/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types */
import {
  logger,
  TdriveComponent,
  TdriveContext,
  TdriveServiceFactory,
  TdriveServiceState,
} from "../index";
import { Loader } from "./loader";

export async function buildDependenciesTree(
  components: Map<string, TdriveComponent>,
  loadComponent: (name: string) => any,
): Promise<void> {
  for (const [name, component] of components) {
    const dependencies: string[] = component.getServiceInstance().getConsumes() || [];

    for (const dependencyName of dependencies) {
      if (name === dependencyName) {
        throw new Error(`There is a circular dependency for component ${dependencyName}`);
      }
      let dependencyComponent = components.get(dependencyName);

      if (!dependencyComponent) {
        //Except in the tests, we allow this to happen with a warning
        if (process.env.NODE_ENV === "test") {
          throw new Error(
            `The component dependency ${dependencyName} has not been found for component ${name}`,
          );
        } else {
          logger.warn(
            `(warning) The component dependency ${dependencyName} has not been found for component ${name} it will be imported asynchronously`,
          );

          try {
            dependencyComponent = await loadComponent(name);
            if (dependencyComponent) components.set(name, dependencyComponent);
          } catch (err) {
            dependencyComponent = null;
          }

          if (!dependencyComponent) {
            throw new Error(
              `The component dependency ${dependencyName} has not been found for component ${name} even with async load`,
            );
          }
        }
      }

      component.addDependency(dependencyComponent);
    }
  }
}

/**
 * Load specified components from given list of paths
 *
 * @param paths Paths to search components in
 * @param names Components to load
 * @param context
 */
export async function loadComponents(
  paths: string[],
  names: string[] = [],
  context: TdriveContext,
): Promise<Map<string, TdriveComponent>> {
  const result = new Map<string, TdriveComponent>();
  const loader = new Loader(paths);

  const components: TdriveComponent[] = await Promise.all(
    names.map(async name => {
      const clazz = await loader.load(name);
      const component = new TdriveComponent(name, { clazz, name });
      result.set(name, component);

      return component;
    }),
  );

  await Promise.all(
    components.map(async component => {
      const service = await TdriveServiceFactory.create(
        component.getServiceDefinition().clazz,
        context,
        component.getServiceDefinition().name,
      );

      component.setServiceInstance(service);
    }),
  );

  return result;
}

export async function switchComponentsToState(
  components: Map<string, TdriveComponent>,
  state: TdriveServiceState.Initialized | TdriveServiceState.Started | TdriveServiceState.Stopped,
): Promise<void> {
  const states = [];

  for (const [name, component] of components) {
    logger.info(`Asking for ${state} on ${name} dependencies`);
    states.push(component.getServiceInstance().state);
    await component.switchToState(state);
  }

  logger.info(`All components are now in ${state} state`);
}
