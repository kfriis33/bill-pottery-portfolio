import React from 'react';
import { getUniqueValues } from '../data/potteryData';

const FilterControls = ({ 
  shapeFilter, 
  clayFilter, 
  sortBy, 
  onShapeChange, 
  onClayChange, 
  onSortChange,
  onClearFilters 
}) => {
  const shapes = getUniqueValues('shape');
  const clays = getUniqueValues('clay');

  return (
    <div className="filter-controls">
      <div className="filter-section">
        <div className="filter-group">
          <select value={shapeFilter} onChange={(e) => onShapeChange(e.target.value)}>
            <option value="">All Shapes</option>
            {shapes.map(shape => (
              <option key={shape} value={shape}>{shape}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select value={clayFilter} onChange={(e) => onClayChange(e.target.value)}>
            <option value="">All Clays</option>
            {clays.map(clay => (
              <option key={clay} value={clay}>{clay}</option>
            ))}
          </select>
        </div>


        <div className="filter-group">
          <select className="sort-select" value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="shape">By Shape</option>
            <option value="clay">By Clay</option>
            <option value="title">A-Z</option>
          </select>
        </div>

        <button className="clear-filters" onClick={onClearFilters}>
          Reset
        </button>
      </div>
    </div>
  );
};

export default FilterControls;
