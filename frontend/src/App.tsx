import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Reviews from './pages/Reviews';
import Dashboard from './pages/Dashboard';
import { Toaster } from 'react-hot-toast';

const App = () => {
    return (
        <>
            <Router>
                <Routes>
                    <Route path="/" element={<Navigate to="/login" />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/reviews" element={<Reviews />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                </Routes>
            </Router>
            <Toaster position="top-right" />
        </>
    );
};

export default App;
