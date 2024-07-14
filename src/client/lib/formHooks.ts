import { useState } from 'react'

export const useForm = <T extends Record<string, any>>(data: T) => {
  const [form, setForm] = useState<T>(data)

  const formNames = Object.keys(data).reduce((acc, key) => {
    acc[key as keyof T] = key
    return acc
  }, {} as Record<keyof T, string>)

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  return { form, setForm, onChange, formNames }
}
