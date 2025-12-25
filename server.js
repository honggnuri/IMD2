const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// 🔴 AWS RDS 연결 설정 (본인 정보로 수정 필수)
const dbConfig = {
    host: 'serverflowerdb.cbac0os8o7si.ap-southeast-2.rds.amazonaws.com',
    user: 'nurihong',
    password: '10834홍누리!', // 👈 여기에 실제 비밀번호 입력
    database: 'serverflowerdb',
    waitForConnections: true,
    connectionLimit: 10
};

const pool = mysql.createPool(dbConfig);

// DB 연결 체크
pool.getConnection().then(conn => {
    console.log("✅ AWS RDS 연결 성공!");
    conn.release();
}).catch(err => console.error("❌ DB 연결 실패:", err));

// 1. 모든 꽃 데이터 가져오기
app.get('/all-flowers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM flowers ORDER BY id DESC');
        const formatted = rows.map(row => ({
            ...row,
            unityData: JSON.parse(row.unityData)
        }));
        res.json(formatted);
    } catch (err) { res.status(500).send(err.message); }
});

// 2. 소켓 통신 및 DB 저장
io.on('connection', (socket) => {
    socket.on('submit_flower', async (data) => {
        const gardenX = (Math.random() - 0.5) * 200;
        const gardenZ = (Math.random() - 0.5) * 200;
        const completeData = { ...data, gardenX, gardenZ };

        try {
            const sql = `INSERT INTO flowers (userName, location, gardenX, gardenZ, unityData, previewImage) VALUES (?, ?, ?, ?, ?, ?)`;
            await pool.query(sql, [
                data.userName, data.location, gardenX, gardenZ,
                JSON.stringify(data.unityData), data.previewImage
            ]);
            io.emit('to_unity', completeData); // 모든 클라이언트에 전송
            console.log("💾 DB 저장 및 전송 완료:", data.userName);
        } catch (err) { console.error("❌ 저장 실패:", err); }
    });
});

server.listen(3000, () => console.log("🚀 Server running on port 3000"));