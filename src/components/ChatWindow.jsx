// ChatWindow.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const lh = import.meta.env.VITE_APP_API_BASE_URL || 'http://localhost:5000';

export default function ChatWindow({ currentChat, user, socket }) { // Accept socket as prop
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
      const response = await axios.get(`${lh}/api/messages/${currentChat._id}`, {
        headers: { Authorization: `Bearer ${token}` }, // Add "Bearer " prefix
      });
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error.response?.data || error.message);
      setMessages([]);
    }
  };

  useEffect(() => {
    if (!currentChat?._id || !user?._id) return;

    socket.emit('join', user._id);
    fetchMessages();

    const handleMessage = (msg) => {
      console.log('Received message via socket:', msg);
  if (
    (msg.sender === user._id && msg.recipient === currentChat._id) ||
    (msg.sender === currentChat._id && msg.recipient === user._id)
  ) {
    setMessages((prev) => {
      // Replace temp message if it exists, otherwise append
      const tempIndex = prev.findIndex((m) => m._id?.startsWith('temp-') && m.content === msg.content);
      if (tempIndex !== -1) {
        const newMessages = [...prev];
        newMessages[tempIndex] = msg; // Replace temp with server message
        return newMessages;
      }
      if (!prev.some((m) => m._id === msg._id)) {
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
      socket.emit('join', user._id);
      fetchMessages();
    });

    return () => {
      socket.off('message', handleMessage);
      socket.off('typing');
      socket.off('connect');
    };
  }, [currentChat?._id, user?._id, socket]);

  const sendMessage = () => {
    if (!message.trim() || !currentChat?._id || !user?._id) return;

  const msg = {
    sender: user._id,
    recipient: currentChat._id,
    content: message,
    timestamp: new Date().toISOString(),
    read: false,
  };

  console.log('Emitting message:', JSON.stringify(msg, null, 2));
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
        // Do NOT include _id here; let the server generate it
      };
      // Add _id only for local display
      setMessages((prev) => [...prev, { ...aiMsg, _id: `temp-ai-${Date.now()}` }]);
      socket.emit('message', aiMsg); // Emit without _id
      setAiTyping(false);
    }, 1000);
  }
     
  };

  // ... rest of the component remains the same


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