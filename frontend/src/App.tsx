import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { IconSprite } from './components/shell/IconSprite'
import { RequireAuth } from './components/RequireAuth'
import { AppShell } from './components/shell/AppShell'
import { Login } from './pages/Login'
import { AccueilRedirect } from './pages/AccueilRedirect'
import { Home } from './pages/Home'
import { SuiviRc } from './pages/SuiviRc'
import { SuiviCds } from './pages/SuiviCds'
import { SuiviCb } from './pages/SuiviCb'
import { SuiviDs } from './pages/SuiviDs'
import { GisementGeographique } from './pages/GisementGeographique'
import { GisementTechnique } from './pages/GisementTechnique'
import { Reglages } from './pages/Reglages'
import { Directions } from './pages/Directions'
import { Services } from './pages/Services'
import { Cellules } from './pages/Cellules'
import { SeuilsValidationDs } from './pages/SeuilsValidationDs'
import { Fournisseurs } from './pages/Fournisseurs'
import { Cug } from './pages/Cug'
import { LibelleReferentiel } from './pages/LibelleReferentiel'
import { Utilisateurs } from './pages/Utilisateurs'
import { RolesUtilisateurs } from './pages/RolesUtilisateurs'
import { SignaturesActeurs } from './pages/SignaturesActeurs'
import { MarchesPGI } from './pages/MarchesPGI'
import { ImportMarches } from './pages/ImportMarches'
import { MarchesTiers } from './pages/MarchesTiers'
import { MarchesTdb } from './pages/MarchesTdb'
import { CommandesPGI } from './pages/CommandesPGI'
import { ImportCommandes } from './pages/ImportCommandes'
import { InvestissementsPGI } from './pages/InvestissementsPGI'
import { ImportInvestissements } from './pages/ImportInvestissements'
import { Manuel } from './pages/Manuel'
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
              <Route path="/" element={<AccueilRedirect />} />
              <Route path="/mes-demandes" element={<Home />} />
              <Route path="/suivi-rc" element={<SuiviRc />} />
              <Route path="/suivi-cds" element={<SuiviCds />} />
              <Route path="/suivi-cb" element={<SuiviCb />} />
              <Route path="/suivi-ds" element={<SuiviDs />} />
              <Route path="/parametres/gisement-geographique" element={<GisementGeographique />} />
              <Route path="/parametres/gisement-technique" element={<GisementTechnique />} />
              <Route path="/parametres/reglages" element={<Reglages />} />
              <Route path="/parametres/directions" element={<Directions />} />
              <Route path="/parametres/services" element={<Services />} />
              <Route path="/parametres/cellules" element={<Cellules />} />
              <Route path="/parametres/seuils-validation-ds" element={<SeuilsValidationDs />} />
              <Route path="/fournisseurs" element={<Fournisseurs />} />
              <Route path="/parametres/cug" element={<Cug />} />
              <Route path="/parametres/libelle-referentiel" element={<LibelleReferentiel />} />
              <Route path="/parametres/utilisateurs" element={<Utilisateurs />} />
              <Route path="/parametres/roles" element={<RolesUtilisateurs />} />
              <Route path="/parametres/signatures" element={<SignaturesActeurs />} />
              <Route path="/marches" element={<MarchesPGI />} />
              <Route path="/marches/import" element={<ImportMarches />} />
              <Route path="/marches/tiers" element={<MarchesTiers />} />
              <Route path="/marches/tdb" element={<MarchesTdb />} />
              <Route path="/commandes" element={<CommandesPGI />} />
              <Route path="/commandes/import" element={<ImportCommandes />} />
              <Route path="/investissements" element={<InvestissementsPGI />} />
              <Route path="/investissements/import" element={<ImportInvestissements />} />
              <Route path="/manuel" element={<Manuel />} />
              <Route path="/manuel/:module" element={<Manuel />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
