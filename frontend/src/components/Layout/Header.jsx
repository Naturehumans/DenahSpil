import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, List, Menu } from 'lucide-react';
import Button from '../UI/Button';

const Header = ({ onMenuClick, onAlertClick, alertsCount }) => {
  const { user, logout } = useAuth();

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      margin: '16px',
      position: 'relative',
      zIndex: 50,
      backgroundColor: 'var(--color-primary)',
      borderRadius: '16px',
      boxShadow: '0 8px 24px rgba(58, 149, 66, 0.25)'
    }}>
      {/* Mobile Menu Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onMenuClick}
          style={{
            display: 'none', // Shown via CSS media query later
            background: 'transparent',
            border: 'none',
            padding: '8px',
            cursor: 'pointer',
            color: 'white'
          }}
          id="mobile-menu-btn"
        >
          <Menu size={24} color="white" />
        </button>

        <h1 style={{
          fontSize: '1.25rem',
          color: 'white',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontWeight: '700'
        }}>
          <div style={{
            background: 'white',
            padding: '6px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <img
              src="/logo.png"
              alt="Logo"
              style={{
                height: '24px',
                width: '24px',
                objectFit: 'contain'
              }}
            />
          </div>
          Spil Denah
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {/* Toggle Right Sidebar Button (Daftar Barang) */}
        <button
          id="alert-btn"
          onClick={onAlertClick}
          style={{
            position: 'relative',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            padding: '10px',
            borderRadius: '50%',
            cursor: 'pointer',
            color: 'white',
            transition: 'background 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          title="Daftar Barang"
        >
          <List size={20} color="white" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right', display: 'none' }} id="user-info">
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: 'white' }}>{user?.username || 'User'}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>Administrator</p>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)' }} />

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            style={{ color: 'white', padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
            title="Keluar"
          >
            <LogOut size={18} color="white" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
