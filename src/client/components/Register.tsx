import { Link, useNavigate } from 'react-router-dom'
import { AuthContainer } from '@/client/components/AuthContainer'
import { TextBox } from '@/client/components/ui/TextBox'
import { Button } from '@/client/components/ui/Button'

export const Register = () => {
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
            <Button id="register-submit" size="md">
              Cancel
            </Button>
            <Button id="register-submit" color="secondary" size="md">
              Create Account
            </Button>
          </div>
        </div>
      }
    >
      <TextBox id="register-email" label="Email" />
      <TextBox id="register-password" password label="Password" />
      <TextBox id="register-confirm-password" password label="Confirm Password" />
    </AuthContainer>
  )
}
