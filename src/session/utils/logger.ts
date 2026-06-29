export type Logger = {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
};

const logWith =
  (level: "debug" | "info" | "warn" | "error") =>
  (message: string, meta?: unknown) => {
    const write = level === "debug" ? console.info : console[level];
    if (meta !== undefined) {
      write(message, meta);
      return;
    }
    write(message);
  };

export const consoleLogger: Logger = {
  debug: logWith("debug"),
  info: logWith("info"),
  warn: logWith("warn"),
  error: logWith("error"),
};
