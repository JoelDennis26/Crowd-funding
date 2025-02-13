
document.addEventListener("DOMContentLoaded", () => {
// Login Modal
// const loginBtn = document.getElementById("login-btn");
// const loginModal = document.getElementById("login-modal");
    const closeBtns = document.querySelectorAll(".close");

// loginBtn.onclick = (event) => {
//     event.preventDefault();
//     loginModal.style.display = "flex";
// };

    closeBtns.forEach((closeBtn) => {
    closeBtn.onclick = () => {
        const modal = closeBtn.closest(".modal");
        modal.style.display = "none";
    };
});

// window.onclick = (event) => {
//     if (event.target.classList.contains("modal")) {
//         event.target.style.display = "none";
//     }
// };

// Donate Modal
const donateBtn = document.getElementById("donate-btn");
const donateModal = document.getElementById("donate-modal");
const donateForm = document.getElementById("donate-form");
const donationList = document.getElementById("donation-list");

donateBtn.onclick = (event) => {
    event.preventDefault();
    donateModal.style.display = "flex";
};

donateForm.onsubmit = (event) => {
    event.preventDefault();

    const reason = document.getElementById("reason").value;
    const story = document.getElementById("story").value;
    const amount = document.getElementById("amount").value;

    if (reason && story && amount) {
        const donationItem = document.createElement("li");
        donationItem.innerHTML = `
            <strong>Reason:</strong> ${reason}<br>
            <strong>Story:</strong> ${story}<br>
            <strong>Amount:</strong> $${amount}
        `;
        donationList.appendChild(donationItem);

        donateForm.reset();
        donateModal.style.display = "none";

        alert("Thank you for your donation!");
    } else {
        alert("Please fill out all fields.");
    }
};

// fundraise

const fundraiseBtn =  document.getElementById("fundraise-btn");
const fundraiseModal = document.getElementById("fundraise-modal");
const fundraiseForm = document.getElementById("fundraise-form");

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
        alert(
            `Fundraiser Submitted!\n\nOption: ${option}\nReason: ${reason}\nStory: ${story}`
        );
        fundraiseForm.reset();
        fundraiseModal.style.display = "none";
    } else {
        alert("Please fill out all fields.");
    }
};
});
