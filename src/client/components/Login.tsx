import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AuthContainer } from '@/client/components/AuthContainer'
import { TextBox } from '@/client/components/ui/TextBox'
import { Button } from '@/client/components/ui/Button'
import api from '@/client/lib/api'

export const Login = () => {
  const [form, setForm] = useState<{
    email: string
    password: string
  }>({
    email: '',
    password: '',
  })

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  const submitAction = async () => {
    const result = await api.login(form.email, form.password)
    if (result.success) {
      window.location.href = '/'
    } else {
      toast.error(result.message || 'Unknown Error')
    }
  }

  return (
    <AuthContainer
      header="Login"
      buttons={
        <div className="flex justify-between items-center">
          <div>
            <span className="mr-2">Don't have an account yet?</span>
            <Link className="link link-secondary" to="/register">
              Create Account
            </Link>
          </div>
          <div className="flex gap-2">
            <Button id="register-submit" color="secondary" size="md" onClick={submitAction}>
              Login
            </Button>
          </div>
        </div>
      }
    >
      <TextBox id="register-email" name="email" label="Email" value={form.email} onChange={onChange} autoFocus />
      <TextBox
        id="register-password"
        name="password"
        password
        label="Password"
        value={form.password}
        onChange={onChange}
      />
    </AuthContainer>
  )
}
