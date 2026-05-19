import React, { useState, useMemo, useEffect } from 'react';
import { potteryPieces, getUniqueValues } from './data/potteryData';
import PotteryCard from './components/PotteryCard';
import PotteryModal from './components/PotteryModal';
import SubscribePopup from './components/SubscribePopup';
import SubscribePage from './components/SubscribePage';
import billImg from 'url:./data/images/bill.jpg';
import './styles/App.css';

const SHAPE_ORDER = ['Vase', 'Kitchenware', 'Tableware', 'Other'];

const App = () => {
  const [currentPage, setCurrentPage] = useState('all');
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('subscribeDismissed')) return;
    const timer = setTimeout(() => setIsSubscribeOpen(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const allShapes = getUniqueValues('shape');
  const shapes = SHAPE_ORDER.filter(s => allShapes.includes(s))
    .concat(allShapes.filter(s => !SHAPE_ORDER.includes(s)));

  const filteredPieces = useMemo(() => {
    if (currentPage === 'all' || currentPage === 'about') return potteryPieces;
    return potteryPieces.filter(piece => piece.shape === currentPage);
  }, [currentPage]);

  const openModal = (piece) => {
    setSelectedPiece(piece);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPiece(null);
  };

  const renderContent = () => {
    if (currentPage === 'subscribe') {
      return <SubscribePage />;
    }

    if (currentPage === 'about') {
      return (
        <div className="about-page">
          <div className="about-content">
            <div className="about-image-container">
              <img src={billImg} alt="Bill Kuenne" className="artist-photo" />
            </div>
            <p>
              William (Bill) Kuenne is a ceramacist based in San Francisco, California.
              He throws, trims, and glazes all his pieces by hand.
            </p>
            <p>
              If you are interested in purchasing a piece or comissioning a custom piece, please reach out via direct message on Instagram <a href="https://www.instagram.com/w.k.clay" target="_blank" rel="noopener noreferrer">@w.k.clay</a>.
            </p>
            <p>
              <button className="subscribe-link" onClick={() => setIsSubscribeOpen(true)}>
                Subscribe for updates on new work
              </button>
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="pottery-grid">
        {filteredPieces.map(piece => (
          <PotteryCard key={piece.id} piece={piece} onClick={() => openModal(piece)} />
        ))}
      </div>
    );
  };

  return (
    <div className="app">
      <div className="vase-container">
        <header className="header">
          <h1 className="site-title">William Kuenne</h1>

          <nav className="navigation">
            <button
              className={`nav-item ${currentPage === 'all' ? 'active' : ''}`}
              onClick={() => setCurrentPage('all')}
            >
              All
            </button>
            {shapes.map(shape => (
              <button
                key={shape}
                className={`nav-item ${currentPage === shape ? 'active' : ''}`}
                onClick={() => setCurrentPage(shape)}
              >
                {shape}
              </button>
            ))}
            <button
              className={`nav-item ${currentPage === 'about' ? 'active' : ''}`}
              onClick={() => setCurrentPage('about')}
            >
              About
            </button>
            <button
              className={`nav-item ${currentPage === 'subscribe' ? 'active' : ''}`}
              onClick={() => setCurrentPage('subscribe')}
            >
              Contact
            </button>
          </nav>
        </header>
      </div>

      <main className="main-content">
        {renderContent()}
      </main>

      <footer className="footer">
        <p>Thanks for visiting! For the latest updates, follow <a href="https://www.instagram.com/w.k.clay" target="_blank" rel="noopener noreferrer">@w.k.clay</a> on Instagram and <button className="footer-subscribe-link" onClick={() => setIsSubscribeOpen(true)}>subscribe</button>.</p>
      </footer>
      
      <PotteryModal
        piece={selectedPiece}
        isOpen={isModalOpen}
        onClose={closeModal}
      />

      <SubscribePopup
        isOpen={isSubscribeOpen}
        onClose={() => {
          localStorage.setItem('subscribeDismissed', '1');
          setIsSubscribeOpen(false);
        }}
      />
    </div>
  );
};

export default App;
