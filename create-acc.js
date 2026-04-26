let currentStep = 1;
let profilePictureFile = null;
let profilePicturePreview = null;
let isSignupSubmitting = false;

document.addEventListener("DOMContentLoaded", function () {
    setupEventListeners();
});

function setupEventListeners() {
    const passwordField = document.getElementById("signup-password");
    const bioField = document.getElementById("bio");
    const signupForm = document.getElementById("signup-form");

    if (passwordField) {
        passwordField.addEventListener("input", checkPasswordStrength);
    }

    if (bioField) {
        bioField.addEventListener("input", updateCharCount);
    }

    if (signupForm) {
        signupForm.addEventListener("submit", handleSignup);
    }
}

function nextStep() {
    if (currentStep === 1 && validateStep1()) {
        currentStep = 2;
        updateSteps();
    } else if (currentStep === 2 && validateStep2()) {
        currentStep = 3;
        updateSteps();
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateSteps();
    }
}

function updateSteps() {
    document.querySelectorAll(".form-step").forEach(step => {
        step.classList.remove("active");
    });

    const activeFormStep = document.getElementById(`form-step-${currentStep}`);
    if (activeFormStep) activeFormStep.classList.add("active");

    document.querySelectorAll(".step").forEach((step, index) => {
        step.classList.remove("active");
        if (index + 1 <= currentStep) {
            step.classList.add("active");
        }
    });

    document.querySelectorAll(".step-line").forEach((line, index) => {
        line.classList.remove("active");
        if (index < currentStep - 1) {
            line.classList.add("active");
        }
    });
}

function validateStep1() {
    const firstName = document.getElementById("first-name")?.value.trim() || "";
    const lastName = document.getElementById("last-name")?.value.trim() || "";
    const age = document.getElementById("age")?.value || "";
    const gender = document.getElementById("gender")?.value || "";
    const country = document.getElementById("country")?.value.trim() || "";

    if (!firstName || !lastName || !age || !gender || !country) {
        showToastSafe("warning", "📝", "Incomplete Step 1", "Please fill all fields in Personal Information.");
        return false;
    }

    const numericAge = parseInt(age, 10);
    if (isNaN(numericAge) || numericAge < 13 || numericAge > 120) {
        showToastSafe("warning", "🎂", "Invalid Age", "Please enter a valid age between 13 and 120.");
        return false;
    }

    return true;
}

function validateStep2() {
    const username = document.getElementById("username")?.value.trim() || "";
    const email = document.getElementById("signup-email")?.value.trim() || "";
    const password = document.getElementById("signup-password")?.value || "";
    const confirmPassword = document.getElementById("confirm-password")?.value || "";

    if (!username || !email || !password || !confirmPassword) {
        showToastSafe("warning", "🔐", "Incomplete Step 2", "Please fill all account details before continuing.");
        return false;
    }

    if (username.length < 3) {
        showToastSafe("warning", "👤", "Username Too Short", "Username must be at least 3 characters long.");
        return false;
    }

    if (!isValidEmail(email)) {
        showToastSafe("error", "📧", "Invalid Email", "Please enter a valid email address.");
        return false;
    }

    if (password.length < 6) {
        showToastSafe("warning", "🔒", "Weak Password", "Password must be at least 6 characters long.");
        return false;
    }

    if (password !== confirmPassword) {
        showToastSafe("error", "❌", "Passwords Do Not Match", "Please make sure both password fields are the same.");
        return false;
    }

    return true;
}

function checkPasswordStrength() {
    const password = document.getElementById("signup-password")?.value || "";
    const strengthBar = document.getElementById("password-strength");
    if (!strengthBar) return;

    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    strengthBar.classList.remove("weak", "fair", "good");

    if (strength <= 2) {
        strengthBar.classList.add("weak");
    } else if (strength <= 3) {
        strengthBar.classList.add("fair");
    } else {
        strengthBar.classList.add("good");
    }
}

function toggleSignupPassword(event) {
    event.preventDefault();

    const field = document.getElementById("signup-password");
    const btn = event.currentTarget || event.target.closest(".toggle-password");
    if (!field || !btn) return;

    const icon = btn.querySelector("i");

    if (field.type === "password") {
        field.type = "text";
        if (icon) {
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        }
    } else {
        field.type = "password";
        if (icon) {
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    }
}

function handleProfileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToastSafe("warning", "🖼️", "File Too Large", "Profile picture must be less than 5MB.");
        event.target.value = "";
        return;
    }

    if (!file.type.startsWith("image/")) {
        showToastSafe("error", "📷", "Invalid File Type", "Please upload a valid image file.");
        event.target.value = "";
        return;
    }

    profilePictureFile = file;

    const reader = new FileReader();
    reader.onload = function (e) {
        profilePicturePreview = e.target.result;

        const previewPic = document.getElementById("preview-pic");
        const previewContainer = document.getElementById("preview-container");

        if (previewPic) previewPic.src = profilePicturePreview;
        if (previewContainer) previewContainer.style.display = "block";
    };

    reader.readAsDataURL(file);
}

