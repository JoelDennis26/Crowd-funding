import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Fundraise() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    goal: '',
    description: '',
    image: null
  });
  const [imagePreview, setImagePreview] = useState('#');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert("You must be logged in to create a fundraiser.");
      navigate('/login');
    }
  }, [navigate]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData({ ...formData, [id]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      const reader = new FileReader();
      reader.onload = (event) => setImagePreview(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage({ text: '', type: '' });

    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');

    if (formData.title.length < 10 || formData.title.length > 100) {
      setMessage({ text: 'Title should be between 10-100 characters', type: 'error' });
      setLoading(false);
      return;
    }
    if (formData.description.length < 50) {
      setMessage({ text: 'Description should be at least 50 characters', type: 'error' });
      setLoading(false);
      return;
    }
    if (parseInt(formData.goal) < 1000) {
      setMessage({ text: 'Minimum fundraising goal is ₹1000', type: 'error' });
      setLoading(false);
      return;
    }

    const data = new FormData();
    data.append('title', formData.title);
    data.append('category', formData.category);
    data.append('goal', formData.goal);
    data.append('description', formData.description);
    data.append('image', formData.image);
    data.append('userId', userId);

    try {
      const response = await fetch('/create-fundraiser', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create fundraiser');
      }

      setMessage({ text: 'Fundraiser created successfully! Redirecting...', type: 'success' });
      setTimeout(() => {
        navigate('/donate');
      }, 2000);
    } catch (error) {
      setMessage({ text: error.message || 'Failed to create fundraiser. Please try again.', type: 'error' });
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="hero">
        <div className="hero-content">
            <h1>Start Your Fundraiser</h1>
            <p>Empower ideas, fuel innovation, and make an impact.<br/>Join a community that believes in possibilities!</p>
        </div>
      </section>

      <section className="fundraiser-form">
          <h2>Launch Your Campaign</h2>
          
          {message.text && (
            <div id="formMessage" className={`form-message ${message.type}`} style={{ display: 'block' }}>
              {message.text}
            </div>
          )}
          
          <form id="campaignForm" onSubmit={handleSubmit}>
              <label htmlFor="title">Campaign Title:</label>
              <input type="text" id="title" name="title" required minLength="10" maxLength="100" placeholder="e.g., Help Ramesh Complete His Education" value={formData.title} onChange={handleInputChange} />

              <label htmlFor="description">Description:</label>
              <textarea id="description" name="description" required minLength="50" placeholder="Tell your story... Why is this fundraiser important? How will the funds be used?" value={formData.description} onChange={handleInputChange}></textarea>

              <label htmlFor="goal">Fundraising Goal (INR):</label>
              <input type="number" id="goal" name="goal" required min="1000" placeholder="50000" value={formData.goal} onChange={handleInputChange} />

              <label htmlFor="category">Category:</label>
              <select id="category" name="category" required value={formData.category} onChange={handleInputChange}>
                  <option value="" disabled>Select a category</option>
                  <option value="education">Education</option>
                  <option value="medical">Medical</option>
                  <option value="disaster">Disaster Relief</option>
                  <option value="startup">Startup</option>
                  <option value="other">Other</option>
              </select>

              <label htmlFor="image">Campaign Image:</label>
              <input type="file" id="image" name="image" accept="image/*" required onChange={handleImageChange} />
              <img id="imagePreview" src={imagePreview} alt="Image Preview" style={{ display: imagePreview === '#' ? 'none' : 'block' }} />
              
              <div id="endDateField" style={{ display: 'none' }}>
                  <label htmlFor="end_date">End Date:</label>
                  <input type="date" id="end_date" name="end_date" />
              </div>

              <button type="submit" id="submitBtn" disabled={loading}>Start Fundraising</button>
          </form>
      </section>

      <section id="mission">
          <h2>Our Mission</h2>
          <p>FundHive is dedicated to creating a transparent and supportive space for innovators, dreamers, and those in need. We ensure the legitimacy of fundraisers through a thorough verification process. Whether you're seeking support for a medical emergency, launching a startup, or building community projects, FundHive is here to help you get the support you deserve.</p>
      </section>
    </>
  );
}

export default Fundraise;
