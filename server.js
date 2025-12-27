const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

// ✅ [중요] 이미지 용량 제한을 10mb -> 50mb로 늘림 (413 에러 방지)
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const dbConfig = {
    host: 'serverflowerdb.cbac0os8o7si.ap-southeast-2.rds.amazonaws.com',
    user: 'nurihong',
    password: '10834Ghdsnfl!', 
    database: 'serverflowerdb',
    waitForConnections: true,
    connectionLimit: 10
};

// 1. 커넥션 풀 생성
const pool = mysql.createPool(dbConfig);

// 2. 서버 실행 시 DB 연결 상태 확인
pool.getConnection()
    .then(connection => {
        console.log("✅ AWS RDS 연결 성공!");
        connection.release();
    })
    .catch(err => {
        console.error("❌ DB 연결 실패! 상세 에러:", err.message);
    });

// ------------------------------------------------------------
// ✅ 이미지 파일 업로드 API (안전성 강화)
// ------------------------------------------------------------
app.post('/upload-flower', (req, res) => {
    try {
        const { location, image } = req.body;
        
        // 데이터 유효성 검사
        if (!image) return res.status(400).send("이미지 데이터가 없습니다.");
        if (!location) return res.status(400).send("location 데이터가 없습니다.");

        // Base64 헤더 유연하게 제거 (png, jpeg 등 대응)
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        
        const dir = path.join(__dirname, 'assets', 'flowers', location);
        
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, 'flower.png');

        fs.writeFile(filePath, base64Data, 'base64', (err) => {
            if (err) {
                console.error("❌ 파일 저장 실패:", err);
                return res.status(500).send("서버 파일 쓰기 에러: " + err.message);
            }
            console.log(`📸 이미지 덮어쓰기 완료 (흑백): ${filePath}`);
            res.send({ message: "이미지 저장 성공" });
        });
    } catch (e) {
        console.error("❌ 업로드 처리 중 에러:", e);
        res.status(500).send("서버 내부 에러: " + e.message);
    }
});

// ------------------------------------------------------------
// ✅ 이미지 삭제 API
// ------------------------------------------------------------
app.delete('/delete-flower/:location', (req, res) => {
    const { location } = req.params;
    const filePath = path.join(__dirname, 'assets', 'flowers', location, 'flower.png');

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ 이미지 삭제 완료: ${location}/flower.png`);
        res.send("삭제 성공");
    } else {
        res.status(404).send("파일을 찾을 수 없습니다.");
    }
});

// ------------------------------------------------------------
// ✅ 실시간 꽃 수신 및 DB 저장 (콜백 패턴 적용)
// ------------------------------------------------------------
io.on('connection', (socket) => {
    // client에서 'submit_flower'를 보내면 처리 후 callback 실행
    socket.on('submit_flower', async (data, callback) => {
        const gardenX = (Math.random() - 0.5) * 200;
        const gardenZ = (Math.random() - 0.5) * 200;
        
        try {
            const sql = `INSERT INTO flowers (userName, location, gardenX, gardenZ, unityData, previewImage) VALUES (?, ?, ?, ?, ?, ?)`;
            
            // DB 저장이 끝날 때까지 기다림 (await)
            await pool.query(sql, [
                data.userName, data.location, gardenX, gardenZ,
                JSON.stringify(data.unityData), data.previewImage
            ]);

            // 유니티 등 다른 클라이언트에게 알림
            io.emit('to_unity', { ...data, gardenX, gardenZ }); 
            console.log("💾 DB 저장 및 유니티 신호 발송 완료:", data.userName);

            // [핵심] 클라이언트에게 "성공했으니 이동해"라고 응답
            if (typeof callback === 'function') {
                callback({ status: 'ok' });
            }

        } catch (err) { 
            console.error("❌ DB 저장 중 에러 발생:", err.message);
            
            // 에러 발생 시 클라이언트에게 알림
            if (typeof callback === 'function') {
                callback({ status: 'error', message: err.message });
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
});

// ------------------------------------------------------------
// ✅ 모든 꽃 데이터 불러오기 API
// ------------------------------------------------------------
app.get('/all-flowers', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT userName, location, gardenX, gardenZ, unityData, previewImage
            FROM flowers ORDER BY id DESC
        `);
        const parsedRows = rows.map(row => ({
            ...row,
            unityData: JSON.parse(row.unityData)
        }));
        res.json(parsedRows);
    } catch (err) {
        console.error("❌ /all-flowers 에러:", err);
        res.status(500).json({ error: err.message });
    }
});