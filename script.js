// ==========================================
// 0. パスワード認証
// ==========================================
function checkPassword() {
    const inputVal = document.getElementById('password_input').value;
    const errorMsg = document.getElementById('password_error');

    if (inputVal === '1202') {
        document.getElementById('password_section').style.display = 'none';
        document.getElementById('main_app_content').style.display = 'block';
    } else {
        errorMsg.innerText = 'パスワードが間違っています。';
    }
}

// ==========================================
// 1. 設定エリア
// ==========================================
const CLIENT_ID = '893360002885-juvu8vp11q6si42ebojo4i483vd3sqkl.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDKcb8Ztk9C_zs5oTbNSAcSbXmyNyUEM8Q'; // Google Cloud Consoleで発行した「APIキー」を入れてください
const APP_ID = '893360002885'; // プロジェクト番号（数値）

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOCS = [
    'https://sheets.googleapis.com/$discovery/rest?version=v4',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];

let tokenClient;
let gapiInited = false;
let ginisInited = false;
let accessToken = null;

// フォルダ階層ブラウザ用の状態管理
let currentFolderStack = [{ id: 'root', name: 'マイドライブ' }];
let selectedFolderId = 'root';
let selectedFolderName = 'マイドライブ';

// ==========================================
// 2. 初期化と認証関連
// ==========================================
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
    
    switchView('menu');
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken('');
            accessToken = null;
            document.getElementById('app_section').style.display = 'none';
            document.getElementById('signout_button').style.display = 'none';
            document.getElementById('authorize_button').style.display = 'inline-block';
        });
    }
}

// ==========================================
// 3. 画面（ビュー）の切り替え管理
// ==========================================
function switchView(viewName) {
    document.getElementById('view_menu').style.display = 'none';
    document.getElementById('view_spreadsheet').style.display = 'none';
    document.getElementById('view_word').style.display = 'none';
    
    document.getElementById('content').innerText = '';
    document.getElementById('links').innerHTML = '';

    if (viewName === 'menu') {
        document.getElementById('view_menu').style.display = 'block';
    } else if (viewName === 'spreadsheet') {
        document.getElementById('view_spreadsheet').style.display = 'block';
        loadFolderContent('root', 'マイドライブ');
    } else if (viewName === 'word') {
        document.getElementById('view_word').style.display = 'block';
    }
}

// ==========================================
// 4. 階層式フォルダブラウザの処理
// ==========================================
async function loadFolderContent(folderId, folderName) {
    const listContainer = document.getElementById('folder_list_container');
    listContainer.innerHTML = '<p style="color: #666; font-size: 13px; text-align: center;">読み込み中...</p>';

    try {
        const response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
            orderBy: 'name',
            pageSize: 100
        });

        const folders = response.result.files;
        listContainer.innerHTML = '';

        if (folders && folders.length > 0) {
            folders.forEach(folder => {
                const item = document.createElement('div');
                item.className = 'folder-item';
                item.innerHTML = `📁 ${folder.name}`;
                item.onclick = () => {
                    currentFolderStack.push({ id: folder.id, name: folder.name });
                    updateBreadcrumb();
                    loadFolderContent(folder.id, folder.name);
                };
                listContainer.appendChild(item);
            });
        } else {
            listContainer.innerHTML = '<p style="color: #888; font-size: 13px; text-align: center; padding-top: 25px;">サブフォルダはありません</p>';
        }

    } catch (err) {
        console.error('フォルダの取得に失敗しました', err);
        listContainer.innerHTML = '<p style="color: red; font-size: 13px; text-align: center; padding-top: 25px;">フォルダの取得に失敗しました</p>';
    }
}

