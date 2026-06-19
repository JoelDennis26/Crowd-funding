import { Link, useNavigate } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const isAdmin = localStorage.getItem('is_admin') === '1';

  const handleLogout = (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('is_admin');
    navigate('/login');
  };

  return (
    <header>
      <div className="nav-container">
        <Link to="/"><img className="logo" src="/images/logo.png" alt="FundHive Logo" /></Link>
        <nav>
          <ul id="nav-links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/donate">Donate</Link></li>
            <li><Link to="/fundraise">Fundraise</Link></li>
            {!token ? (
              <>
                <li><Link to="/login">Login</Link></li>
                <li><Link to="/register">Register</Link></li>
              </>
            ) : (
              <>
                {isAdmin ? (
                  <li><Link to="/admin">Admin Dashboard</Link></li>
                ) : (
                  <li><Link to="/dashboard">My Dashboard</Link></li>
                )}
                <li><a href="#" onClick={handleLogout}>Logout</a></li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
