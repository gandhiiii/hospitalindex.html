module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.on('ambulance:location', (data) => io.emit('ambulance:location', data));
    socket.on('ambulance:status', (data) => io.emit('ambulance:status', data));
    socket.on('gate:entry', (data) => io.emit('gate:entry', data));
    socket.on('task:update', (data) => io.emit('task:update', data));
    socket.on('inventory:update', (data) => io.emit('inventory:update', data));
    socket.on('complaint:new', (data) => io.emit('complaint:new', data));
    socket.on('problem:update', (data) => io.emit('problem:update', data));
    socket.on('dashboard:refresh', () => io.emit('dashboard:refresh'));
    socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
  });
};
