import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Voucher from './pages/Voucher';
import Payment from './pages/Payment';
import History from './pages/History';
import Reports from './pages/Reports';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/voucher" element={<Voucher />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/history" element={<History />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Router>
  );
}

export default App;
