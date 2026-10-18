const num1Input = document.getElementById('num1');
const num2Input = document.getElementById('num2');
const calcBtn = document.getElementById('calc-btn');
const resultDiv = document.getElementById('result');

calcBtn.addEventListener('click', () => {
    // 入力された値を数値に変換する
    const val1 = Number(num1Input.value);
    const val2 = Number(num2Input.value);

    // 足し算を実行
    const sum = val1 + val2;

    // 結果を表示する
    resultDiv.textContent = `答え： ${sum}`;
});