// クライアントIDとGoogle Cloud Consoleのプロジェクト番号（APIキーとDeveloper Key）の設定
const CLIENT_ID = '893360002885-juvu8vp11q6si42ebojo4i483vd3sqkl.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDKcb8Ztk9C_zs5oTbNSAcSbXmyNyUEM8Q'; // Google Cloud Consoleで発行した「APIキー」を入れてください
const APP_ID = '893360002885'; // プロジェクト番号（数値）

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = [
    'https://sheets.googleapis.com/$discovery/rest?version=v4',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];

let tokenClient;
let gapiInited = false;
let ginisInited = false;
let pickerInited = false;
let accessToken = null;

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
    gapi.load('picker', () => { pickerInited = true; });
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
        callback: (resp) => {
            if (resp.error !== undefined) {
                throw (resp);
            }
            accessToken = resp.access_token;
            onLoginSuccess();
        },
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
    tokenClient.requestAccessToken({prompt: ''});
}

function onLoginSuccess() {
    document.getElementById('signout_button').style.display = 'inline-block';
    document.getElementById('authorize_button').style.display = 'none';
    document.getElementById('app_section').style.display = 'block';
    
    // 保存されているフォルダ名・IDがあれば復元
    const savedName = localStorage.getItem('app_target_folder_name');
    if (savedName) {
        document.getElementById('selected_folder_name').innerText = savedName;
    }

    document.getElementById('content').innerHTML = '<p>ログインしました。保存先フォルダを選んでシート作成ボタンを押してください。</p>';
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken('');
            accessToken = null;
            document.getElementById('content').innerHTML = '<p>ログアウトしました。</p>';
            document.getElementById('links').innerHTML = '';
            document.getElementById('app_section').style.display = 'none';
            document.getElementById('signout_button').style.display = 'none';
            document.getElementById('authorize_button').style.display = 'inline-block';
        });
    }
}

// Google Picker（フォルダ選択ウィンドウ）を開く関数
function openFolderPicker() {
    if (!pickerInited || !accessToken) {
        alert('Google APIの初期化中または未ログインです。');
        return;
    }

    // フォルダのみを選択できるビューを設定
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder');

    const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .setAppId(APP_ID)
        .setOAuthToken(accessToken)
        .addView(view)
        .setDeveloperKey(API_KEY)
        .setCallback(pickerCallback)
        .build();
    
    picker.setVisible(true);
}

// フォルダが選択されたときのコールバック
function pickerCallback(data) {
    if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
        const doc = data[google.picker.Response.DOCUMENTS][0];
        const folderId = doc[google.picker.Document.ID];
        const folderName = doc[google.picker.Document.NAME];

        // 選択されたフォルダ情報を保存
        localStorage.setItem('app_target_folder_id', folderId);
        localStorage.setItem('app_target_folder_name', folderName);

        document.getElementById('selected_folder_name').innerText = `📁 ${folderName}`;
    }
}

// フォルダを指定してスプレッドシートを作成するヘルパー
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
        fields: 'id, webViewLink' // ここを修正しました
    });
    return response.result.id;
}

// 新規シート作成＆ログ記録のメイン処理
async function createNewSheet() {
    try {
        const targetFolderId = localStorage.getItem('app_target_folder_id') || '';
        const newSheetTitle = document.getElementById('sheet_title_input').value.trim() || 'カスタムデータシート';

        document.getElementById('content').innerHTML = '<p>処理を実行中...</p>';

        let logSheetId = localStorage.getItem('app_log_sheet_id');

        if (!logSheetId) {
            logSheetId = await createSpreadsheetInFolder('アプリ用ログ管理シート', targetFolderId);
            localStorage.setItem('app_log_sheet_id', logSheetId);

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

        const newSheetId = await createSpreadsheetInFolder(newSheetTitle, targetFolderId);
        const newSheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;

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