function updateBreadcrumb() {
    const breadcrumbContainer = document.getElementById('breadcrumb_container');
    breadcrumbContainer.innerHTML = '';

    currentFolderStack.forEach((folder, index) => {
        const span = document.createElement('span');
        span.className = 'breadcrumb-item';
        span.innerText = folder.name;
        span.onclick = () => {
            currentFolderStack = currentFolderStack.slice(0, index + 1);
            updateBreadcrumb();
            loadFolderContent(folder.id, folder.name);
        };
        breadcrumbContainer.appendChild(span);

        if (index < currentFolderStack.length - 1) {
            const separator = document.createElement('span');
            separator.innerText = ' > ';
            separator.style.margin = '0 3px';
            breadcrumbContainer.appendChild(separator);
        }
    });
}

function navigateToFolder(id, name) {
    currentFolderStack = [{ id: id, name: name }];
    updateBreadcrumb();
    loadFolderContent(id, name);
}

function confirmCurrentFolder() {
    const currentActiveFolder = currentFolderStack[currentFolderStack.length - 1];
    selectedFolderId = currentActiveFolder.id;
    selectedFolderName = currentActiveFolder.name;

    document.getElementById('target_folder_display').innerText = `選択中: ${selectedFolderName}`;
    alert(`保存先を「${selectedFolderName}」に決定しました！`);
}

