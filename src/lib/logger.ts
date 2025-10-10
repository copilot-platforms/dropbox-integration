import util from 'node:util'

type LogLevel = 'log' | 'info' | 'warn' | 'error'

export interface Logger {
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

const inspectOptions: util.InspectOptions = {
  depth: null,
  colors: Boolean(process.stdout.isTTY),
}

function formatArg(arg: unknown): string {
  return typeof arg === 'string' ? arg : util.inspect(arg, inspectOptions)
}

function loggerFactory(level: LogLevel): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    const line = args.map(formatArg).join(' ')
    // biome-ignore lint/suspicious/noConsole: only 'log' level will be warned
    console[level](line)
  }
}

export const logger: Logger = {
  log: loggerFactory('log'),
  info: loggerFactory('info'),
  warn: loggerFactory('warn'),
  error: loggerFactory('error'),
}

export default logger
