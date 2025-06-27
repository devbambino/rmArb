// components/HowItWorks.tsx
import React, { type ElementType } from 'react'; // Import ElementType

// Define the new Step interface
export interface Step {
  step: string;
  title: string;
  desc: string;
  icon: ElementType; // This will hold the icon component (e.g., QrCodeIcon)
}

interface HowItWorksProps {
  id: string;
  heading: string;
  steps: Step[];
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ id, heading, steps }) => (
  <section id={id} className="bg-primary/90 py-20 px-4 text-center">
    <h2 className="text-3xl md:text-4xl font-semibold text-white mb-12">{heading}</h2>
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
      {steps.map((stepItem) => { // Renamed 'step' to 'stepItem' to avoid conflict
        const IconComponent = stepItem.icon; // Get the Icon component from the step data
        return (
          <div key={stepItem.step} className="flex flex-col items-center">
            <div className="mx-auto mb-6 w-20 h-20 bg-moniblue rounded-full flex items-center justify-center text-lg font-bold ring-4 ring-secondary/70 shadow-lg">
              {/* Render the dynamically passed icon */}
              <IconComponent className="h-10 w-10 text-[#50e2c3]" />
            </div>
            <h4 className="text-xl text-[#50e2c3] font-semibold mb-2">{stepItem.step + ". " + stepItem.title}</h4>
            <p className="text-base text-neutral">{stepItem.desc}</p>
          </div>
        );
      })}
    </div>
  </section>
);