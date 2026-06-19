import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function AdminDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [reason, setReason] = useState('');
  const navigate = useNavigate();

  const fetchPending = async () => {
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('is_admin') === '1';
    if (!token || !isAdmin) {
      navigate('/login');
      return;
    }
    try {
      const res = await axios.get('http://localhost:3000/api/admin/campaigns/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaigns(res.data.campaigns);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to fetch campaigns. Please ensure you have admin privileges.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleVerify = async (id, action, finalReason = null) => {
    const token = localStorage.getItem('token');
    try {
      await axios.patch(`http://localhost:3000/api/admin/campaigns/${id}/verify`, {
        action, reason: finalReason
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Campaign successfully ${action}d!`);
      setRejectId(null);
      setReason('');
      fetchPending();
    } catch (err) {
      alert(`Error: ${err.response?.data?.message || err.message}`);
      console.error(err);
    }
  };

  const confirmReject = () => {
    if (!reason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }
    handleVerify(rejectId, 'reject', reason.trim());
  };

  return (
    <>
      <div className="container" style={{ maxWidth: '1000px', marginTop: '40px' }}>
          <div className="admin-header">
              <h2>Admin Dashboard</h2>
              <p>Review and verify pending fundraising campaigns.</p>
          </div>

          {loading && <div id="loadingMessage" style={{ textAlign: 'center', color: 'white' }}>Loading pending campaigns...</div>}
          {error && <div id="loadingMessage" style={{ textAlign: 'center', color: 'red' }}>{error}</div>}
          
          <div className="admin-grid" id="pendingCampaignsGrid">
              {!loading && !error && campaigns.length === 0 ? (
                <div className="empty-state"><h3>All caught up!</h3><p>There are no pending campaigns to review at this time.</p></div>
              ) : campaigns.map(c => (
                <div className="admin-card" key={c.id}>
                  <div className="status-badge">Pending Review</div>
                  <h3>{c.title}</h3>
                  <p><strong>Goal:</strong> ₹{c.goal}</p>
                  <p><strong>Category:</strong> {c.category}</p>
                  <p><strong>Creator:</strong> {c.creator_username} ({c.creator_email})</p>
                  <p style={{ marginTop: '10px' }}>{c.description.substring(0, 150)}{c.description.length > 150 ? '...' : ''}</p>
                  
                  <div className="admin-actions">
                      <button className="btn btn-approve" onClick={() => handleVerify(c.id, 'approve')}>Approve</button>
                      <button className="btn btn-reject" onClick={() => { setRejectId(c.id); setReason(''); }}>Reject</button>
                  </div>
                </div>
              ))}
          </div>
      </div>

      <div id="rejectionModal" style={{ display: rejectId ? 'flex' : 'none', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' }}>
          <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
              <h3 style={{ color: '#ffde59' }}>Reject Campaign</h3>
              <p style={{ color: 'white', marginBottom: '10px' }}>Please provide a reason for rejection. This will be emailed to the creator.</p>
              <textarea id="rejectionReason" rows="4" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', marginBottom: '15px' }} placeholder="Reason for rejection..." value={reason} onChange={e => setReason(e.target.value)}></textarea>
              <div style={{ display: 'flex', gap: '10px' }}>
                  <button id="confirmRejectBtn" className="btn btn-reject" onClick={confirmReject}>Confirm Reject</button>
                  <button onClick={() => setRejectId(null)} className="btn" style={{ background: '#555' }}>Cancel</button>
              </div>
          </div>
      </div>
    </>
  );
}

export default AdminDashboard;
