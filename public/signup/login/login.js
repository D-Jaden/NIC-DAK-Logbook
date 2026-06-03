//------------------------------------VARIABLES-------------------------------------//

const firstName = document.getElementById('Fname');
const lastName = document.getElementById('Lname');
const LphoneNumber = document.getElementById('loginphoneNo');
const RphoneNumber = document.getElementById('registerphoneNo');
const captcha = document.getElementById('captchaInput');
const agreement = document.getElementById('agreement');
const signupButton = document.getElementById('signupButton');

//----------------------------CONVERSION FROM TEXT TO NO----------------------------//

const validNumber = function(phoneNo) {
    if (!/^\d{10,15}$/.test(phoneNo)) {
        document.querySelector("#message").innerHTML = "Not a Valid Number (must be 10-15 digits)";
        console.log("INVALID");
        return false;
    } else {
        console.log("VALID");//prints only if no is in the rangeof 10-15 digits
        document.querySelector("#message").innerHTML = "Valid Number";
        LphoneNumber.value = phoneNo;
        RphoneNumber.value = phoneNo;
        return true;
    }
};

//-----------------------------------TOGGLE-----------------------------------------//
function flip() {
    document.getElementById('flipContainer').classList.toggle('flipped');
}
document.querySelector('.switch input').addEventListener('change', (e) => {
    flip();
});
// Optional: Ensure initial state
document.addEventListener('DOMContentLoaded', () => {
    const flipContainer = document.getElementById('flipContainer');
    flipContainer.classList.remove('flipped'); // Start with login form
    document.querySelector('.switch input').checked = false; // Toggle unchecked
});

function showForm(formId) {
    const loginBox = document.getElementById('login-box');
    const registerBox = document.getElementById('register-box');
    loginBox.style.display = 'none';
    registerBox.style.display = 'none';
    if (formId === 'login-box') {
        loginBox.style.display = 'block';
    } else if (formId === 'register-box') {
        registerBox.style.display = 'block';
    }
}
document.addEventListener('DOMContentLoaded', () => {
    showForm('login-box');
});
document.querySelector('.switch input').addEventListener('change', (e) => {
    if (e.target.checked) {
        showForm('register-box');
    } else {
        showForm('login-box');
    }
});

//-----------------------------AUTHENTICATION IN LOGIN (UPDATED)------------------------------//

const loginBtnElement = document.querySelector('.log-btn button');
if (loginBtnElement) loginBtnElement.disabled = true; // Initially disabled

LphoneNumber.addEventListener('input', () => {
    const isValid = /^\d{10,15}$/.test(LphoneNumber.value.trim());
    if (loginBtnElement) {
        loginBtnElement.disabled = !isValid;
    }
});

async function comparePhoneNo() {
    const phoneNumber = document.getElementById('loginphoneNo').value;
    if (!validNumber(phoneNumber)) {
        alert('Please enter a valid phone number (10-15 digits)');
        return;
    }
    
    // Show loading state
    const loginBtn = document.querySelector('.log-btn button') || document.querySelector('#loginBtn');
    const originalText = loginBtn ? loginBtn.textContent : '';
    if (loginBtn) {
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;
    }
    
    try {
        console.log('Attempting login with phone:', phoneNumber);
        
        const response = await fetch('/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_no: phoneNumber })
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response');
        }

        const data = await response.json();
        console.log('Login response:', data);
        
        if (data.success && data.token) {
            // STORE THE TOKEN - This was missing!
            localStorage.setItem('dak_token', data.token);
            console.log('Token stored successfully');
            
            alert('Number verified - Welcome back!');
            // Set flag to load data after redirect
            localStorage.setItem('shouldLoadUserData', 'true');
            window.location.href = '/despatch';
        } else {
            alert('Incorrect number: ' + (data.error || 'User not found'));
        }
    } catch (error) {
        console.error('Login Error:', error);
        alert(`Login failed: ${error.message}`);
    } finally {
        // Reset button
        if (loginBtn) {
            loginBtn.textContent = originalText || 'Login';
            loginBtn.disabled = false;
        }
    }
}

//------------------------------CAPTCHA GENERATION---------------------------------//

