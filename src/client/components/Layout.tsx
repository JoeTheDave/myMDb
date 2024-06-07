import { Link, useNavigate } from 'react-router-dom'
import { FC } from 'react'
import { Menu, LogIn, UserPlus2 } from 'lucide-react'

import { ReactComponentProps } from '@/client/lib/types'

export interface LayoutProps extends ReactComponentProps {}

export const Layout: FC<LayoutProps> = ({ children }) => {
  return (
    <div id="layout" className="flex flex-col h-full">
      <header
        id="app-header"
        className="h-[60px] px-5 bg-gray-950 text-white flex items-center justify-between border-gray-300 border-b-2"
      >
        <Link to="/">
          <div id="logo" className="bg-yellow-500 text-black font-bold px-3 rounded-sm text-[25px] ">
            myMDb
          </div>
        </Link>

        <div className="dropdown dropdown-end dropdown-hover relative left-[20px]">
          <div tabIndex={0} role="button" className="btn btn-ghost">
            <Menu size={30} />
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content z-[1] menu shadow bg-base-100 w-52 border-t-gray-950 border-t-4 p-0 [&_li>*]:rounded-none [&_li>*]:text-gray-900"
          >
            <li>
              <Link to="/login">
                <LogIn size={20} className="text-gray-700" />
                Login
              </Link>
            </li>
            <li>
              <Link to="/register">
                <UserPlus2 size={20} className="text-gray-700" />
                Create Account
              </Link>
            </li>
          </ul>
        </div>
      </header>
      <main id="app-content" className="flex-1 bg-white p-5 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
