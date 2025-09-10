import React, { useState, useEffect } from 'react';

const PotteryModal = ({ piece, isOpen, onClose }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = piece?.images || (piece?.image ? [piece.image] : []);
  
  // Reset image index when piece changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [piece]);
  
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);
  
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };
  
  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };
  
  if (!isOpen || !piece) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          ×
        </button>
        
        <div className="modal-image-section">
          <div className="modal-image-container">
            <img 
              src={images[currentImageIndex]} 
              alt={`${piece.title} - Image ${currentImageIndex + 1}`}
            />
            
            {images.length > 1 && (
              <>
                <button 
                  className="modal-nav-arrow modal-nav-arrow-left" 
                  onClick={prevImage}
                  aria-label="Previous image"
                >
                  &#8249;
                </button>
                <button 
                  className="modal-nav-arrow modal-nav-arrow-right" 
                  onClick={nextImage}
                  aria-label="Next image"
                >
                  &#8250;
                </button>
                
                <div className="modal-image-indicators">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      className={`modal-indicator ${index === currentImageIndex ? 'active' : ''}`}
                      onClick={() => setCurrentImageIndex(index)}
                      aria-label={`View image ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="modal-info-section">
          <h2 className="modal-title">{piece.title}</h2>
          <div className="modal-metadata">
            <div className="modal-metadata-item">
              <span className="label">Shape:</span>
              <span className="value">{piece.shape}</span>
            </div>
            <div className="modal-metadata-item">
              <span className="label">Clay:</span>
              <span className="value">{piece.clay}</span>
            </div>
            <div className="modal-metadata-item">
              <span className="label">Season:</span>
              <span className="value">{piece.seasonYear}</span>
            </div>
          </div>
          
          {images.length > 1 && (
            <div className="modal-image-counter">
              {currentImageIndex + 1} of {images.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PotteryModal;

