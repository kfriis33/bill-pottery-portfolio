import React, { useState, useMemo } from 'react';
import { potteryPieces, getUniqueValues } from './data/potteryData';
import PotteryCard from './components/PotteryCard';
import PotteryModal from './components/PotteryModal';
import billImg from 'url:./data/images/bill.jpg';
import './styles/App.css';

const SHAPE_ORDER = ['Vase', 'Kitchenware', 'Tableware', 'Other'];

const App = () => {
  const [currentPage, setCurrentPage] = useState('all');
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
          </nav>
        </header>
      </div>

      <main className="main-content">
        {renderContent()}
      </main>

      <footer className="footer">
        <p>Thanks for visiting! For the latest updates, follow <a href="https://www.instagram.com/w.k.clay" target="_blank" rel="noopener noreferrer">@w.k.clay</a> on Instagram.</p>
      </footer>
      
      <PotteryModal 
        piece={selectedPiece}
        isOpen={isModalOpen}
        onClose={closeModal}
      />
    </div>
  );
};

export default App;
