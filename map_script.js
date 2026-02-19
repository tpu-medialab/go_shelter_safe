const fs = require('fs');
const axios = require('axios');
require('dotenv').config(); // 環境変数を読み込む

// --- 設定 ---
// 修正: APIキーを環境変数からのみ取得するように変更
const API_KEY = process.env.GOOGLE_MAPS_API_KEY; 

const INPUT_FILE = "data/atsugi_shelters_extracted.json";
const OUTPUT_FILE = "data/map_data.json";
const GEOCODE_API_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/**
 * 指定ミリ秒処理を停止する (API制限対策)
 * @param {number} ms - 停止時間（ミリ秒）
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 緯度・経度を使用してリバースジオコーディングを行い、住所を取得する
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 * @returns {Promise<string>} 住所文字列またはエラーメッセージ
 */
async function getAddressFromLatLng(lat, lng) {
    if (!API_KEY) {
         return "API: 環境変数にキー未設定のためスキップ";
    }
    
    const url = `${GEOCODE_API_URL}?latlng=${lat},${lng}&key=${API_KEY}&language=ja`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data.status === "OK" && data.results.length > 0) {
            return data.results[0].formatted_address;
        } else if (data.status === "ZERO_RESULTS") {
            return "API: 住所が見つかりませんでした";
        } else {
            return `APIエラー: ${data.status} - ${data.error_message || '不明なエラー'}`;
        }
    } catch (error) {
        return `リクエストエラー: ${error.message}`;
    }
}

/**
 * 入力JSONファイルを読み込み、リバースジオコーディングAPI処理を実行し、
 * 地図表示用の整形されたデータ配列を生成する (データ処理の責務)
 * @param {string} filename - 処理する入力JSONファイル名
 * @returns {Promise<{mapPoints: Array<Object>, processedCount: number}> | null} 地図データと処理件数、またはエラーの場合はnull
 */
async function processShelterData(filename) {
    console.log(`[START] JSONファイル '${filename}' の処理を開始します。`);
    let locations;
    // 1. ファイル読み込みとパース
    try {
        const fileContent = fs.readFileSync(filename, 'utf-8');
        locations = JSON.parse(fileContent);
    } catch (error) {
        console.error(`[ERROR] ファイル操作エラー: ${error.message}`);
        return null;
    }

    if (!Array.isArray(locations)) {
        console.error("[ERROR] JSONのルート要素はリスト（配列）である必要があります。");
        return null;
    }

    const mapPoints = []; // 地図表示用のデータを格納する配列
    let processedCount = 0;

    // 2. データ処理とAPIコール
    for (let i = 0; i < locations.length; i++) {
        const item = locations[i];
        
        const itemId = i + 1; 
        //修正: 緯度・経度をparseFloatで数値に変換してAPIに渡すように修正 (ロバスト性向上)
        const latitude = parseFloat(item['緯度']); 
        const longitude = parseFloat(item['経度']);
        const name = item['名称'];     
        const originalAddress = item['住所'];

        if (!isNaN(latitude) && !isNaN(longitude) && name) {
            
            const apiAddress = await getAddressFromLatLng(latitude, longitude);
            
            // 結果を整形
            mapPoints.push({
                title: name, 
                lat: latitude,
                lng: longitude,
                original_address: originalAddress,
                api_address: apiAddress,
                level: item['レベル'],
                category: item['災害区分'] 
            });

            console.log(`[INFO] ID: ${itemId} (${name}) - 処理完了。住所: ${apiAddress}`);
            processedCount++;
            await sleep(500); // API制限回避のため0.5秒待機
        } else {
            console.warn(`[WARN] ID: ${itemId} のデータに必要な情報（名称, 緯度, 経度）が不足しているか、座標が不正です。スキップします。`);
        }
    }
    return { mapPoints, processedCount };
}

/**
 * 地図データ配列をJSONファイルに出力する (ファイル書き込みの責務)
 * @param {Array<Object>} mapPoints - 地図表示用のデータ配列
 * @param {number} processedCount - 処理されたアイテム数
 * @param {string} outputFilename - 出力JSONファイル名
 */
function saveMapDataToFile(mapPoints, processedCount, outputFilename) {
    try {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mapPoints, null, 2), 'utf-8');
        console.log(`\n [SUCCESS] 処理完了。${processedCount}件の地図データが '${OUTPUT_FILE}' に保存されました。`);
    } catch (error) {
        console.error(`[ERROR] 出力ファイル書き込みエラー: ${error.message}`);
    }
}

/**
 * メインの実行フロー (全体制御の責務)
 */
async function main() {
    const result = await processShelterData(INPUT_FILE);

    if (result) {
        saveMapDataToFile(result.mapPoints, result.processedCount, OUTPUT_FILE);
    } else {
        console.log("\n[ABORT] データ処理中にエラーが発生したため、ファイルへの書き込みをスキップしました。");
    }
}

// 実行
main();