
import { API_BASE_URL } from '../config';
import { getAuthHeaders, handleResponse } from '../utils/apiClient';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

let socket = null; // Initialize socket as null

const initializeSocket = async () => {
  if (socket && socket.connected) {
    console.log('Frontend: Socket already connected, skipping re-initialization.');
    return;
  }

  const token = await AsyncStorage.getItem('userToken');
  if (!token) {
    console.warn("Frontend: No token found for socket connection. Socket will connect without authentication.");
    // If no token, connect without auth, but expect authentication errors from backend
    socket = io(API_BASE_URL, {
      transports: ['websocket'],
      withCredentials: true,
    });
  } else {
    socket = io(API_BASE_URL, {
      transports: ['websocket'],
      withCredentials: true,
      auth: {
        token: token,
      },
    });
  }

  socket.on('connect', () => {
    console.log('Frontend: Socket connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Frontend: Socket disconnected');
  });

  socket.on('connect_error', (err) => {
    console.error('Frontend: Socket connection error:', err.message);
  });
};

export const registerSocket = async (userId) => {
  await initializeSocket(); // Ensure socket is initialized with token
  if (socket.connected) {
    socket.emit('register', userId);
  } else {
    socket.on('connect', () => {
      socket.emit('register', userId);
    });
  }
};

export const joinConversationSocket = (conversationId) => {
  if (socket) {
    socket.emit('joinConversation', conversationId);
  } else {
    console.warn('Socket not initialized. Cannot join conversation.');
  }
};

export const leaveConversationSocket = (conversationId) => {
  if (socket) {
    socket.emit('leaveConversation', conversationId);
  } else {
    console.warn('Socket not initialized. Cannot leave conversation.');
  }
};

export const sendMessageSocket = (payload) => {
  if (socket) {
    socket.emit('sendMessage', payload);
  } else {
    console.warn('Socket not initialized. Cannot send message via socket.');
  }
};

export const onNewMessage = (callback) => {
  if (socket) {
    socket.on('newMessage', callback);
  } else {
    console.warn('Socket not initialized. Cannot set newMessage listener.');
  }
};

export const onMessageRead = (callback) => {
  if (socket) {
    socket.on('messageRead', callback);
  } else {
    console.warn('Socket not initialized. Cannot set messageRead listener.');
  }
};

export const onTyping = (callback) => {
  if (socket) {
    socket.on('typing', callback);
  } else {
    console.warn('Socket not initialized. Cannot set typing listener.');
  }
};

export const onUserOnlineStatus = (callback) => {
  if (socket) {
    socket.on('userOnlineStatus', callback);
  } else {
    console.warn('Socket not initialized. Cannot set userOnlineStatus listener.');
  }
};

export const emitTyping = (conversationId, userId, isTyping) => {
  if (socket) {
    socket.emit('typing', { conversationId, userId, isTyping });
  } else {
    console.warn('Socket not initialized. Cannot emit typing event.');
  }
};

export const emitMessageRead = (messageId, readerId) => {
  if (socket) {
    socket.emit('messageRead', { messageId, readerId });
  } else {
    console.warn('Socket not initialized. Cannot emit messageRead event.');
  }
};

export const fetchConversations = async () => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/messages/conversations`, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
};

export const fetchMessages = async (conversationId) => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/messages/conversation/${conversationId}`, {
    method: 'GET',
    headers: authHeaders,
  });
  return handleResponse(response);
};

export const sendMessage = async (conversationId, recipientId, messageText) => {
  console.log('Frontend: Sending message with payload:', { conversationId, recipientId, messageText }); // Add this log
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ conversationId, recipientId, messageText }),
  });
  return handleResponse(response);
};

export const createConversation = async (participantIds) => { // Removed 'name' as it's not used in the new backend route
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/messages/find-or-create-conversation`, { // Updated endpoint
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ participantIds }), // Only send participantIds
  });
  return handleResponse(response);
};