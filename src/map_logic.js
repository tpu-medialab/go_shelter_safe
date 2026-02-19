//サーバー設定に合わせてデータファイルのパスを変更
const DATA_FILE = '/data/map_data.json'; 
const FLOODING_FILES = [
    '/data/honnatugieki.geojson',
    '/data/jikkenn.geojson',
    //'/data/',
];

// 初期固定の現在地の設定
const FIXED_CURRENT_LOCATION = { 
    lat: 35.44004536203736,
    lng: 139.3644045490304, 
    title: "本厚木駅北口広場" // 厚木市内の固定位置
};

let map;
let infoWindow; 
let nearestShelter = null; 
let directionsService;
let directionsRenderer;
let geocoder;
let currentLocationMarker = null;
let currentLocation = FIXED_CURRENT_LOCATION;

/**
 * Google Maps APIのロード完了後に呼び出される初期化関数
 */
async function initMap() {
    const { Map } = await google.maps.importLibrary("maps");
    
    map = new Map(document.getElementById("map"), {
        zoom: 14, 
        center: currentLocation,
        mapId: "DEMO_MAP_ID" // デモ用Map ID
    });
    
    // ジオコーディングサービスを初期化
    
    infoWindow = new google.maps.InfoWindow();
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ map: map });

    drawFixedCurrentLocationMarker(currentLocation);

    map.data.setStyle(styleFeature);

    loadDataAndDrawMarkers(); 
    loadFloodingData();
    geocoder = new google.maps.Geocoder(); 
    console.log("地図の初期化が完了しました。");
 
}



/**
 * 入力された住所を座標に変換し、最寄りの避難所を再計算する
 */
async function updateCurrentLocationFromInput() {
    const address = document.getElementById('start').value;
    
    // geocoderが準備できているかチェック
    if (!geocoder) {
        geocoder = new google.maps.Geocoder();
    }

    return new Promise((resolve, reject) => {
        geocoder.geocode({ address: address }, (results, status) => {
            if (status === 'OK') {
                // 座標を更新
                const newPos = {
                    lat: results[0].geometry.location.lat(),
                    lng: results[0].geometry.location.lng(),
                    title: address
                };
                currentLocation = newPos;
                
                // 地図の中心を移動し、現在地マーカーを再描画
                if (map) {
                    map.setCenter(newPos);
                    drawFixedCurrentLocationMarker(newPos);
                
                    resolve(newPos);
                }
            } else {
                alert('場所が見つかりませんでした: ' + status);
                reject(status);
            }
        });
    });
}

/**
 * ボタンが押された時のメイン処理
 */
async function handleSearchClick() {
    try {
        // 1. 入力された住所から座標を取得
        const newPos = await updateCurrentLocationFromInput();
        
        //古いピンを消す
        drawFixedCurrentLocationMarker(newPos);

        // 新しい現在地から、全避難所データを読み込み直して最寄りを再計算
        const locations = await loadShelterData();
        if (locations) {
            // findNearestShelter内で currentLocation を使うように修正が必要（後述）
            nearestShelter = findNearestShelter(locations);
            updateNearestShelterUI(nearestShelter);
            
            //  ルートを表示
            showRouteToNearest();
        }
    } catch (error) {
        console.error("検索プロセス中にエラーが発生しました:", error);
    }
}

/**
 * 現在地のマーカーを描画
 */
function drawFixedCurrentLocationMarker(pos) {
    
    //既にマーカが表示されているなら無くす
    if (currentLocationMarker) {
        currentLocationMarker.map = null; 
    }

    // カスタムピン要素を作成（緑色）
    const pinContent = new google.maps.marker.PinElement({ 
        background: '#4CAF50', // 緑
        borderColor: '#2E7D32',
        glyphColor: '#fff',
        scale: 1.2
    }).element;

    currentLocationMarker = new google.maps.marker.AdvancedMarkerElement({
        map: map,
        position: pos,
        title: pos.title,
        content: pinContent,
    });
    
    currentLocationMarker.addListener('click', () => {
        infoWindow.setContent(`<div style="padding: 10px;"><h3>${pos.title} (現在地)</h3><p>緯度: ${pos.lat.toFixed(4)}, 経度: ${pos.lng.toFixed(4)}</p></div>`);
        infoWindow.open(map, currentLocationMarker);
    });
}

