import * as log from "std/log";
import { blue, red, yellow } from "std/fmt";

export async function setupLogger() {
  await log.setup({
    handlers: {
      console: new log.ConsoleHandler("DEBUG", {
        formatter: (record) => {
          let levelInfo = `[${record.levelName}]`;
          if (record.level === log.LogLevels.INFO) {
            levelInfo = blue(levelInfo);
          } else if (record.level === log.LogLevels.WARN) {
            levelInfo = yellow(levelInfo);
          } else if (record.level === log.LogLevels.ERROR) {
            levelInfo = red(levelInfo);
          } else if (record.level === log.LogLevels.CRITICAL) {
            levelInfo = red(levelInfo);
          }

          return `${levelInfo} ${record.msg}`;
        },
      }),
    },
    loggers: {
      default: {
        level: "DEBUG",
        handlers: ["console"],
      },
    },
  });
}

export function getLogger() {
  return log.getLogger();
}
