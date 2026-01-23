import React from 'react';
import type { Spot } from '../../types';
import './trending.css';

type TrendCardProps = {
    spot: Spot;
    rank?: number;
    onClick: (spot: Spot) => void;
};

export const TrendCard = ({ spot, rank, onClick }: TrendCardProps) => {
    // Use first image or placeholder
    // const imageUrl = spot.imageUrls?.[0] || spot.coverImageUrl || 'https://placehold.co/400x600?text=No+Image';
    // Assuming 'Spot' has mock images or we can infer one. 
    // Ideally, use a helper or real data field. 
    // For mock MVP, we might need a placeholder if no image exists.

    // Note: Standard 'Spot' type usually has 'id', 'title', etc. 
    // Let's assume there's a way to get an image.
    // We'll use a placeholder logic if not obvious.

    const imageUrl = "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&q=80&w=400"; // Generic Tokyo/Night placeholder default

    // If we have spot data with images, use it.
    // const bgImage = spot.images?.[0] ?? imageUrl; 

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        onClick(spot);
    };

    return (
        <div className="trend-card" onClick={handleClick}>
            {rank && (
                <div className={`trend-card-rank ${rank <= 3 ? 'top-3' : ''}`}>
                    {rank}
                </div>
            )}
            <img src={imageUrl} alt={spot.title} className="trend-card-image" loading="lazy" />
            <div className="trend-card-overlay">
                <h3 className="trend-card-title">{spot.title}</h3>
                <div className="trend-card-meta">
                    <div className="trend-card-stats">
                        <span>❤️</span>
                        <span>{spot.likes ?? 0}</span>
                    </div>
                    {spot.commentsCount !== undefined && (
                        <div className="trend-card-stats">
                            <span>💬</span>
                            <span>{spot.commentsCount}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
