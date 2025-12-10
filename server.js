const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require("cors");
const path = require('path');

const app = express();
app.use(cors());

// public 폴더 정적 서빙
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('접속 ID:', socket.id);

  socket.on('submit_flower', (data) => {
    console.log("받은 꽃 데이터:", data);
    io.emit('to_unity', data);   // Unity로 전달
  });
});

// 반드시 0.0.0.0 로!!
server.listen(3000, "0.0.0.0", () => {
  console.log('SERVER ON!');
});
