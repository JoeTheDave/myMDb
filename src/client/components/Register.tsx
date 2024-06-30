import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AuthContainer } from '@/client/components/AuthContainer'
import { TextBox } from '@/client/components/ui/TextBox'
import { Button } from '@/client/components/ui/Button'
import { validateEmail, validatePassword } from '@/shared/utils'
import api from '@/client/lib/api'

export const Register = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState<{
    email: string
    password: string
    confirm: string
  }>({
    email: '',
    password: '',
    confirm: '',
  })
  const [formErrors, setFormErrors] = useState<{
    email: string
    password: string
    confirm: string
  }>({
    email: '',
    password: '',
    confirm: '',
  })

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  const validatePasswordConfirmation = (password: string, passwordConfirmation: string) => {
    if (!password && !passwordConfirmation) {
      return 'Password confirmation is required.'
    } else if (password !== passwordConfirmation) {
      return 'Password and password confirmation must match.'
    } else {
      return ''
    }
  }

  const submitAction = async () => {
    const emailValidation = validateEmail(form.email)
    const passwordValidation = validatePassword(form.password)
    const passwordConfirmationValidation = validatePasswordConfirmation(form.password, form.confirm)

    setFormErrors({
      email: emailValidation,
      password: passwordValidation,
      confirm: passwordConfirmationValidation,
    })

    if (!emailValidation && !passwordValidation && !passwordConfirmationValidation) {
      const result = await api.createAccount(form.email, form.password)
      if (result.success) {
        toast.success('Account Created Successfully.')
        setTimeout(() => {
          navigate('/login')
        }, 500)
      } else {
        toast.error(result.message || 'Unknown Error')
      }
    }
  }

  return (
    <AuthContainer
      header="Create Account"
      buttons={
        <div className="flex justify-between items-center">
          <div>
            <span className="mr-2">Already have an account?</span>
            <Link className="link link-secondary" to="/login">
              Login
            </Link>
          </div>
          <div className="flex gap-2">
            <Button id="register-submit" submit color="secondary" size="md">
              Create Account
            </Button>
          </div>
        </div>
      }
      submitAction={submitAction}
    >
      <TextBox
        id="register-email"
        name="email"
        label="Email"
        autoFocus
        value={form.email}
        onChange={e => {
          onChange(e)
          setFormErrors({ ...formErrors, email: '' })
        }}
        onBlur={() => {
          const validationError = validateEmail(form.email)
          setFormErrors({ ...formErrors, email: validationError })
        }}
        error={formErrors.email}
      />
      <TextBox
        id="register-password"
        name="password"
        password
        label="Password"
        value={form.password}
        onChange={e => {
          onChange(e)
          setFormErrors({ ...formErrors, password: '' })
        }}
        onBlur={() => {
          const validationError = validatePassword(form.password)
          setFormErrors({ ...formErrors, password: validationError })
        }}
        error={formErrors.password}
      />
      <TextBox
        id="register-confirm-password"
        name="confirm"
        password
        label="Confirm Password"
        value={form.confirm}
        onChange={e => {
          onChange(e)
          setFormErrors({ ...formErrors, confirm: '' })
        }}
        onBlur={() => {
          const validationError = validatePasswordConfirmation(form.password, form.confirm)
          setFormErrors({ ...formErrors, confirm: validationError })
        }}
        error={formErrors.confirm}
      />
    </AuthContainer>
  )
}
