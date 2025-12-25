const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); 

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

// 2. [추가된 로직] 서버 실행 시 DB 연결 상태 즉시 확인
pool.getConnection()
    .then(connection => {
        console.log("✅ AWS RDS 연결 성공!");
        connection.release();
    })
    .catch(err => {
        console.error("❌ DB 연결 실패! 비밀번호나 보안그룹 설정을 확인하세요.");
        console.error("상세 에러:", err.message);
    });

// ------------------------------------------------------------
// ✅ 이미지 파일 업로드 API
// ------------------------------------------------------------
app.post('/upload-flower', (req, res) => {
    const { location, image } = req.body;
    if (!image) return res.status(400).send("이미지 데이터가 없습니다.");

    const base64Data = image.replace(/^data:image\/png;base64,/, "");
    const dir = path.join(__dirname, 'assets', 'flowers', location);
    
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'flower.png');

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

// 실시간 꽃 수신 및 DB 저장
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

            io.emit('to_unity', { ...data, gardenX, gardenZ }); 
            console.log("💾 DB 저장 및 유니티 신호 발송:", data.userName);
        } catch (err) { 
            console.error("❌ DB 저장 중 에러 발생:", err.message); 
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
});

// ------------------------------------------------------------
// ✅ 모든 꽃 데이터 불러오기 API (정원용)
// ------------------------------------------------------------
app.get('/all-flowers', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                userName,
                location,
                gardenX,
                gardenZ,
                unityData,
                previewImage
            FROM flowers
            ORDER BY id DESC
        `);

        // unityData JSON 파싱
        const parsedRows = rows.map(row => ({
            ...row,
            unityData: JSON.parse(row.unityData)
        }));

        res.json(parsedRows);
        console.log(`🌸 꽃 ${parsedRows.length}개 전송 완료`);
    } catch (err) {
        console.error("❌ /all-flowers 에러:", err);
        res.status(500).json({ error: err.message });
    }
});
