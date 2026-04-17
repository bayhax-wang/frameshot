import React from 'react';

interface PricingCardProps {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export default function PricingCard({ 
  name, 
  price, 
  description, 
  features, 
  cta, 
  highlighted = false 
}: PricingCardProps) {
  return (
    <div 
      className={`
        relative rounded-xl p-6 
        ${highlighted 
          ? 'bg-gradient-to-b from-accent-indigo/20 to-background-secondary border-accent-indigo' 
          : 'bg-background-secondary border-border'
        } 
        border transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-accent-indigo/10
      `}
    >
      {highlighted && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-accent-indigo text-white px-4 py-1 rounded-full text-sm font-medium">
            Most Popular
          </span>
        </div>
      )}
      
      <div className="text-center">
        <h3 className="text-xl font-semibold text-white mb-2">
          {name}
        </h3>
        <div className="mb-1">
          <span className="text-3xl font-bold text-white">
            {price}
          </span>
          {price !== '$0' && (
            <span className="text-text-secondary">/month</span>
          )}
        </div>
        <p className="text-text-secondary text-sm mb-6">
          {description}
        </p>
      </div>

      <ul className="space-y-3 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center text-text-secondary">
            <svg className="w-4 h-4 mr-3 text-accent-indigo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <button 
        className={`
          w-full py-3 px-4 rounded-lg font-medium transition-colors duration-200
          ${highlighted
            ? 'bg-accent-indigo hover:bg-accent-indigo-dark text-white'
            : 'bg-background-tertiary hover:bg-gray-600 text-white border border-border'
          }
        `}
      >
        {cta}
      </button>
    </div>
  );
}