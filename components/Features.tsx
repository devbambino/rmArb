'use client';
import React from 'react';
interface Feature { title: string; desc: string; }
interface FeaturesProps { items: Feature[]; }
export default function Features({ items }: FeaturesProps) {
  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {items.map(i => (
          <div key={i.title} className="p-6 bg-primary/10 rounded-xl">
            <h4 className="text-2xl font-bold mb-2">{i.title}</h4>
            <p>{i.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}