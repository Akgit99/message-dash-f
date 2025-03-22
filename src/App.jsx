import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ChatWindow from './components/ChatWindow';
import dotenv from 'dotenv';

dotenv.config();

const lh = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';


function App() {
  const [user, setUser] = useState(null);
  const [currentChat, setCurrentChat] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isLogin
        ? `${lh}/api/auth/login`
        : `${lh}/api/auth/signup`;
      
      const response = await axios.post(endpoint, { username, password });
      
      if (isLogin) {
        // For login, expect a token
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          setUser({ _id: response.data.userId, username });
          setUsername('');
          setPassword('');
        } else {
          throw new Error('No token received on login');
        }
      } else {
        // For signup, just check for success (token might come on login)
        if (response.status === 201 || response.data.message === 'User created') {
          console.log('Signup successful:', response.data);
          alert('Signup successful! Please log in.');
          setIsLogin(true); // Switch to login form
          setUsername('');
          setPassword('');
        } else {
          throw new Error('Unexpected signup response');
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Authentication failed';
      alert(errorMessage);
    }
  };

  useEffect(() => {
    if (user) {
      setContacts([
        { _id: 'ai', username: 'AI Bot', isAI: true, online: true, unread: 0 }
      ]);
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCurrentChat(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-center mb-6 text-gray-800">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <form onSubmit={handleAuth}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 mb-4 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none focus:border-green-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 mb-6 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none focus:border-green-500"
            />
            <button
              type="submit"
              className="w-full p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>
          <p className="mt-4 text-center text-gray-600">
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
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <div className="w-1/3 bg-white border-r border-gray-200">
        <div className="bg-green-500 p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Chats</h2>
          <button onClick={handleLogout} className="text-white hover:text-gray-200">
            Logout
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100vh-64px)]">
          {contacts.map((contact) => (
            <div
              key={contact._id}
              onClick={() => setCurrentChat(contact)}
              className={`p-4 flex items-center cursor-pointer border-b border-gray-200 hover:bg-gray-100 ${
                currentChat?._id === contact._id ? 'bg-gray-100' : ''
              }`}
            >
              <div className="w-10 h-10 bg-gray-300 rounded-full mr-3 flex items-center justify-center text-white font-bold">
                {contact.username[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="font-semibold">{contact.username}</span>
                  {contact.unread > 0 && (
                    <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
      <div className="w-2/3">
        {currentChat ? (
          <ChatWindow currentChat={currentChat} user={user} />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-200">
            <p className="text-gray-500">Select a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;