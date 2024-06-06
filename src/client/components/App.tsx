import { Layout } from '@/client/components/Layout'
import { Routes, Route, BrowserRouter } from 'react-router-dom'
import { Login } from '@/client/components/Login'
import { Register } from '@/client/components/Register'
import { NotFound } from '@/client/components/NotFound'

export const App = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<div>Content</div>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