/**
 * 避難所データをJSONファイルから読み込む (Data Loadingの責任)
 * @returns {Promise<Array<Object> | null>} 避難所データの配列、またはエラーの場合はnull
 */
async function loadShelterData() {
    try {
        const response = await fetch(DATA_FILE); 
        if (!response.ok) {
            throw new Error(`ファイルの読み込みに失敗しました: ${response.statusText} (ステータス: ${response.status}。サーバーのファイルパスを確認してください)`);
        }
        const locations = await response.json();

        if (locations.length === 0) {
            console.warn("描画する避難所データがJSONファイルに含まれていません。");
            document.getElementById('nearest-shelter-name').textContent = "データなし。JSONファイルを確認してください。";
            return null;
        }
        return locations;

    } catch (error) {
        console.error("避難所データの読み込み中にエラーが発生しました:", error);
        document.getElementById('nearest-shelter-name').textContent = `データ読み込みエラー。コンソールを確認してください: ${error.message.substring(0, 50)}...`;
        document.getElementById('show-route-button').disabled = true;
        return null;
    }
}


/**
 * 複数のGeoJSON浸水データを並行で読み込み、Dataレイヤーに追加する
 */
async function loadFloodingData() { 
    
    
    if (!Array.isArray(FLOODING_FILES) || FLOODING_FILES.length === 0) {
        console.warn("FLOODING_FILESが定義されていないか、空の配列です。");
        return;
    }

    try {
        //Promise.allを使って全てのファイルを並行でフェッチ
        const fetchPromises = FLOODING_FILES.map(filePath => {
            if (!filePath || filePath.trim() === '') return Promise.resolve(null); // パスが空の場合はスキップ
            
            return fetch(filePath)
                .then(response => {
                    if (!response.ok) {
                        // 読み込み失敗時はエラーをスロー
                        throw new Error(`ファイル '${filePath}' の読み込み失敗: ${response.status} ${response.statusText}`);
                    }
                    return response.json(); // JSONとしてパース
                })
                .catch(error => {
                    // 個別のファイルエラーをここでキャッチし、警告としてログに出す
                    console.warn(error.message);
                    return null; // 失敗したファイルは null を返す
                });
        });

        //全てのPromiseが解決するのを待つ (成功または null)
        const allGeoJsons = await Promise.all(fetchPromises);
        
        //正常に取得できたGeoJSONデータのみを地図に追加
        allGeoJsons.forEach(geojson => {
            if (geojson) {
                map.data.addGeoJson(geojson);
                console.log(`GeoJSONデータを地図に追加しました。`);
            }
        });

    } catch (error) {
        // Promise.all 内で発生した予期せぬクリティカルなエラーをキャッチ
        console.error("浸水データファイルの処理中にクリティカルなエラーが発生しました:", error);
    }
}

/*
function loadFloodingData() {
    fetch(FLOODING_FILES)
        .then(response => {
            if (!response.ok) {
                // ファイルが見つからない、またはサーバーエラーの場合
                console.error(`GeoJSONファイルの読み込みに失敗しました: ${response.status} ${response.statusText}`);
                throw new Error('WaterBody.geojsonの読み込みエラー');
            }
            return response.json();
        })
        .then(geojson => {
            // GeoJSONオブジェクトをDataレイヤーに追加
            map.data.addGeoJson(geojson);
        })
        .catch(error => {
            console.error("浸水データのロード中にエラーが発生しました:", error);
            // ユーザーにエラーを通知するUI処理をここに追加できます
        });

}
 
*/

// 浸水ランクに基づいて色を返す関数
function styleFeature(feature) {
  var rank = feature.getProperty('rank'); // QGISで特定した属性名を使う
  var color;

  // ランク値に基づいて色を設定
  switch (rank) {
    case '1':
      color = '#e8f900ff'; // 比較的浅い
      break;
    case '2':
      color = '#f40404ff'; // 中程度
      break;
    case '3':
      color = '#8c09ffff'; // やや深い
      break;
    case '4':
      color = '#020007ff'; // 非常に深い
      break;
    default:
      
  }

  return {
    fillColor: color, // 塗りつぶしの色
    strokeWeight: 0,  // 境界線の太さ
    fillOpacity: 0.7  // 透明度
  };
}


