'use client';

import { useState } from 'react';

export default function InfoTooltip({ text }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="tooltip-container"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsVisible(!isVisible);
      }}
    >
      <span className="tooltip-icon">?</span>
      {isVisible && (
        <div className="tooltip-content">
          {text}
        </div>
      )}
    </div>
  );
}
