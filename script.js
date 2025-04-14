document.addEventListener("DOMContentLoaded", () => {
    // let activeFundraisers = []; 

    // const donateBtn = document.getElementById("donate-btn");
    // const donateModal = document.getElementById("donate-modal");
    // const donateForm = document.getElementById("donate-form");
    // const donationList = document.getElementById("donation-list");
    // const fundraiserSelect = document.createElement("select"); 

    // fundraiserSelect.id = "fundraiser-select";
    // fundraiserSelect.required = true;

    // donateForm.insertBefore(fundraiserSelect, donateForm.firstChild); 

    // donateBtn.onclick = (event) => {
    //     event.preventDefault();
    //     if (activeFundraisers.length === 0) {
    //         alert("No active fundraisers available. Start a fundraiser first!");
    //         return;
    //     }
    //     updateFundraiserDropdown();
    //     donateModal.style.display = "flex";
    // };

    // function updateFundraiserDropdown() {
    //     fundraiserSelect.innerHTML = "";
    //     activeFundraisers.forEach((fundraiser, index) => {
    //         const option = document.createElement("option");
    //         option.value = index;
    //         option.textContent = `${fundraiser.option} - ${fundraiser.reason}`;
    //         fundraiserSelect.appendChild(option);
    //     });
    // }

    // donateForm.onsubmit = (event) => {
    //     event.preventDefault();
    //     const selectedFundraiserIndex = fundraiserSelect.value;
    //     const amount = document.getElementById("amount").value;

    //     if (selectedFundraiserIndex !== "" && amount) {
    //         const selectedFundraiser = activeFundraisers[selectedFundraiserIndex];

    //         const donationItem = document.createElement("li");
    //         donationItem.innerHTML = `
    //             <strong>${selectedFundraiser.option} - ${selectedFundraiser.reason}</strong>: Rs. ${amount}
    //         `;
    //         donationList.appendChild(donationItem);

    //         donateForm.reset();
    //         donateModal.style.display = "none";

    //         alert(`Thank you for donating Rs. ${amount} to "${selectedFundraiser.reason}"`);
    //     } else {
    //         alert("Please select a fundraiser and enter a donation amount.");
    //     }
    // };

    // const fundraiseBtn = document.getElementById("fundraise-btn");
    // const fundraiseModal = document.getElementById("fundraise-modal");
    // const fundraiseForm = document.getElementById("fundraise-form");


    // const closeBtns = document.querySelectorAll(".close");

    // closeBtns.forEach((closeBtn) => {
    // closeBtn.addEventListener("click", () => {
    //     closeBtn.closest(".modal").style.display = "none";
    //     });
    // });

    // fundraiseBtn.onclick = (event) => {
    //     event.preventDefault();
    //     fundraiseModal.style.display = "flex";
    // };

    // fundraiseForm.onsubmit = (event) => {
    //     event.preventDefault();
    //     const option = document.getElementById("fundraise-option").value;
    //     const reason = document.getElementById("fundraise-reason").value;
    //     const story = document.getElementById("fundraise-story").value;

    //     if (option && reason && story) {
    //         activeFundraisers.push({ option, reason, story });
    //         updateFundraiserDropdown();
    //         alert(`Fundraiser Created: ${option} - ${reason}`);

    //         fundraiseForm.reset();
    //         fundraiseModal.style.display = "none";
    //     } else {
    //         alert("Please fill out all fields.");
    //     }
    // };

    if (document.getElementById('campaignForm')) {
        document.getElementById('campaignForm').addEventListener('submit', function (e) {
            e.preventDefault();
            const title = document.getElementById('title').value;
            const description = document.getElementById('description').value;
            const goal = document.getElementById('goal').value;

            let campaigns = JSON.parse(localStorage.getItem('campaigns')) || [];
            campaigns.push({ title, description, goal });
            localStorage.setItem('campaigns', JSON.stringify(campaigns));

            alert('Campaign created successfully!');
            this.reset();
        });
    }

    if (document.getElementById('campaign')) {
        let campaignSelect = document.getElementById('campaign');
        let campaigns = JSON.parse(localStorage.getItem('campaigns')) || [];
        campaigns.forEach(c => {
            let opt = document.createElement('option');
            opt.value = c.title;
            opt.textContent = c.title;
            campaignSelect.appendChild(opt);
        });
    }

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

    // LOGIN FORM HANDLING
    if (document.getElementById('loginform')) {
        document.getElementById('loginform').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            const response = await fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                alert('Login successful!');
                window.location.href = "index.html";
            } else {
                alert(data.message);
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
});
