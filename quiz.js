// quiz.js

var quizData = {
    depression: ['Little interest or pleasure in doing things', 'Feeling down, depressed, or hopeless', 'Trouble falling or staying asleep', 'Feeling tired or having little energy', 'Poor appetite or overeating', 'Feeling bad about yourself', 'Trouble concentrating on things', 'Moving or speaking slowly', 'Thoughts that you would be better off dead'],
    adhd: ['Trouble staying focused on tasks', 'Difficulty organizing tasks', 'Frequently losing important things', 'Avoiding tasks that require effort', 'Feeling restless or fidgety', 'Interrupting others', 'Difficulty waiting your turn', 'Making careless mistakes'],
    anxiety: ['Feeling nervous or anxious', 'Unable to stop worrying', 'Worrying too much about different things', 'Trouble relaxing', 'Becoming easily annoyed', 'Feeling afraid something awful might happen', 'Experiencing sudden panic'],
    ocd: ['Having unwanted repetitive thoughts', 'Compelled to check things repeatedly', 'Washing or cleaning more than necessary', 'Anxious if routines are interrupted', 'Repeating words or actions in mind', 'Difficulty controlling intrusive thoughts'],
    bipolar: ['Periods of unusually high energy', 'Feeling extremely confident', 'Talking more or faster', 'Needing less sleep', 'Engaging in risky behaviors', 'Sudden shifts to deep sadness'],
    psychosis: ['Hearing voices others cannot hear', 'Seeing things others do not see', 'Feeling others are watching you', 'Strong beliefs others say are not true', 'Trouble organizing thoughts', 'Feeling disconnected from reality'],
    eating: ['Feeling guilty after eating', 'Restricting food intake', 'Eating large amounts in short time', 'Feeling out of control around food', 'Worrying about body weight', 'Avoiding eating in front of others'],
    ptsd: ['Repeated disturbing memories', 'Having nightmares about traumatic event', 'Avoiding reminders of event', 'Feeling emotionally numb', 'Being easily startled', 'Feeling constantly on guard'],
    addiction: ['Strong urge to use substances', 'Using more than intended', 'Failed attempts to cut down', 'Spending time obtaining or using', 'Continuing despite health problems', 'Neglecting responsibilities'],
    gambling: ['Thinking constantly about gambling', 'Needing more money to gamble', 'Chasing losses', 'Lying about gambling', 'Borrowing money to gamble', 'Feeling restless when trying to stop'],
    social: ['Fear of being judged', 'Avoiding social situations', 'Intense anxiety before public speaking', 'Blushing or sweating in social settings', 'Worrying before social events', 'Avoiding eye contact'],
    postpartum: ['Feeling overwhelmed as parent', 'Difficulty bonding with baby', 'Loss of interest in activities', 'Persistent sadness', 'Anxiety about caring for baby', 'Difficulty sleeping', 'Thoughts failing as parent', 'Withdrawing from family']
};

var quizTitles = {
    depression: 'Depression Test',
    adhd: 'ADHD Test',
    anxiety: 'Anxiety Test',
    ocd: 'OCD Test',
    bipolar: 'Bipolar Test',
    psychosis: 'Psychosis Test',
    eating: 'Eating Disorder Test',
    ptsd: 'PTSD Test',
    addiction: 'Addiction Test',
    gambling: 'Gambling Addiction Test',
    social: 'Social Anxiety Test',
    postpartum: 'Postpartum Depression Test'
};

var currentQuizType = null;
var userAnswers = [];
var currentResultData = null;
var currentUser = null;
var LOGIN_PAGE_URL = 'login.html';

window.onload = async function () {
    var user = await checkUserLogin();
    if (!user) return;

    var sidebarName = document.getElementById('sidebar-name');
    if (sidebarName) {
        var hour = new Date().getHours();
        var greeting = 'Welcome';

        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        sidebarName.textContent = user.firstName ? greeting + ', ' + user.firstName : greeting;
    }
};

