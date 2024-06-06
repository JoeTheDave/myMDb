import { FC } from 'react'

import { ReactComponentProps } from '@/client/lib/types'

export interface LayoutProps extends ReactComponentProps {}

export const Layout: FC<LayoutProps> = ({ children }) => {
  return (
    <div id="layout" className="flex flex-col h-full">
      <header
        id="app-header"
        className="h-[60px] px-5 bg-gray-950 text-white flex items-center justify-between border-gray-300 border-b-2"
      >
        <div id="logo" className="bg-yellow-500 text-black font-bold px-3 rounded-sm text-[25px] ">
          myMDb
        </div>
      </header>
      <main id="app-content" className="flex-1 bg-white p-5 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
