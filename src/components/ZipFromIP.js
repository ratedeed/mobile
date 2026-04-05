import { useEffect } from 'react';

const ZipFromIP = ({ onZipCodeFetched }) => {
  useEffect(() => {
    const getZipFromIP = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('Failed to fetch IP data');

        const data = await response.json();
        if (onZipCodeFetched) {
          onZipCodeFetched(data.postal || null);
        }
      } catch (error) {
        console.error('Error fetching ZIP from IP:', error);
        if (onZipCodeFetched) {
          onZipCodeFetched(null); // Indicate error or unavailability
        }
      }
    };

    getZipFromIP();
  }, [onZipCodeFetched]);

  return null; // This component renders nothing
};

export default ZipFromIP;