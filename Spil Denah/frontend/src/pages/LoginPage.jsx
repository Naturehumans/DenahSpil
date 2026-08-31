import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import { MapPin } from 'lucide-react';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    let result;
    if (isLogin) {
      result = await login(formData.username, formData.password);
    } else {
      result = await register(formData.username, formData.email, formData.password);
    }
    
    setLoading(false);
    
    if (result.success) {
      showToast(isLogin ? 'Berhasil masuk' : 'Berhasil mendaftar', 'success');
      navigate('/dashboard');
    } else {
      showToast(result.error, 'error');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--color-bg)'
    }}>
      <div 
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'var(--color-primary)',
          borderRadius: '24px',
          boxShadow: '0 24px 48px rgba(58, 149, 66, 0.4)',
          color: 'white'
        }}
      >
        <div style={{ 
          width: '64px', 
          height: '64px', 
          borderRadius: '50%', 
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-danger)',
          background: 'white',
          boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
        }}>
          <MapPin size={32} />
        </div>
        
        <h1 style={{ marginBottom: '8px', color: 'white' }}>Spil Denah</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', marginBottom: '32px', textAlign: 'center' }}>
          Interactive Building Floor Plan Monitoring
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <Input 
            id="username"
            label="Username"
            placeholder="Masukkan username"
            value={formData.username}
            onChange={handleChange}
            required
            labelStyle={{ color: 'white' }}
            style={{ background: 'rgba(255,255,255,0.95)', border: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
          />
          
          {!isLogin && (
            <Input 
              id="email"
              type="email"
              label="Email"
              placeholder="Masukkan email"
              value={formData.email}
              onChange={handleChange}
              required
              labelStyle={{ color: 'white' }}
              style={{ background: 'rgba(255,255,255,0.95)', border: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
            />
          )}

          <Input 
            id="password"
            type="password"
            label="Password"
            placeholder="Masukkan password"
            value={formData.password}
            onChange={handleChange}
            required
            labelStyle={{ color: 'white' }}
            style={{ background: 'rgba(255,255,255,0.95)', border: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
          />

          {isLogin && (
            <div style={{ textAlign: 'right', marginBottom: '24px', marginTop: '-8px' }}>
              <Link to="/forgot-password" style={{ 
                color: 'white', 
                textDecoration: 'none', 
                fontSize: '0.875rem',
                fontWeight: '600',
                opacity: 0.9
              }}>
                Lupa Password?
              </Link>
            </div>
          )}
          
          {!isLogin && <div style={{ marginBottom: '24px' }}></div>}

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', 
              marginBottom: '24px',
              background: 'white',
              color: 'var(--color-primary)',
              border: 'none',
              padding: '16px',
              borderRadius: '50px',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
              opacity: loading ? 0.8 : 1
            }}
          >
            {loading ? 'Memproses...' : (isLogin ? 'Masuk' : 'Daftar')}
          </button>

          <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)' }}>
            {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isLogin ? "Daftar sekarang" : "Masuk"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
