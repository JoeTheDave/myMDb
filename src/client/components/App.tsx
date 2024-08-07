import { Routes, Route, BrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { Layout } from '@/client/components/Layout'
import { Login } from '@/client/components/Login'
import { Register } from '@/client/components/Register'
import { NotFound } from '@/client/components/NotFound'
import { Movies } from '@/client/components/Movies'
import { MovieEdit } from '@/client/components/MovieEdit'

export const App = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Movies />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movies/add" element={<MovieEdit />} />
          <Route path="/movies/edit/:id" element={<MovieEdit />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </Layout>
    </BrowserRouter>
  )
}
