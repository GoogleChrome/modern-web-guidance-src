
import React from 'react';
import AdaptiveImage from './AdaptiveImage';
import './Hero.css';

const Hero = () => {
    // High res and low res placeholder for adaptive loading
    const heroImg = "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80";
    const heroPlaceholder = "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=100&q=10";

    return (
        <section className="hero">
            <div className="hero-content">
                <h1>Brewed to Perfection</h1>
                <p>Experience the finest beans from around the world.</p>
            </div>
            <div className="hero-image-wrapper">
                <AdaptiveImage 
                    src={heroImg} 
                    placeholder={heroPlaceholder} 
                    alt="Coffee pouring into a cup" 
                    className="hero-image" 
                />
            </div>
        </section>
    );
};

export default Hero;
