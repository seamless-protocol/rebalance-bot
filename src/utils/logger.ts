import pino from 'pino';

const createLogger = () => {
  const baseConfig = {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      error: pino.stdSerializers.err, // Use error serializer to properly handle Error objects
    }
  };

  if (process.env.NODE_ENV?.toLowerCase() === 'production') {
    // Production: Raw JSON to stdout
    return pino(baseConfig);
  }

  // Development: Pretty formatted output
  return pino({
    ...baseConfig,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
        messageFormat: '{component} | {msg}'
      }
    }
  });
};

const logger = createLogger();

// Create child loggers for different components
export const createComponentLogger = (component: string) =>
  logger.child({ component });

export default logger;
