import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function Donate() {
  const [fundraisers, setFundraisers] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedFundraiser, setSelectedFundraiser] = useState(null);
  const [donationData, setDonationData] = useState({ name: '', email: '', amount: '', message: '' });
  const [loading, setLoading] = useState(true);
  const donationSectionRef = useRef(null);

  const fetchFundraisers = async () => {
    try {
      const res = await axios.get('http://localhost:3000/fundraisers');
      setFundraisers(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFundraisers();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const filtered = fundraisers.filter(f => {
    const matchesSearch = f.title.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || f.category === category;
    return matchesSearch && matchesCategory && f.status === 'active';
  });

  const handleDonateClick = (f) => {
    setSelectedFundraiser(f);
    setTimeout(() => {
      if (donationSectionRef.current) {
        donationSectionRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleDonateSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      alert("Please log in to donate.");
      window.location.href = "/login";
      return;
    }

    try {
      const { data: orderData } = await axios.post('http://localhost:3000/api/payments/create-order', {
        amount: donationData.amount,
        campaignId: selectedFundraiser.id
      }, { headers: { Authorization: `Bearer ${token}` } });

      const options = {
        key: orderData.key_id,
        amount: donationData.amount * 100,
        currency: "INR",
        name: "FundHive",
        description: "Donation to Campaign",
        order_id: orderData.order_id,
        handler: async function (response) {
          try {
            const verifyRes = await axios.post('http://localhost:3000/api/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              campaignId: selectedFundraiser.id,
              amount: donationData.amount
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            alert('Payment verified and donation successful! Thank you!');
            fetchFundraisers();
            setSelectedFundraiser(null);
            setDonationData({ name: '', email: '', amount: '', message: '' });
          } catch (err) {
            alert(`Payment verification failed: ${err.response?.data?.message || err.message}`);
            console.error(err);
          }
        },
        prefill: {
          name: donationData.name,
          email: donationData.email
        },
        theme: { color: "#ffde59" }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response){
          alert("Payment Failed: " + response.error.description);
      });
      rzp1.open();
    } catch (err) {
      alert(err.response?.data?.message || 'Error initiating payment');
      console.error(err);
    }
  };

  return (
    <>
      <section className="hero">
          <div className="hero-content">
              <h1>Support a Cause</h1>
              <p>Every contribution brings someone closer to their goal.<br/>Be the change you wish to see!</p>
          </div>
      </section>

      <section className="container">
          <h2>Active Fundraisers</h2>
          
          <div className="search-filter">
              <input type="text" id="searchInput" placeholder="Search fundraisers..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select id="categoryFilter" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All Categories</option>
                  <option value="education">Education</option>
                  <option value="medical">Medical</option>
                  <option value="disaster">Disaster Relief</option>
                  <option value="startup">Startup</option>
                  <option value="other">Other</option>
              </select>
          </div>
          
          <div className="fundraiser-cards" id="fundraisersContainer">
              {loading ? (
                <div className="no-fundraisers"><p>Loading active fundraisers...</p></div>
              ) : filtered.length === 0 ? (
                <div className="no-fundraisers"><p>No fundraisers found matching your search.</p></div>
              ) : filtered.map(f => (
                <div className="fundraiser-card" key={f.id}>
                    <img src={`http://localhost:3000${f.image_path}`} alt={f.title} />
                    <div className="fundraiser-content">
                        <h3>{f.title}</h3>
                        <p className="description">{f.description}</p>
                        <div className="progress-container">
                            <div className="progress-bar" style={{ width: `${Math.min((f.raised / f.goal) * 100, 100)}%` }}></div>
                        </div>
                        <p>Goal: ₹{f.goal} | Raised: ₹{f.raised}</p>
                        <button onClick={() => handleDonateClick(f)}>Donate Now</button>
                    </div>
                </div>
              ))}
          </div>
      </section>

      <section className="donate-form" id="donationSection" style={{ display: selectedFundraiser ? 'block' : 'none' }} ref={donationSectionRef}>
          {selectedFundraiser && (
            <>
              <h2>Make a Donation to <span id="fundraiserTitle">{selectedFundraiser.title}</span></h2>
              <div className="progress-container">
                  <div className="progress-bar" id="progressBar" style={{ width: `${Math.min((selectedFundraiser.raised / selectedFundraiser.goal) * 100, 100)}%` }}></div>
              </div>
              <p>Goal: ₹<span id="fundraiserGoal">{selectedFundraiser.goal}</span> | Raised: ₹<span id="amountRaised">{selectedFundraiser.raised}</span></p>
              
              <form id="donationForm" onSubmit={handleDonateSubmit}>
                  <input type="hidden" id="fundraiserId" name="fundraiserId" value={selectedFundraiser.id} />
                  <input type="hidden" id="userId" name="userId" />
                  
                  <label htmlFor="name">Full Name:</label>
                  <input type="text" id="name" name="name" required value={donationData.name} onChange={e => setDonationData({...donationData, name: e.target.value})} />

                  <label htmlFor="email">Email Address:</label>
                  <input type="email" id="email" name="email" required value={donationData.email} onChange={e => setDonationData({...donationData, email: e.target.value})} />

                  <label htmlFor="amount">Donation Amount (INR):</label>
                  <input type="number" id="amount" name="amount" min="10" required value={donationData.amount} onChange={e => setDonationData({...donationData, amount: e.target.value})} />

                  <label htmlFor="message">Message of Support (Optional):</label>
                  <textarea id="message" name="message" rows="3" value={donationData.message} onChange={e => setDonationData({...donationData, message: e.target.value})}></textarea>

                  <button type="submit">Donate Now</button>
                  <button type="button" onClick={() => setSelectedFundraiser(null)} style={{ marginTop: '10px', backgroundColor: '#95a5a6' }}>Cancel</button>
              </form>
            </>
          )}
      </section>
    </>
  );
}

export default Donate;
