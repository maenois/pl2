body {
    font-family: sans-serif;
    background-color: #f0f2f5;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
}

.card {
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    text-align: center;
    width: 300px;
}

input {
    width: 80px;
    padding: 8px;
    font-size: 18px;
    text-align: center;
    border: 1px solid #ccc;
    border-radius: 6px;
    margin: 5px;
}

button {
    padding: 8px 16px;
    font-size: 16px;
    background-color: #0066ff;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    margin-top: 10px;
}

button:hover {
    background-color: #0052cc;
}

.hidden {
    display: none;
}

.error {
    color: red;
    font-size: 14px;
    margin-top: 10px;
}

.input-area {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
}

#result {
    font-size: 18px;
    font-weight: bold;
    color: #333;
}
