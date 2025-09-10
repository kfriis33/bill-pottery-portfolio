import React, { useState } from 'react';

const PotteryCard = ({ piece, onClick }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = piece.images || [piece.image]; // Fallback for old data structure
  
  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };
  
  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };
  
  return (
    <div className="pottery-card" onClick={onClick}>
      <div className="image-container">
        <img 
          src={images[currentImageIndex]} 
          alt={`${piece.title} - Image ${currentImageIndex + 1}`} 
          loading="lazy" 
        />
        
        {images.length > 1 && (
          <>
            <button 
              className="nav-arrow nav-arrow-left" 
              onClick={prevImage}
              aria-label="Previous image"
            >
              &#8249;
            </button>
            <button 
              className="nav-arrow nav-arrow-right" 
              onClick={nextImage}
              aria-label="Next image"
            >
              &#8250;
            </button>
            
            <div className="image-indicators">
              {images.map((_, index) => (
                <button
                  key={index}
                  className={`indicator ${index === currentImageIndex ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  aria-label={`View image ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      
      <div className="card-content">
        <h3 className="piece-title">{piece.title}</h3>
        <div className="metadata">
          <span className="metadata-item shape">{piece.shape}</span>
          <span className="metadata-item clay">{piece.clay}</span>
          <span className="metadata-item season">{piece.seasonYear}</span>
        </div>
      </div>
    </div>
  );
};

export default PotteryCard;
