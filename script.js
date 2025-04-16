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

    
    // registration form

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
    // CHECK IF USER IS LOGGED IN
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
            // Save the JWT token in localStorage
            localStorage.setItem("token", data.token);
    
            // Save the user ID in localStorage
            localStorage.setItem("user_id", data.user_id);  // Save user_id from the backend
    
            alert("Login successful!");
            window.location.href = "index.html";  // Redirect to the home page or dashboard
          } else {
            alert(data.message || "Login failed. Please check your credentials.");
          }
        } catch (error) {
          console.error("Error:", error);
          alert("Something went wrong. Please try again later.");
        }
    });

    // FUNDRAISE LOGIC
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