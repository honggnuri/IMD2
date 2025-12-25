const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs'); // ✅ 파일 시스템 추가

const app = express();
app.use(cors());
// ✅ 이미지(Base64)는 용량이 크므로 제한을 늘려줍니다.
app.use(express.json({ limit: '10mb' })); 

// ✅ 1. 유니티가 이미지 파일을 읽을 수 있도록 assets 폴더 공개
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const dbConfig = {
    host: 'serverflowerdb.cbac0os8o7si.ap-southeast-2.rds.amazonaws.com',
    user: 'nurihong',
    password: 'ㅇㅇ', 
    database: 'serverflowerdb',
    waitForConnections: true,
    connectionLimit: 10
};

const pool = mysql.createPool(dbConfig);

// ------------------------------------------------------------
// ✅ 2. 이미지 파일 업로드 API 추가 (Page 8에서 호출)
// ------------------------------------------------------------
app.post('/upload-flower', (req, res) => {
    const { location, image } = req.body; // location: 'dodam' 등

    if (!image) return res.status(400).send("이미지 데이터가 없습니다.");

    // Base64 데이터 추출
    const base64Data = image.replace(/^data:image\/png;base64,/, "");
    
    // 저장 경로: assets/flowers/dodam/flower.png
    const dir = path.join(__dirname, 'assets', 'flowers', location);
    
    // 폴더가 없으면 생성
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, 'flower.png');

    // 파일 쓰기
    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
            console.error("❌ 파일 저장 실패:", err);
            return res.status(500).send("파일 저장 실패");
        }
        console.log(`📸 이미지 저장 완료: ${filePath}`);
        res.send({ message: "이미지 저장 성공" });
    });
});

// ------------------------------------------------------------
// ✅ 3. 유니티가 보낸 이미지 삭제 요청 API (Unity에서 호출)
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

// 실시간 꽃 수신 및 DB 저장 (Page 9에서 호출)
io.on('connection', (socket) => {
    socket.on('submit_flower', async (data) => {
        const gardenX = (Math.random() - 0.5) * 200;
        const gardenZ = (Math.random() - 0.5) * 200;
        try {
            const sql = `INSERT INTO flowers (userName, location, gardenX, gardenZ, unityData, previewImage) VALUES (?, ?, ?, ?, ?, ?)`;
            await pool.query(sql, [
                data.userName, data.location, gardenX, gardenZ,
                JSON.stringify(data.unityData), data.previewImage
            ]);

            // ✅ 유니티에게 DB 데이터와 함께 출력하라는 신호를 보냄
            io.emit('to_unity', { ...data, gardenX, gardenZ }); 
            console.log("💾 DB 저장 및 유니티 신호 발송:", data.userName);
        } catch (err) { console.error("❌ 저장 실패:", err); }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
});