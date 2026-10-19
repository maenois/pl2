// ==========================================
// 3. 設定エリア（ご自身の情報に書き換えてください）
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
// 5. 列番号をアルファベットに変換する便利関数（例: 4 -> 'D', 5 -> 'E'）
// ==========================================
function getColumnLetter(colIndex) {
    let temp, letter = '';
    while (colIndex > 0) {
        temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 1) / 26;
    }
    return letter;
}

// ==========================================
// 6. 新規シート作成 ＆ 「科目別合計」構築・複数タブ設定・ログ管理のメイン処理
// ==========================================
async function createNewSheet() {
    try {
        const targetFolderId = localStorage.getItem('app_target_folder_id') || '';
        const newSheetTitle = document.getElementById('sheet_title_input').value.trim() || 'カスタムデータシート';
        
        // ユーザーが入力した各シート名（カンマ区切り）
        const rawSheetNames = document.getElementById('sheet_names_input') ? document.getElementById('sheet_names_input').value.trim() : '';
        const userSheetNames = rawSheetNames ? rawSheetNames.split(',').map(name => name.trim()).filter(name => name !== '') : ['シート1'];

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

        // 2. サーバースプシの全データを取得（重複・削除チェック）
        const getResp = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: logSheetId,
            range: `${logFirstSheetName}!A:C`
        });

        let rows = getResp.result.values || [];
        const header = rows.length > 0 ? rows[0] : ['シート名', 'スプレッドシートURL', '作成日時'];
        let dataRows = rows.length > 1 ? rows.slice(1) : [];

        let uniqueSheetMap = new Map();
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const url = row[1];
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
                            row[0] = fileResp.result.name;
                            uniqueSheetMap.set(sheetId, row);
                        }
                    } catch (e) {
                        console.warn(`ID ${sheetId} は削除されたか見つからないためログから除外します`, e);
                    }
                }
            }
        }

        document.getElementById('content').innerHTML = `<p>「${newSheetTitle}」と「科目別合計」シートを作成中...</p>`;

        // 3. 新規スプレッドシートを作成
        const newSheetId = await createSpreadsheetInFolder(newSheetTitle, targetFolderId);
        const newSheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;

        // 4. シート構成の組み立て（先頭に「科目別合計」を置き、その後にユーザー指定のシート群を配置）
        const newSpInfo = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: newSheetId });
        const defaultSheetId = newSpInfo.result.sheets[0].properties.sheetId;

        let requests = [];

        // 最初のデフォルトシートを「科目別合計」にリネーム
        requests.push({
            updateSheetProperties: {
                properties: {
                    sheetId: defaultSheetId,
                    title: '科目別合計'
                },
                fields: 'title'
            }
        });

        // ユーザーが指定した各シートを追加
        for (let i = 0; i < userSheetNames.length; i++) {
            requests.push({
                addSheet: {
                    properties: {
                        title: userSheetNames[i]
                    }
                }
            });
        }

        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: newSheetId,
            resource: { requests: requests }
        });

        // 5. 「科目別合計」シートにデータを流し込むためのデータ配列を準備
        // B3:B23 に 11〜31 を格納
        let bValues = [];
        for (let n = 11; n <= 31; n++) {
            bValues.push([n]);
        }

        // C2:C23 に科目一覧（＋25行目に「合計」）を格納
        const subjects = [
            '科目一覧', 'ゼミナール・研究発表費', '講演会費', '試合・大会費', '連盟費', 
            '合宿費', '新聞・図書費', '機関紙発行費', '調査費', '会議費', 
            '印刷・記録費', '事務用消耗品費', '消耗品費', '通信・運輸費', '渉外費', 
            '借用料', '器具・用具・備品費', '修理費', '薬品医療費', '保険料', '燃料費', '手数料'
        ];
        
        let cValues = [];
        for (let i = 0; i < subjects.length; i++) {
            cValues.push([subjects[i]]);
        }
        // 25行目（インデックス24、配列上の行合わせ）に「合計」
        // ※2行目からスタートして23行分が科目、25行目が合計になるように調整
        let fullCValues = [];
        fullCValues.push([subjects[0]]); // C2: 科目一覧
        for(let i=1; i<subjects.length; i++) {
            fullCValues.push([subjects[i]]); // C3〜C23
        }
        fullCValues.push(['']); // C24
        fullCValues.push(['合計']); // C25

        // データ書き込み：B3:B23
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: newSheetId,
            range: '科目別合計!B3:B23',
            valueInputOption: 'USER_ENTERED',
            resource: { values: bValues }
        });

        // データ書き込み：C2:C25
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: newSheetId,
            range: '科目別合計!C2:C25',
            valueInputOption: 'USER_ENTERED',
            resource: { values: fullCValues }
        });

        // 6. D列以降に各シートごとの集計式や、1列空けたパターンの数式を構築して書き込む
        // 列の配置計算：
        // ユーザーシートが N個 ある場合、
        // 0番目 -> D列 (col 4)
        // 1番目 -> E列 (col 5)
        // ...
        // 最後に1列空けて、その隣に合計列とCと同じ科目一覧を配置するなどのルールに対応
        
        let batchValueData = [];

        for (let i = 0; i < userSheetNames.length; i++) {
            const sName = userSheetNames[i];
            const currentCol = 4 + i; // D列 = 4
            const colLetter = getColumnLetter(currentCol);

            // 2行目にシート名
            batchValueData.push({
                range: `科目別合計!${colLetter}2`,
                values: [[sName]]
            });

            // 3〜23行目に ARRAYFORMULA(SUMIF(...))
            let formulas = [];
            for (let r = 3; r <= 23; r++) {
                // B列の対応する値（11〜31）を参照する数式
                formulas.push([`=ARRAYFORMULA(SUMIF('${sName}'!B:B, SEQUENCE(21, 1, 11), '${sName}'!F:F))`]);
            }
            batchValueData.push({
                range: `科目別合計!${colLetter}3:${colLetter}23`,
                values: formulas
            });

            // 25行目に SUM関数 (3〜23の合計)
            batchValueData.push({
                range: `科目別合計!${colLetter}25`,
                values: [[`=SUM(${colLetter}3:${colLetter}23)`]]
            });
        }

        // シート数に応じた「1つ飛んで(空白列を挟んで)各行の合計を記入し、その隣にCと同じものを記入」の処理
        const lastUserCol = 4 + userSheetNames.length - 1; // 最後のユーザーシートの列
        const skippedCol = lastUserCol + 2; // 1列空けて次の列
        const skippedColLetter = getColumnLetter(skippedCol);
        const nextColLetter = getColumnLetter(skippedCol + 1);

        // 2行目見出し「合計」など
        batchValueData.push({
            range: `科目別合計!${skippedColLetter}2`,
            values: [['合計']]
        });
        batchValueData.push({
            range: `科目別合計!${nextColLetter}2`,
            values: [['科目一覧']]
        });

        // スキップ列の3〜23行目に、各行（D列〜最後のシート列まで）の横方向の合計を入れる
        // スキップ列の25行目には縦の合計、隣（nextColLetter）のCと同じ科目一覧データを流し込む
        let rowSumFormulas = [];
        let nextColSubjects = [];
        for (let r = 3; r <= 23; r++) {
            const startL = 'D';
            const endL = getColumnLetter(lastUserCol);
            rowSumFormulas.push([`=SUM(${startL}${r}:${endL}${r})`]);
            nextColSubjects.push([fullCValues[r-2][0]]); // 同じ科目名
        }

        batchValueData.push({
            range: `科目別合計!${skippedColLetter}3:${skippedColLetter}23`,
            values: rowSumFormulas
        });
        batchValueData.push({
            range: `科目別合計!${skippedColLetter}25`,
            values: [[`=SUM(${skippedColLetter}3:${skippedColLetter}23)`]]
        });

        // 隣の列（Cと同じ科目一覧構造）
        batchValueData.push({
            range: `科目別合計!${nextColLetter}3:${nextColLetter}23`,
            values: nextColSubjects
        });
        batchValueData.push({
            range: `科目別合計!${nextColLetter}25`,
            values: [['合計']]
        });

        // まとめて一括書き込み
        await gapi.client.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: newSheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: batchValueData
            }
        });

        // 7. ログ管理シートへの登録・更新処理
        const newRow = [newSheetTitle, newSheetUrl, new Date().toLocaleString()];
        let finalRows = [newRow];
        
        for (let [sheetId, row] of uniqueSheetMap) {
            if (sheetId !== newSheetId) {
                finalRows.push(row);
            }
        }

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: logSheetId,
            range: `${logFirstSheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [header, ...finalRows]
            }
        });

        document.getElementById('content').innerText = 
            `処理完了！\n先頭に「科目別合計」シートを作成し、指定された数式や科目一覧、合計列の自動配置を行いました。`;

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
