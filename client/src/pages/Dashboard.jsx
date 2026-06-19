import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMyCampaigns = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      try {
        const res = await axios.get('http://localhost:3000/api/fundraisers/my', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCampaigns(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMyCampaigns();
  }, [navigate]);

  return (
    <div className="container" style={{ marginTop: '40px' }}>
      <h2>My Dashboard</h2>
      <p>View the progress of the campaigns you have created.</p>
      <div className="fundraiser-cards" style={{ marginTop: '20px' }}>
        {campaigns.length === 0 ? <p>You haven't created any campaigns yet.</p> : campaigns.map(c => (
          <div className="card" key={c.id}>
            <h3 style={{ color: '#ffde59' }}>{c.title}</h3>
            <p><strong>Status:</strong> {c.status}</p>
            <p><strong>Goal:</strong> ₹{c.goal}</p>
            <p><strong>Raised:</strong> ₹{c.raised}</p>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${Math.min((c.raised / c.goal) * 100, 100)}%` }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
