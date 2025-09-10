import React, { useState, useMemo } from 'react';
import { potteryPieces } from './data/potteryData';
import PotteryCard from './components/PotteryCard';
import FilterControls from './components/FilterControls';
import PotteryModal from './components/PotteryModal';
import billImg from 'url:./data/images/bill.jpg';
import './styles/App.css';

const App = () => {
  const [currentPage, setCurrentPage] = useState('pots');
  const [shapeFilter, setShapeFilter] = useState('');
  const [clayFilter, setClayFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredAndSortedPieces = useMemo(() => {
    let filtered = potteryPieces.filter(piece => {
      return (
        (shapeFilter === '' || piece.shape === shapeFilter) &&
        (clayFilter === '' || piece.clay === clayFilter)
      );
    });

    // Helper function to convert season/year to sortable value
    const getSeasonValue = (seasonYear) => {
      const [season, year] = seasonYear.split(' ');
      const seasonOrder = { 'Winter': 1, 'Spring': 2, 'Summer': 3, 'Fall': 4 };
      return parseInt(year) * 10 + (seasonOrder[season] || 0);
    };

    // Sort the filtered results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          // Sort by season/year, newest first (more recent seasons/years first)
          return getSeasonValue(b.seasonYear) - getSeasonValue(a.seasonYear);
        case 'oldest':
          // Sort by season/year, oldest first 
          return getSeasonValue(a.seasonYear) - getSeasonValue(b.seasonYear);
        case 'shape':
        case 'clay':
        case 'title':
          // Sort alphabetically by the selected field
          const aValue = a[sortBy];
          const bValue = b[sortBy];
          return aValue.localeCompare(bValue);
        default:
          return 0;
      }
    });

    return filtered;
  }, [shapeFilter, clayFilter, sortBy]);

  const clearAllFilters = () => {
    setShapeFilter('');
    setClayFilter('');
    setSortBy('newest');
  };

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
              William (Bill) Kuenne is a ceramacists based in San Francisco, California. 
              He throws, trims, and glazes all his pieces by hand.
            </p>
            <p>
              If you are interested in purchasing a piece or comissioning a custom piece, please reach out via instagram <a href="https://www.instagram.com/w.k.clay" target="_blank" rel="noopener noreferrer">@w.k.clay</a>.
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="results-info">
          <p>Showing {filteredAndSortedPieces.length} of {potteryPieces.length} pieces</p>
        </div>

        <div className="pottery-grid">
          {filteredAndSortedPieces.map(piece => (
            <PotteryCard key={piece.id} piece={piece} onClick={() => openModal(piece)} />
          ))}
        </div>

        {filteredAndSortedPieces.length === 0 && (
          <div className="no-results">
            <p>No pottery pieces match your current filters.</p>
            <button onClick={clearAllFilters}>Clear filters to see all pieces</button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="app">
      <div className="vase-container">
        <header className="header">
          <h1 className="site-title">William Kuenne</h1>
          
          <nav className="navigation">
            <button 
              className={`nav-item ${currentPage === 'pots' ? 'active' : ''}`}
              onClick={() => setCurrentPage('pots')}
            >
              Pots
            </button>
            <button 
              className={`nav-item ${currentPage === 'about' ? 'active' : ''}`}
              onClick={() => setCurrentPage('about')}
            >
              About
            </button>
          </nav>
        </header>
      </div>
      
      {currentPage === 'pots' && (
        <FilterControls
          shapeFilter={shapeFilter}
          clayFilter={clayFilter}
          sortBy={sortBy}
          onShapeChange={setShapeFilter}
          onClayChange={setClayFilter}
          onSortChange={setSortBy}
          onClearFilters={clearAllFilters}
        />
      )}

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
