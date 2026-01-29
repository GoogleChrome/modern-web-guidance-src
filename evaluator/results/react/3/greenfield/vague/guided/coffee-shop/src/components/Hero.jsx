import React from 'react';
import AdaptiveImage from './AdaptiveImage';
import styles from './Hero.module.css';

const Hero = () => {
  return (
    <section className={styles.heroSection}>
      <div className={styles.imageWrapper}>
        <AdaptiveImage 
          src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=80&w=2000"
          placeholder="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=10&w=200"
          alt="Artisan Coffee Pour"
          className={styles.heroImage}
        />
      </div>
      <div className={styles.content}>
        <h1 className={styles.title}>Taste the Morning.</h1>
        <p className={styles.subtitle}>Premium beans, ethically sourced, roasted to perfection.</p>
      </div>
    </section>
  );
};

export default Hero;