async function checkUserLogin() {
    try {
        var savedUser = getStoredCurrentUser();

        // 1) localStorage first
        if (savedUser && savedUser.email) {
            currentUser = savedUser;

            var tokenFromLocal = safeGetAuthToken();
            if (tokenFromLocal) {
                try {
                    var backgroundResponse = await safeGetCurrentUserFromAPI();
                    if (backgroundResponse && backgroundResponse.user) {
                        currentUser = mergeUserData(savedUser, backgroundResponse.user);
                        setStoredCurrentUser(currentUser);
                    }
                } catch (backgroundError) {
                    console.warn('Quiz background sync failed, continuing with local user:', backgroundError);
                }
            }

            return currentUser;
        }

        // 2) backend fallback
        var token = safeGetAuthToken();
        if (token) {
            try {
                var response = await safeGetCurrentUserFromAPI();

                if (response && response.user) {
                    currentUser = normalizeUserObject(response.user);
                    setStoredCurrentUser(currentUser);
                    return currentUser;
                }
            } catch (apiError) {
                console.warn('Backend user fetch failed:', apiError);
            }
        }

        // 3) users list fallback
        var fallbackUser = getFallbackUserFromUsers();
        if (fallbackUser && fallbackUser.email) {
            currentUser = fallbackUser;
            setStoredCurrentUser(currentUser);
            return currentUser;
        }

        safeClearAuthToken();
        clearStoredCurrentUser();
        window.location.href = LOGIN_PAGE_URL;
        return null;
    } catch (error) {
        console.error('Invalid current user data:', error);
        safeClearAuthToken();
        clearStoredCurrentUser();
        window.location.href = LOGIN_PAGE_URL;
        return null;
    }
}

function getCurrentUser() {
    return currentUser;
}

// ===============================
// SAFE AUTH HELPERS
// ===============================
function safeGetAuthToken() {
    try {
        if (typeof getAuthToken === 'function') {
            return getAuthToken();
        }

        return (
            localStorage.getItem('healingHub_token') ||
            localStorage.getItem('authToken') ||
            localStorage.getItem('token') ||
            ''
        );
    } catch (error) {
        console.warn('Token read error:', error);
        return '';
    }
}

async function safeGetCurrentUserFromAPI() {
    if (typeof getCurrentUserFromAPI === 'function') {
        return await getCurrentUserFromAPI();
    }
    throw new Error('getCurrentUserFromAPI is not available');
}

function safeClearAuthToken() {
    try {
        if (typeof clearAuthToken === 'function') {
            clearAuthToken();
            return;
        }

        localStorage.removeItem('healingHub_token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');
    } catch (error) {
        console.warn('Token clear error:', error);
    }
}

function getStoredCurrentUser() {
    try {
        var raw = localStorage.getItem('healingHub_currentUser');
        if (!raw) return null;

        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.email) return null;

        return normalizeUserObject(parsed);
    } catch (error) {
        console.warn('Stored current user parse error:', error);
        return null;
    }
}

function setStoredCurrentUser(user) {
    try {
        var normalizedUser = normalizeUserObject(user);
        localStorage.setItem('healingHub_currentUser', JSON.stringify(normalizedUser));
        syncCurrentUserIntoUsersList(normalizedUser);
    } catch (error) {
        console.error('Set current user error:', error);
    }
}

function clearStoredCurrentUser() {
    try {
        localStorage.removeItem('healingHub_currentUser');
    } catch (error) {
        console.warn('Clear current user error:', error);
    }
}

function normalizeUserObject(user) {
    return {
        id: user && user.id ? user.id : Date.now(),
        firstName: user && user.firstName ? user.firstName : '',
        lastName: user && user.lastName ? user.lastName : '',
        username: user && user.username ? user.username : '',
        email: user && user.email ? user.email : '',
        age: user && user.age ? user.age : '',
        gender: user && user.gender ? user.gender : '',
        country: user && user.country ? user.country : '',
        bio: user && user.bio ? user.bio : '',
        profilePicture: user && user.profilePicture ? user.profilePicture : '',
        createdAt: user && user.createdAt ? user.createdAt : '',
        updatedAt: user && user.updatedAt ? user.updatedAt : '',
        loginTime: user && user.loginTime ? user.loginTime : new Date().toISOString(),
        password: user && user.password ? user.password : ''
    };
}

