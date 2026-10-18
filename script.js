// クライアントIDの設定
const CLIENT_ID = '893360002885-juvu8vp11q6si42ebojo4i483vd3sqkl.apps.googleusercontent.com';

// ドライブ・スプレッドシートの作成・編集権限を含むスコープ
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
        
        // ログイン成功後に、スプレッドシートを2つ自動作成する関数を呼び出す
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
            document.getElementById('content').innerText = 'ログアウトしました。';
            document.getElementById('signout_button').style.display = 'none';
            document.getElementById('authorize_button').innerText = 'Googleでログイン';
        });
    }
}

// ユーザーのドライブにスプレッドシートを2つ新規作成する関数
async function createTwoSpreadsheets() {
    try {
        document.getElementById('content').innerText = 'スプレッドシートを作成中...';

        // 1つ目のスプレッドシートを作成
        const response1 = await gapi.client.sheets.spreadsheets.create({
            resource: {
                properties: {
                    title: 'アプリ用データシート 1' // 好きな名前に変更可能
                }
            }
        });
        const spreadsheetId1 = response1.result.spreadsheetId;

        // 2つ目のスプレッドシートを作成
        const response2 = await gapi.client.sheets.spreadsheets.create({
            resource: {
                properties: {
                    title: 'アプリ用データシート 2' // 好きな名に変更可能
                }
            }
        });
        const spreadsheetId2 = response2.result.spreadsheetId;

        // 成功メッセージとIDを表示（必要に応じてlocalStorageなどに保存して使い回します）
        document.getElementById('content').innerText = 
            `スプレッドシートの作成に成功しました！\n\n` +
            `1つ目 ID: ${spreadsheetId1}\n` +
            `2つ目 ID: ${spreadsheetId2}`;

        // ※ここで取得したIDを使って、書き込みや読み込みの処理へと進むことができます

    } catch (err) {
        document.getElementById('content').innerText = '作成エラー: ' + (err.message || err);
    }
}