// ==========================================
// 5. スプレッドシート作成 ＆ 完全自動構築メイン処理
// ==========================================
async function createNewSheet() {
    try {
        const currentActiveFolder = currentFolderStack[currentFolderStack.length - 1];
        const targetFolderId = selectedFolderId !== 'root' ? selectedFolderId : currentActiveFolder.id;

        const newSheetTitle = document.getElementById('sheet_title_input').value.trim() || 'カスタムデータシート';
        const rawSheetNames = document.getElementById('sheet_names_input') ? document.getElementById('sheet_names_input').value.trim() : '';
        const userSheetNames = rawSheetNames ? rawSheetNames.split(',').map(name => name.trim()).filter(name => name !== '' && name !== '科目別合計') : ['集計用'];

        document.getElementById('content').innerText = '既存のシート状態を確認・同期中...';

        let logSheetId = localStorage.getItem('app_log_sheet_id');

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

        document.getElementById('content').innerText = `「${newSheetTitle}」および各種シートを作成中...`;

        const newSheetId = await createSpreadsheetInFolder(newSheetTitle, targetFolderId);
        const newSheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;

        const newSpInfo = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: newSheetId });
        const defaultSheetId = newSpInfo.result.sheets[0].properties.sheetId;

        let requests = [{
            updateSheetProperties: {
                properties: {
                    sheetId: defaultSheetId,
                    title: '科目別合計'
                },
                fields: 'title'
            }
        }];

        for (let i = 0; i < userSheetNames.length; i++) {
            requests.push({
                addSheet: {
                    properties: {
                        title: userSheetNames[i]
                    }
                }
            });
        }

        const fixedSheets = ['活動', '活動実績・予定'];
        for (let i = 0; i < fixedSheets.length; i++) {
            requests.push({
                addSheet: {
                    properties: {
                        title: fixedSheets[i]
                    }
                }
            });
        }

        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: newSheetId,
            resource: { requests: requests }
        });

        let userSheetsBatchData = [];
        for (let i = 0; i < userSheetNames.length; i++) {
            const sName = userSheetNames[i];

            userSheetsBatchData.push({
                range: `${sName}!A1:H1`,
                values: [['物品名', '科目コード', '科目名', '単価', '個数', '合計金額', '備考', '予算資料に書く説明']]
            });

            userSheetsBatchData.push({
                range: `${sName}!C2`,
                values: [[`=ARRAYFORMULA(IFERROR(VLOOKUP(B2:B, '科目別合計'!$B$3:$C$23, 2, FALSE), ""))`]]
            });

            userSheetsBatchData.push({
                range: `${sName}!F2`,
                values: [[`=ARRAYFORMULA(IF((D2:D="")+(E2:E=""), "", D2:D * IF(E2:E="一式", 1, E2:E)))`]]
            });
        }

        let activityValues = [['部会紹介']];
        for (let i = 0; i < userSheetNames.length; i++) {
            activityValues.push([userSheetNames[i]]);
        }
        userSheetsBatchData.push({
            range: '活動!A1:A' + activityValues.length,
            values: activityValues
        });

        const gradeStartRow = activityValues.length + 2;
        userSheetsBatchData.push({
            range: `活動!A${gradeStartRow}`,
            values: [['学年ごとの現在の活動部員']]
        });

        let gradeValues = [];
        for (let g = 1; g <= 4; g++) {
            gradeValues.push([`${g}年`, 0]);
        }
        userSheetsBatchData.push({
            range: `活動!A${gradeStartRow + 1}:B${gradeStartRow + 4}`,
            values: gradeValues
        });

        const monthsA = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        let monthValuesA = monthsA.map(m => [`${m}月`]);
        userSheetsBatchData.push({
            range: '活動実績・予定!A2:A13',
            values: monthValuesA
        });

        const monthsC = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
        let monthValuesC = monthsC.map(m => [`${m}月`]);
        userSheetsBatchData.push({
            range: '活動実績・予定!C2:C13',
            values: monthValuesC
        });

        await gapi.client.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: newSheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: userSheetsBatchData
            }
        });

        // ----------------------------------------------------
        // 「備品」シートのコピー ＆ 「備品」へのリネーム処理
        // ----------------------------------------------------
        let bibinCopied = false;
        if (dataRows.length > 0 && dataRows[0][1]) {
            const prevUrl = dataRows[0][1];
            const match = prevUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (match && match[1]) {
                const prevSheetId = match[1];
                
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        if (attempt > 0) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        
                        const prevSpInfo = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: prevSheetId });
                        const prevBibinSheet = prevSpInfo.result.sheets.find(s => s.properties.title === '備品');

                        if (prevBibinSheet) {
                            const copyRes = await gapi.client.sheets.spreadsheets.sheets.copyTo({
                                spreadsheetId: prevSheetId,
                                sheetId: prevBibinSheet.properties.sheetId,
                                resource: {
                                    destinationSpreadsheetId: newSheetId
                                }
                            });
                            
                            const copiedSheetId = copyRes.result.sheetId;
                            await gapi.client.sheets.spreadsheets.batchUpdate({
                                spreadsheetId: newSheetId,
                                resource: {
                                    requests: [{
                                        updateSheetProperties: {
                                            properties: {
                                                sheetId: copiedSheetId,
                                                title: '備品'
                                            },
                                            fields: 'title'
                                        }
                                    }]
                                }
                            });

                            bibinCopied = true;
                            break;
                        }
                    } catch (e) {
                        console.warn(`過去の備品シートの取得トライ ${attempt + 1} 回目で失敗`, e);
                    }
                }
            }
        }

        if (!bibinCopied) {
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: newSheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: { title: '備品' }
                        }
                    }]
                }
            });
        }

        let bibinExists = false;
        try {
            const checkSpInfo = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: newSheetId });
            bibinExists = checkSpInfo.result.sheets.some(s => s.properties.title === '備品');
        } catch (e) {
            console.warn('シート構造の確認に失敗しました', e);
        }

        if (bibinExists) {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: newSheetId,
                range: '備品!A1:E1',
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [['取得年', '備品名', '製造所', '仕様形式', '備考']]
                }
            });
        }
        // ----------------------------------------------------

        let batchValueData = [];

        let bValues = [];
        for (let n = 11; n <= 31; n++) {
            bValues.push([n]);
        }
        batchValueData.push({
            range: '科目別合計!B3:B23',
            values: bValues
        });

        const subjects = [
            '科目一覧', 'ゼミナール・研究発表費', '講演会費', '試合・大会費', '連盟費', 
            '合宿費', '新聞・図書費', '機関紙発行費', '調査費', '会議費', 
            '印刷・記録費', '事務用消耗品費', '消耗品費', '通信・運輸費', '渉外費', 
            '借用料', '器具・用具・備品費', '修理費', '薬品医療費', '保険料', '燃料費', '手数料'
        ];
        
        let fullCValues = [];
        fullCValues.push([subjects[0]]);
        for (let i = 1; i < subjects.length; i++) {
            fullCValues.push([subjects[i]]);
        }
        fullCValues.push(['']);
        fullCValues.push(['合計']);

        batchValueData.push({
            range: '科目別合計!C2:C25',
            values: fullCValues
        });

        for (let i = 0; i < userSheetNames.length; i++) {
            const sName = userSheetNames[i];
            const currentCol = 4 + i;
            const colLetter = getColumnLetter(currentCol);

            batchValueData.push({
                range: `科目別合計!${colLetter}2`,
                values: [[sName]]
            });

            batchValueData.push({
                range: `科目別合計!${colLetter}3`,
                values: [[`=ARRAYFORMULA(SUMIF('${sName}'!B:B, SEQUENCE(21, 1, 11), '${sName}'!F:F))`]]
            });

            batchValueData.push({
                range: `科目別合計!${colLetter}25`,
                values: [[`=SUM(${colLetter}3:${colLetter}23)`]]
            });
        }

        const lastUserCol = 4 + userSheetNames.length - 1;
        const skippedCol = lastUserCol + 2;
        const skippedColLetter = getColumnLetter(skippedCol);
        const nextColLetter = getColumnLetter(skippedCol + 1);

        batchValueData.push({
            range: `科目別合計!${skippedColLetter}2`,
            values: [['合計']]
        });
        batchValueData.push({
            range: `科目別合計!${nextColLetter}2`,
            values: [['科目一覧']]
        });

        let rowSumFormulas = [];
        let nextColSubjects = [];
        for (let r = 3; r <= 23; r++) {
            const startL = 'D';
            const endL = getColumnLetter(lastUserCol);
            rowSumFormulas.push([`=SUM(${startL}${r}:${endL}${r})`]);
            nextColSubjects.push([fullCValues[r-2][0]]);
        }

        batchValueData.push({
            range: `科目別合計!${skippedColLetter}3:${skippedColLetter}23`,
            values: rowSumFormulas
        });
        batchValueData.push({
            range: `科目別合計!${skippedColLetter}25`,
            values: [[`=SUM(${skippedColLetter}3:${skippedColLetter}23)`]]
        });

        batchValueData.push({
            range: `科目別合計!${nextColLetter}3:${nextColLetter}23`,
            values: nextColSubjects
        });
        batchValueData.push({
            range: `科目別合計!${nextColLetter}25`,
            values: [['合計']]
        });

        await gapi.client.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: newSheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: batchValueData
            }
        });

        const newRow = [newSheetTitle, newSheetUrl, new Date().toLocaleString()];
        let finalRows = [newRow];
        
        for (let [sheetId, row] of uniqueSheetMap) {
            if (sheetId !== newSheetId) {
                finalRows.push(row);
            }
        }

        await gapi.client.sheets.spreadsheets.values.clear({
            spreadsheetId: logSheetId,
            range: `${logFirstSheetName}!A:C`
        });

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: logSheetId,
            range: `${logFirstSheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [header, ...finalRows]
            }
        });

        document.getElementById('content').innerText = '処理完了！スプレッドシートの構築が完了しました。';

        const linksDiv = document.getElementById('links');
        linksDiv.innerHTML = `
            <a href="https://docs.google.com/spreadsheets/d/${logSheetId}/edit" target="_blank">📊 ログ管理シートを開く</a>
            <a href="${newSheetUrl}" target="_blank">📄 新しく作った「${newSheetTitle}」を開く</a>
            <br><br>
            <button onclick="switchView('menu')" class="btn-green" style="display: inline-block;">メニューに戻る</button>
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

async function createSpreadsheetInFolder(title, folderId) {
    const resource = {
        name: title,
        mimeType: 'application/vnd.google-apps.spreadsheet'
    };
    if (folderId && folderId !== 'root' && folderId !== '') {
        resource.parents = [folderId];
    }

    const response = await gapi.client.drive.files.create({
        resource: resource,
        fields: 'id, webViewLink'
    });
    return response.result.id;
}

function getColumnLetter(colIndex) {
    let temp, letter = '';
    while (colIndex > 0) {
        temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 1) / 26;
    }
    return letter;
}
