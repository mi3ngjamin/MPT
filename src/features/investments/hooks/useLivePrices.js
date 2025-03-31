import { useState, useCallback } from 'react';

const useLivePrices = (tickers) => {
  const [livePrices, setLivePrices] = useState(() => {
    const saved = localStorage.getItem('livePrices');
    return saved ? JSON.parse(saved) : {};
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Save prices to localStorage whenever they change
  const savePrices = (prices) => {
    localStorage.setItem('livePrices', JSON.stringify(prices));
    setLivePrices(prices);
  };

  const fetchLivePrices = useCallback(async () => {
    if (!tickers || tickers.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const apiKey = process.env.REACT_APP_FINNHUB_API_KEY;
      if (!apiKey) throw new Error('API key is missing.');

      const uniqueTickers = [...new Set(tickers)];
      const pricePromises = uniqueTickers.map(async (ticker) => {
        try {
          const response = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`
          );
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          return { ticker, price: data.c || null };
        } catch (err) {
          console.error(`Error fetching price for ${ticker}:`, err);
          return { ticker, price: null }; // Return null for failed fetches
        }
      });

      const prices = await Promise.all(pricePromises);
      const newPriceMap = prices.reduce((acc, { ticker, price }) => {
        if (price !== null) acc[ticker] = price; // Only update if price is valid
        return acc;
      }, {});

      // Merge new prices with existing ones, preserving old values for unchanged tickers
      setLivePrices((prev) => {
        const updatedPrices = { ...prev, ...newPriceMap };
        localStorage.setItem('livePrices', JSON.stringify(updatedPrices));
        return updatedPrices;
      });
    } catch (err) {
      console.error('Error fetching live prices:', err);
      setError('Failed to fetch live prices. Check your Finnhub API key.');
    } finally {
      setLoading(false);
    }
  }, [tickers]);

  return {
    livePrices,
    loading,
    error,
    fetchLivePrices,
    savePrices, // Exposed for manual updates if needed
  };
};

export default useLivePrices;