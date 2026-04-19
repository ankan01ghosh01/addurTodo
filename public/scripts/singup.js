const form = document.getElementById("signupForm");

const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");

const passwordError = document.getElementById("passwordError");
const confirmError = document.getElementById("confirmError");

// Regex rules:
// - 1 uppercase
// - 1 lowercase
// - 1 number OR symbol
// - min 6 chars
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{6,}$/;

// Live validation (typing)
password.addEventListener("input", () => {
    if (!passwordRegex.test(password.value)) {
        passwordError.textContent =
            "Password must be at least 6 characters and include uppercase, lowercase, and a number or symbol.";
        passwordError.classList.remove("hidden");
    } else {
        passwordError.classList.add("hidden");
    }
});

confirmPassword.addEventListener("input", () => {
    if (confirmPassword.value !== password.value) {
        confirmError.textContent = "Passwords do not match.";
        confirmError.classList.remove("hidden");
    } else {
        confirmError.classList.add("hidden");
    }
});

// On submit
form.addEventListener("submit", (e) => {
    let valid = true;

    // Password strength
    if (!passwordRegex.test(password.value)) {
        passwordError.textContent =
            "Password must be at least 6 characters and include uppercase, lowercase, and a number or symbol.";
        passwordError.classList.remove("hidden");
        valid = false;
    }

    // Match check
    if (password.value !== confirmPassword.value) {
        confirmError.textContent = "Passwords do not match.";
        confirmError.classList.remove("hidden");
        valid = false;
    }

    if (!valid) {
        e.preventDefault(); // stop form submit
    }
});