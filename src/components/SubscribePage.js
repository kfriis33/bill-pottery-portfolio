import React, { useState, useRef } from 'react';

const MAILCHIMP_URL = 'https://art.us14.list-manage.com/subscribe/post-json?u=4683756fd0827200878d72a26&id=e5850ac13f&f_id=008cb7e5f0';
const HONEYPOT = 'b_4683756fd0827200878d72a26_e5850ac13f';

const SubscribePage = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;

    setStatus('sending');

    const url = `${MAILCHIMP_URL}&EMAIL=${encodeURIComponent(email)}&${HONEYPOT}=&c=__mcSubscribePageCallback`;

    window.__mcSubscribePageCallback = (data) => {
      delete window.__mcSubscribePageCallback;
      if (data.result === 'success') {
        setStatus('success');
        setEmail('');
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

  return (
    <div className="subscribe-page">
      <div className="subscribe-page-content">
        <p className="subscribe-page-contact">
          For commissions, questions, or compliments, please reach out to <a href="mailto:clay@williamkuenne.art">clay@williamkuenne.art</a>
        </p>

        <h2>Stay in the loop</h2>
        <p>Get updates on new pieces and available work from William Kuenne.</p>

        {status === 'success' ? (
          <p className="subscribe-page-success">Thanks for subscribing!</p>
        ) : (
          <form className="subscribe-page-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
            <button type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Subscribing...' : 'Subscribe'}
            </button>
            {status === 'error' && (
              <p className="subscribe-page-error">{errorMsg}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default SubscribePage;
