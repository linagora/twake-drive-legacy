import { platformLogger } from "../logger";
import fs from "fs";

export class Loader {
  constructor(readonly paths: string[]) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async load(componentName: string): Promise<any> {
    const modulesPaths = this.paths.map(path => `${path}/${componentName}`);

    let classes = await Promise.all(
      modulesPaths.map(async modulePath => {
        if (fs.existsSync(modulePath)) {
          try {
            return await import(modulePath);
          } catch (err) {
            platformLogger.error(
              { err },
              `${modulePath} can not be loaded (file was found but we were unable to import the module)`,
            );
          }
        }
      }),
    );

    classes = classes.filter(Boolean);

    if (!classes || !classes.length) {
      modulesPaths.map(modulePath => {
        if (fs.existsSync(modulePath)) {
          platformLogger.debug(
            `${modulePath} content was: [${fs.readdirSync(modulePath).join(", ")}]`,
          );
        }
      });
      throw new Error(
        `Can not find or load ${componentName} in any given path [${modulesPaths.join(
          " - ",
        )}] see previous logs for more details.`,
      );
    }

    platformLogger.debug(`Loaded ${componentName}`);

    return classes[0].default;
  }
}
