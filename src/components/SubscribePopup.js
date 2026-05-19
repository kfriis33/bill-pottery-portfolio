import React, { useState, useEffect, useRef } from 'react';

const MAILCHIMP_URL = 'https://art.us14.list-manage.com/subscribe/post-json?u=4683756fd0827200878d72a26&id=e5850ac13f&f_id=008cb7e5f0';
const HONEYPOT = 'b_4683756fd0827200878d72a26_e5850ac13f';

const SubscribePopup = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const autoCloseTimer = useRef(null);

  // Auto-close after 8s if user hasn't interacted
  useEffect(() => {
    if (!isOpen) return;
    autoCloseTimer.current = setTimeout(onClose, 15000);
    return () => clearTimeout(autoCloseTimer.current);
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;

    // Cancel the 8s auto-close so it doesn't fire mid-flow
    clearTimeout(autoCloseTimer.current);
    setStatus('sending');

    const url = `${MAILCHIMP_URL}&EMAIL=${encodeURIComponent(email)}&${HONEYPOT}=&c=__mcCallback`;

    window.__mcCallback = (data) => {
      delete window.__mcCallback;
      if (data.result === 'success') {
        setStatus('success');
        setEmail('');
        setTimeout(onClose, 1500);
      } else {
        setStatus('error');
        setErrorMsg(data.msg.replace(/<[^>]*>/g, ''));
      }
    };

    const script = document.createElement('script');
    script.src = url;
    document.body.appendChild(script);
    script.onload = () => document.body.removeChild(script);
  };

  const handleClose = () => {
    clearTimeout(autoCloseTimer.current);
    setStatus(null);
    setEmail('');
    setErrorMsg('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="subscribe-overlay" onClick={handleClose}>
      <div className="subscribe-popup" onClick={e => e.stopPropagation()}>
        <button className="subscribe-close" onClick={handleClose}>×</button>

        {status === 'success' ? (
          <div className="subscribe-success">
            <p>Thanks for subscribing!</p>
          </div>
        ) : (
          <>
            <h3>Stay in the loop</h3>
            <p>Get updates on new pieces and available work.</p>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
              <button type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>
            {status === 'error' && (
              <p className="subscribe-error">{errorMsg}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SubscribePopup;
