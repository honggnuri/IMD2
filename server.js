const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json()); // JSON 파싱 미들웨어 추가

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

const pool = mysql.createPool(dbConfig);

// 서버가 살아있는지 확인하는 기본 경로 추가
app.get('/', (req, res) => {
    res.send('<h1>🌸 Sejong Bloom Server is Running!</h1><p>접속 가능 확인됨</p>');
});

pool.getConnection().then(conn => {
    console.log("✅ AWS RDS 연결 성공!");
    conn.release();
}).catch(err => {
    console.error("❌ DB 연결 실패! 정보가 정확한지 확인하세요.");
    console.error(err);
});

app.get('/all-flowers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM flowers ORDER BY id DESC');
        const formatted = rows.map(row => ({
            ...row,
            unityData: typeof row.unityData === 'string' ? JSON.parse(row.unityData) : row.unityData
        }));
        res.json(formatted);
    } catch (err) { 
        console.error("GET Error:", err);
        res.status(500).send(err.message); 
    }
});

io.on('connection', (socket) => {
    console.log('👤 신규 접속:', socket.id);

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
            io.emit('to_unity', completeData);
            console.log("💾 DB 저장 완료:", data.userName);
        } catch (err) { 
            console.error("❌ 저장 실패:", err); 
        }
    });

    socket.on('disconnect', () => console.log('👤 접속 종료:', socket.id));
});

// 포트 중복 방지 로직 (EADDRINUSE 에러 방지)
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 서버 실행 완료!
    🔗 접속 주소: http://15.134.86.182:${PORT}
    📡 모든 꽃 조회: http://15.134.86.182:${PORT}/all-flowers
    `);
});