function mergeUserData(localUser, apiUser) {
    return normalizeUserObject({
        ...localUser,
        ...apiUser,
        loginTime: new Date().toISOString(),
        password: (localUser && localUser.password) || (apiUser && apiUser.password) || ''
    });
}

function syncCurrentUserIntoUsersList(user) {
    try {
        var users = JSON.parse(localStorage.getItem('healingHub_users') || '[]');
        var safeUsers = Array.isArray(users) ? users : [];

        var index = safeUsers.findIndex(function (item) {
            return (item && item.email ? item.email.toLowerCase() : '') === (user && user.email ? user.email.toLowerCase() : '');
        });

        if (index >= 0) {
            safeUsers[index] = {
                ...safeUsers[index],
                ...user
            };
        } else {
            safeUsers.push(user);
        }

        localStorage.setItem('healingHub_users', JSON.stringify(safeUsers));
    } catch (error) {
        console.warn('Users list sync error:', error);
    }
}

function getFallbackUserFromUsers() {
    try {
        var users = JSON.parse(localStorage.getItem('healingHub_users') || '[]');
        if (!Array.isArray(users) || !users.length) return null;

        var validUsers = users
            .filter(function (user) {
                return user && user.email;
            })
            .sort(function (a, b) {
                var aTime = new Date((a && (a.loginTime || a.updatedAt || a.createdAt)) || 0).getTime();
                var bTime = new Date((b && (b.loginTime || b.updatedAt || b.createdAt)) || 0).getTime();
                return bTime - aTime;
            });

        if (!validUsers.length) return null;

        return normalizeUserObject(validUsers[0]);
    } catch (error) {
        console.warn('Fallback user error:', error);
        return null;
    }
}

function beginQuiz(type) {
    currentQuizType = type;
    currentResultData = null;

    var questions = quizData[type];
    userAnswers = [];

    var i = 0;
    while (i < questions.length) {
        userAnswers[i] = -1;
        i++;
    }

    var html = '';
    var idx = 0;

    while (idx < questions.length) {
        html += '<div class="question-item" id="q' + idx + '"><div class="question-text">' + (idx + 1) + '. ' + escapeHtml(questions[idx]) + '</div><div class="options-grid">';

        var opt = 0;
        while (opt < 4) {
            var optTexts = ['NOT AT ALL', 'SEVERAL DAYS', 'MORE THAN HALF THE DAYS', 'NEARLY EVERY DAY'];
            html += '<button type="button" class="option-btn" onclick="pickAnswer(' + idx + ',' + opt + ')">' + optTexts[opt] + '</button>';
            opt++;
        }

        html += '</div></div>';
        idx++;
    }

    document.getElementById('questions-area').innerHTML = html;
    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'block';
    document.getElementById('results-view').style.display = 'none';
}

function pickAnswer(questionIdx, optionIdx) {
    userAnswers[questionIdx] = optionIdx;

    var questionEl = document.getElementById('q' + questionIdx);
    if (!questionEl) return;

    var btns = questionEl.getElementsByClassName('option-btn');
    var i = 0;

    while (i < btns.length) {
        btns[i].classList.remove('selected');
        i++;
    }

    if (btns[optionIdx]) {
        btns[optionIdx].classList.add('selected');
    }
}

function finishQuiz() {
    var allAnswered = true;
    var i = 0;

    while (i < userAnswers.length) {
        if (userAnswers[i] === -1) {
            allAnswered = false;
            break;
        }
        i++;
    }

    if (!allAnswered) {
        alert('Please answer all questions');
        return;
    }

    var score = 0;
    var j = 0;

    while (j < userAnswers.length) {
        score = score + userAnswers[j];
        j++;
    }

    var maxScore = userAnswers.length * 3;
    var percentage = Math.round((score / maxScore) * 100);

    currentResultData = {
        score: score,
        maxScore: maxScore,
        percentage: percentage
    };

    showResults(score, maxScore, percentage);
}

