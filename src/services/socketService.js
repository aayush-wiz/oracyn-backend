const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const socketHandlers = (io) => {
  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userEmail = decoded.email;
      
      logger.info(`Socket authenticated for user: ${decoded.email}`);
      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Handle new connections
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userEmail = socket.userEmail;
    
    logger.info(`User connected via socket: ${userEmail} (${socket.id})`);
    
    // Join user-specific room for targeted messages
    socket.join(`user_${userId}`);
    
    // Emit connection confirmation
    socket.emit('connected', {
      message: 'Connected to RAG Document Analyzer',
      userId,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    // Handle joining specific rooms
    socket.on('join_room', (data) => {
      const { room } = data;
      if (room && typeof room === 'string') {
        socket.join(room);
        logger.info(`User ${userEmail} joined room: ${room}`);
        socket.emit('room_joined', { room, timestamp: new Date().toISOString() });
      }
    });

    // Handle leaving specific rooms
    socket.on('leave_room', (data) => {
      const { room } = data;
      if (room && typeof room === 'string') {
        socket.leave(room);
        logger.info(`User ${userEmail} left room: ${room}`);
        socket.emit('room_left', { room, timestamp: new Date().toISOString() });
      }
    });

    // Handle file processing subscription
    socket.on('subscribe_file_processing', (data) => {
      const { fileId } = data;
      if (fileId) {
        const room = `file_${fileId}`;
        socket.join(room);
        logger.info(`User ${userEmail} subscribed to file processing: ${fileId}`);
        socket.emit('file_processing_subscribed', { 
          fileId, 
          room,
          timestamp: new Date().toISOString() 
        });
      }
    });

    // Handle file processing unsubscription
    socket.on('unsubscribe_file_processing', (data) => {
      const { fileId } = data;
      if (fileId) {
        const room = `file_${fileId}`;
        socket.leave(room);
        logger.info(`User ${userEmail} unsubscribed from file processing: ${fileId}`);
        socket.emit('file_processing_unsubscribed', { 
          fileId, 
          room,
          timestamp: new Date().toISOString() 
        });
      }
    });

    // Handle query processing subscription
    socket.on('subscribe_query_processing', (data) => {
      const { queryId } = data;
      if (queryId) {
        const room = `query_${queryId}`;
        socket.join(room);
        logger.info(`User ${userEmail} subscribed to query processing: ${queryId}`);
        socket.emit('query_processing_subscribed', { 
          queryId, 
          room,
          timestamp: new Date().toISOString() 
        });
      }
    });

    // Handle heartbeat/ping
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle client status updates
    socket.on('client_status', (data) => {
      logger.info(`Client status from ${userEmail}:`, data);
      // Broadcast to user's other sessions if needed
      socket.to(`user_${userId}`).emit('user_status_update', {
        userId,
        status: data,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle custom events that might be sent from AI service
    socket.on('ai_service_event', (data) => {
      // Relay events from AI service to appropriate users/rooms
      const { targetRoom, event, payload } = data;
      if (targetRoom && event && payload) {
        io.to(targetRoom).emit(event, payload);
        logger.info(`AI service event relayed to room ${targetRoom}: ${event}`);
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`User disconnected: ${userEmail} (${socket.id}) - Reason: ${reason}`);
      
      // Notify user's other sessions about disconnection
      socket.to(`user_${userId}`).emit('session_disconnected', {
        socketId: socket.id,
        reason,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle connection errors
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${userEmail}:`, error);
      socket.emit('error_occurred', {
        message: 'A connection error occurred',
        timestamp: new Date().toISOString(),
      });
    });
  });

  // Helper function to emit to specific user
  const emitToUser = (userId, event, data) => {
    io.to(`user_${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  };

  // Helper function to emit to specific room
  const emitToRoom = (room, event, data) => {
    io.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  };

  // Helper function to get connected users count
  const getConnectedUsersCount = async () => {
    const sockets = await io.fetchSockets();
    return sockets.length;
  };

  // Helper function to get user's active sessions
  const getUserActiveSessions = async (userId) => {
    const sockets = await io.in(`user_${userId}`).fetchSockets();
    return sockets.map(socket => ({
      socketId: socket.id,
      connectedAt: socket.handshake.time,
    }));
  };

  // Broadcast system notifications
  const broadcastSystemNotification = (notification) => {
    io.emit('system_notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
    logger.info('System notification broadcasted:', notification.message);
  };

  // Handle server shutdown gracefully
  process.on('SIGTERM', () => {
    logger.info('Gracefully closing Socket.IO server...');
    io.close(() => {
      logger.info('Socket.IO server closed');
    });
  });

  // Return helper functions for use in other parts of the application
  return {
    emitToUser,
    emitToRoom,
    getConnectedUsersCount,
    getUserActiveSessions,
    broadcastSystemNotification,
  };
};

module.exports = socketHandlers; 