import { HashRouter, Routes, Route } from 'react-router-dom'
import LiveView from './routes/LiveView'
import Maintenance from './routes/Maintenance'
import { useThemeCSSVariables } from './stores/useThemeCSSVariables'
import { useEffect } from 'react'
import { danmuStore } from './stores/danmuStore'

// Global danmu listener - always active regardless of route
function DanmuListener() {
  useEffect(() => {
    if (!window.electronAPI) return

    const handleDanmuBatch = (danmuList: any[]) => {
      danmuStore.getState().addDanmuBatch(danmuList)
    }

    const handleDanmuError = (err: string) => {
      console.error('[DanmuListener] Danmu error:', err)
    }

    window.electronAPI.onDanmuBatch(handleDanmuBatch)
    window.electronAPI.onDanmuError(handleDanmuError)

    return () => {
      window.electronAPI.removeAllListeners('danmu:batch')
      window.electronAPI.removeAllListeners('danmu:error')
    }
  }, [])

  return null
}

function App() {
  useThemeCSSVariables()

  return (
    <>
      <DanmuListener />
      <HashRouter>
        <Routes>
          <Route path="/" element={<LiveView />} />
          <Route path="/maintenance" element={<Maintenance />} />
        </Routes>
      </HashRouter>
    </>
  )
}

export default App