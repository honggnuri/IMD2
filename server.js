const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path'); // 경로 처리를 위해 추가

const app = express();
app.use(cors());
app.use(express.json());

// ✅ 1. public 폴더 안의 html, css, js 파일을 외부로 보여주는 설정
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// 🔴 AWS RDS 연결 설정 (비밀번호 확인 필수)
const dbConfig = {
    host: 'serverflowerdb.cbac0os8o7si.ap-southeast-2.rds.amazonaws.com',
    user: 'nurihong',
    password: '10834Ghdsnfl!', // 👈 AWS에서 새로 설정한 비밀번호로 입력
    database: 'serverflowerdb',
    waitForConnections: true,
    connectionLimit: 10
};

const pool = mysql.createPool(dbConfig);

// DB 연결 체크
pool.getConnection().then(conn => {
    console.log("✅ AWS RDS 연결 성공!");
    conn.release();
}).catch(err => {
    console.error("❌ DB 연결 실패! 로그를 확인하세요.");
    console.error(err);
});

// 모든 꽃 데이터 가져오기 API
app.get('/all-flowers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM flowers ORDER BY id DESC');
        const formatted = rows.map(row => ({
            ...row,
            unityData: typeof row.unityData === 'string' ? JSON.parse(row.unityData) : row.unityData
        }));
        res.json(formatted);
    } catch (err) { res.status(500).send(err.message); }
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
            console.log("💾 DB 저장 완료:", data.userName);
        } catch (err) { console.error("❌ 저장 실패:", err); }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
});