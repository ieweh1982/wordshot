import { HashRouter, Routes, Route } from 'react-router-dom'
import LiveView from './routes/LiveView'
import Maintenance from './routes/Maintenance'
import { useThemeCSSVariables } from './stores/useThemeCSSVariables'

function App() {
  // Apply active theme CSS variables globally
  useThemeCSSVariables();

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LiveView />} />
        <Route path="/maintenance" element={<Maintenance />} />
      </Routes>
    </HashRouter>
  )
}

export default App
