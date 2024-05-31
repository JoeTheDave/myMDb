import { Button } from '@/client/components/ui/button'

function App() {
  return (
    <div id="app">
      <div className="flex justify-center items-center h-20 mx-10 rounded-md bg-gray-200 relative top-10">
        <div className="text-gray-400 text-[20px] font-Roboto">myMDb</div>
      </div>
      <Button>Click me</Button>
    </div>
  )
}

export default App
