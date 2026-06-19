import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function Home() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDonations = async () => {
    try {
      const res = await axios.get('/donations?limit=5');
      setDonations(res.data);
      setError(false);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations();
    const interval = setInterval(fetchDonations, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <section className="hero">
          <div className="hero-content">
              <h1>Change the world with FundHive</h1>
              <p>Empower ideas, fuel innovation, and make an impact.<br/>Join a community that believes in possibilities!</p>
          </div>
      </section>

      <section className="causes">
          <h1>Some Causes</h1>
          <div className="gallery">
              <div className="card"><img src="/images/creative-project.jpg" alt="Creative Projects" /><h3>Creative Projects</h3></div>
              <div className="card"><img src="/images/environment.jpg" alt="Environment" /><h3>Environment</h3></div>
              <div className="card"><img src="/images/community.jpg" alt="Community" /><h3>Community</h3></div>
          </div>
      </section>

      <section className="donation-records">
          <h3>Recent Donations</h3>
          <ul id="donation-list">
              {loading ? (
                <li className="loading-message">Loading donation records...</li>
              ) : error ? (
                <li className="error-message">Error loading donation records. Please try again later.</li>
              ) : donations.length === 0 ? (
                <li className="no-donations">No donations yet. Be the first to make a difference!</li>
              ) : (
                donations.map((donation, index) => (
                  <li className="donation-record" key={index}>
                      <strong>{donation.name || 'Anonymous'}</strong> donated ₹{donation.amount.toLocaleString('en-IN')}
                      {donation.fundraiser_title && <> to <em>{donation.fundraiser_title}</em></>}
                      {donation.message && <div className="donation-message">"{donation.message}"</div>}
                      <small>
                        {new Date(donation.created_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                      </small>
                  </li>
                ))
              )}
          </ul>
          <div className="view-all" style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/donate" className="btn" style={{ padding: '8px 20px', backgroundColor: '#3498db', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>View All Donations</Link>
          </div>
      </section>
    </>
  );
}

export default Home;