function generateCaptcha() {
    const characters = '!@#$&*-+AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789';
    let captcha = '';
    for (let i = 0; i < 6; i++) {
        captcha += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    document.getElementById('captcha-text').textContent = captcha;
}
document.getElementById('refreshCaptcha').addEventListener('click', function () {
    generateCaptcha();
    document.getElementById('captchaInput').value = '';   // clear old input too
});

// Generate on page load
generateCaptcha();

window.onload = generateCaptcha;

document.getElementById('captchaInput').addEventListener('input', function() {
    const userInput = this.value;
    const captchaText = document.getElementById('captcha-text').textContent;
    if (userInput === captchaText) {
        this.style.borderColor = '#00ff00';
    } else {
        this.style.borderColor = '#ff0000';
    }
});

//-----------------------------FORM VALIDATION FOR SIGNUP BUTTON---------------------//

function validateForm() {
    const isFirstNameFilled = firstName.value.trim().length > 0;
    const isLastNameFilled = lastName.value.trim().length > 0;
    const isPhoneValid = /^\d{10,15}$/.test(RphoneNumber.value.trim());
    const isCaptchaValid = captcha.value === document.getElementById('captcha-text').textContent;
    const isAgreementChecked = agreement.checked;

    signupButton.disabled = !(isFirstNameFilled && isLastNameFilled && isPhoneValid && isCaptchaValid && isAgreementChecked);
}

// Add event listeners for real-time validation
firstName.addEventListener('input', validateForm);
lastName.addEventListener('input', validateForm);
RphoneNumber.addEventListener('input', validateForm);
captcha.addEventListener('input', validateForm);
agreement.addEventListener('change', validateForm);

//--------------------------------REGISTRATION (UPDATED)-----------------------------------------------//

document.querySelector('.reg-btn button').addEventListener('click', async (e) => {
    e.preventDefault();

    const userData = {
        first_name: document.getElementById('Fname').value.trim().replace(/^\w/, c => c.toUpperCase()),
        last_name: document.getElementById('Lname').value.trim().replace(/^\w/, c => c.toUpperCase()),
        phone_no: document.getElementById('registerphoneNo').value.trim(),
        agreed: document.getElementById('agreement').checked
    };
    console.log("User Data:", userData);

    if (!userData.first_name || !userData.last_name || !userData.phone_no) {
        alert('Please fill all required fields');
        return;
    }

    if (!/^\d{10,15}$/.test(userData.phone_no)) {
        alert('Please enter a valid phone number (10-15 digits)');
        return;
    }

    if (!userData.agreed) {
        alert('You must agree to terms & conditions');
        return;
    }

    // Show loading state
    const registerBtn = e.target;
    const originalText = registerBtn.textContent;
    registerBtn.textContent = 'Creating Account...';
    registerBtn.disabled = true;

    try {
        console.log('Attempting registration:', userData);
        
        const response = await fetch('/users/register', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response');
        }

        const result = await response.json();
        console.log('Registration response:', result);

        if (response.ok && result.success) {
            if (result.token) {
                localStorage.setItem('dak_token', result.token);
                console.log('Registration token stored successfully');
            }
            
            alert(`Welcome ${userData.first_name}! Account created successfully.`);
            
            // Clear form
            document.getElementById('Fname').value = '';
            document.getElementById('Lname').value = '';
            document.getElementById('registerphoneNo').value = '';
            document.getElementById('captchaInput').value = '';
            generateCaptcha(); // Reset captcha            
            document.getElementById('agreement').checked = false;
            signupButton.disabled = true;
            
            // Redirect to main page after successful registration
            setTimeout(() => {
                window.location.href = '/despatch';
            }, 2000);
            
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        console.error('REGISTRATION FAILED:', error);
        alert('Registration failed. Please try again.');
    } finally {
        // Reset button
        registerBtn.textContent = originalText;
        registerBtn.disabled = false;
    }
});

//---------------------------------RESPONSIVENESS--------------------------------------------//

document.addEventListener('DOMContentLoaded', function() {
    const loginBox = document.getElementById('login-box');
    const registerBox = document.getElementById('register-box');
    const toggleSwitch = document.querySelector('.switch input');

    loginBox.style.display = 'flex';
    registerBox.style.display = 'none';

    toggleSwitch.addEventListener('change', function() {
        if (this.checked) {
            loginBox.style.display = 'none';
            registerBox.style.display = 'flex';
        } else {
            loginBox.style.display = 'flex';
            registerBox.style.display = 'none';
        }
    });
});