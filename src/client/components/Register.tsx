import { AuthContainer } from '@/client/components/AuthContainer'
import { TextBox } from '@/client/components/TextBox'

export const Register = () => {
  return (
    <AuthContainer>
      <div className="font-PermanentMarker text-[30px] mb-[20px]">Register</div>
      <TextBox id="register-email" label="Email" />
      <TextBox id="register-password" label="Password" />
      <TextBox id="register-confirm-password" label="Confirm Password" />
    </AuthContainer>
  )
}
