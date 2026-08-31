import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { forgotPassword, resetPassword } from '../api/auth';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import { KeyRound } from 'lucide-react';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await forgotPassword(email);
      setSubmitted(true);
      showToast('Cek email Anda untuk instruksi reset password', 'success');
    } catch (error) {
      showToast('Gagal mengirim email reset', 'error');
    } finally {
      setLoading(false);
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
        className="neu-raised" 
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
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
          color: 'var(--color-primary)'
        }} className="neu-raised">
          <KeyRound size={32} />
        </div>
        
        <h1 style={{ marginBottom: '8px', color: 'var(--color-text-primary)' }}>Lupa Password</h1>
        
        {submitted ? (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <p style={{ color: 'var(--color-success)', marginBottom: '32px' }}>
              Email instruksi reset telah dikirim ke <strong>{email}</strong>.
            </p>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button variant="primary" style={{ width: '100%' }}>
                Kembali ke Login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px', textAlign: 'center', lineHeight: '1.5' }}>
              Masukkan alamat email Anda yang terdaftar, dan kami akan mengirimkan instruksi untuk mereset password.
            </p>

            <form onSubmit={handleSubmit} style={{ width: '100%' }}>
              <Input 
                id="email"
                type="email"
                label="Email"
                placeholder="Masukkan email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div style={{ marginBottom: '32px' }}></div>

              <Button 
                type="submit" 
                variant="primary" 
                size="lg" 
                style={{ width: '100%', marginBottom: '16px' }}
                disabled={loading}
              >
                {loading ? 'Mengirim...' : 'Kirim Link Reset'}
              </Button>

              <div style={{ textAlign: 'center' }}>
                <Link to="/login" style={{ 
                  color: 'var(--color-primary)', 
                  textDecoration: 'none', 
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}>
                  Kembali ke Login
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
