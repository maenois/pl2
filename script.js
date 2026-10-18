const passInput = document.getElementById('pass-input');
const loginBtn = document.getElementById('login-btn');
const errorMsg = document.getElementById('error-msg');
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');

const num1Input = document.getElementById('num1');
const num2Input = document.getElementById('num2');
const calcBtn = document.getElementById('calc-btn');
const resultDiv = document.getElementById('result');

// ログインボタンを押したときの処理
loginBtn.addEventListener('click', () => {
    if (passInput.value === '1202') {
        // パスワードが合っていれば認証画面を消してアプリ画面を表示
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
    } else {
        errorMsg.textContent = 'パスワードが違います';
    }
});

// 足し算ボタンを押したときの処理
calcBtn.addEventListener('click', () => {
    const val1 = Number(num1Input.value);
    const val2 = Number(num2Input.value);
    const sum = val1 + val2;
    resultDiv.textContent = `答え： ${sum}`;
});
