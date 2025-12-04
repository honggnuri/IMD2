const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require("cors");
const path = require('path');

const app = express();
app.use(cors());

// [ 핵심 ] public 폴더를 웹사이트 메인으로 설정!
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
    io.emit('to_unity', data);
  });
});

server.listen(3000, () => {
  console.log('SERVER ON!');
});
