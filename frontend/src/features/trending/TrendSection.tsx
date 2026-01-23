import React from 'react';
import { Spot } from '../../types';
import { TrendCard } from './TrendCard';
import './trending.css';

type TrendSectionProps = {
    title: string;
    icon: React.ReactNode;
    spots: Spot[];
    isLoading: boolean;
    onSpotClick: (spot: Spot) => void;
    showRank?: boolean;
};

export const TrendSection = ({ title, icon, spots, isLoading, onSpotClick, showRank = false }: TrendSectionProps) => {
    if (isLoading) {
        return (
            <div className="trend-section">
                <div className="trend-section-header">
                    <h2 className="trend-section-title">
                        <span className="trend-section-icon">{icon}</span>
                        {title}
                    </h2>
                </div>
                <div className="trend-scroll-container">
                    <div className="trend-spacer" />
                    {/* Skeleton Loaders */}
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="trend-card" style={{ background: '#e0e0e0', animation: 'pulse 1.5s infinite' }} />
                    ))}
                    <div className="trend-spacer" />
                </div>
            </div>
        );
    }

    if (spots.length === 0) {
        return null; // Don't show empty sections
    }

    return (
        <div className="trend-section">
            <div className="trend-section-header">
                <h2 className="trend-section-title">
                    <span className="trend-section-icon">{icon}</span>
                    {title}
                </h2>
            </div>
            <div className="trend-scroll-container">
                {/* Explicit spacer for start */}
                <div className="trend-spacer" />

                {spots.map((spot, index) => (
                    <TrendCard
                        key={spot.id}
                        spot={spot}
                        rank={showRank ? index + 1 : undefined}
                        onClick={onSpotClick}
                    />
                ))}

                {/* Explicit spacer for end */}
                <div className="trend-spacer" />
            </div>
        </div>
    );
};
