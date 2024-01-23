import fs from "fs";
import fp from "fastify-plugin";
import v8profiler from "v8-profiler-next";

export class Profiler {
  title: string;
  active: boolean;
  outputDir: string;
  constructor(options) {
    const { title, active, outputDir } = options;
    this.title = title;
    this.active = active;
    this.outputDir = outputDir;
  }

  start() {
    if (this.active) {
      v8profiler.startProfiling(this.title, true);
    }
  }

  finish() {
    if (this.active) {
      const profile = v8profiler.stopProfiling(this.title);
      if (profile === undefined) {
        console.log("profile is undefined: ", this.title);
        return;
      }
      profile.export((error, result) => {
        if (error) {
          console.log("Profiling error: ", error);
        } else {
          fs.writeFileSync(`${process.cwd()}/${this.outputDir}/${this.title}.cpuprofile`, result);
        }
      });
    }
  }
}

async function profilerPlugin(fastify, options) {
  fastify.addHook("onRequest", async request => {
    const profiler = new Profiler({
      title: `${request.method}-${request.url}`,
      active: options.active,
      outputDir: options.outputDir || "profiles",
    });

    profiler.start();

    // Attach profiler to request for access in routes or other hooks
    request.profiler = profiler;
  });

  fastify.addHook("onResponse", async request => {
    if (request.profiler) {
      request.profiler.finish();
    }
  });
}

export default fp(profilerPlugin);
