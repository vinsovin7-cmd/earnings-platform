import { useState, useEffect } from 'react';
import { TonConnectUI } from '@tonconnect/ui';
import './App.css';

function App() {
  const [tonConnect, setTonConnect] = useState(null);
  const [connected, setConnected] = useState(false);
  const [minedBalance, setMinedBalance] = useState(0);
  const [miningActive, setMiningActive] = useState(false);
  const [usdValue, setUsdValue] = useState(0);
  const [ledger, setLedger] = useState([]);

  // Initialize TonConnect
  useEffect(() => {
    const init = async () => {
      const ui = await TonConnectUI.init({
        manifestUrl: 'https://your-domain.com/tonconnect-manifest.json',
        // additional options as needed
      });
      setTonConnect(ui);
    };
    init();
  }, []);

  const connectWallet = async () => {
    if (!tonConnect) return;
    await tonConnect.connect();
    setConnected(true);
  };

  useEffect(() => {
    if (!miningActive) return;
    const interval = setInterval(() => {
      setMinedBalance(prev => prev + 0.000001);
      setUsdValue(prev => prev + 0.0000005);
    }, 1000);
    return () => clearInterval(interval);
  }, [miningActive]);

  const withdraw = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    try {
      const result = await tonConnect.sendTransaction({
        operation: {
          address: tonConnect.wallet.address,
          amount: 1_000_000_000, // 1 TON = 1e9 nanoTON
        },
      });
      alert(`Transaction sent! Hash: ${result.txId}`);
    } catch (e) {
      console.error(e);
      alert('Transaction failed');
    }
  };

  // WebSocket for live payout ledger
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000');
    ws.onmessage = event => {
      const data = JSON.parse(event.data);
      setLedger(prev => [...prev, data]);
    };
    return () => ws.close();
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <span className="status-badge">
          {connected ? 'TON PAYOUT WALLET LINKED (Verified: ...)' : 'Connect Wallet'}
        </span>
      </header>

      <nav className="tab-nav">
        <button className={`tab-btn ${tonConnect ? 'active' : ''}`} onClick={() => setMiningActive(!miningActive)}>
          Miner
        </button>
        <button className="tab-btn" onClick={() => setMiningActive(false)}>Nodes</button>
        <button className="tab-btn" onClick={() => setMiningActive(false)}>7-Tier MLM</button>
        <button className="tab-btn" onClick={() => setMiningActive(false)}>Earning Station</button>
      </nav>

      <main className="main-content">
        <section className="mining-display">
          <div className="diamond-canvas" onClick={() => setMiningActive(!miningActive)}>
            <img src="/diamond.svg" alt="Tonkeeper diamond" className="diamond-logo" />
          </div>

          <div className="balance">
            <span className="label">Mined Balance</span>
            <span className="value">{minedBalance.toFixed(6)} TON</span>
            <span className="usd">{usdValue.toFixed(6)} USD</span>
          </div>

          <button className="action-btn" onClick={withdraw}>WITHDRAW TO TONKEEPER</button>
          <button className="action-btn compound" onClick={() => alert('Compound +10% (simulated)')}>Compound (+10%)</button>
          <button className="action-btn boost" onClick={() => alert('Boost Speed (simulated)')}>Boost Speed</button>
        </section>

        <section className="mlm-cards">
          {/* L1-L7 cards with percentages */}
          <div className="card">L1 12%</div>
          <div className="card">L2 5%</div>
          <div className="card">L3 5%</div>
          <div className="card">L4 2%</div>
          <div className="card">L5 1.5%</div>
          <div className="card">L6 1%</div>
          <div className="card">L7 0.5%</div>
        </section>

        <section className="ledger">
          <h3>Live On‑Chain Payouts</h3>
          <div className="ledger-list">
            {ledger.map((item, idx) => (
              <div key={idx} className="ledger-item">
                {item.address} — {item.amount} TON @ {new Date(item.ts).toLocaleTimeString()}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;