/**
 * 避難所データに基づいて地図上にマーカーを描画する (マーカー描画の責務)
 * @param {Array<Object>} locations - 避難所データの配列
 * @param {Object} nearestShelter - 最も近い避難所データ
 */
function drawShelterMarkers(locations, nearestShelter) {
    locations.forEach(point => {
        const isNearestLevel0 = nearestShelter && point.title === nearestShelter.title;

        if (isNearestLevel0) {
            //最も近いレベル0の避難所 
            background = '#F44336'; // 赤
            borderColor = '#D32F2F';
        } else if (point.level === 2) {
            //レベル2の避難所
            background = '#FF9800'; // オレンジ
            borderColor = '#EF6C00';
        } else if (point.level === 1) {
            //レベル1の避難所 
            background = '#4CAF50'; // 緑
            borderColor = '#2E7D32';
        } else {
            //レベル0だが最寄ではない避難所
            background = '#2196F3'; // 青
            borderColor = '#1976D2';
        }
        
        const pinElement = new google.maps.marker.PinElement({ 
            background: background,
            borderColor: borderColor, 
            glyphColor: '#fff', 
            scale: isNearestLevel0 ? 1.2 : 1.0 // 最寄りのみ拡大
        });

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: { lat: point.lat, lng: point.lng },
            title: point.title,
            content: pinElement.element
        });

        marker.addListener('click', () => {
            infoWindow.setContent(`
                <div style="padding: 10px; min-width: 250px;">
                    <h3>${isNearest ? '最寄りの避難所: ' : '避難所: '}${point.title}</h3>
                    <p style="margin: 5px 0;"><strong>災害区分:</strong> ${point.category || '不明'}</p>
                    <hr style="border-top: 1px solid #eee; margin: 10px 0;">
                    <p><strong>住所:</strong> ${point.api_address || point.original_address}</p>
                </div>
            `);
            
            infoWindow.open(map, marker);
        });
    });
}

/**
 * 最近傍避難所の情報を抽出してUIを更新する (UI更新の責務)
 * @param {Object} nearestShelter - 最も近い避難所データ
 */
function updateNearestShelterUI(nearestShelter) {
    const distanceKm = (nearestShelter.distance / 1000).toFixed(2);
    document.getElementById('nearest-shelter-name').textContent = `${nearestShelter.title} (直線距離: ${distanceKm} km)`;
    document.getElementById('show-route-button').disabled = false;
}

/**
 * データの処理結果をハンドリングし、状態を更新する (State Management & Orchestrationの責務)
 * データを計算し、結果に基づいて描画・UI更新を実行する。
 * @param {Array<Object> | null} locations - 避難所データの配列、またはnull
 */
function handleShelterDataResult(locations) {
    if (!locations) {
        // データロードエラーはloadShelterData内で処理済み
        return; 
    }
    
    // 1. 最も近い避難所を計算
    const calculatedNearestShelter = findNearestShelter(locations);
    
    // 2. 計算結果の検証
    if (!calculatedNearestShelter) {
        console.error("最近傍避難所の計算に失敗しました。避難所データが存在しないか、不正です。");
        document.getElementById('nearest-shelter-name').textContent = "最近傍避難所が見つかりません。";
        document.getElementById('show-route-button').disabled = true;
        return; 
    }
    
    // 3. モジュールスコープの変数 nearestShelter を更新 (状態更新)
    nearestShelter = calculatedNearestShelter;

    // 4. マーカーの描画とUIの更新を実行 (Orchestration)
    drawShelterMarkers(locations, nearestShelter);
    updateNearestShelterUI(nearestShelter);
}


/**
 * JSONデータを取得し、その結果を処理関数に渡す (I/Oと非同期処理の責任)
 */
async function loadDataAndDrawMarkers() {
    const locations = await loadShelterData();
    
    // データ取得の結果を処理関数に渡す
    handleShelterDataResult(locations); 
    // loadShelterData内でエラー/警告処理が行われるため、ここでは終了
}
        
/**
 * 現在地から最も近い浸水に適した避難所を計算する
 * @param {Array<Object>} shelters - 避難所データの配列
 * @returns {Object} 最も近い避難所データ
 */
