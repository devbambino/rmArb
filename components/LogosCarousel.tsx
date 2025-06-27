'use client';
import React from 'react';
interface LogosProps { logos: string[]; }
export default function LogosCarousel({ logos }: LogosProps) {
  return (
    <section className="py-12 bg-primary/20">
      <div className="flex justify-center items-center space-x-12">
        {logos.map((src, i) => <img key={i} src={src} alt="Partner logo" className="h-12" />)}
      </div>
    </section>
  );
}