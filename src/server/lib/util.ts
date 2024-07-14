import { ApiResponse } from '@/shared/types.ts'

export const createResponse = <T>(args: { success?: boolean; message?: string; data?: T }): ApiResponse<T> => {
  const { success, message, data } = args
  return {
    success: success ?? true,
    message: message ?? '',
    data,
  }
}
