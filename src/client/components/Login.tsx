import { Link, useNavigate } from 'react-router-dom'
import { AuthContainer } from '@/client/components/AuthContainer'
import { TextBox } from '@/client/components/ui/TextBox'
import { Button } from '@/client/components/ui/Button'

export const Login = () => {
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
            <Button id="register-submit" size="md">
              Cancel
            </Button>
            <Button id="register-submit" color="secondary" size="md">
              Login
            </Button>
          </div>
        </div>
      }
    >
      <TextBox id="register-email" label="Email" />
      <TextBox id="register-password" password label="Password" />
    </AuthContainer>
  )
}
