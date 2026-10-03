import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { SocketProvider } from './context/SocketContext'
import JoinPage from './pages/JoinPage'
import PublicDisplay from './pages/PublicDisplay'
import StaffDashboard from './pages/StaffDashboard'
import TicketPage from './pages/TicketPage'

/**
 * Three audiences, three surfaces.
 *
 * `/` and `/ticket/:ticketId` are the patient's phone. `/staff` is the
 * receptionist's desk. `/display` is the screen on the wall. They share a
 * backend and nothing else — each one shows only what its audience can act on,
 * which is why the display shows a token and never a name.
 */
export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<JoinPage />} />
          <Route path="/ticket/:ticketId" element={<TicketPage />} />
          <Route path="/staff" element={<StaffDashboard />} />
          <Route path="/display" element={<PublicDisplay />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  )
}
