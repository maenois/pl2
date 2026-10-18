// クライアントIDの設定（ここにあなたの取得したクライアントIDを貼り付けてください）
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

let tokenClient;
let gapiInited = false;
let ginisInited = false;

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '',
    });
    ginisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && ginisInited) {
        document.getElementById('authorize_button').style.display = 'inline-block';
    }
}

function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        document.getElementById('signout_button').style.display = 'inline-block';
        document.getElementById('authorize_button').innerText = '再認証';
        
        // ログイン成功後に、スプレッドシートを2つ自動作成する
        await createTwoSpreadsheets();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken('');
            document.getElementById('content').innerHTML = '<p>ログアウトしました。「Googleでログインして作成」ボタンから再度実行できます。</p>';
            document.getElementById('links').innerHTML = '';
            document.getElementById('signout_button').style.display = 'none';
            document.getElementById('authorize_button').innerText = 'Googleでログインして作成';
        });
    }
}

// ユーザーのドライブにスプレッドシートを2つ新規作成する関数
async function createTwoSpreadsheets() {
    try {
        document.getElementById('content').innerHTML = '<p>スプレッドシートを作成中...</p>';

        // 1つ目のスプレッドシートを作成
        const response1 = await gapi.client.sheets.spreadsheets.create({
            resource: {
                properties: {
                    title: 'アプリ用データシート 1'
                }
            }
        });
        const spreadsheetId1 = response1.result.spreadsheetId;

        // 2つ目のスプレッドシートを作成
        const response2 = await gapi.client.sheets.spreadsheets.create({
            resource: {
                properties: {
                    title: 'アプリ用データシート 2'
                }
            }
        });
        const spreadsheetId2 = response2.result.spreadsheetId;

        // 成功メッセージを表示
        document.getElementById('content').innerText = 
            `スプレッドシートの作成に成功しました！\n\n` +
            `1つ目 ID: ${spreadsheetId1}\n` +
            `2つ目 ID: ${spreadsheetId2}`;

        // リンクをHTMLに挿入する
        const linksDiv = document.getElementById('links');
        linksDiv.innerHTML = `
            <a href="https://docs.google.com/spreadsheets/d/${spreadsheetId1}/edit" target="_blank">📄 1つ目のスプレッドシートを開く</a>
            <a href="https://docs.google.com/spreadsheets/d/${spreadsheetId2}/edit" target="_blank">📄 2つ目のスプレッドシートを開く</a>
        `;

    } catch (err) {
        document.getElementById('content').innerHTML = '<p>作成エラー: ' + (err.message || err) + '</p>';
    }
}
