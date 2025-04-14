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

    donateBtn.onclick = (event) => {
        event.preventDefault();
        if (activeFundraisers.length === 0) {
            alert("No active fundraisers available. Start a fundraiser first!");
            return;
        }
        updateFundraiserDropdown();
        donateModal.style.display = "flex";
    };

    function updateFundraiserDropdown() {
        fundraiserSelect.innerHTML = "";
        activeFundraisers.forEach((fundraiser, index) => {
            const option = document.createElement("option");
            option.value = index;
            option.textContent = `${fundraiser.option} - ${fundraiser.reason}`;
            fundraiserSelect.appendChild(option);
        });
    }

    donateForm.onsubmit = (event) => {
        event.preventDefault();
        const selectedFundraiserIndex = fundraiserSelect.value;
        const amount = document.getElementById("amount").value;

        if (selectedFundraiserIndex !== "" && amount) {
            const selectedFundraiser = activeFundraisers[selectedFundraiserIndex];

            const donationItem = document.createElement("li");
            donationItem.innerHTML = `
                <strong>${selectedFundraiser.option} - ${selectedFundraiser.reason}</strong>: Rs. ${amount}
            `;
            donationList.appendChild(donationItem);

            donateForm.reset();
            donateModal.style.display = "none";

            alert(`Thank you for donating Rs. ${amount} to "${selectedFundraiser.reason}"`);
        } else {
            alert("Please select a fundraiser and enter a donation amount.");
        }
    };

    const fundraiseBtn = document.getElementById("fundraise-btn");
    const fundraiseModal = document.getElementById("fundraise-modal");
    const fundraiseForm = document.getElementById("fundraise-form");


    const closeBtns = document.querySelectorAll(".close");

    closeBtns.forEach((closeBtn) => {
    closeBtn.addEventListener("click", () => {
        closeBtn.closest(".modal").style.display = "none";
        });
    });

    fundraiseBtn.onclick = (event) => {
        event.preventDefault();
        fundraiseModal.style.display = "flex";
    };

    fundraiseForm.onsubmit = (event) => {
        event.preventDefault();
        const option = document.getElementById("fundraise-option").value;
        const reason = document.getElementById("fundraise-reason").value;
        const story = document.getElementById("fundraise-story").value;

        if (option && reason && story) {
            activeFundraisers.push({ option, reason, story });
            updateFundraiserDropdown();
            alert(`Fundraiser Created: ${option} - ${reason}`);

            fundraiseForm.reset();
            fundraiseModal.style.display = "none";
        } else {
            alert("Please fill out all fields.");
        }
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
    // Assuming you are using fetch for login
    // document.getElementById('loginForm').addEventListener('submit', async function (e) {
    //     e.preventDefault();

    //     const username = document.getElementById('username').value;
    //     const password = document.getElementById('password').value;

    //     // Sending login credentials to the backend
    //     const response = await fetch('/login', {
    //         method: 'POST',
    //         headers: {
    //             'Content-Type': 'application/json',
    //         },
    //         body: JSON.stringify({ username, password }),
    //     });

    //     const result = await response.json();

    //     if (response.ok) {
    //         // Store user_id in localStorage
    //         localStorage.setItem('user_id', result.user_id); // Store the user_id
    //         window.location.href = 'fundraise.html'; // Redirect to fundraiser page
    //     } else {
    //         alert('Login failed!');
    //     }
    // });


    // document.getElementById('campaignForm').addEventListener('submit', async (e) => {
    //     e.preventDefault();
    
    //     // Collect form data
    //     const title = document.getElementById('title').value;
    //     const description = document.getElementById('description').value;
    //     const goal = document.getElementById('goal').value;
    //     const category = document.getElementById('category').value;
    //     const image = document.getElementById('image').files[0];

    //     // Get user_id from localStorage
    //     const userId = localStorage.getItem('user_id');

    //     if (!userId) {
    //         alert("Please log in first.");
    //         return;
    //     }

    //     // Prepare FormData to send
    //     const formData = new FormData();
    //     formData.append('user_id', userId);  // Append the user_id
    //     formData.append('title', title);
    //     formData.append('description', description);
    //     formData.append('goal', goal);
    //     formData.append('category', category);

    //     if (image) {
    //         formData.append('image', image);
    //     }

    //     // Send form data to backend
    //     const response = await fetch('/your-endpoint-here', {
    //         method: 'POST',
    //         body: formData,
    //     });

    //     const result = await response.json();

    //     if (response.ok) {
    //         alert('Fundraiser started successfully!');
    //         window.location.href = 'some-success-page.html';
    //     } else {
    //         alert(result.message || 'An error occurred.');
    //     }
    // });

    document.getElementById('donationForm').addEventListener('submit', function(e) {
        e.preventDefault();
    
        // Get values from form
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const amount = document.getElementById('amount').value;
        const cause = document.getElementById('cause').value;
        const fundraiser_id = /* You need to pass the correct fundraiser ID here, perhaps from the fundraiser page URL or data */;
        const user_id = localStorage.getItem('user_id');
    
        if (!user_id) {
            alert("Please login to donate.");
            return;
        }
    
        // Prepare data for donation
        const donationData = {
            user_id,
            fundraiser_id,
            amount,
            name,
            email
        };
    
        // Send donation request to server
        fetch('/donate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donationData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.message === 'Donation successful') {
                alert('Thank you for your donation!');
                window.location.href = 'thank-you.html';  // Redirect to a thank you page or back to the fundraiser
            } else {
                alert(data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
        });
    });
    
});

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })
            .then(res => res.json())
            .then(data => {
                if (data.user_id) {
                    localStorage.setItem('user_id', data.user_id);
                    // Optional: localStorage.setItem('token', data.token);
                    window.location.href = 'index.html';
                } else {
                    alert('Login failed. Please check your credentials.');
                }
            })
            .catch(err => {
                console.error('Login error:', err);
                alert('An error occurred during login.');
            });
        });
    }
});
