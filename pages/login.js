import { useState } from 'react';
import { useRouter } from 'next/router';
import logoBase64 from '../lib/logoBase64';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push('/');
    } else {
      setError('Incorrect password');
    }
  }

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <img src={logoBase64} alt="Mirrant" style={styles.logo} />
        <h2 style={{ marginBottom: 16, textAlign: 'center' }}>Flowmeter Certificate Generator</h2>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          autoFocus
        />
        <button type="submit" style={styles.button}>
          Enter
        </button>
        {error && <p style={{ color: '#D6322C', marginTop: 10 }}>{error}</p>}
      </form>
    </div>
  );
}

const styles = {
  wrapper: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    background: 'white',
    padding: 40,
    borderRadius: 8,
    boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
    width: 340,
    borderTop: '4px solid #D6322C',
  },
  logo: {
    display: 'block',
    height: 64,
    margin: '0 auto 20px auto',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    marginBottom: 12,
    border: '1px solid #ccc',
    borderRadius: 4,
  },
  button: {
    width: '100%',
    padding: '10px 12px',
    background: '#D6322C',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};
