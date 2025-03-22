import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const lh = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';


const socket = io(`${lh}`, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

export default function ChatWindow({ currentChat, user }) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [typing, setTyping] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found in localStorage');
        return;
      }

      console.log('Fetching messages for:', user._id, 'with', currentChat._id);
      const response = await axios.get(
        `${lh}/api/messages/${currentChat._id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('Fetched messages from server:', response.data);
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error.response?.data || error.message);
      setMessages([]);
    }
  };

  useEffect(() => {
    if (!currentChat?._id || !user?._id) {
      console.log('Missing currentChat or user ID');
      return;
    }

    console.log('ChatWindow mounted for user:', user._id, 'with', currentChat._id);
    socket.emit('join', user._id);
    fetchMessages();

    const handleMessage = (msg) => {
      console.log('Received message via socket:', msg);
      if (
        (msg.sender === user._id && msg.recipient === currentChat._id) ||
        (msg.sender === currentChat._id && msg.recipient === user._id)
      ) {
        setMessages((prev) => {
          if (!prev.some((m) => m._id === msg._id)) {
            console.log('Adding new message:', msg);
            return [...prev, msg];
          }
          return prev;
        });
      }
    };

    socket.on('message', handleMessage);
    socket.on('typing', ({ userId }) => {
      if (userId === currentChat._id) {
        setTyping(true);
        setTimeout(() => setTyping(false), 1000);
      }
    });
    socket.on('connect', () => {
      console.log('Socket connected');
      socket.emit('join', user._id);
      fetchMessages();
    });
    socket.on('disconnect', () => console.log('Socket disconnected'));

    return () => {
      socket.off('message', handleMessage);
      socket.off('typing');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [currentChat?._id, user?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!message.trim() || !currentChat?._id || !user?._id) return;

    const msg = {
      sender: user._id,
      recipient: currentChat._id,
      content: message,
      timestamp: new Date().toISOString(),
      read: false
    };

    console.log('Sending message:', msg);
    setMessages((prev) => [...prev, { ...msg, _id: `temp-${Date.now()}` }]);
    socket.emit('message', msg);
    setMessage('');

    if (currentChat.isAI) {
      setAiTyping(true);
      setTimeout(() => {
        const aiResponse = getAIResponse(message);
        const aiMsg = {
          sender: currentChat._id,
          recipient: user._id,
          content: aiResponse,
          timestamp: new Date().toISOString(),
          read: true,
          _id: `temp-ai-${Date.now()}`
        };
        setMessages((prev) => [...prev, aiMsg]);
        socket.emit('message', aiMsg);
        setAiTyping(false);
      }, 1000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-200">
      <div className="bg-green-500 p-4 flex items-center text-white">
        <div className="w-10 h-10 bg-gray-300 rounded-full mr-3 flex items-center justify-center font-bold">
          {currentChat?.username?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <h3 className="font-semibold">{currentChat?.username || 'Unknown'}</h3>
          <p className="text-sm">{currentChat?.online ? 'Online' : 'Offline'}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')]">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center">No messages yet</div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg._id || `msg-${index}`}
              className={`flex ${msg.sender === user._id ? 'justify-end' : 'justify-start'} mb-2`}
            >
              <div
                className={`max-w-xs p-3 rounded-lg ${
                  msg.sender === user._id ? 'bg-green-100 text-black' : 'bg-white text-black'
                }`}
              >
                <p>{msg.content}</p>
                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.sender === user._id && <span>{msg.read ? '✓✓' : '✓'}</span>}
                </div>
              </div>
            </div>
          ))
        )}
        {typing && <div className="text-gray-500 text-sm">Typing...</div>}
        {aiTyping && <div className="text-gray-500 text-sm">AI is typing...</div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-white flex items-center border-t border-gray-200">
        <input
          type="text"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            socket.emit('typing', { userId: user._id, recipient: currentChat._id });
          }}
          onKeyPress={handleKeyPress}
          className="flex-1 p-2 rounded-full bg-gray-100 border-none focus:outline-none"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="ml-2 p-2 bg-green-500 text-white rounded-full hover:bg-green-600"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

function getAIResponse(message) {
  const lowerMsg = message.toLowerCase();
  const responses = {
    'hello': 'Hi there!',
    'how are you': 'I’m doing great, thanks for asking!',
    'what’s up': 'Not much, just here to chat!',
    'bye': 'See you later!',
    'thanks': 'You’re welcome!',
    'who are you': 'I’m your friendly AI assistant!',
    'what can you do': 'I can chat with you and help with simple questions!',
    'lol': 'Glad you’re laughing!',
    'tell me a joke': 'Why don’t skeletons fight each other? They don’t have the guts!',
    'good night': 'Sleep well!'
  };
  return responses[lowerMsg] || 'Hmm, not sure what to say to that!';
}