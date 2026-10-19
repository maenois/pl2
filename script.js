// ==========================================
// 2. 設定エリア（ご自身の情報に書き換えてください）
// ==========================================
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

// ==========================================
// 2. 初期化と認証関連
// ==========================================
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
    
    // 保存されているフォルダ名があれば復元
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

// ==========================================
// 3. Google Picker（フォルダ選択ウィンドウ）
// ==========================================
function openFolderPicker() {
    if (!pickerInited || !accessToken) {
        alert('Google APIの初期化中または未ログインです。');
        return;
    }

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

function pickerCallback(data) {
    if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
        const doc = data[google.picker.Response.DOCUMENTS][0];
        const folderId = doc[google.picker.Document.ID];
        const folderName = doc[google.picker.Document.NAME];

        localStorage.setItem('app_target_folder_id', folderId);
        localStorage.setItem('app_target_folder_name', folderName);

        document.getElementById('selected_folder_name').innerText = `📁 ${folderName}`;
    }
}

// ==========================================
// 4. スプレッドシート作成ヘルパー
// ==========================================
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
        fields: 'id, webViewLink'
    });
    return response.result.id;
}

// ==========================================
// 5. 新規シート作成 ＆ 複数タブ設定・IDベースの重複防止・名前変更の上書き同期・削除の自動除外
// ==========================================
async function createNewSheet() {
    try {
        const targetFolderId = localStorage.getItem('app_target_folder_id') || '';
        const newSheetTitle = document.getElementById('sheet_title_input').value.trim() || 'カスタムデータシート';
        
        // ユーザーが入力したタブ（シート）名を取得（カンマ区切りで配列化）
        const rawSheetNames = document.getElementById('sheet_names_input') ? document.getElementById('sheet_names_input').value.trim() : '';
        const sheetNames = rawSheetNames ? rawSheetNames.split(',').map(name => name.trim()).filter(name => name !== '') : ['シート1'];

        document.getElementById('content').innerHTML = '<p>既存のシート状態を確認・同期中...</p>';

        let logSheetId = localStorage.getItem('app_log_sheet_id');

        // 1. ログ管理シートがなければ新規作成
        if (!logSheetId) {
            logSheetId = await createSpreadsheetInFolder('アプリ用ログ管理シート', targetFolderId);
            localStorage.setItem('app_log_sheet_id', logSheetId);

            const spreadsheetInfo = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: logSheetId });
            const firstSheetName = spreadsheetInfo.result.sheets[0].properties.title;

            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: logSheetId,
                range: `${firstSheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [['シート名', 'スプレッドシートURL', '作成日時']]
                }
            });
        }

        const logSpreadsheetInfo = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: logSheetId });
        const logFirstSheetName = logSpreadsheetInfo.result.sheets[0].properties.title;

        // 2. サーバースプシの全データを取得
        const getResp = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: logSheetId,
            range: `${logFirstSheetName}!A:C`
        });

        let rows = getResp.result.values || [];
        const header = rows.length > 0 ? rows[0] : ['シート名', 'スプレッドシートURL', '作成日時'];
        let dataRows = rows.length > 1 ? rows.slice(1) : [];

        // 3. スプレッドシートIDごとにユニークに管理するためのMap
        let uniqueSheetMap = new Map();

        // 4. 既存データを巡回してチェック（削除済み除外 ＆ 名前変更の反映）
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const url = row[1]; // B列（URL）
            if (url) {
                const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
                if (match && match[1]) {
                    const sheetId = match[1];

                    if (uniqueSheetMap.has(sheetId)) continue;

                    try {
                        const fileResp = await gapi.client.drive.files.get({
                            fileId: sheetId,
                            fields: 'name, trashed'
                        });

                        if (fileResp && fileResp.result && !fileResp.result.trashed) {
                            row[0] = fileResp.result.name; // 変更された名前を反映
                            uniqueSheetMap.set(sheetId, row);
                        }
                    } catch (e) {
                        console.warn(`ID ${sheetId} は削除されたか見つからないためログから除外します`, e);
                    }
                }
            }
        }

        document.getElementById('content').innerHTML = `<p>「${newSheetTitle}」と指定されたシートを作成中...</p>`;

        // 5. 新しいカスタムスプレッドシートを作成
        const newSheetId = await createSpreadsheetInFolder(newSheetTitle, targetFolderId);
        const newSheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;

        // 6. 指定された複数のシート名に合わせてタブを設定する
        const newSpInfo = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: newSheetId });
        const defaultSheetId = newSpInfo.result.sheets[0].properties.sheetId;

        let requests = [{
            updateSheetProperties: {
                properties: {
                    sheetId: defaultSheetId,
                    title: sheetNames[0]
                },
                fields: 'title'
            }
        }];

        for (let i = 1; i < sheetNames.length; i++) {
            requests.push({
                addSheet: {
                    properties: {
                        title: sheetNames[i]
                    }
                }
            });
        }

        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: newSheetId,
            resource: { requests: requests }
        });

        // 7. 新しいデータの作成と、既存データとのマージ（重複排除）
        const newRow = [newSheetTitle, newSheetUrl, new Date().toLocaleString()];
        let finalRows = [newRow];
        
        for (let [sheetId, row] of uniqueSheetMap) {
            if (sheetId !== newSheetId) {
                finalRows.push(row);
            }
        }

        // 8. サーバースプシのログを更新
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: logSheetId,
            range: `${logFirstSheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [header, ...finalRows]
            }
        });

        document.getElementById('content').innerText = 
            `処理完了！\n「${sheetNames.join(', ')}」のシートを持つスプレッドシートを作成し、ログを綺麗に整理しました。`;

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
