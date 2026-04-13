import { z } from 'zod'

export const focalPointSchema = z.number().finite().min(0).max(100)
