// App.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ChatWindow from './components/ChatWindow';
import io from 'socket.io-client';

const lh = import.meta.env.VITE_APP_API_BASE_URL || 'http://localhost:5000';
const socket = io(lh, { autoConnect: false });

function App() {
  const [user, setUser] = useState(null);
  const [currentChat, setCurrentChat] = useState(null);
  const [contacts, setContacts] = useState([]); // Now includes online users
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? `${lh}/api/auth/login` : `${lh}/api/auth/signup`;
      const response = await axios.post(endpoint, { username, password });

      if (isLogin) {
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          setUser({ _id: response.data.userId, username });

          socket.auth = { token: response.data.token };
          socket.connect();

          socket.on('connect', () => {
            //console.log('Connected to WebSocket');
            socket.emit('setUsername', username); // Send username to server
          });
          socket.on('connect_error', (err) => console.error('Socket connection failed:', err.message));
          setUsername('');
          setPassword('');
        }
      } else {
        if (response.status === 201) {
          alert('Signup successful! Please log in.');
          setIsLogin(true);
          setUsername('');
          setPassword('');
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      alert(error.response?.data?.message || 'Authentication failed');
    }
  };

  useEffect(() => {
    if (user) {
      socket.emit('join', user._id);
      const pingInterval = setInterval(() => socket.emit('ping'), 5000);

      // Listen for online users
      socket.on('onlineUsers', (users) => {
       // console.log('Received online users:', users);
        const filteredUsers = users.filter(u => u.userId !== user._id); // Exclude self
        setContacts([
          { _id: 'ai', username: 'AI Bot', isAI: true, online: true, unread: 0 },
          ...filteredUsers.map(u => ({
            _id: u.userId,
            username: u.username,
            online: true,
            unread: 0,
          })),
        ]);
      });

      return () => {
        clearInterval(pingInterval);
        socket.disconnect();
      };
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    socket.disconnect();
    setUser(null);
    setCurrentChat(null);
    setContacts([]);
  };

  // JSX remains mostly the same, just update contacts rendering
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
    {!user ? (
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-6 text-gray-800 sm:text-3xl">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none focus:border-green-500 text-sm sm:text-base"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none focus:border-green-500 text-sm sm:text-base"
            />
            <button
              type="submit"
              className="w-full p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm sm:text-base"
            >
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>
          <p className="mt-4 text-center text-gray-600 text-sm sm:text-base">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <span
              onClick={() => setIsLogin(!isLogin)}
              className="text-green-500 cursor-pointer hover:underline"
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </span>
          </p>
        </div>
      </div>
    ) : (
      <div className="flex flex-col md:flex-row h-screen">
        <div className="w-full md:w-1/3 bg-white border-r border-gray-200 flex flex-col">
          <div className="bg-green-500 p-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Chats</h2>
            <button onClick={handleLogout} className="text-white hover:text-gray-200 text-sm sm:text-base">
              Logout
            </button>
          </div>
          <div className="overflow-y-auto flex-grow">
            {contacts.map((contact) => (
              <div
                key={contact._id}
                onClick={() => setCurrentChat(contact)}
                className={`p-4 flex items-center cursor-pointer border-b border-gray-200 hover:bg-gray-100 ${
                  currentChat?._id === contact._id ? 'bg-gray-100' : ''
                }`}
              >
                <div className="w-10 h-10 bg-gray-300 rounded-full mr-3 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {contact.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold truncate text-sm sm:text-base">{contact.username}</span>
                    {contact.unread > 0 && (
                      <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {contact.unread}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {contact.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full md:w-2/3 flex flex-col">
          {currentChat ? (
            <ChatWindow currentChat={currentChat} user={user} socket={socket} />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-200">
              <p className="text-gray-500 text-sm sm:text-base">Select a chat to start messaging</p>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);
}

export default App;