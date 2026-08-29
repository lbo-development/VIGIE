import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { IconSprite } from './components/shell/IconSprite'
import { RequireAuth } from './components/RequireAuth'
import { AppShell } from './components/shell/AppShell'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { GisementGeographique } from './pages/GisementGeographique'
import { GisementTechnique } from './pages/GisementTechnique'
import { Reglages } from './pages/Reglages'
import { Directions } from './pages/Directions'
import { Services } from './pages/Services'
import { Cellules } from './pages/Cellules'
import { SeuilsValidationDs } from './pages/SeuilsValidationDs'
import { NotFound } from './pages/NotFound'

/**
 * Point d'entrée applicatif : Context providers globaux + routing.
 * Pour ajouter une page : créer un fichier dans pages/, l'importer ici,
 * déclarer sa <Route> à l'intérieur de <Route element={<AppShell />}>,
 * et ajouter l'entrée correspondante dans config/navigation.ts.
 *
 * <IconSprite /> est monté ici (racine, hors shell) car /login est en dehors
 * de <AppShell> : les deux ont besoin des références <use href="#i-xxx">.
 * /login est la seule route publique — tout le reste passe par <RequireAuth />.
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <IconSprite />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/parametres/gisement-geographique" element={<GisementGeographique />} />
              <Route path="/parametres/gisement-technique" element={<GisementTechnique />} />
              <Route path="/parametres/reglages" element={<Reglages />} />
              <Route path="/parametres/directions" element={<Directions />} />
              <Route path="/parametres/services" element={<Services />} />
              <Route path="/parametres/cellules" element={<Cellules />} />
              <Route path="/parametres/seuils-validation-ds" element={<SeuilsValidationDs />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
