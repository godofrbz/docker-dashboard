import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// Stelle sicher, dass das logs-Verzeichnis existiert
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'docker-dashboard' },
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        // Verwende einfaches Format für bessere Lesbarkeit in Docker-Logs
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          // Wenn message ein String ist, zeige ihn direkt an
          if (typeof message === 'string') {
            return `${level}: ${message}`;
          }
          // Ansonsten JSON-Format
          return `${level}: ${JSON.stringify({ message, ...meta })}`;
        })
      )
    })
  ]
});



