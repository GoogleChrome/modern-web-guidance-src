import React, { useEffect } from 'react';

const SpeculationRules = () => {
  useEffect(() => {
    // Check if speculation rules are supported
    if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
      const script = document.createElement('script');
      script.type = 'speculationrules';
      const rules = {
        prerender: [
          {
            source: 'list',
            urls: [
              '/menu',
              '/locations',
              '/rewards',
              '/account'
            ],
            eagerness: 'moderate'
          }
        ]
      };
      script.textContent = JSON.stringify(rules);
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    }
  }, []);

  return null;
};

export default SpeculationRules;
