import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import ProtectedRoute from '@/routes/ProtectedRoute'
import Landing from '@/routes/Landing'
import About from '@/routes/About'
import Pricing from '@/routes/Pricing'
import Privacy from '@/routes/Privacy'
import Terms from '@/routes/Terms'
import Auth from '@/routes/Auth'
import AuthReset from '@/routes/AuthReset'
import Onboarding from '@/routes/Onboarding'
import Dashboard from '@/routes/Dashboard'
import Settings from '@/routes/Settings'
import ProfileEdit from '@/routes/ProfileEdit'
import PublicProfile from '@/routes/PublicProfile'
import WorkoutNew from '@/routes/WorkoutNew'
import HabitNew from '@/routes/HabitNew'
import NotFound from '@/routes/NotFound'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/reset" element={<AuthReset />} />
        <Route path="/u/:handle" element={<PublicProfile />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/profile" element={<ProfileEdit />} />
          <Route path="/workout/new" element={<WorkoutNew />} />
          <Route path="/habit/new" element={<HabitNew />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App