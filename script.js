// クライアントIDの設定（ここにあなたの取得したクライアントIDを貼り付けてください）
const CLIENT_ID = '893360002885-juvu8vp11q6si42ebojo4i483vd3sqkl.apps.googleusercontent.com';

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
        document.getElementById('authorize_button').innerText = '再実行';
        
        // ログイン成功後のメイン処理を実行
        await processLogAndNewSheet();
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
            document.getElementById('content').innerHTML = '<p>ログアウトしました。「Googleでログインして処理を開始」ボタンから再度実行できます。</p>';
            document.getElementById('links').innerHTML = '';
            document.getElementById('signout_button').style.display = 'none';
            document.getElementById('authorize_button').innerText = 'Googleでログインして処理を開始';
        });
    }
}

// ログ用シートの確認・作成と、新規データシートの作成＆記録を行うメイン関数
async function processLogAndNewSheet() {
    try {
        document.getElementById('content').innerHTML = '<p>ログ用シートを確認・作成中...</p>';

        let logSheetId = localStorage.getItem('app_log_sheet_id');

        if (!logSheetId) {
            // 1. 新規に「アプリ用ログ管理シート」を作成する
            const logResponse = await gapi.client.sheets.spreadsheets.create({
                resource: {
                    properties: {
                        title: 'アプリ用ログ管理シート'
                    }
                }
            });
            logSheetId = logResponse.result.spreadsheetId;
            localStorage.setItem('app_log_sheet_id', logSheetId);

            // 作成されたスプレッドシートの「最初のシート名」を自動取得する
            const spreadsheetInfo = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: logSheetId
            });
            const firstSheetName = spreadsheetInfo.result.sheets[0].properties.title;

            // 取得した正しいシート名を使ってヘッダーを書き込む
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: logSheetId,
                range: `${firstSheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [['シート名', 'スプレッドシートURL', '作成日時']]
                }
            });
        }

        // 2. ユーザーに2つ目のシートの名前を入力してもらう
        let newSheetTitle = prompt('新しく作成するシートの名前を入力してください:', 'カスタムデータシート');
        if (!newSheetTitle) {
            newSheetTitle = 'カスタムデータシート';
        }

        document.getElementById('content').innerHTML = `<p>「${newSheetTitle}」を作成中...</p>`;

        // 3. 新しいスプレッドシートを作成する
        const newResponse = await gapi.client.sheets.spreadsheets.create({
            resource: {
                properties: {
                    title: newSheetTitle
                }
            }
        });
        const newSheetId = newResponse.result.spreadsheetId;
        const newSheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;

        // 4. ログ用シートの最初のシート名を再度取得して、そこに追記する
        const logSpreadsheetInfo = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: logSheetId
        });
        const logFirstSheetName = logSpreadsheetInfo.result.sheets[0].properties.title;

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: logSheetId,
            range: `${logFirstSheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [
                    [newSheetTitle, newSheetUrl, new Date().toLocaleString()]
                ]
            }
        });

        // 5. 完了メッセージとリンクを表示
        document.getElementById('content').innerText = 
            `処理が完了しました！\n\n` +
            `ログ用シートに新しいシートの情報を記録しました。`;

        const linksDiv = document.getElementById('links');
        linksDiv.innerHTML = `
            <a href="https://docs.google.com/spreadsheets/d/${logSheetId}/edit" target="_blank">📊 ログ管理シートを開く</a>
            <a href="${newSheetUrl}" target="_blank">📄 新しく作った「${newSheetTitle}」を開く</a>
        `;

    } catch (err) {
        let errorDetails = '';
        try {
            errorDetails = JSON.stringify(err, null, 2);
        } catch (e) {
            errorDetails = err.message || String(err);
        }
        document.getElementById('content').innerHTML = `<pre style="color: red; text-align: left; font-size: 12px; background: #fff; padding: 10px; border: 1px solid #ccc;">エラーが発生しました:\n${errorDetails}</pre>`;
    }
}
