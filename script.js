document.addEventListener("DOMContentLoaded", () => {
    let activeFundraisers = []; // Array to store active fundraisers

    const donateBtn = document.getElementById("donate-btn");
    const donateModal = document.getElementById("donate-modal");
    const donateForm = document.getElementById("donate-form");
    const donationList = document.getElementById("donation-list");
    const fundraiserSelect = document.createElement("select"); // Dropdown for selecting fundraisers

    fundraiserSelect.id = "fundraiser-select";
    fundraiserSelect.required = true;

    donateForm.insertBefore(fundraiserSelect, donateForm.firstChild); // Add select field to donation form

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
                <strong>${selectedFundraiser.option} - ${selectedFundraiser.reason}</strong>: $${amount}
            `;
            donationList.appendChild(donationItem);

            donateForm.reset();
            donateModal.style.display = "none";

            alert(`Thank you for donating $${amount} to "${selectedFundraiser.reason}"`);
        } else {
            alert("Please select a fundraiser and enter a donation amount.");
        }
    };

    const fundraiseBtn = document.getElementById("fundraise-btn");
    const fundraiseModal = document.getElementById("fundraise-modal");
    const fundraiseForm = document.getElementById("fundraise-form");

    // close button 
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
});
