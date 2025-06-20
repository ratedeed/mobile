import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { applyActionCode } from 'firebase/auth';
import { auth } from '../firebaseConfig'; // Corrected import path

const VerifyEmailHandler = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const handleVerification = async () => {
      const queryParams = new URLSearchParams(location.search);
      const oobCode = queryParams.get('oobCode');

      if (!oobCode) {
        setMessage('Error: No verification code found.');
        return;
      }

      try {
        await applyActionCode(auth, oobCode);
        setMessage('Email successfully verified! Redirecting to login...');
        setTimeout(() => {
          navigate('/login'); // Redirect to login page after successful verification
        }, 3000);
      } catch (error) {
        console.error('Error applying action code:', error);
        setMessage(`Error verifying email: ${error.message}`);
      }
    };

    handleVerification();
  }, [location, navigate]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Email Verification</h2>
      <p>{message}</p>
    </div>
  );
};

export default VerifyEmailHandler;