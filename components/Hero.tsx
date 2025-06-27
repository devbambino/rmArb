'use client';
import React from 'react';
interface HeroProps { title: string; subtitle: string; cta: string; }
export default function Hero({ title, subtitle, cta }: HeroProps) {
  return (
    <section className="bg-gradient-to-r from-moniblue to-monigreen text-white text-center py-20 px-4">
      <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
      <p className="max-w-2xl mx-auto text-lg mb-8">{subtitle}</p>
      <button className="bg-white text-moniblue font-semibold px-6 py-3 rounded-full hover:bg-gray-100">
        {cta}
      </button>
    </section>
  );
}