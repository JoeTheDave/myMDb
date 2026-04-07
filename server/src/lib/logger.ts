import pino from 'pino'

const isDevelopment = process.env['NODE_ENV'] === 'development'
const isTest = process.env['NODE_ENV'] === 'test'

export const logger = isDevelopment
  ? pino({ level: 'info', transport: { target: 'pino-pretty' } })
  : pino({ level: isTest ? 'silent' : 'info' })