function findNearestShelter(shelters) {
    const currentPos = currentLocation; 
    let minDistance = Infinity;
    let nearest = null;

    // 1. レベル0の避難所のみにフィルタリング
    const level0Shelters = shelters.filter(shelter => shelter.level === 0);

    // フィルタリングされたリストに対して実行を行う
    level0Shelters.forEach(shelter => {
        // 緯度・経度オブジェクトを作成
        const shelterPos = new google.maps.LatLng(shelter.lat, shelter.lng);
        const currentLatLng = new google.maps.LatLng(currentPos.lat, currentPos.lng);
        

        // 2点間の距離をメートルで計算
        const distanceInomMeters = google.maps.geometry.spherical.computeDistanceBetween(currentLatLng, shelterPos);

        if (distanceInomMeters < minDistance) {
            minDistance = distanceInomMeters;
            nearest = { ...shelter, distance: distanceInomMeters }; // 距離情報も追加して格納
        }
    });
    
    return nearest;
}


/**
 * 最も近い避難所へのルート計算を開始 (index.htmlのボタンから呼び出される)
 */
function showRouteToNearest() {
    if (!nearestShelter) {
        // カスタムUIを使用する
        document.getElementById('route-details').innerHTML = 
            `<span style="color: red;">最も近い避難所が見つかりませんでした。データが正常にロードされているか確認してください。</span>`;
        return;
    }

    // ルート計算を実行し、結果を待ってから描画関数を呼び出す
    calculateRoute(nearestShelter)
        .then(({ response, status }) => {
            displayRouteResult(response, status, nearestShelter.title);
        })
        .catch(error => {
            console.error('ルート計算中に予期せぬエラー:', error);
            document.getElementById('route-details').innerHTML = 
                `<span style="color: red;">ルート計算中にエラーが発生しました。</span>`;
        });
}

/**
 * Directions Service を使用して最短経路の計算のみを行う（非同期）
 * @param {Object} destination - 目的地の避難所データ
 * @returns {Promise<{response: google.maps.DirectionsResult, status: google.maps.DirectionsStatus}>} ルート計算結果とステータス
 */
function calculateRoute(destination) {
    return new Promise((resolve, reject) => {
        // ルート検索リクエストの設定
        const request = {
            origin: new google.maps.LatLng(currentLocation.lat, currentLocation.lng), 
            destination: new google.maps.LatLng(destination.lat, destination.lng),
            travelMode: google.maps.TravelMode.WALKING, // 避難経路なので徒歩を指定
            unitSystem: google.maps.UnitSystem.METRIC, // メートル法を指定
        };
        
        // Directions Serviceにリクエストを送信
        directionsService.route(request, (response, status) => {
            if (status === google.maps.DirectionsStatus.OK || status === google.maps.DirectionsStatus.ZERO_RESULTS) {
                // OKまたは結果なし（ZERO_RESULTS）の場合も成功として処理を続行
                resolve({ response, status });
            } else {
                // APIエラーなどで失敗した場合
                reject(status);
            }
        });
    });
}


/**
 * ルート計算の結果を地図上に描画し、UIを更新する
 * @param {google.maps.DirectionsResult} response - Directions Serviceからのレスポンス
 * @param {google.maps.DirectionsStatus} status - Directions Serviceからのステータス
 * @param {string} destinationTitle - 目的地の名称
 */
function displayRouteResult(response, status, destinationTitle) {
    const routeDetailsElement = document.getElementById('route-details');

    if (status === google.maps.DirectionsStatus.OK) {
        // 成功した場合、DirectionsRendererを使って地図にルートを描画
        directionsRenderer.setDirections(response);

        // ルート情報を抽出して表示
        const route = response.routes[0].legs[0];
        const distance = route.distance.text;
        const duration = route.duration.text;
        
        routeDetailsElement.innerHTML = 
            `最短経路（徒歩）: ${destinationTitle} へ 距離 ${distance}、時間 ${duration} で到着します。`;
        
    } else {
        // 失敗または結果なしの場合
        directionsRenderer.setDirections({ routes: [] }); // 既存のルートをクリア
        routeDetailsElement.innerHTML = 
            `<span style="color: red;">${destinationTitle}への最短経路の計算に失敗しました: ${status}</span>`;
        console.error('Directions request failed due to ' + status);
    }
}

// APIコールバックのために initMap と showRouteToNearest をウィンドウオブジェクトにアタッチ
window.initMap = initMap;
window.showRouteToNearest = showRouteToNearest;