function removeProfilePic() {
    profilePictureFile = null;
    profilePicturePreview = null;

    const profileInput = document.getElementById("profile-input");
    const previewContainer = document.getElementById("preview-container");
    const previewPic = document.getElementById("preview-pic");

    if (profileInput) profileInput.value = "";
    if (previewPic) previewPic.src = "";
    if (previewContainer) previewContainer.style.display = "none";
}

function updateCharCount() {
    const bio = document.getElementById("bio")?.value || "";
    const charCount = document.getElementById("char-count");
    if (charCount) {
        charCount.textContent = `${bio.length}/200`;
    }
}

async function handleSignup(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (isSignupSubmitting) return false;

    if (!validateStep1()) {
        currentStep = 1;
        updateSteps();
        return false;
    }

    if (!validateStep2()) {
        currentStep = 2;
        updateSteps();
        return false;
    }

    const termsAccepted = document.getElementById("terms")?.checked || false;
    if (!termsAccepted) {
        showToastSafe("warning", "📜", "Terms Required", "Please accept the Terms of Service and Privacy Policy.");
        currentStep = 3;
        updateSteps();
        return false;
    }

    isSignupSubmitting = true;

    const signupBtn = document.getElementById("signup-btn");
    const originalBtnHtml = signupBtn ? signupBtn.innerHTML : "";

    if (signupBtn) {
        signupBtn.disabled = true;
        signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    }

    try {
        const firstName = document.getElementById("first-name")?.value.trim() || "";
        const lastName = document.getElementById("last-name")?.value.trim() || "";
        const username = document.getElementById("username")?.value.trim() || "";
        const email = document.getElementById("signup-email")?.value.trim().toLowerCase() || "";
        const password = document.getElementById("signup-password")?.value || "";
        const age = document.getElementById("age")?.value || "";
        const gender = document.getElementById("gender")?.value || "";
        const country = document.getElementById("country")?.value.trim() || "";
        const bio = document.getElementById("bio")?.value.trim() || "";

        let users = [];
        try {
            users = JSON.parse(localStorage.getItem("healingHub_users") || "[]");
            if (!Array.isArray(users)) users = [];
        } catch (error) {
            users = [];
        }

        const existingUser = users.find(user =>
            (user.email || "").toLowerCase() === email ||
            (user.username || "").toLowerCase() === username.toLowerCase()
        );

        if (existingUser) {
            throw new Error("User with this email or username already exists");
        }

        const newUser = {
            id: Date.now(),
            firstName,
            lastName,
            name: `${firstName} ${lastName}`.trim(),
            username,
            email,
            password,
            age: Number(age),
            gender,
            country,
            bio,
            profilePicture: profilePicturePreview || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            loginTime: new Date().toISOString()
        };

        users.push(newUser);

        localStorage.setItem("healingHub_users", JSON.stringify(users));
        localStorage.setItem("healingHub_authToken", "demo-token");
        localStorage.setItem("healingHub_token", "demo-token");
        localStorage.setItem("authToken", "demo-token");
        localStorage.setItem("token", "demo-token");

        localStorage.setItem("healingHub_currentUser", JSON.stringify(newUser));
        localStorage.setItem("currentUser", JSON.stringify(newUser));

        sessionStorage.setItem("healingHub_justSignedUp", "true");

        showToastSafe("success", "✅", "Account Created", "Your account has been created successfully.");

        setTimeout(() => {
            window.location.replace("index.html");
        }, 500);

        return false;
    } catch (error) {
        console.error("Signup failed:", error);
        showToastSafe("error", "❌", "Signup Failed", error.message || "Failed to create account");
        return false;
    } finally {
        isSignupSubmitting = false;

        if (signupBtn) {
            signupBtn.disabled = false;
            signupBtn.innerHTML = originalBtnHtml;
        }
    }
}

function showToastSafe(type, icon, title, message) {
    if (typeof showToastPopup === "function") {
        showToastPopup({ type, icon, title, message });
        return;
    }

    if (typeof showToastPopupSafe === "function") {
        showToastPopupSafe({ type, icon, title, message });
        return;
    }

    alert(message);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}