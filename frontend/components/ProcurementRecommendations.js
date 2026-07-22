'use client';

import InfoTooltip from './InfoTooltip';

export default function ProcurementRecommendations({ recommendations }) {
  if (!recommendations || recommendations.length === 0) return null;

  const topPick = recommendations[0];
  const alternatives = recommendations.slice(1);

  const ScoreBar = ({ label, score, tooltip }) => (
    <div className="score-bar-row">
      <div className="score-bar-label">
        {label} <InfoTooltip text={tooltip} />
      </div>
      <div className="score-bar-track">
        <div 
          className="score-bar-fill" 
          style={{ width: `${score}%`, backgroundColor: `var(--teal-light)` }}
        ></div>
      </div>
      <div className="score-bar-value">{score.toFixed(1)}</div>
    </div>
  );

  return (
    <div className="procurement-section">
      <h3 className="subsection-title">Alternative Procurement Ranking</h3>
      
      {/* Top Pick Card */}
      <div className="recommendation-card top-pick">
        <div className="top-badge">#1 Recommendation</div>
        <div className="card-header">
          <div className="supplier-id">
            <h4>{topPick.source_country}</h4>
          </div>
          <div className="final-score">
            <span className="score-value">{topPick.final_score.toFixed(1)}</span>
            <span className="score-max">/100</span>
          </div>
        </div>
        
        <div className="rationale-box">
          <div className="rationale-icon">✨</div>
          <div className="rationale-text">
            <strong>AI Rationale:</strong> {topPick.rationale}
          </div>
        </div>

        <div className="scores-breakdown">
          <ScoreBar label="Price Competitiveness" score={topPick.price_score} tooltip="0-100 scale based on current live spot price minus baseline." />
          <ScoreBar label="Distance & Risk" score={topPick.distance_score} tooltip="Combines distance transit risk and live geopolitical supplier risk score." />
          <ScoreBar label="Tanker Availability" score={topPick.tanker_availability_score} tooltip="Estimated fleet availability for the specific route." />
          <ScoreBar label="Port Congestion" score={topPick.port_congestion_score} tooltip="Expected wait times at Indian arrival ports for this route." />
          <ScoreBar label="Refinery Compatibility" score={topPick.compatibility_score} tooltip="Grade match for average Indian refinery configurations." />
        </div>
      </div>

      {/* Alternatives Grid */}
      <div className="alternatives-grid">
        {alternatives.map(alt => (
          <div key={alt.id || alt.source_country} className="recommendation-card alt-pick">
            <div className="card-header">
              <div className="supplier-id">
                <span className="rank-badge">#{alt.rank}</span>
                <h4>{alt.source_country}</h4>
              </div>
              <div className="final-score small">
                {alt.final_score.toFixed(1)}
              </div>
            </div>
            
            <div className="scores-breakdown compact">
              <ScoreBar label="Price" score={alt.price_score} tooltip="Price Competitiveness" />
              <ScoreBar label="Risk" score={alt.distance_score} tooltip="Distance & Geopolitical Risk" />
              <ScoreBar label="Tanker" score={alt.tanker_availability_score} tooltip="Tanker Availability" />
              <ScoreBar label="Port" score={alt.port_congestion_score} tooltip="Port Congestion" />
              <ScoreBar label="Grade" score={alt.compatibility_score} tooltip="Refinery Compatibility" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
