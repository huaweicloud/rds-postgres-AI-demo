type Fields = Record<string, unknown>;

export interface Logger {
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(fields: Fields): Logger;
}

// One JSON object per line, so `docker compose logs worker | jq` works.
export function createLogger(base: Fields = {}): Logger {
  const write = (level: string, msg: string, fields?: Fields) => {
    const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...base, ...fields });
    if (level === "error") console.error(line);
    else console.log(line);
  };
  return {
    info: (msg, f) => write("info", msg, f),
    warn: (msg, f) => write("warn", msg, f),
    error: (msg, f) => write("error", msg, f),
    child: (f) => createLogger({ ...base, ...f }),
  };
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
