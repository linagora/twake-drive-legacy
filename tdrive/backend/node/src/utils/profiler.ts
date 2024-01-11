import fs from "fs";
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

export default Profiler;
