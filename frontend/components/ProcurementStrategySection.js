'use client';

import { useState, useEffect } from 'react';
import { generateRecommendations, getReservePlan } from '@/lib/api';
import ProcurementRecommendations from './ProcurementRecommendations';
import StrategicReservePlan from './StrategicReservePlan';

export default function ProcurementStrategySection({ scenarioId }) {
  const [recommendations, setRecommendations] = useState([]);
  const [reservePlan, setReservePlan] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!scenarioId) return;
    
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        // Run orchestrators and get recommendations
        const recRes = await generateRecommendations(scenarioId);
        if (recRes.status === 'ok') {
          setRecommendations(recRes.recommendations);
          setReservePlan(recRes.reserve_plan || []);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load procurement strategy.");
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [scenarioId]);

  if (!scenarioId) {
    return (
      <div className="empty-state">
        <p>Select and run a disruption scenario above to generate a procurement strategy.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="btn-spinner" style={{ width: 24, height: 24, borderWidth: 3 }}></div>
        <p>Orchestrating procurement and reserve strategy...</p>
      </div>
    );
  }
  
  if (error) {
    return <div className="scenario-error">{error}</div>;
  }

  return (
    <div className="procurement-strategy-container">
      <ProcurementRecommendations recommendations={recommendations} />
      <StrategicReservePlan plan={reservePlan} />
    </div>
  );
}
