// クライアントIDの設定（ここにあなたの取得したクライアントIDを貼り付けてください）
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = [
    'https://sheets.googleapis.com/$discovery/rest?version=v4',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];

let tokenClient;
let gapiInited = false;
let ginisInited = false;

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        discoveryDocs: DISCOVERY_DOCS,
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
        document.getElementById('authorize_button').style.display = 'none';
        document.getElementById('app_section').style.display = 'block';
        
        // 保存されているフォルダIDがあればフォームに反映する
        const savedFolderId = localStorage.getItem('app_target_folder_id');
        if (savedFolderId) {
            document.getElementById('folder_id_input').value = savedFolderId;
        }

        document.getElementById('content').innerHTML = '<p>ログインしました。シート名を入力して作成ボタンを押してください。</p>';
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
            document.getElementById('content').innerHTML = '<p>ログアウトしました。</p>';
            document.getElementById('links').innerHTML = '';
            document.getElementById('app_section').style.display = 'none';
            document.getElementById('signout_button').style.display = 'none';
            document.getElementById('authorize_button').style.display = 'inline-block';
        });
    }
}

// フォルダIDを保存するボタンの処理
function saveFolderId() {
    const folderId = document.getElementById('folder_id_input').value.trim();
    localStorage.setItem('app_target_folder_id', folderId);
    alert('保存先フォルダIDを更新しました！');
}

// フォルダを指定してスプレッドシートを作成するヘルパー関数
async function createSpreadsheetInFolder(title, folderId) {
    const resource = {
        name: title,
        mimeType: 'application/vnd.google-apps.spreadsheet'
    };
    if (folderId && folderId !== '') {
        resource.parents = [folderId];
    }

    const response = await gapi.client.drive.files.create({
        resource: resource,
        fields: 'id, spreadsheetUrl'
    });
    return response.result.id;
}

// 新規シート作成＆ログ記録のメイン処理
async function createNewSheet() {
    try {
        const targetFolderId = document.getElementById('folder_id_input').value.trim();
        const newSheetTitle = document.getElementById('sheet_title_input').value.trim() || 'カスタムデータシート';

        document.getElementById('content').innerHTML = '<p>処理を実行中...</p>';

        let logSheetId = localStorage.getItem('app_log_sheet_id');

        if (!logSheetId) {
            // 1. ログ用シートを指定フォルダ内に作成
            logSheetId = await createSpreadsheetInFolder('アプリ用ログ管理シート', targetFolderId);
            localStorage.setItem('app_log_sheet_id', logSheetId);

            // 最初のシート名を取得してヘッダーを書き込む
            const spreadsheetInfo = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: logSheetId });
            const firstSheetName = spreadsheetInfo.result.sheets[0].properties.title;

            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: logSheetId,
                range: `${firstSheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [['シート名', 'スプレッドシートURL', '作成日時']]
                }
            });
        }

        document.getElementById('content').innerHTML = `<p>「${newSheetTitle}」を作成中...</p>`;

        // 2. 2つ目（以降）の新しいシートを指定フォルダ内に作成
        const newSheetId = await createSpreadsheetInFolder(newSheetTitle, targetFolderId);
        const newSheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;

        // 3. ログ用シートに記録を追記
        const logSpreadsheetInfo = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: logSheetId });
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

        // 4. 完了画面とリンクを表示
        document.getElementById('content').innerText = 
            `処理が完了しました！\n新しいシートを作成し、ログに追加しました。`;

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
