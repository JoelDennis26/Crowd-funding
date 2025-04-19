document.addEventListener("DOMContentLoaded", () => {
    let activeFundraisers = []; 

    const donateBtn = document.getElementById("donate-btn");
    const donateModal = document.getElementById("donate-modal");
    const donateForm = document.getElementById("donate-form");
    const donationList = document.getElementById("donation-list");
    const fundraiserSelect = document.createElement("select"); 

    fundraiserSelect.id = "fundraiser-select";
    fundraiserSelect.required = true;

    donateForm.insertBefore(fundraiserSelect, donateForm.firstChild); 

    fundraiseBtn.onclick = (event) => {
        event.preventDefault();
        fundraiseModal.style.display = "flex";
    };

    
    if (document.getElementById('registerform')) {
        document.getElementById('registerform').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('regUsername').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;

            if (password !== confirmPassword) {
                alert("Passwords do not match!");
                return;
            }

            const response = await fetch('http://localhost:3000/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            alert(data.message);

            if (response.ok) {
                window.location.href = "login.html";
            }
        });
    }

    function checkUserAuth() {
        const token = localStorage.getItem('token');
        const authLinks = document.getElementById('auth-links');

        if (token) {
            authLinks.innerHTML = `<a href="#" id="logout-btn">Logout</a>`;
            document.getElementById('logout-btn').addEventListener('click', () => {
                localStorage.removeItem('token');
                location.reload();
            });
        } else {
            authLinks.innerHTML = `<a href="login.html">Login</a> <a href="register.html">Register</a>`;
        }
    }

    checkUserAuth();

    document.getElementById("loginform").addEventListener("submit", async (e) => {
        e.preventDefault();
    
        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;
    
        try {
          const response = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
    
          const data = await response.json();
    
          if (response.ok && data.token) {
            localStorage.setItem("token", data.token);
    
            localStorage.setItem("user_id", data.user_id);
    
            alert("Login successful!");
            window.location.href = "index.html";
          } else {
            alert(data.message || "Login failed. Please check your credentials.");
          }
        } catch (error) {
          console.error("Error:", error);
          alert("Something went wrong. Please try again later.");
        }
    });

    const fundraiserList = document.getElementById("fundraiserList");
    if (fundraiserList) {
        fetch("/api/fundraisers")
            .then(response => response.json())
            .then(data => {
                fundraiserList.innerHTML = "";
                data.forEach(fundraiser => {
                    const card = document.createElement("div");
                    card.className = "fundraiser-card";
                    card.innerHTML = `
                        <h3>${fundraiser.title}</h3>
                        <p>${fundraiser.description}</p>
                        <p><strong>Goal:</strong> ₹${fundraiser.goal}</p>
                        <p><strong>Raised:</strong> ₹${fundraiser.raised}</p>
                        <button onclick="donate(${fundraiser.id})">Donate</button>
                    `;
                    fundraiserList.appendChild(card);
                });
            })
            .catch(err => {
                console.error("Error loading fundraisers:", err);
                fundraiserList.innerHTML = "<p>Failed to load fundraisers.</p>";
            });
    }      
});


        document.addEventListener('DOMContentLoaded', function() {
            const token = localStorage.getItem('token');
            const loginLink = document.getElementById('login-link');
            const registerLink = document.getElementById('register-link');
            
            if (token) {
                loginLink.textContent = 'Logout';
                loginLink.href = '#';
                loginLink.onclick = function() {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user_id');
                    window.location.href = 'login.html';
                };
                registerLink.style.display = 'none';
            }
            
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('end_date').min = today;
            
            document.getElementById('image').addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const preview = document.getElementById('imagePreview');
                        preview.src = event.target.result;
                        preview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });
        });

        document.getElementById('campaignForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const formMessage = document.getElementById('formMessage');
            submitBtn.disabled = true;
            formMessage.style.display = 'none';
            
            // Basic form validation
            const title = document.getElementById('title').value.trim();
            const description = document.getElementById('description').value.trim();
            const goal = document.getElementById('goal').value;
            const category = document.getElementById('category').value;
            const image = document.getElementById('image').files[0];
            
            if (!title || !description || !goal || !category || !image) {
                showMessage('Please fill all required fields', 'error');
                submitBtn.disabled = false;
                return;
            }
            
            if (title.length < 10 || title.length > 100) {
                showMessage('Title should be between 10-100 characters', 'error');
                submitBtn.disabled = false;
                return;
            }
            
            if (description.length < 50) {
                showMessage('Description should be at least 50 characters', 'error');
                submitBtn.disabled = false;
                return;
            }
            
            if (parseInt(goal) < 1000) {
                showMessage('Minimum fundraising goal is ₹1000', 'error');
                submitBtn.disabled = false;
                return;
            }
            
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('user_id');
            
            if (!token || !userId) {
                showMessage('You must be logged in to create a fundraiser', 'error');
                submitBtn.disabled = false;
                window.location.href = 'login.html';
                return;
            }
            
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('goal', goal);
            formData.append('category', category);
            formData.append('image', image);
            formData.append('userId', userId);
            
            try {
                const response = await fetch('http://localhost:3000/create-fundraiser', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.message || 'Failed to create fundraiser');
                }
                
                showMessage('Fundraiser created successfully! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'donate.html';
                }, 2000);
                
            } catch (error) {
                console.error('Error:', error);
                showMessage(error.message || 'Failed to create fundraiser. Please try again.', 'error');
                submitBtn.disabled = false;
            }
        });
        
        function showMessage(message, type) {
            const formMessage = document.getElementById('formMessage');
            formMessage.textContent = message;
            formMessage.className = `form-message ${type}`;
            formMessage.style.display = 'block';
        }

        