function showResults(score, maxScore, percentage) {
    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'none';
    document.getElementById('results-view').style.display = 'block';

    var color = '#10b981';
    if (percentage >= 75) {
        color = '#ef4444';
    } else if (percentage >= 50) {
        color = '#f59e0b';
    }

    document.getElementById('res-title').textContent = quizTitles[currentQuizType] + ' Results';
    document.getElementById('res-score').innerHTML = '<div style="color:' + color + ';">' + score + '/' + maxScore + ' (' + percentage + '%)</div>';

    var message = 'Your responses suggest minimal concerns. Keep maintaining healthy habits.';
    if (percentage >= 75) {
        message = 'Your responses suggest significant concerns. Please consider reaching out to a mental health professional for support.';
    } else if (percentage >= 50) {
        message = 'Your responses suggest moderate concerns. Exploring coping strategies and professional support may be helpful.';
    } else if (percentage >= 25) {
        message = 'Your responses suggest mild concerns. Continue practicing self-care and reach out if things worsen.';
    }

    document.getElementById('res-message').innerHTML = '<strong>Your Result:</strong><br>' + message;
    document.getElementById('res-recommendations').innerHTML = '<h3>Recommendations:</h3><ul><li>Consider professional evaluation if concerned</li><li>Practice self-awareness and journaling</li><li>Maintain healthy lifestyle habits</li><li>Reach out for support when needed</li><li>Use the resources available on this platform</li><li>Follow up with regular self-assessments</li></ul>';
}

function storeResults() {
    try {
        var user = getCurrentUser();

        if (!user || !user.email) {
            alert('Please login again.');
            window.location.href = LOGIN_PAGE_URL;
            return;
        }

        if (!currentQuizType) {
            alert('No quiz result to save.');
            return;
        }

        var score, maxScore, percentage;

        if (currentResultData) {
            score = currentResultData.score;
            maxScore = currentResultData.maxScore;
            percentage = currentResultData.percentage;
        } else {
            var scoreElement = document.getElementById('res-score');
            if (!scoreElement) {
                alert('No result found to save.');
                return;
            }

            var text = scoreElement.textContent || '';
            var scoreMatch = text.match(/(\d+)\s*\/\s*(\d+)/);

            if (!scoreMatch) {
                alert('Could not read result score.');
                return;
            }

            score = parseInt(scoreMatch[1], 10);
            maxScore = parseInt(scoreMatch[2], 10);
            percentage = Math.round((score / maxScore) * 100);
        }

        var result = {
            id: Date.now(),
            quizType: currentQuizType,
            quizTitle: quizTitles[currentQuizType],
            score: score,
            maxScore: maxScore,
            percentage: percentage,
            date: new Date().toISOString(),
            userEmail: user.email
        };

        var results = localStorage.getItem('vibeCheckHistory');
        var resultsArray = [];

        if (results) {
            resultsArray = JSON.parse(results);
            if (!Array.isArray(resultsArray)) {
                resultsArray = [];
            }
        }

        resultsArray.push(result);
        localStorage.setItem('vibeCheckHistory', JSON.stringify(resultsArray));

        alert('Results saved successfully!');
    } catch (error) {
        console.error('Error saving results:', error);
        alert('Could not save results.');
    }
}

function goBack() {
    document.getElementById('selection-view').style.display = 'block';
    document.getElementById('quiz-view').style.display = 'none';
    document.getElementById('results-view').style.display = 'none';
}

async function handleLogout() {
    if (typeof showConfirmPopup === 'function') {
        showConfirmPopup({
            type: 'warning',
            icon: '👋',
            title: 'Logout from Healing Hub?',
            message: 'You can come back anytime and continue your wellness journey.',
            confirmText: 'Logout',
            cancelText: 'Stay Here',
            onConfirm: async function () {
                try {
                    if (typeof logoutUser === 'function') {
                        await logoutUser();
                    }
                } catch (error) {
                    console.error('Logout function error:', error);
                } finally {
                    safeClearAuthToken();
                    clearStoredCurrentUser();
                    window.location.href = LOGIN_PAGE_URL;
                }
            }
        });
        return;
    }

    try {
        if (typeof logoutUser === 'function') {
            await logoutUser();
        }
    } catch (error) {
        console.error('Logout function error:', error);
    } finally {
        safeClearAuthToken();
        clearStoredCurrentUser();
        window.location.href = LOGIN_PAGE_URL;
    }
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}