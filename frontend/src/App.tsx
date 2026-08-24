import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { IconSprite } from './components/shell/IconSprite'
import { AppShell } from './components/shell/AppShell'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'

/**
 * Point d'entrée applicatif : Context providers globaux + routing.
 * Pour ajouter une page : créer un fichier dans pages/, l'importer ici,
 * déclarer sa <Route> à l'intérieur de <Route element={<AppShell />}>,
 * et ajouter l'entrée correspondante dans config/navigation.ts.
 *
 * <IconSprite /> est monté ici (racine, hors shell) car /login est en dehors
 * de <AppShell> : les deux ont besoin des références <use href="#i-xxx">.
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <IconSprite />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
