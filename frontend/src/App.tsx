import { BrowserRouter, Route, Routes } from 'react-router-dom'
import JoinPage from './pages/JoinPage'
import TicketPage from './pages/TicketPage'

/**
 * Three audiences, three routes.
 *
 * `/` and `/ticket/:ticketId` are the patient's phone. `/staff` is the
 * receptionist's desk. `/display` is the screen on the wall. They share a
 * backend and nothing else — each one shows only what its audience can act on.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route path="/ticket/:ticketId" element={<TicketPage />} />
      </Routes>
    </BrowserRouter>
  )
}
